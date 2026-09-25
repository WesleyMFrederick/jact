import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(testDir, "../../dist/cli.js");
const workDir = path.join(tmpdir(), "jact-large-json-pipe-test");
const sourcePath = path.join(workDir, "source.md");

describe("jact validate --format json — piped stdout", () => {
	beforeEach(() => {
		rmSync(workDir, { recursive: true, force: true });
		mkdirSync(workDir, { recursive: true });
		writeFileSync(path.join(workDir, "target.md"), "# Heading\n\nText.\n");
	});

	afterEach(() => {
		rmSync(workDir, { recursive: true, force: true });
	});

	it("writes the complete JSON report past 64KB and keeps the exit code", () => {
		const links = Array.from(
			{ length: 400 },
			(_, index) => `- [Missing ${index}](target.md#Missing%20${index})`,
		);
		writeFileSync(sourcePath, `${links.join("\n")}\n`);

		// spawnSync reads stdout through a pipe, like `jact validate ... | jq`.
		const result = spawnSync(
			process.execPath,
			[cliPath, "validate", sourcePath, "--format", "json", "--scope", workDir],
			{ cwd: workDir, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
		);

		expect(result.stdout.length).toBeGreaterThan(65536);
		const report = JSON.parse(result.stdout) as {
			summary: { errors: number };
		};
		expect(report.summary.errors).toBe(400);
		expect(result.status).toBe(1);
	});
});
