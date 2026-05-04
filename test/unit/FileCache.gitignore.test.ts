import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileCache } from "../../src/FileCache.js";

let tmpDir: string;
let cache: FileCache;

beforeEach(() => {
	// Resolve macOS symlinks so tmpDir matches realpathSync used inside buildCache
	const tmp = fs.mkdtempSync(
		path.join(os.tmpdir(), "filecache-gitignore-test-"),
	);
	tmpDir = fs.realpathSync(tmp);
	cache = new FileCache(fs, path);
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(relPath: string, content = "# Test"): string {
	const fullPath = path.join(tmpDir, relPath);
	fs.mkdirSync(path.dirname(fullPath), { recursive: true });
	fs.writeFileSync(fullPath, content);
	return fullPath;
}

function writeGitignore(content: string): void {
	const gitignorePath = path.join(tmpDir, ".gitignore");
	fs.writeFileSync(gitignorePath, content);
}

describe("FileCache — .gitignore filtering (RED)", () => {
	it("files in .gitignore-excluded dirs do NOT appear in getEntries() by default", () => {
		writeFile("docs/readme.md");
		writeFile(".claude/skills/tool.md");
		writeGitignore(".claude/");

		const stats = cache.buildCache(tmpDir, false, {
			scope: tmpDir,
			source: "explicit",
		});
		const entries = cache.getEntries();

		// Both files exist on disk
		expect(stats.totalFiles).toBe(1);

		// But only the non-ignored file appears in entries
		const entryPaths = entries.map((e) => e.relativePath);
		expect(entryPaths).toContain("docs/readme.md");
		expect(entryPaths).not.toContain(".claude/skills/tool.md");
	});

	it("files outside .gitignore-excluded dirs appear in getEntries()", () => {
		writeFile("docs/readme.md");
		writeFile("wiki/concepts/example.md");
		writeGitignore(".claude/\ndist/");

		cache.buildCache(tmpDir, false, { scope: tmpDir, source: "explicit" });
		const entries = cache.getEntries();
		const entryPaths = entries.map((e) => e.relativePath);

		expect(entryPaths).toContain("docs/readme.md");
		expect(entryPaths).toContain("wiki/concepts/example.md");
	});

	it("respectGitignore: false re-includes .gitignore-excluded files", () => {
		writeFile("docs/readme.md");
		writeFile(".claude/skills/tool.md");
		writeGitignore(".claude/");

		cache.buildCache(
			tmpDir,
			false,
			{ scope: tmpDir, source: "explicit" },
			{
				respectGitignore: false,
			},
		);
		const entries = cache.getEntries();

		const entryPaths = entries.map((e) => e.relativePath);
		expect(entryPaths).toContain("docs/readme.md");
		expect(entryPaths).toContain(".claude/skills/tool.md");
	});

	it("missing .gitignore does not throw; behaves as no filter", () => {
		writeFile("docs/readme.md");
		writeFile("wiki/example.md");

		const stats = cache.buildCache(
			tmpDir,
			false,
			{ scope: tmpDir, source: "explicit" },
			{
				respectGitignore: true,
			},
		);
		const entries = cache.getEntries();

		expect(stats.totalFiles).toBe(2);
		const entryPaths = entries.map((e) => e.relativePath);
		expect(entryPaths).toContain("docs/readme.md");
		expect(entryPaths).toContain("wiki/example.md");
	});

	it.skip("negate pattern (!) re-includes a file inside an otherwise-excluded dir", () => {
		// TODO: Negate pattern support - requires recursive pattern matching
		writeFile(".claude/tool.md");
		writeFile(".claude/important.md");
		writeGitignore(".claude/\n!.claude/important.md");

		cache.buildCache(tmpDir, false, { scope: tmpDir, source: "explicit" });
		const entries = cache.getEntries();
		const entryPaths = entries.map((e) => e.relativePath);

		expect(entryPaths).not.toContain(".claude/tool.md");
		expect(entryPaths).toContain(".claude/important.md");
	});

	it("wildcard patterns in .gitignore work correctly", () => {
		writeFile("src/code.md");
		writeFile("node_modules/pkg/readme.md");
		writeGitignore("node_modules/");

		cache.buildCache(tmpDir, false, { scope: tmpDir, source: "explicit" });
		const entries = cache.getEntries();
		const entryPaths = entries.map((e) => e.relativePath);

		expect(entryPaths).toContain("src/code.md");
		expect(entryPaths).not.toContain("node_modules/pkg/readme.md");
	});

	it("multiple excluded patterns are all respected", () => {
		writeFile("docs/readme.md");
		writeFile(".claude/tool.md");
		writeFile("dist/bundle.md");
		writeFile("build/output.md");
		writeGitignore(".claude/\ndist/\nbuild/");

		cache.buildCache(tmpDir, false, { scope: tmpDir, source: "explicit" });
		const entries = cache.getEntries();
		const entryPaths = entries.map((e) => e.relativePath);

		expect(entryPaths).toContain("docs/readme.md");
		expect(entryPaths).not.toContain(".claude/tool.md");
		expect(entryPaths).not.toContain("dist/bundle.md");
		expect(entryPaths).not.toContain("build/output.md");
	});

	it("default behavior (no options) respects .gitignore", () => {
		writeFile("docs/readme.md");
		writeFile(".claude/skills/tool.md");
		writeGitignore(".claude/");

		cache.buildCache(tmpDir, false, { scope: tmpDir, source: "explicit" });
		const entries = cache.getEntries();

		const entryPaths = entries.map((e) => e.relativePath);
		expect(entryPaths).toContain("docs/readme.md");
		expect(entryPaths).not.toContain(".claude/skills/tool.md");
	});
});
