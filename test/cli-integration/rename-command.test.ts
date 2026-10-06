import { spawnSync } from "node:child_process";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	readlinkSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
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

	it("Given parsed links and plain paths When previewed and renamed Then all references follow without changing their formats", () => {
		const preview = run(renameArgs());
		expect(preview.status).toBe(0);
		const previewResult = JSON.parse(
			preview.stdout,
		) as RenameMarkdownFilesResult;
		expect(previewResult).toMatchObject({
			source,
			destination,
			applied: false,
			links: 6,
		});
		expect(previewResult.files).toEqual([
			{ path: realpathSync(incoming), links: 6 },
		]);
		expect(existsSync(destination)).toBe(false);
		expect(readFileSync(incoming, "utf8")).toBe(originalIncoming);

		const applied = run(renameArgs("--fix"));
		expect(applied.status).toBe(0);
		const result = JSON.parse(applied.stdout) as RenameMarkdownFilesResult;
		expect(result).toMatchObject({ applied: true, links: 6 });
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
			links: 9,
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

	it.each(["file", "folder"])(
		"Given a $0 shortcut inside a folder When moving the folder Then jact stops without changing files",
		(kind) => {
			writeTree({
				"notes/sub/one.md": "# One\n",
				"ref/shared.md": "# Shared\n",
				"index.md": "# Index\n\n[One](notes/sub/one.md)\n",
			});
			const outside = mkdtempSync(path.join(tmpdir(), "jact-rename-outside-"));
			const content = `# Outside\n\n[Shared](${path.join(batchDir, "ref/shared.md")})\n`;
			const outsideFile = path.join(outside, "outside.md");
			const target = kind === "file" ? outsideFile : outside;
			const shortcut = path.join(
				batchDir,
				"notes/sub",
				kind === "file" ? "alias.md" : "alias",
			);
			writeFileSync(outsideFile, content);
			symlinkSync(target, shortcut);

			try {
				const result = runBatch(["notes", "archive/notes", "--fix"]);

				expect(result.status).toBe(1);
				expect(result.stderr).toContain(shortcut);
				expect(readlinkSync(shortcut)).toBe(target);
				expect(readFileSync(outsideFile, "utf8")).toBe(content);
				expect(
					readFileSync(path.join(batchDir, "notes/sub/one.md"), "utf8"),
				).toBe("# One\n");
				expect(readFileSync(path.join(batchDir, "index.md"), "utf8")).toBe(
					"# Index\n\n[One](notes/sub/one.md)\n",
				);
				expect(existsSync(path.join(batchDir, "archive"))).toBe(false);
			} finally {
				rmSync(outside, { recursive: true, force: true });
			}
		},
	);

	it("Given an existing bracketed filename When renamed Then only that file moves and the destination is a filename", () => {
		writeTree({
			"notes/[ab].md": "# Literal\n",
			"notes/a.md": "# A\n",
			"notes/b.md": "# B\n",
		});

		const applied = runBatch(["notes/[ab].md", "new.md", "--fix"]);

		expect(applied.status).toBe(0);
		expect(snapshot()).toEqual({
			"notes/": null,
			"notes/new.md": "# Literal\n",
			"notes/a.md": "# A\n",
			"notes/b.md": "# B\n",
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

	it("Given a non-Markdown file When previewed and renamed Then plain paths retain code, command and line suffixes", () => {
		const note = [
			"# Guide",
			"",
			"Read ../data/results.json.",
			"`../data/results.json:12`",
			"```sh",
			"cat \"../data/results.json\"",
			"```",
			"/goal plan:../data/results.json",
			"[Results](../data/results.json)",
			"",
		].join("\n");
		writeTree({
			"docs/note.md": note,
			"data/results.json": "{\"ok\":true}\n",
		});
		const before = snapshot();

		const preview = runBatch(["data/results.json", "output.json"]);

		expect(preview.status).toBe(0);
		expect(JSON.parse(preview.stdout)).toMatchObject({
			applied: false,
			links: 5,
			backups: [],
		});
		expect(snapshot()).toEqual(before);

		const applied = runBatch(["data/results.json", "output.json", "--fix"]);

		expect(applied.status).toBe(0);
		expect(readFileSync(path.join(batchDir, "docs/note.md"), "utf8")).toBe(
			note.replaceAll("../data/results.json", "../data/output.json"),
		);
		expect(readFileSync(path.join(batchDir, "data/output.json"), "utf8")).toBe(
			"{\"ok\":true}\n",
		);
		expect(existsSync(path.join(batchDir, "data/results.json"))).toBe(false);
		const result = JSON.parse(applied.stdout) as RenameMarkdownFilesResult;
		expect(result.backups).toHaveLength(2);
		expect(result.backups.map((backup) => readFileSync(backup, "utf8")).sort())
			.toEqual([note, "{\"ok\":true}\n"].sort());
	});

	it("Given absolute and tilde paths to a binary file When renamed Then path styles and file bytes survive", () => {
		const target = path.join(realpathSync(batchDir), "data/blob.bin");
		const nextTarget = path.join(realpathSync(batchDir), "data/moved.bin");
		const tilde = `~/${path.relative(homedir(), target)}`;
		const nextTilde = `~/${path.relative(homedir(), nextTarget)}`;
		const note = `# Binary\n\n\`${target}:12\`\n\n\`${tilde}\`\n`;
		const bytes = Buffer.from([0, 255, 128, 10, 0]);
		writeTree({ "index.md": note, "data/blob.bin": "" });
		writeFileSync(target, bytes);

		const applied = runBatch(["data/blob.bin", "moved.bin", "--fix"]);

		expect(applied.status).toBe(0);
		expect(readFileSync(nextTarget)).toEqual(bytes);
		expect(readFileSync(path.join(batchDir, "index.md"), "utf8")).toBe(
			`# Binary\n\n\`${nextTarget}:12\`\n\n\`${nextTilde}\`\n`,
		);
		const result = JSON.parse(applied.stdout) as RenameMarkdownFilesResult;
		const binaryBackup = result.backups.find((backup) =>
			backup.startsWith(`${target}.`),
		);
		expect(binaryBackup).toBeDefined();
		expect(readFileSync(binaryBackup!)).toEqual(bytes);
	});

	it("Given a moved Markdown note When its folder changes Then outgoing plain references keep anchors, line suffixes and scope-relative bases", () => {
		const note = [
			"# Note",
			"",
			"Read ../plans/plan.md#Overview.",
			"`../data/results.json`",
			"```sh",
			"jact extract header ../plans/plan.md \"Overview\"",
			"```",
			"/goal plan:../plans/plan.md",
			"`../src/tool.ts:12`",
			"Scope path: data/results.json",
			"",
		].join("\n");
		writeTree({
			"docs/note.md": note,
			"plans/plan.md": "# Overview\n",
			"data/results.json": "{}\n",
			"src/tool.ts": "export const value = 1;\n",
			"index.md": "Read docs/note.md#Note.\n",
		});

		const applied = runBatch(["docs/note.md", "archive/deep/note.md", "--fix"]);

		expect(applied.status).toBe(0);
		expect(readFileSync(path.join(batchDir, "archive/deep/note.md"), "utf8")).toBe(
			note
				.replaceAll("../plans/", "../../plans/")
				.replaceAll("../data/", "../../data/")
				.replaceAll("../src/", "../../src/"),
		);
		expect(readFileSync(path.join(batchDir, "index.md"), "utf8")).toBe(
			"Read archive/deep/note.md#Note.\n",
		);
	});

	it("Given Markdown and data sources When moved as one batch Then between-file plain references remain usable", () => {
		writeTree({
			"note.md": "# Note\n\n`./results.json:3`\n",
			"results.json": "{\"value\":3}\n",
			"index.md": "Read note.md#Note and `results.json`.\n",
		});

		const applied = runBatch(["note.md", "results.json", "archive/deep/", "--fix"]);

		expect(applied.status).toBe(0);
		expect(snapshot()).toEqual({
			"archive/": null,
			"archive/deep/": null,
			"archive/deep/note.md": "# Note\n\n`./results.json:3`\n",
			"archive/deep/results.json": "{\"value\":3}\n",
			"index.md": "Read archive/deep/note.md#Note and `archive/deep/results.json`.\n",
		});
	});

	it("Given a directory with Markdown and data When moved Then incoming and outgoing plain paths follow the whole tree", () => {
		writeTree({
			"notes/one.md": "# One\n\n`sub/results.json:7`\n\nRead ../ref/plan.md#Overview.\n",
			"notes/sub/results.json": "{}\n",
			"ref/plan.md": "# Overview\n",
			"index.md": "Read notes/one.md#One and `notes/sub/results.json`.\n",
		});

		const applied = runBatch(["notes", "archive/notes", "--fix"]);

		expect(applied.status).toBe(0);
		expect(readFileSync(path.join(batchDir, "archive/notes/one.md"), "utf8")).toBe(
			"# One\n\n`sub/results.json:7`\n\nRead ../../ref/plan.md#Overview.\n",
		);
		expect(readFileSync(path.join(batchDir, "index.md"), "utf8")).toBe(
			"Read archive/notes/one.md#One and `archive/notes/sub/results.json`.\n",
		);
		expect(readFileSync(path.join(batchDir, "archive/notes/sub/results.json"), "utf8"))
			.toBe("{}\n");
	});

	it("Given non-Markdown glob matches and ignored files When moved Then ignore rules apply and matching references follow", () => {
		writeTree({
			".gitignore": "src/ignored.ts\n",
			"src/tool.ts": "tool\n",
			"src/ignored.ts": "ignored\n",
			"index.md": "`src/tool.ts:12`\n",
		});

		const applied = runBatch(["src/*.ts", "archive", "--fix"]);

		expect(applied.status).toBe(0);
		expect(readFileSync(path.join(batchDir, "archive/tool.ts"), "utf8")).toBe("tool\n");
		expect(readFileSync(path.join(batchDir, "src/ignored.ts"), "utf8")).toBe("ignored\n");
		expect(readFileSync(path.join(batchDir, "index.md"), "utf8")).toBe("`archive/tool.ts:12`\n");
	});

	it("Given URLs, patterns and templates When a real target is renamed Then excluded text and unrelated broken paths stay unchanged", () => {
		const excluded = [
			"https://example.com/data/results.json",
			"`data/*.json`",
			"`data/${name}.json`",
			"`data/{name}.json`",
			"Unrelated missing path: missing/old.json",
			"",
		].join("\n");
		writeTree({
			"data/results.json": "{}\n",
			"index.md": `Read data/results.json.\n${excluded}`,
		});

		const applied = runBatch(["data/results.json", "output.json", "--fix"]);

		expect(applied.status).toBe(0);
		expect(readFileSync(path.join(batchDir, "index.md"), "utf8")).toBe(
			`Read data/output.json.\n${excluded}`,
		);
	});

	it("Given two exact targets for an incoming plain path When one moves Then the ambiguous plan is refused without changes", () => {
		writeTree({
			"data/results.json": "scope\n",
			"docs/data/results.json": "note\n",
			"docs/note.md": "Read data/results.json.\n",
		});
		const before = snapshot();

		const applied = runBatch(["data/results.json", "output.json", "--fix"]);

		expect(applied.status).toBe(1);
		expect(applied.stderr).toContain("is ambiguous");
		expect(applied.stderr).toContain("data/results.json");
		expect(snapshot()).toEqual(before);
	});

	it("Given a missing outgoing plain path When its Markdown note changes folders Then preview and apply refuse before writing", () => {
		writeTree({
			"docs/note.md": "# Note\n\n`../data/missing.json:12`\n",
		});
		const before = snapshot();

		for (const extra of [[], ["--fix"]]) {
			const result = runBatch(["docs/note.md", "archive/note.md", ...extra]);

			expect(result.status).toBe(1);
			expect(result.stderr).toContain("does not resolve");
			expect(result.stderr).toContain("../data/missing.json:12");
			expect(snapshot()).toEqual(before);
		}
	});

	it("Given an edited plain reference corrupted after a move When verification runs Then the move and note changes roll back", () => {
		writeTree({
			"data/results.json": "{}\n",
			"index.md": "`data/results.json:12`\n",
		});
		const before = snapshot();
		const fault = `
			import fs from "node:fs";
			import { syncBuiltinESMExports } from "node:module";
			import path from "node:path";
			const rename = fs.renameSync;
			fs.renameSync = (from, to) => {
				const result = rename(from, to);
				if (from === path.join(process.cwd(), "data/results.json")) {
					fs.writeFileSync(path.join(process.cwd(), "index.md"), "\`missing.json:12\`\\n");
				}
				return result;
			};
			syncBuiltinESMExports();
		`;

		const result = spawnSync(process.execPath, [
			"--import",
			`data:text/javascript,${encodeURIComponent(fault)}`,
			cliPath,
			"rename",
			"data/results.json",
			"output.json",
			"--scope",
			batchDir,
			"--fix",
		], { cwd: batchDir, encoding: "utf8" });

		expect(result.status).toBe(2);
		expect(result.stderr).toContain("Post-rename verification failed");
		expect(result.stderr).toContain("rolled back");
		expect(snapshot()).toEqual(before);
	});

	it.each([
		{
			name: "destination collides with an existing file",
			args: ["a.md", "sub/b.md", "dest"],
			message: "Destination already exists",
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
			message: "No files matched",
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

	it("Given failed directory cleanup during rollback When a later move fails Then edited documents are restored and foreign files survive", () => {
		writeTree({
			"a.md": "# A\n\n[Ref](ref/shared.md)\n",
			"b.md": "# B\n",
			"ref/shared.md": "# Shared\n",
			"index.md": "# Index\n\n[A](a.md)\n",
		});
		const fault = `
			import fs from "node:fs";
			import { syncBuiltinESMExports } from "node:module";
			import path from "node:path";
			const rename = fs.renameSync;
			fs.renameSync = (from, to) => {
				if (from === path.join(process.cwd(), "b.md")) {
					fs.writeFileSync(path.join(path.dirname(to), "foreign.txt"), "keep");
					throw new Error("Injected late move failure");
				}
				return rename(from, to);
			};
			syncBuiltinESMExports();
		`;

		const result = spawnSync(
			process.execPath,
			[
				"--import",
				`data:text/javascript,${encodeURIComponent(fault)}`,
				cliPath,
				"rename",
				"a.md",
				"b.md",
				"new/dir",
				"--scope",
				batchDir,
				"--fix",
				"--json",
			],
			{ cwd: batchDir, encoding: "utf8" },
		);

		expect(result.status).toBe(2);
		expect(result.stderr).toContain("rollback failed");
		expect(readFileSync(path.join(batchDir, "a.md"), "utf8")).toBe(
			"# A\n\n[Ref](ref/shared.md)\n",
		);
		expect(readFileSync(path.join(batchDir, "index.md"), "utf8")).toBe(
			"# Index\n\n[A](a.md)\n",
		);
		expect(readFileSync(path.join(batchDir, "b.md"), "utf8")).toBe("# B\n");
		expect(
			readFileSync(path.join(batchDir, "new/dir/foreign.txt"), "utf8"),
		).toBe("keep");
		expect(existsSync(path.join(batchDir, "new/dir/a.md"))).toBe(false);
	});

	it.each([false, true])(
		"Given ignored incoming notes When renamed with allow-gitignore=%s Then discovery respects ignore policy",
		(allowGitignore) => {
			const oldReference = "`../data/results.json:12`\n";
			writeTree({
				".gitignore": "ignored/\n",
				".jactignore": "excluded/\n",
				"data/results.json": "{}\n",
				"index.md": "`data/results.json`\n",
				"ignored/note.md": oldReference,
				"excluded/note.md": oldReference,
				"node_modules/note.md": oldReference,
			});

			const applied = runBatch([
				"data/results.json",
				"output.json",
				"--fix",
				...(allowGitignore ? ["--allow-gitignore"] : []),
			]);

			expect(applied.status).toBe(0);
			expect(readFileSync(path.join(batchDir, "index.md"), "utf8")).toBe(
				"`data/output.json`\n",
			);
			expect(readFileSync(path.join(batchDir, "ignored/note.md"), "utf8")).toBe(
				allowGitignore ? "`../data/output.json:12`\n" : oldReference,
			);
			for (const untouched of ["excluded/note.md", "node_modules/note.md"]) {
				expect(readFileSync(path.join(batchDir, untouched), "utf8")).toBe(
					oldReference,
				);
			}
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
