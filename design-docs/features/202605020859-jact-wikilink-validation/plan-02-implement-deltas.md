# Plan: jact Wikilink Validation — Implement Remaining Deltas (Plan-02)

%% *Last Modified: 05/03/26 16:41:19* %%

## Context

%% *Last Modified: 05/03/26 16:41:19* %%

Plan-01 (commit `ec85098`) shipped the parser-and-resolver layer of the wikilink-validation feature: D1 grammar, D4 resolver core, validator wiring, loud-fail. The user-facing contract surface (CLI output, exit codes, JSON shape, suggestion display, documentation) remains gapped against the §7a Delta Architecture Table. This plan closes that gap.

Five internal phases — P1 adversarial fixtures (verifies shipped D1 grammar against CommonMark edge cases), P2 D2 residual-bracket scanner, P3 D3 coverage-qualified output with Type-I `manager.validate()` interface change, P3 also covers exit-code refactor, P4 D4 Levenshtein suggestion layer, P5 D5 documentation alignment.

**Traceability:**
- [Design §2 Context](../202605020859-jact-wikilink-validation/plan.md#2.%20Context) — problem statement
- [Design §6.5 Baseline Architecture Principles Eval](../202605020859-jact-wikilink-validation/plan.md#6.5.%20%5Bi0%5D%20Baseline%20Architecture%20Principles%20Evaluation) — CI list this plan closes
- [Design §7a Delta Architecture Table](../202605020859-jact-wikilink-validation/plan.md#7a.%20Delta%20Architecture%20Table) — full Delta spec
- [Design §7a.3 Data Shape Deltas](../202605020859-jact-wikilink-validation/plan.md#7a.3%20Data%20Shape%20Deltas) — TypeScript shapes (single source of truth)
- [Design §7b D1–D5 Rationale](../202605020859-jact-wikilink-validation/plan.md#7b.%20Design%20Decisions%20Rationale) — every design decision
- [Design §7g UI Sketch](../202605020859-jact-wikilink-validation/plan.md#7g.%20UI%20Sketch%20%E2%80%94%20CLI%20Output%20Validation) — Before/After verification baseline per output mode
- [Design §9 Post-Plan-01 Baseline Reconciliation](../202605020859-jact-wikilink-validation/plan.md#9.%20Post-Plan-01%20Baseline%20Reconciliation) — what shipped vs. residual
- [Hardening fixture template — adversarial CommonMark set](../../hardening-pipeline/fixture-template.md) — AC1–AC6 baseline

---

## Baseline Tracing Guide (for dev agent)

%% *Last Modified: 05/03/26 16:41:19* %%

### Folder map

%% *Last Modified: 05/03/26 16:41:19* %%

```text
src/
  core/
    MarkdownParser/
      extractLinks.ts            ← MODIFIED (P2): residual-bracket scanner emit point
      extractWikilinks.ts        ← UNTOUCHED (D1 shipped) — P1 verifies via fixtures
      resolveWikiPath.ts         ← MODIFIED (P4): Levenshtein adaptive-threshold suggestion on miss path
      MarkdownParser.ts          ← MODIFIED (P5): JSDoc lists all 10 wikilink forms
    getLinkClass.ts              ← ADDED (P3): display-layer classifier
  types/
    citationTypes.ts             ← MODIFIED (P3): export LinkClass discriminator
    validationTypes.ts           ← MODIFIED (P2 + P3): UnrecognizedSyntaxRecord, ValidationResult.unrecognized[], ReportSummary extensions, errorBreakdown
  utils/
    stringDistance.ts            ← REUSE (P4): Levenshtein implementation already present
  CitationValidator.ts           ← MODIFIED (P3 + P4): populates byLinkClass + unrecognizedCount + errorBreakdown; populates suggestion from resolveWikiPath miss path
  jact.ts                        ← MODIFIED (P3): manager.validate() return shape, formatters, exit-code predicate
  FileCache.ts                   ← UNTOUCHED — interface stable post-Plan-01

test/
  fixtures/
    adversarial-commonmark/      ← ADDED (P1): AC1–AC6 fixtures with paired expected JSON
    wikilink-baseline/           ← REUSE — service-level smoke target
  unit/
    core/
      MarkdownParser/
        extractLinks.test.ts     ← MODIFIED (P2): residual-scanner emission cases
        resolveWikiPath.test.ts  ← MODIFIED (P4): Levenshtein scenarios
      getLinkClass.test.ts       ← ADDED (P3): classifier table
    CitationValidator.test.ts    ← MODIFIED (P3, P4): byLinkClass + suggestion paths
    jact-validate.test.ts        ← MODIFIED (P3): manager.validate() return-shape consumers, exit-code matrix

jact/CLAUDE.md                   ← MODIFIED (P5): Citation Patterns enumerates 10 forms
design-docs/
  component-guides/
    MarkdownParser Component Guide.md  ← MODIFIED (P5): "Wikilink Grammar" subsection
```

### LSP commands to run before coding

%% *Last Modified: 05/03/26 16:41:19* %%

```text
# P3 — confirm consumers of manager.validate() return shape (Type-I interface change)
LSP findReferences: src/jact.ts (manager.validate)
LSP findReferences: src/types/validationTypes.ts (ValidationResult)
LSP findReferences: src/types/validationTypes.ts (ReportSummary)

# P3 — sibling-module sweep before adding getLinkClass.ts (per Plan-01 §9b rule #2)
LSP documentSymbol: src/core/MarkdownParser/extractLinks.ts
LSP documentSymbol: src/core/MarkdownParser/createLinkObject.ts
LSP workspaceSymbol: classify

# P3 — consumer-side audit on every new ReportSummary field (per Plan-01 §9c)
LSP findReferences: src/types/validationTypes.ts (ReportSummary.errors)
LSP findReferences: src/jact.ts (formatForCLIMinimal)
LSP findReferences: src/jact.ts (formatForCLIVerbose)
LSP findReferences: src/jact.ts (formatForJSON)

# P2 — confirm extractLinks current emission shape before adding residual scanner
LSP documentSymbol: src/core/MarkdownParser/extractLinks.ts

# P4 — confirm stringDistance API + ResolvedPath shape
LSP documentSymbol: src/utils/stringDistance.ts
LSP documentSymbol: src/core/MarkdownParser/resolveWikiPath.ts

# P5 — locate all three doc-alignment surfaces
LSP workspaceSymbol: extractWikilinks
```

### Key files to read (in order)

%% *Last Modified: 05/03/26 17:20:24* %%

1. `jact extract header /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/features/202605020859-jact-wikilink-validation/plan.md "7a. Delta Architecture Table"` — single source of truth for File / Section / Before / After per Delta
2. `jact extract header /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/features/202605020859-jact-wikilink-validation/plan.md "7a.3 Data Shape Deltas"` — TypeScript shapes (verbatim into ADDED code blocks)
3. `jact extract header /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/features/202605020859-jact-wikilink-validation/plan.md "7b. Design Decisions Rationale"` — why behind each Delta (D2/D3/D4/D5)
4. `jact extract header /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/features/202605020859-jact-wikilink-validation/plan.md "7g. UI Sketch — CLI Output Validation"` — Before/After CLI output expectations (§7g.3–§7g.6, P3 verification baseline)
5. `jact extract header /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/hardening-pipeline/fixture-template.md "Adversarial CommonMark Set"` — AC1–AC6 cases (P1 fixture skeleton)
6. `src/core/MarkdownParser/extractWikilinks.ts` — shipped D1 grammar (P1 baseline, P2 sibling)
7. `src/core/MarkdownParser/resolveWikiPath.ts` — shipped D4 resolver core (P4 extension point)
8. `src/jact.ts` — `manager.validate()` + `formatForCLIMinimal` + exit-code predicate (P3 surgery surface)
9. `src/types/validationTypes.ts` — current `ValidationResult` + `ReportSummary` shapes (P2 + P3 type extensions)

---

## LSP Audit Findings

%% *Last Modified: 05/03/26 16:41:45* %%

LSP audit run at plan-authoring time. Findings:

### Fix Required

%% *Last Modified: 05/03/26 16:41:19* %%

#### `src/jact.ts:1280-1295` — exit-code predicate string-matches display output

%% *Last Modified: 05/03/26 16:41:48* %%

```diff
- if (output.includes("FAILED:") || output.includes("VALIDATION FAILED")) {
- process.exit(1);
- }
- process.exit(0);
+ process.exit(
+ result.summary.errors > 0 || result.summary.unrecognizedCount > 0 ? 1 : 0
+ );
```

This fix is folded into P3 D3 work — listed here because it is structural debt the §7a D3 spec already prescribes a fix for. Belongs in the same PR per project quality policy (fix in current PR/task; never defer).

#### `src/core/MarkdownParser/extractLinks.ts:75-102 (getCodeBlockLines)` vs `src/core/MarkdownParser/isInsideCodeBlock.ts`

%% *Last Modified: 05/03/26 16:41:19* %%

LSP `documentSymbol` sweep flags potential parallel-implementation per Plan-01 §9b rule #2. Two functions answer "is this byte inside a fenced block?" P1 pre-work confirms the consolidation: keep `isInsideCodeBlock.ts` as the single source; `getCodeBlockLines` becomes its line-pair output if still needed, otherwise removed. Action lives in P1 sibling-module sweep step.

---

## File Changes

%% *Last Modified: 05/03/26 16:41:19* %%

### ADDED

%% *Last Modified: 05/03/26 16:41:19* %%

#### `src/core/getLinkClass.ts` (P3)

%% *Last Modified: 05/03/26 17:45:17* %%

```typescript
// Display-layer discriminator separate from LinkObject.linkType.
// Per §7a D3 + §7a.3 Data Shape Deltas.

import type { LinkObject } from "../types/citationTypes.js";
import type { LinkClass } from "../types/validationTypes.js";

// Classification rules (per D3 spec):
//   linkType === "wiki"                                 → "wiki"
//   linkType === "markdown" && anchorType === "block"   → "caret"
//   linkType === "markdown"  (other anchor types)       → "markdown"
export const getLinkClass = (link: LinkObject): LinkClass => {
  // implementing agent fills in body
};
// Test assertions live in test/unit/core/getLinkClass.test.ts
```

#### `test/unit/core/getLinkClass.test.ts` (P3)

%% *Last Modified: 05/03/26 17:34:56* %%

```typescript
// Test assertions (BDD — per §7a.3 + §7g UI Sketch):
// Given a wiki LinkObject, when getLinkClass(link) runs, then it returns "wiki".
// Given a markdown LinkObject with anchorType === "block", when getLinkClass(link) runs, then it returns "caret".
// Given a markdown LinkObject with anchorType === "header", when getLinkClass(link) runs, then it returns "markdown".
// Given a markdown LinkObject with no anchor, when getLinkClass(link) runs, then it returns "markdown".
// Given the (linkType × anchorType) cross-product, when iterated, then every cell maps to exactly one LinkClass — no fall-through, no undefined return.
```

#### `test/fixtures/adversarial-commonmark/AC1.md` … `AC6.md` (P1)

%% *Last Modified: 05/03/26 16:41:19* %%

Source: `design-docs/hardening-pipeline/fixture-template.md` §"Adversarial CommonMark Set". Six CommonMark §4.5 + §6.1 + §6.5 edge cases. Each fixture pairs with `<AC-id>.expected.json` asserting:
- `byClassification.wiki.valid` count
- `errors[].linkType` shape
- No silent drops (`unrecognized[]` empty unless the fixture intentionally tests residual-bracket emission)

#### `test/fixtures/adversarial-commonmark/AC<N>.expected.json` (P1)

%% *Last Modified: 05/03/26 17:35:09* %%

```typescript
// Test assertions (BDD — per AC fixture, verifies [H-D1-regex] under adversarial CommonMark §4.5/§6.1/§6.5):
// Given AC<N>.md adversarial input, when MarkdownParser parses it, then byLinkClass.wiki count === expected wiki distribution (D1 grammar holds despite adversarial context — no silent drops).
// Given AC<N>.md, when validation runs, then errors[].linkType matches the expected shape per fixture (correct classification, no link miscounted).
// Given AC1–AC5 fixtures (non-residual cases), when parsed, then unrecognized[] is empty (D1 consumes all wiki-shaped sequences).
// Given AC6 fixture (intentionally triggers residual scanner), when parsed, then unrecognized[] contains the malformed sequence with rawText, line, column populated.
// Given any AC fixture with errors === 0 AND unrecognizedCount === 0, when validate runs, then exit code is 0; otherwise exit code is 1 (loud-fail invariant).
// [H-D1-regex] verification step — plan-01 shipped grammar must survive these adversarial cases without modification.
```

### MODIFIED

%% *Last Modified: 05/03/26 16:41:19* %%

#### `src/types/validationTypes.ts` (P2 + P3)

%% *Last Modified: 05/03/26 17:45:30* %%

Per §7a.3 Data Shape Deltas (verbatim).

```diff
+ // per D3 — display-layer discriminator
+ export type LinkClass = "markdown" | "wiki" | "caret";
+
+ // per D2 — residual-bracket scanner output
+ export interface UnrecognizedSyntaxRecord {
+ line: number;        // 1-based
+ column: number;      // 0-based
+ rawText: string;     // matched bracket sequence
+ syntaxFamily: "wiki"; // reserved for future families
+ }

  export interface ValidationSummary {
    total: number;
    valid: number;
    warnings: number;
- errors: number;
+ errors: number;                                  // derived: brokenLinks + unrecognized (per GAP-5)
+ byLinkClass: Record<LinkClass, number>;          // per D3
+ unrecognizedCount: number;                       // per D3
+ errorBreakdown: {                                // per D3 (e), GAP-5
+ brokenLinks: number;
+ unrecognized: number;
+ };
  }

  export interface ValidationResult {
    summary: ValidationSummary;
    links: EnrichedLinkObject[];
+ unrecognized: UnrecognizedSyntaxRecord[];        // per D2
    validationTime?: string;
  }
// Type-shape invariants asserted by consumers (CitationValidator.test.ts, jact-validate.test.ts).
```

#### `src/types/citationTypes.ts` (P3)

%% *Last Modified: 05/03/26 17:45:40* %%

Re-export `LinkClass` from `validationTypes` for callers that already import from `citationTypes`. No shape change to `LinkObject` (`linkType: "markdown" | "wiki"` unchanged — `LinkClass` is display-only). Re-export correctness covered by TS compile + consumer tests.

#### `src/core/MarkdownParser/extractLinks.ts` (P2)

%% *Last Modified: 05/03/26 17:45:54* %%

Add residual-bracket scanner running after all extractors. Emits `UnrecognizedSyntaxRecord[]` for any `[[...]]` sequences the grammar did not consume.

```typescript
// Key structure — implementing agent fills in body
//
// After all link extractors run:
//   1. Re-scan source text for `[[…]]` patterns NOT in the consumed-ranges set
//   2. Emit one UnrecognizedSyntaxRecord per residual occurrence
//   3. Return { links, unrecognized } (call sites updated to consume both)
//
// Performance gate: <5ms on 10KB input (per §7b D2 [H: <5ms benchmark])
//
// Sibling-module sweep result (per §9b #2):
//   - getCodeBlockLines (lines 75-102) consolidates with isInsideCodeBlock.ts
//   - residual scanner reuses isInsideCodeBlock to skip fenced + inline-code spans
//
// Test assertions live in test/unit/core/MarkdownParser/extractLinks.test.ts
```

#### `src/CitationValidator.ts` (P3 + P4)

%% *Last Modified: 05/03/26 17:46:07* %%

P3: populate new `ReportSummary` fields (`byLinkClass`, `unrecognizedCount`, `errorBreakdown`).
P4: populate `ValidationMetadata.suggestion` from `resolveWikiPath` miss path with adaptive-threshold Levenshtein result.

```typescript
// Per-link processing additions:
// 1. Call getLinkClass(link) to bucket into byLinkClass record
// 2. On wiki resolve miss, compute Levenshtein adaptive-threshold scan against FileCache basenames:
//      threshold = clamp(3, 10, floor(0.2 * candidateRelativePath.length))
//      basename-distance only (per §7b D4 + GAP-8 path-aware revision)
// 3. Multi-match: comma-space-join full relative paths; single match: emit single full path
//
// summary.errors becomes derived (per GAP-5):
//   errors = brokenLinkCount + unrecognizedCount
// summary.errorBreakdown.{brokenLinks, unrecognized} populated unconditionally
//
// Test assertions live in test/unit/CitationValidator.test.ts
```

#### `src/jact.ts` (P3)

%% *Last Modified: 05/03/26 17:46:41* %%

```diff
  // manager.validate() return-shape — Type I interface change per §7a D3 (f), GAP-6
- validate(path: string, opts: ValidateOptions): Promise<string>;
+ validate(path: string, opts: ValidateOptions): Promise<{
+ output: string;        // formatted display string
+ result: ValidationResult; // structured shape; exit-code predicate reads this
+ }>;
```

```diff
  // formatForCLIMinimal — coverage qualifier (per §7g.3 D3 (d) + (g))
- return `OK: ${valid} citations valid`;
+ return `OK: ${valid} citations valid (markdown: ${m}, wiki: ${w}, caret: ${c}; ${u} unrecognized)`;
+ // FAILED variant per §7g.3 D3 (g): includes byLinkClass breakdown inline

  // formatForCLIVerbose — SUMMARY block additions (per §7g.4 + D3 (h))
+ summaryLines.push(`- By link class: markdown=${m}, wiki=${w}, caret=${c}`);
+ summaryLines.push(`- Unrecognized: ${u}`);
+ // Trailer branch order per §7g.6 + D3 (i):
+ //   errors > 0 → "VALIDATION FAILED"
+ //   else if unrecognizedCount > 0 → "VALIDATION FAILED - K unrecognized syntax records"
+ //   else if warnings > 0 → "VALIDATION PASSED WITH WARNINGS"
+ //   else "ALL CITATIONS VALID"

  // Exit code path (per §7g.6 + D3 (f))
- if (output.includes("FAILED:") || output.includes("VALIDATION FAILED")) {
- process.exit(1);
- }
- process.exit(0);
+ process.exit(
+ result.summary.errors > 0 || result.summary.unrecognizedCount > 0 ? 1 : 0
+ );
+ // belt-and-suspenders disjunct retained even though `errors` is now derived (per GAP-5)

  // JSON branch — drops JSON.parse(result) since manager returns structured result directly
- const parsed = JSON.parse(output);
+ // result is already typed; output formatted for display only
```

P2 minimal-mode UNRECOGNIZED section (per §7g.3 GAP-1):

```typescript
// Between ERRORS and trailer summary line:
//   "UNRECOGNIZED (K)"
//   "- Line N: <rawText>"
//   "  reason: <syntaxFamily> bracket sequence not consumed by grammar"
//
// Verbose mode (per §7g.4): "UNRECOGNIZED SYNTAX (K)" block
// using existing ├─/└─ indentation pattern
//
// Test assertions live in test/unit/jact-validate.test.ts
```

#### `src/core/MarkdownParser/resolveWikiPath.ts` (P4)

%% *Last Modified: 05/03/26 17:47:02* %%

Add adaptive-threshold Levenshtein scan on miss path.

```typescript
// On both FileCache.resolveFile(rawPath) AND FileCache.resolveFile(slug + ".md") miss:
//   1. Compute Levenshtein distance from `slug + ".md"` against basename of every FileCache entry
//   2. Adaptive threshold per candidate: clamp(3, 10, floor(0.2 * candidate.relativePath.length))
//      (full-relative-path length, NOT basename — deeper paths warrant more headroom)
//   3. Collect all candidates with basename-distance ≤ threshold
//   4. Return shape additions:
//      { resolved: false, attempted: [raw, slug+".md"], suggestions: string[] }
//      where suggestions = full relative paths (parent-folder context preserved)
//
// CitationValidator consumes suggestions[]:
//   length === 1 → validation.suggestion = full relative path
//   length >= 2 → validation.suggestion = comma-space-join (multi-match disambiguation)
//   length === 0 → validation.suggestion stays null
//
// Test assertions (incl. [H-D4-suggestion-threshold] verification) live in
// test/unit/core/MarkdownParser/resolveWikiPath.test.ts
```

#### `src/core/MarkdownParser/MarkdownParser.ts` (P5)

%% *Last Modified: 05/03/26 17:47:15* %%

JSDoc at lines 31-35 currently lists narrow wikilink forms. Update to enumerate all 10 forms covered by D1 grammar (matches `extractWikilinks.ts` shipped behavior). 10-form parity asserted once in P5 Verification (see §Verification: P5 doc-alignment diff).

#### `jact/CLAUDE.md` (P5)

%% *Last Modified: 05/03/26 17:47:22* %%

"Citation Patterns Supported" section — replace narrow wikilink examples with the 10-form enumeration. Match the order used in §7b D1 rationale. 10-form parity asserted once in P5 Verification.

#### `design-docs/component-guides/MarkdownParser Component Guide.md` (P5)

%% *Last Modified: 05/03/26 17:47:30* %%

Add new subsection "Wikilink Grammar" listing the 10 forms with one example each. Cite `src/core/MarkdownParser/extractWikilinks.ts` as the implementation source. 10-form parity asserted once in P5 Verification.

#### `test/unit/core/MarkdownParser/extractLinks.test.ts` (P2)

%% *Last Modified: 05/03/26 17:37:39* %%

Add residual-scanner emission cases.

```typescript
// Test assertions (BDD — residual-scanner emission cases per §7g.3 GAP-1 + §7b D2):
// Given source text containing an unmatched `[[…` outside any code block, when extractLinks runs, then unrecognized[] contains exactly one UnrecognizedSyntaxRecord with rawText, line (1-based), and column (0-based) populated correctly.
// Given source text with `[[…]]` inside a fenced ```code``` block, when extractLinks runs, then NO UnrecognizedSyntaxRecord is emitted for that span (isInsideCodeBlock skip path holds).
// Given source text with `[[…]]` inside an inline `code` span, when extractLinks runs, then NO UnrecognizedSyntaxRecord is emitted (isInsideInlineCode skip path holds).
// Given source where a residual `[[` sits adjacent to a valid `[[wikilink]]`, when extractLinks runs, then the valid wikilink appears in links[] AND only the residual portion appears in unrecognized[] (consumed-ranges set excludes valid spans — no double-counting).
// Given a 10KB adversarial input with mixed code blocks, valid wikilinks, and residuals, when the residual scanner runs, then total scan time is <5ms ([H: <5ms benchmark] verification per §7b D2 — performance hypothesis).
```

#### `test/unit/core/MarkdownParser/resolveWikiPath.test.ts` (P4)

%% *Last Modified: 05/03/26 17:37:55* %%

Add Levenshtein scenarios.

```typescript
// Test assertions (BDD — adaptive-threshold Levenshtein scan; [H-D4-suggestion-threshold] verification):
// Given a single-typo basename within threshold (e.g., slug "the-hardening-principle-concept.md", FileCache contains "wiki/concepts/the-hardening-principle.md", basename distance 8, threshold 8), when resolveWikiPath runs, then suggestions === ["wiki/concepts/the-hardening-principle.md"] (single match returns single full relative path).
// Given multiple FileCache candidates within threshold (duplicate basenames in different folders — e.g., the-hardening-principle.md exists in wiki/concepts/, wiki/summaries/, raw-sources/claude-code-principles/), when resolveWikiPath runs, then suggestions contains all 3 full relative paths (multi-match disambiguation per GAP-8 — folder context preserved).
// Given a long deep candidate (relativePath length ≥ 50, e.g., "raw-sources/claude-code-principles/the-hardening-principle.md" length 60), when threshold is computed, then threshold === 10 (ceiling clamp fires).
// Given a short shallow candidate (relativePath length ≤ 14), when threshold is computed, then threshold === 3 (floor clamp fires — small typos still match in shallow paths).
// Given a slug whose closest basename distance exceeds the candidate's adaptive threshold, when resolveWikiPath runs, then suggestions === [] (no false-positive — downstream validation.suggestion stays null).
// Given a wiki ref that resolves on FileCache.resolveFile(rawPath) OR FileCache.resolveFile(slug+".md"), when resolveWikiPath returns, then the Levenshtein scan is NOT invoked (cost optimization — suggestion only fires on miss).
```

#### `test/unit/CitationValidator.test.ts` (P3 + P4)

%% *Last Modified: 05/03/26 17:38:09* %%

```typescript
// Test assertions (BDD — byLinkClass + suggestion paths per P3 + P4):
// Given a mixed fixture containing markdown + wiki + caret links, when CitationValidator runs, then summary.byLinkClass.markdown === count of markdown LinkObjects AND .wiki === count of wiki LinkObjects AND .caret === count of caret LinkObjects (every link counted exactly once via getLinkClass).
// Given a fixture containing residual `[[…` in source, when CitationValidator runs, then summary.unrecognizedCount increments to match unrecognized[].length (count and array stay in sync per GAP-5).
// Given any fixture, when CitationValidator computes summary, then errorBreakdown.brokenLinks + errorBreakdown.unrecognized === summary.errors (GAP-5 derived invariant — consumers checking summary.errors > 0 catch both failure classes).
// Given a broken wiki ref where resolveWikiPath returns a single suggestion candidate, when CitationValidator builds validation.suggestion, then it equals the single full relative path (parent-folder context preserved).
// Given a broken wiki ref where resolveWikiPath returns ≥ 2 candidates, when CitationValidator builds validation.suggestion, then it equals the comma-space-joined list of full relative paths (multi-match disambiguation per §7g.3 firing-table).
// Given a broken wiki ref where resolveWikiPath returns zero candidates, when CitationValidator builds validation.suggestion, then it remains null (no false-positive).
// Given a fixture with zero links, when CitationValidator runs, then summary.byLinkClass === { markdown: 0, wiki: 0, caret: 0 } AND summary.errors === 0 AND unrecognizedCount === 0 (empty-fixture edge case).
```

#### `test/unit/jact-validate.test.ts` (P3)

%% *Last Modified: 05/03/26 17:38:27* %%

```typescript
// Test assertions (BDD — manager.validate() Type-I shape change + exit-code matrix per P3, GAP-5/6):
//
// manager.validate() return shape:
// Given a caller awaiting manager.validate(path, opts), when the promise resolves, then it returns { output: string, result: ValidationResult } (no longer Promise<string>).
// Given options.format === "json", when the JSON branch runs, then no JSON.parse(output) call is made (result is already structured — GAP-6 closure).
//
// Exit-code matrix (per §7g.6 + D3 (f)):
// Given result.summary { errors: 0, unrecognizedCount: 0 }, when exit-code path runs, then process.exit(0) fires.
// Given result.summary { errors > 0, unrecognizedCount: 0 }, when exit-code path runs, then process.exit(1) fires.
// Given result.summary { errors: 0, unrecognizedCount > 0 }, when exit-code path runs, then process.exit(1) fires (belt-and-suspenders disjunct survives even though errors is derived per GAP-5).
// Given result.summary { errors > 0, unrecognizedCount > 0 }, when exit-code path runs, then process.exit(1) fires.
//
// Verbose trailer branch order (per §7g.6 + D3 (i), GAP-4 closure):
// Given errors > 0 (regardless of unrecognized/warnings), when verbose trailer renders, then output contains "VALIDATION FAILED" (highest precedence).
// Given errors === 0 AND unrecognizedCount > 0, when verbose trailer renders, then output contains "VALIDATION FAILED - K unrecognized syntax records" (GAP-4: never prints "ALL CITATIONS VALID" while exit code is 1 — contradiction loophole closed).
// Given errors === 0 AND unrecognizedCount === 0 AND warnings > 0, when verbose trailer renders, then output contains "VALIDATION PASSED WITH WARNINGS".
// Given errors === 0 AND unrecognizedCount === 0 AND warnings === 0, when verbose trailer renders, then output contains "ALL CITATIONS VALID".
//
// JSON mode end-to-end (per §7g.5):
// Given a fixture with mixed pass/fail wikilinks, when `jact validate --format json` runs, then parsed output contains summary.byLinkClass, summary.unrecognizedCount, top-level unrecognized[], and links[i].validation.suggestion fields (D2/D3/D4 schema deltas all present).
```

### REMOVED

%% *Last Modified: 05/03/26 16:41:19* %%

- `src/jact.ts` string-match exit-code branch (lines 1288-1293) — replaced by structured-field predicate (P3)
- _(possibly)_ `src/core/MarkdownParser/extractLinks.ts` `getCodeBlockLines` (lines 75-102) if P1 sibling-module sweep confirms consolidation with `isInsideCodeBlock.ts` — decision recorded in P1 STATE-WRITE

### RENAMED

%% *Last Modified: 05/03/26 16:41:19* %%

_(none)_

### UNTOUCHED

%% *Last Modified: 05/03/26 16:41:19* %%

- `src/FileCache.ts` — interface stable post-Plan-01; reused by P4 Levenshtein scan
- `src/utils/stringDistance.ts` — Levenshtein already implemented; P4 reuses
- `src/core/MarkdownParser/extractWikilinks.ts` — D1 shipped; P1 verifies via fixtures only
- `src/core/MarkdownParser/wikiPageSlug.ts` — D4 core shipped; unchanged
- `src/core/MarkdownParser/createLinkObject.ts` — `fileCache` REQUIRED end-to-end (Plan-01 Gate-2 fix); unchanged
- `src/core/MarkdownParser/isInsideCodeBlock.ts`, `isInsideInlineCode.ts` — Plan-01 Phase 5+6; reused by P2 residual scanner
- `eslint.config.js` + `scripts/{defer-language-scan,find-dead-fields,prod-callgraph-trace,service-level-smoke,plan-eval}.sh` — hardening pipeline; self-enforcing on every commit, no edits in this plan
- `test/hardening-pipeline/**` — test suite for hardening gates
- All of `src/ContentExtractor/`, `src/ParsedFileCache.ts`, `src/ParsedDocument.ts` — unrelated to wikilink validation

---

## Whiteboard Decision Coverage

%% *Last Modified: 05/03/26 16:41:19* %%

| Decision | How covered |
|----------|------------|
| D1 — Consolidated Wikilink Grammar | P1 adversarial fixtures verify shipped grammar; no implementation changes |
| D2 — Residual-Bracket Scanner | P2 — `extractLinks.ts` residual scanner + `UnrecognizedSyntaxRecord` type + CLI sections |
| D3 — Coverage-Qualified Output | P3 — `getLinkClass.ts` + `ReportSummary` extensions + `manager.validate()` Type-I + exit-code refactor + verbose SUMMARY + trailer branch order |
| D4 — Wiki Page Name Resolution (Levenshtein layer) | P4 — `resolveWikiPath.ts` adaptive-threshold scan + `CitationValidator` suggestion wiring |
| D5 — Documentation Alignment | P5 — `jact/CLAUDE.md` + `MarkdownParser.ts` JSDoc + component guide |
| CI-01 (Critical) — Silent false-negative | D1 (already shipped); P1 verifies under adversarial input |
| CI-02 (High) — Dead validator wiki routing | D1 (shipped); validated by service-level smoke |
| CI-03 (Critical) — No fail-fast on unrecognized wiki | P2 D2 |
| CI-04 (Medium) — Scattered wikilink invariant | D1 (shipped); P5 D5 closes documentation drift |
| CI-05 (High) — Output carries no coverage qualifier | P3 D3 |
| CI-06 (Medium) — Documentation drift | P5 D5 |
| CI-07 (Low) — Misleading function name | D1 (shipped); old extractor names removed |
| CI-08 (Low) — `resolvePath` called with bare page name | D4 (shipped); P4 adds suggestion layer on miss |
| GAP-1 — UNRECOGNIZED display section | P2 (minimal + verbose) |
| GAP-2 — FAILED-path summary line shape | P3 |
| GAP-3 — Verbose SUMMARY block additions | P3 |
| GAP-4 — Verbose trailer branch order | P3 |
| GAP-5 — `summary.errors` derived predicate | P3 |
| GAP-6 — `manager.validate()` Type I interface | P3 (ADR alongside change) |
| GAP-7 — Levenshtein suggestion | P4 |
| GAP-8 — Adaptive threshold + path-aware display + multi-match | P4 |

---

## Verification

%% *Last Modified: 05/03/26 16:41:19* %%

```bash
# Per-phase TDD: each phase RED → GREEN → refactor before next phase begins.

# P1 — adversarial fixtures verify D1 shipped grammar
bun vitest run test/fixtures/adversarial-commonmark/
# expected: AC1–AC5 PASS (grammar handles edge cases); AC6 PASSES IFF residual scanner shipped (P2)

# P2 — residual scanner unit tests
bun vitest run test/unit/core/MarkdownParser/extractLinks.test.ts
# expected: residual-emission cases PASS; <5ms perf gate PASS

# P3 — coverage-qualified output + Type-I interface
bun vitest run test/unit/core/getLinkClass.test.ts
bun vitest run test/unit/CitationValidator.test.ts
bun vitest run test/unit/jact-validate.test.ts
# expected: byLinkClass partitions correct; exit-code matrix all 4 scenarios PASS

# P4 — Levenshtein suggestion layer
bun vitest run test/unit/core/MarkdownParser/resolveWikiPath.test.ts
# expected: adaptive-threshold + multi-match cases PASS

# P5 — documentation alignment (manual diff confirms 10-form parity)
diff <(grep -A 20 "Citation Patterns Supported" jact/CLAUDE.md) \
     <(grep -A 20 "Wikilink Grammar" "design-docs/component-guides/MarkdownParser Component Guide.md")
# expected: 10-form enumeration appears in both; manual review confirms JSDoc matches

# Full suite — no regressions
bun test
# expected: ALL pass

# Service-level smoke — gate runs against canonical fixture (CLI-layer outcome per §9b rule #3)
bash scripts/service-level-smoke.sh
# expected: exit 0; ≥7/8 wiki valid; loud-fail format `Tried: <raw>, <slug>.md` retained

# Hardening gates — self-enforce on every commit (no manual invocation)
# C1 (ESLint injectable bans) + C2 (plan-eval) + C3 (defer-language) +
# C4 (portability) + C5 (historical-replay) + C6 (fixture-template)
# all expected GREEN throughout plan-02 execution.

# Final acceptance: §7g UI Sketch parity
jact validate test/fixtures/wikilink-baseline/probabilistic-vs-deterministic-systems.md
# manual diff against §7g.3 "After (post-D1–D5)" minimal mode

jact validate test/fixtures/wikilink-baseline/probabilistic-vs-deterministic-systems.md --verbose
# manual diff against §7g.4 "After (post-D1–D5)" verbose mode

jact validate test/fixtures/wikilink-baseline/probabilistic-vs-deterministic-systems.md --format json | jq
# manual diff against §7g.5 "After (post-D1–D5)" JSON shape
```
