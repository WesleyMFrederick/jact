/**
 * Harness setup — `jact setup <harness>`.
 *
 * Writes the wiring that makes a harness call `jact hook <harness>` after it
 * writes or reads a file. JSON-configured harnesses get one merged entry;
 * existing entries from other tools stay untouched. Antigravity CLI keys its
 * hooks file by hook name, so jact owns the one key `jact`. pi and omp get one
 * generated extension file.
 *
 * @module hooks/setupHarness
 */

import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { Harness } from "./harnessHook.js";

export interface SetupOptions {
	/** Write to the user-level config instead of the project. */
	global: boolean;
	/** Command that runs jact from the harness. */
	command: string;
	/** Project folder. */
	cwd: string;
	/** User home folder. */
	home: string;
}

export type SetupAction =
	| "installed"
	| "updated"
	| "unchanged"
	| "removed"
	| "absent";

export interface SetupOutcome {
	path: string;
	action: SetupAction;
	notes: string[];
}

interface JsonTarget {
	kind: "json";
	file: string;
	event: string;
	matcher: string;
	named: boolean;
	notes: string[];
}

interface FileTarget {
	kind: "file";
	file: string;
	notes: string[];
}

/** A hooks file whose top-level keys are hook names, as Antigravity CLI reads it. */
interface NamedHookTarget {
	kind: "named";
	file: string;
	notes: string[];
}

type JsonRecord = Record<string, unknown>;

/** The key jact owns in a hooks file that is keyed by hook name. */
const HOOK_NAME = "jact";
// The first three names are what Antigravity CLI 1.5.12 sent in a live session.
// The last four are the names in its documentation, which reached no hook there.
const ANTIGRAVITY_FILE_TOOLS =
	"write_file|edit_file|read_file|write_to_file|replace_file_content|multi_replace_file_content|view_file";

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function target(
	harness: Harness,
	options: SetupOptions,
): JsonTarget | FileTarget | NamedHookTarget {
	const base = options.global ? options.home : options.cwd;
	switch (harness) {
		case "antigravity":
			return {
				kind: "named",
				// Antigravity CLI does not load hooks from ~/.gemini/antigravity-cli/settings.json.
				file: options.global
					? join(base, ".gemini", "config", "hooks.json")
					: join(base, ".agents", "hooks.json"),
				notes: [
					"Start agy and run /hooks. The list must show a hook named jact.",
					"Antigravity CLI gives a tool hook no way to answer, so the model gets jact's report before its next step.",
				],
			};
		case "claude":
			return {
				kind: "json",
				file: join(base, ".claude", "settings.json"),
				event: "PostToolUse",
				matcher: "Write|Edit|MultiEdit|Read",
				named: false,
				notes: [],
			};
		case "codex":
			return {
				kind: "json",
				file: join(base, ".codex", "hooks.json"),
				event: "PostToolUse",
				matcher: "apply_patch",
				named: false,
				notes: [
					"Codex runs a new hook only after you trust it: start codex, run /hooks, and trust the jact entry.",
					"Codex reads files through shell commands, so jact runs on writes only.",
				],
			};
		case "gemini":
			return {
				kind: "json",
				file: join(base, ".gemini", "settings.json"),
				event: "AfterTool",
				matcher: "write_file|replace|read_file",
				named: true,
				notes: [],
			};
		case "pi":
			return {
				kind: "file",
				file: options.global
					? join(base, ".pi", "agent", "extensions", "jact.ts")
					: join(base, ".pi", "extensions", "jact.ts"),
				notes: options.global
					? ["Restart pi, or run /reload, to load the extension."]
					: [
							"pi loads a project extension only after you trust the project: start pi and accept the trust prompt, or run /trust.",
							"Without a UI, pass --approve: pi -p --approve '<prompt>'.",
						],
			};
		case "omp":
			return {
				kind: "file",
				file: options.global
					? join(base, ".omp", "agent", "extensions", "jact.ts")
					: join(base, ".omp", "extensions", "jact.ts"),
				notes: ["Restart omp to load the extension."],
			};
	}
}

export function harnessConfigPath(harness: Harness, options: SetupOptions): string {
	return target(harness, options).file;
}

/** The exact command a harness runs. Also how setup recognizes its own entry. */
export function hookCommand(harness: Harness, command: string): string {
	return `${command} hook ${harness}`;
}

/**
 * The hook definition for Antigravity CLI. Each command carries its event,
 * because Antigravity CLI does not put the event name in the hook input.
 * Only tool events take a matcher; the other events list their handlers directly.
 */
