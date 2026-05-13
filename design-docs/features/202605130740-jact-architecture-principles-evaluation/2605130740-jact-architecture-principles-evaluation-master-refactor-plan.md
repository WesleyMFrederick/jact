# jact Architecture Refactor — Master Plan

%% *Last Modified: 05/13/26 08:17:50* %%

%% *Generated: 2026-05-13* %%

---

## Executive Summary

%% *Last Modified: 05/13/26 08:17:50* %%

- **Two god files drive ~80% of all architectural debt**: [`src/jact.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts) (1,611 lines, 4 responsibilities) and [`src/CitationValidator.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/CitationValidator.ts) (1,188 lines, 6 responsibilities) — both are flagged by all three evaluators as god-class violations
- **The data model and DI wiring are exemplary**: discriminated unions, constructor injection, strategy pattern, and scope auto-inference are all solid; the problem is accumulation without corresponding splits as the codebase grew
- **The `--fix` command is a live safety hazard**: it overwrites files in-place with no backup and no dry-run — this should gate any public release of `--fix` functionality until REWORK-3 is complete
- **`CitationValidator.validateCrossDocumentLink()` (300 lines, 5-level branch nesting) is the single highest regression risk** for adding new citation types — branch explosion + scattered checks + leaky flags all concentrated in one method
- **Verdict**: Fix Now items can be completed in ~3 hours with zero behavioral risk; the three Phase 2 reworks reduce the two god files to four focused modules and close the safety gap

---

## Consensus Findings (≥2 reports agree)

%% *Last Modified: 05/13/26 08:17:50* %%

