# Epic 7: CLI Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert the 3 remaining JavaScript files (LinkObjectFactory, componentFactory, citation-manager) to TypeScript, restoring 314/314 tests and completing the migration.

**Architecture:** Leaf-first conversion order: LinkObjectFactory → componentFactory → citation-manager. Each file gets type annotations added to existing code. componentFactory import path change (dist/ → src/) unblocks 50 failing tests. New CLI types added to existing shared type libraries.

**Tech Stack:** TypeScript 5.x, Commander.js (ships own types), Vitest, Node.js fs/path

---

## Task 1 — Add CLI types to contentExtractorTypes.ts

### Files

- `tools/citation-manager/src/types/contentExtractorTypes.ts` (MODIFY — append new interfaces)

### Step 1: Write the failing test

Create a type-level test that imports and uses the new interfaces:

```typescript
// tools/citation-manager/test/unit/types/cliTypes.test.ts
import { describe, it, expect } from "vitest";
import type {
  CliValidateOptions,
  CliExtractOptions,
  FormattedValidationResult,
  FixDetail,
} from "../../../src/types/contentExtractorTypes.js";

describe("CLI Types", () => {
  it("CliValidateOptions accepts valid options", () => {
    const opts: CliValidateOptions = {
      format: "json",
      lines: "150-160",
      scope: "/docs",
      fix: true,
    };
    expect(opts.format).toBe("json");
  });

  it("CliValidateOptions allows empty object", () => {
    const opts: CliValidateOptions = {};
    expect(opts).toBeDefined();
  });

  it("CliExtractOptions accepts valid options", () => {
    const opts: CliExtractOptions = {
      scope: "/docs",
      format: "json",
      fullFiles: true,
    };
    expect(opts.fullFiles).toBe(true);
  });

  it("FormattedValidationResult extends ValidationResult", () => {
    const result: FormattedValidationResult = {
      summary: { total: 1, valid: 1, warnings: 0, errors: 0 },
      links: [],
      validationTime: "0.5s",
      lineRange: "10-20",
    };
    expect(result.validationTime).toBe("0.5s");
    expect(result.lineRange).toBe("10-20");
  });

  it("FixDetail captures fix metadata", () => {
    const fix: FixDetail = {
      line: 42,
      old: "old-citation-text",
      new: "new-citation-text",
      type: "path",
    };
    expect(fix.type).toBe("path");
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd tools/citation-manager && npx vitest run test/unit/types/cliTypes.test.ts`

Expected: FAIL — `CliValidateOptions`, `CliExtractOptions`, `FormattedValidationResult`, `FixDetail` are not exported from `contentExtractorTypes.ts`

### Step 3: Write minimal implementation

Append to `tools/citation-manager/src/types/contentExtractorTypes.ts`:

```typescript
import type { ValidationResult } from './validationTypes.js';

/**
 * CLI validate command options.
 * Integration: Passed to CitationManager.validate() and .fix() methods.
 */
export interface CliValidateOptions {
  format?: "cli" | "json";
  lines?: string;
  scope?: string;
  fix?: boolean;
}

/**
 * CLI extract command options.
 * Integration: Passed to CitationManager.extractLinks/Header/File methods.
 */
export interface CliExtractOptions {
  scope?: string;
  format?: string;
  fullFiles?: boolean;
}

/**
 * Validation result enriched with CLI-specific metadata.
 * Pattern: Extends ValidationResult with timing and filter info.
 */
export interface FormattedValidationResult extends ValidationResult {
  /** Time taken for validation (e.g., "0.5s") */
  validationTime: string;
  /** Line range filter applied (e.g., "150-160") */
  lineRange?: string;
  /** File path of validated file */
  file?: string;
}

/**
 * Individual fix detail for the fix report.
 * Pattern: Tracks each change applied during auto-fix.
 */
export interface FixDetail {
  line: number;
  old: string;
  new: string;
  type: "path" | "anchor" | "path+anchor";
}
```

### Step 4: Run test to verify it passes

Run: `cd tools/citation-manager && npx vitest run test/unit/types/cliTypes.test.ts`

Expected: PASS — all 5 tests pass