function antigravityHooks(command: string): JsonRecord {
	const handler = (event: string, timeout: number) => ({
		type: "command",
		command: `${hookCommand("antigravity", command)} --event ${event}${command === "jact" ? "" : " # jact"}`,
		timeout,
	});
	return {
		PostToolUse: [
			{
				matcher: ANTIGRAVITY_FILE_TOOLS,
				// Longer than jact's own 30-second limit, so jact always gets to answer.
				hooks: [handler("PostToolUse", 60)],
			},
		],
		PreInvocation: [handler("PreInvocation", 10)],
		Stop: [handler("Stop", 10)],
	};
}

function isOwnHook(hook: unknown, harness: Harness, event?: string): boolean {
	if (!isRecord(hook)) return false;
	const command = hook["command"];
	if (typeof command !== "string") return false;
	const suffix = ` hook ${harness}${event ? ` --event ${event}` : ""}`;
	const text = command.trim();
	// Custom commands carry a shell comment: a matching subcommand alone
	// cannot distinguish jact from another program with its own hook command.
	return text === `jact${suffix}` || text.endsWith(`${suffix} # jact`);
}

function isOwnAntigravityHooks(value: unknown): boolean {
	if (!isRecord(value)) return false;
	if ("enabled" in value && typeof value["enabled"] !== "boolean") return false;
	const events = Object.entries(value).filter(([event]) => event !== "enabled");
	return events.length > 0 && events.every(([event, groups]) => {
		if (!["PostToolUse", "PreInvocation", "Stop"].includes(event) ||
			!Array.isArray(groups) || groups.length === 0) return false;
		return groups.every((group: unknown) => {
			const hooks = event === "PostToolUse" && isRecord(group) ? group["hooks"] : [group];
			return Array.isArray(hooks) && hooks.length > 0 &&
				hooks.every((hook: unknown) => isRecord(hook) &&
					hook["type"] === "command" && isOwnHook(hook, "antigravity", event));
		});
	});
}

function withoutOwnHooks(groups: unknown[], harness: Harness): unknown[] {
	return groups.flatMap((group) => {
		if (!isRecord(group) || !Array.isArray(group["hooks"])) return [group];
		const hooks = group["hooks"].filter((hook) => !isOwnHook(hook, harness));
		if (hooks.length === group["hooks"].length) return [group];
		return hooks.length > 0 ? [{ ...group, hooks }] : [];
	});
}

function hasWiring(
	groups: unknown[],
	matcher: string,
	harness: Harness,
	event?: string,
): boolean {
	return groups.some((group) => {
		if (!isRecord(group) || typeof group["matcher"] !== "string") return false;
		try {
			const pattern = new RegExp(`^(?:${group["matcher"]})$`);
			if (!matcher.split("|").every((tool) => pattern.test(tool))) return false;
		} catch {
			return false;
		}
		return (
			Array.isArray(group["hooks"]) &&
			group["hooks"].some(
				(hook) =>
					isRecord(hook) &&
					hook["type"] === "command" &&
					isOwnHook(hook, harness, event),
			)
		);
	});
}

function readJsonConfig(file: string): JsonRecord {
	if (!existsSync(file)) return {};
	const text = readFileSync(file, "utf8");
	if (text.trim().length === 0) return {};
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch (cause) {
		throw new Error(
			`${file} is not valid JSON. jact changed nothing. Repair the file, then run setup again.`,
			{ cause },
		);
	}
	if (!isRecord(parsed))
		throw new Error(
			`${file} does not hold a JSON object. jact changed nothing.`,
		);
	return parsed;
}

function eventGroups(config: JsonRecord, event: string): unknown[] {
	const hooks = config["hooks"];
	if (hooks === undefined) return [];
	if (!isRecord(hooks))
		throw new Error("hooks must be a JSON object. jact changed nothing.");
	const groups = hooks[event];
	if (groups === undefined) return [];
	if (!Array.isArray(groups))
		throw new Error(`hooks.${event} must be an array. jact changed nothing.`);
	return groups;
}

function withGroups(
	config: JsonRecord,
	event: string,
	groups: unknown[],
): JsonRecord {
	const hooks = isRecord(config["hooks"]) ? { ...config["hooks"] } : {};
	if (groups.length > 0) hooks[event] = groups;
	else delete hooks[event];
	return { ...config, hooks };
}

function serialize(config: JsonRecord): string {
	return `${JSON.stringify(config, null, 2)}\n`;
}

