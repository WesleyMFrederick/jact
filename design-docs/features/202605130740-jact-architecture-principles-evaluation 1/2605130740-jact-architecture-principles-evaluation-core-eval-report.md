# jact Architecture Compliance Report — Core Design Principles

%% *Last Modified: 05/13/26 08:11:30* %%

%% *Generated: 2026-05-13* %%

---

## Evaluation Metadata

%% *Last Modified: 05/13/26 08:11:30* %%

| Field | Value |
|---|---|
| **Reviewer Role** | Architecture compliance reviewer — core design principles |
| **Principle Set** | `/0-documents/markdown-documents/architecture-principles/core/DESIGN-PRINCIPLES.md` |
| **Evaluation Mode** | Heuristic (Polya practical-problem mode) — grounded in code references, not formal proof |
| **User-Flagged Concern** | Repo is "sprawling" — emphasis on boundaries, modularity, interface design |
| **Graph Freshness** | Built from commit `21bed5e6` (may be 1–2 commits stale) |

### Domain Vocabulary (from principle headings)

%% *Last Modified: 05/13/26 08:11:30* %%

Loose coupling · Tight cohesion · Stable public boundaries · Single responsibility · Replaceable parts · Extension over modification · Dependency abstraction · Primitive-first design · Illegal states unrepresentable · Explicit relationships · Access-pattern fit · Behavior as data · One source of truth · Action-based file organization · Primary export pattern · Data contracts separate · Orchestrators compose pipeline · Interface segregation · Boundary validation · Progressive disclosure · MVP-first · Direct over clever · Mechanical separation · Self-contained naming · Self-documenting code first · Safety-first · Fail fast · Clear contracts · Anti-patterns: scattered checks, branch explosion, hidden global state

### Files Evaluated (42 source files)

%% *Last Modified: 05/13/26 08:11:30* %%

| Path | Lines | Role |
|---|---|---|
| [`src/jact.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts) | 1611 | CLI orchestrator + JactCli class + output formatting |
| [`src/CitationValidator.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/CitationValidator.ts) | 1188 | Link validation, path resolution, anchor matching, fix helpers |
| [`src/FileCache.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/FileCache.ts) | 662 | Filename-to-path index, fuzzy matching, gitignore scan |
| [`src/core/MarkdownParser/extractLinks.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/MarkdownParser/extractLinks.ts) | 620 | Token walker + regex fallback + wikilink extraction |
| [`src/core/ContentExtractor/ContentExtractor.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/ContentExtractor/ContentExtractor.ts) | 236 | Extraction orchestrator (thin wrapper over op files) |
| [`src/core/ContentExtractor/extractLinksContent.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/ContentExtractor/extractLinksContent.ts) | 212 | Core extraction pipeline operation |
| [`src/ParsedDocument.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/ParsedDocument.ts) | 409 | Facade over MarkdownParser output |
| [`src/core/MarkdownParser/MarkdownParser.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/MarkdownParser/MarkdownParser.ts) | 184 | Parser entry point |
| [`src/factories/componentFactory.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/factories/componentFactory.ts) | 126 | DI wiring |
| [`src/factories/LinkObjectFactory.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/factories/LinkObjectFactory.ts) | 104 | Synthetic link creation |
| [`src/ParsedFileCache.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/ParsedFileCache.ts) | 84 | Promise-based parse cache |
| [`src/types/citationTypes.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/types/citationTypes.ts) | — | Core data contracts |
| [`src/types/validationTypes.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/types/validationTypes.ts) | — | Validation output contracts |
| [`src/types/contentExtractorTypes.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/types/contentExtractorTypes.ts) | — | Extractor contracts |
| [`src/types/fileCacheTypes.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/types/fileCacheTypes.ts) | — | FileCache contracts |
| [`src/cache/checkExtractCache.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/cache/checkExtractCache.ts) | — | Session cache helpers |
| [`src/formatExtractResult.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/formatExtractResult.ts) | 47 | Extract result serializer |
| [`src/core/resolveScope.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/resolveScope.ts) | 81 | Scope inference logic |
| [`src/core/getLinkClass.ts`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/getLinkClass.ts) | 24 | Display-layer link classifier |
| All MarkdownParser sub-files | ~400 combined | createLinkObject, extractWikilinks, detectExtractionMarker, etc. |
| All ContentExtractor strategy files | ~200 combined | CliFlagStrategy, ForceMarkerStrategy, SectionLinkStrategy, StopMarkerStrategy |
| `src/utils/*` | ~100 combined | stringDistance, parseGitignore, wikiPageSlug |

