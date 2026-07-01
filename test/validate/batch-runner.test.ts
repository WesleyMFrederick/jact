import { describe, expect, it } from "vitest";

import { runBatch, type ValidateOneFn } from "../../src/validate/batch-runner.js";
import type { ValidationResult } from "../../src/types/validationTypes.js";

/** Build a passing ValidationResult (zero errors, one valid link). */
function passingResult(): ValidationResult {
  return {
    summary: { total: 1, valid: 1, warnings: 0, errors: 0 },
    links: [
      {
        linkType: "markdown",
        scope: "internal",
        anchorType: "header",
        source: { path: { absolute: "/vault/a.md" } },
        target: { path: { raw: "b.md", absolute: "/vault/b.md", relative: "b.md" }, anchor: null },
        text: "b",
        fullMatch: "[b](b.md)",
        line: 3,
        column: 0,
        extractionMarker: null,
        validation: { status: "valid" },
      },
    ],
  };
}

/** Build a failing ValidationResult with one error-status link at `line`. */
function failingResult(line: number, message: string): ValidationResult {
  return {
    summary: { total: 1, valid: 0, warnings: 0, errors: 1 },
    links: [
      {
        linkType: "markdown",
        scope: "internal",
        anchorType: "header",
        source: { path: { absolute: "/vault/a.md" } },
        target: { path: { raw: "missing.md", absolute: null, relative: null }, anchor: null },
        text: "missing",
        fullMatch: "[missing](missing.md)",
        line,
        column: 0,
        extractionMarker: null,
        validation: { status: "error", error: message },
      },
    ],
  };
}

/** Stub validator driven by a path -> ValidationResult map. */
function stubValidator(results: Record<string, ValidationResult>): ValidateOneFn {
  return async (filePath: string) => {
    const result = results[filePath];
    if (!result) {
      throw new Error(`stubValidator: no result configured for ${filePath}`);
    }
    return result;
  };
}

// ---------------------------------------------------------------------------
// Scenario: All pass
// ---------------------------------------------------------------------------

describe("runBatch — all pass", () => {
  it("returns a BatchSummary with failed === 0 when every file passes", async () => {
    const files = ["/vault/one.md", "/vault/two.md", "/vault/three.md"];
    const validateOne = stubValidator({
      "/vault/one.md": passingResult(),
      "/vault/two.md": passingResult(),
      "/vault/three.md": passingResult(),
    });

    const summary = await runBatch(files, validateOne);

    expect(summary.total).toBe(3);
    expect(summary.passed).toBe(3);
    expect(summary.failed).toBe(0);
    expect(summary.results).toEqual([
      { path: "/vault/one.md", ok: true, errors: [] },
      { path: "/vault/two.md", ok: true, errors: [] },
      { path: "/vault/three.md", ok: true, errors: [] },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Scenario: One failure fails the batch
// ---------------------------------------------------------------------------

describe("runBatch — one failure fails the batch", () => {
  it("identifies the failing file among many passing ones", async () => {
    const files = Array.from({ length: 10 }, (_, i) => `/vault/file-${i}.md`);
    const results: Record<string, ValidationResult> = {};
    for (const f of files) {
      results[f] = passingResult();
    }
    results["/vault/file-4.md"] = failingResult(7, "broken link");

    const validateOne = stubValidator(results);

    const summary = await runBatch(files, validateOne);

    expect(summary.total).toBe(10);
    expect(summary.passed).toBe(9);
    expect(summary.failed).toBe(1);

    const failing = summary.results.find((r) => !r.ok);
    expect(failing).toEqual({
      path: "/vault/file-4.md",
      ok: false,
      errors: [{ line: 7, message: "broken link" }],
    });
  });

  it("calls validateOne sequentially, in file order", async () => {
    const files = ["/vault/a.md", "/vault/b.md", "/vault/c.md"];
    const callOrder: string[] = [];
    const validateOne: ValidateOneFn = async (filePath) => {
      callOrder.push(filePath);
      return passingResult();
    };

    await runBatch(files, validateOne);

    expect(callOrder).toEqual(files);
  });
});

// ---------------------------------------------------------------------------
// Empty input
// ---------------------------------------------------------------------------

describe("runBatch — empty file list", () => {
  it("returns a zeroed summary without calling the validator", async () => {
    let calls = 0;
    const validateOne: ValidateOneFn = async () => {
      calls += 1;
      return passingResult();
    };

    const summary = await runBatch([], validateOne);

    expect(summary).toEqual({ total: 0, passed: 0, failed: 0, results: [] });
    expect(calls).toBe(0);
  });
});