/** Extension source for pi and omp. It imports nothing from the harness, so one file serves both. */
export function extensionSource(harness: Harness, command: string): string {
	const commandLine = JSON.stringify(hookCommand(harness, command));
	return `// Generated by \`jact setup ${harness}\`. Run that command again to update. Do not edit.
// After a write, edit, or read of a Markdown file, this asks jact what the model should know.
import { spawn } from "node:child_process";

const COMMAND_LINE = ${commandLine};
const TIMEOUT_MS = 30000;

function askJact(payload: unknown, cwd: string): Promise<{ context?: string; failed?: boolean }> {
	return new Promise((done) => {
		const child = spawn(COMMAND_LINE, { cwd, shell: true, detached: process.platform !== "win32", stdio: ["pipe", "pipe", "ignore"] });
		let settled = false;
		const finish = (answer: { context?: string; failed?: boolean } = {}) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			child.stdin.destroy();
			child.stdout.destroy();
			done(answer);
		};
		const timer = setTimeout(() => {
			try {
				// The shell and every descendant share this isolated POSIX process group.
				if (process.platform !== "win32" && child.pid)
					process.kill(-child.pid, "SIGKILL");
				else child.kill("SIGKILL");
			} catch {
				try { child.kill("SIGKILL"); } catch {}
			}
			// A descendant holding stdout must not delay or contribute a partial answer.
			finish();
		}, TIMEOUT_MS);
		let output = "";
		child.stdout.on("data", (chunk) => {
			output += String(chunk);
		});
		child.on("error", () => finish());
		child.on("close", () => {
			if (settled) return;
			try {
				finish(output.trim() ? JSON.parse(output) : {});
			} catch {
				finish();
			}
		});
		child.stdin.on("error", () => {});
		child.stdin.end(JSON.stringify(payload));
	});
}

export default function (pi: any) {
	pi.on("tool_result", async (event: any, ctx: any) => {
		if (event.isError) return undefined;
		const answer = await askJact(
			{
				tool_name: event.toolName,
				tool_input: event.input,
				cwd: ctx.cwd,
				session_id: ctx.sessionManager?.getSessionId?.(),
			},
			ctx.cwd,
		);
		if (!answer.context) return undefined;
		return {
			content: [...event.content, { type: "text", text: answer.context }],
			...(answer.failed ? { isError: true } : {}),
		};
	});
}
`;
}

function isOwnExtension(source: string, harness: Harness): boolean {
	return source.startsWith(`// Generated by \`jact setup ${harness}\`.`);
}

function hasExtensionWiring(source: string, harness: Harness): boolean {
	const encoded = source.match(/^const COMMAND_LINE = (".*");$/m)?.[1];
	if (encoded === undefined) return false;
	try {
		const line: unknown = JSON.parse(encoded);
		const suffix = ` hook ${harness}`;
		return typeof line === "string" && line.endsWith(suffix) &&
			source === extensionSource(harness, line.slice(0, -suffix.length));
	} catch {
		return false;
	}
}

/**
 * What setup would write: the file path and its full content.
 * Contract: throws when the existing config file is not a valid JSON object. Writes nothing.
 */
export function plannedConfig(
	harness: Harness,
	options: SetupOptions,
): { path: string; content: string; notes: string[] } {
	const configTarget = target(harness, options);
	if (configTarget.kind === "file") {
		if (existsSync(configTarget.file) &&
			!isOwnExtension(readFileSync(configTarget.file, "utf8"), harness))
			throw new Error(`Refusing to replace an unmanaged extension: ${configTarget.file}. jact changed nothing.`);
		return {
			path: configTarget.file,
			content: extensionSource(harness, options.command),
			notes: configTarget.notes,
		};
	}
	const config = readJsonConfig(configTarget.file);
	if (configTarget.kind === "named") {
		if (HOOK_NAME in config && !isOwnAntigravityHooks(config[HOOK_NAME]))
			throw new Error(`Refusing to replace an unmanaged named hook: ${configTarget.file}. jact changed nothing.`);
		const { [HOOK_NAME]: _replaced, ...others } = config;
		return {
			path: configTarget.file,
			content: serialize({
				...others,
				[HOOK_NAME]: antigravityHooks(options.command),
			}),
			notes: configTarget.notes,
		};
	}
	const kept = withoutOwnHooks(eventGroups(config, configTarget.event), harness);
	const hook: JsonRecord = {
		type: "command",
		command: `${hookCommand(harness, options.command)}${options.command === "jact" ? "" : " # jact"}`,
	};
	if (configTarget.named) hook["name"] = "jact";
	const group = { matcher: configTarget.matcher, hooks: [hook] };
	return {
		path: configTarget.file,
		content: serialize(
			withGroups(config, configTarget.event, [...kept, group]),
		),
		notes: configTarget.notes,
	};
}

