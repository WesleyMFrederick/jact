import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const cliPath = path.join(repoRoot, "dist/cli.js");
const hostileParent = "$(touch pwned-marker) `touch pwned-marker` \u001b[31m";
const shells = ["bash", "zsh"].filter(
	(shell) => spawnSync(shell, ["-c", "exit 0"]).status === 0,
);

let workDir: string;
beforeEach(() => {
	workDir = mkdtempSync(path.join(tmpdir(), "jact-retry-"));
	writeFileSync(path.join(workDir, "package.json"), "{}\n");
	writeFileSync(
		path.join(workDir, "hostile.md"),
		`# ${hostileParent}\n\n## Install\n\nA\n\n# Other\n\n## Install\n\nB\n`,
	);
});
afterEach(() => {
	rmSync(workDir, { recursive: true, force: true });
});

/** Run jact in the temp dir and return the retry command it printed. */
function retryLine(args: string[]): string {
	const result = spawnSync(process.execPath, [cliPath, ...args], {
		cwd: workDir,
		encoding: "utf8",
	});
	expect(result.status).toBe(1);
	const output = `${result.stdout}${result.stderr}`;
	expect(output).not.toMatch(/\u001b/);
	const lines = output.split("\n");
	const retry = lines[lines.indexOf("Retry with a unique parent:") + 1];
	expect(retry).toMatch(/^jact /);
	return retry ?? "";
}

/** Paste the retry line into `shell`, with `jact` replaced by an argv echo. */
function pasteInto(shell: string, line: string): string[] {
	const result = spawnSync(
		shell,
		["-c", `jact() { printf '%s\\0' "$@"; }\n${line}`],
		{ cwd: workDir, encoding: "utf8" },
	);
	expect(result.stderr).toBe("");
	expect(result.status).toBe(0);
	return result.stdout.split("\0").slice(0, -1);
}

describe.each(shells)("ambiguous heading retry pasted into %s", (shell) => {
	it("extract header keeps a hostile parent heading inert", () => {
		const argv = pasteInto(
			shell,
			retryLine(["extract", "header", "hostile.md", "Install"]),
		);

		expect(argv).toEqual([
			"extract",
			"header",
			"hostile.md",
			"Install",
			"--within",
			hostileParent,
		]);
		expect(existsSync(path.join(workDir, "pwned-marker"))).toBe(false);
	});

	it("outline keeps a hostile parent heading inert", () => {
		const argv = pasteInto(
			shell,
			retryLine(["outline", "hostile.md", "H2", "--expand", "Install"]),
		);

		expect(argv).toEqual([
			"outline",
			"hostile.md",
			"H2",
			"--expand",
			"Install",
			"--within",
			hostileParent,
		]);
		expect(existsSync(path.join(workDir, "pwned-marker"))).toBe(false);
	});
});

describe("human output with control characters in document text", () => {
	it.each([
		["validate", ["validate", "links.md"]],
		["outline", ["outline", "links.md"]],
	])("%s prints escapes, not raw control bytes", (_name, args) => {
		writeFileSync(
			path.join(workDir, "links.md"),
			"# Title \u001b]0;owned\u0007\u009b2J\n\n[bad](<missing\u001b[31m.md>)\n",
		);
		const result = spawnSync(process.execPath, [cliPath, ...args], {
			cwd: workDir,
			encoding: "utf8",
		});
		const output = `${result.stdout}${result.stderr}`;

		expect(output).not.toMatch(/[\u0007\u001b\u009b]/);
		expect(output).toMatch(/\\u001b/);
	});
});
