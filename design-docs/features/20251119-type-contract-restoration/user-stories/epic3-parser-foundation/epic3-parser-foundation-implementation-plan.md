# Epic 3: MarkdownParser TypeScript Migration - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert MarkdownParser.js (640 lines) to TypeScript while preserving all existing contracts and behavior

**Architecture:** Type existing JavaScript patterns without refactoring. Import Token types from @types/marked. Create interfaces matching actual runtime structures. Use shared types from types/citationTypes.ts.

**Tech Stack:** TypeScript 5.3+, marked.js with @types/marked, Node.js fs module

---

## Task 1 - Create ParserOutput Interface

### Files
- `tools/citation-manager/src/types/citationTypes.ts` (MODIFY lines 1-83)

### Step 1: Write failing TypeScript compilation test

No test file needed - TypeScript compiler will validate.

### Step 2: Add ParserOutput interface to citationTypes.ts

Add after line 83:

```typescript
/**
 * Anchor object representing a potential link target in a markdown document.
 * Created by MarkdownParser.extractAnchors().
 *
 * Uses discriminated union to enforce conditional properties:
 * - Header anchors ALWAYS have urlEncodedId (Obsidian-compatible format)
 * - Block anchors NEVER have urlEncodedId property
 */
export type AnchorObject =
  | {
      /** Anchor type classification */
      anchorType: 'header';

      /** Anchor identifier (raw heading text) */
      id: string;

      /** URL-encoded ID for Obsidian compatibility (always present for headers) */
      urlEncodedId: string;

      /** Original heading text */
      rawText: string;

      /** Full matched pattern from source */
      fullMatch: string;

      /** Source file line number (1-based) */
      line: number;

      /** Source file column number (1-based) */
      column: number;
    }
  | {
      /** Anchor type classification */
      anchorType: 'block';

      /** Anchor identifier (block ID like 'FR1' or '^my-anchor') */
      id: string;

      /** Always null for block anchors */
      rawText: null;

      /** Full matched pattern from source */
      fullMatch: string;

      /** Source file line number (1-based) */
      line: number;

      /** Source file column number (1-based) */
      column: number;
    };

/**
 * Heading object extracted from marked.js token structure.
 * Created by MarkdownParser.extractHeadings().
 */
export interface HeadingObject {
  /** Heading depth (1-6) */
  level: number;

  /** Heading text content */
  text: string;

  /** Raw markdown including # symbols */
  raw: string;
}

/**
 * Parser output contract from MarkdownParser.parseFile().
 * Contains complete structural representation of a markdown document.
 */
export interface ParserOutput {
  /** Absolute path of parsed file */
  filePath: string;

  /** Full raw content string */
  content: string;

  /** Tokenized markdown AST from marked.js */
  tokens: any[];  // Will be typed as Token[] after importing from @types/marked

  /** All outgoing links found in document */
  links: LinkObject[];

  /** All headings extracted from document structure */
  headings: HeadingObject[];

  /** All anchors (potential link targets) in document */
  anchors: AnchorObject[];
}
```

### Step 3: Run TypeScript compiler to verify

Run: `npx tsc --noEmit`
Expected: No errors from citationTypes.ts

### Step 4: Commit

Use `create-git-commit` skill to commit with message:

```text
feat(typescript-migration): [Epic3-Task1] add ParserOutput, AnchorObject, HeadingObject interfaces

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Task 2 - Import Token Type from @types/marked

### Files
- `tools/citation-manager/src/types/citationTypes.ts` (MODIFY lines 1-2)

### Step 1: Verify @types/marked is installed

Run: `npm list @types/marked`
Expected: Package listed with version

### Step 2: Add import and update ParserOutput

At top of file (line 1), add:

```typescript
import type { Token } from 'marked';
```

Then update ParserOutput interface `tokens` property:

```typescript
  /** Tokenized markdown AST from marked.js */
  tokens: Token[];
```

### Step 3: Run TypeScript compiler

Run: `npx tsc --noEmit`
Expected: No errors, Token type resolved

### Step 4: Commit

Use `create-git-commit` skill:

```text
feat(typescript-migration): [Epic3-Task2] import Token type from @types/marked

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Task 3 - Rename MarkdownParser.js → MarkdownParser.ts

### Files
- `tools/citation-manager/src/MarkdownParser.js` (RENAME to .ts)

### Step 1: Run tests before rename

Run: `npm test -- MarkdownParser`
Expected: Tests pass

### Step 2: Rename file

Run: `git mv tools/citation-manager/src/MarkdownParser.js tools/citation-manager/src/MarkdownParser.ts`
Expected: File renamed

