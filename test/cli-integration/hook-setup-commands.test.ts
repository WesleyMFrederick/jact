import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const cliPath = join(here, "..", "..", "dist", "cli.js");

let project: string;

function run(args: readonly string[], input = "") {
	const result = spawnSync(process.execPath, [cliPath, ...args], {
		cwd: project,
		encoding: "utf8",
		input,
	});
	return {
		stdout: result.stdout,
		stderr: result.stderr,
		exitCode: result.status,
	};
}

beforeEach(() => {
	project = realpathSync(mkdtempSync(join(tmpdir(), "jact-hook-cli-")));
	mkdirSync(join(project, "docs"));
	writeFileSync(join(project, "package.json"), '{ "private": true }\n');
	writeFileSync(
		join(project, "docs", "target.md"),
		"# Target\n\n## Details\n\nThe launch code is 4242.\n",
	);
	writeFileSync(
		join(project, "docs", "index.md"),
		"# Index\n\nSee [Details](target.md#Details).\n",
	);
	writeFileSync(
		join(project, "docs", "broken.md"),
		"See [the missing page](missing.md).\n",
	);
});

afterEach(() => {
	rmSync(project, { recursive: true, force: true });
});

describe("hook argument errors never interrupt a harness", () => {
	it.each([["hook"], ["hook", "bogus"], ["hook", "claude", "--bogus"], ["hook", "antigravity", "--event"]])(
		"quietly accepts malformed invocation %j",
		(...args) => {
			const result = run(args);
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toBe("");
			expect(result.stderr).toBe("");
		},
	);
});

describe("jact setup", () => {
	it("installs, reports unchanged on a second run, and --check agrees", () => {
		expect(run(["setup", "claude", "--check"]).exitCode).toBe(1);

		const first = run(["setup", "claude"]);
		expect(first.exitCode).toBe(0);
		expect(first.stdout).toContain("claude: installed");
		const settings = join(project, ".claude", "settings.json");
		expect(
			JSON.parse(readFileSync(settings, "utf8")).hooks.PostToolUse[0].hooks[0]
				.command,
		).toBe("jact hook claude");

		expect(run(["setup", "claude"]).stdout).toContain("claude: unchanged");
		expect(run(["setup", "claude", "--check"]).exitCode).toBe(0);

		expect(run(["setup", "claude", "--remove"]).stdout).toContain(
			"claude: removed",
		);
		expect(run(["setup", "claude", "--check"]).exitCode).toBe(1);
	});

	it("--print shows the file and writes nothing", () => {
		const result = run(["setup", "gemini", "--print"]);
		expect(result.exitCode).toBe(0);
		expect(JSON.parse(result.stdout).hooks.AfterTool[0].hooks[0].command).toBe(
			"jact hook gemini",
		);
		expect(existsSync(join(project, ".gemini"))).toBe(false);
	});
	it.each(["--print", "--check"])("rejects --remove with %s without changing the config", (flag) => {
		run(["setup", "claude"]);
		const path = join(project, ".claude", "settings.json");
		const before = readFileSync(path, "utf8");
		const result = run(["setup", "claude", "--remove", flag]);
		expect(result.exitCode).toBe(2);
		expect(result.stderr).toContain("cannot be combined");
		expect(readFileSync(path, "utf8")).toBe(before);
	});


	it("antigravity: writes .agents/hooks.json and --check agrees", () => {
		expect(run(["setup", "antigravity", "--check"]).exitCode).toBe(1);
		const first = run(["setup", "antigravity"]);
		expect(first.exitCode).toBe(0);
		expect(first.stdout).toContain("antigravity: installed");
		const hooks = JSON.parse(
			readFileSync(join(project, ".agents", "hooks.json"), "utf8"),
		);
		expect(hooks.jact.PostToolUse[0].hooks[0].command).toBe(
			"jact hook antigravity --event PostToolUse",
		);
		expect(run(["setup", "antigravity", "--check"]).exitCode).toBe(0);
	});

	it("--command sets what the harness runs", () => {
		run(["setup", "pi", "--command", "node /opt/jact/dist/cli.js"]);
		expect(
			readFileSync(join(project, ".pi", "extensions", "jact.ts"), "utf8"),
		).toContain('"node /opt/jact/dist/cli.js hook pi"');
	});

	it("exits 2 and changes nothing when the harness config is not valid JSON", () => {
		mkdirSync(join(project, ".codex"));
		const file = join(project, ".codex", "hooks.json");
		writeFileSync(file, "{ not json");
		const result = run(["setup", "codex"]);
		expect(result.exitCode).toBe(2);
		expect(result.stderr).toContain("not valid JSON");
		expect(readFileSync(file, "utf8")).toBe("{ not json");
	});

	it("exits 2 for a harness it does not know", () => {
		const result = run(["setup", "emacs"]);
		expect(result.exitCode).toBe(2);
		expect(result.stderr).toContain("Allowed choices are");
	});
});

