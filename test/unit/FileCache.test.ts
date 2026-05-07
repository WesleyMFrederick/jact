import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { FileCache } from "../../src/FileCache.js";

let tmpDir: string;
let cache: FileCache;

beforeEach(() => {
	// Resolve macOS symlinks so tmpDir matches realpathSync used inside buildCache
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "filecache-test-"));
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

describe("FileCache — scanDirectory traversal efficiency", () => {
	it("does not stat regular directory entries while building cache", () => {
		writeFile("docs/readme.md");
		writeFile("docs/notes.txt");
		writeFile("wiki/page.md");

		const statSpy = vi.spyOn(fs, "statSync");
		try {
			const stats = cache.buildCache(tmpDir);

			expect(stats.totalFiles).toBe(2);
			expect(statSpy).not.toHaveBeenCalled();
		} finally {
			statSpy.mockRestore();
		}
	});

	it("prunes default heavy directories before descending", () => {
		writeFile("docs/readme.md");
		writeFile(".git/objects/note.md");
		writeFile(".venv/lib/site-packages/package/readme.md");

		const stats = cache.buildCache(tmpDir, false, {
			scope: tmpDir,
			source: "explicit",
		});
		const entries = cache.getEntries().map((entry) => entry.relativePath);

		expect(stats.totalFiles).toBe(1);
		expect(entries).toContain("docs/readme.md");
		expect(entries).not.toContain(".git/objects/note.md");
		expect(entries).not.toContain(".venv/lib/site-packages/package/readme.md");
	});

	it("respectGitignore:false disables default heavy-directory pruning", () => {
		writeFile("docs/readme.md");
		writeFile(".venv/lib/site-packages/package/readme.md");

		const stats = cache.buildCache(
			tmpDir,
			false,
			{ scope: tmpDir, source: "explicit" },
			{
				respectGitignore: false,
			},
		);
		const entries = cache.getEntries().map((entry) => entry.relativePath);

		expect(stats.totalFiles).toBe(1);
		expect(entries).toContain("docs/readme.md");
		expect(entries).toContain(".venv/lib/site-packages/package/readme.md");
	});
});

describe("FileCache — entries data shape", () => {
	it("single unique file: totalFiles 1, duplicates 0", () => {
		writeFile("alpha.md");
		const stats = cache.buildCache(tmpDir);
		expect(stats.totalFiles).toBe(1);
		expect(stats.duplicates).toBe(0);
	});

	it("two unique files: totalFiles 2, duplicates 0", () => {
		writeFile("alpha.md");
		writeFile("beta.md");
		const stats = cache.buildCache(tmpDir);
		expect(stats.totalFiles).toBe(2);
		expect(stats.duplicates).toBe(0);
	});

	it("one duplicate filename: totalFiles 1, duplicates 1", () => {
		writeFile("sub1/dup.md");
		writeFile("sub2/dup.md");
		const stats = cache.buildCache(tmpDir);
		expect(stats.totalFiles).toBe(1);
		expect(stats.duplicates).toBe(1);
	});
});

describe("FileCache — addToCache append semantics", () => {
	it("first occurrence resolves to a single path", () => {
		const p = writeFile("only.md");
		cache.buildCache(tmpDir);
		const result = cache.resolveFile("only.md");
		expect(result.found).toBe(true);
		if (result.found) expect(result.path).toBe(p);
	});

	it("second occurrence causes duplicate with both paths in candidates", () => {
		const p1 = writeFile("sub1/shared.md");
		const p2 = writeFile("sub2/shared.md");
		cache.buildCache(tmpDir);
		const result = cache.resolveFile("shared.md");
		expect(result.found).toBe(false);
		if (!result.found) {
			// D2: candidates must list every path (RED before D2 — field missing)
			expect(result.candidates).toBeDefined();
			expect(result.candidates).toContain(p1);
			expect(result.candidates).toContain(p2);
		}
	});

	it("three occurrences: candidates has length 3", () => {
		writeFile("a/triple.md");
		writeFile("b/triple.md");
		writeFile("c/triple.md");
		cache.buildCache(tmpDir);
		const result = cache.resolveFile("triple.md");
		expect(result.found).toBe(false);
		if (!result.found) {
			// D2: all three paths captured (RED before D2 — only first was kept)
			expect(result.candidates).toHaveLength(3);
		}
	});
});

describe("FileCache — resolveFile single match", () => {
	it("returns found:true and correct absolute path", () => {
		const p = writeFile("target.md");
		cache.buildCache(tmpDir);
		const result = cache.resolveFile("target.md");
		expect(result.found).toBe(true);
		if (result.found) expect(result.path).toBe(p);
	});
});

