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

%% *Last Modified: 05/03/26 17:58:11* %%

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

---

## Phased Task Sequence

%% *Last Modified: 05/03/26 17:58:11* %%

**Roles:**

| Role | Model | Agent | Definition |
|------|-------|-------|------------|
| Orchestrator | sonnet | (you) | — — spawns/stops agents, routes messages, enforces escalation |
| Coder | sonnet | `coder` (general-purpose) | built-in general-purpose agent — fresh instance per phase |
| Reviewer | opus | `code-reviewer` | `/Users/wesleyfrederick/Documents/ObsidianVaultNew/0_SoftwareDevelopment/jact/claude/agents/code-reviewer.md` (model override → opus) |
| Architect | opus | `application-tech-lead` | `/Users/wesleyfrederick/Documents/ObsidianVaultNew/0_SoftwareDevelopment/jact/claude/agents/application-tech-lead.md` |

**Plan file:** `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/features/202605020859-jact-wikilink-validation/plan-02-implement-deltas.md`

**Design plan (BI/CI source of truth):** `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/features/202605020859-jact-wikilink-validation/plan.md`

**Final review success criterion (PASS/FAIL only — no partial credit):**

The final `code-reviewer` gate (`5.R`) and the `application-tech-lead` architect gate (`5.A`) must both return **PASS**. PASS requires:

1. **§7a.1 BI ↔ Delta Coverage** — Every BI-1 through BI-7 row from `plan.md §5 Baseline Ideal Outcomes Table` is FULLY covered by the shipped implementation. Reviewer cites concrete file:line evidence per BI row. Partial coverage = FAIL.
2. **§7a.2 CI ↔ Delta Coverage** — Every CI-01 through CI-08 row from `plan.md §6.5 Findings & CI Status Table` is FULLY closed by the shipped implementation. Reviewer cites concrete file:line evidence per CI row. Any unresolved CI = FAIL.

No "ship-with-followups," no "minor issues acceptable." Either every Ideal Outcome and Critical Issue is structurally addressed by the merged code, or the gate FAILS and execution returns to coder.

**Escalation Policy:**

- **Tier 1:** `code-reviewer` finds issues → `coder` (sonnet) fixes → `code-reviewer` re-reviews
- **Tier 2:** Same errors persist after Tier 1 → orchestrator spawns fresh `coder` with model override → opus → re-review
- **Tier 3:** Errors persist after Tier 2 → HUMAN HARD GATE — execution halts, orchestrator reports persistent findings + files affected + recommendation

**Spawning Rules:**

- Just-in-time: agents spawn only when their task is unblocked or within 1 task of unblocking
- Fresh `coder` per phase — never reuse across phase boundaries (context bloat from prior LSP/test/diff output)
- `code-reviewer` spawns at each REVIEW GATE only; shut down after gate verdict
- `application-tech-lead` spawns once at the FINAL ARCHITECT GATE only
- Phases sized for ≤15 implementation tasks (50–75% of context window). Phase 3 split into 3A + 3B for this reason.

**Testing convention:** All new tests use BDD assertions (`describe` / `it` / `expect`). Per-phase TDD discipline: RED (failing test) → GREEN (minimal code) → REFACTOR. Verify RED before writing GREEN.

---

### Phase 0 — Baseline `coder` (sonnet)

%% *Last Modified: 05/03/26 17:58:11* %%

- [ ] **0.0** STATE-READ: `git rev-parse HEAD` → record as `baseline_hash: <hash>` in this plan file. Anchors entire sequence.
- [ ] **0.1** BASELINE: Run LSP commands from §"LSP commands to run before coding" (lines 70–100):
  - `LSP findReferences` on `manager.validate` (src/jact.ts), `ValidationResult` and `ReportSummary` (src/types/validationTypes.ts)
  - `LSP documentSymbol` on src/core/MarkdownParser/extractLinks.ts, createLinkObject.ts
  - `LSP workspaceSymbol` on `classify`, `extractWikilinks`
  - `LSP findReferences` on `formatForCLIMinimal`, `formatForCLIVerbose`, `formatForJSON`
  - `LSP documentSymbol` on src/utils/stringDistance.ts, src/core/MarkdownParser/resolveWikiPath.ts
  - Record findings in plan as inline notes under each LSP line