describe("harness development scripts", () => {
	const scriptPath = (name: string) => join(here, "..", "..", "scripts", name);

	it("reports reading and hook measurements as unavailable when no file qualifies", () => {
		const empty = join(project, "empty");
		mkdirSync(empty);
		for (const folder of [join(project, "docs"), empty]) {
			const result = spawnSync(process.execPath, [scriptPath("measure-agent-value.mjs"), folder], { encoding: "utf8" });
			expect(result.status).toBe(0);
			const output = JSON.parse(result.stdout);
			expect(output.reading.filesMeasured).toBe(0);
			expect(output.reading.message).toContain("No files qualify");
			expect(output.reading).not.toHaveProperty("medianSavingPercent");
			if (folder === empty) {
				expect(output.hook.calls).toBe(0);
				expect(output.hook.message).toContain("No Markdown files");
				expect(output.hook).not.toHaveProperty("medianMs");
			}
		}
	});

	it.each([
		["claude", "matcher"], ["codex", "matcher"], ["gemini", "matcher"],
		["claude", "command"], ["codex", "command"], ["gemini", "command"],
		["pi", "extension"], ["omp", "extension"],
	])("synthetic %s fails when the installed %s is broken", (harness, damage) => {
		const scripts = join(project, "scripts");
		symlinkSync(join(here, "..", "..", "node_modules"), join(project, "node_modules"), "dir");
		mkdirSync(scripts);
		mkdirSync(join(project, "dist"));
		writeFileSync(join(scripts, "hooks-e2e.mjs"), readFileSync(scriptPath("hooks-e2e.mjs")));
		// Damage the installation after --check, before the synthetic player loads it.
		writeFileSync(join(project, "dist", "cli.js"), `
const { spawnSync } = require("node:child_process");
const { readFileSync, writeFileSync, rmSync } = require("node:fs");
const args = process.argv.slice(2);
const result = spawnSync(process.execPath, [${JSON.stringify(cliPath)}, ...args], { stdio: "inherit" });
if (args.includes("--check")) {
	const harness = ${JSON.stringify(harness)};
	if (${JSON.stringify(damage)} === "extension") rmSync("." + harness, { recursive: true });
	else {
		const path = harness === "codex" ? ".codex/hooks.json" : "." + harness + "/settings.json";
		const config = JSON.parse(readFileSync(path, "utf8"));
		const group = config.hooks[harness === "gemini" ? "AfterTool" : "PostToolUse"][0];
		if (${JSON.stringify(damage)} === "matcher") group.matcher = "NoSuchTool";
		else group.hooks[0].command = "true";
		writeFileSync(path, JSON.stringify(config));
	}
}
process.exit(result.status ?? 2);
`);
		const result = spawnSync(process.execPath, [join(scripts, "hooks-e2e.mjs"), harness, "--synthetic"], { encoding: "utf8" });
		expect(result.status, result.stdout + result.stderr).toBe(1);
		expect(result.stdout).toContain("FAIL");
	});
});