### Step 3: Run tests after rename

Run: `npm test -- MarkdownParser`
Expected: Tests still pass (Vitest handles TypeScript)

### Step 4: Commit

Use `create-git-commit` skill:

```text
feat(typescript-migration): [Epic3-Task3] rename MarkdownParser.js to MarkdownParser.ts

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Task 4 - Add Constructor Type Annotations

### Files
- `tools/citation-manager/src/MarkdownParser.ts` (MODIFY lines 40-43)

### Step 1: Add FileSystem interface import

At top of file, add after existing imports:

```typescript
import type { readFileSync } from 'node:fs';
```

### Step 2: Define FileSystem interface inline

After imports, before class definition (around line 33):

```typescript
/**
 * File system interface for dependency injection.
 * Matches Node.js fs module subset used by MarkdownParser.
 */
interface FileSystemInterface {
  readFileSync: typeof readFileSync;
}
```

### Step 3: Update constructor with types

Replace constructor (lines 40-43):

```typescript
  private fs: FileSystemInterface;
  private currentSourcePath: string | null;

  /**
   * Initialize parser with file system dependency
   *
   * @param fileSystem - Node.js fs module (or mock for testing)
   */
  constructor(fileSystem: FileSystemInterface) {
    this.fs = fileSystem;
    this.currentSourcePath = null;
  }
```

### Step 4: Run TypeScript compiler

Run: `npx tsc --noEmit`
Expected: No errors

### Step 5: Run tests

Run: `npm test -- MarkdownParser`
Expected: All tests pass

### Step 6: Commit

Use `create-git-commit` skill:

```text
feat(typescript-migration): [Epic3-Task4] add FileSystem interface and constructor type annotations

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Task 5 - Add parseFile Return Type

### Files
- `tools/citation-manager/src/MarkdownParser.ts` (MODIFY lines 1-2, 55)
- `tools/citation-manager/src/types/citationTypes.ts` (already has ParserOutput)

### Step 1: Import ParserOutput type

At top of MarkdownParser.ts, add:

```typescript
import type { ParserOutput } from './types/citationTypes.js';
```

### Step 2: Add explicit return type to parseFile

Update method signature (line 55):

```typescript
  async parseFile(filePath: string): Promise<ParserOutput> {
```

### Step 3: Run TypeScript compiler

Run: `npx tsc --noEmit`
Expected: No errors, return type matches implementation

### Step 4: Run tests

Run: `npm test -- MarkdownParser`
Expected: All tests pass

### Step 5: Commit

Use `create-git-commit` skill:

