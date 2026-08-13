import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScopeResolution } from "../../src/core/resolveScope.js";
import { FileCache } from "../../src/FileCache.js";

let tmpDir: string;
let cache: FileCache;

const mockScope: ScopeResolution = {
	scope: "/project/root",
	source: "cwd-git",
};

beforeEach(() => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "filecache-errors-"));
	tmpDir = fs.realpathSync(tmp);
	cache = new FileCache(fs, path);
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(relPath: string): string {
	const fullPath = path.join(tmpDir, relPath);
	fs.mkdirSync(path.dirname(fullPath), { recursive: true });
	fs.writeFileSync(fullPath, "# Test");
	return fullPath;
}

describe("M1 — not-found error format", () => {
	it("given filename not in entries, when resolveFile fails, then error message contains 'not found in scope=<path>'", () => {
		writeFile("alpha.md");
		cache.buildCache(tmpDir, false, mockScope);
		const result = cache.resolveFile("missing.md");
		expect(result.found).toBe(false);
		if (!result.found) {
			expect(result.message).toContain("not found in scope=/project/root");
		}
	});

	it("given not-found failure, when error inspected, then message contains 'source: <enum-value>'", () => {
		writeFile("alpha.md");
		cache.buildCache(tmpDir, false, mockScope);
		const result = cache.resolveFile("missing.md");
		expect(result.found).toBe(false);
		if (!result.found) {
			expect(result.message).toContain("source: cwd-git");
		}
	});

	it("given not-found + similar names exist, when error inspected, then 'Did you mean:' line lists top-3 nearMisses", () => {
		writeFile("CLAUDE.md");
		cache.buildCache(tmpDir, false, mockScope);
		// 'CLUADE.md' is a 2-char transposition of 'CLAUDE.md' — Levenshtein distance 2
		const result = cache.resolveFile("CLUADE.md");
		expect(result.found).toBe(false);
		if (!result.found) {
			expect(result.message).toContain("Did you mean:");
			expect(result.nearMisses).toBeDefined();
			expect(result.nearMisses?.length).toBeGreaterThan(0);
		}
	});

	it("given not-found + zero names within distance ≤2, when error inspected, then 'Did you mean:' line is omitted (or empty)", () => {
		writeFile("completely-different.md");
		cache.buildCache(tmpDir, false, mockScope);
		const result = cache.resolveFile("xyzzy.md");
		expect(result.found).toBe(false);
		if (!result.found) {
			expect(result.message).not.toContain("Did you mean:");
		}
	});
});

describe("M2 — duplicate error format", () => {
	it("bounds the message to five candidates while preserving every ranked candidate", () => {
		for (let index = 0; index < 7; index++) {
			writeFile(`sub-${index}/dup.md`);
		}
		cache.buildCache(tmpDir, false, mockScope);
		const result = cache.resolveFile("dup.md");
		expect(result.found).toBe(false);
		if (!result.found) {
			expect(result.message).toContain(
				"'dup.md' matched 7 files; closest matches:",
			);
			expect(result.message).toContain(
				"... 2 more matches; use --verbose to show all or --scope to narrow",
			);
			expect(result.message.match(/sub-\d\/dup\.md/g)).toHaveLength(5);
			expect(result.candidates).toHaveLength(7);
			expect(result.displayCandidates).toHaveLength(7);
		}
	});

	it("ranks by expected directory distance, then scope-relative path", () => {
		writeFile("docs/missing/dup.md");
		writeFile("docs/dup.md");
		writeFile("other/a/dup.md");
		writeFile("other/b/dup.md");
		cache.buildCache(tmpDir);
		const result = cache.resolveFile("dup.md", {
			expectedPath: path.join(tmpDir, "docs/missing/skill/dup.md"),
		});
		expect(result.found).toBe(false);
		if (!result.found) {
			expect(result.displayCandidates).toEqual([
				"docs/missing/dup.md",
				"docs/dup.md",
				"other/a/dup.md",
				"other/b/dup.md",
			]);
		}
	});

	it("ranks logical expected paths against a symlink-resolved scan root", () => {
		const realRoot = path.join(tmpDir, "real");
		const logicalRoot = path.join(tmpDir, "logical");
		writeFile("real/docs/missing/dup.md");
		writeFile("real/docs/dup.md");
		writeFile("real/other/dup.md");
		fs.symlinkSync(realRoot, logicalRoot, "dir");
		cache.buildCache(logicalRoot);
		const result = cache.resolveFile("dup.md", {
			expectedPath: path.join(logicalRoot, "docs/missing/skill/dup.md"),
		});
		expect(result.found).toBe(false);
		if (!result.found) {
			expect(result.displayCandidates?.slice(0, 2)).toEqual([
				"docs/missing/dup.md",
				"docs/dup.md",
			]);
		}
	});
});

describe("M3 — dangling symlink resilience", () => {
	it("given a dead symlink in scope, when buildCache scans, then no warning is printed", () => {
		writeFile("alpha.md");
		fs.symlinkSync(
			path.join(tmpDir, "nonexistent-target.md"),
			path.join(tmpDir, "dead.md"),
		);
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		let warnCalls: unknown[][] = [];
		try {
			cache.buildCache(tmpDir, false, mockScope);
		} finally {
			// Snapshot BEFORE restore — mockRestore() clears call history.
			warnCalls = [...warnSpy.mock.calls];
			warnSpy.mockRestore();
		}
		expect(warnCalls).toEqual([]);
	});

	it("given a dead symlink beside real files, when buildCache scans, then sibling .md files are still cached", () => {
		writeFile("before.md");
		writeFile("after.md");
		fs.symlinkSync(
			path.join(tmpDir, "nonexistent-target.md"),
			path.join(tmpDir, "dead.md"),
		);
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			cache.buildCache(tmpDir, false, mockScope);
		} finally {
			warnSpy.mockRestore();
		}
		expect(cache.resolveFile("before.md").found).toBe(true);
		expect(cache.resolveFile("after.md").found).toBe(true);
	});
});