| Finding | Reports Agreeing | Severity | Files Involved |
|---|---|---|---|
| `jact.ts` is a god file (1,611 lines, 4+ responsibilities) | Core CI-1, OO CRIT-2, TS A-01 | Critical | [`src/jact.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts) |
| `CitationValidator.ts` is a god file (1,188 lines, 6 responsibilities) | Core CI-2, OO CRIT-1, TS A-02 | Critical | [`src/CitationValidator.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/CitationValidator.ts) |
| `computeValidationSummary` is misplaced — pure function bolted to CitationValidator.ts bottom, no dependency on `CitationValidator` | Core FN-1, OO FIX-2 | Major | [`src/CitationValidator.ts:1158–1188`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/CitationValidator.ts) |
| `PathConversion` type duplicated in `jact.ts:106` and `validationTypes.ts:25` — local and canonical have already diverged | Core FN-2, TS F-03 CI-03 | Major | [`src/jact.ts:106`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts), [`src/types/validationTypes.ts:25`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/types/validationTypes.ts) |
| `CliValidateOptions` duplicated in `jact.ts:66` (6 fields) and `contentExtractorTypes.ts:111` (4 fields) — field sets have diverged | Core FN-2, OO FIX-4, TS CI-03 F-04 | Major | [`src/jact.ts:66`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts), [`src/types/contentExtractorTypes.ts:111`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/types/contentExtractorTypes.ts) |
| `link: any` in `applyAnchorFix` should be `EnrichedLinkObject`; `biome-ignore` masks a real type gap | Core FN-4, OO H3, TS CI-02 F-01 | Major | [`src/jact.ts:1193`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts) |
| Path resolution logic (~150 lines) should be extracted from `CitationValidator` into a dedicated module | Core AR-1, OO REWORK-1, TS A-02 | Critical | [`src/CitationValidator.ts:112–193, 761–836`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/CitationValidator.ts) |
| Anchor matching logic (~180 lines) should be extracted from `CitationValidator` into a dedicated module | Core AR-2, OO REWORK-1, TS A-02 | Critical | [`src/CitationValidator.ts:838–1070`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/CitationValidator.ts) |
| CLI output formatting and fix-application helpers should be extracted from `JactCli` | Core FN-3+FN-5, OO REWORK-2, TS A-01 | Critical | [`src/jact.ts:393–645, 966–1231`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts) |
| In-place mutation (`LinkObject` → `EnrichedLinkObject` via `as unknown as`) bypasses the type system | Core CI-4, TS CI-01 | Major | [`src/CitationValidator.ts:222, 267–268`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/CitationValidator.ts) |
| `contentExtractorTypes.ts` is a kitchen sink: CLI flags + strategy interfaces + extraction types + fix records — 7+ concern groups in one file | OO REWORK-5, TS A-03 Principle-18 | Major | [`src/types/contentExtractorTypes.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/types/contentExtractorTypes.ts) |
| Fix path overwrites files in-place with no backup and no dry-run preview | Core (Atomic Ops), OO CRIT-3 | Critical (safety) | [`src/jact.ts:1069`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts) |
| `noUncheckedIndexedAccess` bypassed at 3 sites via `as` casts | Core (implied), TS CI-04 F-05 F-06 F-07 | Major | [`src/core/ContentExtractor/ContentExtractor.ts:184, 145`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/ContentExtractor/ContentExtractor.ts), [`src/core/ContentExtractor/extractLinksContent.ts:122`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/ContentExtractor/extractLinksContent.ts) |

---

## Divergent Findings (only 1 report flagged)

%% *Last Modified: 05/13/26 08:17:50* %%

| Finding | Report | Why Others May Have Missed It | Recommendation |
|---|---|---|---|
| **Kebab-case file naming** — 11 files use PascalCase (`CitationValidator.ts`, `FileCache.ts`, `ParsedDocument.ts`, `ParsedFileCache.ts`, `LinkObjectFactory.ts`, `ExtractionStrategy.ts`, `ForceMarkerStrategy.ts`, `SectionLinkStrategy.ts`, `StopMarkerStrategy.ts`, `CliFlagStrategy.ts`) | TS A-04 | Core and OO reviewers focus on behavioral/structural principles, not naming convention | **Defer** — cosmetic, touches 11 files + all import paths; no behavioral benefit; set aside until major version bump |
| **No public barrel `src/index.ts`** — public API surface undefined; callers import internal paths directly | TS A-05 | Core and OO reviewed internal architecture, not public consumption surface | **Defer** — trigger: first programmatic consumer outside the CLI emerges |
| **`ExtractionStrategy` base class should be `abstract`** — concrete base with `return null` default compiles silently if subclass forgets override | OO FIX-5 | Core and TS didn't traverse the strategy hierarchy in detail | **Include in Phase 1** — 10 min, zero risk, prevents future silent subclass bugs |
| **`ValidationMetadata` warning variant field named `error`** — semantically wrong on `status: "warning"` | OO FIX-3 | Core and TS focused on structural/type-level issues, not field naming | **Include in Phase 1** — semantic trap for callers; 25 min to rename and update write sites |
| **`_tokenIncludesChildrenInRaw` is public despite `_` prefix** (`ParsedDocument.ts:302`) | OO FIX-1 | Minor scope; Core and TS didn't read `ParsedDocument` at the method-visibility level | **Include in Phase 1** — 1 min, no callers outside the class |
| **`await import("node:path")` inside async method** (`jact.ts:197`) | TS F-02 | Core and OO focus on architectural principles, not import mechanics | **Include in Phase 1** — 5 min, static import is strictly better |
| **No `Contract:` blocks on exported async functions** — behavioral obligations (mutation, non-throw guarantees) are undocumented | TS H2 | Core and OO reviewers focused on code structure, not doc discipline | **Defer** — add incrementally; not blocking any refactor |
| **`componentFactory.ts` accepts concrete classes in signatures** — `ParsedFileCache | null`, `FileCache | null` instead of their interfaces | OO REWORK-4 | Core mentioned it as a dependency-abstraction violation; both agree — actually 2-report consensus | **Include in Phase 2** — do alongside CitationValidator split |

---

## Prioritized Refactor Roadmap

%% *Last Modified: 05/13/26 08:17:50* %%

### Phase 1 — Quick Wins (Fix Now, ≤30 min each)

%% *Last Modified: 05/13/26 13:05:42* %%

**Total estimated time: ~3 hours. Zero behavioral risk. No coordination needed.**

1. **Issue:** `computeValidationSummary` is a free function exported from [`src/CitationValidator.ts:1158–1188`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/CitationValidator.ts) — it has no dependency on `CitationValidator`; its presence there is a module-boundary leak  
   **Fix:** Move to new file `src/core/validationSummary.ts`; update import in [`src/jact.ts:28`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts)  
   **Cost:** 10 min  
   **Source:** Core FN-1, OO FIX-2

2. **Issue:** `PathConversion` interface declared at [`src/jact.ts:106–109`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts) duplicates canonical at [`src/types/validationTypes.ts:25–29`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/types/validationTypes.ts) — will drift silently  
   **Fix:** Delete local; add `import type { PathConversion } from "./types/validationTypes.js"` in `jact.ts`  
   **Cost:** 10 min  
   **Source:** Core FN-2, TS F-03

3. **Issue:** `CliValidateOptions` in [`src/jact.ts:66–73`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts) (6 fields, `format?: string`) shadows canonical in [`src/types/contentExtractorTypes.ts:111–116`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/types/contentExtractorTypes.ts) (4 fields, `format?: "cli" | "json"`) — field sets have already diverged  
   **Fix:** Delete local; add `verbose?: boolean` and `allowGitignore?: boolean` to canonical; tighten `format` to `"cli" | "json"` literal union in both files  
   **Cost:** 15 min  
   **Source:** Core FN-2, OO FIX-4, TS CI-03/F-04

4. **Issue:** `HeaderObject` and `FixRecord` declared locally in [`src/jact.ts:88–109`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts) with no home in `src/types/`  
   **Fix:** Move both to [`src/types/validationTypes.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/types/validationTypes.ts); import in `jact.ts`  
   **Cost:** 10 min  
   **Source:** Core FN-2

