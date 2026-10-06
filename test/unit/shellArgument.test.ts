import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	shellArgument,
	shellCommand,
	terminalText,
} from "../../src/shellArgument.js";

const shells = ["bash", "zsh"].filter(
	(shell) => spawnSync(shell, ["-c", "exit 0"]).status === 0,
);

const hostileInputs = [
	"$(touch marker)",
	"`touch marker`",
	"$'touch marker'",
	"!",
	"!!",
	"line\nbreak; touch marker",
	"carriage\rreturn",
	"it's",
	'"double" quotes',
	"back\\slash",
	"\u001b[31mred\u001b[0m",
	"-x",
	"",
	"üñíçødé ✓ 日本",
	"c1\u009bcontrol",
	"=ls",
	"~",
	"*",
	"a;touch marker",
];

let cwd: string;
beforeEach(() => {
	cwd = mkdtempSync(path.join(os.tmpdir(), "jact-shell-"));
});
afterEach(() => {
	rmSync(cwd, { recursive: true, force: true });
});

/** Run a command line in `shell` and return the argv it printed. */
function argvFrom(shell: string, commandLine: string): string[] {
	const result = spawnSync(shell, ["-c", commandLine], {
		cwd,
		encoding: "utf8",
	});
	expect(result.stderr).toBe("");
	expect(result.status).toBe(0);
	return result.stdout.split("\0").slice(0, -1);
}

describe.each(shells)("shellArgument in %s", (shell) => {
	it.each(hostileInputs)("passes %j as one literal argument", (input) => {
		const argv = argvFrom(shell, `printf '%s\\0' ${shellArgument(input)}`);

		expect(argv).toEqual([input]);
		expect(readdirSync(cwd)).toEqual([]);
	});

	it("keeps a leading-dash positional after an end-of-options marker", () => {
		const command = shellCommand(
			"printf '%s\\0'",
			["-x", "$(touch marker)"],
			[["--within", "-y"]],
		);

		expect(argvFrom(shell, command)).toEqual([
			"--within",
			"-y",
			"--",
			"-x",
			"$(touch marker)",
		]);
		expect(existsSync(path.join(cwd, "marker"))).toBe(false);
	});
});

describe("printed text", () => {
	it.each(hostileInputs)("holds no raw control characters for %j", (input) => {
		expect(shellArgument(input)).not.toMatch(/\p{Cc}/u);
		expect(terminalText(input)).not.toMatch(/\p{Cc}/u);
	});
});
