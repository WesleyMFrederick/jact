import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const cliPath = join(repoRoot, "dist", "cli.js");
const fixtures = join(repoRoot, "test", "fixtures");
const batchFixtures = join(fixtures, "batch-validate-vault");

function run(
	args: readonly string[],
	input?: string,
): { stdout: string; stderr: string; exitCode: number } {
	const result = spawnSync(process.execPath, [cliPath, ...args], {
		cwd: repoRoot,
		encoding: "utf8",
		...(input !== undefined && { input }),
	});
	return {
		stdout: result.stdout,
		stderr: result.stderr,
		exitCode: result.status ?? 2,
	};
}

describe("public CLI behavior baseline", () => {
	it("characterizes extraction success and extraction failure", () => {
		const success = run([
			"extract",
			"links",
			join(fixtures, "extract-test-source.md"),
		]);
		const successOutput = JSON.parse(success.stdout);
		expect(success.exitCode).toBe(0);
		expect(success.stderr).toBe("");
		expect(Object.keys(successOutput.extractedContentBlocks)).toHaveLength(3);
		expect(successOutput.extractedContentBlocks).toHaveProperty(
			"_totalContentCharacterLength",
			429,
		);

		const failure = run([
			"extract",
			"links",
			join(fixtures, "us2.2a", "all-failed-links.md"),
		]);
		expect(failure.exitCode).toBe(1);
		expect(JSON.parse(failure.stdout)).toEqual({
			extractedContentBlocks: { _totalContentCharacterLength: 2 },
		});
		expect(failure.stderr).toContain("Validation errors found:");

		const systemFailure = run([
			"extract",
			"links",
			join(fixtures, "missing-extraction-source.md"),
		]);
		expect(systemFailure.exitCode).toBe(2);
		expect(systemFailure.stdout).toBe("");
		expect(systemFailure.stderr).toContain("ERROR: File not found:");
	});

	it("characterizes file validation in human and rich JSON modes", () => {
		const validPath = join(batchFixtures, "good-a.md");
		const invalidPath = join(batchFixtures, "broken.md");
		const humanSuccess = run(["validate", validPath]);
		expect(humanSuccess.exitCode).toBe(0);
		expect(humanSuccess.stderr).toBe("");
		expect(humanSuccess.stdout).toContain(
			"indexed it because you targeted a file inside it",
		);
		expect(humanSuccess.stdout).toMatch(/OK: 1 citations valid\n$/);

		const humanFailure = run(["validate", invalidPath]);
		expect(humanFailure.exitCode).toBe(1);
		expect(humanFailure.stderr).toBe("");
		expect(humanFailure.stdout).toContain("ERRORS (1)");
		expect(humanFailure.stdout).toContain("FAILED: 1 error");

		const jsonFailure = run(["validate", invalidPath, "--format", "json"]);
		const parsed = JSON.parse(jsonFailure.stdout);
		expect(jsonFailure.exitCode).toBe(1);
		expect(jsonFailure.stderr).toBe("");
		expect(parsed).toMatchObject({
			summary: { total: 1, valid: 0, warnings: 0, errors: 1 },
		});
		expect(parsed.validationTime).toMatch(/^\d+\.\d+s$/);

		const missingPath = join(fixtures, "missing-validation-source.md");
		const humanSystemFailure = run(["validate", missingPath]);
		expect(humanSystemFailure.exitCode).toBe(2);
		expect(humanSystemFailure.stdout).toContain("ERROR: File not found:");

		const jsonSystemFailure = run([
			"validate",
			missingPath,
			"--format",
			"json",
		]);
		expect(jsonSystemFailure.exitCode).toBe(2);
		expect(JSON.parse(jsonSystemFailure.stdout)).toMatchObject({
			file: missingPath,
			success: false,
		});
	});

	it("characterizes stdin validation success, failure, and usage errors", () => {
		const intendedPath = join(batchFixtures, "stdin-draft.md");
		const success = run(
			["validate", intendedPath, "--stdin", "--format", "json"],
			"# Draft\n\n[Self](#Draft)\n",
		);
		expect(success.exitCode).toBe(0);
		expect(JSON.parse(success.stdout).summary.errors).toBe(0);

		const failure = run(
			["validate", intendedPath, "--stdin"],
			"# Draft\n\n[Missing](missing.md)\n",
		);
		expect(failure.exitCode).toBe(1);
		expect(failure.stdout).toContain("FAILED: 1 error");

		const usageError = run(["validate", "--stdin"], "# Draft\n");
		expect(usageError.exitCode).toBe(2);
		expect(usageError.stderr).toContain(
			"--stdin requires exactly one <path>",
		);
	});

	it("characterizes sequential batch human, compact JSON, and usage errors", () => {
		const good = join(batchFixtures, "good-a.md");
		const broken = join(batchFixtures, "broken.md");
		const human = run(["validate", good, broken]);
		expect(human.exitCode).toBe(1);
		expect(human.stdout).toContain(`✅ ${good}`);
		expect(human.stdout).toContain(`❌ ${broken}`);
		expect(human.stdout).toContain("2 files · 1 passed · 1 failed");

		const json = run(["validate", good, broken, "--json"]);
		expect(json.exitCode).toBe(1);
		expect(json.stdout.trim().split("\n").map((line) => JSON.parse(line))).toEqual([
			{
				path: broken,
				ok: false,
				errors: [{ line: 4, message: "File not found: does-not-exist.md" }],
			},
			{ path: good, ok: true, errors: [] },
		]);

		const usageError = run([
			"validate",
			good,
			"--json",
			"--format",
			"json",
		]);
		expect(usageError.exitCode).toBe(2);
		expect(usageError.stderr).toContain(
			"--json and --format json cannot both be set",
		);
	});
});