- [ ] **0.2** BASELINE: Read key files in order per §"Key files to read" (lines 102–115). Read whole files for ≤300 lines; otherwise targeted offset/limit reads on the cited symbols.
- [ ] **0.3** BASELINE: Run existing test suite to establish green baseline: `bun test` (or `npm test`). Record any pre-existing failures as inline notes — these are NOT introduced by this plan and must NOT be counted as regressions in later phases.
- [ ] **0.4** BASELINE: Build clean: `npm run build` — confirm zero TypeScript errors before any edits.
- [ ] **0.S** STATE-WRITE: Update plan checkboxes 0.0–0.4 at plan file path. Record any baseline deviations (failing tests, type errors).
- [ ] **0.C** COMMIT: No code changes expected. If baseline notes added, commit "chore(plan-02): record Phase 0 baseline notes". `git rev-parse HEAD` → `end_hash: <hash>` recorded next to this checkbox.

---

### Phase 1 — Adversarial Fixtures + Sibling Sweep `coder` (sonnet)

%% *Last Modified: 05/03/26 17:58:11* %%

Verifies shipped D1 grammar against CommonMark §4.5/§6.1/§6.5 edge cases (AC1–AC6) and consolidates the `getCodeBlockLines` ↔ `isInsideCodeBlock` parallel implementation flagged in LSP Audit Findings.

- [ ] **1.0** STATE-READ: `git rev-parse HEAD` → `start_hash: <hash>`. Verify matches `end_hash` from 0.C. If mismatch, run `git log --oneline <0.C_end_hash>..HEAD` to identify intervening commits. Read plan, review Phase 0 checkboxes + LSP notes.
- [ ] **1.1** READ: `jact extract header design-docs/hardening-pipeline/fixture-template.md "Adversarial CommonMark Set"` — load AC1–AC6 source.
- [ ] **1.2** RED: Create `test/fixtures/adversarial-commonmark/AC1.md` … `AC6.md` plus paired `<AC-id>.expected.json` files per §"ADDED → test/fixtures/adversarial-commonmark/AC<N>" assertions (lines 207–215). AC1–AC5 expected: D1 grammar consumes all wiki-shaped sequences, `unrecognized[]` empty. AC6 intentionally tests residual emission (will pass after P2 only).
- [ ] **1.3** VERIFY: `bun vitest run test/fixtures/adversarial-commonmark/` — confirm RED only on AC6 (residual case); AC1–AC5 should already PASS against shipped D1 grammar. If AC1–AC5 fail, [H-D1-regex] hypothesis is FALSIFIED — STOP and escalate (D1 grammar gap, not just residual scanner).
- [ ] **1.4** SIBLING SWEEP: Per LSP Audit Findings (line 144) and Plan-01 §9b rule #2, decide consolidation between `getCodeBlockLines` (extractLinks.ts:75-102) and `isInsideCodeBlock.ts`. Read both. If `getCodeBlockLines` has no consumers outside extractLinks.ts AND `isInsideCodeBlock` covers the same byte-range query, REMOVE `getCodeBlockLines` and update extractLinks.ts callers to use `isInsideCodeBlock`. If `getCodeBlockLines` has a unique line-pair output consumed elsewhere, keep both with a JSDoc note pointing each to the other.
- [ ] **1.5** VERIFY: `npm run build && bun test` — full suite. Pre-existing failures from 0.3 may persist; no new regressions.
- [ ] **1.S** STATE-WRITE: Update plan checkboxes. Record sweep decision (REMOVED `getCodeBlockLines` vs. KEPT BOTH) inline in §"REMOVED" section of File Changes.
- [ ] **1.C** COMMIT: "test(wikilink): add adversarial CommonMark fixtures (AC1-AC6) + consolidate code-block byte-range query". `git rev-parse HEAD` → `end_hash: <hash>`.

---

### Phase 2 — D2 Residual-Bracket Scanner (TDD) `coder` (sonnet)

%% *Last Modified: 05/03/26 17:58:11* %%

Closes CI-03 (Critical) and GAP-1. Adds `UnrecognizedSyntaxRecord` type + residual-scanner emission inside `extractLinks.ts`. AC6 fixture from Phase 1 transitions to GREEN.

