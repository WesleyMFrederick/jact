import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HARNESSES } from "../../src/hooks/harnessHook.js";
import {
	extensionSource,
	installHarness,
	isInstalled,
	plannedConfig,
	removeHarness,
	type SetupOptions,
} from "../../src/hooks/setupHarness.js";

let root: string;
let options: SetupOptions;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "jact-setup-unit-"));
	mkdirSync(join(root, "project"));
	mkdirSync(join(root, "home"));
	options = {
		global: false,
		command: "jact",
		cwd: join(root, "project"),
		home: join(root, "home"),
	};
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8"));

describe("setup writes each harness's wiring where that harness reads it", () => {
	it.each([
		[
			"claude",
			".claude/settings.json",
			"PostToolUse",
			"Write|Edit|MultiEdit|Read",
		],
		["codex", ".codex/hooks.json", "PostToolUse", "apply_patch"],
		[
			"gemini",
			".gemini/settings.json",
			"AfterTool",
			"write_file|replace|read_file",
		],
	] as const)(
		"%s: one command hook in %s under %s",
		(harness, file, event, matcher) => {
			const outcome = installHarness(harness, options);
			expect(outcome.action).toBe("installed");
			expect(outcome.path).toBe(join(options.cwd, file));
			const groups = readJson(outcome.path).hooks[event];
			expect(groups).toHaveLength(1);
			expect(groups[0].matcher).toBe(matcher);
			expect(groups[0].hooks[0]).toMatchObject({
				type: "command",
				command: `jact hook ${harness}`,
			});
		},
	);

	it.each([
		["pi", false, ".pi/extensions/jact.ts"],
		["pi", true, ".pi/agent/extensions/jact.ts"],
		["omp", false, ".omp/extensions/jact.ts"],
		["omp", true, ".omp/agent/extensions/jact.ts"],
	] as const)(
		"%s (global: %s): one extension file at %s",
		(harness, global, file) => {
			const outcome = installHarness(harness, { ...options, global });
			expect(outcome.path).toBe(
				join(global ? options.home : options.cwd, file),
			);
			expect(readFileSync(outcome.path, "utf8")).toContain(
				`"jact hook ${harness}"`,
			);
		},
	);

	it("--global writes under the home folder, not the project", () => {
		const outcome = installHarness("codex", { ...options, global: true });
		expect(outcome.path).toBe(join(options.home, ".codex", "hooks.json"));
		expect(existsSync(join(options.cwd, ".codex"))).toBe(false);
	});

	it("tells the user about the Codex trust step and its missing read hook", () => {
		const notes = installHarness("codex", options).notes.join(" ");
		expect(notes).toContain("/hooks");
		expect(notes).toContain("writes only");
	});
});

describe("setup is safe to run on a config other tools also use", () => {
	const otherTool = {
		model: "keep-me",
		hooks: {
			PreToolUse: [
				{ matcher: "", hooks: [{ type: "command", command: "other pre" }] },
			],
			PostToolUse: [
				{ matcher: "", hooks: [{ type: "command", command: "other post" }] },
			],
		},
	};

	function seed(
		harness: "claude" | "codex" | "gemini",
		content: string,
	): string {
		const file = plannedConfig(harness, options).path;
		mkdirSync(join(file, ".."), { recursive: true });
		writeFileSync(file, content);
		return file;
	}

	it("keeps other tools' hooks and settings, and adds its own entry last", () => {
		const file = seed("codex", JSON.stringify(otherTool));
		expect(installHarness("codex", options).action).toBe("updated");
		const config = readJson(file);
		expect(config.model).toBe("keep-me");
		expect(config.hooks.PreToolUse).toEqual(otherTool.hooks.PreToolUse);
		expect(config.hooks.PostToolUse).toHaveLength(2);
		expect(config.hooks.PostToolUse[0]).toEqual(otherTool.hooks.PostToolUse[0]);
		expect(config.hooks.PostToolUse[1].hooks[0].command).toBe(
			"jact hook codex",
		);
	});

	it("a second run changes nothing", () => {
		seed("codex", JSON.stringify(otherTool));
		installHarness("codex", options);
		const before = readFileSync(plannedConfig("codex", options).path, "utf8");
		expect(installHarness("codex", options).action).toBe("unchanged");
		expect(readFileSync(plannedConfig("codex", options).path, "utf8")).toBe(
			before,
		);
	});

	it("a run with a new command replaces its own entry instead of adding a second", () => {
		installHarness("claude", options);
		const moved = { ...options, command: "node /opt/jact/dist/cli.js" };
		expect(installHarness("claude", moved).action).toBe("updated");
		const groups = readJson(plannedConfig("claude", moved).path).hooks
			.PostToolUse;
		expect(groups).toHaveLength(1);
		expect(groups[0].hooks[0].command).toBe(
			"node /opt/jact/dist/cli.js hook claude",
		);
	});

	it("refuses to touch a config that is not valid JSON", () => {
		const file = seed("gemini", "{ not json");
		expect(() => installHarness("gemini", options)).toThrow(/not valid JSON/);
		expect(() => removeHarness("gemini", options)).toThrow(/not valid JSON/);
		expect(readFileSync(file, "utf8")).toBe("{ not json");
	});

	it("says what to do when the config folder cannot be written, as in an agent sandbox", () => {
		// A file where the folder must go fails the write for every user, root included.
		writeFileSync(join(options.cwd, ".codex"), "");
		expect(() => installHarness("codex", options)).toThrow(
			/Cannot write .*hooks\.json.*your own terminal/s,
		);
	});

	it("--remove takes out only its own entry", () => {
		const file = seed("codex", JSON.stringify(otherTool));
		installHarness("codex", options);
		expect(removeHarness("codex", options).action).toBe("removed");
		expect(readJson(file)).toEqual(otherTool);
		expect(removeHarness("codex", options).action).toBe("absent");
	});

	it("--remove deletes the extension file for pi and omp", () => {
		const { path } = installHarness("pi", options);
		expect(removeHarness("pi", options).action).toBe("removed");
		expect(existsSync(path)).toBe(false);
		expect(removeHarness("pi", options).action).toBe("absent");
	});
});

describe("--check and --print", () => {
	it.each(HARNESSES)(
		"%s: not installed, then installed, then not installed",
		(harness) => {
			expect(isInstalled(harness, options)).toBe(false);
			installHarness(harness, options);
			expect(isInstalled(harness, options)).toBe(true);
			removeHarness(harness, options);
			expect(isInstalled(harness, options)).toBe(false);
		},
	);

	it("plannedConfig returns the file content without writing it", () => {
		const plan = plannedConfig("claude", options);
		expect(JSON.parse(plan.content).hooks.PostToolUse).toHaveLength(1);
		expect(existsSync(plan.path)).toBe(false);
	});
});

describe("the generated pi and omp extension", () => {
	it("is valid TypeScript", () => {
		const source = extensionSource("pi", "jact");
		const { diagnostics } = ts.transpileModule(source, {
			reportDiagnostics: true,
			compilerOptions: { module: ts.ModuleKind.ESNext },
		});
		expect(diagnostics ?? []).toEqual([]);
	});

	it("imports nothing from a harness package, so one file serves both harnesses", () => {
		const imports = extensionSource("omp", "jact").match(/from "[^"]+"/g);
		expect(imports).toEqual(['from "node:child_process"']);
	});

	it("carries a command with quotes or spaces intact", () => {
		const command = `'/path with space/node' "/x/cli.js"`;
		expect(extensionSource("pi", command)).toContain(
			`const COMMAND_LINE = ${JSON.stringify(`${command} hook pi`)};`,
		);
	});
});
