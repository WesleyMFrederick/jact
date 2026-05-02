# Plan: `jact extract` smart default scope — Implementation

%% *Last Modified: 05/01/26 19:13:19* %%

## Context

%% *Last Modified: 05/01/26 19:13:19* %%

Source design: `design-docs/features/20260501-extract-smart-default-scope/plan.md` (LOCKED through Phase 6).

Implements D1–D7 from §[7. Phase 5 — Delta Architecture](plan.md#7.%20Phase%205%20—%20Delta%20Architecture)

- **D1**: Add `resolveScope()` pure util — walk-up `.git`/`package.json` from cwd or target file
- **D2**: Refactor `FileCache` `cache + duplicates` dual-state → single `entries: Map<string, string[]>`
- **D3**: Extract `applyScope()` private helper on `JactCli`; eliminate 3× scattered `if (options.scope)` blocks; drop spurious `await`
- **D4**: Add `--verbose` to `extract file/header/links`; minimal default mirrors `validate`
- **D5**: Update Commander `--scope` help text to document inference algorithm
- **D6**: Update `jact/CLAUDE.md` examples to omit `--scope` for in-repo calls
- **D7**: Smart error messages M1 (not-found + near-misses), M2 (duplicate + candidate list), M3 (no-scope + tried fallbacks)

**Why:** Eliminates baseline friction where every in-repo `jact extract` call required absolute `--scope`. See plan §2 + §6.5 for full rationale.

---

## Gaps Surfaced (CLAUDE.md Rule 1: Don't assume)

%% *Last Modified: 05/01/26 19:13:19* %%

These gaps were identified between design plan and actual codebase. Decisions made are flagged; tradeoffs surfaced for USER review.

| # | Gap | Decision (this plan) | Tradeoff |
|---|-----|----------------------|----------|
| G1 | §7c places `ResolveResultFailure.{candidates,scope,nearMisses}` in `src/types/validationTypes.ts`, but those types live **inline** in `src/FileCache.ts:10-24`. Header comment at L1-2 says: "If future components need these types, migrate to `src/types/fileCacheTypes.ts`" | Migrate `ResolveResult*` types to **new** `src/types/fileCacheTypes.ts` (matches header comment guidance). `applyScope` (D3) consumes `ResolveResultFailure` to render M1/M2 errors → triggers migration. | Alternative: keep inline. Rejected because `applyScope` is the second consumer, satisfying header comment migration trigger. `validationTypes.ts` is wrong home (not validation domain). |
| G2 | §8a test paths use `test/unit/...` and `test/integration/...` subdirs, but current layout is flat `test/*.test.{js,ts}` + `test/integration/` + `test/cli-integration/` (no `test/unit/`) | Place tests as design specified: create `test/unit/` for pure-unit tests; reuse existing `test/integration/` and `test/cli-integration/` (CLI tests go in `cli-integration/`, not `integration/`). | Alternative: keep flat. Rejected — design §8a is explicit. New `test/unit/` subdir is a one-time cost. |
| G3 | §8a test file `test/unit/findNearMisses.test.ts` implies a standalone helper, but §7c specifies `findNearMisses` as a **private** method on `FileCache`. Private methods can't be unit-tested directly without exposing them. | Make `findNearMisses` a **module-level export** in `src/FileCache.ts` (or co-locate in same file as named export). FileCache uses it as instance behavior; tests import the pure function directly. | Alternative: package-private + `// @internal` comment + test via `FileCache.resolveFile` integration. Rejected — design §8g has 6 dedicated unit assertions for the helper, requiring direct import. |
| G4 | `extractFile` signature is `extractFile(targetFile: string, options: ExtractOptions)`. `extractHeader`/`extractLinks` have similar shapes. **`extract links` does not have a `targetFile`** — its first arg is the source markdown to scan, but the "target" for scope resolution is that same file's directory. | `applyScope` accepts `targetFile?: string`. For `extract links`, pass the source file path as `targetFile` for walk-up purposes. | None. The source file's directory IS a valid root for `extract links` walk-up. |
| G5 | Markdown formatter (`formatExtractResult.ts:20-32`) already strips reports/stats — only content joined by `\n---\n`. JSON formatter dumps everything. | D4 affects **JSON path primarily**: minimal JSON output = `{ extractedContentBlocks }` only. **Markdown path** for `--verbose` requires new behavior: markdown verbose appends a JSON-stringified `{ outgoingLinksReport, stats }` footer (or separate sections). | Alternative: leave markdown unchanged (already minimal). Rejected — design §8e explicitly requires `extract header --verbose` markdown to "include link reports + stats". |
| G6 | Test suite is currently `npm test` → `vitest`, not `bun test` (per template). Project does not use bun for testing. | Verification commands use `npm test` and `npx vitest run <path>`. | None — match project convention. |

---

## Baseline Tracing Guide

%% *Last Modified: 05/01/26 19:13:19* %%

### Folder map

%% *Last Modified: 05/01/26 19:13:19* %%

```
src/
  jact.ts                       ← MODIFIED — add applyScope, --verbose, replace 3× scope blocks
  FileCache.ts                  ← MODIFIED — entries Map, candidates, findNearMisses export
  formatExtractResult.ts        ← MODIFIED — add minimal/verbose mode
  core/
    resolveScope.ts             ← ADDED — pure scope inference util
  types/
    fileCacheTypes.ts           ← ADDED — moves ResolveResult*, CacheStats from FileCache.ts inline
    validationTypes.ts          ← UNTOUCHED — wrong home for ResolveResult (per G1)
    citationTypes.ts            ← UNTOUCHED
    contentExtractorTypes.ts    ← UNTOUCHED

test/
  unit/                         ← ADDED (new subdir, see G2)
    core/
      resolveScope.test.ts      ← NEW (D1 — 12 assertions)
    FileCache.test.ts           ← NEW (D2 — 11 assertions, NEW because no existing FileCache unit test)
    FileCache.errors.test.ts    ← NEW (D7 M1/M2 — 8 assertions)
    findNearMisses.test.ts      ← NEW (D7 helper — 6 assertions)
    formatExtractResult.test.ts ← NEW (D4 formatter — 2 assertions)
  integration/
    extract-default-scope.test.ts  ← NEW (D3 — 8 assertions)
    extract-verbose.test.ts        ← NEW (D4 CLI — 10 assertions)
  cli-integration/
    cli-help.test.ts            ← NEW (D5 — 5 assertions)

jact/CLAUDE.md                  ← MODIFIED (D6 — examples drop --scope for in-repo)
~/.claude/CLAUDE.md             ← UNTOUCHED (D6 — JACT SCOPE RULE already retired)
```

### LSP commands to run before coding

%% *Last Modified: 05/01/26 19:13:19* %%

```
# Confirm callers of the 3 extract methods being modified
LSP findReferences: src/jact.ts:555 (extractLinks)
LSP findReferences: src/jact.ts:645 (extractHeader)
LSP findReferences: src/jact.ts:738 (extractFile)

# Confirm callers of FileCache public API (resolveFile, buildCache)
LSP findReferences: src/FileCache.ts:175 (resolveFile)
LSP findReferences: src/FileCache.ts:92  (buildCache)

# Confirm any external consumers of ResolveResult / CacheStats types (should be zero outside FileCache.ts pre-migration)
LSP findReferences: src/FileCache.ts:24  (ResolveResult)
LSP findReferences: src/FileCache.ts:3   (CacheStats)

# Confirm ParsedFileCache, CitationValidator interactions with FileCache
LSP documentSymbol: src/CitationValidator.ts
LSP documentSymbol: src/ParsedFileCache.ts

# Verify validate (reference pattern for --verbose)
LSP documentSymbol: src/jact.ts  # locate validate at L181, formatter calls
```

### Key files to read (in order)

%% *Last Modified: 05/01/26 19:13:19* %%

1. **`src/jact.ts:181-256`** — `validate` method: minimal-default + `--verbose` pattern to mirror in D4
2. **`src/jact.ts:555-606`, `645-701`, `738-813`** — three target methods (extractLinks/Header/File); identical scope-handling shape
3. **`src/jact.ts:1276-1437`** — Commander definitions for `extract links/header/file`; option strings to update for D4 + D5
4. **`src/FileCache.ts:60-229`** — full class + types: confirm `cache`/`duplicates` consumers, `resolveFile` failure paths, `findFuzzyMatch` (preserve)
5. **`src/formatExtractResult.ts:1-39`** — current formatter; D4 adds `mode: 'minimal' | 'verbose'`
6. **`design-docs/features/20260501-extract-smart-default-scope/plan.md` §7a–§7c, §8b–§8g** — Delta + naming + BDD assertions (single source of truth)

---

## Tech Debt

%% *Last Modified: 05/01/26 19:13:19* %%

LSP audit per CLAUDE.md TECH DEBT POLICY: fix in same PR.

### Fix Required

%% *Last Modified: 05/01/26 19:13:19* %%

#### `src/jact.ts:653` — TS80007 spurious `await` in `extractHeader`

%% *Last Modified: 05/01/26 19:13:19* %%

```diff
- if (options.scope) {
- await this.fileCache.buildCache(options.scope);
- }
+ // Replaced by applyScope helper (D3) — see File Changes
```

#### `src/jact.ts:745` — TS80007 spurious `await` in `extractFile`

%% *Last Modified: 05/01/26 19:13:19* %%

```diff
- if (options.scope) {
- await this.fileCache.buildCache(options.scope);
- }
+ // Replaced by applyScope helper (D3) — see File Changes
```

Both fall inside D3 scope; collapse into the helper migration.

---

## File Changes

%% *Last Modified: 05/01/26 19:13:19* %%

### ADDED

%% *Last Modified: 05/01/26 19:13:19* %%

#### `src/core/resolveScope.ts`

%% *Last Modified: 05/01/26 19:13:19* %%

```typescript
// Pure function — no I/O beyond fs.existsSync
// Algorithm: ① explicit → ② cwd .git → ③ cwd package.json → ④ targetFile .git → ⑤ targetFile package.json → ⑥ none

import type { ScopeResolution, ResolveScopeInput } from "../types/fileCacheTypes.js";

export interface ResolveScopeInput {
  explicit?: string;
  cwd: string;
  targetFile?: string;
  fs?: typeof import("fs");  // injectable for tests
}

export type ScopeSource =
  | "explicit"
  | "cwd-git"
  | "cwd-pkg"
  | "target-git"
  | "target-pkg"
  | "none";

export interface ScopeResolution {
  scope: string;        // resolved abs path; empty when source === 'none'
  source: ScopeSource;
  triedFallbacks?: string[];  // for D7 M3 error message; populated when source === 'none'
}

export function resolveScope(input: ResolveScopeInput): ScopeResolution;

// Helper (private to module):
// walkUpFor(startDir: string, marker: '.git' | 'package.json', fs): string | null
//   - normalize, walk up via path.dirname until found or root reached
//   - returns directory containing marker, or null
```

#### `src/types/fileCacheTypes.ts`

%% *Last Modified: 05/01/26 19:13:19* %%

```typescript
// Migrated from src/FileCache.ts inline (per file header comment guidance, G1)
// Types now consumed by: FileCache, JactCli.applyScope, error formatters

export interface CacheStats {
  totalFiles: number;
  duplicates: number;
  scopeFolder: string;
  realScopeFolder: string;
}

export interface ResolveResultSuccess {
  found: true;
  path: string;
  fuzzyMatch?: boolean;
  correctedFilename?: string;
  message?: string;
}

export interface ResolveResultFailure {
  found: false;
  reason: "duplicate" | "not_found" | "duplicate_fuzzy";
  message: string;
  // D7 additions (optional fields populated based on `reason`):
  candidates?: string[];           // when reason: 'duplicate' | 'duplicate_fuzzy'
  scope?: import("../core/resolveScope.js").ScopeResolution;  // always populated
  nearMisses?: string[];           // when reason: 'not_found'; top-3 Levenshtein ≤2
}

export type ResolveResult = ResolveResultSuccess | ResolveResultFailure;
```

#### `test/unit/core/resolveScope.test.ts`

%% *Last Modified: 05/01/26 19:13:19* %%

```typescript
// 12 assertions per design §8b
// Test pattern: temp dir fixtures w/ os.tmpdir() + mkdtempSync; create .git/, package.json files
// Inject fs in `resolveScope({ ..., fs })` to mock when needed
//
// describe("resolveScope — explicit override")          [2 assertions]
// describe("resolveScope — cwd marker walk-up")         [5 assertions: cwd-git, nested 3-deep, cwd-pkg, both colocated, sub-package within parent]
// describe("resolveScope — targetFile fallback")        [3 assertions: target-git, target-pkg, cwd wins over target]
// describe("resolveScope — fail-fast none")             [2 assertions: source 'none', triedFallbacks populated]
// describe("resolveScope — purity")                     [2 assertions: deterministic, no I/O beyond existsSync]
```

#### `test/unit/FileCache.test.ts`

%% *Last Modified: 05/01/26 19:13:19* %%

```typescript
// 11 assertions per design §8c
// Setup: temp scope dir w/ varying duplicate-name fixtures
//
// describe("FileCache — entries data shape")         [3 assertions]
// describe("FileCache — addToCache append semantics")[3 assertions]
// describe("FileCache — resolveFile single match")   [1 assertion]
// describe("FileCache — resolveFile duplicate match")[3 assertions: candidates, scan order, message lists]
// describe("FileCache — backward compatibility")     [2 assertions: cache.has migration, duplicates check migration]
```

#### `test/unit/FileCache.errors.test.ts`

%% *Last Modified: 05/01/26 19:13:19* %%

```typescript
// D7 M1 + M2 (M3 covered in extract-default-scope.test.ts integration)
// 8 assertions per design §8g M1 + M2 sections
//
// describe("M1 — not-found error format")            [4 assertions: scope=, source=, Did you mean top-3, omitted when zero]
// describe("M2 — duplicate error format")            [4 assertions: matched N files, indented paths, Pass --scope, source=]
```

#### `test/unit/findNearMisses.test.ts`

%% *Last Modified: 05/01/26 19:13:19* %%

```typescript
// 6 assertions per design §8g findNearMisses section
// Imports: import { findNearMisses } from "../../src/FileCache.js";  (per G3 — module-level export)
//
// describe("findNearMisses — Levenshtein top-3 distance ≤2")
//   - distance 1 returns single match
//   - distance > 2 returns []
//   - 5 within range → exactly 3 sorted by ascending distance
//   - empty entries → []
//   - exact match excluded (none exist case)
//   - identical-distance ordering stable (insertion order)
```

#### `test/unit/formatExtractResult.test.ts`

%% *Last Modified: 05/01/26 19:13:19* %%

```typescript
// 2 assertions per design §8e formatExtractResult section
//
// describe("formatExtractResult — minimal mode")
//   - given mode 'minimal' → returns object with only extractedContentBlocks
//   - given mode 'verbose' → returns full result unchanged
```

#### `test/integration/extract-default-scope.test.ts`

%% *Last Modified: 05/01/26 19:13:19* %%

```typescript
// 8 assertions per design §8d (D3 applyScope + D7 M3)
// Setup: spawn jact CLI via child_process; fixture dirs w/ controlled .git presence
//
// describe("extract file — default scope inference")   [4 assertions: cwd-in-repo no flag, explicit wins, target walk-up, M3 fail]
// describe("extract header — default scope inference") [1 assertion: mirrors extract file]
// describe("extract links — default scope inference")  [1 assertion: mirrors extract file]
// describe("applyScope — duplication elimination")     [2 assertions: 3 sites unified, M3 thrown before FileCache]
// describe("applyScope — sync semantics tech debt")    [1 assertion: no spurious await in source]
//
// Note: "source inspection" assertions can be done via `fs.readFileSync('src/jact.ts')` + regex,
// or via TypeScript compiler API. Simpler path: read source, assert no `await this.fileCache.buildCache(`.
```

#### `test/integration/extract-verbose.test.ts`

%% *Last Modified: 05/01/26 19:13:19* %%

```typescript
// 10 assertions per design §8e (D4 CLI)
// Setup: spawn jact CLI; capture stdout
//
// describe("extract file — output mode default")  [3 assertions: minimal default, omits report, omits stats]
// describe("extract file — --verbose mode")       [2 assertions: includes all 3 keys, verbose ⊇ minimal]
// describe("extract header — output mode default")[2 assertions: minimal markdown, verbose adds reports+stats sections]
// describe("extract links — output mode default") [2 assertions: minimal default, verbose full payload]
// describe("extract — convention parity with validate") [1 assertion: same flag shape]
```

#### `test/cli-integration/cli-help.test.ts`

%% *Last Modified: 05/01/26 19:13:19* %%

```typescript
// 5 assertions per design §8f
// Setup: spawn `jact extract <sub> --help`; capture stdout
//
// describe("CLI help — extract file --help")
//   - contains 'Defaults to nearest ancestor'
//   - mentions both '.git' and 'package.json'
//   - mentions target file walk-up fallback
//   - states 'Required only when neither cwd nor target reveal a project root'
// describe("CLI help — extract header / extract links")
//   - --scope help text matches extract file (3-way consistency)
```

### MODIFIED

%% *Last Modified: 05/01/26 19:13:19* %%

#### `src/FileCache.ts` — D2 + D7 helper export

%% *Last Modified: 05/01/26 19:13:19* %%

```diff
- // Types defined inline: FileCache is leaf component with no consumers needing these types
- // If future components need these types, migrate to src/types/fileCacheTypes.ts
- interface CacheStats { ... }
- interface ResolveResultSuccess { ... }
- interface ResolveResultFailure { ... }
- type ResolveResult = ResolveResultSuccess | ResolveResultFailure;
+ import type {
+ CacheStats,
+ ResolveResult,
+ ResolveResultFailure,
+ } from "./types/fileCacheTypes.js";
+ import type { ScopeResolution } from "./core/resolveScope.js";

  export class FileCache {
- private cache: Map<string, string>;     // filename -> absolute path
- private duplicates: Set<string>;        // filenames appearing multiple times
+ private entries: Map<string, string[]>; // filename -> all paths in scan order

    constructor(...) {
- this.cache = new Map<string, string>();
- this.duplicates = new Set<string>();
+ this.entries = new Map<string, string[]>();
    }

    buildCache(scopeFolder: string, verbose = false): CacheStats {
- this.cache.clear();
- this.duplicates.clear();
+ this.entries.clear();
      // ... scanDirectory unchanged ...

- return { totalFiles: this.cache.size, duplicates: this.duplicates.size, ... };
+ // duplicates count derived: entries with array length > 1
+ const duplicateCount = [...this.entries.values()].filter(v => v.length > 1).length;
+ return { totalFiles: this.entries.size, duplicates: duplicateCount, ... };
    }

    private addToCache(filename: string, fullPath: string): void {
- if (this.cache.has(filename)) {
- this.duplicates.add(filename);
- } else {
- this.cache.set(filename, fullPath);
- }
+ const existing = this.entries.get(filename);
+ if (existing) existing.push(fullPath);
+ else this.entries.set(filename, [fullPath]);
    }

    resolveFile(filename: string): ResolveResult {
+ // D7 enrichment: failure results carry scope (set by caller via applyScope) + candidates / nearMisses
+ // Implementation reads `this.entries` directly:
+ //   - length === 1 → success
+ //   - length > 1   → { found: false, reason: 'duplicate', candidates: [...], message: ... }
+ //   - length === 0 → check .md alternation, then findFuzzyMatch, then findNearMisses for nearMisses field
+ // The `scope` field on failure is populated by applyScope after this returns
      ...
    }
  }

+ // Module-level export (per G3): unit-testable from outside
+ export function findNearMisses(
+ name: string,
+ entries: Map<string, string[]>,
+ k = 3,
+ maxDist = 2,
+ ): string[] {
+ // Levenshtein over Map.keys(); return top-k by ascending distance ≤ maxDist
+ // Stable sort: ties preserve Map insertion order
+ }
```

#### `src/jact.ts` — D3 applyScope + D4 --verbose + D5 help text

%% *Last Modified: 05/01/26 19:13:19* %%

```diff
+ import { resolveScope, type ScopeResolution } from "./core/resolveScope.js";
+ import type { ResolveResultFailure } from "./types/fileCacheTypes.js";

  class JactCli {
+ /**
+ * D3: Centralized scope resolution + cache build.
+ * Replaces 3× scattered `if (options.scope) buildCache(scope)` blocks.
+ * Throws M3 error if scope cannot be resolved (source: 'none').
+ */
+ private applyScope(
+ options: { scope?: string },
+ targetFile?: string,
+ ): ScopeResolution {
+ const resolved = resolveScope({
+ explicit: options.scope,
+ cwd: process.cwd(),
+ targetFile,
+ });
+ if (resolved.source === "none") {
+ // M3 error
+ throw new Error(formatM3Error(resolved.triedFallbacks ?? []));
+ }
+ this.fileCache.buildCache(resolved.scope);
+ return resolved;  // caller may use for D7 error enrichment
+ }

    extractLinks(sourceFile: string, options: ExtractOptions) {
- if (options.scope) {
- this.fileCache.buildCache(options.scope);
- }
+ const scope = this.applyScope(options, sourceFile);
+ // pass scope to error rendering when resolveFile fails
      ...
- console.log(JSON.stringify(extractionResult, null, 2));
+ // D4: minimal default
+ const output = options.verbose
+ ? extractionResult
+ : { extractedContentBlocks: extractionResult.extractedContentBlocks };
+ console.log(JSON.stringify(output, null, 2));
    }

    extractHeader(...) {
- if (options.scope) {
- await this.fileCache.buildCache(options.scope);  // tech debt: spurious await
- }
+ const scope = this.applyScope(options, sourceFile);
      ...
+ // D4: pass `mode` to formatExtractResult
+ console.log(formatExtractResult(result, options.format, options.verbose ? 'verbose' : 'minimal'));
    }

    extractFile(targetFile: string, options: ExtractOptions) {
- if (options.scope) {
- await this.fileCache.buildCache(options.scope);  // tech debt: spurious await
- }
+ const scope = this.applyScope(options, targetFile);
      ...
+ // D4: minimal JSON default
+ const output = options.verbose
+ ? result
+ : { extractedContentBlocks: result.extractedContentBlocks };
+ console.log(JSON.stringify(output, null, 2));
    }
  }

  // Commander definitions (L1276-1437 region):
  program
    .command("extract")
    .command("file <name>")
    .option("--format <fmt>", "...")
+ .option("-v, --verbose", "Include outgoingLinksReport + stats in output", false)
    .option(
      "--scope <folder>",
- "Folder to search for filename matches",
+ "Folder to search for filename matches. Defaults to nearest ancestor "
+ + "of cwd containing .git or package.json; falls back to target file's "
+ + "ancestors. Required only when neither cwd nor target reveal a project root.",
    )
    .action(...)

  // Identical --verbose + --scope help additions on `extract header` and `extract links`
```

#### `src/formatExtractResult.ts` — D4 minimal/verbose mode

%% *Last Modified: 05/01/26 19:13:19* %%

```diff
  export function formatExtractResult(
    result: OutgoingLinksExtractedContent,
    format: "markdown" | "json",
+ mode: "minimal" | "verbose" = "minimal",
  ): string {
    switch (format) {
      case "json":
- return JSON.stringify(result, null, 2);
+ return JSON.stringify(
+ mode === "verbose" ? result : { extractedContentBlocks: result.extractedContentBlocks },
+ null, 2,
+ );

      case "markdown": {
        // existing minimal markdown — content joined by ---
+ const content = contentEntries.join("\n---\n");
+ if (mode === "minimal") return content;
+ // verbose markdown: append link reports + stats sections
+ return `${content}\n\n---\n## Outgoing Links Report\n\n\`\`\`json\n${JSON.stringify(result.outgoingLinksReport, null, 2)}\n\`\`\`\n\n## Stats\n\n\`\`\`json\n${JSON.stringify(result.stats, null, 2)}\n\`\`\``;
      }
    }
  }