- [ ] **2.0** STATE-READ: `git rev-parse HEAD` → `start_hash`. Verify matches 1.C `end_hash`.
- [ ] **2.1** IMPLEMENT (types only): Add `UnrecognizedSyntaxRecord` interface + `unrecognized: UnrecognizedSyntaxRecord[]` field to `ValidationResult` in `src/types/validationTypes.ts` per §7a.3 verbatim.
- [ ] **2.2** VERIFY: `npm run build` — confirm type extension compiles, consumers may show `unrecognized` missing-field errors (expected; addressed in 2.4).
- [ ] **2.3** RED: Add residual-scanner emission cases to `test/unit/core/MarkdownParser/extractLinks.test.ts` per §"MODIFIED → test/unit/core/MarkdownParser/extractLinks.test.ts" assertions (lines 419–426). Five cases: residual outside code, residual inside fenced block (skip), residual inside inline code (skip), residual adjacent to valid wikilink (no double-count), <5ms perf gate on 10KB input.
- [ ] **2.4** VERIFY RED: `bun vitest run test/unit/core/MarkdownParser/extractLinks.test.ts` — confirm new cases FAIL.
- [ ] **2.5** GREEN: Implement residual-bracket scanner in `src/core/MarkdownParser/extractLinks.ts` per §"MODIFIED → src/core/MarkdownParser/extractLinks.ts" sketch (lines 270–289). Re-scan source after all extractors; emit `UnrecognizedSyntaxRecord` per `[[…]]` not in consumed-ranges; reuse `isInsideCodeBlock` to skip fenced + inline-code spans. Update `extractLinks` return shape to `{ links, unrecognized }`. Update direct call sites to consume both fields (do NOT yet propagate to ValidationResult — that is P3 wiring).
- [ ] **2.6** VERIFY GREEN: `bun vitest run test/unit/core/MarkdownParser/extractLinks.test.ts` — all cases PASS, including <5ms perf gate.
- [ ] **2.7** VERIFY: `bun vitest run test/fixtures/adversarial-commonmark/AC6.expected.json` — AC6 residual fixture transitions to GREEN.
- [ ] **2.8** REFACTOR: Clean residual scanner — name helpers descriptively, JSDoc the consumed-ranges contract, ensure no redundant scans.
- [ ] **2.9** VERIFY: `npm run build && bun test` — full suite. No new regressions vs. 0.3 baseline.
- [ ] **2.S** STATE-WRITE: Update checkboxes. Note any deviations.
- [ ] **2.C** COMMIT: "feat(parser): residual-bracket scanner emits UnrecognizedSyntaxRecord (D2, closes CI-03)". `git rev-parse HEAD` → `end_hash: <hash>`.

#### REVIEW GATE 1 `code-reviewer` (opus)

%% *Last Modified: 05/03/26 17:58:11* %%

- [ ] **2.R** REVIEW: Scope — `src/types/validationTypes.ts`, `src/core/MarkdownParser/extractLinks.ts`, `test/unit/core/MarkdownParser/extractLinks.test.ts`, `test/fixtures/adversarial-commonmark/`. Run `git diff <0.C_end_hash>..HEAD`. Read plan §7a row D2 and §7a.2 row CI-03.
  - **Verify:** D2 sketch implemented as specified (residual scanner, isInsideCodeBlock reuse, no double-count vs. valid wikilinks)
  - **Verify:** `UnrecognizedSyntaxRecord` shape matches §7a.3 verbatim (line, column, rawText, syntaxFamily)
  - **Verify:** AC1–AC6 fixtures all PASS post-P2 (Phase 1 [H-D1-regex] + Phase 2 [H: <5ms benchmark] both verified)
  - **Verify:** No regressions in pre-existing tests
  - **Verdict:** PASS → proceed to Phase 3A. FAIL → escalation policy (Tier 1 → 2 → 3).

---

### Phase 3A — Types + getLinkClass Classifier `coder` (sonnet)

%% *Last Modified: 05/03/26 17:58:11* %%

Phase 3 split into 3A (foundation types + classifier) and 3B (consumer wiring) for context budget. 3A is pure additive — no consumer-facing changes yet.