```text
feat(typescript-migration): [Epic3-Task5] add ParserOutput return type to parseFile method

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Task 6 - Add extractLinks Return Type

### Files
- `tools/citation-manager/src/MarkdownParser.ts` (MODIFY line 1, line 88)

### Step 1: Import LinkObject type

Update import at top of file:

```typescript
import type { LinkObject, ParserOutput } from './types/citationTypes.js';
```

### Step 2: Add return type to extractLinks

Update method signature (line 88):

```typescript
  extractLinks(content: string): LinkObject[] {
```

### Step 3: Run TypeScript compiler

Run: `npx tsc --noEmit`
Expected: Possible errors about property mismatches - we'll fix in Task 12

### Step 4: Run tests

Run: `npm test -- MarkdownParser`
Expected: Tests pass (runtime behavior unchanged)

### Step 5: Commit

Use `create-git-commit` skill:

```text
feat(typescript-migration): [Epic3-Task6] add LinkObject return type to extractLinks method

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Task 7 - Add extractAnchors Return Type

### Files
- `tools/citation-manager/src/MarkdownParser.ts` (MODIFY line 1, find extractAnchors method)

### Step 1: Import AnchorObject type

Update import at top of file:

```typescript
import type { AnchorObject, LinkObject, ParserOutput } from './types/citationTypes.js';
```

### Step 2: Add return type to extractAnchors

Find extractAnchors method definition (around line 345) and update signature:

```typescript
  extractAnchors(content: string): AnchorObject[] {
```

### Step 3: Run TypeScript compiler

Run: `npx tsc --noEmit`
Expected: Possible errors - will fix in Task 12

### Step 4: Run tests

Run: `npm test -- MarkdownParser`
Expected: Tests pass

### Step 5: Commit

Use `create-git-commit` skill:

```text
feat(typescript-migration): [Epic3-Task7] add AnchorObject return type to extractAnchors method

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Task 8 - Add extractHeadings Return Type

### Files
- `tools/citation-manager/src/MarkdownParser.ts` (MODIFY line 1, find extractHeadings method)

### Step 1: Import HeadingObject and Token types

Update import at top of file:

```typescript
import type { AnchorObject, HeadingObject, LinkObject, ParserOutput } from './types/citationTypes.js';
import type { Token } from 'marked';
```

### Step 2: Add return type to extractHeadings

Find extractHeadings method (around line 478) and update signature:

```typescript
  extractHeadings(tokens: Token[]): HeadingObject[] {
```

### Step 3: Run TypeScript compiler

Run: `npx tsc --noEmit`
Expected: Possible errors - will fix in Task 12

### Step 4: Run tests

Run: `npm test -- MarkdownParser`
Expected: Tests pass

### Step 5: Commit

Use `create-git-commit` skill:

```text
feat(typescript-migration): [Epic3-Task8] add HeadingObject return type to extractHeadings method

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Task 9 - Add Helper Method Type Annotations

### Files
- `tools/citation-manager/src/MarkdownParser.ts` (MODIFY lines for helper methods)

### Step 1: Type _detectExtractionMarker method

Find method (line 422) and update signature:

```typescript
  _detectExtractionMarker(line: string, linkEndColumn: number): { fullMatch: string; innerText: string } | null {
```

### Step 2: Type determineAnchorType method

Find method (line 441) and update signature:

```typescript
  determineAnchorType(anchorString: string): 'header' | 'block' {
```

### Step 3: Type resolvePath method

Find method (line 457) and update signature:

```typescript
  resolvePath(rawPath: string, sourceAbsolutePath: string): string | null {
```

### Step 4: Type containsMarkdown method

Find method (line 618) and update signature:

```typescript
  containsMarkdown(text: string): boolean {
```

### Step 5: Type toKebabCase method

Find method (line 632) and update signature:

```typescript
  toKebabCase(text: string): string {
```

### Step 6: Run TypeScript compiler

Run: `npx tsc --noEmit`
Expected: Errors may exist - will fix in Task 12

### Step 7: Run tests

Run: `npm test -- MarkdownParser`
Expected: Tests pass

### Step 8: Commit

Use `create-git-commit` skill:

```text
feat(typescript-migration): [Epic3-Task9] add type annotations to helper methods

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Task 10 - Run Validation Script

### Files
- `tools/citation-manager/scripts/validate-typescript-migration.sh` (READ/EXECUTE)

### Step 1: Check if validation script exists

Run: `ls -la tools/citation-manager/scripts/validate-typescript-migration.sh`
Expected: Script exists from Epic 1

If missing, check Epic 1 documentation for script location.

### Step 2: Run validation script

Run: `./tools/citation-manager/scripts/validate-typescript-migration.sh`
Expected: Some checkpoints may fail - document which ones

### Step 3: Document validation results

Create file: `tools/citation-manager/design-docs/features/20251119-type-contract-restoration/epic3/tasks/task-10-validation-results.md`

```markdown
# Task 10 - Validation Results (Before Fixes)

**Date**: [current date]
**Status**: Expected failures documented

## Checkpoint Results

### Checkpoints 1-4: Type Safety
- [ ] Checkpoint 1: tsc --noEmit (zero errors)
- [ ] Checkpoint 2: No `any` escapes
- [ ] Checkpoint 3: Explicit return types
- [ ] Checkpoint 4: Strict null checks

**Errors Found**: [list errors]

### Checkpoint 5: Tests Pass
- [ ] 314/314 tests passing

**Result**: [pass/fail with count]

### Checkpoint 6: JS Consumers
- [ ] Backward compatibility

**Result**: [pass/fail]

### Checkpoint 7: Build Output
- [ ] .js + .d.ts + source maps generated

**Result**: [pass/fail]

### Checkpoint 8: Type Organization
- [ ] No duplicate type definitions
- [ ] Types imported from shared libraries

**Result**: [pass/fail]

## Next Steps

Proceed to Task 11 to fix identified type errors.
```

### Step 4: No commit (documentation only)

---

## Task 11 - Fix Type Errors

### Files
- `tools/citation-manager/src/MarkdownParser.ts` (MODIFY as needed based on errors)

### Step 1: Read validation results

Read: `tools/citation-manager/design-docs/features/20251119-type-contract-restoration/epic3/tasks/task-10-validation-results.md`

### Step 2: Fix each type error systematically

**Common fixes expected**:

1. **LinkObject property mismatch**: Current code may have properties not in interface
   - Check actual link object construction vs LinkObject interface
   - Add missing properties to interface OR remove from implementation (preserve behavior)

2. **AnchorObject urlEncodedId optional**: Header anchors need urlEncodedId, blocks don't
   - Ensure header anchor objects include urlEncodedId
   - Ensure block anchor objects omit or set to undefined

3. **Null safety**: Variables may need explicit null checks
   - Add `!` non-null assertions where safe (after has() checks)
   - Add `?? null` for optional values

4. **extractionMarker typing**: May need optional property
   - Ensure extractionMarker is properly typed as optional

### Step 3: Run TypeScript compiler after each fix

Run: `npx tsc --noEmit`
Expected: Errors decrease with each fix

### Step 4: Run tests after all fixes

Run: `npm test`
Expected: 314/314 tests pass

### Step 5: Commit

Use `create-git-commit` skill:

```text
fix(typescript-migration): [Epic3-Task11] resolve type errors in MarkdownParser

Fixes:
- [describe each fix]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Task 12 - Verify All Tests Pass

### Files
- No file changes, verification only

### Step 1: Run full test suite

Run: `npm test`
Expected: 314/314 tests passing (100%)

### Step 2: Run MarkdownParser-specific tests

Run: `npm test -- MarkdownParser`
Expected: All parser tests pass

### Step 3: Run parser output contract tests

Run: `npm test -- parser-output-contract`
Expected: All contract validation tests pass

### Step 4: Document test results

Create file: `tools/citation-manager/design-docs/features/20251119-type-contract-restoration/epic3/tasks/task-12-test-results.md`

```markdown
# Task 12 - Test Verification Results

**Date**: [current date]
**Status**: All tests passing

## Test Results

### Full Test Suite
- **Command**: `npm test`
- **Result**: 314/314 tests passing (100%)
- **Duration**: [duration]

### MarkdownParser Tests
- **Command**: `npm test -- MarkdownParser`
- **Result**: [count] tests passing
- **Coverage**: [if available]

### Parser Output Contract Tests
- **Command**: `npm test -- parser-output-contract`
- **Result**: [count] tests passing

## Validation

✅ All tests pass
✅ No regressions introduced
✅ Contract compliance validated

## Next Steps

Proceed to Task 13 for final commit.
```

### Step 5: No commit (verification only)

---

## Task 13 - Commit TypeScript Migration

### Files
- All modified files from Epic 3

### Step 1: Review all changes

Run: `git status`
Expected: Modified files listed

Run: `git diff --stat`
Expected: Summary of changes

### Step 2: Run final validation script

Run: `./tools/citation-manager/scripts/validate-typescript-migration.sh`
Expected: All 8 checkpoints pass

### Step 3: Verify no duplicate types

Run: `grep -r "^interface LinkObject\|^type LinkObject\|^interface AnchorObject\|^type AnchorObject" tools/citation-manager/src/ --exclude-dir=types`
Expected: No matches (all types in types/ directory)

### Step 4: Verify type imports

Run: `grep "import.*from.*types/citationTypes" tools/citation-manager/src/MarkdownParser.ts`
Expected: Import statement found

### Step 5: Stage all changes

Run: `git add tools/citation-manager/src/MarkdownParser.ts tools/citation-manager/src/types/citationTypes.ts`

### Step 6: Commit with comprehensive message

Use `create-git-commit` skill:

```text
feat(typescript-migration): [Epic3] complete MarkdownParser TypeScript migration

Migrated MarkdownParser (640 lines) from JavaScript to TypeScript while
preserving all existing contracts and behavior.

Changes:
- Added ParserOutput, AnchorObject, HeadingObject interfaces to citationTypes.ts
- Imported Token type from @types/marked for token array typing
- Renamed MarkdownParser.js → MarkdownParser.ts
- Added FileSystem interface for constructor dependency injection
- Added explicit return types to all public and private methods
- Typed all helper methods with precise signatures
- Fixed type errors while preserving exact runtime behavior

Validation:
- ✅ All 8 checkpoints pass (type safety, tests, build, organization)
- ✅ 314/314 tests passing (100%)
- ✅ Zero compiler errors
- ✅ No duplicate type definitions
- ✅ All types imported from shared libraries
- ✅ Contract preservation validated

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Step 7: Verify commit

Run: `git log -1 --stat`
Expected: Commit shows all modified files

### Step 8: Run post-commit validation

Run: `npm test`
Expected: 314/314 tests pass

---

## Epic 3 Complete

**Deliverables**:
- ✅ MarkdownParser.ts with full TypeScript typing
- ✅ ParserOutput, AnchorObject, HeadingObject interfaces
- ✅ Token types from @types/marked
- ✅ 8 checkpoints passing
- ✅ 314/314 tests maintained
- ✅ Zero architecture changes

**Next**: Epic 4 - Parser Facade & Cache (ParsedDocument, ParsedFileCache)
