# Issue #30 Implement Plan — Move `computeValidationSummary` to `core/validationSummary`

%% *Last Modified: 05/13/26 13:28:14* %%

**Owner:** coder
**Issue:** [refactor(citation-validator): move computeValidationSummary out of CitationValidator into its own module](https://github.com/WesleyMFrederick/jact/issues/30)
**Branch:** `feat/testing-principles-evaluation` (HEAD `a589eea`)
**Planner verification timestamp:** 2026-05-13

---

## Source-state verification [OBS]

%% *Last Modified: 05/13/26 13:28:14* %%

Before executing, `coder` MUST confirm which state of `src/CitationValidator.ts` is on the working branch. The issue body and the planner's verified observations diverge.

```bash
grep -n "^export function computeValidationSummary" src/CitationValidator.ts
wc -l src/CitationValidator.ts
grep -n "computeValidationSummary\|ValidationSummary" src/jact.ts
```

Two possible states. Apply the corresponding section below.

### State A — symbol exists (matches issue body verbatim)

%% *Last Modified: 05/13/26 13:28:14* %%

`grep` returns a hit for `export function computeValidationSummary` in `src/CitationValidator.ts` (issue describes lines 1158–1188). `src/jact.ts:28` imports it.

### State B — symbol does NOT exist (verified planner state on HEAD `a589eea`)

%% *Last Modified: 05/13/26 13:28:14* %%

- `grep` returns **no hits** for `computeValidationSummary` in `src/` or `test/`.
- `src/CitationValidator.ts` is **1138 lines**.
- Summary-build logic is **inline at `src/CitationValidator.ts:218–229`** inside `validateFile()`.
- `src/jact.ts` has **no references** to `computeValidationSummary` or `ValidationSummary`.

The end-state and the new file are identical in both states. Only the source-side mutation differs.

---

## Step 1 — Create `src/core/validationSummary.ts` (both states)

%% *Last Modified: 05/13/26 13:28:14* %%

Exact full file content:

```ts
import type {
	EnrichedLinkObject,
	ValidationSummary,
} from "../types/validationTypes.js";

/**
 * Build aggregate counts (total / valid / warnings / errors) from a list of
 * enriched links.
 *
 * Pure function — no class dependency, no `this`, no I/O. Extracted from
 * CitationValidator for testability and to eliminate a module-boundary leak
 * (per GH issue #30).
 *
 * @param links - Validated, enriched LinkObjects
 * @returns ValidationSummary aggregate counts
 */
export function computeValidationSummary(
	links: readonly EnrichedLinkObject[],
): ValidationSummary {
	return {
		total: links.length,
		valid: links.filter((link) => link.validation.status === "valid").length,
		warnings: links.filter((link) => link.validation.status === "warning")
			.length,
		errors: links.filter((link) => link.validation.status === "error").length,
	};
}
```

Rationale for the four-pass `.filter().length` form: byte-equivalent to the inline block currently in `validateFile()`. Eliminates any chance of test regression. A single-pass loop would be marginally faster but is not justified for an N-of-link-array workload.

---

## Step 2 — Modify `src/CitationValidator.ts`

%% *Last Modified: 05/13/26 13:28:14* %%

### State A path

%% *Last Modified: 05/13/26 13:28:14* %%

1. Locate `export function computeValidationSummary(...)` (issue says lines 1158–1188). Cut the entire function block including its JSDoc header (if any) and the trailing newline.
2. Remove `ValidationSummary` from the `import type { ... } from "./types/validationTypes.js"` block at top of file if and only if no other reference to `ValidationSummary` remains in the file after the function is removed. Verify with `grep -n "ValidationSummary" src/CitationValidator.ts`.
3. Add new import near the top of the import block (after `node:path` line):
   ```ts
   import { computeValidationSummary } from "./core/validationSummary.js";
   ```
4. Verify the call site inside `validateFile()` still references `computeValidationSummary(...)` — it should already, since the function was already factored out in this state.

### State B path

%% *Last Modified: 05/13/26 13:28:14* %%

1. Replace `src/CitationValidator.ts` **lines 218–229** (the inline summary literal). Exact old text:

   ```ts
   		// 4. Generate summary from enriched links
   		const enrichedLinks = links as unknown as ValidationResult["links"];
   		const summary: ValidationSummary = {
   			total: enrichedLinks.length,
   			valid: enrichedLinks.filter((link) => link.validation.status === "valid")
   				.length,
   			warnings: enrichedLinks.filter(
   				(link) => link.validation.status === "warning",
   			).length,
   			errors: enrichedLinks.filter((link) => link.validation.status === "error")
   				.length,
   		};
   ```

   Exact new text:

   ```ts
   		// 4. Generate summary from enriched links
   		const enrichedLinks = links as unknown as ValidationResult["links"];
   		const summary = computeValidationSummary(enrichedLinks);
   ```

2. Remove `ValidationSummary` from the type import block at lines 6–12. Exact old text:

   ```ts
   import type {
   	EnrichedLinkObject,
   	PathConversion,
   	ValidationMetadata,
   	ValidationResult,
   	ValidationSummary,
   } from "./types/validationTypes.js";
   ```

   Exact new text:

   ```ts
   import type {
   	EnrichedLinkObject,
   	PathConversion,
   	ValidationMetadata,
   	ValidationResult,
   } from "./types/validationTypes.js";
   ```

3. Add new import after the `node:path` import (currently line 3). Exact insertion (insert before the `import type ParsedDocument` line):

   ```ts
   import { computeValidationSummary } from "./core/validationSummary.js";
   ```

---

## Step 3 — `src/jact.ts` import change

%% *Last Modified: 05/13/26 13:28:14* %%

### State A path

%% *Last Modified: 05/13/26 13:28:14* %%

- Update `src/jact.ts:28` import: change source path from `"./CitationValidator.js"` to `"./core/validationSummary.js"` for the `computeValidationSummary` symbol.

### State B path

%% *Last Modified: 05/13/26 13:28:14* %%

- **No change.** `src/jact.ts` does not reference `computeValidationSummary` on this branch. Verify with `grep -n "computeValidationSummary" src/jact.ts` returning zero hits before declaring this step done.

---

## Step 4 — Other importers

%% *Last Modified: 05/13/26 13:28:14* %%

Run:

```bash
grep -rn "computeValidationSummary" src/ test/
```

**State A:** any hit pointing at `"./CitationValidator.js"` must be updated to `"./core/validationSummary.js"`. Include test files.

**State B:** zero hits expected. No other importers to update.

---

## Step 5 — Tests

%% *Last Modified: 05/13/26 13:28:14* %%

No test modifications required by issue AC. Validate by running:

```bash
npm run build
npm test
```

Both must pass clean. The return shape of `CitationValidator.validateFile()` (`{ summary, links }`) is preserved exactly. `ValidationSummary` interface in `src/types/validationTypes.ts` is untouched.

**Optional (not gated by issue DoD):** add `test/unit/core/validationSummary.test.ts` covering empty array → all zeros, one of each status → 1/1/1/3, all valid → totals match. Skip unless coder has spare time within the 10-minute estimate.

---

## Step 6 — Commit

%% *Last Modified: 05/13/26 13:28:14* %%

Conventional commit message (per issue DoD):

```
refactor(citation-validator): move computeValidationSummary to core/validationSummary
```

For State B, the commit body should note the extraction-vs-move distinction honestly:

```
refactor(citation-validator): move computeValidationSummary to core/validationSummary

On this branch the summary-build logic existed as an inline block inside
validateFile(); commit 1150e06 (which extracted it to a free function) is
not in this branch's ancestry. This commit extracts and relocates in one
step, achieving the end-state described in issue #30.

Closes #30
```

For State A, the simpler commit body:

```
refactor(citation-validator): move computeValidationSummary to core/validationSummary

Pure utility function had no dependency on CitationValidator class.
Eliminates module-boundary leak per issue #30 / Core FN-1 / OO FIX-2.

Closes #30
```

---

## Acceptance Criteria mapping

%% *Last Modified: 05/13/26 13:28:14* %%

| Issue AC | Coverage |
|---|---|
| `computeValidationSummary` deleted from `src/CitationValidator.ts` | Step 2 (A: cut function; B: replace inline literal with call) |
| New file `src/core/validationSummary.ts` exists & exports the function | Step 1 |
| `src/jact.ts` import updated | Step 3 (A: path swap; B: N/A — symbol not imported there) |
| No other file imports `computeValidationSummary` from `CitationValidator.ts` | Step 4 grep verification |
| All existing tests pass without modification | Step 5 |

## Definition of Done mapping

%% *Last Modified: 05/13/26 13:28:14* %%

| DoD item | Coverage |
|---|---|
| Failing tests written if untested (RED) | Optional Step 5 follow-up — not required because behavior is exercised by existing CitationValidator integration tests. |
| Implementation complete (GREEN) | Steps 1–3 |
| `npm test` passes | Step 5 |
| `npm run build` succeeds | Step 5 |
| Conventional commit | Step 6 |
