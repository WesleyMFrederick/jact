/**
 * FileCache .gitignore-aware scan tests.
 *
 * Verifies:
 *   - DEFAULT_SCAN_IGNORE_PATTERNS always apply (.git/, node_modules/, dist/, etc.)
 *   - Root .gitignore is respected when respectGitignore is true (default)
 *   - respectGitignore: false skips .gitignore but still applies defaults
 *   - Missing .gitignore is non-fatal; defaults still apply
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileCache } from "../../src/FileCache.js";

let tmpDir: string;
let cache: FileCache;

beforeEach(() => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "filecache-gitignore-"));
	tmpDir = fs.realpathSync(tmp);
	cache = new FileCache(fs, path);
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(relPath: string, content = "# Test"): void {
	const fullPath = path.join(tmpDir, relPath);
	fs.mkdirSync(path.dirname(fullPath), { recursive: true });
	fs.writeFileSync(fullPath, content);
}

describe("FileCache — default ignore patterns", () => {
	it("excludes node_modules/ by default", () => {
		writeFile("alpha.md");
		writeFile("node_modules/some-pkg/readme.md");
		const stats = cache.buildCache(tmpDir);
		expect(stats.totalFiles).toBe(1);
		expect(cache.resolveFile("alpha.md").found).toBe(true);
		expect(cache.resolveFile("readme.md").found).toBe(false);
	});

	it("excludes .git/ by default", () => {
		writeFile("alpha.md");
		writeFile(".git/HEAD.md");
		const stats = cache.buildCache(tmpDir);
		expect(stats.totalFiles).toBe(1);
	});

	it("excludes dist/ and build/ by default", () => {
		writeFile("alpha.md");
		writeFile("dist/output.md");
		writeFile("build/artifact.md");
		const stats = cache.buildCache(tmpDir);
		expect(stats.totalFiles).toBe(1);
	});

	it("defaults still apply when respectGitignore is false", () => {
		writeFile("alpha.md");
		writeFile("node_modules/some-pkg/readme.md");
		const stats = cache.buildCache(tmpDir, false, undefined, {
			respectGitignore: false,
		});
		expect(stats.totalFiles).toBe(1);
	});
});

describe("FileCache — .gitignore respect", () => {
	it("respects root .gitignore by default", () => {
		writeFile(".gitignore", "secret.md\n");
		writeFile("public.md");
		writeFile("secret.md");
		const stats = cache.buildCache(tmpDir);
		expect(stats.totalFiles).toBe(1);
		expect(cache.resolveFile("public.md").found).toBe(true);
		expect(cache.resolveFile("secret.md").found).toBe(false);
	});

	it("respects directory patterns in .gitignore", () => {
		writeFile(".gitignore", "private/\n");
		writeFile("public.md");
		writeFile("private/notes.md");
		const stats = cache.buildCache(tmpDir);
		expect(stats.totalFiles).toBe(1);
	});

	it("respects glob patterns in .gitignore", () => {
		writeFile(".gitignore", "*.draft.md\n");
		writeFile("final.md");
		writeFile("article.draft.md");
		const stats = cache.buildCache(tmpDir);
		expect(stats.totalFiles).toBe(1);
		expect(cache.resolveFile("final.md").found).toBe(true);
	});

	it("respectGitignore: false includes .gitignore-excluded files", () => {
		writeFile(".gitignore", "secret.md\n");
		writeFile("public.md");
		writeFile("secret.md");
		const stats = cache.buildCache(tmpDir, false, undefined, {
			respectGitignore: false,
		});
		expect(stats.totalFiles).toBe(2);
		expect(cache.resolveFile("secret.md").found).toBe(true);
	});

	it("missing .gitignore is non-fatal", () => {
		writeFile("alpha.md");
		const stats = cache.buildCache(tmpDir);
		expect(stats.totalFiles).toBe(1);
	});

	it("gitignore negation patterns cannot override DEFAULT_SCAN_IGNORE_PATTERNS", () => {
		// Attempt to re-include node_modules/ via negation pattern
		writeFile(".gitignore", "!node_modules/\n");
		writeFile("public.md");
		writeFile("node_modules/some-pkg/readme.md");
		const stats = cache.buildCache(tmpDir);
		// node_modules/ should still be excluded (default patterns are authoritative)
		expect(stats.totalFiles).toBe(1);
		expect(cache.resolveFile("public.md").found).toBe(true);
		expect(cache.resolveFile("readme.md").found).toBe(false);
	});
});

describe("FileCache — alwaysIncludeDir (targeted branch bypasses .gitignore)", () => {
	it("indexes a gitignored subtree when it is the always-include branch", () => {
		writeFile(".gitignore", "private/\n");
		writeFile("public.md");
		writeFile("private/sub/target.md");
		writeFile("private/sub/sibling.md");
		writeFile("private/other.md"); // ignored, NOT on the include branch

		const stats = cache.buildCache(tmpDir, false, undefined, {
			alwaysIncludeDir: path.join(tmpDir, "private", "sub"),
		});

		// public + target + sibling = 3; private/other.md stays excluded
		expect(stats.totalFiles).toBe(3);
		expect(cache.resolveFile("target.md").found).toBe(true);
		expect(cache.resolveFile("sibling.md").found).toBe(true);
		expect(cache.resolveFile("other.md").found).toBe(false);
	});

	it("default ignore patterns stay authoritative even on the include branch", () => {
		writeFile(".gitignore", "private/\n");
		writeFile("private/sub/target.md");
		writeFile("private/sub/node_modules/pkg/readme.md");

		const stats = cache.buildCache(tmpDir, false, undefined, {
			alwaysIncludeDir: path.join(tmpDir, "private", "sub"),
		});

		expect(cache.resolveFile("target.md").found).toBe(true);
		expect(cache.resolveFile("readme.md").found).toBe(false); // node_modules still out
		expect(stats.totalFiles).toBe(1);
	});
});

describe("FileCache — isIgnored", () => {
	it("returns true for a path excluded by the scope .gitignore", () => {
		writeFile(".gitignore", "private/\n");
		writeFile("public.md");
		writeFile("private/notes.md");
		cache.buildCache(tmpDir);
		expect(cache.isIgnored(path.join(tmpDir, "private", "notes.md"))).toBe(
			true,
		);
		expect(cache.isIgnored(path.join(tmpDir, "public.md"))).toBe(false);
	});

	it("returns false when the last scan ignored .gitignore", () => {
		writeFile(".gitignore", "private/\n");
		writeFile("private/notes.md");
		cache.buildCache(tmpDir, false, undefined, { respectGitignore: false });
		expect(cache.isIgnored(path.join(tmpDir, "private", "notes.md"))).toBe(
			false,
		);
	});

	it("returns false for a path outside the scope", () => {
		writeFile(".gitignore", "private/\n");
		cache.buildCache(tmpDir);
		expect(cache.isIgnored("/some/unrelated/elsewhere.md")).toBe(false);
	});

	it("returns false before any build", () => {
		const fresh = new FileCache(fs, path);
		expect(fresh.isIgnored(path.join(tmpDir, "anything.md"))).toBe(false);
	});
});

describe("FileCache — scopeHasGitignore", () => {
	it("true when scope has a non-empty .gitignore and it was respected", () => {
		writeFile(".gitignore", "private/\n");
		writeFile("public.md");
		cache.buildCache(tmpDir);
		expect(cache.scopeHasGitignore()).toBe(true);
	});

	it("false when the scan ignored .gitignore", () => {
		writeFile(".gitignore", "private/\n");
		cache.buildCache(tmpDir, false, undefined, { respectGitignore: false });
		expect(cache.scopeHasGitignore()).toBe(false);
	});

	it("false when there is no .gitignore", () => {
		writeFile("public.md");
		cache.buildCache(tmpDir);
		expect(cache.scopeHasGitignore()).toBe(false);
	});

	it("false when .gitignore is empty", () => {
		writeFile(".gitignore", "   \n");
		writeFile("public.md");
		cache.buildCache(tmpDir);
		expect(cache.scopeHasGitignore()).toBe(false);
	});
});
