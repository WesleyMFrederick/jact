import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	NoFilesMatchedError,
	resolveFiles,
} from "../../src/validate/resolve-files.js";

let tmpDir: string;

beforeEach(() => {
	// Resolve macOS symlinks so paths match what tinyglobby returns via realpathSync.
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "resolve-files-test-"));
	tmpDir = fs.realpathSync(tmp);
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** Write a file under tmpDir and return its absolute path. */
function writeFile(relPath: string, content = "# Test"): string {
	const fullPath = path.join(tmpDir, relPath);
	fs.mkdirSync(path.dirname(fullPath), { recursive: true });
	fs.writeFileSync(fullPath, content);
	return fullPath;
}

// ---------------------------------------------------------------------------
// Scenario: Validate a glob of files
// ---------------------------------------------------------------------------

describe("resolveFiles — glob expansion", () => {
	it("expands a glob pattern to matching .md files", async () => {
		const a = writeFile("concepts/a.md");
		const b = writeFile("concepts/b.md");

		const result = await resolveFiles(["concepts/*.md"], tmpDir);

		expect(result).toEqual([a, b].sort());
	});

	it("expands a recursive glob matching .md files across subdirs", async () => {
		const a = writeFile("concepts/a.md");
		const b = writeFile("entities/b.md");

		const result = await resolveFiles(["**/*.md"], tmpDir);

		expect(result).toEqual([a, b].sort());
	});

	it("filters out non-.md files matched by a broad glob", async () => {
		writeFile("concepts/a.md");
		writeFile("concepts/readme.txt");

		const result = await resolveFiles(["concepts/*"], tmpDir);

		expect(result.every((f) => f.endsWith(".md"))).toBe(true);
		expect(result).toHaveLength(1);
	});

	it("excludes node_modules from a recursive glob (default ignore patterns)", async () => {
		const a = writeFile("concepts/a.md");
		writeFile("node_modules/some-pkg/README.md");

		const result = await resolveFiles(["**/*.md"], tmpDir);

		expect(result).toEqual([a]);
	});

	it("excludes paths matched by the scope root's .gitignore", async () => {
		const a = writeFile("concepts/a.md");
		writeFile("generated/output.md");
		writeFile(".gitignore", "generated/\n");

		const result = await resolveFiles(["**/*.md"], tmpDir);

		expect(result).toEqual([a]);
	});
});

// ---------------------------------------------------------------------------
// Scenario: Validate multiple explicit paths
// ---------------------------------------------------------------------------

describe("resolveFiles — explicit paths", () => {
	it("returns all three explicit .md paths when they exist", async () => {
		const a = writeFile("a.md");
		const b = writeFile("b.md");
		const c = writeFile("c.md");

		const result = await resolveFiles([a, b, c]);

		expect(result).toEqual([a, b, c].sort());
	});

	it("returns a single explicit .md path", async () => {
		const a = writeFile("solo.md");

		const result = await resolveFiles([a]);

		expect(result).toEqual([a]);
	});
});

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

describe("resolveFiles — deduplication", () => {
	it("deduplicates when the same path is listed twice", async () => {
		const a = writeFile("dup.md");

		const result = await resolveFiles([a, a]);

		expect(result).toHaveLength(1);
		expect(result[0]).toBe(a);
	});

	it("deduplicates when a glob and an explicit path both match the same file", async () => {
		const a = writeFile("concepts/a.md");

		const result = await resolveFiles(["concepts/*.md", a], tmpDir);

		expect(result).toHaveLength(1);
		expect(result[0]).toBe(a);
	});
});

// ---------------------------------------------------------------------------
// Stable sort order
// ---------------------------------------------------------------------------

describe("resolveFiles — stable sort order", () => {
	it("returns paths in lexicographic order regardless of filesystem order", async () => {
		writeFile("z.md");
		writeFile("a.md");
		writeFile("m.md");

		const result = await resolveFiles(["*.md"], tmpDir);

		const sorted = [...result].sort();
		expect(result).toEqual(sorted);
	});
});

// ---------------------------------------------------------------------------
// Scenario: No files match
// ---------------------------------------------------------------------------

describe("resolveFiles — zero-match throws NoFilesMatchedError", () => {
	it("throws NoFilesMatchedError when a glob matches no files", async () => {
		await expect(
			resolveFiles(["concepts/*.md"], tmpDir),
		).rejects.toBeInstanceOf(NoFilesMatchedError);
	});

	it("throws NoFilesMatchedError when an explicit path does not exist", async () => {
		await expect(
			resolveFiles([path.join(tmpDir, "nonexistent.md")]),
		).rejects.toBeInstanceOf(NoFilesMatchedError);
	});

	it("includes the original patterns in the error", async () => {
		const badGlob = "concepts/*.md";
		const err = await resolveFiles([badGlob], tmpDir).catch((e) => e);

		expect(err).toBeInstanceOf(NoFilesMatchedError);
		expect((err as NoFilesMatchedError).patterns).toContain(badGlob);
	});

	it("throws NoFilesMatchedError when inputs array is empty", async () => {
		await expect(resolveFiles([])).rejects.toBeInstanceOf(NoFilesMatchedError);
	});

	it("throws NoFilesMatchedError when glob matches only non-.md files", async () => {
		writeFile("readme.txt");

		await expect(resolveFiles(["*.txt"], tmpDir)).rejects.toBeInstanceOf(
			NoFilesMatchedError,
		);
	});

	it("error message names the unmatched pattern", async () => {
		const err = await resolveFiles(["no-such-dir/*.md"], tmpDir).catch(
			(e) => e,
		);

		expect((err as NoFilesMatchedError).message).toContain("no-such-dir/*.md");
	});
});
