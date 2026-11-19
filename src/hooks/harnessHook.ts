/**
 * Harness hook runtime — `jact hook <harness>`.
 *
 * An agent harness calls this after a tool runs and pipes the tool event to
 * stdin. A write of a Markdown file is validated; a read of a Markdown file
 * has its linked sections extracted. The answer goes to stdout in the format
 * the harness expects. A hook never fails the harness: bad input yields no
 * output.
 *
 * @module hooks/harnessHook
 */

import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";

export const HARNESSES = ["claude", "codex", "gemini", "pi", "omp"] as const;
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
	"replace",
]);
const READ_TOOLS = new Set(["read", "read_file"]);
const PATH_FIELDS = ["file_path", "path", "absolute_path"];
// Codex sends an edit as patch text. Each changed file has a header line.
const PATCH_HEADER = /^\*\*\* (?:Add File|Update File|Move to): (.+)$/gm;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
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
	const toolName = payload["tool_name"];
	if (typeof toolName !== "string") return undefined;
	const name = toolName.toLowerCase();
	const kind: HookKind | undefined = WRITE_TOOLS.has(name)
		? "write"
		: READ_TOOLS.has(name)
			? "read"
			: undefined;
	if (kind === undefined) return undefined;
	const rawCwd = payload["cwd"];
	const cwd =
		typeof rawCwd === "string" && rawCwd.length > 0 ? rawCwd : process.cwd();
	const paths = [
		...new Set(
			candidatePaths(payload["tool_input"])
				.map((raw) => absoluteMarkdownPath(raw, cwd))
				.filter((value): value is string => value !== undefined),
		),
	];
	if (paths.length === 0) return undefined;
	const session = payload["session_id"];
	return {
		kind,
		paths,
		cwd,
		sessionId:
			typeof session === "string" && session.length > 0 ? session : undefined,
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

/** Formats a result the way the harness reads hook output. Empty string means say nothing. */
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

/**
 * Handles one hook call. Returns the text to print, or an empty string.
 * Contract: input jact cannot use returns an empty string, never an error.
 */
export function runHarnessHook(
	harness: Harness,
	payloadText: string,
	run: JactRunner = spawnJact,
): string {
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
