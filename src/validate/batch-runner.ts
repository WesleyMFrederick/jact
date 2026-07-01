/**
 * Batch runner for `jact validate`.
 *
 * Calls an injected single-file validator sequentially over a resolved file
 * list, maps each `ValidationResult` into a `FileResult`, and aggregates into
 * a `BatchSummary` that drives the process exit code (R4, ADR D6).
 */

import type { BatchSummary, FileResult, ValidationError } from "../types/cli-types.js";
import type { ValidationResult } from "../types/validationTypes.js";

/**
 * Single-file validator, injected so this module never hard-imports the
 * concrete `CitationValidator` (DI seam for testing and layering).
 *
 * @param filePath File to validate.
 */
export type ValidateOneFn = (filePath: string) => Promise<ValidationResult>;

/**
 * Run `validateOne` sequentially over `files`, in order, aggregating into a
 * `BatchSummary`.
 *
 * SEQUENTIAL BY DESIGN (ADR D6): v1 validates one file at a time; parallel
 * validation is deferred. `validateOne` typically closes over a
 * `CitationValidator` whose `FileCache`/`ParsedFileCache` are shared and
 * mutated per call — running files concurrently against the same validator
 * risks cache races.
 *
 * CALLER CONTRACT: construct a fresh `CitationValidator` (and its caches) per
 * batch run and pass its `validateFile` as `validateOne`. Never reuse one
 * `CitationValidator` instance across multiple `runBatch` calls — its
 * `FileCache` carries state between validations.
 *
 * @param files Resolved file paths to validate, in the order they should
 *   appear in `BatchSummary.results`.
 * @param validateOne Injected single-file validator, e.g.
 *   `(f) => citationValidator.validateFile(f)`.
 * @returns Aggregate `BatchSummary` — `failed > 0` drives a non-zero exit
 *   code (ADR D4/D5).
 */
export async function runBatch(
  files: readonly string[],
  validateOne: ValidateOneFn,
): Promise<BatchSummary> {
  const results: FileResult[] = [];

  for (const path of files) {
    const result = await validateOne(path);
    results.push(toFileResult(path, result));
  }

  const passed = results.filter((r) => r.ok).length;

  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}

/**
 * Map one `ValidationResult` to a `FileResult`: `ok` iff
 * `summary.errors === 0`; otherwise collect one `ValidationError` per
 * error-status link.
 */
function toFileResult(path: string, result: ValidationResult): FileResult {
  const ok = result.summary.errors === 0;

  const errors: ValidationError[] = ok
    ? []
    : result.links
        .filter((link) => link.validation.status === "error")
        .map((link) => ({
          line: link.line,
          message: link.validation.status === "error" ? link.validation.error : "",
        }));

  return { path, ok, errors };
}
