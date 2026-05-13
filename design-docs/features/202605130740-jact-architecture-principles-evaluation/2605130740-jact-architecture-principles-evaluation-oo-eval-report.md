# OO Architecture Evaluation Report — jact

%% *Last Modified: 05/13/26 08:11:53* %%

%% *Generated: 2026-05-13* %%

---

## Evaluation Metadata

%% *Last Modified: 05/13/26 08:11:53* %%

| Field | Value |
|---|---|
| **Reviewer Role** | Architecture Compliance Reviewer — Object-Oriented Systems |
| **Principle Set** | `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/object-oriented/ARCHITECTURE-PRINCIPLES.md` |
| **Source Inventory** | 42 `.ts` files (`/tmp/jact-src-inventory.txt`) |
| **Repo Root** | `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact` |
| **Graph Context** | `graphify-out/GRAPH_REPORT.md` (376 nodes, 739 edges) |
| **Evaluation Mode** | Heuristic (Polya practical — plausible reasoning, no formal proofs) |

### Domain Vocabulary (20 terms)

%% *Last Modified: 05/13/26 08:11:53* %%

`CitationValidator`, `FileCache`, `JactCli`, `ParsedDocument`, `ParsedFileCache`, `MarkdownParser`, `ContentExtractor`, `ExtractionStrategy`, `LinkObject`, `AnchorObject`, `EnrichedLinkObject`, `ValidationMetadata`, `ValidationSummary`, `ExtractionEligibilityStrategy`, `LinkObjectFactory`, `componentFactory`, `resolveScope`, `computeValidationSummary`, `ResolveResult`, `ParserOutput`

### Files Evaluated (all 42)

%% *Last Modified: 05/13/26 08:11:53* %%

All files from `/tmp/jact-src-inventory.txt` were read and evaluated. Deep reads were performed on:
- `/src/CitationValidator.ts` (1,189 lines)
- `/src/FileCache.ts` (663 lines)
- `/src/jact.ts` (1,612 lines total; `JactCli` class ≈ 1,232 lines)
- `/src/factories/componentFactory.ts`
- `/src/factories/LinkObjectFactory.ts`
- `/src/core/MarkdownParser/MarkdownParser.ts`
- `/src/ParsedDocument.ts`
- `/src/ParsedFileCache.ts`
- `/src/core/ContentExtractor/ContentExtractor.ts`
- `/src/core/ContentExtractor/eligibilityStrategies/ExtractionStrategy.ts`
- `/src/core/ContentExtractor/eligibilityStrategies/StopMarkerStrategy.ts`
- `/src/types/citationTypes.ts`, `validationTypes.ts`, `contentExtractorTypes.ts`, `fileCacheTypes.ts`
- `/src/core/getLinkClass.ts`
- `/src/core/MarkdownParser/extractLinks.ts` (header)

---

## Principle Compliance Table

%% *Last Modified: 05/13/26 08:11:53* %%

| Principle | Status | Evidence |
|---|---|---|
| Black Box Interfaces | ⚠️ Partial | DI interfaces inside CitationValidator/ContentExtractor are good; `ParsedDocument._tokenIncludesChildrenInRaw` is not `private` despite `_` prefix (ParsedDocument.ts:302) |
| Composition Over Inheritance | ✅ Compliant | No inheritance chains deeper than 1 level; all composition via fields |
| Dependency Injection | ✅ Compliant | Constructor DI throughout; interfaces used at consumption points |
| Lightweight DI | ✅ Compliant | No Inversify/NestJS; plain `deps` pattern in factories |
| Replaceable Parts via Interfaces | ⚠️ Partial | CitationValidator/ContentExtractor define local consumer interfaces (good); factory signatures accept concrete types (`ParsedFileCache \| null`, `FileCache \| null`), not the interfaces (componentFactory.ts:57,75) |
| Extension Over Modification (OCP) | ✅ Compliant | Strategy pattern in `eligibilityStrategies/` enables adding rules without modifying ContentExtractor |
| Service Layer Separation | ❌ Violates | `JactCli` mixes orchestration + output formatting (verbose/minimal) + fix logic + CLI wiring in one class/file (jact.ts:118–1232) |
| Repository/Data Access Pattern | ➖ N/A | CLI tool; no persistent storage layer |
| MVC/MVP for UI | ➖ N/A | CLI, not a UI framework |
| Backup Creation | ❌ Violates | `JactCli.fix()` overwrites files in-place (jact.ts:1069: `writeFileSync(filePath, fileContent, "utf8")`) without creating a timestamped backup |
| Dry-Run Capability | ❌ Violates | No `--dry-run` flag or `preview()` method on fix path; user has no way to inspect changes before they are written |
| Idempotent Operations | ✅ Compliant | Validation is read-only and idempotent; fix is not fully idempotent but degrades gracefully |
| JSDoc/TSDoc on Public APIs | ✅ Compliant | All public class methods documented; factory functions documented |
| Class-Level Architecture Docs | ✅ Compliant | `MarkdownParser`, `FileCache`, `ParsedFileCache`, `ContentExtractor`, `ParsedDocument`, `JactCli` all have class-level docblocks |
| Selective Documentation | ✅ Compliant | Private helpers documented where non-trivial |
| Contextual Comments | ✅ Compliant | Pattern/Integration/Decision comments throughout JactCli orchestration methods |
| God Class Anti-Pattern | ❌ Violates | `CitationValidator` ≈ 1,189 lines; `JactCli` class alone ≈ 1,232 lines — both exceed the ~500-line smell threshold |
| Inheritance Hierarchy Sprawl | ✅ Compliant | `ExtractionStrategy → StopMarkerStrategy` etc. is 1 level only; no sprawl |
| Shared Mutable State | ⚠️ Risk | `FileCache.scope` and `FileCache.resolvedScopeFolder` are mutable fields set by `buildCache()` and read by `resolveFile()` — temporal coupling; `MarkdownParser.setFileCache()` mutable injection (MarkdownParser.ts:80) |
| Service Locator Anti-Pattern | ✅ Compliant | No global registry; all dependencies constructor-injected |
| Anemic Domain Model | ✅ Compliant | `ParsedDocument`, `FileCache`, `CitationValidator` all carry rich behavior |