5. **Issue:** `link: any` with `biome-ignore` in `applyAnchorFix` at [`src/jact.ts:1193`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts) — `link.validation.suggestion` accessed on `any`; compiler cannot verify  
   **Fix:** Change parameter type to `EnrichedLinkObject` (already imported in `jact.ts`); remove `biome-ignore` comment  
   **Cost:** 10 min  
   **Source:** Core FN-4, OO H3, TS CI-02/F-01

6. **Issue:** `await import("node:path")` inside async method at [`src/jact.ts:197`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts) — dynamic import where static import suffices  
   **Fix:** Move `import path from "node:path"` to top-level static imports  
   **Cost:** 5 min  
   **Source:** TS F-02

7. **Issue:** `_tokenIncludesChildrenInRaw` at [`src/ParsedDocument.ts:302`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/ParsedDocument.ts) is public despite `_` prefix convention — no callers outside the class  
   **Fix:** Add `private` keyword to the declaration  
   **Cost:** 1 min  
   **Source:** OO FIX-1

8. **Issue:** `ValidationMetadata` warning variant has `error: string` at [`src/types/validationTypes.ts:46`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/types/validationTypes.ts) — field named `error` on a `warning` status is semantically wrong and surprises callers reading `link.validation.status === "warning"`  
   **Fix:** Rename field to `message: string`; update all write sites in `CitationValidator.ts` (the `createValidationResult` helper at line 1,118 + ~10–15 sites)  
   **Cost:** 25 min  
   **Source:** OO FIX-3