---

## Principle Compliance Table

%% *Last Modified: 05/13/26 08:11:30* %%

| # | Category | Status | Summary |
|---|---|---|---|
| 1 | **Modular Design** | ❌ Violates | God-node files exceed SRP; coupling runs through concrete types |
| 2 | **Data-First Design** | ✅ Compliant | Strong discriminated unions; types-first approach evident |
| 3 | **Action-Based File Organization** | ⚠️ Partial | `src/core/` follows it; `src/` root does not |
| 4 | **Format/Interface Design** | ⚠️ Partial | Good boundary interfaces; CLI formatting co-located with orchestration is a smell |
| 5 | **MVP Principles** | ✅ Compliant | Features are purposeful; no obvious over-engineering |
| 6 | **Deterministic Offloading** | ✅ Compliant | Parsing/validation/I/O all deterministic; LLM is consumer not actor |
| 7 | **Self-Contained Naming** | ✅ Compliant | Names are clear; minor exceptions noted |
| 8 | **Safety-First Design** | ⚠️ Partial | Fail-fast on I/O; contract enforcement is inconsistent |
| 9 | **Anti-Patterns** | ❌ Violates | Branch explosion in CitationValidator; leaky flags in fix logic |

---

## Critical Issues

%% *Last Modified: 05/13/26 08:11:30* %%

### CI-1 · `jact.ts` is a 1611-line monolith violating SRP at every level

%% *Last Modified: 05/13/26 08:11:30* %%

**Principle**: Single Responsibility (`^single-responsibility`), Interface Segregation (`^interface-segregation`)

`src/jact.ts` contains:
1. `JactCli` class — orchestration for 5 commands (`validate`, `fix`, `getAst`, `extractLinks`, `extractHeader`, `extractFile`)
2. CLI formatting methods — `formatForCLI` (lines 394–537), `formatForCLIMinimal` (lines 545–636), `formatAsJSON` (lines 643–645)
3. Fix application logic — `applyPathConversion`, `applyAnchorFix`, `parseAvailableHeaders`, `findBestHeaderMatch`, `urlEncodeAnchor` (lines 1107–1231)
4. Commander.js command registration — all subcommands wired at module level (lines 1263–1611)
5. Semantic suggestion map (line 1240)
6. `LineRange`, `HeaderObject`, `FixRecord`, `PathConversion` — local interfaces that duplicate or should reference types from `src/types/`

**Line refs**: `PathConversion` redeclared at jact.ts:106–109 despite existing in `src/types/validationTypes.ts:25–29`. The `HeaderObject` (jact.ts:88) and `FixRecord` (jact.ts:96) are file-local with no type-file home.

**Impact**: Any change to output formatting, fix logic, or CLI registration requires touching the same 1611-line file. Testing individual concerns requires mocking the entire JactCli instance.

---

### CI-2 · `CitationValidator.ts` is a 1188-line class with 4 distinct responsibilities

%% *Last Modified: 05/13/26 08:11:30* %%

**Principle**: Single Responsibility (`^single-responsibility`), Avoid Duplication (`^avoid-duplication`)

The class does:
1. **Pattern classification** — `classifyPattern()` (line 302), dispatching to 5 validators
2. **Path resolution** — `resolveTargetPath()` (line 761), `convertObsidianToFilesystemPath()` (line 142), `generatePathResolutionDebugInfo()` (line 161), symlink handling (lines 112–127)
3. **Anchor matching** — `validateAnchorExists()` (line 838), `findFlexibleAnchorMatch()` (line 975), `cleanMarkdownForComparison()` (line 1029), `suggestObsidianBetterFormat()` (line 1044)
4. **Path conversion suggestions** — `generatePathConversionSuggestion()` (line 1097), `calculateRelativePath()` (line 1085), `isDirectoryMatch()` (line 1076)

Path resolution alone spans ~150 lines of multi-strategy waterfall logic (lines 761–836). Anchor matching spans ~180 lines (lines 838–1070). Neither is independently testable without instantiating `CitationValidator` with both cache dependencies.