---

## Critical Issues

%% *Last Modified: 05/13/26 08:11:53* %%

### CRIT-1 — God Class: `CitationValidator` (SRP)

%% *Last Modified: 05/13/26 08:11:53* %%

**Location**: `/src/CitationValidator.ts` (1,189 lines)  
**Graph signal**: 36 edges — highest betweenness centrality (0.108)

`CitationValidator` accumulates six distinct responsibilities in one class:

| Responsibility | Lines |
|---|---|
| Pattern classification | 302–340 |
| Path resolution (5 strategies: tilde, relative, Obsidian, symlink, FileCache) | 761–836 |
| Anchor existence validation | 838–972 |
| Flexible anchor matching (URL-decode, backtick, raw-text, markdown-clean) | 975–1042 |
| Path debug info generation | 161–193 |
| Path conversion suggestion generation | 1097–1113 |

`computeValidationSummary` (a pure aggregation function) is also exported from this file (1,158–1,188) despite having no dependency on `CitationValidator`.

**Principle violated**: `^god-class` — "A single class accumulating multiple unrelated responsibilities… file exceeds ~500 lines."

---

### CRIT-2 — God Class: `JactCli` (SRP + Service Layer Separation)

%% *Last Modified: 05/13/26 08:11:53* %%

**Location**: `/src/jact.ts` (`JactCli` class, lines 118–1,232; full file 1,612 lines)  
**Graph signal**: 21 edges

`JactCli` conflates:

| Responsibility | Lines |
|---|---|
| Component orchestration (validate → extract → fix flow) | 154–172, 191–214, 247–328 |
| CLI output formatting — verbose | 393–536 |
| CLI output formatting — minimal (LLM-optimized) | 544–636 |
| Auto-fix engine (applyPathConversion, applyAnchorFix, parseAvailableHeaders, findBestHeaderMatch, urlEncodeAnchor) | 966–1,231 |
| Line-range filtering | 340–383 |

**Principle violated**: `^god-class`, `^service-layer-separation` — formatting and fix logic should be separate classes (`CliFormatter`, `CitationFixer`).

---

### CRIT-3 — Missing Operational Safety on Fix Path

%% *Last Modified: 05/13/26 08:11:53* %%

**Location**: `JactCli.fix()`, `/src/jact.ts:966–1,105`

The fix command reads, modifies, and overwrites files in-place with no backup and no preview mode:

```typescript
// jact.ts:1069
writeFileSync(filePath, fileContent, "utf8");
```

**Principles violated**:
- `^backup-creation` — "Create automatic timestamped backups before destructive modifications."
- `^dry-run-capability` — "Allow previewing changes without modifying state."

**Risk**: A bad regex replacement or anchor mis-match corrupts the file. No recovery path without git.

---

## Prioritized Findings

%% *Last Modified: 05/13/26 08:11:53* %%

### Fix Now (< 30 min each)

%% *Last Modified: 05/13/26 08:11:53* %%

**FIX-1 — `_tokenIncludesChildrenInRaw` leaks private internals**  
File: `/src/ParsedDocument.ts:302`  
Method is public despite `_` convention. Change declaration to `private _tokenIncludesChildrenInRaw`.  
**Effort**: 1 min. No callers outside the class found.

