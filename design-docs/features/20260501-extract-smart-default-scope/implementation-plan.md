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

%% *Last Modified: 05/01/26 20:16:12* %%

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
- [x] **0.C** COMMIT: Plan-only changes (checkboxes + deviations). `end_hash: <to-be-filled-after-commit>`

### Phase 1 — Foundation Types + Pure Util (D2 + D1) `delta-implementer` (sonnet)

%% *Last Modified: 05/01/26 19:31:55* %%

- [ ] **1.0** STATE-READ: `git rev-parse HEAD` → `start_hash: <hash>`. Verify matches `end_hash` from Phase 0.C. Read plan, review Phase 0 checkboxes.

**D2 — `FileCache.entries: Map<string, string[]>` refactor (foundation; data shape before logic):**

- [ ] **1.1** IMPLEMENT: Create `src/types/fileCacheTypes.ts` per plan §File Changes ADDED — migrate `CacheStats`, `ResolveResultSuccess`, `ResolveResultFailure`, `ResolveResult` from `src/FileCache.ts` inline (G1). Add D7 optional fields (`candidates?`, `scope?`, `nearMisses?`) to `ResolveResultFailure` now (consumed in Phase 2).
- [ ] **1.2** RED: Create `test/unit/FileCache.test.ts` per plan §File Changes (11 assertions: entries data shape, addToCache append, resolveFile single/duplicate, backward compat).
- [ ] **1.3** VERIFY: `npx vitest run test/unit/FileCache.test.ts` — RED confirmed.
- [ ] **1.4** GREEN: Modify `src/FileCache.ts` per plan §MODIFIED D2 portion: replace `cache + duplicates` dual state with `entries: Map<string, string[]>`. Update constructor, `buildCache()`, `addToCache()`, `resolveFile()`. Import types from new `fileCacheTypes.ts`. Preserve `findFuzzyMatch()`.
- [ ] **1.5** VERIFY: `npx vitest run test/unit/FileCache.test.ts` — GREEN confirmed. `npm test` — no regressions in CitationValidator/ParsedFileCache (which consume FileCache via public API).

**D1 — `src/core/resolveScope.ts` new pure util (foundation; pure function, no consumers yet):**

- [ ] **1.6** RED: Create `test/unit/core/resolveScope.test.ts` per plan §File Changes (12 assertions: explicit override, cwd walk-up, targetFile fallback, fail-fast none, purity).
- [ ] **1.7** VERIFY: `npx vitest run test/unit/core/resolveScope.test.ts` — RED confirmed.
- [ ] **1.8** GREEN: Create `src/core/resolveScope.ts` per plan §File Changes ADDED. Implement `resolveScope()` with algorithm: ① explicit → ② cwd .git → ③ cwd package.json → ④ targetFile .git → ⑤ targetFile package.json → ⑥ none. Inject `fs` for testability. Export `ScopeSource`, `ScopeResolution`, `ResolveScopeInput` types.
- [ ] **1.9** VERIFY: `npx vitest run test/unit/core/resolveScope.test.ts` — GREEN confirmed.

**Phase 1 guardrails:**

- [ ] **1.10** VERIFY: `npm run build` — TypeScript clean across new files + modified FileCache.
- [ ] **1.11** VERIFY: `npm test` — full suite, no regressions.
- [ ] **1.S** STATE-WRITE: Update plan checkboxes, note deviations
- [ ] **1.C** COMMIT: Commit Phase 1 — "feat(scope): D2 entries Map refactor + D1 resolveScope util". `git rev-parse HEAD` → `end_hash: <hash>`

### Phase 2 — Core Build: applyScope + Smart Errors (D3 + D7) `delta-implementer` (sonnet)

%% *Last Modified: 05/01/26 19:31:55* %%

- [ ] **2.0** STATE-READ: `git rev-parse HEAD` → `start_hash: <hash>`. Verify matches Phase 1.C end_hash.

**D7 helper — `findNearMisses` module export (TDD first, consumed by D7 errors):**

- [ ] **2.1** RED: Create `test/unit/findNearMisses.test.ts` per plan §File Changes (6 assertions: Levenshtein top-3 distance ≤2, stable sort).
- [ ] **2.2** VERIFY: `npx vitest run test/unit/findNearMisses.test.ts` — RED confirmed.
- [ ] **2.3** GREEN: Add module-level `export function findNearMisses(name, entries, k=3, maxDist=2)` to `src/FileCache.ts` per plan §MODIFIED. Stable sort: ties preserve Map insertion order.
- [ ] **2.4** VERIFY: `npx vitest run test/unit/findNearMisses.test.ts` — GREEN confirmed.

