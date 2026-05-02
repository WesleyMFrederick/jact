# Plan: `jact extract` smart default scope — Implementation

%% *Last Modified: 05/01/26 19:13:19* %%

## Context

%% *Last Modified: 05/01/26 19:13:19* %%

Source design: `design-docs/features/20260501-extract-smart-default-scope/plan.md` (LOCKED through Phase 6).

Implements D1–D7 from §7a Delta Architecture:

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
-   await this.fileCache.buildCache(options.scope);
- }
+ // Replaced by applyScope helper (D3) — see File Changes
```

#### `src/jact.ts:745` — TS80007 spurious `await` in `extractFile`

%% *Last Modified: 05/01/26 19:13:19* %%

```diff
- if (options.scope) {
-   await this.fileCache.buildCache(options.scope);
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
+   CacheStats,
+   ResolveResult,
+   ResolveResultFailure,
+ } from "./types/fileCacheTypes.js";
+ import type { ScopeResolution } from "./core/resolveScope.js";

  export class FileCache {
-   private cache: Map<string, string>;     // filename -> absolute path
-   private duplicates: Set<string>;        // filenames appearing multiple times
+   private entries: Map<string, string[]>; // filename -> all paths in scan order

    constructor(...) {
-     this.cache = new Map<string, string>();
-     this.duplicates = new Set<string>();
+     this.entries = new Map<string, string[]>();
    }

    buildCache(scopeFolder: string, verbose = false): CacheStats {
-     this.cache.clear();
-     this.duplicates.clear();
+     this.entries.clear();
      // ... scanDirectory unchanged ...

-     return { totalFiles: this.cache.size, duplicates: this.duplicates.size, ... };
+     // duplicates count derived: entries with array length > 1
+     const duplicateCount = [...this.entries.values()].filter(v => v.length > 1).length;
+     return { totalFiles: this.entries.size, duplicates: duplicateCount, ... };
    }

    private addToCache(filename: string, fullPath: string): void {
-     if (this.cache.has(filename)) {
-       this.duplicates.add(filename);
-     } else {
-       this.cache.set(filename, fullPath);
-     }
+     const existing = this.entries.get(filename);
+     if (existing) existing.push(fullPath);
+     else this.entries.set(filename, [fullPath]);
    }

    resolveFile(filename: string): ResolveResult {
+     // D7 enrichment: failure results carry scope (set by caller via applyScope) + candidates / nearMisses
+     // Implementation reads `this.entries` directly:
+     //   - length === 1 → success
+     //   - length > 1   → { found: false, reason: 'duplicate', candidates: [...], message: ... }
+     //   - length === 0 → check .md alternation, then findFuzzyMatch, then findNearMisses for nearMisses field
+     // The `scope` field on failure is populated by applyScope after this returns
      ...
    }
  }

+ // Module-level export (per G3): unit-testable from outside
+ export function findNearMisses(
+   name: string,
+   entries: Map<string, string[]>,
+   k = 3,
+   maxDist = 2,
+ ): string[] {
+   // Levenshtein over Map.keys(); return top-k by ascending distance ≤ maxDist
+   // Stable sort: ties preserve Map insertion order
+ }
```

#### `src/jact.ts` — D3 applyScope + D4 --verbose + D5 help text

%% *Last Modified: 05/01/26 19:13:19* %%

```diff
+ import { resolveScope, type ScopeResolution } from "./core/resolveScope.js";
+ import type { ResolveResultFailure } from "./types/fileCacheTypes.js";

  class JactCli {
+   /**
+    * D3: Centralized scope resolution + cache build.
+    * Replaces 3× scattered `if (options.scope) buildCache(scope)` blocks.
+    * Throws M3 error if scope cannot be resolved (source: 'none').
+    */
+   private applyScope(
+     options: { scope?: string },
+     targetFile?: string,
+   ): ScopeResolution {
+     const resolved = resolveScope({
+       explicit: options.scope,
+       cwd: process.cwd(),
+       targetFile,
+     });
+     if (resolved.source === "none") {
+       // M3 error
+       throw new Error(formatM3Error(resolved.triedFallbacks ?? []));
+     }
+     this.fileCache.buildCache(resolved.scope);
+     return resolved;  // caller may use for D7 error enrichment
+   }

    extractLinks(sourceFile: string, options: ExtractOptions) {
-     if (options.scope) {
-       this.fileCache.buildCache(options.scope);
-     }
+     const scope = this.applyScope(options, sourceFile);
+     // pass scope to error rendering when resolveFile fails
      ...
-     console.log(JSON.stringify(extractionResult, null, 2));
+     // D4: minimal default
+     const output = options.verbose
+       ? extractionResult
+       : { extractedContentBlocks: extractionResult.extractedContentBlocks };
+     console.log(JSON.stringify(output, null, 2));
    }

    extractHeader(...) {
-     if (options.scope) {
-       await this.fileCache.buildCache(options.scope);  // tech debt: spurious await
-     }
+     const scope = this.applyScope(options, sourceFile);
      ...
+     // D4: pass `mode` to formatExtractResult
+     console.log(formatExtractResult(result, options.format, options.verbose ? 'verbose' : 'minimal'));
    }

    extractFile(targetFile: string, options: ExtractOptions) {
-     if (options.scope) {
-       await this.fileCache.buildCache(options.scope);  // tech debt: spurious await
-     }
+     const scope = this.applyScope(options, targetFile);
      ...
+     // D4: minimal JSON default
+     const output = options.verbose
+       ? result
+       : { extractedContentBlocks: result.extractedContentBlocks };
+     console.log(JSON.stringify(output, null, 2));
    }
  }

  // Commander definitions (L1276-1437 region):
  program
    .command("extract")
    .command("file <name>")
    .option("--format <fmt>", "...")
+   .option("-v, --verbose", "Include outgoingLinksReport + stats in output", false)
    .option(
      "--scope <folder>",
-     "Folder to search for filename matches",
+     "Folder to search for filename matches. Defaults to nearest ancestor "
+     + "of cwd containing .git or package.json; falls back to target file's "
+     + "ancestors. Required only when neither cwd nor target reveal a project root.",
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
+   mode: "minimal" | "verbose" = "minimal",
  ): string {
    switch (format) {
      case "json":
-       return JSON.stringify(result, null, 2);
+       return JSON.stringify(
+         mode === "verbose" ? result : { extractedContentBlocks: result.extractedContentBlocks },
+         null, 2,
+       );

      case "markdown": {
        // existing minimal markdown — content joined by ---
+       const content = contentEntries.join("\n---\n");
+       if (mode === "minimal") return content;
+       // verbose markdown: append link reports + stats sections
+       return `${content}\n\n---\n## Outgoing Links Report\n\n\`\`\`json\n${JSON.stringify(result.outgoingLinksReport, null, 2)}\n\`\`\`\n\n## Stats\n\n\`\`\`json\n${JSON.stringify(result.stats, null, 2)}\n\`\`\``;
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

%% *Last Modified: 05/01/26 19:13:19* %%

1. ✅ All 67 BDD assertions pass (per design §8i)
2. ✅ `npm test` exits 0 — zero existing-test regressions
3. ✅ LSP diagnostics clean across `src/jact.ts`, `src/FileCache.ts`, `src/core/resolveScope.ts`
4. ✅ TS80007 (await on sync) gone at `src/jact.ts:653, 745`
5. ✅ Manual smoke tests above all behave as expected
6. ✅ `jact/CLAUDE.md` examples updated; in-repo invocations show no `--scope`
7. ✅ User CLAUDE.md JACT SCOPE RULE confirmed absent (already retired per design §7b D6)
