%% hardening: exempt-defer-language — pre-pipeline-lock baseline %%

# Plan 01: Spike — Wikilink Grammar + Page-Name Resolution

%% *Last Modified: 05/02/26 13:39:00* %%

## Context

%% *Last Modified: 05/02/26 13:39:00* %%

**Goal:** Land the minimal D1 grammar function + D4 `resolveWikiPath` + `pageNameToSlug`. **Hard gate:** ≥80% resolution rate against the baseline file's 8 unique wiki page names. Falsification escalates to a revised D4 design (vault title-index work).

**Why this spike, not a full implementation:** Per `[H-D4-slug]` the slug-normalization hypothesis is still **OPEN**. Until we measure resolution rate against real data, the rest of the Delta (D2 residual scanner, D3 coverage qualifier, D5 docs alignment) is downstream of an unverified resolver. Spike first; build the rest only after the gate clears.

**Traceability links:**
- [Design §2 Context](./plan.md#2.%20Context) — problem statement (silent-failure on `[[wikilinks]]` in Obsidian vaults)
- [Design §7b D1 — Consolidated Wikilink Grammar](./plan.md#D1%20—%20Consolidated%20Wikilink%20Grammar) — single-regex grammar spec covering all 10 forms; `[H-D1-regex]` resolved
- [Design §7b D4 — Wiki Page Name Resolution via FileCache](./plan.md#D4%20—%20Wiki%20Page%20Name%20Resolution%20via%20FileCache) — two-step resolver design (`resolveFile(raw)` → `resolveFile(slug + ".md")`)
- [Design §7b ^H-D4-slug](./plan.md#^H-D4-slug) — hypothesis under test (≥80% resolution rate via slug normalization)

**Domain Vocabulary** (per [Design Domain Vocabulary](./plan.md#Domain%20Vocabulary)): Wikilink, Wiki vault, Silent failure, Block anchor — see design plan for full table.

**Type I/II posture** (per [Design Type I/II Decision Guide](./plan.md#Type%20I/II%20Decision%20Guide)): the spike is Type II (reversible — code lives behind D1's new function and a new D4 module; can be deleted if gate fails). The `manager.validate()` return-shape change is **deferred to plan-03 (D3)** — not in scope here.

---

## Baseline Tracing Guide (for dev agent)

%% *Last Modified: 05/02/26 13:39:00* %%

### Folder map

%% *Last Modified: 05/02/26 13:39:00* %%

```text
src/
  core/
    MarkdownParser/
      extractLinks.ts          ← MODIFIED — replace 2 wiki extractors (lines 417-499) with single dispatcher
      createLinkObject.ts      ← MODIFIED — call resolveWikiPath() for wiki bare-page-name case (lines 28-30)
      resolveWikiPath.ts       ← ADDED — sibling to resolvePath.ts; two-step resolver
      resolvePath.ts           ← UNTOUCHED — non-wiki path computation, keep pure
  utils/
    wikiPageSlug.ts            ← ADDED — pageNameToSlug(s: string): string
    stringDistance.ts          ← UNTOUCHED — Levenshtein helper (used in plan-04 D4-suggestion only)
  FileCache.ts                 ← UNTOUCHED — reused as injected dependency
  CitationValidator.ts         ← UNTOUCHED in this spike — validator routing already live (lines 312-319)
  types/
    citationTypes.ts           ← UNTOUCHED — `linkType: "wiki"` discriminator already exists
test/
  unit/
    core/MarkdownParser/
      extractWikilinks.test.ts ← ADDED — D1 grammar coverage (10 forms + baseline file fixture)
      resolveWikiPath.test.ts  ← ADDED — D4 two-step resolver
    utils/
      wikiPageSlug.test.ts     ← ADDED — pageNameToSlug rules
  fixtures/
    wikilink-baseline/         ← ADDED — copy of probabilistic-vs-deterministic-systems.md + target wiki/ files
```

### Key files to read (in order)

%% *Last Modified: 05/02/26 13:39:00* %%

1. **`src/core/MarkdownParser/extractLinks.ts:417-499`** [^S-D1a] [^S-D1b] — the two narrow regex extractors being replaced. Read first to understand the partition the new `extractWikilinks` collapses.
2. **`src/core/MarkdownParser/createLinkObject.ts:28-30`** [^S-D4a] — the unconditional `resolvePath` call site that needs the wiki-bare-page-name branch.
3. **`src/core/MarkdownParser/resolvePath.ts`** — sibling module pattern that `resolveWikiPath.ts` mirrors (same export shape, same I/O posture, same test layout).
4. **`src/FileCache.ts:167`** [^S-D4b] — `resolveFile(filename: string): ResolveResult` signature. Confirm `ResolveResult` shape (`{ found, path?, reason?, ... }`) before sketching the resolver wrapper.
5. **`0-documents/llm-wiki/wiki/concepts/probabilistic-vs-deterministic-systems.md`** — the baseline file. 11 wikilink occurrences across 8 unique page names; copy to `test/fixtures/wikilink-baseline/` for the gate test.

### LSP commands to run before coding

%% *Last Modified: 05/02/26 13:39:00* %%

```text
# Confirm callers of the 2 wiki extractors being deleted
LSP findReferences: extractLinks.ts:420 (extractWikiCrossDocLinks)
LSP findReferences: extractLinks.ts:463 (extractWikiInternalLinks)

# Confirm createLinkObject callers — branch addition must not break factories upstream
LSP findReferences: createLinkObject.ts (createLinkObject)

# Confirm FileCache.resolveFile shape and existing callers (sanity-check ResolveResult ergonomics)
LSP documentSymbol: src/FileCache.ts
LSP findReferences: FileCache.ts:167 (resolveFile)

# Confirm LinkObject type still has `linkType: "wiki"` (no shape change needed per D1 OBS)
LSP documentSymbol: src/types/citationTypes.ts
```

---

## Tech Debt

%% *Last Modified: 05/02/26 13:39:00* %%

LSP audit of all in-scope files (ADDED + MODIFIED + their callees). Run before writing implementation.
**Scope rule:** fix tech debt in any file this PR touches — no "out of scope" exceptions.

### Fix Required

%% *Last Modified: 05/02/26 14:20:36* %%

**No diagnostics found — N/A.** `tsc --noEmit` clean; all imports in both in-scope files are actively used; no dead JSDoc cross-refs. No fixes required in Phase 1.

---

## File Changes

%% *Last Modified: 05/02/26 13:39:00* %%

### ADDED

%% *Last Modified: 05/02/26 13:39:00* %%

#### `src/utils/wikiPageSlug.ts`

%% *Last Modified: 05/02/26 13:39:00* %%

```typescript
// Per D4 (c). Pure function; no I/O.
// Rule: lowercase → replace whitespace runs with `-` → strip non-[a-z0-9\-_] → collapse repeated `-`.
// Examples (from baseline file):
//   "The Hardening Principle" → "the-hardening-principle"
//   "Hardening Principle — Open Questions Research" → "hardening-principle-open-questions-research"
//   "The Hardening Principle (concept)" → "the-hardening-principle-concept"  (known MVP miss — see D4 limitation note)
export function pageNameToSlug(pageName: string): string;
```

#### `src/core/MarkdownParser/resolveWikiPath.ts`

%% *Last Modified: 05/02/26 13:39:00* %%

```typescript
// Per D4 (a). Sibling to resolvePath.ts. FileCache stays as injected dependency
// (per [H-D4-factory] resolution — keeps createLinkObject.ts pure).
import type { FileCache } from "../../FileCache.js";

// Per §7a.3 Data Shape Deltas — return shape carries both attempted forms
// so the validator's broken-link reason can list them: "tried: <raw>, <slug>.md".
export type ResolvedPath =
  | { resolved: true; absolutePath: string }
  | { resolved: false; attempted: [rawPath: string, slugPath: string] };

// Two-step lookup:
//   (1) FileCache.resolveFile(rawPath)              — handles [[the-hardening-principle]] / [[the-hardening-principle.md]]
//   (2) on miss, FileCache.resolveFile(slug + ".md") — handles [[The Hardening Principle]]
//   (3) on miss in both: { resolved: false, attempted: [raw, slug + ".md"] }
// Note: Levenshtein suggestion path (D4 (e), [GAP-7]/[GAP-8]) is OUT OF SCOPE for this spike;
// it ships in plan-04 once the gate passes.
export function resolveWikiPath(
  rawPath: string,
  sourceAbsolutePath: string,
  fileCache: FileCache,
): ResolvedPath;
```

#### `src/core/MarkdownParser/extractWikilinks.ts` _(new — extracted from extractLinks.ts per D1)_

%% *Last Modified: 05/02/26 13:39:00* %%

```typescript
// Per D1. Single grammar function replaces extractWikiCrossDocLinks + extractWikiInternalLinks.
// One-invariant-one-place: "what counts as a wikilink" lives only here.
import type { LinkObject } from "../../types/citationTypes.js";

// Regex per [H-D1-regex] resolution evidence — verified against baseline file (all 11 occurrences captured):
//   /\[\[([^\|\]#]+)(?:#([^\|\]]+))?(?:\|([^\]]+))?\]\]/g
//     group 1: target (page name or anchor)
//     group 2: optional #section
//     group 3: optional |display
// Covers all 10 forms: [[Page]], [[Page|Display]], [[Page.md]], [[Page.md|Display]],
// [[Page#section]], [[Page#section|Display]], [[Page.md#section]], [[Page.md#section|Display]],
// [[#anchor]], [[#anchor|Display]]. Display defaults to raw target when omitted.
//
// Each match emits LinkObject with `linkType: "wiki"` (already a valid discriminator value
// per OBS-D1a — validator routing live at CitationValidator.ts:312-319).
export function extractWikilinks(
  source: string,
  sourceAbsolutePath: string,
): LinkObject[];
```

#### `test/unit/utils/wikiPageSlug.test.ts`

%% *Last Modified: 05/02/26 13:42:58* %%

```typescript
// Test assertions:
// 1. lowercase + whitespace → hyphen     — "The Hardening Principle" → "the-hardening-principle"
// 2. em dash stripped                    — "Foo — Bar" → "foo-bar"
// 3. parentheses stripped                — "Page (concept)" → "page-concept"
// 4. repeated hyphens collapsed          — "A  -  B" → "a-b"
// 5. underscore preserved                — "snake_case_page" → "snake_case_page"
// 6. unicode/non-ASCII letters stripped  — confirm rule with negate-first probe before locking
//
// BDD — baseline page name coverage ([H-D4-slug] verification inputs):
//
// Given: pageName = "The Hardening Principle"
// When:  pageNameToSlug(pageName)
// Then:  "the-hardening-principle"
//
// Given: pageName = "Hardening Principle — Open Questions Research"
// When:  pageNameToSlug(pageName)
// Then:  "hardening-principle-open-questions-research"
//        (em dash stripped as non-[a-z0-9\-_] after whitespace collapse; no double hyphen)
//
// Given: pageName = "The Hardening Principle (concept)"
// When:  pageNameToSlug(pageName)
// Then:  "the-hardening-principle-concept"
//        [H-D4-slug] known MVP miss — resolveWikiPath will not find this slug in fixture vault;
//        slug must be deterministic so loud-fail carries the correct attempted[] value
//
// Given: pageName = "Silent Failure"
// When:  pageNameToSlug(pageName)
// Then:  "silent-failure"
//
// Given: pageName = "Building Effective Agents"
// When:  pageNameToSlug(pageName)
// Then:  "building-effective-agents"
```

#### `test/unit/core/MarkdownParser/resolveWikiPath.test.ts`

%% *Last Modified: 05/02/26 13:43:16* %%

```typescript
// makeTestFileCache: stub FileCache with seeded entries map
//   "the-hardening-principle.md" → "/vault/wiki/concepts/the-hardening-principle.md"
//   "silent-failure.md"          → "/vault/wiki/concepts/silent-failure.md"
//
// Test assertions:
// 1. exact filename hit            — rawPath="the-hardening-principle"     → { resolved: true, absolutePath: "..." }
// 2. exact filename hit (with .md) — rawPath="the-hardening-principle.md"  → { resolved: true, ... }
// 3. slug-normalization hit        — rawPath="The Hardening Principle"     → { resolved: true, absolutePath: ".../the-hardening-principle.md" }
// 4. miss in both                  — rawPath="Nonexistent Page"            → { resolved: false, attempted: ["Nonexistent Page", "nonexistent-page.md"] }
// 5. attempted[] order             — first element = raw, second element = slug + ".md"  (validator depends on this)
//
// BDD — [H-D4-slug] spike acceptance gate (≥80% of 8 unique baseline page names):
//
// Given: fileCache seeded with 6 fixture files:
//        "the-hardening-principle.md", "silent-failure.md", "separation-of-concerns.md",
//        "determinism.md", "building-effective-agents.md",
//        "hardening-principle-open-questions-research.md"
// When:  resolveWikiPath called for each of the 8 unique page names in the baseline file
// Then:  ≥7 of 8 return { resolved: true }   — gate passes ≥80% threshold; no title-index needed
//
// Given: same fileCache (no "the-hardening-principle-concept.md" present)
// When:  resolveWikiPath("The Hardening Principle (concept)", srcPath, fileCache)
// Then:  { resolved: false, attempted: ["The Hardening Principle (concept)", "the-hardening-principle-concept.md"] }
//        known MVP miss — disambiguation suffix → loud-fail; attempted[] surfaced for validator reason
//
// Given: fileCache seeded with "the-hardening-principle.md" → absolutePath
// When:  resolveWikiPath("The Hardening Principle", srcPath, fileCache)
// Then:  step 1 miss (resolveFile("The Hardening Principle") → not found)
//        step 2 hit  (resolveFile("the-hardening-principle.md") → found)
//        { resolved: true, absolutePath: ".../the-hardening-principle.md" }
//        [H-D4-slug] slug normalization path confirmed
//
// Given: fileCache seeded with "hardening-principle-open-questions-research.md" → absolutePath
// When:  resolveWikiPath("Hardening Principle — Open Questions Research", srcPath, fileCache)
// Then:  { resolved: true, absolutePath: ".../hardening-principle-open-questions-research.md" }
//        em dash → hyphen slug matches fixture file (D4 + D1 grammar round-trip verified)
```

#### `test/unit/core/MarkdownParser/extractWikilinks.test.ts`

%% *Last Modified: 05/02/26 13:43:33* %%

```typescript
// Test assertions (D1 grammar coverage):
// 1. all 10 wikilink forms parsed                — table-driven, one row per form
// 2. baseline-file integration                   — 11 occurrences captured in probabilistic-vs-deterministic-systems.md
// 3. linkType="wiki" set on every result         — validator-routing seam preserved
// 4. display defaults to raw target when omitted — [[Page]] → display = "Page"
// 5. no false positives on residual brackets     — "[[malformed[[" returns 0 (residual scanner is D2 / plan-02 scope)
//
// BDD — [H-D1-regex] hypothesis verification:
//
// Given: source = "See [[The Hardening Principle]] for context."
// When:  extractWikilinks(source, srcPath)
// Then:  1 LinkObject; target="The Hardening Principle", display="The Hardening Principle", linkType="wiki"
//
// Given: source = "[[Page#section|Display Text]]"
// When:  extractWikilinks(source, srcPath)
// Then:  1 LinkObject; target="Page", section="section", display="Display Text", linkType="wiki"
//
// Given: source = "[[#anchor|Display]]"  (internal-anchor form, no page name)
// When:  extractWikilinks(source, srcPath)
// Then:  1 LinkObject; target="" or omitted, section="anchor", display="Display", linkType="wiki"
//        (D1 form 9/10 — grammar must not require a page-name prefix)
//
// Given: source = "[[The Hardening Principle (concept)]]"
// When:  extractWikilinks(source, srcPath)
// Then:  1 LinkObject; target="The Hardening Principle (concept)", linkType="wiki"
//        (grammar captures disambiguation suffix; resolution failure is D4 scope, not D1)
//
// Given: source = full content of probabilistic-vs-deterministic-systems.md fixture
// When:  extractWikilinks(source, srcPath)
// Then:  exactly 11 LinkObjects returned; 0 results for "[[malformed[["
//        [H-D1-regex] resolved — single regex captures all wikilink forms present in baseline file
```

#### `test/fixtures/wikilink-baseline/`

%% *Last Modified: 05/02/26 13:39:00* %%

```text
probabilistic-vs-deterministic-systems.md   ← copied from 0-documents/llm-wiki/wiki/concepts/
wiki/                                        ← minimal target file set covering the resolvable subset:
  the-hardening-principle.md
  silent-failure.md
  separation-of-concerns.md
  determinism.md
  building-effective-agents.md
  hardening-principle-open-questions-research.md
  (intentionally missing: any file matching "The Hardening Principle (concept)" disambiguation suffix —
   confirms loud-fail per D4 known limitation)
```

### MODIFIED

%% *Last Modified: 05/02/26 13:39:00* %%

#### `src/core/MarkdownParser/extractLinks.ts`

%% *Last Modified: 05/02/26 13:39:00* %%

```diff
- function extractWikiCrossDocLinks(...)   // lines 420-457 — narrow: requires .md AND |display
- function extractWikiInternalLinks(...)   // lines 463-499 — narrow: requires #anchor AND |display
+ // Wiki extraction now delegated to extractWikilinks (new sibling module, per D1).
+ // Top-level dispatcher imports and calls extractWikilinks(source, sourceAbsolutePath).
+ import { extractWikilinks } from "./extractWikilinks.js";
```
_Net: ~80 lines deleted, ~3 lines added (import + single call site). Caller graph confirmed via LSP findReferences before deletion._

#### `src/core/MarkdownParser/createLinkObject.ts`

%% *Last Modified: 05/02/26 13:39:00* %%

```diff
- // Currently (line 28-30): resolvePath(sourceDir, rawPath) called unconditionally.
+ // Wiki branch added per D4 (b):
+ //   if (linkType === "wiki" && !rawPath.includes("/")) {
+ //     resolved = resolveWikiPath(rawPath, sourceAbsolutePath, fileCache);
+ //   } else {
+ //     resolved = resolvePath(sourceDir, rawPath);  // unchanged
+ //   }
+ // FileCache injected as constructor dep (per [H-D4-factory] — module stays pure-construction
+ // factory; resolution strategy lives in resolveWikiPath.ts, not here).
```

### REMOVED

%% *Last Modified: 05/02/26 13:39:00* %%

- `extractWikiCrossDocLinks` and `extractWikiInternalLinks` function bodies in `extractLinks.ts:417-499` — replaced by D1 grammar function. Confirm zero external callers via LSP `findReferences` before deletion.

### RENAMED

%% *Last Modified: 05/02/26 13:39:00* %%

_(none)_

### UNTOUCHED

%% *Last Modified: 05/02/26 13:39:00* %%

- `src/CitationValidator.ts` — wiki routing already live (lines 312-319 per [^S-D1c]); spike adds no validator changes. D2 residual scanner + D3 coverage qualifier ship in later plans.
- `src/jact.ts` — `manager.validate()` return-shape change deferred to plan-03 (D3, GAP-6 — Type I).
- `src/types/citationTypes.ts` — `LinkObject.linkType: "wiki"` discriminator already exists; no shape change.
- `src/types/validationTypes.ts` — `UnrecognizedSyntaxRecord`, `LinkClass`, `byLinkClass`, etc. all belong to D2/D3 (later plans).
- `src/utils/stringDistance.ts` — Levenshtein helper exists; suggestion wiring is plan-04 (D4 (e), [GAP-7]/[GAP-8]).
- `jact/CLAUDE.md` and component guides — D5 docs alignment ships after grammar lands.

---

## Whiteboard Decision Coverage

%% *Last Modified: 05/02/26 13:39:00* %%

| Decision | How covered |
|----------|------------|
| [D1 Consolidated Wikilink Grammar](./plan.md#D1%20—%20Consolidated%20Wikilink%20Grammar) | New `extractWikilinks.ts` single-regex function; old 2 extractors removed from `extractLinks.ts:417-499` |
| [D4 Wiki Page Name Resolution](./plan.md#D4%20—%20Wiki%20Page%20Name%20Resolution%20via%20FileCache) | New `resolveWikiPath.ts` + `wikiPageSlug.ts`; `createLinkObject.ts` wires wiki branch |
| [^H-D1-regex](./plan.md#^H-D1-regex) (resolved) | Encoded as the regex in `extractWikilinks.ts`; baseline-file integration test asserts all 11 captures |
| [^H-D4-slug](./plan.md#^H-D4-slug) (open) | Verified by §Verification gate test — ≥80% resolution rate against 8 unique baseline page names |
| [^H-D4-factory](./plan.md#^H-D4-factory) (resolved) | `resolveWikiPath.ts` is a sibling module; `createLinkObject.ts` keeps pure-construction factory shape |
| Test scenario inventory | [Design §7g.2](./plan.md#7g.2%20Test%20Scenario) — 11 wikilinks, 8 unique page names, expected (1 filename / ~6 slug / ~4 broken / 1 unrecognized → out of spike scope) |

---

## Verification

%% *Last Modified: 05/02/26 13:39:00* %%

### Unit tests (TDD: RED → GREEN → refactor)

%% *Last Modified: 05/02/26 13:39:00* %%

```bash
# D1 grammar
npx vitest run test/unit/core/MarkdownParser/extractWikilinks.test.ts

# D4 resolver + slug
npx vitest run test/unit/core/MarkdownParser/resolveWikiPath.test.ts
npx vitest run test/unit/utils/wikiPageSlug.test.ts

# Full suite — no regressions in caret / markdown / cross-doc paths
npm test
```

### Spike acceptance gate ([^H-D4-slug] verification)

%% *Last Modified: 05/02/26 13:39:00* %%

```bash
# Build, then run validate against the baseline fixture
npm run build
jact validate /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/test/fixtures/wikilink-baseline/probabilistic-vs-deterministic-systems.md --format json --scope /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/test/fixtures/wikilink-baseline > /tmp/wikilink-baseline-result.json
```

**Pass criteria (HARD GATE — `[^H-D4-slug]`):**

| Metric | Threshold | Source |
|--------|-----------|--------|
| Wiki page names resolved | ≥ 80% of 8 unique = **≥7 of 8** | `[^H-D4-slug]` ≥80% threshold |
| Resolution path "exact filename" | ≥1 (proves FileCache reuse works) | Baseline: `the-hardening-principle` |
| Resolution path "slug normalization" | ≥6 (proves `pageNameToSlug` works) | Baseline: 6 Title Case names |
| Broken wikilinks reported with explicit reason | All misses carry `"tried: <raw>, <slug>.md"` | D4 (a)(3) loud-fail rule |

**Fail action:** if resolution rate < 80%, **stop the spike**. Open NBA item: "D4 needs vault title-index extension; revise design before plan-02." Do not proceed to plan-02 / plan-03 until the gate clears or the design is revised.

### Smoke test (manual sanity check)

%% *Last Modified: 05/02/26 13:39:00* %%

```bash
# Confirm minimal-mode CLI still prints sane output (no D2/D3 sections yet — those land later)
jact validate test/fixtures/wikilink-baseline/probabilistic-vs-deterministic-systems.md
# Expected: count of valid markdown + caret unchanged from pre-spike baseline;
# wiki count emerges (validator already routes them); broken wiki entries print with attempted-slug reason.
```

---

## Phased Task Sequence

%% *Last Modified: 05/02/26 14:10:51* %%

**Roles:**

| Role | Model | Agent |
|------|-------|-------|
| Orchestrator | opus | `orchestrator` — spawns/stops agents, routes messages, enforces escalation |
| Coder | sonnet | `coder` — fresh instance per phase |
| Code Reviewer | sonnet | `code-reviewer` (`.claude/agents/code-reviewer.md`) — logical code review at Phase 2 gate |
| Tech Lead Reviewer | opus | `application-tech-lead` (`.claude/agents/application-tech-lead.md`) — architecture principles + delta coverage at Phase 3 gate |
| Coder (escalated) | opus | `coder-opus` — spawned only via Tier 2 escalation |

**Plan file:** `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/features/202605020859-jact-wikilink-validation/plan-01-spike-wikilink-resolution.md`

**Escalation Policy:**
- Tier 1: Coder (sonnet) fixes reviewer findings → reviewer re-reviews
- Tier 2: Same errors persist → orchestrator spawns fresh coder (opus) → reviewer re-reviews
- Tier 3: Errors persist after opus attempt → HUMAN HARD GATE — execution halts

**Spawning Rules:**
- Agents spawn just-in-time — only when their task is unblocked or within 1 task of unblocking
- Fresh coder per phase — never reuse across phase boundaries
- Phases sized for 50–75% of context (~100–150K tokens). >15 tasks = split phase

### Phase 0 — Baseline `coder`

%% *Last Modified: 05/02/26 14:18:24* %%

- [x] **0.0** STATE-READ: `git rev-parse HEAD` → `baseline_hash: 2697731c5ac56ba3435db81f7bc29a3c084cc183`
- [x] **0.1** BASELINE: LSP findings recorded:
  - `findReferences` on `extractLinks.ts:420` (`extractWikiCrossDocLinks`) — **2 refs, 1 file** (definition:420, internal call:595). ZERO external callers ✓
  - `findReferences` on `extractLinks.ts:463` (`extractWikiInternalLinks`) — **2 refs, 1 file** (definition:463, internal call:598). ZERO external callers ✓
  - `findReferences` on `createLinkObject.ts:14` (`createLinkObject`) — **12 refs, 3 files**: definition in createLinkObject.ts; import+8 call sites in extractLinks.ts (lines 191, 264, 305, 351, 396, 439, 481, 527); import+1 call in MarkdownParser.ts:153
  - `documentSymbol` on `src/FileCache.ts` — `resolveFile` at line 167; `ResolveResult` = discriminated union from `src/types/fileCacheTypes.ts`: success `{found:true, path:string, fuzzyMatch?:boolean, correctedFilename?:string, message?:string}` / failure `{found:false, reason:"duplicate"|"not_found"|"duplicate_fuzzy", message:string, candidates?:string[], scope?:ScopeResolution, nearMisses?:string[]}`
  - `findReferences` on `FileCache.ts:167` (`resolveFile`) — **2 refs, 2 files**: definition:167, 1 caller in jact.ts:195
  - `documentSymbol` on `src/types/citationTypes.ts` — `linkType: "markdown" | "wiki"` at line 29. Discriminator exists ✓
- [x] **0.2** BASELINE: All 5 key files read:
  1. `extractLinks.ts:417-499` — `extractWikiCrossDocLinks` regex `/\[\[([^#\]]+\.md)(#([^|]+?))?\|([^\]]+)\]\]/g` (requires .md extension + display text); `extractWikiInternalLinks` regex `/\[\[#([^|]+)\|([^\]]+)\]\]/g` (anchors only). Both call `createLinkObject`, push to `links[]`, are private to extractLinks.ts
  2. `createLinkObject.ts:28-30` — unconditional `resolvePath(params.rawPath, params.sourceAbsolutePath)` call; wiki branch will feed same call site
  3. `resolvePath.ts` — exports single `resolvePath(rawPath, sourceAbsolutePath): string|null`; handles `~/`, absolute, and relative paths. `resolveWikiPath.ts` mirrors this export shape
  4. `FileCache.ts:167` — `resolveFile(filename: string): ResolveResult`; 3-step: exact match → .md extension strip/add → fuzzy match → buildNotFoundFailure
  5. `probabilistic-vs-deterministic-systems.md` — confirmed **11 wikilink occurrences, 8 unique page names**: `the-hardening-principle` (piped), `The Hardening Principle (concept)` ×3, `The Hardening Principle` ×2, `Silent Failure`, `Separation of Concerns`, `Determinism`, `Building Effective Agents`, `Hardening Principle — Open Questions Research`
- [x] **0.3** BASELINE: `npm test` → **86 test files, 510 tests, ALL PASSING**. Zero pre-existing failures.
- [x] **0.S** STATE-WRITE: Complete — baseline_hash, LSP findings, file reads, test results recorded above
- [x] **0.C** COMMIT: No implementation changes. `end_hash: 2697731c5ac56ba3435db81f7bc29a3c084cc183` (equals baseline_hash — no changes committed)

### Phase 1 — Tech Debt `coder`

%% *Last Modified: 05/02/26 14:21:02* %%

- [x] **1.0** STATE-READ: `start_hash: 606e083411c0f80b8aa1e616921b0a88c9956d43`. Note: 2 docs-only commits landed after Phase 0 end_hash (`2697731`); `git diff 2697731..HEAD --name-only` confirms only plan file changed — source tree identical.
- [x] **1.1** BASELINE: LSP (tsc + manual import audit) on `extractLinks.ts` and `createLinkObject.ts`. All imports active; no dead JSDoc cross-refs; `tsc --noEmit` clean. Zero diagnostics found.
- [x] **1.2** FIX: N/A — zero diagnostics found. No changes required.
- [x] **1.3** VERIFY: `npm test` → **86 test files, 510 tests, ALL PASSING**.
- [x] **1.S** STATE-WRITE: Complete — diagnostics: zero; 1.2: N/A; test result: 510/510.
- [x] **1.C** COMMIT: No source changes — no commit. `end_hash: 606e083411c0f80b8aa1e616921b0a88c9956d43`.

### Phase 2 — Core Build (TDD) `coder`

%% *Last Modified: 05/02/26 14:34:09* %%

- [x] **2.0** STATE-READ: `git rev-parse HEAD` → `start_hash: 606e083411c0f80b8aa1e616921b0a88c9956d43`. Verified matches Phase 1 end_hash.
- [x] **2.1** IMPLEMENT: Fixtures created. `probabilistic-vs-deterministic-systems.md` copied; `wiki/` subdirectory created with 6 stub files. `the-hardening-principle-concept.md` intentionally omitted.
- [x] **2.2** RED: `test/unit/utils/wikiPageSlug.test.ts` written (7 unit + 5 BDD = 12 assertions). Confirmed FAIL — module not found.
- [x] **2.3** GREEN: `src/utils/wikiPageSlug.ts` implemented — 4-rule pipeline with named regex constants. 12/12 passing.
- [x] **2.4** RED: `test/unit/core/MarkdownParser/extractWikilinks.test.ts` written (10-form table + 4 BDD + integration + linkType + display + malformed = 18 assertions). Confirmed FAIL — module not found.
- [x] **2.5** GREEN: `src/core/MarkdownParser/extractWikilinks.ts` implemented — group-1-optional regex, line-by-line iteration, named constant + JSDoc. 18/18 passing. NOTE: used optional group 1 `([^\|\]#]+)?` per team-lead instruction (overrides plan code listing) to handle `[[#anchor]]` form 9/10 correctly.
- [x] **2.6** RED: `test/unit/core/MarkdownParser/resolveWikiPath.test.ts` written (5 unit + 4 BDD = 9 assertions). Confirmed FAIL — module not found.
- [x] **2.7** GREEN: `src/core/MarkdownParser/resolveWikiPath.ts` implemented — `ResolvedPath` discriminated union, two-step resolver, `import type { FileCache }` (never direct class import). 9/9 passing. Spike gate: 7/8 resolved (87.5% ≥ 80% threshold).
- [x] **2.8** VERIFY: `npm test` → 89 files, 549/549 passing (prior: 510). Zero regressions.
- [x] **2.S** STATE-WRITE: Complete. 39 new tests added. One noted deviation: group-1 regex optional per team-lead override. All gates pass.
- [x] **2.C** COMMIT: Plan checkpoint committed. Source files landed in parallel commit `458cd4a`; plan checkboxes in `3a250a3`. `end_hash: 3a250a36da8d0c0e2ccf7cfae2313db4d5ac1b4e`

#### REVIEW GATE 1 — `code-reviewer`

%% *Last Modified: 05/02/26 14:10:03* %%

- [x] **2.R** REVIEW: Read plan file + `git diff <Phase_1.C_end_hash>..HEAD`. Scope — `src/utils/wikiPageSlug.ts`, `src/core/MarkdownParser/extractWikilinks.ts`, `src/core/MarkdownParser/resolveWikiPath.ts`, plus all 3 test files and `test/fixtures/wikilink-baseline/`.
  - Verify: D1 regex covers all 10 wikilink forms — no narrowing (`|display` NOT required, `.md` NOT required, `#anchor` optional, internal `[[#anchor]]` form works without page prefix)
  - Verify: `ResolvedPath.attempted[]` order is `[rawPath, slugPath]` — validator error message depends on this order
  - Verify: `pageNameToSlug` handles em dash correctly (stripped as non-`[a-z0-9\-_]` after whitespace collapse — no double hyphen artifact)
  - Verify: `resolveWikiPath.ts` imports `pageNameToSlug` from `"../../utils/wikiPageSlug.js"` (ESM `.js` extension required by NodeNext)
  - Verify: `FileCache` stays as injected parameter — NOT imported directly in `resolveWikiPath.ts` (per `[H-D4-factory]`)
  - Verify: TypeScript strict compliance — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` honored on all new files
  - Verify: Test coverage matches plan assertion counts (7 slug assertions, 5+4 grammar, 5+4 resolver)
  - **Verdict:** SHIP → proceed to Phase 3. NO-SHIP → escalation policy applies.

### Phase 3 — Wiring + Integration `coder`

%% *Last Modified: 05/02/26 15:20:01* %%

- [x] **3.0** STATE-READ: `git rev-parse HEAD` → `start_hash: 7b50a40c3fcfb6a08ed685a6ac5fc6ffdad536b4`. Verified matches Phase 2 end_hash.
- [x] **3.1** UPDATE: Modify `src/core/MarkdownParser/extractLinks.ts` — added import, replaced two per-line calls with single `links.push(...extractWikilinks(content, sourceAbsolutePath))` (placed before the forEach loop), removed both function bodies. Net: ~92 lines removed, ~3 added. Deviation from plan: call placed before forEach (not inline), because `extractWikilinks` takes full source string, not per-line.
- [x] **3.2** UPDATE: Modify `src/core/MarkdownParser/createLinkObject.ts` — added `import type { FileCache }` + `import { resolveWikiPath }`, added `fileCache?: FileCache` as optional param, added wiki branch normalizing `ResolvedPath` → `string | null` via minimal adapter (`wikiResolved.resolved ? wikiResolved.absolutePath : null`). `fileCache` is injected via params (not imported at module level) per `[H-D4-factory]`. Deviation: `resolvePath` arg order corrected to `(rawPath, sourceAbsolutePath)` — plan pseudocode had args reversed.
- [x] **3.3** VERIFY: `npx tsc --noEmit` — clean, zero type errors.
- [x] **3.4** VERIFY: `npm test` — 549/549 passed (89 test files), zero regressions.
- [x] **3.S** STATE-WRITE: Checkboxes updated above.
- [x] **3.C** COMMIT: Commit Phase 3 — "feat(wikilink): wire D1 grammar dispatcher + D4 wiki branch into extractLinks + createLinkObject". `git rev-parse HEAD` → `end_hash: 394351e415ea217ecf122aed7cc60a61f5f987eb`.
- [x] **3.R1** FIX (post-gate regression): Review Gate 2 (`application-tech-lead`) surfaced silent-failure bug — `fileCache` was OPTIONAL in `createLinkObject` but never injected in production; wiki resolution branch was dead code. Fix applied across 3 additional commits (`0b0d3ae`, `75973aa`, `91fe098`):
  - Made `fileCache` REQUIRED end-to-end: `extractWikilinks` → `extractLinks` → `createLinkObject`
  - Added `setFileCache`/`syncParserFileCache` delegation chain so factory shares scope-seeded FileCache with parser
  - Added `instanceof ParsedFileCache` guard in `createCitationValidator` for test safety
  - Added `!rawPath.endsWith(".md")` to wiki resolution condition to prevent regression on `[[file.md#section]]` links
  - Added `detectExtractionMarker` call in `extractWikilinks` (was hardcoded `null`)
  - Added integration test (`extractLinks-wikilink-pipeline.test.ts`) as regression guard
  - Updated `enhanced-citations.test.js`: directory-link assertion corrected to `'warning'` (CitationValidator design; old regex never matched `../` paths)
  - `git rev-parse HEAD` → `end_hash: 91fe098c85489f85d2d8559bd01ad4830394fbd7`
  - `npm test` → 551/551 passing. Smoke: 8/11 wiki links resolved with `--scope` flag.

#### REVIEW GATE 2 — `application-tech-lead`

%% *Last Modified: 05/02/26 14:10:03* %%

- [x] **3.R** REVIEW: Read plan file + `git diff <baseline_hash>..HEAD` (full spike delta — all ADDED + MODIFIED files). Run `evaluate-against-architecture-principles` skill against ALL 9 principle categories. Evaluate ideal outcome delta coverage (D1 + D4 hypothesis gates).
  - Verify architecture principles (ALL 9): Modular Design, Data-First Design, Action-Based File Organization, Format/Interface Design, MVP Principles, Deterministic Offloading, Self-Contained Naming, Safety-First Design, Anti-Patterns
  - Verify D1 coverage: single `extractWikilinks` grammar function exists; old `extractWikiCrossDocLinks`/`extractWikiInternalLinks` removed; one-invariant-one-place rule enforced
  - Verify D4 coverage: `resolveWikiPath.ts` is a sibling to `resolvePath.ts` (same export shape, same I/O posture); two-step resolver implemented; `[H-D4-factory]` honored
  - Verify component boundary: `MarkdownParser` has no direct import of `CitationValidator` — no cross-component coupling introduced
  - Verify scope containment: D2 (residual scanner), D3 (coverage qualifier), D5 (docs alignment) are NOT present in any modified file
  - Verify deferral integrity: `src/jact.ts` and `manager.validate()` return shape are untouched — D3 deferred to plan-03 as intended
  - **Verdict:** SHIP → proceed to Phase 4. NO-SHIP → escalation policy applies.

### Phase 4 — Verification `coder`

%% *Last Modified: 05/02/26 15:33:26* %%

- [x] **4.0** STATE-READ: `git rev-parse HEAD` → `start_hash: 465f3be8fd7ecbfb6d8fcffea452f72dc8408e8e`. Note: HEAD is one commit past Phase 3 end_hash (91fe098) — commit `465f3be` is a docs-only plan update from Review Gate 2; no code changes. Applied R1 polish suggestions 1–3 before running suites (see below).
- [x] **4.1** SUITE: `npx vitest run test/unit/utils/wikiPageSlug.test.ts` — **12/12 PASS**
- [x] **4.2** SUITE: `npx vitest run test/unit/core/MarkdownParser/extractWikilinks.test.ts` — **18/18 PASS**
- [x] **4.3** SUITE: `npx vitest run test/unit/core/MarkdownParser/resolveWikiPath.test.ts` — **9/9 PASS**
- [x] **4.4** SUITE: `npm test` — **551/551 passing across 90 test files**
- [x] **4.5** SMOKE: `npm run build` — **clean, no emit errors**
- [x] **4.6** SMOKE: CLI acceptance gate run; output saved to `/tmp/wikilink-baseline-result.json` (exit 1 expected — broken citations present)
- [x] **4.7** ASSERT: Parsed `/tmp/wikilink-baseline-result.json`. Hard-gate metrics:
  - **Metric 1:** 7/8 unique wiki page names `{ target.path.absolute != null }` = **87.5% ✅ PASS** (gate threshold ≥80%)
  - **Metric 2:** 1 resolved via exact filename (`the-hardening-principle` slug form → FileCache Step 1) ✅
  - **Metric 3:** 6 resolved via slug normalization (Title Case + em-dash forms → `pageNameToSlug` Step 2) ✅
  - **Metric 4:** PARTIAL — miss carries "Tried: /abs/path/The Hardening Principle (concept)" (raw form only); slug form (`the-hardening-principle-concept.md`) not shown. `resolveWikiPath` correctly returns `attempted: [rawPath, slugPath]` but CitationValidator's `resolveTargetPath` discards the slug trail in its error message. Follow-up in plan-02.
  - **⚠️ HARD GATE — `[H-D4-slug]`: PASS** (87.5% ≥ 80%)
  - **VALIDATION WIRING GAP (plan-02 follow-up):** Parser-level resolution (7/8 unique names, abs_path set) is correct. However, `CitationValidator.resolveTargetPath` does NOT consume pre-resolved `target.path.absolute` — it re-resolves from scratch using raw path only, causing 6 correctly-resolved slugged pages to show as validation errors. CLI smoke: 1 warning (FileCache cross-dir hit for `the-hardening-principle`) + 10 errors (3 expected concept misses + 7 validator-resolution failures). Fix in plan-02: thread pre-resolved absolute path through `validateCrossDocumentLink` or add slug normalization to `resolveTargetPath`.
- [x] **4.8** SMOKE: CLI output confirmed — wiki count visible (11 wiki links in output); broken wiki entries show "Tried: /path/..." reason; markdown + caret counts unchanged from pre-spike baseline (42 non-wiki citations); no D2/D3 sections present
- [x] **4.S** STATE-WRITE: Checkboxes updated. Gate verdict: **`[H-D4-slug]` PASS at 87.5%** (7/8 unique page names resolved at parser level). Deviations noted: validation wiring gap and metric 4 partial.
- [x] **4.C** COMMIT: R1 polish suggestions applied (3 files changed). `end_hash: see commit SHA in section below`

**R1 Polish Applied:**
- Suggestion 1 ✅: Added `// defensive — some test scenarios stub ParsedFileCache without syncParserFileCache` at `componentFactory.ts:83`
- Suggestion 2 ✅: Added D1 grammar change comment near `warning` expectation in `enhanced-citations.test.js`
- Suggestion 3 ✅: Strengthened Test 1 in `extractLinks-wikilink-pipeline.test.ts` to assert `l.target.path.absolute` ends with `.md` (using `for...of` per Biome lint rule)
- Suggestions 4 & 5: Skipped (out of Phase 4 scope per instructions)

### Phase 5 — Code-Block Exclusion Regression Fix `coder`

%% *Last Modified: 05/02/26 19:43:47* %%

- [x] **5.0** STATE-READ: `git rev-parse HEAD` → `start_hash: b6c725de2eadf309c8e37c9280e003ad37b425ca`. Note: HEAD is one commit past Phase 4 polish end_hash (`04a3592`); commit `b6c725d` is a docs-only Phase 5 plan expansion — no code changes. Phase 4 verdict: `[H-D4-slug]` PASS at 87.5%; validator-resolution wiring gap deferred to plan-02.
- [x] **5.1** BASELINE — Regression confirmed via PostToolUse validator hook on the plan file: **16 false-positive errors**. Breakdown: 15 errors on wikilinks inside fenced code blocks (typescript example blocks at lines 144-145, 170-171, 273, 278, 282, 291) + 1 error on line 604 inside inline backticks (`[[fake-in-tilde-block]]` — likely a separate inline-code detector quirk on lines with literal triple-backtick spans; in scope only insofar as the Phase 5 fix removes the fenced-block subset).
- [x] **5.2** RED — Added 2 failing tests to `test/unit/core/MarkdownParser/extractWikilinks.test.ts` under `describe("extractWikilinks — fenced code block exclusion (CommonMark fences)")`: (1) source with `[[real-link]]` outside fences + `[[fake-in-backtick-block]]` inside ` ``` ` + `[[fake-in-tilde-block]]` inside `~~~` → expects 1 (real-link), got 3. (2) lang-tagged backtick fence (` ```typescript `) test. RED confirmed: 1 failed (length 3 ≠ 1).
- [x] **5.3** GREEN — Created `src/core/MarkdownParser/isInsideCodeBlock.ts` (sibling to `isInsideInlineCode.ts`) exporting `isInsideCodeBlock(source, lineIndex)` + workhorse `getFencedCodeBlockLineSet(source)`. Tracks both ` ``` ` and `~~~` fences with type-matched closers (backtick→backtick, tilde→tilde) per CommonMark §4.5; opener/closer fence lines are NOT inside. Wired into `extractWikilinks` via single hoisted set lookup before per-line scan. 20/20 tests pass.
- [x] **5.4** VERIFY — `jact validate` on plan-01 with `--scope` set to repo root: errors dropped from **16 → 1**. All 15 fenced-code-block false positives eliminated. Remaining 1 (line 604, `[[fake-in-tilde-block]]` in inline backticks on a line containing literal ` ``` `) is an `isInsideInlineCode` parity quirk — separate bug, out of Phase 5 scope.
- [x] **5.5** VERIFY — `npm test` → **553/553 passing across 90 test files** (was 551/551; +2 new tests).
- [x] **5.6** VERIFY — `npm run build` → clean, no emit errors.
- [x] **5.S** STATE-WRITE: Checkboxes 5.0–5.6 updated. Before: 16 fenced-block FPs. After: 0 fenced-block FPs (1 unrelated inline-code FP remains, deferred). New helper: `isInsideCodeBlock.ts`. Tests added: 2.
- [x] **5.C** COMMIT: Committed as `fix(wikilink): exclude fenced code blocks from extractWikilinks (D1 invariant fix)`. `end_hash: c72a1b8273935eaa5d73b8392784c8d2e3cd63cd`.

#### REVIEW GATE 3 — `application-tech-lead` (opus, full BI coverage)

%% *Last Modified: 05/02/26 15:47:28* %%

- [ ] **5.R** REVIEW: Read plan + `git diff <baseline_hash>..HEAD` (entire spike from start to Phase 5 end). Run `evaluate-against-architecture-principles` skill against ALL 9 principle categories. **NEW SCOPE:** Verify the entire spike implementation satisfies ALL Baseline Ideal Outcomes BI 1 through BI 7 from `plan.md`, with explicit per-BI evidence. Service-level parity (BI 7) is the gating addition.
  - For each BI 1-7: state PASS/FAIL with concrete code/test evidence
  - For BI 7 specifically, evaluate against `[markdown](links)` baseline behavior:
    - False-positive rate parity (e.g., code-block content not flagged — Phase 5 fix)
    - False-negative rate parity (e.g., neither silently skipped — Round 1 fix)
    - Loud-fail parity on broken links (e.g., `tried: ...` reasons surfaced)
    - Validator integration parity (e.g., pre-resolved paths consumed — note Plan-02 follow-up if validator wiring still incomplete)
  - **Verdict:** SHIP → spike fully complete. NO-SHIP → escalation loop applies.

### Phase 6 — Residuals Cleanup (NO TECH DEBT) `coder`

%% *Last Modified: 05/02/26 20:12:22* %%

**Why Phase 6 exists:** Gate 3 surfaced 4 residuals. Per TECH DEBT POLICY: never defer, never carry forward. Plan-02 must be self-contained — zero open issues from this spike. All 4 fixed here.

- [x] **6.0** STATE-READ: `git rev-parse HEAD` → `start_hash: ddb123634035030d614f368e95021bf3fd5210e3`. Phase 5 fix landed (`c72a1b8`); plan checkpoint past (`d884302`). Baseline `npm test`: 553/553 passing across 90 test files.
- [x] **6.1** ITEM 3 — Consolidated. Deleted `extractLinks.ts:75-102 getCodeBlockLines` (1-based, no fence-type tracking). Replaced caller with `getFencedCodeBlockLineSet` from `isInsideCodeBlock.ts` (0-based, CommonMark-§4.5 fence-typed). RED→GREEN test added at `test/unit/extractLinks-fenced-exclusion.test.ts` (2 cases: `[cite:](url)` and `^FR1` inside backtick & tilde fences). One-invariant-one-place restored.
- [x] **6.2** ITEM 4 — Inline-code parity fixed. Rewrote `src/core/MarkdownParser/isInsideInlineCode.ts` per CommonMark §6.1: collect all backtick runs on the line, greedy-pair openers with matching N-length closers; unmatched runs (e.g. literal ` ``` `) treated as content. RED test at `test/unit/core/MarkdownParser/isInsideInlineCode.test.ts` (5 cases including the plan-01:604 mixed-line scenario). All wikilinks on line 604 now correctly classified inside inline code.
- [x] **6.3** ITEM 1 — Validator wiring fixed. Added wiki success fast-path at top of `validateCrossDocumentLink`: when `linkType === "wiki"` AND `target.path.absolute !== null` AND `isFile(absolute)`, use it directly (anchor still validated if present). RED test in `test/integration/citation-validator-wiki-pre-resolved.test.ts` (Item 6.3 case: pre-populated abs path, empty FileCache, returns "valid"). BI-7 validator-integration parity restored at SERVICE level.
- [x] **6.4** ITEM 2 — Loud-fail wiring complete. Added `attempted?: readonly string[]` to `LinkObject.target.path` (citationTypes.ts). `createLinkObject` populates it from `resolveWikiPath`'s `{ resolved: false, attempted }` branch. Validator's wiki fail-loud branch returns `error: "Wiki page not found: <raw>"` + `suggestion: "Tried: <raw>, <slug>.md"`. RED test in same integration file (Item 6.4 case): asserts both substrings in combined error+suggestion. BI-7 loud-fail parity restored at SERVICE level.
- [x] **6.5** VERIFY — Plan-01 file: `jact validate <plan-01>` → **`OK: 30 citations valid`** (0 false positives, 0 errors). 16 → 0 across Phase 5 + Phase 6.
- [x] **6.6** VERIFY — Acceptance gate fixture: 53 total citations · 50 valid · 3 errors · 0 warnings. Wiki: 11 occurrences across 8 unique page names. **7/8 unique names VALID from validator** (the-hardening-principle, The Hardening Principle, Silent Failure, Separation of Concerns, Determinism, Building Effective Agents, Hardening Principle — Open Questions Research). 1 known miss `The Hardening Principle (concept)` (3 occurrences) — error message confirmed: `"Wiki page not found: The Hardening Principle (concept)"` + `"Tried: The Hardening Principle (concept), the-hardening-principle-concept.md"` (BOTH attempted forms surfaced). BI-7 SERVICE-level parity demonstrated.
- [x] **6.7** VERIFY — Full suite: `npm test` → **562/562 passing across 93 test files** (was 553/553 + 9 new tests across Phase 6: 2 fenced-exclusion + 5 inline-code parity + 2 pre-resolved validator).
- [x] **6.8** VERIFY — `npm run build` → clean, no emit errors.
- [x] **6.S** STATE-WRITE: Plan-01 FP count: 1 → 0. Acceptance gate validator-level valid: 7/8 unique wiki names. Loud-fail confirmed: error+suggestion contains BOTH attempted paths. Files changed: `src/core/MarkdownParser/extractLinks.ts` (deleted dup detector), `src/core/MarkdownParser/isInsideInlineCode.ts` (rewritten per §6.1), `src/core/MarkdownParser/createLinkObject.ts` (populate attempted[]), `src/types/citationTypes.ts` (add attempted? field), `src/CitationValidator.ts` (wiki success + fail-loud fast-paths), 3 new test files.
- [x] **6.C** COMMIT: `fix(wikilink): close all spike residuals (validator wiring + dual-detector dedup + inline-code parity + loud-fail)`. `end_hash: 24e68e80b3d9e7a8ec79a46f2dc493a6de8ac047`.

#### REVIEW GATE 4 — `application-tech-lead` (opus, plan-02 readiness)

%% *Last Modified: 05/02/26 19:56:34* %%

- [ ] **6.R** REVIEW: Read plan + `git diff <baseline_hash>..HEAD`. Verify all 4 residuals closed:
  - Item 1: validator consumes pre-resolved path → BI-7 integration PASS at SERVICE level
  - Item 2: validator error surfaces both `attempted[]` paths → BI-7 loud-fail PASS at SERVICE level
  - Item 3: only one code-block detector exists in codebase → one-invariant-one-place restored
  - Item 4: line-604 plan-01 FP eliminated → 0 FPs total on plan-01
  - All 9 architecture principles re-evaluated; BI 1-7 ALL PASS at SERVICE level
  - Plan-02 has zero open dependencies on plan-01 work
  - **Verdict:** SHIP → spike + cleanup complete; plan-02 unblocked. NO-SHIP → escalation loop applies.

---

## Review Gate Justification

%% *Last Modified: 05/02/26 15:47:42* %%

| Gate | Placement | Agent | Rework Cost if Skipped |
|------|-----------|-------|------------------------|
| Gate 1 | After Phase 2 (Core Build) | `code-reviewer` | HIGH — Grammar regex, slug rules, and `ResolvedPath` shape are the spike's foundation. Wrong regex misses wikilink forms silently. Wrong `attempted[]` order breaks validator error messages. Errors in 3 new modules propagate into Phase 3 wiring. |
| Gate 2 | After Phase 3 (Wiring) | `application-tech-lead` | HIGH — Full integrated spike reviewed against architecture principles before the irreversible Phase 4 acceptance gate. Catches D2/D3/D5 scope creep and component boundary violations that are expensive to unwind after jact validate runs. |
| Gate 3 | After Phase 5 (Code-Block Fix) | `application-tech-lead` | HIGH — final integration point; BI 7 service-level parity is the gating outcome of the entire spike. Without this gate, BI 7 cannot be empirically demonstrated. Full BI 1-7 coverage review ensures no partial regression was introduced by the code-block exclusion fix. |
| Rejected | After Phase 0 | — | No reviewable artifacts — research and LSP reads only |
| Rejected | After Phase 1 | — | Debt fixes alone are low rework risk; validated by `tsc` + `npm test` inline |
| Rejected | After Phase 4 | — | Verification produces no reviewable code; gate runs after `application-tech-lead` already approved the full delta |

---

## Orchestrator Instructions

%% *Last Modified: 05/02/26 14:10:03* %%

### Agent Spawn Map

%% *Last Modified: 05/02/26 15:47:52* %%

| Role | Agent File | Model | Spawn Trigger |
|------|-----------|-------|---------------|
| Orchestrator | (you) | sonnet | Persistent |
| Coder | general-purpose | sonnet | Phase start (fresh per phase) |
| Code Reviewer | `.claude/agents/code-reviewer.md` | sonnet | Phase 2.C completes |
| Tech Lead Reviewer | `.claude/agents/application-tech-lead.md` | opus | Phase 3.C completes |
| Tech Lead Reviewer (Gate 3) | `.claude/agents/application-tech-lead.md` | opus | Phase 5.C completes |

### Plan File Checkbox Rule

%% *Last Modified: 05/02/26 14:10:51* %%

Every agent MUST update plan checkboxes after completing each task. Include in every spawn prompt:

> After completing each task step, update the plan file checkbox from `- [ ]` to `- [x]`. For STATE-WRITE steps, record deviations as inline notes. For COMMIT steps, record `end_hash: <hash>` next to the checkbox. Plan file: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/features/202605020859-jact-wikilink-validation/plan-01-spike-wikilink-resolution.md`

### Message Routing

%% *Last Modified: 05/02/26 15:48:00* %%

```
Coder Phase 0 completes → spawn Coder Phase 1
Coder Phase 1 completes → spawn Coder Phase 2
Coder Phase 2.C completes → spawn code-reviewer (Gate 1)
  code-reviewer SHIP    → spawn Coder Phase 3
  code-reviewer NO-SHIP → escalation loop (below)
Coder Phase 3.C completes → spawn application-tech-lead (Gate 2)
  application-tech-lead SHIP    → spawn Coder Phase 4
  application-tech-lead NO-SHIP → escalation loop (below)
Coder Phase 4 completes:
  [H-D4-slug] PASS → spawn Coder Phase 5
  [H-D4-slug] FAIL → STOP; report to human USER
Coder Phase 5.C completes → spawn application-tech-lead (Gate 3)
  application-tech-lead SHIP    → spike complete
  application-tech-lead NO-SHIP → escalation loop (below)
```

### Escalation Loop Protocol

%% *Last Modified: 05/02/26 14:10:03* %%

```
Round 1 — NO-SHIP:
  → SendMessage to coder (sonnet): "Fix these issues: {reviewer findings}"
  → Coder fixes, commits, messages back
  → Reviewer re-reviews same gate scope

Round 2 — Still NO-SHIP (same error class):
  → Spawn NEW coder (opus model override) with full findings from rounds 1+2
  → Opus coder fixes, commits, messages back
  → Reviewer re-reviews

Round 3 — Still NO-SHIP:
  → STOP. Report to human USER: attempts made, persisting findings, files affected.
```


---

## Footnotes

%% *Last Modified: 05/02/26 14:10:03* %%

[^S-D1a]: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/MarkdownParser/extractLinks.ts:420-457` — `extractWikiCrossDocLinks` requires `.md` AND `\|display`
[^S-D1b]: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/MarkdownParser/extractLinks.ts:463-499` — `extractWikiInternalLinks` requires `#anchor` AND `\|display`
[^S-D1c]: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/CitationValidator.ts:312-319` — `classifyPattern` wiki routing already live
[^S-D4a]: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/MarkdownParser/createLinkObject.ts:28-30` — `resolvePath` called unconditionally with `rawPath`