---

**FIX-2 — `computeValidationSummary` misplaced in CitationValidator.ts**  
File: `/src/CitationValidator.ts:1158–1188`; imported by `jact.ts:28`  
This pure function has no dependency on `CitationValidator`. Move to `/src/core/computeValidationSummary.ts` (or co-locate in `validationTypes.ts`). Update import in `jact.ts`.  
**Effort**: 10 min.

---

**FIX-3 — `ValidationMetadata` warning variant misnames its field `error`**  
File: `/src/types/validationTypes.ts:46`  
```typescript
| {
    status: "warning";
    error: string;   // ← named "error" on a "warning" status — LSP smell
```
The field `error` on a `warning` variant is semantically inconsistent and violates the principle of least surprise for callers reading `link.validation.status === "warning"`. Rename to `message: string` and update all write sites in `CitationValidator.ts` (the `createValidationResult` private helper at line 1,118 maps `result.error` → `validation.error` for warnings).  
**Effort**: 20–25 min (type rename + 10–15 affected sites in `CitationValidator.ts`).

---

**FIX-4 — Duplicate `CliValidateOptions` type definitions**  
Files: `/src/jact.ts:66–73` (local, unexported) vs `/src/types/contentExtractorTypes.ts:111–116` (exported)  
The two definitions differ (`verbose`, `allowGitignore` fields exist only in the local one; `format` is narrower in the exported one). The local definition shadows the canonical type.  
Action: Extend the exported `CliValidateOptions` with the missing fields; delete the local shadow; import the canonical type in `jact.ts`.  
**Effort**: 15 min.

---

**FIX-5 — `ExtractionStrategy` base class should be `abstract`**  
File: `/src/core/ContentExtractor/eligibilityStrategies/ExtractionStrategy.ts`  
```typescript
export class ExtractionStrategy {
    getDecision(...): EligibilityDecision | null {
        return null;  // concrete default — subclass forgetting to override compiles silently
    }
}
```
The `ExtractionEligibilityStrategy` interface already exists in `contentExtractorTypes.ts:20–25`. Either (a) make `ExtractionStrategy` abstract with an abstract `getDecision`, or (b) eliminate the base class entirely and have strategies implement the interface directly. Option (b) removes unnecessary inheritance.  
**Effort**: 10 min. No behavioral change; TypeScript will catch any strategy missing the implementation at compile time.

---

### Architectural Rework Required (≥ 30 min)

%% *Last Modified: 05/13/26 08:11:53* %%

**REWORK-1 — Split `CitationValidator` by responsibility**  
**Scope**: `/src/CitationValidator.ts` + `/src/core/` + test suite under `test/unit/`  
**Trigger**: CRIT-1 above; god class at 1,189 lines, 36 edges  

Proposed extraction:
1. `/src/core/PathResolver.ts` — houses `resolveTargetPath`, `isObsidianAbsolutePath`, `convertObsidianToFilesystemPath`, `safeRealpathSync`, `isFile`, `isDirectory`, `generatePathResolutionDebugInfo` (currently CitationValidator private methods lines 113–193, 761–836). This is a cohesive strategy chain for path resolution.
2. `/src/core/AnchorMatcher.ts` — houses `findFlexibleAnchorMatch`, `cleanMarkdownForComparison`, `suggestObsidianBetterFormat`, `validateAnchorExists` logic (CitationValidator lines 838–1,070).
3. `CitationValidator` becomes a thin coordinator: pattern-classify → delegate to PathResolver → delegate to AnchorMatcher → return result.

Impact: `CitationValidator` should drop to ~300 lines. All three new classes are unit-testable in isolation.

---

**REWORK-2 — Extract `CliFormatter` and `CitationFixer` from `JactCli`**  
**Scope**: `/src/jact.ts` lines 393–636 (formatting) + 966–1,231 (fix engine)  
**Trigger**: CRIT-2 above; god class + service layer violation  

Proposed extraction:
1. `/src/CliFormatter.ts` — `formatForCLI`, `formatForCLIMinimal`, `formatAsJSON` become methods of a new `CliFormatter` class. `JactCli` holds a `CliFormatter` instance and delegates.
2. `/src/CitationFixer.ts` — `applyPathConversion`, `applyAnchorFix`, `parseAvailableHeaders`, `findBestHeaderMatch`, `urlEncodeAnchor`, `normalizeAnchorForMatching` become a `CitationFixer` class. `JactCli.fix()` creates/uses one.

`JactCli` after extraction: orchestration + scope management only (~400 lines).

---

