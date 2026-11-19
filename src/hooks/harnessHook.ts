/**
 * Harness hook runtime — `jact hook <harness>`.
 *
 * An agent harness calls this after a tool runs and pipes the tool event to
 * stdin. A write of a Markdown file is validated; a read of a Markdown file
 * has its linked sections extracted. The answer goes to stdout in the format
 * the harness expects. A hook never fails the harness: bad input yields no
 * output.
 *
 * Antigravity CLI is the one harness whose tool hook cannot answer the model.
 * For it, the tool hook holds the result in a file, and the hook that runs
 * before the next model call hands it over.
 *
 * @module hooks/harnessHook
 */

import { spawnSync } from "node:child_process";
import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

export const HARNESSES = [
	"claude",
	"codex",
	"antigravity",
	"gemini",
	"pi",
	"omp",
] as const;
export type Harness = (typeof HARNESSES)[number];

export type HookKind = "write" | "read";

export interface HookRequest {
	kind: HookKind;
	paths: string[];
	cwd: string;
	sessionId: string | undefined;
}

export interface JactRun {
	status: number | null;
	stdout: string;
}

/** Runs one jact command. Injected so tests need no child process. */
export type JactRunner = (args: readonly string[], cwd: string) => JactRun;

export interface HookResult {
	context: string;
	failed: boolean;
}

/** Longest linked-context text a read hook adds to the model's context. */
export const MAX_READ_CONTEXT_CHARS = 20_000;

const WRITE_TOOLS = new Set([
	"write",
	"edit",
	"multiedit",
	"apply_patch",
	"write_file",
	"edit_file",
	"replace",
	"write_to_file",
	"replace_file_content",
	"multi_replace_file_content",
]);
const READ_TOOLS = new Set(["read", "read_file", "view_file"]);
// `Path` is what Antigravity CLI 1.5.12 sends. `TargetFile` and `AbsolutePath`
// are the names in its documentation.
const PATH_FIELDS = [
	"file_path",
	"path",
	"absolute_path",
	"Path",
	"TargetFile",
	"AbsolutePath",
];
// Codex sends an edit as patch text. Each changed file has a header line.
const PATCH_HEADER = /^\*\*\* (?:Add File|Update File|Move to): (.+)$/gm;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstText(...values: unknown[]): string | undefined {
	for (const value of values)
		if (typeof value === "string" && value.length > 0) return value;
	return undefined;
}

/** The project folder an event names: `cwd`, or Antigravity CLI's first workspace path. */
function eventFolder(payload: JsonRecord): string {
	const workspaces = payload["workspacePaths"];
	return (
		firstText(
			payload["cwd"],
			Array.isArray(workspaces) ? workspaces[0] : undefined,
		) ?? process.cwd()
	);
}

function stringLeaves(value: unknown, depth = 0): string[] {
	if (typeof value === "string") return [value];
	if (depth > 2) return [];
	if (Array.isArray(value))
		return value.flatMap((item) => stringLeaves(item, depth + 1));
	if (isRecord(value))
		return Object.values(value).flatMap((item) =>
			stringLeaves(item, depth + 1),
		);
	return [];
}

function candidatePaths(toolInput: unknown): string[] {
	if (!isRecord(toolInput)) return [];
	const found: string[] = [];
	for (const field of PATH_FIELDS) {
		const value = toolInput[field];
		if (typeof value === "string") found.push(value);
	}
	const pathList = toolInput["paths"];
	if (Array.isArray(pathList))
		for (const value of pathList)
			if (typeof value === "string") found.push(value);
	for (const text of stringLeaves(toolInput))
		for (const match of text.matchAll(PATCH_HEADER))
			if (match[1] !== undefined) found.push(match[1]);
	return found;
}

function absoluteMarkdownPath(raw: string, cwd: string): string | undefined {
	let value = raw.trim();
	if (value.startsWith("@")) value = value.slice(1);
	if (value.startsWith("~/")) value = resolve(homedir(), value.slice(2));
	if (!value.toLowerCase().endsWith(".md")) return undefined;
	const absolute = isAbsolute(value) ? value : resolve(cwd, value);
	return existsSync(absolute) ? absolute : undefined;
}