### Step 5: Run full test suite

Run: `cd tools/citation-manager && npx vitest run`

Expected: 263 tests pass (same as before — no behavioral change)

### Step 6: Type check

Run: `cd tools/citation-manager && npx tsc --noEmit`

Expected: Zero new errors

### Step 7: Commit

Use `create-git-commit` skill to commit.

---

## Task 2 — Convert LinkObjectFactory.js → LinkObjectFactory.ts

### Files

- `tools/citation-manager/src/factories/LinkObjectFactory.js` → `LinkObjectFactory.ts` (RENAME + MODIFY)

### Step 1: Write the failing test

Create a type-level test that imports from the `.ts` file:

```typescript
// tools/citation-manager/test/unit/factories/link-object-factory-types.test.ts
import { describe, it, expect } from "vitest";
import { LinkObjectFactory } from "../../../src/factories/LinkObjectFactory.js";
import type { LinkObject } from "../../../src/types/citationTypes.js";

describe("LinkObjectFactory TypeScript", () => {
  it("createHeaderLink returns LinkObject", () => {
    const factory = new LinkObjectFactory();
    const link: LinkObject = factory.createHeaderLink("/tmp/test.md", "Overview");
    expect(link.linkType).toBe("markdown");
    expect(link.scope).toBe("cross-document");
    expect(link.anchorType).toBe("header");
    expect(link.target.anchor).toBe("Overview");
  });

  it("createFileLink returns LinkObject", () => {
    const factory = new LinkObjectFactory();
    const link: LinkObject = factory.createFileLink("/tmp/test.md");
    expect(link.linkType).toBe("markdown");
    expect(link.anchorType).toBeNull();
    expect(link.target.anchor).toBeNull();
  });

  it("createHeaderLink omits validation property", () => {
    const factory = new LinkObjectFactory();
    const link = factory.createHeaderLink("/tmp/test.md", "Test");
    expect(link).not.toHaveProperty("validation");
  });

  it("createFileLink omits validation property", () => {
    const factory = new LinkObjectFactory();
    const link = factory.createFileLink("/tmp/test.md");
    expect(link).not.toHaveProperty("validation");
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd tools/citation-manager && npx vitest run test/unit/factories/link-object-factory-types.test.ts`

Expected: FAIL — either import fails (file not renamed yet) or `validation` property still present (tests 3-4)

### Step 3: Write minimal implementation

Rename `LinkObjectFactory.js` → `LinkObjectFactory.ts` and add types:

```bash
cd tools/citation-manager && git mv src/factories/LinkObjectFactory.js src/factories/LinkObjectFactory.ts
```

Edit `tools/citation-manager/src/factories/LinkObjectFactory.ts`:

