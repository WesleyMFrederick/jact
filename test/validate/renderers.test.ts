import { describe, expect, it } from "vitest";
import type { BatchSummary, FileResult } from "../../src/types/cli-types.js";
import { renderHuman, renderJson } from "../../src/validate/renderers.js";

function passingFile(path: string): FileResult {
	return { path, ok: true, errors: [] };
}

function failingFile(path: string, line: number, message: string): FileResult {
	return { path, ok: false, errors: [{ line, message }] };
}

function failingFileWithCount(path: string, count: number): FileResult {
	return {
		path,
		ok: false,
		errors: Array.from({ length: count }, (_, index) => ({
			line: index + 1,
			message: `error ${index + 1}`,
		})),
	};
}

function summaryOf(results: FileResult[]): BatchSummary {
	const skipped = results.filter((result) => result.skipped).length;
	const passed = results.filter(
		(result) => result.ok && !result.skipped,
	).length;
	const failed = results.filter((result) => !result.ok).length;
	return { total: results.length, passed, failed, skipped, results };
}

describe("renderHuman", () => {
	it("renders one ✅/❌ line per file plus a summary line", () => {
		const summary = summaryOf([
			passingFile("concepts/bar.md"),
			failingFile(
				"concepts/foo.md",
				94,
				"File not found: concepts/attention-mechanism",
			),
		]);

		const output = renderHuman(summary);

		expect(output).toBe(
			[
				"✅ concepts/bar.md",
				"❌ concepts/foo.md",
				"   Line 94: File not found: concepts/attention-mechanism",
				"---",
				"2 files · 1 passed · 1 failed · 0 skipped",
			].join("\n"),
		);
	});

	it("renders a file-level error (null line) without a line prefix", () => {
		const summary = summaryOf([
			{
				path: "concepts/foo.md",
				ok: false,
				errors: [{ line: null, message: "bad file" }],
			},
		]);

		const output = renderHuman(summary);

		expect(output).toContain("   bad file");
		expect(output).not.toContain("Line null");
	});

	it("collapses more than five errors to per-file counts and drill commands", () => {
		const summary = summaryOf([
			passingFile("concepts/good.md"),
			failingFileWithCount("concepts/first.md", 4),
			failingFileWithCount("concepts/second.md", 2),
		]);

		const output = renderHuman(summary);

		expect(output).toContain("❌ concepts/first.md (4 errors)");
		expect(output).toContain("❌ concepts/second.md (2 errors)");
		expect(output).not.toContain("concepts/good.md");
		expect(output).not.toContain("Line 1:");
		expect(output).toContain(
			"6 error details hidden because they exceed the default 5-error display limit.",
		);
		expect(output).toContain(
			'To Drill Into a File: run `jact validate "{{path-to-file}}"`',
		);
		expect(output).toContain(
			'To Filter Lines: run `jact validate "{{path-to-file}}" --lines "{{start-line}}-{{end-line}}"`',
		);
		expect(output).toContain(
			'To Preview Auto-Fix: run `jact validate "{{path-to-file}}" --fix --dry-run --scope "{{scope-folder}}"`',
		);
		expect(output).toContain(
			'To Apply Auto-Fix: run `jact validate "{{path-to-file}}" --fix --scope "{{scope-folder}}"`',
		);
		expect(output).toContain("with `--verbose`");
		expect(output).toContain("`jact validate -h`");
	});

	it("keeps five errors visible and lets verbose bypass the limit", () => {
		const atLimit = summaryOf([failingFileWithCount("at-limit.md", 5)]);
		const aboveLimit = summaryOf([failingFileWithCount("above-limit.md", 6)]);

		expect(renderHuman(atLimit)).toContain("   Line 5: error 5");
		expect(renderHuman(atLimit)).not.toContain("error details hidden");
		expect(renderHuman(aboveLimit, true)).toContain("   Line 6: error 6");
		expect(renderHuman(aboveLimit, true)).not.toContain("error details hidden");
	});

	it("renders skips explicitly and excludes them from passed", () => {
		const summary = summaryOf([
			{ path: "examples/example.md", ok: true, errors: [], skipped: true },
			passingFile("concepts/bar.md"),
		]);

		expect(renderHuman(summary)).toBe(
			[
				"SKIPPED: examples/example.md (validation disabled by document directive)",
				"✅ concepts/bar.md",
				"---",
				"2 files · 1 passed · 0 failed · 1 skipped",
			].join("\n"),
		);
	});

	it("renders the summary line alone when there are zero files", () => {
		const summary = summaryOf([]);

		expect(renderHuman(summary)).toBe(
			"---\n0 files · 0 passed · 0 failed · 0 skipped",
		);
	});
});

describe("renderJson", () => {
	it("renders one compact JSON object per file, no summary line", () => {
		const summary = summaryOf([
			failingFile(
				"concepts/foo.md",
				94,
				"File not found: concepts/attention-mechanism",
			),
			passingFile("concepts/bar.md"),
		]);

		const output = renderJson(summary);
		const lines = output.split("\n");

		expect(lines).toHaveLength(2);
		expect(JSON.parse(lines[0] as string)).toEqual({
			path: "concepts/foo.md",
			ok: false,
			errors: [
				{ line: 94, message: "File not found: concepts/attention-mechanism" },
			],
		});
		expect(JSON.parse(lines[1] as string)).toEqual({
			path: "concepts/bar.md",
			ok: true,
			errors: [],
		});
	});

	it("each line parses as an object with path, ok, and errors keys", () => {
		const summary = summaryOf([
			passingFile("a.md"),
			failingFile("b.md", 1, "boom"),
		]);

		for (const line of renderJson(summary).split("\n")) {
			const obj = JSON.parse(line) as Record<string, unknown>;
			expect(obj).toHaveProperty("path");
			expect(obj).toHaveProperty("ok");
			expect(obj).toHaveProperty("errors");
		}
	});
});