/** Turns a harness tool event into a request, or undefined when jact has nothing to do. */
export function parseHookPayload(payloadText: string): HookRequest | undefined {
	let payload: unknown;
	try {
		payload = JSON.parse(payloadText);
	} catch {
		return undefined;
	}
	if (!isRecord(payload)) return undefined;
	// Antigravity CLI puts the tool under `toolCall`. The other harnesses use flat fields.
	const toolCall = isRecord(payload["toolCall"])
		? payload["toolCall"]
		: undefined;
	// Antigravity CLI also runs the hook after a tool call that failed.
	if (toolCall !== undefined && firstText(payload["error"]) !== undefined)
		return undefined;
	const toolName = firstText(payload["tool_name"], toolCall?.["name"]);
	if (toolName === undefined) return undefined;
	const name = toolName.toLowerCase();
	const kind: HookKind | undefined = WRITE_TOOLS.has(name)
		? "write"
		: READ_TOOLS.has(name)
			? "read"
			: undefined;
	if (kind === undefined) return undefined;
	const cwd = eventFolder(payload);
	const paths = [
		...new Set(
			candidatePaths(payload["tool_input"] ?? toolCall?.["args"])
				.map((raw) => absoluteMarkdownPath(raw, cwd))
				.filter((value): value is string => value !== undefined),
		),
	];
	if (paths.length === 0) return undefined;
	return {
		kind,
		paths,
		cwd,
		sessionId: firstText(payload["session_id"], payload["conversationId"]),
	};
}

function validateWrites(request: HookRequest, run: JactRunner): HookResult {
	const reports: string[] = [];
	for (const file of request.paths) {
		const result = run(["validate", file], request.cwd);
		// Exit 1 means broken links. Exit 2 is a system error the model cannot fix.
		if (result.status !== 1) continue;
		reports.push(
			[
				`jact: broken Markdown links in ${file}`,
				result.stdout.trim(),
				`Fix these links, then check again: jact validate "${file}"`,
			].join("\n"),
		);
	}
	return { context: reports.join("\n\n"), failed: reports.length > 0 };
}

function linkedSections(stdout: string): string[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(stdout);
	} catch {
		return [];
	}
	if (!isRecord(parsed)) return [];
	const blocks = parsed["extractedContentBlocks"];
	if (!isRecord(blocks)) return [];
	const sections: string[] = [];
	// Keys are content hashes, which mean nothing to a model. Each block
	// already starts with its own heading.
	for (const block of Object.values(blocks)) {
		if (!isRecord(block)) continue;
		const content = block["content"];
		if (typeof content === "string" && content.trim().length > 0)
			sections.push(content.trim());
	}
	return sections;
}

function extractReads(request: HookRequest, run: JactRunner): HookResult {
	const parts: string[] = [];
	for (const file of request.paths) {
		const args = ["extract", "links", file];
		if (request.sessionId !== undefined)
			args.push("--session", request.sessionId);
		const result = run(args, request.cwd);
		if (result.status !== 0) continue;
		const sections = linkedSections(result.stdout);
		if (sections.length === 0) continue;
		parts.push(
			`jact: sections that ${file} links to\n\n${sections.join("\n\n---\n\n")}`,
		);
	}
	let context = parts.join("\n\n");
	if (context.length > MAX_READ_CONTEXT_CHARS)
		context = `${context.slice(0, MAX_READ_CONTEXT_CHARS)}\n\n[jact: linked content cut at ${MAX_READ_CONTEXT_CHARS} characters. Run jact extract links for the rest.]`;
	return { context, failed: false };
}

/**
 * Formats a result the way the harness reads hook output. Empty string means say nothing.
 * Antigravity CLI is not handled here: its tool hook cannot answer the model.
 */
export function formatHookOutput(harness: Harness, result: HookResult): string {
	if (result.context.length === 0) return "";
	if (harness === "pi" || harness === "omp") return JSON.stringify(result);
	if (harness === "gemini")
		return JSON.stringify({
			hookSpecificOutput: {
				hookEventName: "AfterTool",
				additionalContext: result.context,
			},
		});
	if (result.failed)
		return JSON.stringify({ decision: "block", reason: result.context });
	return JSON.stringify({
		hookSpecificOutput: {
			hookEventName: "PostToolUse",
			additionalContext: result.context,
		},
	});
}