describe("jact hook, through the real CLI", () => {
	const event = (toolName: string, toolInput: object) =>
		JSON.stringify({
			tool_name: toolName,
			tool_input: toolInput,
			cwd: project,
			session_id: "cli-test",
		});

	it("a write with a broken link tells the model which link to fix", () => {
		const result = run(
			["hook", "claude"],
			event("Write", { file_path: join(project, "docs", "broken.md") }),
		);
		expect(result.exitCode).toBe(0);
		const output = JSON.parse(result.stdout);
		expect(output.decision).toBe("block");
		expect(output.reason).toContain("File not found: missing.md");
	});

	it("a write with valid links prints nothing", () => {
		const result = run(
			["hook", "claude"],
			event("Write", { file_path: join(project, "docs", "index.md") }),
		);
		expect(result).toMatchObject({ exitCode: 0, stdout: "" });
	});

	it("a read returns the linked section once for each session", () => {
		const read = event("read_file", { file_path: "docs/index.md" });
		const first = JSON.parse(run(["hook", "gemini"], read).stdout);
		expect(first.hookSpecificOutput.additionalContext).toContain(
			"The launch code is 4242.",
		);
		expect(run(["hook", "gemini"], read).stdout).toBe("");
	});

	it("a Codex patch is checked through the paths in its header lines", () => {
		const patch =
			"*** Begin Patch\n*** Add File: docs/broken.md\n+See [the missing page](missing.md).\n*** End Patch";
		const result = run(
			["hook", "codex"],
			event("apply_patch", { command: patch }),
		);
		expect(JSON.parse(result.stdout).reason).toContain("missing.md");
	});

	it("never fails the harness: bad input exits 0 with no output", () => {
		for (const input of ["", "not json", '{"tool_name":"Bash"}'])
			expect(run(["hook", "claude"], input)).toMatchObject({
				exitCode: 0,
				stdout: "",
			});
	});

	it("Antigravity CLI: the write hook answers {}, and the next model call gets the report", () => {
		const antigravityEvent = (fields: object) =>
			JSON.stringify({
				conversationId: "cli-agy",
				workspacePaths: [project],
				cwd: project,
				...fields,
			});
		// The tool name and the Path field are what agy 1.5.12 sent in a live session.
		const write = antigravityEvent({
			hookEventName: "PostToolUse",
			toolCall: {
				name: "write_file",
				args: { Path: join(project, "docs", "broken.md") },
			},
			stepIdx: 2,
			error: "",
		});
		const hook = (event: string, input: string) =>
			run(["hook", "antigravity", "--event", event], input);

		expect(hook("PostToolUse", write)).toMatchObject({
			exitCode: 0,
			stdout: "{}\n",
		});
		const next = hook("PreInvocation", antigravityEvent({ invocationNum: 1 }));
		expect(next.exitCode).toBe(0);
		expect(
			JSON.parse(next.stdout).injectSteps[0].systemMessage.systemMessage,
		).toContain("File not found: missing.md");
		expect(
			hook("PreInvocation", antigravityEvent({ invocationNum: 2 })).stdout,
		).toBe("{}\n");
		expect(JSON.parse(hook("Stop", antigravityEvent({})).stdout)).toEqual({
			decision: "stop",
		});
		expect(hook("Stop", "not json")).toMatchObject({
			exitCode: 0,
			stdout: '{"decision":"stop"}\n',
		});
	});

	it("JACT_HOOK_LOG records each call", () => {
		const log = join(project, "hook.log");
		spawnSync(process.execPath, [cliPath, "hook", "pi"], {
			cwd: project,
			encoding: "utf8",
			input: event("write", { path: "docs/broken.md" }),
			env: { ...process.env, JACT_HOOK_LOG: log },
		});
		expect(JSON.parse(readFileSync(log, "utf8").trim())).toMatchObject({
			harness: "pi",
			handled: true,
			kind: "write",
			failed: true,
		});
	});
});
