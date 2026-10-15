import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const cliPath = join(repoRoot, "dist", "cli.js");

function run(args: readonly string[]): {
	stdout: string;
	stderr: string;
	exitCode: number | null;
} {
	const result = spawnSync(process.execPath, [cliPath, ...args], {
		cwd: repoRoot,
		encoding: "utf8",
	});
	return {
		stdout: result.stdout,
		stderr: result.stderr,
		exitCode: result.status,
	};
}

describe("Commander usage errors exit 2", () => {
	it("an unknown command synonym exits 2 and keeps the Did you mean hint", () => {
		const result = run(["check", "README.md"]);
		expect(result.exitCode).toBe(2);
		expect(result.stderr).toContain("Did you mean: validate?");
	});

	it("an unknown option exits 2", () => {
		const result = run(["validate", "README.md", "--bogus"]);
		expect(result.exitCode).toBe(2);
		expect(result.stderr).toContain("unknown option '--bogus'");
	});

	it("a value outside an argument's choices exits 2", () => {
		const result = run(["outline", "README.md", "H9"]);
		expect(result.exitCode).toBe(2);
		expect(result.stderr).toContain("Allowed choices are");
	});

	it("an --extract-linked-content depth below 1 exits 2", () => {
		const result = run([
			"extract",
			"file",
			"README.md",
			"--extract-linked-content",
			"0",
		]);
		expect(result.exitCode).toBe(2);
		expect(result.stderr).toContain("depth must be a whole number");
	});

	it("a missing required argument exits 2", () => {
		const result = run(["outline"]);
		expect(result.exitCode).toBe(2);
		expect(result.stderr).toContain("missing required argument 'file'");
	});

	it("validate --format rejects a value other than cli or json with exit 2 and validates nothing", () => {
		const result = run(["validate", "README.md", "--format", "foo"]);
		expect(result.exitCode).toBe(2);
		expect(result.stderr).toContain("Allowed choices are cli, json");
		expect(result.stdout).toBe("");
	});

	it("help and version still exit 0", () => {
		expect(run(["--help"]).exitCode).toBe(0);
		expect(run(["validate", "--help"]).exitCode).toBe(0);
		expect(run(["--version"]).exitCode).toBe(0);
	});

	it("rename with no arguments keeps its documented exit 1", () => {
		const result = run(["rename"]);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("needs at least one <source>");
	});
});