- [ ] **3A.0** STATE-READ: `git rev-parse HEAD` → `start_hash`. Verify matches 2.C `end_hash`. Read Review Gate 1 findings.
- [ ] **3A.1** IMPLEMENT: Add `LinkClass` type + `ValidationSummary` extensions (`byLinkClass`, `unrecognizedCount`, `errorBreakdown`) to `src/types/validationTypes.ts` per §7a.3 verbatim. Mark `errors` derived per GAP-5.
- [ ] **3A.2** IMPLEMENT: Re-export `LinkClass` from `src/types/citationTypes.ts` per §"MODIFIED → src/types/citationTypes.ts" (line 264).
- [ ] **3A.3** VERIFY: `npm run build` — confirm consumers may show missing-field errors on `byLinkClass` / `unrecognizedCount` / `errorBreakdown` (expected; addressed in 3B). No type-shape errors on `LinkClass` itself.
- [ ] **3A.4** RED: Create `test/unit/core/getLinkClass.test.ts` per §"ADDED → test/unit/core/getLinkClass.test.ts" assertions (lines 185–192). Five cases including the (linkType × anchorType) cross-product exhaustiveness check.
- [ ] **3A.5** VERIFY RED: `bun vitest run test/unit/core/getLinkClass.test.ts` — confirm tests FAIL (no implementation yet).
- [ ] **3A.6** GREEN: Create `src/core/getLinkClass.ts` per §"ADDED → src/core/getLinkClass.ts" sketch (lines 160–179). Three classification rules per D3.
- [ ] **3A.7** VERIFY GREEN: `bun vitest run test/unit/core/getLinkClass.test.ts` — all cases PASS.
- [ ] **3A.8** REFACTOR: Ensure cross-product exhaustive switch (no fall-through, no undefined return).
- [ ] **3A.9** VERIFY: `npm run build && bun test` — full suite. No new regressions.
- [ ] **3A.S** STATE-WRITE: Update checkboxes.
- [ ] **3A.C** COMMIT: "feat(types): LinkClass + ValidationSummary extensions + getLinkClass classifier (D3 foundation)". `git rev-parse HEAD` → `end_hash: <hash>`.

---

### Phase 3B — Coverage-Qualified Output + Type-I Interface (TDD) `coder` (sonnet)

%% *Last Modified: 05/03/26 17:58:11* %%

Closes CI-05 (High), GAP-2/3/4/5/6. Largest-blast-radius phase: `manager.validate()` Type-I interface change, exit-code refactor, formatter overhaul. Includes the LSP Audit Findings exit-code predicate fix (folded per project tech-debt policy).

- [ ] **3B.0** STATE-READ: `git rev-parse HEAD` → `start_hash`. Verify matches 3A.C `end_hash`.
- [ ] **3B.1** IMPLEMENT: Wire `CitationValidator.ts` to populate new `ReportSummary` fields per §"MODIFIED → src/CitationValidator.ts" sketch (lines 291–311). Call `getLinkClass(link)` per link → `byLinkClass`. Populate `errorBreakdown.{brokenLinks, unrecognized}` unconditionally. Make `summary.errors = brokenLinks + unrecognized`.
- [ ] **3B.2** RED: Add byLinkClass + errorBreakdown assertions to `test/unit/CitationValidator.test.ts` per §"MODIFIED → test/unit/CitationValidator.test.ts" lines 449–457 (subset for P3B; suggestion-path assertions deferred to P4).
- [ ] **3B.3** VERIFY RED → GREEN: `bun vitest run test/unit/CitationValidator.test.ts`. Iterate until GREEN.
- [ ] **3B.4** IMPLEMENT: `manager.validate()` Type-I return-shape change in `src/jact.ts` per §"MODIFIED → src/jact.ts" diff (lines 318–354). Return `{ output, result }`. Drop `JSON.parse(output)` in JSON branch.
- [ ] **3B.5** IMPLEMENT: Update `formatForCLIMinimal` per §7g.3 — coverage qualifier `OK: N citations valid (markdown: M, wiki: W, caret: C; U unrecognized)`. Add UNRECOGNIZED section between ERRORS and trailer per §7g.3 GAP-1 (lines 357–367).
- [ ] **3B.6** IMPLEMENT: Update `formatForCLIVerbose` per §7g.4 — SUMMARY block additions (`- By link class:` + `- Unrecognized:`) and trailer branch order per §7g.6 + GAP-4 (errors > 0 → "VALIDATION FAILED"; else unrecognizedCount > 0 → "VALIDATION FAILED - K unrecognized syntax records"; else warnings > 0 → "VALIDATION PASSED WITH WARNINGS"; else "ALL CITATIONS VALID").
- [ ] **3B.7** IMPLEMENT: Replace string-match exit-code predicate (jact.ts:1280-1295) with structured-field predicate per §7a D3 (f) + LSP Audit Findings: `process.exit(result.summary.errors > 0 || result.summary.unrecognizedCount > 0 ? 1 : 0)`. Belt-and-suspenders disjunct retained per GAP-5.
- [ ] **3B.8** RED: Add manager.validate() return-shape + exit-code matrix assertions to `test/unit/jact-validate.test.ts` per §"MODIFIED → test/unit/jact-validate.test.ts" lines 463–484. Four exit-code scenarios + four trailer-branch scenarios + JSON end-to-end.
- [ ] **3B.9** VERIFY RED → GREEN: `bun vitest run test/unit/jact-validate.test.ts`. Iterate until GREEN.
- [ ] **3B.10** REFACTOR: Clean formatters — extract `renderSummaryLine` helpers if duplication exists between minimal/verbose. Confirm exit-code predicate has zero string-match dependencies.
- [ ] **3B.11** VERIFY: `npm run build && bun test` — full suite. No new regressions.
- [ ] **3B.12** SMOKE: `npm run jact:validate test/fixtures/wikilink-baseline/probabilistic-vs-deterministic-systems.md` — manual diff against §7g.3 "After (post-D1–D5)" minimal-mode block. Capture output inline in plan as Phase 3B verification evidence.
- [ ] **3B.S** STATE-WRITE: Update checkboxes. Record §7g.3 manual-diff evidence.
- [ ] **3B.C** COMMIT: "feat(cli): coverage-qualified output + Type-I manager.validate + structured exit-code (D3, closes CI-05, GAP-2/3/4/5/6)". `git rev-parse HEAD` → `end_hash: <hash>`.

