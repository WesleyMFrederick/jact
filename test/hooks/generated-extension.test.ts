import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { extensionSource } from "../../src/hooks/setupHarness.js";

const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

async function until(predicate: () => boolean): Promise<void> {
	const deadline = Date.now() + 2000;
	// Real OS startup and reaping cannot be advanced with fake timers.
	while (!predicate()) {
		if (Date.now() >= deadline) throw new Error("Timed out waiting for extension fixture");
		const { promise, resolve } = Promise.withResolvers<void>();
		setTimeout(resolve, 10);
		await promise;
	}
}

function isRunning(pid: number): boolean {
	try {
		// A killed orphan can briefly remain a zombie until its new parent reaps it.
		const state = execFileSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
		return state.length > 0 && !state.startsWith("Z");
	} catch {
		return false;
	}
}

type ToolResultHandler = (event: {
	toolName: string;
	input: { path: string };
	content: { type: string; text: string }[];
}, context: { cwd: string }) => Promise<unknown>;

// The generated shell command is a POSIX integration boundary.
describe.skipIf(process.platform === "win32")("generated extension deadlines", () => {
	it.each(["pi", "omp"] as const)(
		"Given a %s command whose descendants hold stdout, When its deadline expires, Then the hook returns and the descendants terminate",
		async (harness) => {
			// Given: both the command and its descendant keep their inherited stdout open.
			const root = mkdtempSync(join(tmpdir(), "jact-extension-timeout-"));
			const commandFile = join(root, "command.cjs");
			const descendantFile = join(root, "descendant.cjs");
			const commandPids = join(root, "command-pids.json");
			const descendantPid = join(root, "descendant-pid.json");
			writeFileSync(descendantFile, `
require("node:fs").writeFileSync(${JSON.stringify(descendantPid)}, JSON.stringify(process.pid));
setInterval(() => {}, 1000);
`);
			writeFileSync(commandFile, `
require("node:fs").writeFileSync(${JSON.stringify(commandPids)}, JSON.stringify([process.ppid, process.pid]));
require("node:child_process").spawn(process.execPath, [${JSON.stringify(descendantFile)}], { stdio: ["ignore", "inherit", "ignore"] });
setInterval(() => {}, 1000);
`);
			let expire: (() => void) | undefined;
			let handler: ToolResultHandler | undefined;
			let invocation: Promise<unknown> | undefined;
			let deadlineTimer: NodeJS.Timeout | undefined;
			const pids: number[] = [];
			try {
				// The trailing command keeps the shell alive instead of letting it exec Node.
				const source = extensionSource(harness, `${quote(process.execPath)} ${quote(commandFile)}; :`);
				const compiled = ts.transpileModule(source, {
					compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
				}).outputText;
				const exported: { default?: (api: { on: (event: string, callback: ToolResultHandler) => void }) => void } = {};
				const schedule = (callback: () => void, delay: number) => {
					if (delay !== 30000) return setTimeout(callback, delay);
					expire = callback;
					deadlineTimer = setTimeout(() => {}, 10000);
					return deadlineTimer;
				};
				new Function("require", "exports", "setTimeout", "clearTimeout", compiled)(
					createRequire(import.meta.url), exported, schedule, clearTimeout,
				);
				exported.default!({ on: (_event, callback) => { handler = callback; } });
				invocation = handler!({ toolName: "write", input: { path: "note.md" }, content: [{ type: "text", text: "written" }] }, { cwd: root });
				await until(() => existsSync(commandPids) && existsSync(descendantPid));
				pids.push(...JSON.parse(readFileSync(commandPids, "utf8")), JSON.parse(readFileSync(descendantPid, "utf8")));
				expect(pids.every(isRunning)).toBe(true);
				expect(expire).toBeTypeOf("function");

				// When: trigger the real deadline callback without waiting thirty seconds.
				let returned = false;
				void invocation.then(() => { returned = true; });
				expire!();

				// Then: resolving alone is insufficient if the subprocesses are still alive.
				await until(() => returned && pids.every((pid) => !isRunning(pid)));
				expect(await invocation).toBeUndefined();
			} finally {
				// Also recover fixture PIDs if setup or an assertion failed before capture.
				if (pids.length === 0) {
					if (existsSync(commandPids)) pids.push(...JSON.parse(readFileSync(commandPids, "utf8")));
					if (existsSync(descendantPid)) pids.push(JSON.parse(readFileSync(descendantPid, "utf8")));
				}
				for (const pid of pids.reverse()) {
					try { process.kill(pid, "SIGKILL"); } catch { /* Already terminated. */ }
				}
				clearTimeout(deadlineTimer);
				rmSync(root, { recursive: true, force: true });
			}
		},
	);
});
