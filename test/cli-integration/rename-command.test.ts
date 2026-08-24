import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RenameMarkdownFileResult } from "../../src/core/rename-markdown-file.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../..");
const cliPath = path.join(repoRoot, "dist/cli.js");
const workDir = path.join(tmpdir(), "jact-rename-cli-test");
const source = path.join(workDir, "target", "card17-conops.md");
const destination = path.join(
	workDir,
	"target",
	"card17-concept-of-operations-ConOps.md",
);
const incoming = path.join(workDir, "card17-requirements.md");
const otherTarget = path.join(workDir, "other", "card17-conops.md");

const originalIncoming = `# Requirements

[Concept](target/card17-conops.md#Overview "title")

[[target/card17-conops#Overview|ConOps]]

[cite: target/card17-conops.md#Overview]

[Concept reference][concept-reference]

[concept-reference]: target/card17-conops.md#Overview

[Other target](other/card17-conops.md)

Literal path: target/card17-conops.md
\`[Code example](target/card17-conops.md)\`
`;

function run(args: string[]): {
	status: number | null;
	stdout: string;
	stderr: string;
} {
	return spawnSync(process.execPath, [cliPath, ...args], {
		cwd: workDir,
		encoding: "utf8",
	});
}

function renameArgs(...extra: string[]): string[] {
	return [
		"rename",
		source,
		path.basename(destination),
		"--scope",
		workDir,
		"--json",
		...extra,
	];
}

describe("jact rename CLI", () => {
	beforeEach(() => {
		rmSync(workDir, { recursive: true, force: true });
		mkdirSync(path.dirname(source), { recursive: true });
		mkdirSync(path.dirname(otherTarget), { recursive: true });
		writeFileSync(source, "# Concept\n\n## Overview\n\nOperations. ^block\n");
		writeFileSync(otherTarget, "# Other concept\n");
		writeFileSync(incoming, originalIncoming);
	});

	afterEach(() => {
		rmSync(workDir, { recursive: true, force: true });
	});

	it("previews without writing and applies parser-owned destination edits", () => {
		const preview = run(renameArgs());
		expect(preview.status).toBe(0);
		const previewResult = JSON.parse(
			preview.stdout,
		) as RenameMarkdownFileResult;
		expect(previewResult).toMatchObject({
			source,
			destination,
			applied: false,
			links: 4,
		});
		expect(previewResult.files).toEqual([
			{ path: realpathSync(incoming), links: 4 },
		]);
		expect(existsSync(destination)).toBe(false);
		expect(readFileSync(incoming, "utf8")).toBe(originalIncoming);

		const applied = run(renameArgs("--fix"));
		expect(applied.status).toBe(0);
		const result = JSON.parse(applied.stdout) as RenameMarkdownFileResult;
		expect(result).toMatchObject({ applied: true, links: 4 });
		expect(result.backups).toHaveLength(2);
		for (const backup of result.backups) expect(existsSync(backup)).toBe(true);
		expect(existsSync(source)).toBe(false);
		expect(existsSync(destination)).toBe(true);
		expect(readFileSync(destination, "utf8")).toBe(
			"# Concept\n\n## Overview\n\nOperations. ^block\n",
		);
		expect(readFileSync(incoming, "utf8")).toBe(
			originalIncoming
				.split("target/card17-conops.md")
				.join("target/card17-concept-of-operations-ConOps.md")
				.replace(
					"[[target/card17-conops#Overview|ConOps]]",
					"[[target/card17-concept-of-operations-ConOps#Overview|ConOps]]",
				)
				.replace(
					"Literal path: target/card17-concept-of-operations-ConOps.md",
					"Literal path: target/card17-conops.md",
				)
				.replace(
					"`[Code example](target/card17-concept-of-operations-ConOps.md)`",
					"`[Code example](target/card17-conops.md)`",
				),
		);
		expect(readFileSync(otherTarget, "utf8")).toBe("# Other concept\n");
	});

	it("fails closed when the destination already exists", () => {
		writeFileSync(destination, "# Collision\n");

		const result = run(renameArgs("--fix"));

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("Destination already exists");
		expect(existsSync(source)).toBe(true);
		expect(readFileSync(destination, "utf8")).toBe("# Collision\n");
		expect(readFileSync(incoming, "utf8")).toBe(originalIncoming);
	});

	it("rejects directory moves before writing", () => {
		const result = run([
			"rename",
			source,
			"../moved.md",
			"--scope",
			workDir,
			"--fix",
		]);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("filename, not a path");
		expect(existsSync(source)).toBe(true);
		expect(readFileSync(incoming, "utf8")).toBe(originalIncoming);
	});
});
