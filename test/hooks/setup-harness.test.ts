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

	it.each(["claude", "codex", "gemini"] as const)(
		"%s: install and removal preserve other hooks inside a shared group",
		(harness) => {
			const event = harness === "gemini" ? "AfterTool" : "PostToolUse";
			const other = { type: "command", command: "prettier --write", timeout: 20 };
			const group = {
				matcher: "Write|Edit",
				description: "shared group",
				hooks: [other, { type: "command", command: `jact hook ${harness}` }],
			};
			const file = seed(harness, JSON.stringify({ hooks: { [event]: [group] } }));
			installHarness(harness, options);
			expect(readJson(file).hooks[event][0]).toEqual({ ...group, hooks: [other] });
			expect(removeHarness(harness, options).action).toBe("removed");
			expect(readJson(file).hooks[event]).toEqual([{ ...group, hooks: [other] }]);
			expect(removeHarness(harness, options).action).toBe("absent");
			writeFileSync(file, JSON.stringify({ hooks: { [event]: [group] } }));
			removeHarness(harness, options);
			expect(readJson(file).hooks[event]).toEqual([{ ...group, hooks: [other] }]);
		},
	);

	it.each(["claude", "codex", "gemini"] as const)(
		"%s: never claims another program's hook subcommand",
		(harness) => {
			const event = harness === "gemini" ? "AfterTool" : "PostToolUse";
			const foreign = { matcher: ".*", hooks: [{ type: "command", command: `other-linter hook ${harness}` }] };
			const file = seed(harness, JSON.stringify({ hooks: { [event]: [foreign] } }));
			expect(isInstalled(harness, options)).toBe(false);
			expect(removeHarness(harness, options).action).toBe("absent");
			installHarness(harness, options);
			expect(readJson(file).hooks[event][0]).toEqual(foreign);
			removeHarness(harness, options);
			expect(readJson(file).hooks[event]).toEqual([foreign]);
		},
	);

	it.each([[], "bad", 42, null].map((value) => [value]))("refuses a malformed hooks value: %j", (hooks) => {
		const before = JSON.stringify({ model: "keep", hooks });
		const file = seed("claude", before);
		expect(() => installHarness("claude", options)).toThrow(/hooks/);
		expect(() => removeHarness("claude", options)).toThrow(/hooks/);
		expect(readFileSync(file, "utf8")).toBe(before);
	});

	it.each([{}, "bad", 42, null].map((value) => [value]))("refuses malformed event groups: %j", (groups) => {
		const before = JSON.stringify({ hooks: { PostToolUse: groups } });
		const file = seed("codex", before);
		expect(() => installHarness("codex", options)).toThrow(/PostToolUse/);
		expect(() => removeHarness("codex", options)).toThrow(/PostToolUse/);
		expect(readFileSync(file, "utf8")).toBe(before);
	});

	it.each(["pi", "omp"] as const)("%s: never removes or overwrites an unmanaged extension", (harness) => {
		const file = plannedConfig(harness, options).path;
		mkdirSync(join(file, ".."), { recursive: true });
		const foreign = "export default function customExtension() {}\n";
		writeFileSync(file, foreign);
		expect(isInstalled(harness, options)).toBe(false);
		expect(removeHarness(harness, options).action).toBe("absent");
		expect(() => installHarness(harness, options)).toThrow(/extension/);
		expect(readFileSync(file, "utf8")).toBe(foreign);
	});

	it.each(["pi", "omp"] as const)("%s: updates and removes an older generated extension", (harness) => {
		const { path } = installHarness(harness, options);
		const older = readFileSync(path, "utf8").replace(
			'child.stdin.end(JSON.stringify(payload));',
			'child.stdin.end(JSON.stringify(payload), "utf8");',
		);
		writeFileSync(path, older);
		expect(isInstalled(harness, options)).toBe(false);
		expect(installHarness(harness, options).action).toBe("updated");
		expect(isInstalled(harness, options)).toBe(true);
		writeFileSync(path, older);
		expect(removeHarness(harness, options).action).toBe("removed");
		expect(existsSync(path)).toBe(false);
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
			"node /opt/jact/dist/cli.js hook claude # jact",
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

describe("setup for Antigravity CLI, whose hooks file is keyed by hook name", () => {
	const file = () => join(options.cwd, ".agents", "hooks.json");

	it("writes one hook named jact in .agents/hooks.json, with the event in each command", () => {
		const outcome = installHarness("antigravity", options);
		expect(outcome.action).toBe("installed");
		expect(outcome.path).toBe(file());
		const { jact } = readJson(file());
		expect(Object.keys(jact)).toEqual(["PostToolUse", "PreInvocation", "Stop"]);
		expect(jact.PostToolUse).toHaveLength(1);
		expect(jact.PostToolUse[0].hooks[0]).toMatchObject({
			type: "command",
			command: "jact hook antigravity --event PostToolUse",
		});
		// Antigravity has no matcher for these two events: each entry is the handler.
		expect(jact.PreInvocation).toEqual([
			{
				type: "command",
				command: "jact hook antigravity --event PreInvocation",
				timeout: 10,
			},
		]);
		expect(jact.Stop[0].command).toBe("jact hook antigravity --event Stop");
	});

	it("matches the file tools agy 1.5.12 sends, the documented names, and no other tool", () => {
		installHarness("antigravity", options);
		const matcher = new RegExp(
			`^(?:${readJson(file()).jact.PostToolUse[0].matcher})$`,
		);
		for (const tool of [
			// Seen in a live agy 1.5.12 session.
			"write_file",
			"edit_file",
			"read_file",
			// Named in Google's hook documentation.
			"write_to_file",
			"replace_file_content",
			"multi_replace_file_content",
			"view_file",
		])
			expect(tool).toMatch(matcher);
		for (const tool of ["run_command", "list_dir", "grep_search"])
			expect(tool).not.toMatch(matcher);
	});

	it("--global writes ~/.gemini/config/hooks.json, the file Antigravity loads", () => {
		const outcome = installHarness("antigravity", { ...options, global: true });
		expect(outcome.path).toBe(
			join(options.home, ".gemini", "config", "hooks.json"),
		);
		expect(existsSync(join(options.cwd, ".agents"))).toBe(false);
	});

	it("keeps hooks with other names, replaces its own, and removes only its own", () => {
		const others = {
			"my-linter": {
				PostToolUse: [
					{ matcher: "*", hooks: [{ type: "command", command: "lint" }] },
				],
			},
			"session-log": {
				enabled: false,
				Stop: [{ type: "command", command: "log" }],
			},
		};
		mkdirSync(join(options.cwd, ".agents"));
		writeFileSync(file(), JSON.stringify(others));

		expect(installHarness("antigravity", options).action).toBe("updated");
		expect(readJson(file())).toMatchObject(others);
		expect(installHarness("antigravity", options).action).toBe("unchanged");

		const moved = { ...options, command: "node /opt/jact/dist/cli.js" };
		expect(installHarness("antigravity", moved).action).toBe("updated");
		expect(Object.keys(readJson(file()))).toEqual([
			"my-linter",
			"session-log",
			"jact",
		]);
		expect(readJson(file()).jact.Stop[0].command).toBe(
			"node /opt/jact/dist/cli.js hook antigravity --event Stop # jact",
		);

		expect(removeHarness("antigravity", moved).action).toBe("removed");
		expect(readJson(file())).toEqual(others);
		expect(removeHarness("antigravity", moved).action).toBe("absent");
	});

	it("Given a disabled owned hook, When checked, Then it is not installed", () => {
		// Given
		installHarness("antigravity", options);
		const config = readJson(file());
		config.jact.enabled = false;
		writeFileSync(file(), JSON.stringify(config));

		// When / Then
		expect(isInstalled("antigravity", options)).toBe(false);
	});

	it.each(["reinstall", "remove"] as const)(
		"Given a disabled owned hook, When asked to %s, Then it remains manageable without touching other hooks",
		(action) => {
			// Given
			installHarness("antigravity", options);
			const config = readJson(file());
			config.jact.enabled = false;
			config.other = { Stop: [{ type: "command", command: "other-tool" }] };
			writeFileSync(file(), JSON.stringify(config));

			// When
			const outcome = action === "reinstall"
				? installHarness("antigravity", options)
				: removeHarness("antigravity", options);

			// Then
			expect(outcome.action).toBe(action === "reinstall" ? "updated" : "removed");
			expect(readJson(file()).other).toEqual(config.other);
			expect(isInstalled("antigravity", options)).toBe(action === "reinstall");
			if (action === "remove") expect(readJson(file())).not.toHaveProperty("jact");
		},
	);

	it.each([
		{ PreToolUse: [{ type: "command", command: "my-own-script.sh" }] },
		{ Stop: [{ type: "command", command: "my-own-script.sh" }] },
		{ PostToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "other-linter hook antigravity --event PostToolUse" }] }] },
		{ PostToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "jact hook antigravity --event PostToolUse" }, { type: "command", command: "my-own-script.sh" }] }] },
	])("preserves a foreign or shared jact key: %j", (jact) => {
		mkdirSync(join(options.cwd, ".agents"));
		const before = JSON.stringify({ other: {}, jact });
		writeFileSync(file(), before);
		expect(() => plannedConfig("antigravity", options)).toThrow(/unmanaged/);
		expect(() => installHarness("antigravity", options)).toThrow(/unmanaged/);
		expect(removeHarness("antigravity", options).action).toBe("absent");
		expect(readFileSync(file(), "utf8")).toBe(before);
	});

	it("refuses to touch a hooks file that is not valid JSON", () => {
		mkdirSync(join(options.cwd, ".agents"));
		writeFileSync(file(), "{ not json");
		expect(() => installHarness("antigravity", options)).toThrow(
			/not valid JSON/,
		);
		expect(() => removeHarness("antigravity", options)).toThrow(
			/not valid JSON/,
		);
		expect(readFileSync(file(), "utf8")).toBe("{ not json");
	});

	it("tells the user how to confirm that Antigravity loaded the hook", () => {
		expect(installHarness("antigravity", options).notes.join(" ")).toContain(
			"/hooks",
		);
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

	it.each(["claude", "codex", "gemini", "antigravity"] as const)(
		"%s: recognizes reformatted wiring with a custom command and later unrelated hooks",
		(harness) => {
			const { path } = installHarness(harness, { ...options, command: "node /opt/jact/cli.js" });
			const config = readJson(path);
			if (harness !== "antigravity") {
				const event = harness === "gemini" ? "AfterTool" : "PostToolUse";
				config.hooks[event].push({ matcher: "Other", hooks: [{ command: "other" }] });
			}
			writeFileSync(path, JSON.stringify(config, null, "\t"));
			expect(isInstalled(harness, options)).toBe(true);
			if (harness === "antigravity") delete config.jact.PreInvocation;
			else config.hooks[harness === "gemini" ? "AfterTool" : "PostToolUse"][0].matcher = "NoSuchTool";
			writeFileSync(path, JSON.stringify(config));
			expect(isInstalled(harness, options)).toBe(false);
		},
	);


	it.each(HARNESSES)("%s: recognizes and removes its custom command without repeating it", (harness) => {
		installHarness(harness, { ...options, command: "'/opt/custom tool/bin/runner'" });
		expect(isInstalled(harness, options)).toBe(true);
		expect(removeHarness(harness, options).action).toBe("removed");
		expect(isInstalled(harness, options)).toBe(false);
	});
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