**D7 errors — M1/M2 in `resolveFile()` (TDD):**

- [ ] **2.5** RED: Create `test/unit/FileCache.errors.test.ts` per plan §File Changes (8 assertions: M1 not-found w/ scope/source/nearMisses; M2 duplicate w/ candidates/Pass --scope hint).
- [ ] **2.6** VERIFY: `npx vitest run test/unit/FileCache.errors.test.ts` — RED confirmed.
- [ ] **2.7** GREEN: Enrich `resolveFile()` failure paths in `src/FileCache.ts`: populate `candidates` on duplicate (read directly from `entries.get(filename)`), populate `nearMisses` on not_found via `findNearMisses()`. Format M1/M2 messages per design §8g.
- [ ] **2.8** VERIFY: `npx vitest run test/unit/FileCache.errors.test.ts` — GREEN confirmed.

**D3 — `applyScope` helper + tech debt collapse (TDD):**

- [ ] **2.9** RED: Create `test/integration/extract-default-scope.test.ts` per plan §File Changes (8 assertions: cwd-in-repo no flag, explicit wins, target walk-up, M3 fail, applyScope unification, no spurious await).
- [ ] **2.10** VERIFY: `npx vitest run test/integration/extract-default-scope.test.ts` — RED confirmed.
- [ ] **2.11** GREEN: Add private `applyScope(options, targetFile?)` to `JactCli` in `src/jact.ts` per plan §MODIFIED. Throws M3 error on `source: 'none'` (formatted per design §8g M3). Calls `this.fileCache.buildCache(resolved.scope)`. Returns `ScopeResolution` for caller error enrichment.
- [ ] **2.12** GREEN: Replace 3× scattered `if (options.scope) { ... buildCache(...) }` blocks in `extractLinks` (L555), `extractHeader` (L645), `extractFile` (L738) with single `const scope = this.applyScope(options, sourceFile);` call. **Remove spurious `await`** at L653 + L745 (TS80007 tech debt).
- [ ] **2.13** GREEN: Wire `scope` from `applyScope()` into error rendering paths so D7 M1/M2 errors carry `ResolveResultFailure.scope` field.
- [ ] **2.14** VERIFY: `npx vitest run test/integration/extract-default-scope.test.ts` — GREEN confirmed.

**Phase 2 guardrails:**

- [ ] **2.15** VERIFY: `npm run build` — TypeScript clean. **Confirm zero TS80007 diagnostics in `src/jact.ts:645-813`**.
- [ ] **2.16** VERIFY: `npm test` — full suite, no regressions.
- [ ] **2.S** STATE-WRITE: Update plan checkboxes, note deviations
- [ ] **2.C** COMMIT: Commit Phase 2 — "feat(scope): D3 applyScope helper + D7 smart error stack (M1/M2/M3)". `git rev-parse HEAD` → `end_hash: <hash>`

#### REVIEW GATE 1 `delta-reviewer` (opus)

%% *Last Modified: 05/01/26 19:31:55* %%

- [ ] **2.R** REVIEW: Scope — `src/types/fileCacheTypes.ts`, `src/core/resolveScope.ts`, `src/FileCache.ts`, `src/jact.ts` (applyScope + 3 method modifications), all 5 new test files. Review `git diff <Phase_0.C_end_hash>..HEAD`.
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

### Phase 3 — CLI Surface: --verbose + Help Text (D4 + D5) `delta-implementer` (sonnet)

%% *Last Modified: 05/01/26 19:31:55* %%

- [ ] **3.0** STATE-READ: `git rev-parse HEAD` → `start_hash: <hash>`. Verify matches Phase 2.C end_hash. Read plan, review Phase 2 checkboxes + Review Gate 1 findings.

**D4 — formatter minimal/verbose mode (TDD):**

- [ ] **3.1** RED: Create `test/unit/formatExtractResult.test.ts` per plan §File Changes (2 assertions: minimal returns extractedContentBlocks only; verbose returns full result).
- [ ] **3.2** VERIFY: `npx vitest run test/unit/formatExtractResult.test.ts` — RED confirmed.
- [ ] **3.3** GREEN: Modify `src/formatExtractResult.ts` per plan §MODIFIED — add `mode: "minimal" | "verbose" = "minimal"` parameter. JSON path: stringify `{ extractedContentBlocks }` when minimal. Markdown path: append `## Outgoing Links Report` + `## Stats` sections only when verbose (per G5).
- [ ] **3.4** VERIFY: `npx vitest run test/unit/formatExtractResult.test.ts` — GREEN confirmed.