#### REVIEW GATE 2 `code-reviewer` (opus)

%% *Last Modified: 05/03/26 17:58:11* %%

- [ ] **3B.R** REVIEW: Scope — `src/CitationValidator.ts`, `src/jact.ts`, `test/unit/CitationValidator.test.ts`, `test/unit/jact-validate.test.ts`. Run `git diff <2.C_end_hash>..HEAD` (covers 3A + 3B). Read plan §7a row D3, §7a.2 row CI-05, §7g.3/.4/.5/.6 UI Sketch.
  - **Verify:** §7g.6 exit-code matrix (all 4 scenarios) — structured-field predicate, no string-match
  - **Verify:** §7g.4 trailer branch order — never prints "ALL CITATIONS VALID" while exit code is 1 (GAP-4 closure)
  - **Verify:** Type-I `manager.validate()` return-shape change is consistent across all callers (consumer audit per Plan-01 §9c)
  - **Verify:** `errors` derivation matches GAP-5 (`brokenLinks + unrecognized`)
  - **Verify:** §7g.3 manual-diff evidence in 3B.12 matches "After" block
  - **Verdict:** PASS → proceed to Phase 4. FAIL → escalation policy.

---

### Phase 4 — D4 Levenshtein Suggestion Layer (TDD) `coder` (sonnet)

%% *Last Modified: 05/03/26 17:58:11* %%

Closes GAP-7, GAP-8, completes CI-08 closure.

- [ ] **4.0** STATE-READ: `git rev-parse HEAD` → `start_hash`. Verify matches 3B.C `end_hash`. Read Review Gate 2 findings.
- [ ] **4.1** RED: Add Levenshtein scenarios to `test/unit/core/MarkdownParser/resolveWikiPath.test.ts` per §"MODIFIED → test/unit/core/MarkdownParser/resolveWikiPath.test.ts" assertions (lines 433–442). Six cases: single-typo within threshold, multi-match disambiguation, ceiling clamp (≥10), floor clamp (≤3), no-match → empty suggestions, hit-path NOT invoked (cost-optimization).
- [ ] **4.2** VERIFY RED: `bun vitest run test/unit/core/MarkdownParser/resolveWikiPath.test.ts` — confirm new cases FAIL.
- [ ] **4.3** GREEN: Implement adaptive-threshold Levenshtein scan in `src/core/MarkdownParser/resolveWikiPath.ts` per §"MODIFIED → src/core/MarkdownParser/resolveWikiPath.ts" sketch (lines 374–393). On both `FileCache.resolveFile(rawPath)` AND `FileCache.resolveFile(slug+".md")` miss only. Threshold = `clamp(3, 10, floor(0.2 * candidate.relativePath.length))`. Basename distance only. Return shape gains `suggestions: string[]` (full relative paths).
- [ ] **4.4** VERIFY GREEN: `bun vitest run test/unit/core/MarkdownParser/resolveWikiPath.test.ts` — all cases PASS, including [H-D4-suggestion-threshold] verification.
- [ ] **4.5** RED: Add suggestion-path assertions to `test/unit/CitationValidator.test.ts` (the 3 cases deferred from 3B.2: single-suggestion → full path; multi-suggestion → comma-space-join; zero-suggestion → null).
- [ ] **4.6** GREEN: Wire `CitationValidator.ts` to consume `suggestions[]` from `resolveWikiPath` per §"MODIFIED → src/CitationValidator.ts" P4 portion (lines 296–311). Single match → single full path; ≥2 → comma-space-join; 0 → null.
- [ ] **4.7** VERIFY: `bun vitest run test/unit/CitationValidator.test.ts` — all cases PASS.
- [ ] **4.8** REFACTOR: Ensure Levenshtein scan only fires on miss (cost-optimization assertion in 4.1 must hold).
- [ ] **4.9** VERIFY: `npm run build && bun test` — full suite. No new regressions.
- [ ] **4.10** SMOKE: Run `bash scripts/service-level-smoke.sh` (per §Verification line 580) — exit 0; ≥7/8 wiki valid; loud-fail format `Tried: <raw>, <slug>.md` retained. Suggestion line surfaces on miss.
- [ ] **4.S** STATE-WRITE: Update checkboxes.
- [ ] **4.C** COMMIT: "feat(resolver): adaptive-threshold Levenshtein suggestion layer (D4, closes GAP-7/8, CI-08)". `git rev-parse HEAD` → `end_hash: <hash>`.