/**
 * Writes one config file, and its folder when missing.
 * Contract: a failed write throws a message that names the next step. An agent
 * sandbox often protects the harness's own config folder, as Codex does.
 */
function writeConfigFile(path: string, content: string): void {
	try {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content);
	} catch (cause) {
		const reason = cause instanceof Error ? cause.message : String(cause);
		throw new Error(
			`Cannot write ${path} (${reason}). If an agent sandbox blocked the write, run this command in your own terminal.`,
			{ cause },
		);
	}
}

/** True when the expected events and matchers hold jact's wiring, regardless of JSON formatting. */
export function isInstalled(harness: Harness, options: SetupOptions): boolean {
	const configTarget = target(harness, options);
	if (!existsSync(configTarget.file)) return false;
	if (configTarget.kind === "file")
		return hasExtensionWiring(readFileSync(configTarget.file, "utf8"), harness);
	const config = readJsonConfig(configTarget.file);
	if (configTarget.kind === "json")
		return hasWiring(
			eventGroups(config, configTarget.event),
			configTarget.matcher,
			harness,
		);
	const named = config[HOOK_NAME];
	if (!isRecord(named) || named["enabled"] === false) return false;
	return (
		Array.isArray(named["PostToolUse"]) &&
		hasWiring(
			named["PostToolUse"],
			ANTIGRAVITY_FILE_TOOLS,
			harness,
			"PostToolUse",
		) &&
		["PreInvocation", "Stop"].every((event) => {
			const handlers = named[event];
			return (
				Array.isArray(handlers) &&
				handlers.some(
					(hook) =>
						isRecord(hook) &&
						hook["type"] === "command" &&
						isOwnHook(hook, harness, event),
				)
			);
		})
	);
}

/**
 * Writes the wiring.
 * Contract: idempotent. A second run with the same options changes nothing.
 * Contract: hook entries from other tools in the same file are kept.
 * Contract: throws when the existing config file is not a valid JSON object, and leaves it unchanged.
 */
export function installHarness(
	harness: Harness,
	options: SetupOptions,
): SetupOutcome {
	const plan = plannedConfig(harness, options);
	const existed = existsSync(plan.path);
	if (existed && readFileSync(plan.path, "utf8") === plan.content)
		return { path: plan.path, action: "unchanged", notes: plan.notes };
	writeConfigFile(plan.path, plan.content);
	return {
		path: plan.path,
		action: existed ? "updated" : "installed",
		notes: plan.notes,
	};
}

/**
 * Removes the wiring.
 * Contract: removes only what setup wrote. Other tools' hooks stay.
 * Contract: throws when the existing config file is not a valid JSON object, and leaves it unchanged.
 */
export function removeHarness(
	harness: Harness,
	options: SetupOptions,
): SetupOutcome {
	const configTarget = target(harness, options);
	if (!existsSync(configTarget.file))
		return { path: configTarget.file, action: "absent", notes: [] };
	if (configTarget.kind === "file") {
		if (!isOwnExtension(readFileSync(configTarget.file, "utf8"), harness))
			return { path: configTarget.file, action: "absent", notes: [] };
		rmSync(configTarget.file);
		return { path: configTarget.file, action: "removed", notes: [] };
	}
	const config = readJsonConfig(configTarget.file);
	if (configTarget.kind === "named") {
		if (!isOwnAntigravityHooks(config[HOOK_NAME]))
			return { path: configTarget.file, action: "absent", notes: [] };
		const { [HOOK_NAME]: _removed, ...others } = config;
		writeConfigFile(configTarget.file, serialize(others));
		return { path: configTarget.file, action: "removed", notes: [] };
	}
	const groups = eventGroups(config, configTarget.event);
	const kept = withoutOwnHooks(groups, harness);
	if (
		kept.length === groups.length &&
		kept.every((group, index) => group === groups[index])
	)
		return { path: configTarget.file, action: "absent", notes: [] };
	writeConfigFile(
		configTarget.file,
		serialize(withGroups(config, configTarget.event, kept)),
	);
	return { path: configTarget.file, action: "removed", notes: [] };
}