/**
 * Default runner: re-runs this same jact build as a child process.
 * Contract: never throws. A run that cannot start returns status 2 or null.
 */
export const spawnJact: JactRunner = (args, cwd) => {
	const entry = process.argv[1];
	if (entry === undefined) return { status: 2, stdout: "" };
	const result = spawnSync(process.execPath, [entry, ...args], {
		cwd,
		encoding: "utf8",
		timeout: 30_000,
		maxBuffer: 16 * 1024 * 1024,
	});
	return { status: result.status, stdout: result.stdout };
};

function logInvocation(entry: JsonRecord): void {
	const logFile = process.env["JACT_HOOK_LOG"];
	if (logFile === undefined || logFile.length === 0) return;
	try {
		appendFileSync(logFile, `${JSON.stringify(entry)}\n`);
	} catch {
		// A log that cannot be written must not break the harness.
	}
}

/** One result that waits for Antigravity CLI's next model call. */
interface HeldResult extends HookResult {
	/** Tool kind plus file. A later result for the same key replaces an earlier one. */
	key: string;
}

interface Conversation {
	folder: string;
	id: string;
}

/** Folder for held results, beside jact's other per-project state in `.jact/`. */
const HELD_DIR = join(".jact", "hook-pending");
const ANTIGRAVITY_NOTHING = "{}";
// Antigravity CLI needs a decision from a Stop hook. Any value but "continue" lets it stop.
const ANTIGRAVITY_MAY_STOP = JSON.stringify({ decision: "stop" });

/**
 * What a hook prints when jact has nothing to say.
 * Contract: an empty string for each harness but Antigravity CLI, which reads
 * JSON from each hook: `{"decision":"stop"}` for the Stop event, else `{}`.
 */
export function silentHookOutput(harness: Harness, event?: string): string {
	if (harness !== "antigravity") return "";
	return event?.toLowerCase() === "stop"
		? ANTIGRAVITY_MAY_STOP
		: ANTIGRAVITY_NOTHING;
}

function conversationOf(payloadText: string): Conversation | undefined {
	let payload: unknown;
	try {
		payload = JSON.parse(payloadText);
	} catch {
		return undefined;
	}
	if (!isRecord(payload)) return undefined;
	return {
		folder: eventFolder(payload),
		id: firstText(payload["conversationId"]) ?? "no-conversation",
	};
}

function heldFile(conversation: Conversation): string {
	const name = conversation.id.replace(/[^A-Za-z0-9_-]/g, "_");
	return join(conversation.folder, HELD_DIR, `${name}.jsonl`);
}

function holdResult(conversation: Conversation, held: HeldResult): void {
	try {
		const file = heldFile(conversation);
		// An empty result only matters when it withdraws an earlier one.
		if (held.context.length === 0 && !existsSync(file)) return;
		mkdirSync(dirname(file), { recursive: true });
		appendFileSync(file, `${JSON.stringify(held)}\n`);
	} catch {
		// A result that cannot be stored is dropped. The harness keeps working.
	}
}

/** Returns the held results and removes them, so each one reaches the model one time. */
function takeHeldResults(conversation: Conversation): HeldResult[] {
	const file = heldFile(conversation);
	const taken = `${file}.${process.pid}.taken`;
	let text: string;
	try {
		// Rename first: a tool hook that runs at the same moment starts a new file.
		renameSync(file, taken);
		text = readFileSync(taken, "utf8");
	} catch {
		return [];
	}
	try {
		rmSync(taken, { force: true });
	} catch {
		// A leftover file is harmless: no later call reads it.
	}
	const latest = new Map<string, HeldResult>();
	for (const line of text.split("\n")) {
		let entry: unknown;
		try {
			entry = JSON.parse(line);
		} catch {
			continue;
		}
		if (!isRecord(entry)) continue;
		const { key, context, failed } = entry;
		if (typeof key !== "string" || typeof context !== "string") continue;
		latest.delete(key);
		latest.set(key, { key, context, failed: failed === true });
	}
	return [...latest.values()].filter((held) => held.context.length > 0);
}