---

### Phase 5 — D5 Documentation Alignment `coder` (sonnet)

%% *Last Modified: 05/03/26 17:58:11* %%

Closes CI-04 (Medium) + CI-06 (Medium) + CI-07 (Low). Single-source-of-truth: 10-form enumeration appears identically in three locations.

- [ ] **5.0** STATE-READ: `git rev-parse HEAD` → `start_hash`. Verify matches 4.C `end_hash`.
- [ ] **5.1** READ: `src/core/MarkdownParser/extractWikilinks.ts` — confirm shipped grammar covers exactly the 10 forms enumerated in plan §7b D1 rationale. List them explicitly.
- [ ] **5.2** UPDATE: `src/core/MarkdownParser/MarkdownParser.ts` JSDoc (lines 31-35) — replace narrow examples with the 10-form enumeration in plan §7b D1 order.
- [ ] **5.3** UPDATE: `jact/CLAUDE.md` "Citation Patterns Supported" section — replace narrow wikilink examples with the 10-form enumeration. Identical wording to JSDoc per single-source-of-truth.
- [ ] **5.4** UPDATE: `design-docs/component-guides/MarkdownParser Component Guide.md` — add "Wikilink Grammar" subsection listing the 10 forms with one example each. Cite `src/core/MarkdownParser/extractWikilinks.ts` as source.
- [ ] **5.5** VERIFY: Run the 10-form parity diff per §Verification line 571: `diff <(grep -A 20 "Citation Patterns Supported" jact/CLAUDE.md) <(grep -A 20 "Wikilink Grammar" "design-docs/component-guides/MarkdownParser Component Guide.md")` — manual review confirms 10-form enumeration in both.
- [ ] **5.6** VERIFY: `npm run build && bun test` — no regressions from doc-only edits (sanity check).
- [ ] **5.7** SMOKE: §7g.4 verbose-mode + §7g.5 JSON-mode manual diffs:
  - `npm run jact:validate test/fixtures/wikilink-baseline/probabilistic-vs-deterministic-systems.md -- --verbose` vs §7g.4 "After"
  - `npm run jact:validate test/fixtures/wikilink-baseline/probabilistic-vs-deterministic-systems.md -- --format json | jq` vs §7g.5 "After"
  - Capture both outputs inline as Phase 5 verification evidence.
- [ ] **5.S** STATE-WRITE: Update checkboxes. Record §7g.4 + §7g.5 manual-diff evidence.
- [ ] **5.C** COMMIT: "docs(wikilink): align CLAUDE.md + JSDoc + component guide to 10-form D1 grammar (D5, closes CI-04/06/07)". `git rev-parse HEAD` → `end_hash: <hash>`.

---

#### FINAL REVIEW GATE — BI/CI Coverage `code-reviewer` (opus)

%% *Last Modified: 05/03/26 17:58:11* %%