9. **Issue:** `ExtractionStrategy` base class at [`src/core/ContentExtractor/eligibilityStrategies/ExtractionStrategy.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/ContentExtractor/eligibilityStrategies/ExtractionStrategy.ts) has a concrete `return null` default — a subclass that forgets to override `getDecision` compiles silently  
   **Fix:** Make class `abstract` with an `abstract getDecision(...)` method signature; OR eliminate the base class entirely and have all strategies implement `ExtractionEligibilityStrategy` (interface already in `contentExtractorTypes.ts:20–25`) directly. Prefer option (b) — removes unnecessary inheritance.  
   **Cost:** 10 min  
   **Source:** OO FIX-5

10. **Issue:** `noUncheckedIndexedAccess` bypassed at 3 cast sites — silently drops the `undefined` branch the strict flag was configured to catch  
    **Fix (3 sub-items):**  
    - [`src/core/ContentExtractor/ContentExtractor.ts:184`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/ContentExtractor/ContentExtractor.ts): replace `as ExtractedContentBlock` with `if (!block) throw new Error("Missing content block: " + contentId)`  
    - [`src/core/ContentExtractor/ContentExtractor.ts:145`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/ContentExtractor/ContentExtractor.ts): add `if (link.target.path.absolute == null) return;` before `decodeURIComponent` call  
    - [`src/core/ContentExtractor/extractLinksContent.ts:122`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/ContentExtractor/extractLinksContent.ts): same null guard before `decodeURIComponent`  
    **Cost:** 15 min  
    **Source:** TS CI-04/F-05/F-06/F-07

11. **Issue:** `result.status as "error" | "warning"` forced cast at [`src/CitationValidator.ts:259`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/CitationValidator.ts) — discriminated union should narrow naturally via `if/else if`  
    **Fix:** Restructure the conditional so TypeScript narrows `status` without casting  
    **Cost:** 10 min  
    **Source:** TS F-08

12. **Issue:** Formatting methods `formatForCLI` (lines 394–537), `formatForCLIMinimal` (lines 545–636), `formatAsJSON` (lines 643–645) live inside `JactCli` at [`src/jact.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts) — a separate concern mixed into the orchestrator  
    **Fix:** Extract all three to new file `src/formatValidationResult.ts` as exported functions; `JactCli` imports and calls them  
    **Cost:** 20 min  
    **Source:** Core FN-3

13. **Issue:** Fix-application helpers (`applyPathConversion`, `applyAnchorFix`, `parseAvailableHeaders`, `findBestHeaderMatch`, `urlEncodeAnchor`) at [`src/jact.ts:1107–1231`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts) are a separate concern from orchestration  
    **Fix:** Extract to `src/core/citationFixer.ts` as exported functions (or a `CitationFixer` class); `JactCli.fix()` delegates to it  
    **Cost:** 20 min  
    **Source:** Core FN-5

