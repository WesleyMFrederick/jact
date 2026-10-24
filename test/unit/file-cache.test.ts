import fs from "node:fs";
import type { PathLike } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("FileCache — scan safety", () => {
	let scope: string;
	let outside: string;

	beforeEach(() => {
		scope = path.join(tmpDir, "scope");
		outside = path.join(tmpDir, "outside");
		fs.mkdirSync(scope);
		fs.mkdirSync(outside);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	function names(): string[] {
		return cache
			.getAllFiles()
			.map((entry) => entry.filename)
			.sort();
	}

	/** Makes statSync fail with EBADF for any entry named `fd-*`, like /dev/fd/N. */
	function failFdStats() {
		const realStat = fs.statSync as (...args: unknown[]) => unknown;
		return vi.spyOn(fs, "statSync").mockImplementation(((
			target: PathLike,
			...rest: unknown[]
		) => {
			if (path.basename(String(target)).startsWith("fd-")) {
				throw Object.assign(
					new Error(`EBADF: bad file descriptor, stat '${String(target)}'`),
					{ code: "EBADF" },
				);
			}
			return realStat(target, ...rest);
		}) as typeof fs.statSync);
	}

	it("does not follow a directory symlink to a tree outside the real scope", () => {
		writeFile("scope/inside.md");
		writeFile("outside/external.md");
		fs.symlinkSync(outside, path.join(scope, "shared"), "dir");

		cache.buildCache(scope);

		expect(names()).toEqual(["inside.md"]);
		expect(cache.resolveFile("external.md").found).toBe(false);
	});

	it("refuses a directory replaced by an external symlink after listing", () => {
		writeFile("scope/inside.md");
		writeFile("outside/external.md");
		const replaced = path.join(scope, "replaced");
		fs.mkdirSync(replaced);
		const realRead = fs.readdirSync as (...args: unknown[]) => unknown;
		let swapped = false;
		vi.spyOn(fs, "readdirSync").mockImplementation(((
			target: PathLike,
			...rest: unknown[]
		) => {
			const entries = realRead(target, ...rest);
			if (String(target) === scope && !swapped) {
				swapped = true;
				fs.rmdirSync(replaced);
				fs.symlinkSync(outside, replaced, "dir");
			}
			return entries;
		}) as typeof fs.readdirSync);

		cache.buildCache(scope);

		expect(swapped).toBe(true);
		expect(names()).toEqual(["inside.md"]);
		expect(cache.resolveFile("external.md").found).toBe(false);
	});

	it("never stats entries behind an external directory symlink, even when the target would fail with EBADF", () => {
		writeFile("scope/inside.md");
		writeFile("outside/external.md");
		writeFile("outside/fd-special.md");
		fs.symlinkSync(outside, path.join(scope, "shared"), "dir");
		const statSpy = failFdStats();
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		cache.buildCache(scope);

		expect(warnSpy).not.toHaveBeenCalled();
		expect(
			statSpy.mock.calls.some(([target]) =>
				path.basename(String(target)).startsWith("fd-"),
			),
		).toBe(false);
		expect(names()).toEqual(["inside.md"]);
	});

	it("skips a file symlink whose stat fails with EBADF and keeps indexing its siblings", () => {
		writeFile("scope/a-before.md");
		writeFile("scope/z-after.md");
		fs.symlinkSync("/dev/fd/7", path.join(scope, "fd-link.md"));
		failFdStats();
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		cache.buildCache(scope);

		expect(warnSpy).not.toHaveBeenCalled();
		expect(names()).toEqual(["a-before.md", "z-after.md"]);
	});

	it("indexes each real directory once across mutual and self directory symlink loops", () => {
		writeFile("scope/a/one.md");
		writeFile("scope/b/two.md");
		fs.symlinkSync(path.join(scope, "b"), path.join(scope, "a", "to-b"), "dir");
		fs.symlinkSync(path.join(scope, "a"), path.join(scope, "b", "to-a"), "dir");
		fs.symlinkSync(".", path.join(scope, "a", "self"), "dir");

		const stats = cache.buildCache(scope);

		expect(stats.totalFiles).toBe(2);
		expect(stats.duplicates).toBe(0);
		expect(names()).toEqual(["one.md", "two.md"]);
	});

	it("indexes a note once when it is reachable both directly and through an internal directory symlink", () => {
		writeFile("scope/real/note.md");
		fs.symlinkSync(path.join(scope, "real"), path.join(scope, "alias"), "dir");

		cache.buildCache(scope);

		const result = cache.resolveFile("note.md");
		expect(result.found).toBe(true);
		expect(names()).toEqual(["note.md"]);
	});

	it("indexes a file symlink to a regular Markdown file under its link name", () => {
		writeFile("scope/real.md");
		fs.symlinkSync(path.join(scope, "real.md"), path.join(scope, "alias.md"));

		cache.buildCache(scope);

		expect(names()).toEqual(["alias.md", "real.md"]);
	});

	it("resolves scope-relative traversal through a symlinked scope root and still refuses external directories", () => {
		writeFile("scope/real/note.md");
		writeFile("outside/external.md");
		fs.symlinkSync(outside, path.join(scope, "shared"), "dir");
		const logicalRoot = path.join(tmpDir, "logical");
		fs.symlinkSync(scope, logicalRoot, "dir");

		cache.buildCache(logicalRoot);

		expect(names()).toEqual(["note.md"]);
	});

	it.skipIf(process.platform === "win32")(
		"does not index a FIFO named like Markdown or a symlink to it, and does not hang opening it",
		() => {
			writeFile("scope/real.md");
			const fifo = path.join(scope, "pipe.md");
			execFileSync("mkfifo", [fifo]);
			fs.symlinkSync(fifo, path.join(scope, "pipe-alias.md"));

			cache.buildCache(scope);

			expect(names()).toEqual(["real.md"]);
			expect(cache.resolveFile("pipe.md").found).toBe(false);
		},
	);
});