/**
 * Antigravity CLI. Its PostToolUse hook must print `{}`, so the result waits in
 * a file. PreInvocation, which runs before a model call, hands it over as a
 * system message that stays in the conversation. Stop is the fallback: a
 * broken-link report the model has not seen makes the agent continue one time.
 * Contract: always returns JSON, and never throws.
 * Contract: each held result is handed over at most one time. A later result
 * for the same file replaces an earlier one, so a fixed file withdraws its report.
 */
function runAntigravityHook(
	payloadText: string,
	run: JactRunner,
	event: string,
): string {
	const harness: Harness = "antigravity";
	const conversation = conversationOf(payloadText);
	const eventName = event.toLowerCase();

	if (eventName === "posttooluse") {
		const request = parseHookPayload(payloadText);
		if (request === undefined || conversation === undefined) {
			logInvocation({ harness, event, handled: false });
			return ANTIGRAVITY_NOTHING;
		}
		const result =
			request.kind === "write"
				? validateWrites(request, run)
				: extractReads(request, run);
		// An empty write result withdraws an earlier report: the file is fixed.
		// An empty read result means only that jact already extracted the links.
		if (request.kind === "write" || result.context.length > 0)
			holdResult(conversation, {
				key: `${request.kind}:${request.paths.join("|")}`,
				...result,
			});
		logInvocation({
			harness,
			event,
			handled: true,
			kind: request.kind,
			paths: request.paths,
			failed: result.failed,
			contextChars: result.context.length,
		});
		return ANTIGRAVITY_NOTHING;
	}

	if (eventName !== "preinvocation" && eventName !== "stop") {
		logInvocation({ harness, event, handled: false });
		return ANTIGRAVITY_NOTHING;
	}

	const held = conversation === undefined ? [] : takeHeldResults(conversation);
	const reports = held.filter((result) => result.failed);
	// At Stop the turn is over: only a broken-link report is worth one more step.
	const delivered =
		eventName === "stop"
			? reports
			: [...reports, ...held.filter((result) => !result.failed)];
	const text = delivered.map((result) => result.context).join("\n\n");
	logInvocation({
		harness,
		event,
		handled: delivered.length > 0,
		failed: reports.length > 0,
		deliveredChars: text.length,
	});
	if (text.length === 0) return silentHookOutput(harness, event);
	if (eventName === "stop")
		return JSON.stringify({ decision: "continue", reason: text });
	// Antigravity CLI 1.5.12 kept a nested systemMessage in the conversation. The
	// model lost an ephemeralMessage after one model call, and a systemMessage
	// that was plain text never reached the conversation.
	return JSON.stringify({
		injectSteps: [{ systemMessage: { systemMessage: text } }],
	});
}

/**
 * The event name in an Antigravity CLI hook input. Version 1.5.12 sends
 * `hookEventName`; its documentation does not list the field.
 * Contract: never throws. Input without the field returns undefined.
 */
function namedEvent(payloadText: string): string | undefined {
	try {
		const payload: unknown = JSON.parse(payloadText);
		return isRecord(payload) ? firstText(payload["hookEventName"]) : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Handles one hook call. Returns the text to print, or an empty string.
 * Contract: input jact cannot use returns an empty string, never an error.
 * Contract: for Antigravity CLI the answer is always JSON. The hook event is
 * `event` when it is passed, else the input's `hookEventName`, else PostToolUse.
 */
export function runHarnessHook(
	harness: Harness,
	payloadText: string,
	run: JactRunner = spawnJact,
	event?: string,
): string {
	if (harness === "antigravity")
		return runAntigravityHook(
			payloadText,
			run,
			event ?? namedEvent(payloadText) ?? "PostToolUse",
		);
	const request = parseHookPayload(payloadText);
	if (request === undefined) {
		logInvocation({ harness, handled: false });
		return "";
	}
	const result =
		request.kind === "write"
			? validateWrites(request, run)
			: extractReads(request, run);
	logInvocation({
		harness,
		handled: true,
		kind: request.kind,
		paths: request.paths,
		failed: result.failed,
		contextChars: result.context.length,
	});
	return formatHookOutput(harness, result);
}
