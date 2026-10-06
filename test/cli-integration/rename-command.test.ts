import { spawnSync } from "node:child_process";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RenameMarkdownFilesResult } from "../../src/core/rename-markdown-file.js";

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
const movedDirectory = path.join(workDir, "moved", "notes");
const movedDestination = path.join(movedDirectory, path.basename(source));
const outgoingTarget = path.join(workDir, "reference", "shared.md");

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
		) as RenameMarkdownFilesResult;
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
		const result = JSON.parse(applied.stdout) as RenameMarkdownFilesResult;
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

	it("moves into a directory and updates incoming and outgoing links", () => {
		mkdirSync(movedDirectory, { recursive: true });
		mkdirSync(path.dirname(outgoingTarget), { recursive: true });
		writeFileSync(outgoingTarget, "# Shared\n");
		writeFileSync(
			source,
			"# Concept\n\n[Shared](../reference/shared.md)\n\n[[../reference/shared|Shared]]\n\n[cite: ../reference/shared.md#Shared]\n",
		);

		const preview = run([
			"rename",
			source,
			movedDirectory,
			"--scope",
			workDir,
			"--json",
		]);
		expect(preview.status).toBe(0);
		expect(JSON.parse(preview.stdout)).toMatchObject({
			source,
			destination: movedDestination,
			applied: false,
			links: 7,
		});
		expect(existsSync(movedDestination)).toBe(false);

		const applied = run([
			"rename",
			source,
			movedDirectory,
			"--scope",
			workDir,
			"--json",
			"--fix",
		]);
		expect(applied.status).toBe(0);
		expect(existsSync(source)).toBe(false);
		expect(readFileSync(movedDestination, "utf8")).toBe(
			"# Concept\n\n[Shared](../../reference/shared.md)\n\n[[../../reference/shared|Shared]]\n\n[cite: ../../reference/shared.md#Shared]\n",
		);
		expect(readFileSync(incoming, "utf8")).toContain(
			"moved/notes/card17-conops.md#Overview",
		);
		expect(readFileSync(incoming, "utf8")).toContain(
			"[[moved/notes/card17-conops#Overview|ConOps]]",
		);
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

	it("rejects moves outside scope before writing", () => {
		const result = run([
			"rename",
			source,
			"../moved.md",
			"--scope",
			workDir,
			"--fix",
		]);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("outside the rename scope");
		expect(existsSync(source)).toBe(true);
		expect(readFileSync(incoming, "utf8")).toBe(originalIncoming);
	});
});

const batchDir = path.join(tmpdir(), "jact-bulk-rename-cli-test");

function runBatch(args: string[]): {
	status: number | null;
	stdout: string;
	stderr: string;
} {
	return spawnSync(
		process.execPath,
		[cliPath, "rename", ...args, "--scope", batchDir, "--json"],
		{ cwd: batchDir, encoding: "utf8" },
	);
}

function writeTree(files: Record<string, string>): void {
	for (const [relative, content] of Object.entries(files)) {
		const filePath = path.join(batchDir, relative);
		mkdirSync(path.dirname(filePath), { recursive: true });
		writeFileSync(filePath, content);
	}
}

/** Every file and directory under batchDir (relative), with file contents; backups excluded. */
function snapshot(directory = batchDir): Record<string, string | null> {
	const entries: Record<string, string | null> = {};
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const entryPath = path.join(directory, entry.name);
		const relative = path.relative(batchDir, entryPath);
		if (entry.isDirectory()) {
			entries[`${relative}/`] = null;
			Object.assign(entries, snapshot(entryPath));
		} else if (!entry.name.endsWith(".bak")) {
			entries[relative] = readFileSync(entryPath, "utf8");
		}
	}
	return entries;
}