**D4 — CLI --verbose wiring (TDD):**

- [ ] **3.5** RED: Create `test/integration/extract-verbose.test.ts` per plan §File Changes (10 assertions: minimal default, verbose includes 3 keys, parity with validate).
- [ ] **3.6** VERIFY: `npx vitest run test/integration/extract-verbose.test.ts` — RED confirmed.
- [ ] **3.7** GREEN: Update `JactCli.extractFile/Header/Links` in `src/jact.ts` per plan §MODIFIED — pass `options.verbose ? 'verbose' : 'minimal'` to formatter; trim JSON output when not verbose.
- [ ] **3.8** GREEN: Update Commander definitions (L1276-1437) for `extract file/header/links` — add `.option("-v, --verbose", "Include outgoingLinksReport + stats in output", false)` to all three subcommands.
- [ ] **3.9** VERIFY: `npx vitest run test/integration/extract-verbose.test.ts` — GREEN confirmed.

**D5 — Commander --scope help text (TDD):**

- [ ] **3.10** RED: Create `test/cli-integration/cli-help.test.ts` per plan §File Changes (5 assertions: "nearest ancestor", ".git" + "package.json", target walk-up, "Required only when…", 3-way subcommand consistency).
- [ ] **3.11** VERIFY: `npx vitest run test/cli-integration/cli-help.test.ts` — RED confirmed.
- [ ] **3.12** GREEN: Update `--scope <folder>` option help string on all 3 `extract` subcommands per plan §MODIFIED — describe inference algorithm (nearest ancestor of cwd containing .git or package.json; falls back to target file's ancestors; required only when neither reveals a project root).
- [ ] **3.13** VERIFY: `npx vitest run test/cli-integration/cli-help.test.ts` — GREEN confirmed.

**Phase 3 guardrails:**

- [ ] **3.14** VERIFY: `npm run build` — TypeScript clean.
- [ ] **3.15** VERIFY: `npm test` — full suite, no regressions.
- [ ] **3.S** STATE-WRITE: Update plan checkboxes, note deviations
- [ ] **3.C** COMMIT: Commit Phase 3 — "feat(scope): D4 minimal-default --verbose + D5 --scope help text". `git rev-parse HEAD` → `end_hash: <hash>`

#### REVIEW GATE 2 `delta-reviewer` (opus)

%% *Last Modified: 05/01/26 19:31:55* %%

- [ ] **3.R** REVIEW: Scope — `src/jact.ts` (extract methods + Commander defs), `src/formatExtractResult.ts`, 3 new test files. Review `git diff <Phase_2.C_end_hash>..HEAD`.
  - Verify: D4 mirrors `validate` `--verbose` pattern at L181-256 (convention parity)
  - Verify: D4 markdown verbose footer format matches G5 decision (appends Outgoing Links Report + Stats sections)
  - Verify: D5 help text matches design §7a verbatim across all 3 extract subcommands (3-way consistency)
  - Verify: No coupling drift — Phase 3 changes do not touch D1/D2 contracts
  - **Verdict:** SHIP → proceed to Phase 4. NO-SHIP → escalation policy applies.

### Phase 4 — Documentation (D6) `delta-implementer` (sonnet)

%% *Last Modified: 05/01/26 19:31:55* %%

- [ ] **4.0** STATE-READ: `git rev-parse HEAD` → `start_hash: <hash>`. Verify matches Phase 3.C end_hash.
- [ ] **4.1** UPDATE: Edit `jact/CLAUDE.md` per plan §MODIFIED D6 — drop `--scope` from in-repo `npm run jact:validate`, `jact validate`, `jact extract`, `jact:base-paths`, `jact:extract` examples. Retain `--scope` in cross-project examples only. Add comment lines distinguishing in-repo vs cross-project usage.
- [ ] **4.2** VERIFY: `grep -c "\\-\\-scope " jact/CLAUDE.md` — count drops; only cross-project examples retain `--scope`.
- [ ] **4.3** VERIFY: `grep -c "JACT SCOPE RULE" ~/.claude/CLAUDE.md` — confirm 0 (already retired per design §7b D6, no edit needed; verify absence only).
- [ ] **4.S** STATE-WRITE: Update plan checkboxes, note deviations
- [ ] **4.C** COMMIT: Commit Phase 4 — "docs(scope): D6 jact/CLAUDE.md examples drop --scope for in-repo". `git rev-parse HEAD` → `end_hash: <hash>`

### Phase 5 — E2E Verification `bi-row-verifier` (opus)

%% *Last Modified: 05/01/26 19:31:55* %%

- [ ] **5.0** STATE-READ: `git rev-parse HEAD` → `start_hash: <hash>`. Verify matches Phase 4.C end_hash. All prior phase checkboxes (0.0–4.C) checked.
- [ ] **5.1** SUITE: `npx vitest run test/unit/core/resolveScope.test.ts` — expect 12/12 pass.
- [ ] **5.2** SUITE: `npx vitest run test/unit/FileCache.test.ts` — expect 11/11 pass.
- [ ] **5.3** SUITE: `npx vitest run test/unit/FileCache.errors.test.ts` — expect 8/8 pass.
- [ ] **5.4** SUITE: `npx vitest run test/unit/findNearMisses.test.ts` — expect 6/6 pass.
- [ ] **5.5** SUITE: `npx vitest run test/unit/formatExtractResult.test.ts` — expect 2/2 pass.
- [ ] **5.6** SUITE: `npx vitest run test/integration/extract-default-scope.test.ts` — expect 8/8 pass.
- [ ] **5.7** SUITE: `npx vitest run test/integration/extract-verbose.test.ts` — expect 10/10 pass.
- [ ] **5.8** SUITE: `npx vitest run test/cli-integration/cli-help.test.ts` — expect 5/5 pass.
- [ ] **5.9** SUITE: `npm run build && npm test` — full suite, expect 67 new assertions pass + zero existing-test regressions.
- [ ] **5.10** SMOKE: `cd jact && jact extract file CLAUDE.md` — expect minimal JSON `{extractedContentBlocks: ...}` without `--scope`. (D1+D3, [O1]+[O2])
- [ ] **5.11** SMOKE: `jact extract file CLAUDE.md --verbose` — expect output includes `outgoingLinksReport` + `stats` keys. (D4, [O3])
- [ ] **5.12** SMOKE: `jact extract file --help | grep -E "(nearest ancestor|\\.git|package\\.json|target file)"` — expect 4 matched lines. (D5)
- [ ] **5.13** SMOKE: Setup fixture w/ two `foo.md` files; `jact extract file foo.md` — expect exit 1, stderr lists every candidate path + "Pass --scope to narrow." (D7 M2, [O5])
- [ ] **5.14** SMOKE: `cd /tmp && mkdir empty-dir && cd empty-dir && jact extract file CLAUDE.md` — expect exit 1, stderr enumerates fallbacks tried + suggests --scope. (D7 M3)
- [ ] **5.15** SMOKE: `jact extract file CLUADE.md` (typo) — expect exit 1, stderr "Did you mean: CLAUDE.md, ..." (D7 M1)
- [ ] **5.16** ASSERT: `grep -c "\\-\\-scope " jact/CLAUDE.md` — count reflects cross-project-only usage. (D6, [O4])
- [ ] **5.17** ASSERT: TS80007 diagnostics absent at `src/jact.ts:653, 745`.
- [ ] **5.18** VERIFY: Verification matrix filled — see below.

#### Verification Matrix ([O1] through [O5])

%% *Last Modified: 05/01/26 19:31:55* %%

| # | BI-Row [O] | Delta Coverage | Evidence Source | Pass/Fail |
| --- | --- | --- | --- | --- |
| [O1] | User in-repo resolves by name w/o `--scope` | D1, D3, D5 | Smoke 5.10, 5.12; integration 5.6 | _filled by verifier_ |
| [O2] | Agent in-repo resolves by name w/o rebuilding root | D1, D3 | Smoke 5.10; integration 5.6 | _filled by verifier_ |
| [O3] | Default minimal payload; `--verbose` opt-in | D4 | Smoke 5.11; integration 5.7; unit 5.5 | _filled by verifier_ |
| [O4] | Natural-root rule retired | D6 | Smoke 5.16; assertion 5.16 | _filled by verifier_ |
| [O5] | Multi-match disambiguation lists every candidate | D2, D7 | Smoke 5.13, 5.14, 5.15; unit 5.3 | _filled by verifier_ |

- [ ] **5.S** STATE-WRITE: All checkboxes updated, verification matrix recorded, deviations noted.
- [ ] **5.C** No code changes made. `git rev-parse HEAD` → `end_hash: <hash>` (unchanged from 4.C).
- [ ] **5.V** VERDICT: **APPROVED / REJECTED** — see verdict below.

#### Verdict

%% *Last Modified: 05/01/26 19:31:55* %%

_To be filled by `bi-row-verifier`._

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
