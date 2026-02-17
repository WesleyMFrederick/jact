import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	checkExtractCache,
	writeExtractCache,
} from "../../src/cache/checkExtractCache.js";

describe("checkExtractCache", () => {
	let testDir: string;
	let cacheDir: string;
	let testFile: string;

	beforeEach(() => {
		testDir = join(
			tmpdir(),
			`cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		cacheDir = join(testDir, "claude-cache");
		mkdirSync(testDir, { recursive: true });
		testFile = join(testDir, "test.md");
		writeFileSync(testFile, "# Test\n\nSome content with [[links]]");
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("returns false when no marker file exists (cache miss)", () => {
		mkdirSync(cacheDir, { recursive: true });
		const result = checkExtractCache("session-abc", testFile, cacheDir);
		expect(result).toBe(false);
	});

	it("returns true after writeExtractCache creates marker (cache hit)", () => {
		mkdirSync(cacheDir, { recursive: true });
		writeExtractCache("session-abc", testFile, cacheDir);
		const result = checkExtractCache("session-abc", testFile, cacheDir);
		expect(result).toBe(true);
	});

	it("returns false when file content changes (invalidation)", () => {
		mkdirSync(cacheDir, { recursive: true });
		writeExtractCache("session-abc", testFile, cacheDir);

		// Modify file content — hash changes, cache miss
		writeFileSync(testFile, "# Updated\n\nDifferent content now");

		const result = checkExtractCache("session-abc", testFile, cacheDir);
		expect(result).toBe(false);
	});

	it("works when cache directory does not exist yet (auto-creation)", () => {
		// cacheDir not created — functions should auto-create
		const result = checkExtractCache("session-abc", testFile, cacheDir);
		expect(result).toBe(false);

		writeExtractCache("session-abc", testFile, cacheDir);
		const hitResult = checkExtractCache("session-abc", testFile, cacheDir);
		expect(hitResult).toBe(true);
	});
});