**REWORK-3 — Add backup + dry-run to fix path**  
**Scope**: `/src/jact.ts:966–1,105` + new `/src/CitationFixer.ts` (post REWORK-2)  
**Trigger**: CRIT-3 above  

Implementation:
- Before `writeFileSync`: create `${filePath}.${Date.now()}.bak` backup.
- Add `--dry-run` option to `validate --fix` CLI command. When set, print the diff but do not write.
- `CitationFixer.applyFixes(content, fixes, { dryRun: boolean })` — returns patched content without writing when `dryRun: true`.

---

**REWORK-4 — Resolve factory signature coupling to concrete types**  
**Scope**: `/src/factories/componentFactory.ts`  
**Trigger**: FIX principle `^replaceable-parts-via-interfaces`  

`createCitationValidator(parsedFileCache: ParsedFileCache | null, fileCache: FileCache | null)` accepts concrete classes. The interfaces `ParsedFileCacheInterface` and `FileCacheInterface` are already defined inline inside `CitationValidator.ts` (lines 17–47). Move these interfaces to a shared `/src/types/componentInterfaces.ts` and update factory signatures to accept the interfaces, not the concrete classes. This enables test injection without importing production classes.

**Note**: The `syncParserFileCache(fc: FileCache)` workaround (componentFactory.ts:85–86, ParsedFileCache.ts:40) is a consequence of `MarkdownParser` needing to share the same scope-seeded `FileCache` as `CitationValidator`. This temporal coupling is addressed once `PathResolver` (REWORK-1) holds its own `FileCache` reference passed at construction time, removing the need for post-construction mutation.

---

**REWORK-5 — Split `contentExtractorTypes.ts` kitchen-sink type file**  
**Scope**: `/src/types/contentExtractorTypes.ts` (12+ type definitions)  
**Trigger**: ISP — CLI option types mixed with strategy interfaces and output contracts  

Split into:
- `/src/types/strategyTypes.ts` — `ExtractionEligibilityStrategy`, `EligibilityDecision`, `CliFlags`
- `/src/types/extractionTypes.ts` — `SourceLinkEntry`, `ExtractedContentBlock`, `OutgoingLinksReport`, `ExtractionStats`, `OutgoingLinksExtractedContent`, `ProcessedLinkEntry`
- `/src/types/cliTypes.ts` — `CliValidateOptions`, `CliExtractOptions`, `FormattedValidationResult`, `FixDetail`

`contentExtractorTypes.ts` becomes a re-export barrel if backward compatibility is needed.

---

## Document Hygiene

%% *Last Modified: 05/13/26 08:11:53* %%

### H1 — No blocking hygiene issues

%% *Last Modified: 05/13/26 08:11:53* %%

The principle file is well-structured (5 `##` sections, consistent anchor IDs, no broken links detected).

### H2 — Minor

%% *Last Modified: 05/13/26 08:11:53* %%

- `ValidationMetadata.warning` variant field named `error` creates reader confusion (`validationTypes.ts:46`) — see FIX-3.
- Comment `// D-003: CliExtractOptions imported from ./types/contentExtractorTypes.js (canonical type)` at `jact.ts:75` references a design doc notation inline — useful but not self-explanatory without the design doc.

### H3 — Nitpick

%% *Last Modified: 05/13/26 08:11:53* %%

- `biome-ignore lint/suspicious/noExplicitAny` in `applyAnchorFix` (`jact.ts:1193`) — tracked as issue #97, but tech debt policy says fix in current PR. This becomes automatically resolvable when `CitationFixer` is typed correctly (REWORK-2).
- `ExtractionStrategy.getDecision` comment "Strategy Pattern: Each rule encapsulated in its own class" is accurate but the implementation betrays the comment (concrete base, not abstract). See FIX-5.

---

## Verdict

%% *Last Modified: 05/13/26 08:11:53* %%

**NOT COMPLIANT** — 3 critical violations, 2 partial compliance findings, 5 quick fixes, 5 architectural rework items.

The repo demonstrates strong foundational OO instincts (constructor DI, strategy pattern, facade over parser output, type-safe discriminated unions). The primary failure mode is **accumulation** — responsibilities that were correct to add incrementally became entrenched without the corresponding splits. `CitationValidator` and `JactCli` are the dominant debt carriers.

**Priority order for cleanup**:
1. FIX-1 through FIX-5 (all < 30 min, zero behavioral risk)
2. REWORK-3 (backup/dry-run — operational safety; should block any future release of `--fix`)
3. REWORK-2 (split JactCli — unblocks REWORK-3 with cleaner fix path)
4. REWORK-1 (split CitationValidator — largest payoff for test isolation and future feature additions)
5. REWORK-4 and REWORK-5 (interface cleanup — lower urgency, do with REWORK-1 to avoid double-touch)