14. **Issue:** Some `.test.ts` files may re-assert what `tsc --noEmit` already proves — type-level tests with no behavioral signal (**GH [#59](https://github.com/WesleyMFrederick/jact/issues/59)**)  
    **Fix:** Anti-test audit — review ~5 type-shape test files; delete redundant assertions or justify each with a comment explaining why they catch something the compiler misses  
    **Cost:** 20 min  
    **Source:** Testing-eval Anti-Targets section

15. **Issue:** No verification that `describe`/`it` blocks stay within 3 nesting levels; no check for `beforeEach` used for input construction (factories preferred) (**GH [#60](https://github.com/WesleyMFrederick/jact/issues/60)**)  
    **Fix:** BDD/AAA style audit — grep for nesting depth and `beforeEach` usage; annotate or fix any violations  
    **Cost:** 15 min  
    **Source:** Testing-eval Authoring Style section

16. **Issue:** `vitest.config.ts` contents not fully audited against testing principles; `setup.js` at test root has unclear purpose; `testTimeout` not confirmed at 30000 (**GH [#62](https://github.com/WesleyMFrederick/jact/issues/62)**)  
    **Fix:** Vitest config audit — read `vitest.config.ts` and `setup.js`; verify or set `testTimeout: 30000`; remove unnecessary blocks  
    **Cost:** 20 min  
    **Source:** Testing-eval Vitest Conventions section

17. **Issue:** No combined `check` script — `type-check` and `test` run as separate scripts with no single gate (**GH [#63](https://github.com/WesleyMFrederick/jact/issues/63)**)  
    **Fix:** Add `"check": "tsc --noEmit && vitest run"` to `package.json` scripts  
    **Cost:** 5 min  
    **Source:** Testing-eval Quality Gates section

18. **Issue:** Test coverage % is unknown; Open Q4 asks for the baseline; Rework 6 is gated on ≥80% (**GH [#64](https://github.com/WesleyMFrederick/jact/issues/64)**)  
    **Fix:** Run `vitest --coverage`; record baseline output; paste result as answer to Open Q4 below  
    **Cost:** 10 min  
    **Source:** Testing-eval Quality Gates section; Open Q4

19. **Standing policy:** Opportunistic `.js` → `.ts` test file migration — migrate any test file in `test/` that is touched during other Phase 1 or Phase 2 work. Do not batch. Confirm suite green before and after each migration.  
    **Source:** Testing-eval Organization section

---

### Phase 2 — Architectural Reworks (≥30 min, named scope, trigger)

%% *Last Modified: 05/13/26 13:09:18* %%

**Ranked by impact. Items 1 and 2 are independent; Item 3 depends on Item 2.**

1. **Rework:** Split `CitationValidator` — extract `PathResolver` and `AnchorMatcher`  
   **Scope:**  
   - Extract `resolveTargetPath`, `convertObsidianToFilesystemPath`, `generatePathResolutionDebugInfo`, `safeRealpathSync`, `isFile`, `isDirectory`, symlink helpers → `src/core/PathResolver.ts` (currently [`CitationValidator.ts:112–193, 761–836`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/CitationValidator.ts))  
   - Extract `findFlexibleAnchorMatch`, `cleanMarkdownForComparison`, `suggestObsidianBetterFormat`, `validateAnchorExists` → `src/core/AnchorMatcher.ts` (currently [`CitationValidator.ts:838–1070`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/CitationValidator.ts))  
   - `CitationValidator` becomes a thin coordinator: pattern-classify → delegate to `PathResolver` → delegate to `AnchorMatcher` → return result (~300 lines)  
   - `validateCrossDocumentLink()` (lines 396–701, branch explosion) is refactored as part of the extraction: path resolution strategies should be modeled as a `pathResolutionStrategies` array (matching the `eligibilityStrategies` pattern in `ContentExtractor`) rather than an implicit waterfall `if`-chain  
   - **Also do with this rework**: split `contentExtractorTypes.ts` into `src/types/cli-types.ts`, `src/types/extraction-types.ts`, `src/types/strategy-types.ts` (see OO REWORK-5, TS A-03) to avoid a double-touch later  
   **Effort:** 3–4 hours  
   **Trigger:** Next time path resolution logic or an anchor matching rule changes. Given the branch explosion risk, also acceptable to do this before adding any new citation type.  
   **Source:** Core AR-1+AR-2, OO REWORK-1, TS A-02  
   **Sequencing:** Should happen before folder normalization (Rework 4), because import paths will change anyway. The types split (contentExtractorTypes.ts) should be done in this same PR.

2. **Rework:** Split `JactCli` — extract `CliFormatter`, `CitationFixer`, and CLI wiring  
   **Scope:**  
   - Items 12+13 from Phase 1 become the full extraction: formatting → `src/formatValidationResult.ts`; fix engine → `src/core/CitationFixer.ts` (class with `applyFixes(content, fixes, { dryRun: boolean })`)  
   - Commander command registration moves from `src/jact.ts:1263–1611` → `src/cli.ts` (entry point); `JactCli` becomes programmatically importable without activating Commander  
   - After extraction: `JactCli` is orchestration + scope management only (~400 lines) at [`src/jact.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts)  
   - Ship `InMemoryFileCache` adapter implementing `FileCacheInterface` as test-default; refactor `CitationValidator` and `ContentExtractor` to accept the interface rather than concrete classes. **TDD sequence:** Write `InMemoryFileCache` + one passing test first → then refactor callers. **(#35 extended)**  
   **Effort:** 2–3 hours  
   **Trigger:** Any unit test that needs to test `JactCli` methods without spawning a CLI process. Also gates Rework 3 (dry-run implementation requires `CitationFixer` class to exist).  
   **Source:** Core FN-3+FN-5+AR-3, OO REWORK-2, TS A-01  
   **Sequencing:** Phase 1 items 12+13 are preparation. Rework 3 (backup/dry-run) depends on this.

3. **Rework:** Add backup + dry-run to fix path  
   **Scope:**  
   - Before `writeFileSync` in `CitationFixer.applyFixes()` (post Rework 2): write `${filePath}.${Date.now()}.bak` backup  
   - Add `--dry-run` flag to `jact validate --fix` CLI command  
   - `CitationFixer.applyFixes(content, fixes, { dryRun: boolean })` — returns patched content without writing when `dryRun: true`; CLI prints a diff  
   - Guard in [`src/jact.ts:975`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts): `fix()` currently calls `fileCache.buildCache()` only when `options.scope` is provided but assumes scope-based path corrections work regardless — add an explicit boundary check  
   **Effort:** 1–2 hours  
   **Trigger:** **This should gate any public release of `--fix`.** The current in-place overwrite at [`src/jact.ts:1069`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts) has no recovery path without git.  
   **Source:** OO CRIT-3+REWORK-3, Core Atomic-Ops  
   **Sequencing:** Depends on Rework 2 (CitationFixer class must exist for clean implementation).

4. **Rework:** Move `CitationValidator` to `src/core/CitationValidator/` subfolder  
   **Scope:**  
   - Move `CitationValidator.ts` → `src/core/CitationValidator/CitationValidator.ts`  
   - After Rework 1 extractions, also place `PathResolver.ts` and `AnchorMatcher.ts` in `src/core/CitationValidator/` (or `src/core/` top-level — preference TBD by user)  
   - Update all consumer imports (currently `../CitationValidator.js`) — approximately 6–8 files  
   **Effort:** 30 min (cheap after Rework 1 since import paths change anyway)  
   **Trigger:** Any significant CitationValidator change — Rework 1 would require this anyway.  
   **Source:** Core AR-5  
   **Sequencing:** Must come after Rework 1 (import paths already disrupted; do in same PR).

5. **Rework:** Resolve factory concrete-type coupling  
   **Scope:**  
   - Move `ParsedFileCacheInterface` and `FileCacheInterface` (currently inline in [`src/CitationValidator.ts:17–47`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/CitationValidator.ts)) to shared `src/types/componentInterfaces.ts`  
   - Update [`src/factories/componentFactory.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/factories/componentFactory.ts) factory signatures to accept interfaces (`ParsedFileCacheInterface | null`, `FileCacheInterface | null`) rather than concrete classes  
   - The `instanceof ParsedFileCache` check at `componentFactory.ts:79–87` (to call `syncParserFileCache`) is a temporal coupling smell — after Rework 1, `PathResolver` holds its own `FileCache` reference passed at construction time, removing the need for this post-construction mutation workaround  
   **Effort:** 1 hour  
   **Trigger:** Any test that needs to inject a mock `FileCache` or `ParsedFileCache` without importing the production class.  
   **Source:** OO REWORK-4, Core (dependency-abstraction violation)  
   **Sequencing:** Do after Rework 1 to avoid double-touch of `CitationValidator` internals.

6. **Rework:** Eliminate in-place `LinkObject` mutation  
   **Scope:**  
   - Replace `(citation as EnrichedLinkObject).validation = validation; return citation as EnrichedLinkObject` pattern at [`src/CitationValidator.ts:267–268`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/CitationValidator.ts) with a factory function: `enrichLinkObject(link: LinkObject, meta: ValidationMetadata): EnrichedLinkObject` that constructs a new object via spread  
   - Remove `as unknown as ValidationResult["links"]` double-cast at line 222  
   - Affects `validateFile`, `validateSingleCitation` — all tests referencing returned link objects will need updating  
   **Effort:** 2 hours  
   **Trigger:** **Defer until test coverage reaches ≥80%.** This is the highest-risk refactor — silent runtime behavior changes are possible if any caller holds a reference to the original `LinkObject` and reads `.validation` post-mutation. Without test coverage, regressions may go undetected.  
   **Source:** Core AR-4/CI-4, TS CI-01/A-06  
   **Sequencing:** Must come after Rework 1 (CitationValidator split simplifies the scope of the mutation change).

7. **Rework:** Contract Test Convention + Regressions Directory (**GH [#58](https://github.com/WesleyMFrederick/jact/issues/58)**)  
   **Scope:**  
   - Create `test/regressions/` directory; add a placeholder `README.md` documenting the promotion convention (`regressions/<issue>-<slug>.test.ts`)  
   - Define `FileSystemInterface` — minimal injectable interface for file-system I/O (read, exists, list); implement `InMemoryFileSystemAdapter` as first-party fake for E2E tests  
   - Write first `Contract:` test for the `CitationValidator` public API: one test per TSDoc `Contract:` block; establish the naming pattern so future contributors follow it automatically  
   - Codify convention: whenever a TSDoc `Contract:` block is added to an exported function, a failing `Contract:` test must be written first (TDD)  
   **Effort:** 1.5–2 hours  
   **Trigger:** Any new E2E test that currently couples to the real filesystem, or any bug fix that benefits from a promoted regression test.  
   **TDD sequence:** Write `FileSystemInterface` faux + one test using it first → then refactor production callers.  
   **Source:** Testing-eval Scope and Targets section

8. **Rework:** Test Suite Reorganization (**GH [#61](https://github.com/WesleyMFrederick/jact/issues/61)**)  
   **Scope:**  
   - Migrate flat `test/` layout to mirror `src/` structure — one test file per source module  
   - Rename `helpers/` utilities to the `*-test-utils.ts` naming pattern  
   - Create `test/scratch/` directory for disposable smoke scripts; relocate `poc-block-extraction.test.js` there  
   - Delete `auto-fix.test.js.archive`  
   - One commit per component group (unit/, integration/, etc.); confirm suite green before starting the next group  
   **Effort:** 2–3 hours  
   **Trigger:** When the opportunistic `.js` → `.ts` standing policy (Phase 1 item 19) has touched ≥50% of test files, or when a new component test is added and the flat layout creates naming ambiguity.  
   **Sequencing:** Independent of all other Reworks. Do not block on it.  
   **Source:** Testing-eval Organization section

---

### Phase 3 — Defer (with trigger)

%% *Last Modified: 05/13/26 12:45:16* %%

| Item | Trigger to Revisit |
|---|---|
| **Kebab-case file naming** (11 files: `CitationValidator.ts`, `FileCache.ts`, `ParsedDocument.ts`, `ParsedFileCache.ts`, `LinkObjectFactory.ts`, `ExtractionStrategy.ts`, `ForceMarkerStrategy.ts`, `SectionLinkStrategy.ts`, `StopMarkerStrategy.ts`, `CliFlagStrategy.ts`) — TS A-04 | Major version bump (v2.0). All imports change; coordinate with barrel file creation (below). |
| **Public barrel `src/index.ts`** — no defined public API surface; consumers must import internal paths — TS A-05 | First programmatic consumer of `jact` as a library (not the CLI). |
| **`Contract:` blocks on all exported async functions** — zero coverage currently; behavioral obligations (mutation, non-throw guarantees) are undocumented — TS H2 | Add incrementally during each Phase 2 rework; not blocking any code change. |
| **Eliminate in-place `LinkObject` mutation** (Rework 6 above) | Test coverage ≥80%. Currently deferred due to high regression risk without test backing. |
| **Centralize cleanup helpers** — `afterEach` cleanup patterns currently duplicated per-file in test suite | When ≥3 test files duplicate the same `afterEach` pattern; extract to a shared `*-test-utils.ts` helper. |

---

## Contradictions Resolved

%% *Last Modified: 05/13/26 08:17:50* %%

| Contradiction | Resolution |
|---|---|
| **JactCli split strategy**: TS says split into `JactValidateCommand` / `JactFixCommand` / etc. (command-per-class). OO says extract `CliFormatter` + `CitationFixer`. Core says split CLI wiring to `cli.ts`. | **OO's approach wins.** Command-per-class (TS) over-fragments a 5-command CLI and doesn't address the formatting/fix-engine concerns. OO's `CliFormatter` + `CitationFixer` extraction is surgical. Core's CLI wiring split (`cli.ts`) is compatible with OO and should happen in the same rework. |
| **Kebab-case file naming**: TS flagged 11 violations; Core and OO didn't mention it. | **Defer.** Core and OO reviewers evaluated behavioral/structural principles; the naming is cosmetic. 11 files + all import paths change with no behavioral benefit. Phase 3, major-version-bump trigger. |
| **`computeValidationSummary` destination**: Core says `src/core/validationSummary.ts`; OO says `src/core/computeValidationSummary.ts` or co-locate in `validationTypes.ts`. | **`src/core/validationSummary.ts`** — action-named, consistent with existing files in `src/core/`. Not co-located with the type file because types and computation are separate concerns. |
| **Priority order**: Core says CitationValidator split first; OO says JactCli split + backup/dry-run first. | **Hybrid**: CitationValidator split (Rework 1) and JactCli split (Rework 2) are independent and can be ordered by team preference. However, backup/dry-run (Rework 3) **must** come before any public release of `--fix`, so if that release is imminent, Rework 2 + 3 take precedence. Otherwise, Rework 1 first for maximum structural payoff. |

---

## Strengths to Preserve

%% *Last Modified: 05/13/26 08:17:50* %%

These are working well. Do not refactor them.

| Strength | Evidence |
|---|---|
| **Discriminated union types** — `ValidationMetadata`, `AnchorObject`, `ResolveResult`, `LinkScope` all use `status`/`type` discriminant fields; illegal states structurally unrepresentable | All 3 reports: ✅ |
| **Constructor DI pattern** — components receive dependencies at construction, no service locator, no global registry | OO: ✅ Compliant |
| **Strategy pattern in `eligibilityStrategies/`** — adding a new extraction rule requires no modification to `ContentExtractor`; textbook OCP compliance | Core: ✅ AR-1 uses this as the model for path resolution |
| **Scope auto-inference** in [`src/core/resolveScope.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/resolveScope.ts) — cwd-git → cwd-pkg → target-git → target-pkg → none progressive fallback chain | Core: ✅ |
| **`import type` discipline** — used consistently across all 42 files | TS: ✅ |
| **Strict TypeScript config** — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns` all enabled | TS: ✅ |
| **`src/types/` type separation** — `citationTypes.ts`, `validationTypes.ts`, `contentExtractorTypes.ts`, `fileCacheTypes.ts` cleanly separated (before the contentExtractorTypes.ts split) | Core: ✅ |
| **`ParsedFileCache` promise-based caching** — files parsed at most once per session; `Map<string, Promise<ParsedDocument>>` pattern is correct for concurrent access | Core: ✅ (though cache flush is not exposed — acceptable for now) |
| **`src/core/MarkdownParser/` and `src/core/ContentExtractor/`** — demonstrate the correct pattern the rest of the codebase should converge to: small focused files, local DI interfaces, action-named modules | Core: ✅ "The problem is not that the dev doesn't know the pattern" |

---

## Open Questions for the User

%% *Last Modified: 05/13/26 12:45:32* %%

Decisions needed before Phase 2 work begins:

1. **`--fix` gate**: Should the `--fix` flag be disabled (with a deprecation warning pointing to a future version) until backup/dry-run (Rework 3) is shipped? Or can users rely on git for recovery in the interim?

2. **`PathResolver` location**: After the CitationValidator split, should `PathResolver.ts` and `AnchorMatcher.ts` live at `src/core/` top-level (flat, alongside `resolveScope.ts`) or inside `src/core/CitationValidator/` (co-located with the coordinator)? The graphify community structure suggests flat `src/core/` for shared utilities.

3. **Kebab-case naming timeline**: Is a v2.0 major version bump on the roadmap? If not, kebab-case renaming can be skipped indefinitely. If yes, it should be bundled with the barrel file work (TS A-04 + A-05) to minimize the number of import-path changes to one event.

4. **Test coverage baseline**: What is the current test coverage %? The LinkObject mutation elimination (Rework 6) is deferred until ≥80% — knowing the current number sets the timeline for when that rework becomes unblocked.

   **Answered by:** Phase 1 item 18 — run `vitest --coverage` and record the baseline output. Paste the result here to unblock the Rework 6 timeline.

5. **`ValidationMetadata.warning.error → message` rename** (Phase 1 item 8): This is a type-level breaking change for any external caller reading `.error` on a warning result. If there are known downstream consumers of the `jact` API (not the CLI), this needs a deprecation path. If CLI-only, ship it.