describe("FileCache — resolveFile duplicate match", () => {
	it("returns found:false with reason 'duplicate'", () => {
		writeFile("d1/clash.md");
		writeFile("d2/clash.md");
		cache.buildCache(tmpDir);
		const result = cache.resolveFile("clash.md");
		expect(result.found).toBe(false);
		if (!result.found) expect(result.reason).toBe("duplicate");
	});

	it("candidates array is defined and non-empty", () => {
		writeFile("x/foo.md");
		writeFile("y/foo.md");
		cache.buildCache(tmpDir);
		const result = cache.resolveFile("foo.md");
		expect(result.found).toBe(false);
		if (!result.found) {
			// D2 RED: candidates missing in current implementation
			expect(Array.isArray(result.candidates)).toBe(true);
			expect((result.candidates ?? []).length).toBeGreaterThan(0);
		}
	});

	it("message string mentions the filename", () => {
		writeFile("p1/bar.md");
		writeFile("p2/bar.md");
		cache.buildCache(tmpDir);
		const result = cache.resolveFile("bar.md");
		expect(result.found).toBe(false);
		if (!result.found) expect(result.message).toContain("bar.md");
	});
});

describe("FileCache — skipDirectories option", () => {
	const scope = () => ({ scope: tmpDir, source: "explicit" as const });

	it("skips directories matching a name in string array", () => {
		writeFile("docs/readme.md");
		writeFile("vendor/lib.md");

		cache.buildCache(tmpDir, false, scope(), { skipDirectories: ["vendor"] });
		const entries = cache.getEntries().map((e) => e.relativePath);

		expect(entries).toContain("docs/readme.md");
		expect(entries).not.toContain("vendor/lib.md");
	});

	it("skips directories matching a name in a Set", () => {
		writeFile("docs/readme.md");
		writeFile("vendor/lib.md");

		cache.buildCache(tmpDir, false, scope(), {
			skipDirectories: new Set(["vendor"]),
		});
		const entries = cache.getEntries().map((e) => e.relativePath);

		expect(entries).toContain("docs/readme.md");
		expect(entries).not.toContain("vendor/lib.md");
	});

	it("does not skip directories absent from the set", () => {
		writeFile("docs/readme.md");
		writeFile("assets/guide.md");

		cache.buildCache(tmpDir, false, scope(), { skipDirectories: ["vendor"] });
		const entries = cache.getEntries().map((e) => e.relativePath);

		expect(entries).toContain("docs/readme.md");
		expect(entries).toContain("assets/guide.md");
	});

	it("empty skipDirectories skips nothing extra", () => {
		writeFile("docs/readme.md");
		writeFile("assets/guide.md");

		cache.buildCache(tmpDir, false, scope(), { skipDirectories: [] });
		const entries = cache.getEntries().map((e) => e.relativePath);

		expect(entries).toContain("docs/readme.md");
		expect(entries).toContain("assets/guide.md");
	});
});

describe("FileCache — maxDepth limiting", () => {
	let warnSpy: MockInstance;
	const scope = () => ({ scope: tmpDir, source: "explicit" as const });

	beforeEach(() => {
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		warnSpy.mockRestore();
	});

	it("maxDepth:0 indexes only root-level .md files", () => {
		writeFile("root.md");
		writeFile("level1/nested.md");

		cache.buildCache(tmpDir, false, scope(), { maxDepth: 0 });
		const entries = cache.getEntries().map((e) => e.relativePath);

		expect(entries).toContain("root.md");
		expect(entries).not.toContain("level1/nested.md");
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("Scan depth limit (0) reached"),
		);
	});

	it("maxDepth:1 indexes root + depth-1 files but not depth-2", () => {
		writeFile("root.md");
		writeFile("level1/file.md");
		writeFile("level1/level2/deep.md");

		cache.buildCache(tmpDir, false, scope(), { maxDepth: 1 });
		const entries = cache.getEntries().map((e) => e.relativePath);

		expect(entries).toContain("root.md");
		expect(entries).toContain("level1/file.md");
		expect(entries).not.toContain("level1/level2/deep.md");
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("Scan depth limit (1) reached"),
		);
	});

	it("no maxDepth option scans all depths without warning", () => {
		writeFile("a/b/c/d/deep.md");

		cache.buildCache(tmpDir, false, scope());
		const entries = cache.getEntries().map((e) => e.relativePath);

		expect(entries).toContain("a/b/c/d/deep.md");
		expect(warnSpy).not.toHaveBeenCalled();
	});
});

describe("FileCache — backward compatibility", () => {
	it("success path still returns { found: true, path: string }", () => {
		const p = writeFile("compat.md");
		cache.buildCache(tmpDir);
		const result = cache.resolveFile("compat.md");
		expect(result).toMatchObject({ found: true, path: p });
	});

	it("not-found still returns { found: false, reason: 'not_found' }", () => {
		cache.buildCache(tmpDir); // empty dir
		const result = cache.resolveFile("nonexistent.md");
		expect(result.found).toBe(false);
		if (!result.found) expect(result.reason).toBe("not_found");
	});
});
