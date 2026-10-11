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

describe("Commander usage errors", () => {
	it("validate --format rejects a value other than cli or json and validates nothing", () => {
		const result = run(["validate", "README.md", "--format", "foo"]);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("Allowed choices are cli, json");
		expect(result.stdout).toBe("");
	});
});