Holistic pass/fail evaluation against `plan.md §7a.1 BI ↔ Delta Coverage` and `§7a.2 CI ↔ Delta Coverage`. NO partial credit. Every BI row + every CI row must be cited with file:line evidence proving FULL coverage.

- [ ] **5.R** FINAL REVIEW: Scope — entire `git diff <0.C_end_hash>..HEAD` (every commit from Phase 1 through Phase 5). Read in order:
  1. `plan.md §5 Baseline Ideal Outcomes Table` (BI-1 through BI-7)
  2. `plan.md §6.5 Findings & CI Status Table` (CI-01 through CI-08)
  3. `plan.md §7a.1 BI ↔ Delta Coverage` table
  4. `plan.md §7a.2 CI ↔ Delta Coverage` table
  5. `plan-02-implement-deltas.md §Verification` smoke evidence captured in 3B.12, 5.7
  - **Produce a BI Coverage Verification table** — for each BI-1 … BI-7 row: `| BI | Ideal Outcome | Cited Implementation Evidence (file:line) | PASS/FAIL |`. Any BI not fully achieved by shipped code = FAIL.
  - **Produce a CI Coverage Verification table** — for each CI-01 … CI-08 row: `| CI | Severity | Critical Issue | Cited Resolution Evidence (file:line) | PASS/FAIL |`. Any CI not structurally closed = FAIL.
  - **Verify §7g UI Sketch parity** — minimal/verbose/JSON outputs from 3B.12 + 5.7 evidence match "After (post-D1–D5)" blocks.
  - **Verify hardening gates GREEN throughout** — service-level-smoke.sh, ESLint, plan-eval, defer-language, portability, historical-replay all passing on final commit.
  - **Verdict format:** `PASS` (every BI + every CI ✅ with evidence) or `FAIL` (list every uncovered BI/CI with what's missing).
  - **PASS** → proceed to Architect Gate. **FAIL** → escalation policy. Tier 1: same `coder` fixes uncovered items; re-review. Tier 2: model override → opus. Tier 3: HUMAN HARD GATE.

---

#### ARCHITECT GATE `application-tech-lead` (opus)

%% *Last Modified: 05/03/26 17:58:11* %%

Final architecture evaluation. Independent of Final Review Gate — the BI/CI gate verifies coverage; the architect gate verifies the implementation is architecturally sound and free of enterprise-pattern creep.

- [ ] **5.A** ARCHITECT EVAL: Scope — entire `git diff <0.C_end_hash>..HEAD`. Use `evaluate-against-architecture-principles` skill against ALL 9 principle categories (Modular Design, Data-First Design, Action-Based File Organization, Format/Interface Design, MVP Principles, Deterministic Offloading, Self-Contained Naming, Safety-First Design, Anti-Patterns). Cross-reference shipped code against:
  - `plan.md §6.5 [i0] Baseline Architecture Principles Evaluation` (the principle violations the Deltas were designed to close)
  - `plan.md §7f [i3] Delta Architecture Eval Results` (the predicted post-Delta principle scores)
  - **Verify:** Type-I `manager.validate()` change introduced an ADR or equivalent change-note (per §7a D3 Notes column GAP-6 requirement)
  - **Verify:** No new enterprise-scale complexity (DI containers, abstract factories, etc.) — pragmatic application-scale patterns only
  - **Verify:** Module boundaries respect Plan-01 §9b sibling-sweep rule + black-box-interfaces principle
  - **Verify:** Tech debt acknowledged per project policy — no skipped reviewer/diagnostic findings deferred
  - **Verdict format:** `PASS` (architecture principles compliance verified across all 9 categories with evidence) or `FAIL` (list each principle violation + recommended remediation).
  - **PASS** → sequence COMPLETE; orchestrator reports final commit SHA + summary. **FAIL** → escalation policy.

---

### Review Gate Justification

%% *Last Modified: 05/03/26 17:58:11* %%

| Gate | Placement | Rework Cost If Skipped |
|------|-----------|----------------------|
| Gate 1 | After Phase 2 (D2 Residual Scanner) | MEDIUM — `UnrecognizedSyntaxRecord` shape feeds directly into D3's `ValidationSummary.unrecognizedCount` and `errorBreakdown.unrecognized`. Catching shape errors here prevents Phase 3B rework on every consumer. |
| Gate 2 | After Phase 3B (D3 Coverage-Qualified Output) | HIGH — `manager.validate()` Type-I change has the largest blast radius in the plan. Exit-code matrix bugs + trailer-branch-order bugs would falsify the loud-fail invariant the entire feature exists to deliver. |
| Final Review | After Phase 5 (D5 Documentation) | CRITICAL — BI/CI coverage is the success criterion. Skipping = shipping unverified-against-spec. |
| Architect Gate | After Final Review | CRITICAL — separates "coverage verified" from "architecture verified." A solution can cover BI/CI yet still violate principles (CI-01 was originally a Deterministic Offloading violation; the fix should not introduce new violations). |
| Rejected | After Phase 0 | No reviewable artifacts (research only) |
| Rejected | After Phase 1 | Fixtures verify shipped grammar; no implementation changes warrant review (sweep decision logged inline in plan) |
| Rejected | After Phase 3A | Pure additive types + pure classifier — sufficient verification via `tsc` + classifier unit tests; review folded into Gate 2 |
| Rejected | After Phase 4 | Levenshtein layer is well-bounded (one resolver fn + one consumer wiring); rework cost low; Final Review covers it |

---

### Orchestrator Instructions

%% *Last Modified: 05/03/26 17:58:11* %%

#### Plan File Checkbox Rule

%% *Last Modified: 05/03/26 17:58:11* %%

**Every agent MUST update plan checkboxes after completing tasks.**

Plan file: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/features/202605020859-jact-wikilink-validation/plan-02-implement-deltas.md`

Include this instruction in EVERY agent spawn prompt:

> After completing each task step, update the plan file checkbox from `- [ ]` to `- [x]` for that step. For STATE-WRITE steps, also record any deviations as inline notes. For COMMIT steps, record the `end_hash` value next to the checkbox using `git rev-parse HEAD`. Plan file path: `<plan file path above>`. Design plan (BI/CI source of truth) path: `<plan.md path above>`.

#### Spawn Sequence (just-in-time)

%% *Last Modified: 05/03/26 17:58:11* %%

```
Spawn coder (sonnet)        → Phase 0 (Baseline)
Spawn coder (sonnet, fresh) → Phase 1 (Adversarial Fixtures + Sweep)
Spawn coder (sonnet, fresh) → Phase 2 (D2 Residual Scanner TDD)
Spawn code-reviewer (opus)  → Review Gate 1 [shut down after verdict]
Spawn coder (sonnet, fresh) → Phase 3A (Types + getLinkClass)
Spawn coder (sonnet, fresh) → Phase 3B (D3 Coverage Output + Type-I) — LARGEST PHASE, monitor context
Spawn code-reviewer (opus)  → Review Gate 2 [shut down after verdict]
Spawn coder (sonnet, fresh) → Phase 4 (D4 Levenshtein TDD)
Spawn coder (sonnet, fresh) → Phase 5 (D5 Doc Alignment)
Spawn code-reviewer (opus)  → FINAL REVIEW GATE — BI/CI Coverage
Spawn application-tech-lead → ARCHITECT GATE
```

#### Message Routing

%% *Last Modified: 05/03/26 17:58:11* %%

```
Coder phase complete         → unblock next phase OR review gate
Reviewer Gate 1/2:
  PASS                       → unblock next phase
  FAIL                       → escalation loop (Tier 1 → Tier 2 → Tier 3)
Reviewer Final Gate (5.R):
  PASS                       → unblock Architect Gate
  FAIL                       → escalation loop
Architect Gate (5.A):
  PASS                       → shutdown sequence
  FAIL                       → escalation loop (architectural fixes routed to coder)
```

#### Shutdown Sequence

%% *Last Modified: 05/03/26 17:58:11* %%

```
1. Confirm 5.R PASS + 5.A PASS verdicts recorded in plan
2. SendMessage type: shutdown_request → any active coder
3. SendMessage type: shutdown_request → any active reviewer
4. SendMessage type: shutdown_request → architect
5. Report to user: final commit SHA, BI coverage table, CI coverage table, architect verdict
```

#### Orchestrator Anti-Patterns

%% *Last Modified: 05/03/26 17:58:11* %%

- Do NOT read source files after spawning agents
- Do NOT run git commands (diff, add, commit, status) — agents handle their own commits
- Do NOT arbitrate reviewer findings by reading code — route conflicts back to reviewer
- Do NOT fix "trivial" issues directly — delegate everything
- Do NOT spawn the next-phase coder until current phase commit hash is recorded in plan
- Do NOT skip the Architect Gate even if Final Review PASSES — they verify orthogonal properties