```typescript
import { resolve, relative, basename } from "node:path";
import type { LinkObject } from "../types/citationTypes.js";

/**
 * LinkObjectFactory - Level 4 helper for CLI Orchestrator
 *
 * Pattern: Adapts CLI string inputs to LinkObject data contract
 * Boundary: Creates unvalidated LinkObjects for synthetic extraction workflows
 */
export class LinkObjectFactory {
 /**
  * Create synthetic LinkObject for header extraction
  */
 createHeaderLink(targetPath: string, headerName: string): LinkObject {
  const absolutePath = resolve(targetPath);

  return {
   linkType: "markdown",
   scope: "cross-document",
   anchorType: "header",
   source: {
    path: {
     absolute: process.cwd(),
    },
   },
   target: {
    path: {
     raw: targetPath,
     absolute: absolutePath,
     relative: relative(process.cwd(), absolutePath),
    },
    anchor: headerName,
   },
   text: headerName,
   fullMatch: `[${headerName}](${targetPath}#${headerName})`,
   line: 0,
   column: 0,
   extractionMarker: null,
  };
 }

 /**
  * Create synthetic LinkObject for full-file extraction
  */
 createFileLink(targetPath: string): LinkObject {
  const absolutePath = resolve(targetPath);
  const fileName = basename(targetPath);

  return {
   linkType: "markdown",
   scope: "cross-document",
   anchorType: null,
   source: {
    path: {
     absolute: process.cwd(),
    },
   },
   target: {
    path: {
     raw: targetPath,
     absolute: absolutePath,
     relative: relative(process.cwd(), absolutePath),
    },
    anchor: null,
   },
   text: fileName,
   fullMatch: `[${fileName}](${targetPath})`,
   line: 0,
   column: 0,
   extractionMarker: null,
  };
 }
}
```

**Key changes:**
- Added `import type { LinkObject }` from types
- Added parameter types and return type annotations
- Removed `validation: null` — design decision: omit from factory output (optional `?` semantics)
- Removed `extractionMarker: null` → keep it (it's required on `LinkObject`, typed as `{...} | null`)

### Step 4: Run test to verify it passes

Run: `cd tools/citation-manager && npx vitest run test/unit/factories/link-object-factory-types.test.ts`

Expected: PASS — all 4 tests pass

### Step 5: Run full test suite

Run: `cd tools/citation-manager && npx vitest run`

Expected: 263 tests pass (existing tests still work — `validation: null` removal may affect downstream tests that assert on `validation` property of synthetic links; if failures, check and adjust)

### Step 6: Type check

Run: `cd tools/citation-manager && npx tsc --noEmit`

Expected: Zero new errors

### Step 7: Commit

Use `create-git-commit` skill to commit.

---

## Task 3 — Convert componentFactory.js → componentFactory.ts

### Files

- `tools/citation-manager/src/factories/componentFactory.js` → `componentFactory.ts` (RENAME + MODIFY)

### Step 1: Write the failing test

```typescript
// tools/citation-manager/test/unit/factories/component-factory-types.test.ts
import { describe, it, expect } from "vitest";
import {
  createMarkdownParser,
  createFileCache,
  createParsedFileCache,
  createCitationValidator,
  createContentExtractor,
} from "../../../src/factories/componentFactory.js";

