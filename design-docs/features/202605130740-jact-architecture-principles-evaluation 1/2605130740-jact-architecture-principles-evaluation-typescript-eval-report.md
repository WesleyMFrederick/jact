# TypeScript Principles Evaluation — jact

%% *Last Modified: 05/13/26 08:11:01* %%

---

## Evaluation Metadata

%% *Last Modified: 05/13/26 08:11:01* %%

| Field | Value |
|---|---|
| **Role** | Architecture compliance reviewer — TypeScript systems |
| **Principle Set** | [typescript-principles.md](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/typescript/typescript-principles.md) |
| **Domain Vocabulary** | TypeScript, ESM, strict mode, discriminated unions, DI, barrel files |
| **Files Evaluated** | 42 `.ts` files (full inventory + targeted deep reads) |
| **Graph Context** | God nodes: `CitationValidator` (36e), `FileCache` (30e), `JactCli` (21e) |
| **Date** | 2026-05-13 |

---

## Principle Compliance Table

%% *Last Modified: 05/13/26 08:11:01* %%

| # | Principle | Status | Evidence |
|---|---|---|---|
| 1 | Strict Mode Always On | ✅ | `tsconfig.json` has `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| 2 | No Any Unless Necessary | ❌ | `jact.ts:1193` — `link: any` with `biome-ignore` bypass; `biome.json` lacks `noExplicitAny` enforcement |
| 3 | Import Type Discipline | ✅ | `import type` used consistently across all 42 files |
| 4 | Static Imports Only | ❌ | `jact.ts:197` — `await import("node:path")` inside async method |
| 5 | Const by Default | ✅ | No `let` misuse found |
| 6 | Screaming Snake Constants | ✅ | `CACHE_DIR`, `EMPTY_USAGE` patterns present |
| 7 | Discriminated Unions on Type Field | ✅ | `ValidationMetadata`, `AnchorObject`, `ResolveResult` all correct |
| 8 | Export type for Unions / interface for Shapes | ✅ | Consistent across `src/types/*.ts` |
| 9 | Kebab-Case Self-Contained File Naming | ❌ | PascalCase throughout: `CitationValidator.ts`, `FileCache.ts`, `ParsedDocument.ts`, `ParsedFileCache.ts`, `LinkObjectFactory.ts`, all 5 strategy files |
| 10 | Barrel File is Pure Re-Export | ✅ | `src/core/MarkdownParser/index.ts` is a single re-export line |
| 11 | Package Root as Public Surface | ❌ | No top-level `src/index.ts` barrel — public API surface is undefined |
| 12 | Module-Level JSDoc for Architectural Intent | ⚠️ | `jact.ts` ✅; `CitationValidator.ts` ❌ (starts with imports, no preamble); `FileCache.ts` needs checking |
| 13 | JSDoc on Every Exported Type | ⚠️ | Types in `src/types/*.ts` have JSDoc; inline DI interfaces in `CitationValidator.ts` partially documented |
| 14 | TSDoc Not Classic JSDoc | ⚠️ | `@param` restates signature shapes in several methods (e.g., `CitationValidator.ts:244-246`) |
| 15 | Contract Blocks in JSDoc | ❌ | No `Contract:` blocks found in any exported function; behavioral guarantees undocumented |
| 16 | Type-vs-Runtime Drift | ❌ | `applyAnchorFix` accesses `link.validation.suggestion` / `link.validation.error` at runtime on `any` — compiler cannot catch property errors |
| 17 | noUncheckedIndexedAccess respected | ❌ | `ContentExtractor.ts:184` and `extractLinksContent.ts:122` assert away `| undefined` with `as` instead of guarding |
| 18 | Interface Segregation | ❌ | `contentExtractorTypes.ts` is a kitchen sink: CLI flags, strategies, extraction types, fix records, CLI options — 7 unrelated concern groups in one file |
| 19 | No Type Duplication | ❌ | `CliValidateOptions` exists in both `jact.ts:66` (local, 6 fields) and `contentExtractorTypes.ts:111` (exported, 4 fields) — fields have diverged; `PathConversion` similarly duplicated between `jact.ts:106` and `validationTypes.ts:25` |
| 20 | File Size / God File | ❌ | `jact.ts` = 1,611 lines; `CitationValidator.ts` = 1,188 lines; both violate Core Minimal principle |

---

## Critical Issues

%% *Last Modified: 05/13/26 08:11:01* %%

### CI-01 — Enrichment Pattern Bypasses Type System (CitationValidator.ts:222, 267-268)

%% *Last Modified: 05/13/26 08:11:01* %%

```typescript
// Line 222 — double-cast to escape type system
const enrichedLinks = links as unknown as ValidationResult["links"];

// Lines 267-268 — in-place mutation cast
(citation as EnrichedLinkObject).validation = validation;
return citation as EnrichedLinkObject;
```

**Problem**: The in-place enrichment pattern (`LinkObject` → `EnrichedLinkObject` by mutation) requires `as unknown as T` because TypeScript cannot verify the mutation. This is structurally sound at runtime but semantically opaque. `noUncheckedIndexedAccess` is correctly enabled, then circumvented here.

**Fix path**: Either (a) model `EnrichedLinkObject` as a factory output (`enrichLinkObject(link: LinkObject, meta: ValidationMetadata): EnrichedLinkObject`) that constructs a new object with spread, eliminating the mutation+cast; or (b) accept the pattern but narrow the cast surface — remove the double `as unknown as` at line 222 by returning `EnrichedLinkObject[]` directly from `validateSingleCitation` callsites.

---

### CI-02 — `any` Type on `applyAnchorFix` (jact.ts:1193)

%% *Last Modified: 05/13/26 08:11:01* %%

```typescript
// biome-ignore lint/suspicious/noExplicitAny: pre-existing untyped method, tracked in #97
private applyAnchorFix(citation: string, link: any): string {
    const suggestionMatch = link.validation.suggestion.match(...)
```

**Problem**: `link.validation.suggestion` is accessed on `any` — TypeScript cannot verify this property chain. This is the exact scenario `noExplicitAny` exists to prevent. The `biome-ignore` comment acknowledges the debt but the `any` should be `EnrichedLinkObject` (which already has `validation.suggestion` typed).

**Fix path**: Change parameter type to `EnrichedLinkObject`. The method is already inside `JactCli` which imports `EnrichedLinkObject`.

---

### CI-03 — Type Duplication: `CliValidateOptions` (jact.ts:66 vs contentExtractorTypes.ts:111)

%% *Last Modified: 05/13/26 08:11:01* %%

Local definition in `jact.ts:66-73`:
```typescript
interface CliValidateOptions {
    scope?: string; lines?: string; format?: string;
    fix?: boolean; verbose?: boolean; allowGitignore?: boolean;  // 6 fields
}
```

Exported canonical in `contentExtractorTypes.ts:111-116`:
```typescript
export interface CliValidateOptions {
    format?: "cli" | "json"; lines?: string; scope?: string; fix?: boolean;  // 4 fields
}
```

**Problem**: Two types with the same name, different field sets. Local one adds `verbose`, `allowGitignore`, and uses `format?: string` (not the literal union). The canonical one has `format?: "cli" | "json"`. These have silently diverged. `jact.ts` also imports from `contentExtractorTypes.ts` for other types but shadows `CliValidateOptions` locally.

**Fix path**: Delete local `CliValidateOptions` in `jact.ts`. Add `verbose` and `allowGitignore` to the canonical exported type in `contentExtractorTypes.ts`. Tighten `format` to `"cli" | "json"` in local usage.

---

### CI-04 — `noUncheckedIndexedAccess` Bypassed via Cast

%% *Last Modified: 05/13/26 08:11:01* %%

```typescript
// ContentExtractor.ts:184
const block = extractedContentBlocks[contentId] as ExtractedContentBlock;

// ContentExtractor.ts:145 and extractLinksContent.ts:122
const decodedPath = decodeURIComponent(link.target.path.absolute as string);
```

**Problem**: `noUncheckedIndexedAccess` adds `| undefined` to index access results. Casting with `as T` silently drops the `undefined` branch — the precise bug the strict flag catches. `link.target.path.absolute` is typed `string | null` in `LinkObject`, so the `as string` cast additionally hides a legitimate `null` path.

**Fix path**:
- Line 184: Guard with `if (!block) throw new Error(...)` before cast, or use optional chaining + nullish coalescing.
- Lines 145/122: Guard `link.target.path.absolute` with `if (link.target.path.absolute == null) return;` before the `decodeURIComponent` call.

---

## Prioritized Findings

%% *Last Modified: 05/13/26 08:11:01* %%

### Fix Now (<30 min each)

%% *Last Modified: 05/13/26 08:11:01* %%

| ID | File | Line | Issue | Fix |
|---|---|---|---|---|
| F-01 | `jact.ts` | 1193 | `link: any` → type it as `EnrichedLinkObject` | Change param type; remove `biome-ignore` |
| F-02 | `jact.ts` | 197 | `await import("node:path")` | Move to top-level static import |
| F-03 | `jact.ts` | 106 | `PathConversion` duplicates `validationTypes.ts:25` | Delete local, import canonical |
| F-04 | `jact.ts` | 66 | `CliValidateOptions` duplicates `contentExtractorTypes.ts:111` | Delete local, extend canonical |
| F-05 | `ContentExtractor.ts` | 184 | `as ExtractedContentBlock` bypasses `noUncheckedIndexedAccess` | Guard with null check |
| F-06 | `ContentExtractor.ts` | 145 | `as string` on `string \| null` path | Guard null before call |
| F-07 | `extractLinksContent.ts` | 122 | Same as F-06 | Same fix |
| F-08 | `CitationValidator.ts` | 259 | `result.status as "error" \| "warning"` | Restructure `if` to narrow naturally |

### Architectural Rework Required (≥30 min)

%% *Last Modified: 05/13/26 08:11:01* %%

| ID | Scope | Issue | Effort |
|---|---|---|---|
| A-01 | `jact.ts` (1,611 lines) | God file: CLI routing + output formatting + fix logic + AST command all in one class. Violates Core Minimal principle. | High — split into `JactValidateCommand`, `JactFixCommand`, `JactAstCommand`, `JactExtractCommand` and thin orchestrator |
| A-02 | `CitationValidator.ts` (1,188 lines) | Second god file: validation logic + pattern classification + anchor fix + path conversion all interleaved. | High — extract `AnchorFixApplicator`, `PathResolver`, `PatternClassifier` as separate modules |
| A-03 | `contentExtractorTypes.ts` | Kitchen-sink types file: CLI flags + strategy interface + extraction types + fix details in one file. No interface segregation. | Medium — split into `cli-types.ts`, `extraction-types.ts`, `fix-types.ts` |
| A-04 | File naming (PascalCase) | 11 files violate kebab-case naming: `CitationValidator.ts`, `FileCache.ts`, `ParsedDocument.ts`, `ParsedFileCache.ts`, `ParsedFileCache.ts`, `LinkObjectFactory.ts`, `ExtractionStrategy.ts`, `ForceMarkerStrategy.ts`, `SectionLinkStrategy.ts`, `StopMarkerStrategy.ts`, `CliFlagStrategy.ts` | Medium — rename + update imports + update `dist/` references |
| A-05 | No `src/index.ts` barrel | Public API surface undefined. Callers import from internal paths (`./CitationValidator.js`, `./FileCache.js`). | Low-Medium — create barrel that exports public surface; add to `package.json` exports map |
| A-06 | Enrichment pattern (CI-01) | `as unknown as EnrichedLinkObject` double-cast is structural debt. Alternative: factory function returning new object with spread + validation property | Medium — affects `CitationValidator.validateFile`, `validateSingleCitation`; tests need updating |

---

## Document Hygiene

%% *Last Modified: 05/13/26 08:11:01* %%

### H1 — Missing Module-Level JSDoc (Architectural Boundary Statement)

%% *Last Modified: 05/13/26 08:11:01* %%

`CitationValidator.ts` has no file preamble. Per principle `^tsdoc-file-preamble-purpose-responsibilities-boundaries`, the preamble must state:
- One-line purpose
- Responsibilities bullet list
- Explicit boundary clause ("Only this module validates file citations")
- `@see` link to design doc

`FileCache.ts` has JSDoc on the class but not a file-level `/** ... */` comment.

### H2 — No `Contract:` Blocks

%% *Last Modified: 05/13/26 08:11:01* %%

`grep -rn "Contract:" src/` returns zero results. Every exported async function (`CitationValidator.validateFile`, `CitationValidator.validateSingleCitation`, `ContentExtractor.extractContent`) has behavioral obligations (does-not-throw? enriches in-place?) that are invisible in the signature. The principle explicitly requires `Contract:` blocks on async/streaming boundaries.

### H3 — TSDoc Signature Restatement

%% *Last Modified: 05/13/26 08:11:01* %%

`CitationValidator.ts:244-246`:
```typescript
* @param citation - LinkObject to validate (enriched in-place)
* @param contextFile - Source file path for relative path resolution
* @returns The same LinkObject enriched with validation property
```

The `@param` types duplicate the signature. Per `^tsdoc-document-the-residue`, these should focus on behavioral contract, not the shape — the shape is the TypeScript signature. Acceptable exception: "enriched in-place" is a behavioral note not in the type; "The same LinkObject" is the mutation guarantee. These should be kept but reformatted as `@remarks` or a `Contract:` block, not `@param`/`@returns` shape restatements.

---

## Verdict

%% *Last Modified: 05/13/26 08:11:01* %%

**Overall: ❌ Non-compliant — systemic gaps in file naming, module boundaries, and documentation discipline.**

**Compliant domains**: Discriminated unions, `import type` discipline, strict mode enabled, const hygiene, barrel purity.

**Failing domains**:
1. **File naming** — 11/42 files violate kebab-case (A-04). This is cosmetic but widespread.
2. **Module boundaries** — Two god files (`jact.ts`, `CitationValidator.ts`) at 1,611 and 1,188 lines violate Core Minimal and make the graph's Community 0/1 low-cohesion scores (0.06–0.09) structurally inevitable.
3. **Type duplication** — `CliValidateOptions` and `PathConversion` both duplicated between local and canonical definitions. Canonical and local have already diverged.
4. **`noUncheckedIndexedAccess` circumvented** — 3 cast sites silence the guard the tsconfig was configured to enforce.
5. **No `Contract:` blocks** — zero coverage on a repo that has async enrichment, in-place mutation, and multi-step resolution chains.
6. **No public barrel** — No `src/index.ts`; consumers must import internal paths.

**Immediate priority order**: F-01 → F-02 → F-03+F-04 (30 min total) → CI-04 fixes (F-05,F-06,F-07) → A-03 (interface segregation) → A-01 (jact.ts split).
