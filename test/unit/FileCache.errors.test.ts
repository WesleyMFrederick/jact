import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

describe("FileCache — scan error handling", () => {
	it("buildCache throws if a directory becomes unreadable during scan", () => {
		// Skip when running as root: chmod restrictions do not apply to root.
		const uid = process.getuid?.();
		if (uid === 0) return;

		writeFile("docs/readme.md");
		const restrictedDir = path.join(tmpDir, "restricted");
		fs.mkdirSync(restrictedDir);
		fs.writeFileSync(path.join(restrictedDir, "secret.md"), "# Secret");
		fs.chmodSync(restrictedDir, 0o000);

		try {
			expect(() => cache.buildCache(tmpDir)).toThrow();
		} finally {
			fs.chmodSync(restrictedDir, 0o755);
		}
	});
});

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
	it("given filename matches 2 paths in scope, when resolveFile fails, then error states 'matched 2 files in scope=<path>'", () => {
		writeFile("sub1/doc.md");
		writeFile("sub2/doc.md");
		cache.buildCache(tmpDir, false, mockScope);
		const result = cache.resolveFile("doc.md");
		expect(result.found).toBe(false);
		if (!result.found) {
			expect(result.message).toContain(
				"matched 2 files in scope=/project/root",
			);
		}
	});

	it("given duplicate failure, when error inspected, then every candidate path printed on its own indented line", () => {
		const p1 = writeFile("sub1/dup.md");
		const p2 = writeFile("sub2/dup.md");
		cache.buildCache(tmpDir, false, mockScope);
		const result = cache.resolveFile("dup.md");
		expect(result.found).toBe(false);
		if (!result.found) {
			expect(result.message).toContain(`  ${p1}`);
			expect(result.message).toContain(`  ${p2}`);
		}
	});

	it("given duplicate failure, when error inspected, then trailing line reads 'Pass --scope to narrow.'", () => {
		writeFile("sub1/dup.md");
		writeFile("sub2/dup.md");
		cache.buildCache(tmpDir, false, mockScope);
		const result = cache.resolveFile("dup.md");
		expect(result.found).toBe(false);
		if (!result.found) {
			expect(result.message.trimEnd()).toMatch(/Pass --scope to narrow\.$/);
		}
	});

	it("given duplicate failure, when error inspected, then message contains source: <enum-value>", () => {
		writeFile("sub1/dup.md");
		writeFile("sub2/dup.md");
		cache.buildCache(tmpDir, false, mockScope);
		const result = cache.resolveFile("dup.md");
		expect(result.found).toBe(false);
		if (!result.found) {
			expect(result.message).toContain("source: cwd-git");
		}
	});
});