describe("jact rename CLI batch moves", () => {
	beforeEach(() => {
		rmSync(batchDir, { recursive: true, force: true });
		mkdirSync(batchDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(batchDir, { recursive: true, force: true });
	});

	it("Given two linked files When moved into a missing nested directory Then links between them and from outside resolve", () => {
		// Given
		writeTree({
			"a.md": "# A\n\n[B](b.md)\n\n[[b]]\n",
			"b.md": "# B\n\n[A](a.md#A)\n\n[Ref](ref/shared.md)\n",
			"ref/shared.md": "# Shared\n",
			"index.md": "# Index\n\n[A](a.md)\n\n[B](b.md#B)\n",
		});

		// When
		const preview = runBatch(["a.md", "b.md", "new/dir/"]);

		// Then
		expect(preview.status).toBe(0);
		const plan = JSON.parse(preview.stdout) as RenameMarkdownFilesResult;
		expect(plan.source).toBeUndefined();
		expect(plan.applied).toBe(false);
		expect(plan.moves).toEqual([
			{
				kind: "file",
				source: path.join(realpathSync(batchDir), "a.md"),
				destination: path.join(realpathSync(batchDir), "new/dir/a.md"),
			},
			{
				kind: "file",
				source: path.join(realpathSync(batchDir), "b.md"),
				destination: path.join(realpathSync(batchDir), "new/dir/b.md"),
			},
		]);
		expect(plan.directories).toEqual([
			path.join(realpathSync(batchDir), "new"),
			path.join(realpathSync(batchDir), "new/dir"),
		]);
		expect(existsSync(path.join(batchDir, "new"))).toBe(false);

		// When
		const applied = runBatch(["a.md", "b.md", "new/dir/", "--fix"]);

		// Then
		expect(applied.status).toBe(0);
		const result = snapshot();
		expect(result["a.md"]).toBeUndefined();
		expect(result["b.md"]).toBeUndefined();
		expect(result["new/dir/a.md"]).toBe("# A\n\n[B](b.md)\n\n[[b]]\n");
		expect(result["new/dir/b.md"]).toBe(
			"# B\n\n[A](a.md#A)\n\n[Ref](../../ref/shared.md)\n",
		);
		expect(result["index.md"]).toBe(
			"# Index\n\n[A](new/dir/a.md)\n\n[B](new/dir/b.md#B)\n",
		);
	});

	it("Given a folder with a subfolder and an image When moved into an existing directory Then the tree keeps its shape and outside links follow", () => {
		// Given
		writeTree({
			"notes/old-folder/one.md":
				"# One\n\n[Two](sub/two.md)\n\n![pic](img/p.png)\n\n[Outside](../../index.md)\n",
			"notes/old-folder/sub/two.md": "# Two\n\n[One](../one.md)\n",
			"notes/old-folder/img/p.png": "PNG",
			"index.md":
				"# Index\n\n[One](notes/old-folder/one.md)\n\n[Two](notes/old-folder/sub/two.md#Two)\n\n[Diagram](notes/old-folder/img/p.png)\n",
		});
		mkdirSync(path.join(batchDir, "archive"));

		// When
		const applied = runBatch(["notes/old-folder", "archive", "--fix"]);

		// Then
		expect(applied.status).toBe(0);
		const plan = JSON.parse(applied.stdout) as RenameMarkdownFilesResult;
		expect(plan.moves).toEqual([
			{
				kind: "directory",
				source: path.join(realpathSync(batchDir), "notes/old-folder"),
				destination: path.join(realpathSync(batchDir), "archive/old-folder"),
				movedFiles: 3,
			},
		]);
		expect(snapshot()).toEqual({
			"archive/": null,
			"archive/old-folder/": null,
			"archive/old-folder/img/": null,
			"archive/old-folder/img/p.png": "PNG",
			"archive/old-folder/one.md":
				"# One\n\n[Two](sub/two.md)\n\n![pic](img/p.png)\n\n[Outside](../../index.md)\n",
			"archive/old-folder/sub/": null,
			"archive/old-folder/sub/two.md": "# Two\n\n[One](../one.md)\n",
			"index.md":
				"# Index\n\n[One](archive/old-folder/one.md)\n\n[Two](archive/old-folder/sub/two.md#Two)\n\n[Diagram](archive/old-folder/img/p.png)\n",
			"notes/": null,
		});
	});

	it("Given a glob source When moved Then every match lands under the destination directory", () => {
		// Given
		writeTree({
			"concepts/x.md": "# X\n\n[Y](y.md)\n",
			"concepts/y.md": "# Y\n",
			"concepts/keep.txt": "text",
			"index.md": "# Index\n\n[X](concepts/x.md)\n",
		});

		// When
		const applied = runBatch(["concepts/*.md", "archive", "--fix"]);

		// Then
		expect(applied.status).toBe(0);
		expect(snapshot()).toEqual({
			"archive/": null,
			"archive/x.md": "# X\n\n[Y](y.md)\n",
			"archive/y.md": "# Y\n",
			"concepts/": null,
			"concepts/keep.txt": "text",
			"index.md": "# Index\n\n[X](archive/x.md)\n",
		});
	});

	it.each([
		{
			name: "destination collides with an existing file",
			args: ["a.md", "sub/b.md", "dest"],
			message: "Destination already exists",
		},
		{
			name: "source is neither Markdown nor a directory",
			args: ["a.md", "pic.png", "dest"],
			message: "not a Markdown file or a directory",
		},
		{
			name: "two sources map to the same destination",
			args: ["a.md", "sub/a.md", "new"],
			message: "map to the same destination",
		},
		{
			name: "a directory moves into itself",
			args: ["sub", "sub/inner"],
			message: "into itself",
		},
		{
			name: "a glob matches nothing",
			args: ["nothing/*.md", "dest"],
			message: "No Markdown files matched",
		},
		{
			name: "an image embed outside the move would break",
			args: ["sub", "elsewhere"],
			message: "image embeds",
		},
	])(
		"Given $name When fixing Then it refuses with exit 1 and changes nothing",
		({ args, message }) => {
			// Given
			writeTree({
				"a.md": "# A\n\n[B](sub/b.md)\n",
				"pic.png": "PNG",
				"sub/a.md": "# Sub A\n",
				"sub/b.md": "# B\n\n[A](../a.md)\n",
				"sub/p.png": "PNG",
				"sub/inner/c.md": "# C\n",
				"dest/a.md": "# Existing\n",
				"embeds.md": "# Embeds\n\n![p](sub/p.png)\n",
			});
			const before = snapshot();

			// When
			const result = runBatch([...args, "--fix"]);

			// Then
			expect(result.status).toBe(1);
			expect(result.stderr).toContain(message);
			expect(snapshot()).toEqual(before);
		},
	);

	it.skipIf(process.getuid?.() === 0)(
		"Given a move that fails mid-commit When fixing Then every change rolls back and it exits 2",
		() => {
			// Given
			writeTree({
				"a.md": "# A\n\n[C](locked/sub/c.md)\n",
				"locked/sub/c.md": "# C\n\n[A](../../a.md)\n",
				"index.md": "# Index\n\n[A](a.md)\n\n[C](locked/sub/c.md)\n",
			});
			const before = snapshot();
			const locked = path.join(batchDir, "locked");
			chmodSync(locked, 0o555);

			try {
				// When
				const result = runBatch(["a.md", "locked/sub", "new/dir", "--fix"]);

				// Then
				expect(result.status).toBe(2);
				expect(result.stderr).toContain("rolled back");
				expect(snapshot()).toEqual(before);
			} finally {
				chmodSync(locked, 0o755);
			}
		},
	);
});