describe("componentFactory TypeScript", () => {
  it("createMarkdownParser returns MarkdownParser instance", () => {
    const parser = createMarkdownParser();
    expect(parser).toBeDefined();
    expect(typeof parser.parseFile).toBe("function");
  });

  it("createFileCache returns FileCache instance", () => {
    const cache = createFileCache();
    expect(cache).toBeDefined();
    expect(typeof cache.buildCache).toBe("function");
  });

  it("createParsedFileCache accepts null parser", () => {
    const cache = createParsedFileCache(null);
    expect(cache).toBeDefined();
  });

  it("createCitationValidator accepts null dependencies", () => {
    const validator = createCitationValidator(null, null);
    expect(validator).toBeDefined();
    expect(typeof validator.validateFile).toBe("function");
  });

  it("createContentExtractor accepts null dependencies", () => {
    const extractor = createContentExtractor(null, null, null);
    expect(extractor).toBeDefined();
    expect(typeof extractor.extractContent).toBe("function");
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd tools/citation-manager && npx vitest run test/unit/factories/component-factory-types.test.ts`

Expected: FAIL — imports resolve to `.js` file which imports from `dist/` (which may not exist or be stale)

### Step 3: Write minimal implementation

Rename and convert:

```bash
cd tools/citation-manager && git mv src/factories/componentFactory.js src/factories/componentFactory.ts
```

Edit `tools/citation-manager/src/factories/componentFactory.ts`:

```typescript
import fs from "node:fs";
import path from "node:path";
import { CitationValidator } from "../CitationValidator.js";
import { FileCache } from "../FileCache.js";
import { MarkdownParser } from "../MarkdownParser.js";
import { ParsedFileCache } from "../ParsedFileCache.js";
import { ContentExtractor } from "../core/ContentExtractor/ContentExtractor.js";
import { StopMarkerStrategy } from "../core/ContentExtractor/eligibilityStrategies/StopMarkerStrategy.js";
import { ForceMarkerStrategy } from "../core/ContentExtractor/eligibilityStrategies/ForceMarkerStrategy.js";
import { SectionLinkStrategy } from "../core/ContentExtractor/eligibilityStrategies/SectionLinkStrategy.js";
import { CliFlagStrategy } from "../core/ContentExtractor/eligibilityStrategies/CliFlagStrategy.js";
import type { ExtractionEligibilityStrategy } from "../types/contentExtractorTypes.js";

export function createMarkdownParser(): MarkdownParser {
 return new MarkdownParser(fs);
}

export function createFileCache(): FileCache {
 return new FileCache(fs, path);
}

export function createParsedFileCache(
 parser: MarkdownParser | null = null,
): ParsedFileCache {
 const _parser = parser || createMarkdownParser();
 return new ParsedFileCache(_parser);
}

export function createCitationValidator(
 parsedFileCache: ParsedFileCache | null = null,
 fileCache: FileCache | null = null,
): CitationValidator {
 const _parsedFileCache = parsedFileCache || createParsedFileCache();
 const _fileCache = fileCache || createFileCache();
 return new CitationValidator(_parsedFileCache, _fileCache);
}

export function createContentExtractor(
 parsedFileCache: ParsedFileCache | null = null,
 citationValidator: CitationValidator | null = null,
 strategies: ExtractionEligibilityStrategy[] | null = null,
): ContentExtractor {
 const _parsedFileCache = parsedFileCache || createParsedFileCache();
 const _citationValidator =
  citationValidator || createCitationValidator();
 const _strategies = strategies || [
  new StopMarkerStrategy(),
  new ForceMarkerStrategy(),
  new SectionLinkStrategy(),
  new CliFlagStrategy(),
 ];

 return new ContentExtractor(
  _strategies,
  _parsedFileCache,
  _citationValidator,
 );
}
```

**Key changes:**
- Import paths changed from `../../dist/X.js` → `../X.js` (source imports)
- Added parameter types and explicit return types
- Added `ExtractionEligibilityStrategy` type import for strategies array

### Step 4: Run test to verify it passes

Run: `cd tools/citation-manager && npx vitest run test/unit/factories/component-factory-types.test.ts`

Expected: PASS — all 5 tests pass

### Step 5: Run full test suite — CRITICAL CHECKPOINT

Run: `cd tools/citation-manager && npx vitest run`

**Expected: 314/314 tests pass** — the import path change from `dist/` to source resolves the 50 failing CLI-dependent tests.

If NOT 314 tests: STOP. Investigate before proceeding to Task 4.

### Step 6: Type check

Run: `cd tools/citation-manager && npx tsc --noEmit`

Expected: Zero new errors

### Step 7: Commit

Use `create-git-commit` skill to commit.

---

## Task 4 — Convert citation-manager.js → .ts (class + constructor + private helpers)

### Files

- `tools/citation-manager/src/citation-manager.js` → `citation-manager.ts` (RENAME + MODIFY)

### Step 1: Write the failing test

```typescript
// tools/citation-manager/test/unit/citation-manager-class.test.ts
import { describe, it, expect } from "vitest";
import { CitationManager } from "../../src/citation-manager.js";

describe("CitationManager class TypeScript", () => {
  it("constructs without errors", () => {
    const manager = new CitationManager();
    expect(manager).toBeDefined();
  });

  it("has validate method", () => {
    const manager = new CitationManager();
    expect(typeof manager.validate).toBe("function");
  });

  it("has fix method", () => {
    const manager = new CitationManager();
    expect(typeof manager.fix).toBe("function");
  });

  it("has extractLinks method", () => {
    const manager = new CitationManager();
    expect(typeof manager.extractLinks).toBe("function");
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd tools/citation-manager && npx vitest run test/unit/citation-manager-class.test.ts`

Expected: FAIL — `.js` file not yet renamed to `.ts`

### Step 3: Write minimal implementation

Rename file:

```bash
cd tools/citation-manager && git mv src/citation-manager.js src/citation-manager.ts
```

Edit `tools/citation-manager/src/citation-manager.ts` — add imports and type the class shell, constructor, and private helpers:

At the top of the file, add type imports after the existing imports:

```typescript
#!/usr/bin/env node

import { Command } from "commander";
import {
 createCitationValidator,
 createContentExtractor,
 createFileCache,
 createMarkdownParser,
 createParsedFileCache,
} from "./factories/componentFactory.js";
import { LinkObjectFactory } from "./factories/LinkObjectFactory.js";
import type { MarkdownParser } from "./MarkdownParser.js";
import type { ParsedFileCache } from "./ParsedFileCache.js";
import type { FileCache } from "./FileCache.js";
import type { CitationValidator } from "./CitationValidator.js";
import type { ContentExtractor } from "./core/ContentExtractor/ContentExtractor.js";
import type { EnrichedLinkObject } from "./types/validationTypes.js";
import type {
 CliValidateOptions,
 CliExtractOptions,
 FormattedValidationResult,
 FixDetail,
} from "./types/contentExtractorTypes.js";
import type { OutgoingLinksExtractedContent } from "./types/contentExtractorTypes.js";
```

Type the class properties and constructor:

```typescript
export class CitationManager {
 private parser: MarkdownParser;
 private parsedFileCache: ParsedFileCache;
 private fileCache: FileCache;
 private validator: CitationValidator;
 private contentExtractor: ContentExtractor;

 constructor() {
  this.parser = createMarkdownParser();
  this.parsedFileCache = createParsedFileCache(this.parser);
  this.fileCache = createFileCache();
  this.validator = createCitationValidator(
   this.parsedFileCache,
   this.fileCache,
  );
  this.contentExtractor = createContentExtractor(
   this.parsedFileCache,
  );
 }
 // ... methods follow in Tasks 5 & 6
```

Type the private helper methods:

```typescript
 private filterResultsByLineRange(
  result: FormattedValidationResult,
  lineRange: string,
 ): FormattedValidationResult {
  // ... existing body unchanged
 }

 private parseLineRange(lineRange: string): { startLine: number; endLine: number } {
  // ... existing body unchanged
 }

 private formatForCLI(result: FormattedValidationResult): string {
  // ... existing body unchanged
 }

 private formatAsJSON(result: FormattedValidationResult): string {
  // ... existing body unchanged
 }

 private applyPathConversion(
  citation: string,
  pathConversion: { original: string; recommended: string },
 ): string {
  // ... existing body unchanged
 }

 private parseAvailableHeaders(
  suggestion: string,
 ): Array<{ text: string; anchor: string }> {
  // ... existing body unchanged
 }

 private normalizeAnchorForMatching(anchor: string): string {
  // ... existing body unchanged
 }

 private findBestHeaderMatch(
  brokenAnchor: string,
  availableHeaders: Array<{ text: string; anchor: string }>,
 ): { text: string; anchor: string } | undefined {
  // ... existing body unchanged
 }

 private urlEncodeAnchor(headerText: string): string {
  // ... existing body unchanged
 }

 private applyAnchorFix(citation: string, link: EnrichedLinkObject): string {
  // ... existing body unchanged
 }
```

**Note:** Keep all method bodies unchanged. Only add type annotations to parameters, return types, and class properties. Add `private` access modifier to helper methods.

**Note on `error.message`:** In catch blocks, type the error: `catch (error: unknown)` and use `(error as Error).message` or add a type guard.

### Step 4: Run test to verify it passes

Run: `cd tools/citation-manager && npx vitest run test/unit/citation-manager-class.test.ts`

Expected: PASS — all 4 tests pass

### Step 5: Run full test suite

Run: `cd tools/citation-manager && npx vitest run`

Expected: 314/314 tests pass

### Step 6: Type check

Run: `cd tools/citation-manager && npx tsc --noEmit`

Expected: Zero new errors (or known errors from downstream — fix in this step)

### Step 7: Commit

Use `create-git-commit` skill to commit.

---

## Task 5 — Type citation-manager.ts public methods

### Files

- `tools/citation-manager/src/citation-manager.ts` (MODIFY — add types to public methods)

### Step 1: Write the failing test

```typescript
// tools/citation-manager/test/unit/citation-manager-methods.test.ts
import { describe, it, expect } from "vitest";
import { CitationManager } from "../../src/citation-manager.js";

describe("CitationManager public methods TypeScript", () => {
  it("validate returns string", async () => {
    const manager = new CitationManager();
    // Use a non-existent file to trigger error path (returns string)
    const result = await manager.validate("/nonexistent/file.md");
    expect(typeof result).toBe("string");
  });

  it("validate with json format returns JSON string", async () => {
    const manager = new CitationManager();
    const result = await manager.validate("/nonexistent/file.md", {
      format: "json",
    });
    expect(typeof result).toBe("string");
    const parsed = JSON.parse(result);
    expect(parsed.error).toBeDefined();
  });

  it("fix returns string", async () => {
    const manager = new CitationManager();
    const result = await manager.fix("/nonexistent/file.md");
    expect(typeof result).toBe("string");
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd tools/citation-manager && npx vitest run test/unit/citation-manager-methods.test.ts`

Expected: FAIL if types not yet applied (compile error), or PASS if Task 4 already typed them (in which case, skip to type check)

### Step 3: Write minimal implementation

Add type annotations to public methods in `tools/citation-manager/src/citation-manager.ts`:

```typescript
 async validate(
  filePath: string,
  options: CliValidateOptions = {},
 ): Promise<string> {
  // ... existing body unchanged, except:
  // - `result` gets cast: `const result = await this.validator.validateFile(filePath) as unknown as FormattedValidationResult;`
  // - Or assign validationTime after: `(result as FormattedValidationResult).validationTime = ...`
  // - catch block: `catch (error: unknown) { ... (error as Error).message }`
 }

 async fix(
  filePath: string,
  options: CliValidateOptions = {},
 ): Promise<string> {
  // ... existing body unchanged
  // - Type `fixes` array: `const fixes: FixDetail[] = [];`
  // - Type `fixType`: `let fixType: FixDetail["type"] | "" = "";`
  // - catch block: `catch (error: unknown)`
 }

 async extractLinks(
  sourceFile: string,
  options: CliExtractOptions,
 ): Promise<void> {
  // ... existing body unchanged
  // - catch block: `catch (error: unknown)`
 }

 async extractHeader(
  targetFile: string,
  headerName: string,
  options: CliExtractOptions,
 ): Promise<OutgoingLinksExtractedContent | undefined> {
  // ... existing body unchanged
  // - Type `validation` object explicitly
  // - catch block: `catch (error: unknown)`
 }

 async extractFile(
  targetFile: string,
  options: CliExtractOptions,
 ): Promise<OutgoingLinksExtractedContent | undefined> {
  // ... existing body unchanged
  // - catch block: `catch (error: unknown)`
 }
```

**Key typing patterns:**
- `validate()` returns `Promise<string>` (both success and error paths return strings)
- `fix()` returns `Promise<string>` (report text)
- `extractLinks()` returns `Promise<void>` (outputs to stdout, sets exitCode)
- `extractHeader()`/`extractFile()` return `Promise<OutgoingLinksExtractedContent | undefined>` (undefined on error paths with `return;`)
- All catch blocks: `catch (error: unknown)` with `(error as Error).message`

### Step 4: Run test to verify it passes

Run: `cd tools/citation-manager && npx vitest run test/unit/citation-manager-methods.test.ts`

Expected: PASS — all 3 tests pass

### Step 5: Run full test suite

Run: `cd tools/citation-manager && npx vitest run`

Expected: 314/314 tests pass

### Step 6: Type check

Run: `cd tools/citation-manager && npx tsc --noEmit`

Expected: Zero errors

### Step 7: Commit

Use `create-git-commit` skill to commit.

---

## Task 6 — Type Commander.js wiring and semanticSuggestionMap

### Files

- `tools/citation-manager/src/citation-manager.ts` (MODIFY — type Commander setup at bottom of file)

### Step 1: Write the failing test

```typescript
// tools/citation-manager/test/unit/citation-manager-cli-wiring.test.ts
import { describe, it, expect } from "vitest";

describe("citation-manager CLI wiring TypeScript", () => {
  it("imports without errors", async () => {
    // Dynamic import to test the module loads correctly
    const module = await import("../../src/citation-manager.js");
    expect(module.CitationManager).toBeDefined();
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd tools/citation-manager && npx vitest run test/unit/citation-manager-cli-wiring.test.ts`

Expected: FAIL if Commander types not yet applied

### Step 3: Write minimal implementation

Type the Commander.js wiring section at the bottom of `citation-manager.ts`:

```typescript
const semanticSuggestionMap: Record<string, string[]> = {
 check: ["validate"],
 verify: ["validate"],
 lint: ["validate"],
 parse: ["ast"],
 tree: ["ast"],
 debug: ["ast"],
 show: ["ast"],
 fix: ["--fix"],
 repair: ["--fix"],
 correct: ["--fix"],
 output: ["--format"],
 json: ["--format json"],
 range: ["--lines"],
 folder: ["--scope"],
 directory: ["--scope"],
 path: ["--scope"],
 dir: ["--scope"],
};

const program: Command = new Command();
```

For the `configureOutput` error handler:

```typescript
program.configureOutput({
 outputError: (str: string, write: (str: string) => void) => {
  const match = str.match(/unknown (?:command|option) '([^']+)'/);
  if (match) {
   const input = match[1].replace(/^--?/, "");
   const suggestions = semanticSuggestionMap[input];
   if (suggestions) {
    write(
     `Unknown ${match[0].includes("command") ? "command" : "option"} '${match[1]}'\n`,
    );
    write(`Did you mean: ${suggestions.join(", ")}?\n`);
    return;
   }
  }
  write(str);
 },
});
```

For action handlers — type the parameters:

```typescript
.action(async (file: string, options: CliValidateOptions) => {
 // ... body unchanged
})
```

```typescript
.action(async (file: string) => {
 // ... ast action body unchanged
})
```

```typescript
.action(async (sourceFile: string, options: CliExtractOptions) => {
 // ... extract links action body unchanged
})
```

```typescript
.action(async (targetFile: string, headerName: string, options: CliExtractOptions) => {
 // ... extract header action body unchanged
})
```

```typescript
.action(async (targetFile: string, options: CliExtractOptions) => {
 // ... extract file action body unchanged
})
```

For the CLI entry guard at the bottom — add `realpathSync` and `pathToFileURL` imports are already present, just ensure they work in TS context.

### Step 4: Run test to verify it passes

Run: `cd tools/citation-manager && npx vitest run test/unit/citation-manager-cli-wiring.test.ts`

Expected: PASS

### Step 5: Run full test suite

Run: `cd tools/citation-manager && npx vitest run`

Expected: 314/314 tests pass

### Step 6: Type check

Run: `cd tools/citation-manager && npx tsc --noEmit`

Expected: Zero errors

### Step 7: Commit

Use `create-git-commit` skill to commit.

---

## Task 7 — Final validation (8-checkpoint script + end-to-end)

### Files

- No files modified — validation only

### Step 1: Run 8-checkpoint validation script

Run: `cd tools/citation-manager && bash scripts/validate-typescript-migration.sh`

Expected: All 8 checkpoints pass

### Step 2: Verify test count

Run: `cd tools/citation-manager && npx vitest run`

Expected: **314/314 tests passing (100%)**

### Step 3: Verify zero compiler errors

Run: `cd tools/citation-manager && npx tsc --noEmit`

Expected: Zero errors

### Step 4: Verify no `any` escapes

Run: `grep -rn ': any' tools/citation-manager/src/ --include="*.ts" | grep -v node_modules`

Expected: No results (or only pre-existing ones from earlier epics)

### Step 5: Verify CLI end-to-end

Run: `cd tools/citation-manager && npm run build && node dist/citation-manager.js validate --help`

Expected: Help text displays correctly

Run: `cd tools/citation-manager && node dist/citation-manager.js validate test/fixtures/sample-with-citations.md 2>/dev/null || true`

Expected: Validation output (CLI format)

### Step 6: Verify shebang in dist output

Run: `head -1 tools/citation-manager/dist/citation-manager.js`

Expected: `#!/usr/bin/env node`

### Step 7: Verify design checklist

- [ ] **FR1**: `npm run citation:validate` outputs same tree structure
- [ ] **FR5**: CLI integration tests pass without modification
- [ ] **FR3**: `citation-manager.ts` imports `CliFlags` from `contentExtractorTypes.ts`

### Step 8: Commit final state

Use `create-git-commit` skill to commit any remaining changes.

---