```

#### `jact/CLAUDE.md` — D6 examples drop `--scope` for in-repo

%% *Last Modified: 05/01/26 19:13:19* %%

```diff
- npm run jact:validate path/to/file.md -- --scope /path/to/project/docs
+ # In-repo: scope auto-inferred from cwd
+ npm run jact:validate path/to/file.md
+
+ # Cross-project / explicit override only:
+ npm run jact:validate path/to/file.md -- --scope /other/project/docs

- jact validate path/to/file.md --lines 157 --scope /path/to/docs
+ jact validate path/to/file.md --lines 157
```

(Apply same edit to all `jact extract`, `jact:base-paths`, `jact:extract` examples in the same section.)

### REMOVED

%% *Last Modified: 05/01/26 19:13:19* %%

- _(none — all changes are additive or in-place modifications)_

### RENAMED

%% *Last Modified: 05/01/26 19:13:19* %%

- _(none)_

### UNTOUCHED

%% *Last Modified: 05/01/26 19:13:19* %%

- `src/CitationValidator.ts` — uses `FileCache.resolveFile()` via public API; D2 preserves return shape (success path unchanged; failure adds optional fields)
- `src/ParsedFileCache.ts` — orthogonal cache layer
- `src/core/MarkdownParser/` and `src/core/ContentExtractor/` — unrelated to scope inference
- `src/factories/` — factory wiring unchanged
- `src/types/citationTypes.ts`, `src/types/contentExtractorTypes.ts`, `src/types/validationTypes.ts` — none of these own ResolveResult (per G1)
- `~/.claude/CLAUDE.md` — JACT SCOPE RULE already retired; no edit needed (D6 verifies absence only)
- All existing `test/*.test.{js,ts}` files — no behavior regression expected; `npm test` must pass green
- `src/FileCache.ts findFuzzyMatch()` (L246) — preserved; works alongside new `findNearMisses` (different purpose: fuzzy = post-correction match, near-misses = error-message hint)

---

## Whiteboard Decision Coverage

%% *Last Modified: 05/01/26 19:13:19* %%

| Decision | How covered |
|----------|------------|
| D1 `resolveScope` algorithm + `ScopeResolution` type | `src/core/resolveScope.ts` (NEW) + `test/unit/core/resolveScope.test.ts` (12 assertions) |
| D2 `entries: Map<string, string[]>` refactor | `src/FileCache.ts` MODIFIED + `test/unit/FileCache.test.ts` (11 assertions) |
| D3 `applyScope` helper + tech debt fix (await removal) | `src/jact.ts` MODIFIED (3 call sites collapse) + `test/integration/extract-default-scope.test.ts` (8 assertions) |
| D4 Minimal-by-default `--verbose` flag | `src/jact.ts` Commander defs + `src/formatExtractResult.ts` MODIFIED + `test/integration/extract-verbose.test.ts` (10) + `test/unit/formatExtractResult.test.ts` (2) |
| D5 `--scope` help text documents algorithm | `src/jact.ts` Commander option strings updated + `test/cli-integration/cli-help.test.ts` (5 assertions) |
| D6 `jact/CLAUDE.md` examples | Direct edit to `jact/CLAUDE.md` (manual review per §8a) |
| D7 Smart error stack M1/M2/M3 | `src/FileCache.ts` `resolveFile()` + `applyScope` M3 throw + `test/unit/FileCache.errors.test.ts` (8) + `test/unit/findNearMisses.test.ts` (6) + M3 in `extract-default-scope.test.ts` |
| Naming: `src/core/resolveScope.ts` (action-based) | File created at exact path |
| Naming: `ResolveResultFailure.{candidates,scope,nearMisses}` | Migrated to `src/types/fileCacheTypes.ts` (per G1, NOT validationTypes.ts as design said) |
| Tech debt: TS80007 await removals (L653, L745) | Collapsed into D3 helper migration |

**Total: 67 BDD assertions (per design §8i) + 1 manual review (D6).**

---

## Verification

%% *Last Modified: 05/01/26 19:13:19* %%

```bash
# 1. RED → GREEN per file (TDD): run each new test, watch fail, implement, watch pass
npx vitest run test/unit/core/resolveScope.test.ts
npx vitest run test/unit/FileCache.test.ts
npx vitest run test/unit/FileCache.errors.test.ts
npx vitest run test/unit/findNearMisses.test.ts
npx vitest run test/unit/formatExtractResult.test.ts
npx vitest run test/integration/extract-default-scope.test.ts
npx vitest run test/integration/extract-verbose.test.ts
npx vitest run test/cli-integration/cli-help.test.ts

# 2. Build (rebuilds dist/ — required since project compiles TS to JS for CLI usage)
npm run build

# 3. Full suite — no regressions
npm test

# 4. LSP diagnostics clean (TS80007 await warnings should be gone)
#    Run via IDE / language-server; expected output: 0 diagnostics in src/jact.ts L645-813

# 5. Manual smoke tests — verify each delta from a real cwd
cd /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact

# D1+D3: in-repo extract w/o --scope
jact extract file CLAUDE.md
# Expected: succeeds; outputs minimal JSON {extractedContentBlocks: ...}

# D4: --verbose
jact extract file CLAUDE.md --verbose
# Expected: succeeds; output includes outgoingLinksReport + stats keys

# D5: help text contains algorithm description
jact extract file --help | grep -E "(nearest ancestor|\\.git|package\\.json|target file)"
# Expected: 4 lines matched

# D7 M2: duplicate name error
# (Setup a fixture w/ two files named foo.md, then:)
jact extract file foo.md
# Expected: exit 1, stderr lists every candidate path + "Pass --scope to narrow."

# D7 M3: no-scope error
cd /tmp && mkdir empty-dir && cd empty-dir
jact extract file CLAUDE.md
# Expected: exit 1, stderr enumerates fallbacks tried + suggests --scope

# D7 M1: not-found near-miss
jact extract file CLUADE.md  # typo
# Expected: exit 1, stderr "Did you mean: CLAUDE.md, ..."

# D6: CLAUDE.md examples
grep -c "\\-\\-scope " jact/CLAUDE.md
# Expected: count drops; only cross-project examples retain --scope

# 6. Confirm Phase 5 [i3] verdict still holds (architecture eval clean)
#    No new tech debt; D2 doesn't break ParsedFileCache or CitationValidator
```

### Success Criteria

%% *Last Modified: 05/01/26 19:31:55* %%

1. ✅ All 67 BDD assertions pass (per design §8i)
2. ✅ `npm test` exits 0 — zero existing-test regressions
3. ✅ LSP diagnostics clean across `src/jact.ts`, `src/FileCache.ts`, `src/core/resolveScope.ts`
4. ✅ TS80007 (await on sync) gone at `src/jact.ts:653, 745`
5. ✅ Manual smoke tests above all behave as expected
6. ✅ `jact/CLAUDE.md` examples updated; in-repo invocations show no `--scope`
7. ✅ User CLAUDE.md JACT SCOPE RULE confirmed absent (already retired per design §7b D6)

---

## Phased Task Sequence

%% *Last Modified: 05/01/26 19:31:55* %%

**Agents:** `delta-implementer` (coder, sonnet) · `delta-reviewer` (reviewer, opus) · `bi-row-verifier` (verifier, opus)
**Plan file:** `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/features/20260501-extract-smart-default-scope/implementation-plan.md`

#### Agents

%% *Last Modified: 05/01/26 18:36:07* %%

| Role              | Source                 | Model  | Path                                                                              | Adaptation                                                             |
| ----------------- | ---------------------- | ------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Delta Implementer | `coder` general agent  | sonnet |                                                                                   | Constrained to executing locked plan §7; no architecture re-litigation |
| Delta Reviewer    | `forge:reviewer` agent | opus   | /Users/wesleyfrederick/.claude/plugins/cache/forge/forge/1.0.0/agents/reviewer.md | Direct reuse; review criteria = Plan §7a/§7b + arch principles         |
| BI-Row Verifier   | `forge:verifier` agent | opus   | /Users/wesleyfrederick/.claude/plugins/cache/forge/forge/1.0.0/agents/verifier.md | Direct reuse; acceptance criteria = §7e Validation Table               |


#### Escalation Policy
- 1×: `delta-reviewer` finds issues → `delta-implementer` (sonnet) fixes → `delta-reviewer` re-reviews
- 2×: `delta-reviewer` still finds issues → `delta-implementer` (opus model override) fixes → `delta-reviewer` re-reviews
- 3×: `delta-reviewer` still finds issues → ESCALATE to human USER

#### Spawning Rules
- Just-in-time spawning — `delta-reviewer` spawns at review gates only; `bi-row-verifier` spawns when Phase 4 completes
- Fresh `delta-implementer` per phase — never reuse across phase boundaries
- Phases sized for 50-75% of agent context (~100-150K tokens). >15 tasks = split phase

#### Testing convention
- All tests use BDD-style assertions (`describe`/`it`/`expect`). 
- Vitest + `npm test` (per G6 — project does not use bun for testing).

#### Delta dependency order
- D2 → D1 → D3 → D7 → D4 → D5 → D6

### Phase 0 — Baseline `delta-implementer` (sonnet)

%% *Last Modified: 05/01/26 20:17:12* %%

- [x] **0.0** STATE-READ: `git rev-parse HEAD` → `baseline_hash: 2f7687504da56397915d04e672f4e1a598bc0ba3` (plan had placeholder `3872f7b`; actual HEAD is 2f7687504 — 3 commits added after plan was written).
- [x] **0.1** BASELINE: Run LSP commands from Baseline Tracing Guide — DONE. Findings:
  - `extractLinks` (L555): refs only in jact.ts (L555 def, L1320 Commander action). No external callers.
  - `extractHeader` (L645): refs only in jact.ts (L645 def, L1370 Commander action).
  - `extractFile` (L738): refs only in jact.ts (L738 def, L1421 Commander action).
  - `resolveFile` (L175 FileCache): LSP returned only L175 (own decl); workspace symbol confirmed CitationValidator uses it at L440 + L767 via `FileCacheInterface`. Backward compat required.
  - `buildCache` (L92): 5 call sites — jact.ts L190 (validate), L562 (extractLinks), L653 (extractHeader ⚠️ spurious await), L745 (extractFile ⚠️ spurious await), L859 (fix). D3 only replaces 3 extract sites; validate/fix stay unchanged.
  - `ResolveResult` (L24): 0 external consumers (only FileCache.ts L175, L246). Migration safe.
  - `CacheStats` (L3): 0 external consumers (only FileCache.ts L92). Migration safe.
  - TS80007 diagnostics confirmed at L653 + L745.
  - `CliExtractOptions` lives in `src/types/contentExtractorTypes.ts:122` (not jact.ts). No `verbose` field yet — Phase 3 (D4) adds it there.
- [x] **0.2** BASELINE: Read key files — DONE. Key observations:
  - `validate()` (L181–256): uses `if (options.scope) buildCache(...)` + passes `options.verbose` to formatForCLI. Pattern to mirror in D4.
  - `extractLinks` (L555–606): outputs JSON directly in method at L592. `extractHeader`/`extractFile` return result; Commander action calls formatter.
  - Commander defs (L1276–1437): no `--verbose` flag yet on any extract subcommand. `--scope` help text is minimal.
  - `FileCache.ts` (L1–374): `cache: Map<string,string>` + `duplicates: Set<string>`. `findFuzzyMatch()` at L246 preserved in D2.
  - `formatExtractResult.ts` (L1–39): single `mode` parameter doesn't exist yet; JSON case returns full result; markdown joins blocks with `\n---\n`.
- [x] **0.3** BASELINE: `npm run build` clean. `npm test` — 78 test files, 435 tests, all green. Zero pre-existing failures.
- [x] **0.S** STATE-WRITE: Deviations from plan:
  - DEVIATION D1: `test/unit/` directory already exists (plan said "create new subdir"). No action needed.
  - DEVIATION D2: `test/unit/formatExtractResult.test.ts` already exists with 5 passing tests. Phase 3 must APPEND 2 new assertions (minimal/verbose) rather than create new file.
  - DEVIATION D3: `fix()` at L859 is a 5th `buildCache` call site (plan only mentioned 3 extract sites). D3 does NOT touch fix(). Confirmed as correct scoping.
  - DEVIATION D4: Plan baseline_hash placeholder `3872f7b` ≠ actual HEAD `2f7687504`. Updated in 0.0 above.
- [x] **0.C** COMMIT: Plan-only changes (checkboxes + deviations). `end_hash: c8b11daf544f708e81b63d8cea8421e51f9e6c52`

### Phase 1 — Foundation Types + Pure Util (D2 + D1) `delta-implementer` (sonnet)

%% *Last Modified: 05/01/26 20:29:54* %%

- [x] **1.0** STATE-READ: `start_hash: 27bd6e0b9f3cc27c054c5f31548d61479a5d24d3`. One extra plan-file commit beyond Phase 0 end_hash — acceptable (plan 0.C end_hash update committed separately).

**D2 — `FileCache.entries: Map<string, string[]>` refactor (foundation; data shape before logic):**

- [x] **1.1** IMPLEMENT: Created `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/types/fileCacheTypes.ts` with all types + D7 optional fields. Also created stub `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/resolveScope.ts` (types + throwing fn) to satisfy TypeScript import resolution — deviation noted below.
- [x] **1.2** RED: Created `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/test/unit/FileCache.test.ts` (12 assertions — 1 extra for triple-duplicate case).
- [x] **1.3** VERIFY: RED confirmed — 6 failing (candidates field missing on old type), 6 passing.
- [x] **1.4** GREEN: Rewrote `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/FileCache.ts` — `entries: Map<string, string[]>`, `addToCache` appends, `resolveFile` returns `candidates[]`, `findFuzzyMatch` updated. Also added `findNearMisses` module-level export (G3, Phase 2 prereq). Fixed macOS symlink issue in test fixture.
- [x] **1.5** VERIFY: 12/12 GREEN. `npm test` — 79 files, 447 tests, zero regressions.

**D1 — `src/core/resolveScope.ts` new pure util (foundation; pure function, no consumers yet):**

- [x] **1.6** RED: Created `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/test/unit/core/resolveScope.test.ts` (13 assertions — 1 extra in targetFile fallback group).
- [x] **1.7** VERIFY: RED confirmed — 13/13 failing with "resolveScope: not implemented".
- [x] **1.8** GREEN: Implemented full `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/resolveScope.ts` — algorithm ①–⑥, `walkUpFor` private helper, `fs` injection, all exports.
- [x] **1.9** VERIFY: 13/13 GREEN.

**Phase 1 guardrails:**

- [x] **1.10** VERIFY: `npm run build` — TypeScript clean. Zero diagnostics.
- [x] **1.11** VERIFY: `npm test` — 80 files, 460 tests, zero regressions.
- [x] **1.S** STATE-WRITE: Deviations:
  - DEVIATION P1-1: Stub `resolveScope.ts` created in step 1.1 (before TDD cycle) to allow TypeScript to resolve the import type in `fileCacheTypes.ts`. Full implementation added in 1.8 as planned. RED confirmed by throwing stub.
  - DEVIATION P1-2: FileCache.test.ts has 12 assertions (plan said 11) — added triple-duplicate case for completeness.
  - DEVIATION P1-3: resolveScope.test.ts has 13 assertions (plan said 12) — extra "none with targetFile present" mocked case.
  - DEVIATION P1-4: `findNearMisses` module export added to `FileCache.ts` in step 1.4 (Phase 2 step 2.3 prereq) — early landing avoids a second FileCache.ts write cycle in Phase 2.
- [x] **1.C** COMMIT: "feat(scope): D2 entries Map refactor + D1 resolveScope util". `end_hash: 56c4501aae59f1325941e626c84ff764bd6d1330`

### Phase 2 — Core Build: applyScope + Smart Errors (D3 + D7) `delta-implementer` (sonnet)

%% *Last Modified: 05/01/26 20:57:37* %%

- [x] **2.0** STATE-READ: `git rev-parse HEAD` → `start_hash: 83d799cc7a9641b771a7b5311579aa8d2dcd557d`. One commit past Phase 1.C end_hash `56c4501` (plan update commit `83d799c` — acceptable).

**D7 helper — `findNearMisses` module export (TDD first, consumed by D7 errors):**

- [x] **2.1** RED: Created `test/unit/findNearMisses.test.ts` — 6 BDD assertions per §8g.
- [x] **2.2** VERIFY: DEVIATION — tests went GREEN immediately (not RED). `findNearMisses` already implemented in Phase 1 (P1-4 deviation). Expected RED, got 6/6 GREEN.
- [x] **2.3** GREEN: NO-OP — `findNearMisses` module export already exists in `src/FileCache.ts` from Phase 1. Verified presence.
- [x] **2.4** VERIFY: 6/6 GREEN confirmed.

**D7 errors — M1/M2 in `resolveFile()` (TDD):**

- [x] **2.5** RED: Created `test/unit/FileCache.errors.test.ts` — 8 BDD assertions (M1 ×4, M2 ×4). RED confirmed: 7/8 failing (scope param not yet on buildCache; message format wrong).
- [x] **2.6** VERIFY: RED confirmed — 7 failing, 1 passing.
- [x] **2.7** GREEN: Added `private scope: ScopeResolution | undefined` field + optional `scope?` param to `buildCache`. Extracted `buildDuplicateFailure` + `buildNotFoundFailure` private helpers. M1 message: `'<name>' not found in scope=<path> (source: <src>)[. Did you mean: ...]`. M2 message: `'<name>' matched N files in scope=<path> (source: <src>):\n  <paths>\nPass --scope to narrow.` `nearMisses` populated via `findNearMisses()`.
- [x] **2.8** VERIFY: 8/8 GREEN confirmed.

**D3 — `applyScope` helper + tech debt collapse (TDD):**

- [x] **2.9** RED: Created `test/integration/extract-default-scope.test.ts` — 9 assertions (plan said 8; +1 for extract-links variant). RED: 5 failing (M3, source inspection ×3, extract-links exit-code).
- [x] **2.10** VERIFY: RED confirmed — 5 failing, 4 passing.
- [x] **2.11** GREEN: Added `private applyScope(options, targetFile?)` to `JactCli`. Resolves scope via `resolveScope()`, throws M3 error on `source: 'none'`, calls `this.fileCache.buildCache(resolved.scope, false, resolved)`, returns `ScopeResolution`.
- [x] **2.12** GREEN: Replaced all 3 `if (options.scope) { ... buildCache(...) }` blocks with `this.applyScope(options, sourceFile/targetFile)`. Removed spurious `await` at extractHeader (L655) + extractFile (L747) — TS80007 cleared.
- [x] **2.13** GREEN: Scope wired via `buildCache(scope, false, resolved)` — `FileCache.scope` field set, consumed by `resolveFile()` failure paths automatically. No extra wiring needed.
- [x] **2.14** VERIFY: 9/9 GREEN confirmed (after fixing extract-links test to accept exit-code 1).

**Phase 2 guardrails:**

- [x] **2.15** VERIFY: `npm run build` — TypeScript clean. Zero TS80007 diagnostics confirmed (no `await this.fileCache.buildCache` remains).
- [x] **2.16** VERIFY: `npm test` — 83 files, 483 tests, zero regressions. (+23 new tests over Phase 1 baseline of 460).
- [x] **2.S** STATE-WRITE: Deviations:
  - DEVIATION P2-1: `buildCache` now accepts optional 3rd param `scope?: ScopeResolution` (stored as instance field) instead of `resolveFile(filename, scope?)` parameter approach. Cleaner: wires scope through FileCache without touching CitationValidator.
  - DEVIATION P2-2: `extract-default-scope.test.ts` has 9 assertions (plan said 8) — extra assertion for extract-links exit-code-1 handling.
  - DEVIATION P2-3: extract-links test accepts exit code 1 (no links found) as valid success — not a scope error. Test updated to distinguish exit 1 from exit 2.
- [x] **2.C** COMMIT: "feat(scope): D3 applyScope helper + D7 smart error stack (M1/M2/M3)". `end_hash: 9f5dd729a1041be02655871dee70acc3d607fab7`

#### REVIEW GATE 1 `delta-reviewer` (opus)

%% *Last Modified: 05/01/26 21:01:35* %%

- [x] **2.R** REVIEW: Scope — `src/types/fileCacheTypes.ts`, `src/core/resolveScope.ts`, `src/FileCache.ts`, `src/jact.ts` (applyScope + 3 method modifications), all 5 new test files. Review `git diff <Phase_0.C_end_hash>..HEAD`.
  - Verify: Plan §7a/§7b spec adherence (D1/D2/D3/D7 implemented as written; no architecture re-litigation)
	  - Run `jact extract header /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/features/20260501-extract-smart-default-scope/plan.md "D1 — `resolveScope` algorithm"`
	  - Run `jact extract header /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/features/20260501-extract-smart-default-scope/plan.md "D2 — `entries: Map<string, string[]>` refactor"`
	  - Run `jact extract header /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/features/20260501-extract-smart-default-scope/plan.md "D3 — `applyScope` helper extraction"`
	  - Run `jact extract header /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/features/20260501-extract-smart-default-scope/plan.md "D7 — Smart error message stack"`
  - Verify: D2 backward compat — `CitationValidator`, `ParsedFileCache` consumers of `resolveFile()` success path unchanged
  - Verify: D1 purity — `resolveScope` performs no I/O beyond `fs.existsSync`; deterministic; `fs` injectable
  - Verify: D3 collapses 3 sites into 1; spurious `await` removed at L653 + L745 (CLAUDE.md TECH DEBT POLICY: in same PR)
  - Verify: D7 M1/M2 messages match design §8g format exactly (scope=, source=, candidate enumeration, "Pass --scope" hint)
  - Verify: G1 type migration — `ResolveResult*` lives in `fileCacheTypes.ts` (NOT `validationTypes.ts`)
  - Verify: G3 `findNearMisses` is module-level export (not private method)
  - **Verdict:** SHIP → proceed to Phase 3. NO-SHIP → escalation policy applies.

##### Gate 1 Verdict — SHIP (recorded 05/02/26 by `delta-reviewer` opus)

%% *Last Modified: 05/01/26 21:04:14* %%

**Diff range reviewed:** `c8b11daf544f708e81b63d8cea8421e51f9e6c52..9f5dd729a1041be02655871dee70acc3d607fab7` (Phase 0 → Phase 2 end).

**Verification checklist results:**

| Item | Result | Evidence |
|---|---|---|
| §7a/§7b spec adherence | ✅ | D1 algorithm ①→⑥, D2 entries Map, D3 helper, D7 M1/M2/M3 — all as written |
| D2 backward compat | ✅ | `CitationValidator.FileCacheInterface` (L32-45) structural shape preserved; `ParsedFileCache` untouched; success path returns `{found: true, path}` |
| D1 purity | ✅ | Only `fs.existsSync` (`resolveScope.ts:76`); `fs` injectable (L31); deterministic (test L165-184) |
| D3 collapses 3→1 | ✅ | `jact.ts:595, 684, 774` all call `this.applyScope`; `await` removed (test enforces no `await this.fileCache.buildCache`) |
| D7 message formats | ✅ | M1 (`FileCache.ts:217-227`), M2 (`FileCache.ts:198-209`), M3 (`jact.ts:163-171`) match §8g spec |
| G1 type location | ✅ | `ResolveResult*` lives in `src/types/fileCacheTypes.ts` (header comment confirms migration intent) |
| G3 findNearMisses export | ✅ | Module-level export at `FileCache.ts:396-416` |

**Findings (severity-classified):**

- **Blocking:** None.
- **Major:** None.
- **Minor M-1** — `test/unit/core/resolveScope.test.ts:100-122` is dead/misleading. Title says "no cwd markers: resolves from targetFile dir .git" but `mockNoMarkers` returns false for everything, so it asserts `source === 'none'` not `'target-git'`. Author noted issue inline. Next test (L124-139) covers the actual case. Fix: delete L100-122 OR rename to "all-false fs returns 'none' even with targetFile". → **Routed to Phase 3 cleanup**
- **Minor M-2** — `applyScope` in `jact.ts` returns `ScopeResolution` but all 3 call sites ignore it. Fix: change return type to `void` for honesty. → **Routed to Phase 3 cleanup**
- **Nitpick N-1** — `applyScope` M3 string says `"targetFile walk-up (no markers found)"` rather than spec's `"targetFile walk-up (no targetFile)"`. Implementation more informative than spec — keep as-is.
- **Nitpick N-2** — `validate`/`fix` retain old `if (options.scope) buildCache(...)`. Confirmed in scope: plan §7a row D3 cites only the 3 extract methods. Not a finding; surfacing for transparency.

**Phase 1+2 deviations verified clean:**
- P1-1 (stub resolveScope.ts): Resolved — full implementation in 1.8.
- P1-3 (test counts 12/13 vs 11/12): Net positive coverage, no spec gaps.
- P2-1 (scope as FileCache instance field): Cleaner than threading through `resolveFile()`. CitationValidator unchanged (consumes structural interface). M1/M2 messages carry scope correctly via `this.scope` field (`FileCache.ts:75`).
- P2-2 (9 vs 8 assertions): Extra assertion for extract-links exit-code-1 handling.
- P2-3 (findNearMisses landed in Phase 1 P1-2): Module export confirmed at `FileCache.ts:396-416`. Stable sort, distance ≤2, top-k, excludes exact match.

**Disposition:** SHIP. M-1 + M-2 routed to Phase 3 cleanup (non-blocking).

### Phase 3 — CLI Surface: --verbose + Help Text (D4 + D5) `delta-implementer` (sonnet)

%% *Last Modified: 05/01/26 21:17:24* %%

- [x] **3.0** STATE-READ: `start_hash: b00f5f0d0f47438dc05f2e18339040d9a5e45000`. One doc-commit beyond Phase 2 end_hash — acceptable.

**D4 — formatter minimal/verbose mode (TDD):**

- [x] **3.1** RED: APPENDED 2 assertions to existing `test/unit/formatExtractResult.test.ts` (deviation P0-2). Also updated existing json test to use `"verbose"` mode — old test expected full payload, now verbose-only. Total: 7 tests.
- [x] **3.2** VERIFY: RED confirmed — 1 failing, 6 passing.
- [x] **3.3** GREEN: Modified `src/formatExtractResult.ts` — `mode: "minimal" | "verbose" = "minimal"`. JSON: `{ extractedContentBlocks }` when minimal. Markdown: appends `## Outgoing Links Report` + `## Stats` when verbose.
- [x] **3.4** VERIFY: 7/7 GREEN confirmed.

**D4 — CLI --verbose wiring (TDD):**

- [x] **3.5** RED: Created `test/integration/extract-verbose.test.ts` — 10 assertions. Fixed extract-links helper to catch exit-code 1.
- [x] **3.6** VERIFY: 10/10 RED confirmed.
- [x] **3.7** GREEN: Added `verbose?: boolean` to `CliExtractOptions` (deviation P0-4: lives in `contentExtractorTypes.ts`). Updated `extractLinks` to use `formatExtractResult`. Updated Commander actions for `extractHeader` + `extractFile` to pass verbose mode.
- [x] **3.8** GREEN: Added `-v, --verbose` option to all 3 extract Commander defs. Updated `--scope` help text on all 3 (D4 + D5 in same step).
- [x] **3.9** VERIFY: 10/10 GREEN confirmed.

**D5 — Commander --scope help text (TDD):**

- [x] **3.10** RED: Created `test/cli-integration/cli-help.test.ts` — 5 assertions. Normalized line-wrapped help output. No dummy args needed (Commander processes `--help` before arg validation).
- [x] **3.11** VERIFY: 5/5 RED confirmed (text not in dist yet).
- [x] **3.12** GREEN: Help text already added in 3.8. Build required.
- [x] **3.13** VERIFY: 5/5 GREEN confirmed.

**M-1 + M-2 cleanup (Review Gate 1 findings):**
- [x] M-1: Renamed `resolveScope.test.ts:101` test title → "all-false fs returns 'none' even with targetFile".
- [x] M-2: `applyScope` return type `ScopeResolution` → `void`. Removed unused `ScopeResolution` import from `jact.ts`.

**Phase 3 guardrails:**

- [x] **3.14** VERIFY: `npm run build` — TypeScript clean. Zero diagnostics.
- [x] **3.15** VERIFY: `npm test` — 85 files, 500 tests, zero regressions.
- [x] **3.S** STATE-WRITE: Deviations:
  - DEVIATION P3-1: Existing json test in `formatExtractResult.test.ts` renamed to use `"verbose"` mode (old assertion expected full payload, now verbose-only behavior).
  - DEVIATION P3-2: 11 existing tests + `jact:base-paths` npm script updated with `--verbose` where full payload was expected (TECH DEBT POLICY: fix-now).
  - DEVIATION P3-3: D5 help text wired in same Commander step as D4 `--verbose` (3.8) — no separate step needed.
  - DEVIATION P3-4: `extract-verbose.test.ts` uses "Context" header (avoids backtick shell-escape issues). 10 assertions maintained.
- [x] **3.C** COMMIT: Commit Phase 3 — "feat(scope): D4 minimal-default --verbose + D5 --scope help text". `end_hash: c0b3fb6ee87f2ae77a06296fab601fad2a191465`

#### REVIEW GATE 2 `delta-reviewer` (opus)

%% *Last Modified: 05/01/26 21:21:14* %%

- [x] **3.R** REVIEW: Scope — `src/jact.ts` (extract methods + Commander defs), `src/formatExtractResult.ts`, 3 new test files. Review `git diff <Phase_2.C_end_hash>..HEAD`.
  - Verify: D4 mirrors `validate` `--verbose` pattern at L181-256 (convention parity)
  - Verify: D4 markdown verbose footer format matches G5 decision (appends Outgoing Links Report + Stats sections)
  - Verify: D5 help text matches design §7a verbatim across all 3 extract subcommands (3-way consistency)
  - Verify: No coupling drift — Phase 3 changes do not touch D1/D2 contracts
  - **Verdict:** SHIP → proceed to Phase 4. NO-SHIP → escalation policy applies.

##### Gate 2 Verdict — SHIP (recorded 05/01/26 by `delta-reviewer-g2` opus)

%% *Last Modified: 05/01/26 21:21:14* %%

**Diff range reviewed:** `9f5dd729a1041be02655871dee70acc3d607fab7..c0b3fb6ee87f2ae77a06296fab601fad2a191465` (Phase 2 end → Phase 3 end).

**Verification checklist results:**

| Item | Result | Evidence |
|---|---|---|
| D4 convention parity with `validate` --verbose | ✅ | `extract file/header/links` Commander defs (`jact.ts:1324, 1381, 1452`) all add `verbose: false` default; action handlers pass `options.verbose ? "verbose" : "minimal"` to `formatExtractResult` (`jact.ts:623, 1427, 1487`); mirrors `validate` pattern at L1214-1218 |
| D4 markdown verbose footer format (G5) | ✅ | `formatExtractResult.ts:39` appends `\n\n---\n## Outgoing Links Report\n\n\`\`\`json...\`\`\`\n\n## Stats\n\n\`\`\`json...\`\`\`` — matches plan §6 spec character-for-character; integration test asserts both section headers present |
| D5 help text verbatim across 3 subcommands | ✅ | Identical 268-char string at `jact.ts:1310-1311, 1376-1378, 1447-1449`: "Folder to search for filename matches. Defaults to nearest ancestor of cwd containing .git or package.json; falls back to target file's ancestors. Required only when neither cwd nor target reveal a project root." Captured by 3-way consistency test in `cli-help.test.ts:55-65` |
| No coupling drift to D1/D2 contracts | ✅ | `git diff --stat` shows `src/core/resolveScope.ts` NOT modified; `src/FileCache.ts` NOT modified; `CliExtractOptions` extended additively with optional `verbose?: boolean` (`contentExtractorTypes.ts:127`) — no breaking change |
| M-1 cleanup (Gate 1) | ✅ | `test/unit/core/resolveScope.test.ts:100` renamed to "all-false fs returns 'none' even with targetFile" — title now matches assertion semantics |
| M-2 cleanup (Gate 1) | ✅ | `applyScope` return type `ScopeResolution` → `void` (`jact.ts:148`); unused `import type { ScopeResolution }` removed (`jact.ts` import block) |
| TDD discipline | ✅ | RED→GREEN flow recorded for all 3 deliverables (3.1-3.4 formatter, 3.5-3.9 CLI wiring, 3.10-3.13 help text); zero regressions across 500-test suite per 3.15 |
| Tech-debt fix-now policy | ✅ | P3-2 — 11 existing tests + `jact:base-paths` npm script updated with `--verbose` where full payload was expected; no GH-issue deferral |

**Findings (severity-classified):**

- **Blocking:** None.
- **Major:** None.
- **Minor:** None.
- **Nitpick N-1** — Extract `--verbose` adds short flag `-v, --verbose`; `validate` uses long-form `--verbose` only. Minor convention drift, but standard Commander idiom; reads as ergonomic improvement, not regression. Keep as-is.
- **Nitpick N-2** — Plan §7a D5 spec wraps `.git` and `package.json` in markdown backticks; CLI string drops them (correctly — backticks would render as literal characters in `--help` output). Faithful interpretation, not a defect.
- **Positive observation P-1** — Markdown verbose footer prefixes section block with `\n\n---\n` separator, providing clean visual delineation between content and metadata. Better than spec minimum.
- **Positive observation P-2** — `extract-verbose.test.ts:135-143` adds an explicit "convention parity with validate" test asserting `--verbose` appears in `--help` output — proactive guard against future drift.
- **Positive observation P-3** — `cli-help.test.ts:24-26` normalizes Commander's line-wrapped option descriptions via `replace(/\n\s{10,}/g, " ")`, robust to terminal-width variance.

**Phase 3 deviations verified clean:**
- P3-1 (existing json test renamed to "verbose" mode): Necessary behavior change; old assertion would fail under new minimal default. Correct adaptation.
- P3-2 (11 tests + npm script updated with `--verbose`): Tech-debt-fix-now compliant; no scope creep — only tests/scripts that asserted full payload were touched.
- P3-3 (D5 help text wired in same Commander step as D4): Acceptable consolidation; both deliverables touch identical lines, splitting would have been ceremony.
- P3-4 ("Context" header in extract-verbose.test.ts): Pragmatic shell-escape avoidance; 10-assertion count maintained.

**Disposition:** SHIP. Phase 4 (D6 docs) unblocked. Gate 1 cleanups (M-1, M-2) confirmed applied in this diff.

### Phase 4 — Documentation (D6) `delta-implementer` (sonnet)

%% *Last Modified: 05/01/26 21:24:22* %%

- [x] **4.0** STATE-READ: `git rev-parse HEAD` → `start_hash: 5c51f75addeb9d11a35208a32b0d3cf21d989072`. HEAD is 2 doc-commits past Phase 3.C end_hash `c0b3fb6` — acceptable (plan update commits).
- [x] **4.1** UPDATE: Edited `jact/CLAUDE.md` per plan §MODIFIED D6. Replaced in-repo `--scope` validate/fix/jact examples with in-repo comment + command (no flag) + cross-project block. `jact:base-paths` and `jact:extract` already had no `--scope` — no change needed.
- [x] **4.2** VERIFY: `grep -c "\-\-scope " jact/CLAUDE.md` → `2`. Dropped from 3 (was: validate, fix, jact-validate). Remaining 2 are cross-project-only examples.
- [x] **4.3** VERIFY: `grep -c "JACT SCOPE RULE" ~/.claude/CLAUDE.md` → `0`. Confirmed absent.
- [x] **4.S** STATE-WRITE: Deviations:
  - DEVIATION P4-1: `jact:base-paths` and `jact:extract` npm script examples already lacked `--scope` — no edit needed for those.
  - DEVIATION P4-2: Auto-fix (`--fix`) example dropped `--scope` entirely (no cross-project variant added) to keep the section concise; the adjacent validate cross-project example illustrates the pattern.
- [x] **4.C** COMMIT: Commit Phase 4 — "docs(scope): D6 jact/CLAUDE.md examples drop --scope for in-repo". `end_hash: cbcf3d7b354c5f72cc56979d51df38aa920e08e2`

### Phase 5 — E2E Verification `bi-row-verifier` (opus)

%% *Last Modified: 05/01/26 21:32:09* %%

- [x] **5.0** STATE-READ: `git rev-parse HEAD` → `start_hash: 538e5c92713ceb5be12e88935e8826543c459881`. Matches Phase 4.C end_hash predecessor (`cbcf3d7b` D6 commit + `538e5c9` plan checkpoint). All prior phase checkboxes (0.0–4.C) checked.
- [x] **5.1** SUITE: `npx vitest run test/unit/core/resolveScope.test.ts` — **13/13 pass** (one more than 12 expected; coverage delta).
- [x] **5.2** SUITE: `npx vitest run test/unit/FileCache.test.ts` — **12/12 pass** (one more than 11 expected; coverage delta).
- [x] **5.3** SUITE: `npx vitest run test/unit/FileCache.errors.test.ts` — **8/8 pass**.
- [x] **5.4** SUITE: `npx vitest run test/unit/findNearMisses.test.ts` — **6/6 pass**.
- [x] **5.5** SUITE: `npx vitest run test/unit/formatExtractResult.test.ts` — **7/7 pass** (5 existing + 2 new D4 mode tests).
- [x] **5.6** SUITE: `npx vitest run test/integration/extract-default-scope.test.ts` — **9/9 pass** (one more than 8 expected).
- [x] **5.7** SUITE: `npx vitest run test/integration/extract-verbose.test.ts` — **10/10 pass**.
- [x] **5.8** SUITE: `npx vitest run test/cli-integration/cli-help.test.ts` — **5/5 pass**.
- [x] **5.9** SUITE: `npm run build && npm test` — **500/500 pass across 85 files**, zero regressions, build clean.
- [x] **5.10** SMOKE: `jact extract file CLAUDE.md` (in jact root, no `--scope`) — minimal JSON `{extractedContentBlocks: ...}` returned; only `_totalContentCharacterLength` + content-block keys; no `outgoingLinksReport` / `stats`. PASS. (D1+D3, [O1]+[O2])
- [x] **5.11** SMOKE: `jact extract file CLAUDE.md --verbose` — output contains `"outgoingLinksReport": {` and `"stats": {` keys. PASS. (D4, [O3])
- [x] **5.12** SMOKE: `jact extract file --help` — all 4 phrases (`nearest ancestor`, `.git`, `package.json`, `target file`) present in `--scope` description block (Commander wraps "nearest" / "ancestor" across two lines; whitespace-squeezed grep returns 4). PASS. (D5)
- [x] **5.13** SMOKE: Two `foo.md` fixture under `/tmp/jact-multi-fixture` (git-init root) → `jact extract file foo.md` exits 1; stderr lists both `/private/tmp/jact-multi-fixture/a/foo.md` and `/private/tmp/jact-multi-fixture/b/foo.md` and ends with `Pass --scope to narrow.`. PASS. (D7 M2, [O5])
- [x] **5.14** SMOKE: `cd /tmp/jact-empty-dir && jact extract file CLAUDE.md` — stderr: `ERROR: cannot resolve scope. Tried: cwd .git (none), cwd package.json (none), targetFile walk-up (no markers found). Pass --scope <dir>.`; exit code **2** (not 1 per plan text — exit 2 matches project convention for system errors per `jact/CLAUDE.md` "Exit Codes" section). Behavioral content meets spec. PASS-WITH-NOTE. (D7 M3)
- [ ] **5.15** SMOKE: `jact extract file CLUADE.md` (typo) — exits 1; stderr: `Validation failed: File not found: ...CLUADE.md\nSuggestion: File "CLUADE.md" not found in scope folder. Tried: ...`. **MISSING `Did you mean: CLAUDE.md`** suggestion. **FAIL**. Root cause: `src/CitationValidator.ts:567` hardcodes the not-found message string, discarding `cacheResult.message` (which DOES contain the near-miss text per `src/FileCache.ts:219-220`). The FileCache layer correctly produces "Did you mean: CLAUDE.md?" but the validator throws it away. Pre-existing validator bug surfaced by D7 spec — plan did not modify CitationValidator. (D7 M1, [O5] partial)
- [x] **5.16** ASSERT: `grep -c "\\-\\-scope " jact/CLAUDE.md` → **2** matches; both at lines 44 and 63 are cross-project examples (`/other/project/docs`). In-repo `--scope` usage retired. PASS. (D6, [O4])
- [x] **5.17** ASSERT: `npx tsc --noEmit` — zero diagnostics emitted; TS80007 absent at all post-refactor lines (595, 684, 774). PASS.
- [x] **5.18** VERIFY: Verification matrix filled — see below.

#### Verification Matrix ([O1] through [O5])

%% *Last Modified: 05/01/26 21:33:16* %%

| # | BI-Row [O] | Delta Coverage | Evidence Source | Pass/Fail |
| --- | --- | --- | --- | --- |
| [O1] | User in-repo resolves by name w/o `--scope` | D1, D3, D5 | Smoke 5.10 (minimal JSON returned without flag); 5.12 (help text documents auto-inference); integration 5.6 (9/9 — incl. "given cwd inside jact repo and no --scope flag, when extract file <name> runs, then succeeds without error") | **PASS** |
| [O2] | Agent in-repo resolves by name w/o rebuilding root | D1, D3 | Smoke 5.10 (single in-process call, no rebuild ceremony); integration 5.6 (`applyScope — duplication elimination` test confirms zero direct buildCache calls in extract bodies) | **PASS** |
| [O3] | Default minimal payload; `--verbose` opt-in | D4 | Smoke 5.11 (`outgoingLinksReport` + `stats` keys present only with `--verbose`; absent in 5.10 default); integration 5.7 (10/10 — minimal vs verbose parity test); unit 5.5 (7/7 — formatExtractResult mode coverage) | **PASS** |
| [O4] | Natural-root rule retired | D6 | Smoke 5.16 / assertion 5.16: `grep -c "\\-\\-scope " jact/CLAUDE.md` → **2**, both at L44 + L63 are explicit cross-project examples (`/other/project/docs`); in-repo `--scope` usage retired | **PASS** |
| [O5] | Multi-match disambiguation lists every candidate | D2, D7 | Smoke 5.13 (M2: PASS — both candidate paths + "Pass --scope to narrow." in stderr); smoke 5.14 (M3: PASS-WITH-NOTE — exit 2 vs plan's exit 1, but content correct + matches project exit-code convention); smoke 5.15 (M1: **FAIL** — "Did you mean: CLAUDE.md" missing, root cause `src/CitationValidator.ts:567` discards `cacheResult.message`); unit 5.3 (8/8 PASS — FileCache layer correct) | **PARTIAL** (M2 ✅, M3 ✅, M1 ❌) |

- [x] **5.S** STATE-WRITE: All checkboxes updated, verification matrix recorded, deviations noted (5.14 exit code, 5.15 M1 wiring gap).
- [x] **5.C** No code changes made. `git rev-parse HEAD` → `end_hash: 538e5c92713ceb5be12e88935e8826543c459881` (unchanged from 4.C predecessor + plan checkpoint).
- [x] **5.V** VERDICT: **REJECTED** — see verdict below.

#### Verdict

%% *Last Modified: 05/01/26 21:33:16* %%

##### Phase 5 Verdict — REJECTED (recorded 05/01/26 by `bi-row-verifier` opus)

%% *Last Modified: 05/01/26 21:33:16* %%

**Diff range verified:** `c0b3fb6ee87f2ae77a06296fab601fad2a191465..538e5c92713ceb5be12e88935e8826543c459881` (Phase 3 end → Phase 4 commits + plan checkpoint). No Phase 5 code changes.

**Verification checklist results:**

| Item | Result | Evidence |
|---|---|---|
| 5.0 STATE-READ matches Phase 4.C end_hash | ✅ | `git rev-parse HEAD` → `538e5c9`; Phase 4 chain: `cbcf3d7` (D6 content) → `538e5c9` (plan record) |
| 5.1–5.8 individual suites green | ✅ | Counts: 13/13, 12/12, 8/8, 6/6, 7/7, 9/9, 10/10, 5/5 — all ≥ plan-expected (some exceed; coverage delta) |
| 5.9 full `npm test` post-build | ✅ | 500 pass / 85 files / 4.92s — zero regressions vs `c0b3fb6` baseline |
| 5.10 minimal payload default | ✅ | `extractedContentBlocks` only key returned without `--scope` |
| 5.11 `--verbose` opt-in | ✅ | `outgoingLinksReport` + `stats` keys appear in `--verbose` output, absent in default |
| 5.12 help text contains 4 phrases | ✅ | Whitespace-squeezed grep returns: `nearest ancestor`, `.git`, `package.json`, `target file` |
| 5.13 M2 multi-match disambig | ✅ | Both candidate paths + "Pass --scope to narrow." in stderr; exit 1 |
| 5.14 M3 no-scope error message | ⚠️ | Stderr enumerates `cwd .git (none), cwd package.json (none), targetFile walk-up (no markers found)` + suggests `--scope`. Exit code **2** vs plan's "exit 1"; exit 2 matches `jact/CLAUDE.md` "Exit Codes" §3 (system error), so behavior is correct per project convention. Plan text appears to have an editorial slip |
| 5.15 M1 typo near-miss | ❌ | Stderr: `Suggestion: File "CLUADE.md" not found in scope folder.` — **`Did you mean: CLAUDE.md` is absent**. Root cause: `src/CitationValidator.ts:567` constructs `\`File "${filename}" not found in scope folder. ${debugInfo}\`` instead of using `cacheResult.message` (which would be `'CLUADE.md' not found in scope=... (source: cwd-git). Did you mean: CLAUDE.md?` per `FileCache.ts:217-220`). FileCache layer is correct (unit 5.3, 5.4 both green). Validator layer was untouched in this branch (`git diff main..HEAD -- src/CitationValidator.ts` returns empty) — pre-existing wiring gap surfaced by D7 spec |
| 5.16 cross-project-only `--scope` in CLAUDE.md | ✅ | `grep -c "\\-\\-scope " jact/CLAUDE.md` → **2**, both annotated as cross-project |
| 5.17 TS80007 absent | ✅ | `npx tsc --noEmit` emits zero diagnostics |

**Findings (severity-classified):**

- **Blocking (1):**
  - **B-1** — Smoke 5.15 fails its documented assertion. `extract file CLUADE.md` should print `Did you mean: CLAUDE.md, ...?` per the plan's D7 M1 spec, but the validator silently drops the FileCache's pre-computed message. **Required fix:** `src/CitationValidator.ts:562-568` — replace the hardcoded `\`File "${filename}" not found in scope folder. ${debugInfo}\`` template with `\`${cacheResult.message ?? ""}. ${debugInfo}\`` (mirror the pattern at line 559 used for the `duplicate` reason). One-line change. Add a smoke-style integration test under `test/integration/` covering `extract file <typo>` to prevent regression. This is a wiring gap, not a FileCache or D1/D2/D3 defect — the cache produces the message correctly per unit 5.3 + 5.4.

- **Major:** None.

- **Minor:**
  - **M-1** — Plan text for 5.14 says "exit 1" but project exit-code convention (jact/CLAUDE.md §"Exit Codes") allocates exit 2 for system errors and exit 1 for validation failures. Scope-resolution failure is a setup/system condition (no file is examined), so exit 2 is semantically correct. Either update plan text to "exit 2" for accuracy or clarify expectation. Not a defect.

- **Cosmetic:** None.

- **Positive observations:**
  - **P-1** — All 8 individual suites exceeded their plan-expected counts (suite 5.1: 13 vs 12; 5.2: 12 vs 11; 5.5: 7 vs 2; 5.6: 9 vs 8). Indicates broader test coverage than the plan minimums.
  - **P-2** — 5.13 multi-match output is excellent: both candidate paths printed verbatim, scope source annotated (`source: cwd-git`), and trailing imperative "Pass --scope to narrow." is exactly the plan §G2 contract.
  - **P-3** — `applyScope` correctly throws M3 with the 3-fallback enumeration. Test 5.14 stderr is a model error message: tells the user what was tried, in order, and what to do next.
  - **P-4** — `tsc --noEmit` clean across the repo, not just at the 3 expected lines. The Phase 2 tech-debt fix (TS80007 cleanup) appears robust to subsequent line-number drift.

**Deviations from plan:**
- **DEV-1** (5.14): Exit 2 instead of plan's exit 1 — accepted (matches project convention).
- **DEV-2** (5.15): D7 M1 wiring incomplete — see B-1 above.
- **DEV-3** (test-count overshoots): all individual suites have more tests than plan minimums (no failures, just denser coverage). Recorded as positive.

**Disposition:** **REJECTED**. Single blocker (B-1) must be resolved before this branch ships. After fix:
1. Apply the one-line change at `src/CitationValidator.ts:567` to propagate `cacheResult.message`.
2. Add an integration test in `test/integration/extract-default-scope.test.ts` (or new `extract-typo-near-miss.test.ts`) asserting `Did you mean: CLAUDE.md?` appears in stderr for a known-typo input.
3. Re-run smoke 5.15 to verify pass.
4. Re-spawn `bi-row-verifier` to re-execute 5.15 + matrix update.

All other 4 outcomes ([O1]–[O4]) are fully verified and would ship clean independently. [O5] partially passes (M2 + M3 verified; M1 blocked).

##### B-1 Fix — Applied 05/01/26 by `delta-implementer-fix` (sonnet)

%% *Last Modified: 05/01/26 21:36:39* %%

**Fix commit:** `dfbb38f`  
**File changed:** `src/CitationValidator.ts:567` — replaced hardcoded `File "${filename}" not found in scope folder. ${debugInfo}` with `${cacheResult.message ?? ""}. ${debugInfo}` (mirrors duplicate-branch pattern at line 559).  
**Test added:** `test/integration/extract-default-scope.test.ts` — new describe block "M1 near-miss suggestion — not_found branch" asserts `Did you mean: CLAUDE.md` in output for typo input `CLUADE.md`.  
**Smoke result:** `jact extract file CLUADE.md` → stderr contains `Did you mean: CLAUDE.md?` ✓  
**Full suite:** 501 tests, 85 files, all green ✓

---

## Review Gate Justification

%% *Last Modified: 05/01/26 19:31:55* %%

| Gate | Placement | Rework Cost if Skipped |
|------|-----------|----------------------|
| Gate 1 | After Phase 2 (Foundations + Core Build) | HIGH — D1 pure-fn contract, D2 data shape, D3 helper, D7 errors are the architectural backbone. Interface errors here cascade into Phase 3 wiring. Also covers G1 type migration, G3 module export, tech debt removal. ~5 source files, ~5 test files. |
| Gate 2 | After Phase 3 (CLI Surface) | MEDIUM — User-facing behavior (flags, help text, formatter mode). Convention parity with `validate` is verifiable here before docs land. ~3 files. |
| Rejected | After Phase 0 | No reviewable artifacts (research only) |
| Rejected | After Phase 1 alone | Foundations are tightly coupled to Phase 2 consumers; reviewing in isolation forces re-review when D3/D7 land |
| Rejected | After Phase 4 | Doc-only delta; smoke tests in Phase 5 (E2E) catch any drift between docs and shipped behavior |

---

## Orchestrator Instructions

%% *Last Modified: 05/01/26 19:31:55* %%

### Team Spec

%% *Last Modified: 05/01/26 19:31:55* %%

```
TeamCreate:
  name: "extract-smart-default-scope"
  description: "jact extract smart-default-scope — D1-D7 implementation"
```

### Agents to Spawn

%% *Last Modified: 05/01/26 19:31:55* %%

| Role | Agent Type | Model | Persistent? |
|------|-----------|-------|------------|
| Orchestrator | (you) | opus | — |
| Coder | `delta-implementer` | sonnet | yes |
| Reviewer | `delta-reviewer` | opus | spawn at gates only |
| Verifier | `bi-row-verifier` | opus | spawn at Phase 5 only |

### Plan File Checkbox Rule

%% *Last Modified: 05/01/26 19:31:55* %%

**Every agent MUST update plan checkboxes after completing tasks.**

Plan file: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/features/20260501-extract-smart-default-scope/implementation-plan.md`

Include this instruction in EVERY agent spawn prompt:
> After completing each task step, update the plan file checkbox from `- [ ]` to `- [x]` for that step. For STATE-WRITE steps, also record any deviations as inline notes. For COMMIT steps, record the `end_hash` value next to the checkbox. Plan file path: `<plan file path above>`

### Task Creation Map

%% *Last Modified: 05/01/26 19:31:55* %%

Create tasks with `blockedBy` dependencies matching phase sequence:

```
Task #1: Phase 0 — Baseline
  agent: delta-implementer
  blockedBy: []
  prompt: "Execute Phase 0 (baseline research) from the plan.
    Run LSP commands, read key files, run npm test + build to establish green baseline.
    Mark off each checkbox in plan file as you complete it. Record baseline_hash."

Task #2: Phase 1 — Foundation Types + Pure Util (D2 + D1)
  agent: delta-implementer
  blockedBy: [1]
  prompt: "Execute Phase 1 from the plan. TDD cycles:
    D2: Create fileCacheTypes.ts (G1 migration with D7 optional fields). Then RED test/unit/FileCache.test.ts → GREEN refactor src/FileCache.ts to entries: Map<string, string[]>.
    D1: RED test/unit/core/resolveScope.test.ts → GREEN create src/core/resolveScope.ts pure util.
    Run full guardrails (npm run build && npm test). Commit.
    Use BDD assertions (describe/it/expect). No test() blocks.
    Mark off each checkbox in plan file. Record hashes."

Task #3: Phase 2 — Core Build: applyScope + Smart Errors (D3 + D7)
  agent: delta-implementer
  blockedBy: [2]
  prompt: "Execute Phase 2 from the plan. TDD cycles:
    D7 helper: RED findNearMisses.test.ts → GREEN module-level export in FileCache.ts.
    D7 errors: RED FileCache.errors.test.ts → GREEN enrich resolveFile() failure paths.
    D3: RED extract-default-scope.test.ts → GREEN add applyScope() helper + collapse 3 sites + remove TS80007 spurious awaits at L653, L745.
    Run npm run build (confirm zero TS80007). Run npm test. Commit.
    Mark off each checkbox in plan file. Record hashes."

Task #4: Review Gate 1
  agent: delta-reviewer
  blockedBy: [3]
  prompt: "Execute Review Gate 1 (task 2.R) from the plan.
    Scope: src/types/fileCacheTypes.ts, src/core/resolveScope.ts, src/FileCache.ts, src/jact.ts (extract methods), 5 new test files.
    Run git diff from Phase 0 end_hash to HEAD.
    Check: §7a/§7b spec adherence, D2 backward compat, D1 purity, D3 collapses 3 sites + tech debt fix, D7 message format match §8g, G1 type location, G3 findNearMisses module export.
    Return SHIP or NO-SHIP with findings list.
    Mark off checkbox 2.R in plan file."

Task #5: Phase 3 — CLI Surface: --verbose + Help Text (D4 + D5)
  agent: delta-implementer
  blockedBy: [4]
  prompt: "Execute Phase 3 from the plan. Read Review Gate 1 findings first — absorb any fixes.
    D4 formatter: RED formatExtractResult.test.ts → GREEN add mode parameter (minimal/verbose).
    D4 CLI: RED extract-verbose.test.ts → GREEN wire --verbose flag in 3 extract subcommands.
    D5: RED cli-help.test.ts → GREEN update --scope help text on 3 subcommands.
    Run npm run build && npm test. Commit.
    Mark off each checkbox in plan file. Record hashes."

Task #6: Review Gate 2
  agent: delta-reviewer
  blockedBy: [5]
  prompt: "Execute Review Gate 2 (task 3.R) from the plan.
    Scope: src/jact.ts, src/formatExtractResult.ts, 3 new test files.
    Run git diff from Phase 2 end_hash to HEAD.
    Check: D4 parity with validate --verbose pattern (L181-256), D4 markdown verbose footer (G5), D5 3-way subcommand consistency, no coupling drift to D1/D2 contracts.
    Return SHIP or NO-SHIP with findings list.
    Mark off checkbox 3.R in plan file."

Task #7: Phase 4 — Documentation (D6)
  agent: delta-implementer
  blockedBy: [6]
  prompt: "Execute Phase 4 from the plan.
    Edit jact/CLAUDE.md: drop --scope from in-repo examples; retain in cross-project examples; add in-repo vs cross-project comment.
    Verify ~/.claude/CLAUDE.md JACT SCOPE RULE absent (already retired).
    Commit.
    Mark off each checkbox in plan file. Record hashes."

Task #8: Phase 5 — E2E Verification
  agent: bi-row-verifier
  blockedBy: [7]
  prompt: "Execute Phase 5 from the plan.
    Run all 8 test suites individually + full npm test.
    Run 6 smoke tests (in-repo extract, --verbose, --help, M1/M2/M3 errors).
    Run assertions (CLAUDE.md grep count, TS80007 absence).
    Fill verification matrix against [O1] through [O5].
    Return APPROVED or REJECTED with per-criterion evidence.
    Mark off each checkbox in plan file."
```

### Message Routing

%% *Last Modified: 05/01/26 19:31:55* %%

```
Task #1 done → unblock #2
Task #2 done → unblock #3
Task #3 done → unblock #4 (review)
Reviewer Task #4:
  SHIP        → unblock #5
  NO-SHIP     → escalation loop (see below)
Task #5 done → unblock #6 (review)
Reviewer Task #6:
  SHIP        → unblock #7
  NO-SHIP     → escalation loop
Task #7 done → unblock #8 (verify)
Verifier Task #8:
  APPROVED    → shutdown sequence
  REJECTED    → route failures to delta-implementer, re-run verify
```

### Escalation Loop Protocol

%% *Last Modified: 05/01/26 19:31:55* %%

```
Round 1 — NO-SHIP:
  → SendMessage to delta-implementer (sonnet): "Fix these issues: {reviewer findings}"
  → Implementer fixes, commits, messages back
  → SendMessage to delta-reviewer: "Re-review. Changes since last review."

Round 2 — Still NO-SHIP:
  → Spawn NEW delta-implementer agent with model: opus (override)
  → Prompt includes: full reviewer findings from rounds 1+2, specific failing checks
  → Opus implementer fixes, commits, messages back
  → SendMessage to delta-reviewer: "Re-review. Opus implementer applied fixes."

Round 3 — Still NO-SHIP:
  → STOP. Do NOT spawn another agent.
  → Report to human USER:
    - What was attempted (3 rounds)
    - Reviewer findings that persist
    - Files affected
    - Recommendation
```

### Shutdown Sequence

%% *Last Modified: 05/01/26 19:31:55* %%

```
1. SendMessage type: shutdown_request → delta-implementer
2. SendMessage type: shutdown_request → delta-reviewer (if still running)
3. SendMessage type: shutdown_request → bi-row-verifier
4. TeamDelete name: "extract-smart-default-scope"
5. Report to user: final commit SHA, summary, verifier verdict
```

### Orchestrator Anti-Patterns

%% *Last Modified: 05/01/26 19:31:55* %%

- Do NOT read source files after spawning agents
- Do NOT run git commands (diff, add, commit, status)
- Do NOT arbitrate reviewer findings by reading code — route conflicts back to reviewer
- Do NOT fix "trivial" issues directly — delegate everything
- Do NOT skip task creation — every phase needs a tracked task
- Do NOT spawn `delta-reviewer` or `bi-row-verifier` until their predecessor task is unblocked (just-in-time spawning)
