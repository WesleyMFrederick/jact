import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	checkOutlineReminderCache,
	resetOutlineReminderCache,
	writeOutlineReminderCache,
} from "../../src/cache/check-outline-reminder-cache.js";
import {
	checkExtractCache,
	writeExtractCache,
} from "../../src/cache/checkExtractCache.js";

const ORIGINAL_CONTENT = "# Guide\n\n## Install\n";

describe("outline reminder cache", () => {
	let testDir: string;
	let cacheDir: string;
	let firstFile: string;
	let secondFile: string;

	beforeEach(() => {
		testDir = join(tmpdir(), "jact-outline-reminder-cache-test");
		rmSync(testDir, { recursive: true, force: true });
		cacheDir = join(testDir, "cache");
		firstFile = join(testDir, "first.md");
		secondFile = join(testDir, "second.md");
		mkdirSync(testDir, { recursive: true });
		writeFileSync(firstFile, ORIGINAL_CONTENT);
		writeFileSync(secondFile, ORIGINAL_CONTENT);
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("misses before a marker is written and hits afterward", () => {
		expect(checkOutlineReminderCache("session-a", firstFile, cacheDir)).toBe(
			false,
		);

		writeOutlineReminderCache("session-a", firstFile, cacheDir);

		expect(checkOutlineReminderCache("session-a", firstFile, cacheDir)).toBe(
			true,
		);
	});

	it("invalidates the marker when file content changes", () => {
		writeOutlineReminderCache("session-a", firstFile, cacheDir);
		writeOutlineReminderCache("session-a", secondFile, cacheDir);

		writeFileSync(firstFile, "# Updated\n\nDifferent content.\n");

		expect(checkOutlineReminderCache("session-a", firstFile, cacheDir)).toBe(
			false,
		);
		expect(checkOutlineReminderCache("session-a", secondFile, cacheDir)).toBe(
			true,
		);
	});

	it("isolates markers by session and target file", () => {
		writeOutlineReminderCache("session-a", firstFile, cacheDir);

		expect(checkOutlineReminderCache("session-a", firstFile, cacheDir)).toBe(
			true,
		);
		expect(checkOutlineReminderCache("session-b", firstFile, cacheDir)).toBe(
			false,
		);
		expect(checkOutlineReminderCache("session-a", secondFile, cacheDir)).toBe(
			false,
		);
	});

	it("removes only the active target marker when cache reset is requested", () => {
		writeOutlineReminderCache("session-a", firstFile, cacheDir);
		writeOutlineReminderCache("session-a", secondFile, cacheDir);

		resetOutlineReminderCache("session-a", firstFile, cacheDir);

		expect(checkOutlineReminderCache("session-a", firstFile, cacheDir)).toBe(
			false,
		);
		expect(checkOutlineReminderCache("session-a", secondFile, cacheDir)).toBe(
			true,
		);
	});

	it("keeps outline reminders independent from extract cache markers", () => {
		writeExtractCache("session-a", firstFile, cacheDir);
		writeOutlineReminderCache("session-a", firstFile, cacheDir);

		resetOutlineReminderCache("session-a", firstFile, cacheDir);

		expect(checkOutlineReminderCache("session-a", firstFile, cacheDir)).toBe(
			false,
		);
		expect(checkExtractCache("session-a", firstFile, cacheDir)).toBe(true);
	});
});
