import { describe, expect, it } from "vitest";

import { renderHuman, renderJson } from "../../src/validate/renderers.js";
import type { BatchSummary, FileResult } from "../../src/types/cli-types.js";

function passingFile(path: string): FileResult {
  return { path, ok: true, errors: [] };
}

function failingFile(path: string, line: number, message: string): FileResult {
  return { path, ok: false, errors: [{ line, message }] };
}

function summaryOf(results: FileResult[]): BatchSummary {
  const passed = results.filter((r) => r.ok).length;
  return { total: results.length, passed, failed: results.length - passed, results };
}

describe("renderHuman", () => {
  it("renders one ✅/❌ line per file plus a summary line", () => {
    const summary = summaryOf([
      passingFile("concepts/bar.md"),
      failingFile("concepts/foo.md", 94, "File not found: concepts/attention-mechanism"),
    ]);

    const output = renderHuman(summary);

    expect(output).toBe(
      [
        "✅ concepts/bar.md",
        "❌ concepts/foo.md",
        "   Line 94: File not found: concepts/attention-mechanism",
        "---",
        "2 files · 1 passed · 1 failed",
      ].join("\n"),
    );
  });

  it("renders a file-level error (null line) without a line prefix", () => {
    const summary = summaryOf([
      { path: "concepts/foo.md", ok: false, errors: [{ line: null, message: "bad file" }] },
    ]);

    const output = renderHuman(summary);

    expect(output).toContain("   bad file");
    expect(output).not.toContain("Line null");
  });

  it("renders the summary line alone when there are zero files", () => {
    const summary = summaryOf([]);

    expect(renderHuman(summary)).toBe("---\n0 files · 0 passed · 0 failed");
  });
});

describe("renderJson", () => {
  it("renders one compact JSON object per file, no summary line", () => {
    const summary = summaryOf([
      failingFile("concepts/foo.md", 94, "File not found: concepts/attention-mechanism"),
      passingFile("concepts/bar.md"),
    ]);

    const output = renderJson(summary);
    const lines = output.split("\n");

    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0] as string)).toEqual({
      path: "concepts/foo.md",
      ok: false,
      errors: [{ line: 94, message: "File not found: concepts/attention-mechanism" }],
    });
    expect(JSON.parse(lines[1] as string)).toEqual({
      path: "concepts/bar.md",
      ok: true,
      errors: [],
    });
  });

  it("each line parses as an object with path, ok, and errors keys", () => {
    const summary = summaryOf([passingFile("a.md"), failingFile("b.md", 1, "boom")]);

    for (const line of renderJson(summary).split("\n")) {
      const obj = JSON.parse(line) as Record<string, unknown>;
      expect(obj).toHaveProperty("path");
      expect(obj).toHaveProperty("ok");
      expect(obj).toHaveProperty("errors");
    }
  });
});