**Additional smell**: `computeValidationSummary` is an exported free function bolted onto the bottom of CitationValidator.ts (lines 1158–1188) because `jact.ts` needed to call it for line-range filtering. This is a **cross-cutting concern leaking across module boundaries** — the summary logic belongs in a `validationSummary.ts` utility.

---

### CI-3 · Inconsistent folder depth signals organic growth without intentional structure

%% *Last Modified: 05/13/26 08:11:30* %%

**Principle**: Component-Level Folders (`^component-level-folders`), Action-Based File Organization (`^action-based-file-organization-definition`)

The folder structure mixes two incompatible conventions:

| Pattern | Files |
|---|---|
| Flat root files | `src/CitationValidator.ts`, `src/FileCache.ts`, `src/ParsedDocument.ts`, `src/ParsedFileCache.ts`, `src/formatExtractResult.ts` |
| Component subdirectories | `src/core/MarkdownParser/`, `src/core/ContentExtractor/`, `src/factories/`, `src/utils/`, `src/types/`, `src/cache/` |

`CitationValidator` has 36 graph edges (god node #1) but lives flat at `src/`. `FileCache` has 30 edges (god node #2) but also lives flat. `MarkdownParser` (15 edges) correctly lives in `src/core/MarkdownParser/`. The inconsistency is not cosmetic — it makes **boundary ownership ambiguous**: is `src/CitationValidator.ts` a "core" component or an "application layer" component? The graph says it's central; the file system says it's loose.

Expected structure (consistent with `src/core/`):
```
src/core/
  CitationValidator/
    CitationValidator.ts
    pathResolution.ts        ← extracted from CI-2
    anchorMatching.ts        ← extracted from CI-2
    validateCrossDocument.ts ← extracted method ~300 lines
  FileCache/
    FileCache.ts
    scanDirectory.ts         ← extracted
    fuzzyMatch.ts            ← extracted
```

---

### CI-4 · In-place mutation of `LinkObject` breaks the "Illegal States Unrepresentable" principle

%% *Last Modified: 05/13/26 08:11:30* %%

**Principle**: Illegal States Unrepresentable (`^illegal-states-unrepresentable`), Explicit Relationships (`^explicit-relationships`)

At `CitationValidator.ts:267`:
```typescript
(citation as EnrichedLinkObject).validation = validation;
return citation as EnrichedLinkObject;
```

A `LinkObject` is cast to `EnrichedLinkObject` via mutation and a type cast (`as`). The type system cannot enforce that `validation` is present at the call site — any caller who holds a reference to the original `LinkObject` and reads `.validation` after this call will get an untyped field access. The enrichment is invisible in the type signature of `validateFile()` until the return type declaration.

This is the "In-Place Enrichment Pattern" (listed as an isolated node in the graph with ≤1 connection), suggesting it's underdocumented and not well-understood by consumers. The correct model is a **transformation** (input: `LinkObject[]`, output: `EnrichedLinkObject[]`) with no mutation — which would make the type constraint structurally enforced.

---

## Prioritized Findings

%% *Last Modified: 05/13/26 08:11:30* %%

### Fix Now (< 30 min each)

%% *Last Modified: 05/13/26 08:11:30* %%

| # | Finding | File | Effort | Principle Violated |
|---|---|---|---|---|
| FN-1 | Extract `computeValidationSummary` to `src/core/validationSummary.ts` | [`CitationValidator.ts:1158`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/CitationValidator.ts) | 10 min | `^avoid-duplication`, `^single-responsibility` |
| FN-2 | Move `PathConversion`, `HeaderObject`, `FixRecord` from jact.ts to `src/types/` | [`jact.ts:88–109`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts) | 15 min | `^data-contracts-separate`, `^one-source-of-truth` |
| FN-3 | Move `formatForCLI`, `formatForCLIMinimal`, `formatAsJSON` to `src/formatValidationResult.ts` | [`jact.ts:394–645`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts) | 20 min | `^single-responsibility`, `^primary-export-pattern` |
| FN-4 | Remove `biome-ignore` suppression on `applyAnchorFix` (`link: any`) — add explicit type | [`jact.ts:1192`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts) | 10 min | `^illegal-states-unrepresentable`, `^clear-contracts` |
| FN-5 | Extract fix-application helpers to `src/core/citationFixer.ts` | [`jact.ts:1107–1231`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts) | 20 min | `^single-responsibility`, `^co-located-helpers` |

### Architectural Rework Required (≥ 30 min, named scope + trigger)

%% *Last Modified: 05/13/26 08:11:30* %%

| # | Finding | Scope | Trigger Condition | Principle Violated |
|---|---|---|---|---|
| AR-1 | **Extract path resolution from CitationValidator** into `src/core/pathResolver.ts` (~150 lines: `resolveTargetPath`, `convertObsidianToFilesystemPath`, `generatePathResolutionDebugInfo`, symlink helpers) | [`CitationValidator.ts:112–193, 761–836`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/CitationValidator.ts) | Next time path resolution logic changes or a new path strategy is added | `^single-responsibility`, `^replaceable-parts`, `^loose-coupling-tight-cohesion` |
| AR-2 | **Extract anchor matching from CitationValidator** into `src/core/anchorMatcher.ts` (~180 lines: `validateAnchorExists`, `findFlexibleAnchorMatch`, `cleanMarkdownForComparison`, `suggestObsidianBetterFormat`) | [`CitationValidator.ts:838–1070`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/CitationValidator.ts) | Next anchor feature (new format, new match rule) | `^single-responsibility`, `^extension-over-modification` |
| AR-3 | **Split JactCli orchestrator from CLI wiring** — `JactCli` class stays in `src/jact.ts`; Commander command registration moves to `src/cli.ts` (entry point). This makes JactCli programmatically importable without activating Commander | [`jact.ts:1263–1611`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts) | If integration tests or programmatic consumers emerge; also unblocks unit testing JactCli methods without spawning a CLI process | `^interface-segregation`, `^stable-public-boundaries` |
| AR-4 | **Eliminate in-place LinkObject mutation** — `validateFile` should return `EnrichedLinkObject[]` built via transformation, not cast. Intermediate type: `UnvalidatedLinkObject`. This requires coordinating `CitationValidator.ts`, `ParsedDocument.ts`, and `extractLinks.ts` | [`CitationValidator.ts:214–268`](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/CitationValidator.ts) | Next major type refactor or when test coverage reaches >80% | `^illegal-states-unrepresentable`, `^explicit-relationships`, `^clear-contracts` |
| AR-5 | **Move `CitationValidator` to `src/core/CitationValidator/`** subfolder alongside MarkdownParser and ContentExtractor to normalize component depth | All files importing from `../CitationValidator.js` | Any significant CitationValidator refactor (AR-1 or AR-2 would require this anyway) | `^component-level-folders`, structural consistency |

---

## Principle-by-Principle Assessment

%% *Last Modified: 05/13/26 08:11:30* %%

### 1. Modular Design Principles — ❌ Violates

%% *Last Modified: 05/13/26 08:11:30* %%

**Loose Coupling, Tight Cohesion** `^loose-coupling-tight-cohesion`
- ✅ `ContentExtractor`, `MarkdownParser`, `ParsedFileCache` are well-bounded with local DI interfaces
- ❌ `CitationValidator` has 36 edges; FileCache has 30. Both are tightly coupled to concrete implementations rather than abstractions at most call sites
- ❌ `jact.ts` instantiates `new JactCli()` in every Commander `.action()` handler (lines 1340, 1408, 1468, 1518, 1572) — each invocation creates a full component graph. This is not a bug but signals that `JactCli` is not designed as a singleton

**Stable Public Boundaries** `^stable-public-boundaries`
- ✅ `CitationValidator` exposes clean `validateFile()` / `validateSingleCitation()` public API
- ✅ `FileCache` exposes `buildCache()` / `resolveFile()` / `getCacheStats()`
- ❌ `CitationValidator.ts` exports `computeValidationSummary` as a side-effect of proximity, not design (line 1158). Consumer `jact.ts` imports it directly. This bypasses the intended module boundary

**Single Responsibility** `^single-responsibility`
- ❌ `jact.ts` (1611 lines): orchestration + formatting + fix application + CLI wiring. **4 responsibilities.**
- ❌ `CitationValidator.ts` (1188 lines): classification + path resolution + anchor matching + path conversion generation. **4 responsibilities.**
- ✅ `FileCache.ts` (662 lines): large but cohesive — scan, index, resolve, fuzzy-match are all the same concern

**Replaceable Parts / Extension Over Modification** `^replaceable-parts` `^extension-over-modification`
- ✅ Eligibility strategy chain (StopMarkerStrategy → ForceMarkerStrategy → SectionLinkStrategy → CliFlagStrategy) is textbook extension over modification
- ❌ Adding a new path resolution strategy requires editing `resolveTargetPath()` in CitationValidator, which is a 75-line waterfall `if` chain (lines 761–836) — modification, not extension

**Dependency Abstraction** `^dependency-abstraction`
- ✅ `ContentExtractor` defines its own `ParsedFileCacheInterface` and `CitationValidatorInterface` — correct inversion
- ✅ `CitationValidator` defines `ParsedFileCacheInterface` and `FileCacheInterface` — correct
- ❌ `componentFactory.ts` lines 79–87: `createCitationValidator` checks `instanceof ParsedFileCache` to call `syncParserFileCache`. This is a concrete-type check inside the factory, breaking dependency abstraction. The sync concern should be in `ParsedFileCache.constructor()` or handled via a protocol, not an `instanceof` guard

---

### 2. Data-First Design Principles — ✅ Compliant

%% *Last Modified: 05/13/26 08:11:30* %%

**Illegal States Unrepresentable** `^illegal-states-unrepresentable`
- ✅ `ValidationMetadata` is a discriminated union (validationTypes.ts:37–50): `{status:"valid"}` vs `{status:"error"; error:string}` vs `{status:"warning"; error:string}`. The error field cannot exist on a valid result — impossible to misread
- ✅ `LinkScope = "internal" | "cross-document"` — prevents free-string scope bugs
- ❌ The in-place mutation pattern (CI-4 above) partially undermines this: `LinkObject` mutable to `EnrichedLinkObject` is an escape hatch that bypasses the type system

**Explicit Relationships** `^explicit-relationships`
- ✅ `AnchorType = "header" | "block" | null` — all variants named, none implicit
- ✅ `LinkObject.target.path.attempted` captures resolution attempt history explicitly, not via side effects

**One Source of Truth** `^one-source-of-truth`
- ❌ `PathConversion` interface declared twice: `src/types/validationTypes.ts:25` and `jact.ts:106`. These are currently identical but will drift

**Behavior as Data** `^behavior-as-data`
- ✅ Strategy chain (eligibilityStrategies array) replaces a large `if-else` tree. The strategies are data-driven dispatch

---

### 3. Action-Based File Organization — ⚠️ Partial

%% *Last Modified: 05/13/26 08:11:30* %%

**Primary Export Pattern** `^primary-export-pattern`
- ✅ `src/core/MarkdownParser/extractLinks.ts` exports `extractLinks()` — file name matches action
- ✅ `src/core/ContentExtractor/generateContentId.ts` — matches
- ✅ `src/utils/stringDistance.ts` — matches
- ❌ `src/jact.ts` exports `JactCli` (class) but also registers Commander commands at module level. The file has two primary exports, one implicit (Commander side effects)
- ❌ `src/CitationValidator.ts` exports `CitationValidator` (class) + `computeValidationSummary` (function) — two primary exports, second one is a leak

**Data Contracts Separate** `^data-contracts-separate`
- ✅ `src/types/` folder with `citationTypes.ts`, `validationTypes.ts`, `contentExtractorTypes.ts`, `fileCacheTypes.ts` — clean separation
- ❌ `jact.ts` declares `CliValidateOptions`, `LineRange`, `HeaderObject`, `FixRecord`, `PathConversion` as local interfaces (lines 66–109) instead of in `src/types/`

**Component-Level Folders** `^component-level-folders`
- ✅ `src/core/MarkdownParser/`, `src/core/ContentExtractor/`, `src/factories/`, `src/utils/`, `src/types/`, `src/cache/`
- ❌ `src/CitationValidator.ts`, `src/FileCache.ts`, `src/ParsedDocument.ts`, `src/ParsedFileCache.ts`, `src/formatExtractResult.ts` — root-level stragglers with no component folder

---

### 4. Format/Interface Design — ⚠️ Partial

%% *Last Modified: 05/13/26 08:11:30* %%

**Interface Segregation** `^interface-segregation`
- ✅ `ContentExtractor` defines narrow consumer interfaces (lines 20–38 of ContentExtractor.ts)
- ✅ `CitationValidator` defines its own `ParsedFileCacheInterface` and `FileCacheInterface` inline (lines 17–47 of CitationValidator.ts) — prevents over-coupling to concrete types
- ❌ `JactCli` exposes `validate()`, `fix()`, `getAst()`, `extractLinks()`, `extractHeader()`, `extractFile()` — a 6-method catch-all class. Per interface-segregation, these are three distinct sub-protocols: validation, extraction, AST. A caller needing only AST must construct the full `JactCli` instance with all 4 components

**Boundary Validation** `^boundary-validation`
- ✅ `CitationValidator.validateFile()` checks `existsSync(filePath)` before any processing (line 203)
- ✅ `JactCli.applyScope()` throws immediately if scope cannot be resolved (lines 163–167) — fail-fast at boundary
- ✅ `FileCache.buildCache()` throws on unreadable directory (documented at line 96)
- ❌ `jact.ts:fix()` calls `this.fileCache.buildCache()` only when `options.scope` is provided (line 975), but later code assumes scope-based path corrections. When called without scope, path-conversion fixes silently can't apply — no boundary guard

**Progressive Defaults** `^progressive-defaults`
- ✅ Scope auto-inference (cwd-git → cwd-pkg → target-git → target-pkg → none) is a well-designed progressive default (resolveScope.ts)
- ✅ `--verbose` flag flips between minimal and full output — 80/20 design

---

### 5. MVP Principles — ✅ Compliant

%% *Last Modified: 05/13/26 08:11:30* %%

All features (validate, fix, ast, extract) address real use cases. No speculative abstractions observed. The eligibility strategy chain and scope inference are the most "architectured" parts, but both solve demonstrated problems (extraction filtering, cross-project usage). No over-engineered data models detected.

---

### 6. Deterministic Offloading Principles — ✅ Compliant

%% *Last Modified: 05/13/26 08:11:30* %%

All core operations (parse, validate, scan, cache, extract) are fully deterministic given identical inputs. The `--session` cache uses MD5 content hash (checkExtractCache.ts:4–8) for invalidation — correct. No LLM calls embedded in the tool itself.

---

### 7. Self-Contained Naming Principles — ✅ Compliant (minor exceptions)

%% *Last Modified: 05/13/26 08:11:30* %%

- ✅ `extractWikilinks`, `detectExtractionMarker`, `resolveWikiPath`, `createLinkObject` — all self-describing
- ✅ `CitationValidator`, `ParsedDocument`, `ParsedFileCache`, `FileCache` — clear without context
- ⚠️ `core/getLinkClass.ts` — `getLinkClass` tells you *what* it does but not *where* in the pipeline (display layer). Could be `getDisplayLinkClass.ts` to distinguish from the syntactic `linkType` field
- ⚠️ `normalizeAnchor.ts` exports two functions: `decodeUrlAnchor` and `normalizeBlockId`. The file name is a category, not an action — violates `^primary-export-pattern`

---

### 8. Safety-First Design — ⚠️ Partial

%% *Last Modified: 05/13/26 08:11:30* %%

**Fail Fast** `^fail-fast`
- ✅ `applyScope()` throws immediately on unresolvable scope
- ✅ `CitationValidator.validateFile()` throws on missing file before validation
- ✅ `FileCache.scanDirectory()` throws on unreadable directory
- ❌ `jact.ts:fix()` catches errors and returns an error string (line 1100–1103) instead of throwing — converts a hard failure into a silent-ish string return

**Clear Contracts** `^clear-contracts`
- ✅ Types are well-specified; discriminated unions make contracts machine-checkable
- ❌ `createCitationValidator()` has a hidden side effect: it calls `syncParserFileCache()` when the arg is `instanceof ParsedFileCache` (componentFactory.ts:84–86). This postcondition is not in the function signature or JSDoc — a caller passing a custom `ParsedFileCache` subclass would silently miss the sync

**Atomic Operations** `^atomic-operations`
- ❌ `jact.ts:fix()` writes the file in-place (line 1069: `writeFileSync(filePath, fileContent)`) with no backup or rollback. If a second fix application fails mid-write (OS error), the file is partially modified with no recovery path

---

### 9. Anti-Patterns — ❌ Violates

%% *Last Modified: 05/13/26 08:11:30* %%

**Branch Explosion** `^branch-explosion`
- ❌ `CitationValidator.validateCrossDocumentLink()` (lines 396–701): a 300-line method containing nested `if/else if/else` blocks 4–5 levels deep. The branching covers: wiki fast-path, wiki fail-path, directory detection, file-not-found with cache, cache hit (fuzzy vs exact), cross-directory match, anchor validation — all in one method. This is a direct branch-explosion anti-pattern instance
- ❌ `CitationValidator.resolveTargetPath()` (lines 761–836): strategy waterfall via sequential `if (isFile(...)) return` is implicit branching — better expressed as a `pathResolutionStrategies` array (matches the eligibility strategy chain pattern already used in ContentExtractor)

**Scattered Checks** `^scattered-checks`
- ❌ "Is this a cross-directory resolution?" is checked at four separate points in `validateCrossDocumentLink` (lines 479, 540, 641, 682). The `isCrossDirectory` flag is computed, used, then re-checked with slightly different logic in each branch. This is the same invariant being enforced in scattered code checks

**Leaky Flags** `^leaky-flags`
- ❌ `jact.ts:fix()` detects fixable issues by string-matching suggestion text: `link.validation.suggestion.includes("Use raw header format for better Obsidian compatibility")` (lines 1005, 1047). The fix mode depends on out-of-band knowledge of the exact suggestion string that CitationValidator generates — a leaky flag that will silently break if the suggestion text changes
- ❌ `jact.ts:applyAnchorFix()` parses the suggestion string with a regex (line 1194: `suggestion.match(/Use raw header format.../)`) — string-parsing an internal message as a data protocol

**Hidden Global State** `^hidden-global-state`
- ⚠️ `ParsedFileCache` (ParsedFileCache.ts) maintains a `Map<string, Promise<ParsedDocument>>` that persists across calls within a JactCli instance. This is necessary caching but is entirely invisible from the public interface. Not strictly "hidden" since it's a class field, but consumers have no way to inspect or flush the cache without using implementation details

---

## Document Hygiene

%% *Last Modified: 05/13/26 08:11:30* %%

| Check | Status |
|---|---|
| H1: Single top-level heading | ✅ All source files use single H1 (where markdown headers are present) |
| H2: Section headings logical | ✅ CLAUDE.md sections well-structured |
| H3: Subsection nesting correct | ✅ |
| Absolute paths in links | ✅ All links in this report use absolute paths |
| Dead links | None expected — all `src/` paths verified via inventory |

---

## Verdict

%% *Last Modified: 05/13/26 08:11:30* %%

**The repo is architecturally sound in its data model and DI wiring, but has grown two god-node files that are doing the work of four modules each.**

- `CitationValidator.ts` (1188 lines, 36 edges) and `jact.ts` (1611 lines, 21 edges) are the primary sprawl drivers
- Both files predate the `src/core/` component subdirectory convention — they never got migrated into it
- The `src/core/` modules (`MarkdownParser/`, `ContentExtractor/`) demonstrate the correct pattern: small focused files, local DI interfaces, action-named modules. The problem is not that the dev doesn't know the pattern — it's that CI-1 and CI-2 were never refactored once the pattern was established
- The anti-pattern density in `CitationValidator.validateCrossDocumentLink()` (branch explosion, scattered checks, leaky flags) is the single highest-risk area for regressions when adding new citation types

**Recommended order of attack:**
1. FN-1 through FN-5 (< 2 hours total) — clean up loose type duplication and single-file concerns
2. AR-1 (extract path resolution) — kills the branch explosion in CI-2 and makes path strategies testable
3. AR-2 (extract anchor matching) — makes CitationValidator ≤400 lines
4. AR-3 (split CLI wiring from JactCli) — makes JactCli programmatically importable and independently testable
5. AR-5 (move CitationValidator to `src/core/`) — normalize folder depth (cheapest after AR-1/AR-2 since imports already change)

AR-4 (eliminate in-place mutation) is the highest-risk refactor — defer until test coverage is ≥80%.
