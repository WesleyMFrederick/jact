# Epic 5: Validation Layer - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal**: Convert CitationValidator (~883 lines) from JavaScript to TypeScript while preserving the enrichment pattern and all validation contracts.

**Architecture**: Type existing enrichment pattern (in-place validation property addition), use discriminated unions for ValidationMetadata, maintain { summary, links } return structure.

**Tech Stack**: TypeScript, existing shared type libraries (citationTypes.ts, validationTypes.ts)

**References**:
- [typescript-migration-sequencing](../../typescript-migration-sequencing.md) %% force-extract %%

---

## Task 5.1: Pre-conversion preparation

**Status**: ✅ Complete

### Files
- [`user-stories/epic5-validation-layer/task-5.1-pre-conversion-preparation.md`](task-5.1-pre-conversion-preparation.md) %% force-extract %% (ALREADY CREATED)

**Summary**: Context gathered - 313 passing tests baseline, enrichment pattern identified, downstream consumers verified.

---

## Task 5.1.5: Review test assertions

**Status**: 🔲 Pending

**Addresses**: Gap 10 - Missing test assertion review

### Files
- N/A (grep only)

### Step 1: Search for ValidationResult usage in tests

**Command**:

```bash
cd /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows
grep -rn "validationResult\." tools/citation-manager/test/ --include="*.test.js"
```

**Expected Output**:

```text
test/integration/citation-validator.test.js:45:  expect(validationResult.summary).toBeDefined();
test/integration/citation-validator.test.js:46:  expect(validationResult.links).toBeArray();
test/integration/citation-validator-enrichment.test.js:23:  const links = validationResult.links;
```

**Verification**:
- ✅ Tests access `.summary` property (NOT `.stats` or flat structure)
- ✅ Tests access `.links` property (NOT `.results` or wrapper objects)

### Step 2: Search for enrichment pattern usage in tests

**Command**:

```bash
grep -rn "link\.validation" tools/citation-manager/test/ --include="*.test.js"
```

**Expected Output**:

```text
test/integration/citation-validator-enrichment.test.js:34:  expect(link.validation.status).toBe('valid');
test/integration/citation-validator.test.js:67:  if (link.validation.status === 'error') {
test/integration/cli-validation.test.js:89:  filteredLinks.filter(l => l.validation.status === 'valid')
```

**Verification**:
- ✅ Tests expect `link.validation.status` property (enrichment pattern)
- ✅ Tests check for 'valid', 'error', 'warning' status values
- ✅ No tests expect wrapper objects like `{ link, status }` structure

### Step 3: Verify no Epic 4.4 wrapper object expectations

**Command**:

```bash
grep -rn "CitationValidationResult\|FileValidationSummary" tools/citation-manager/test/ --include="*.test.js"
```

**Expected Output**:

```text
(no matches)
```

**Verification**:
- ✅ Zero test files reference Epic 4.4 failed types
- ✅ Confirms tests expect correct enrichment pattern

---

## Task 5.2: Create TypeScript interface definitions

**Status**: 🔲 Pending

**Addresses**:
- Gap 1 - Wrong types in validationTypes.ts
- Gap 2 - Wrong ValidationMetadata in citationTypes.ts
- Gap 7 - Missing PathConversion type

### Files
- `tools/citation-manager/src/types/validationTypes.ts` (OVERWRITE)
- `tools/citation-manager/src/types/citationTypes.ts` (MODIFY - lines 86-100)

### Step 1: Read current validationTypes.ts to confirm Epic 4.4 failures

**Command**:

```bash
cat tools/citation-manager/src/types/validationTypes.ts
```

**Expected Content** (Epic 4.4 failed types):

```typescript
export interface FileValidationSummary {
  results: CitationValidationResult[];
  totalCitations: number;
  // ... wrong structure
}
```

**Verification**:
- ✅ Confirms file contains Epic 4.4 wrapper objects
- ✅ Ready to DELETE and replace

### Step 2: OVERWRITE validationTypes.ts with correct types

**Action**: Replace entire file content

**File**: `tools/citation-manager/src/types/validationTypes.ts`

**Complete Code**:

```typescript
/**
 * ValidationTypes - CitationValidator output contracts
 *
 * CRITICAL: These types match the enrichment pattern where LinkObjects
 * get a `validation` property added in-place. DO NOT create wrapper objects.
 *
 * Reference: CitationValidator Component Guide - Output Contract
 */

import type { LinkObject } from './citationTypes.js';

/**
 * PathConversion metadata for path auto-fix suggestions
 * Used when validator detects path resolution issues
 */
export interface PathConversion {
  type: "path-conversion";
  original: string;
  recommended: string;
}

/**
 * ValidationMetadata - Discriminated union based on status
 *
 * Valid state: No additional fields
 * Error/Warning states: Include error message, optional suggestion, optional path conversion
 */
export type ValidationMetadata =
  | { status: "valid" }
  | {
      status: "error";
      error: string;
      suggestion?: string;
      pathConversion?: PathConversion;
    }
  | {
      status: "warning";
      error: string;
      suggestion?: string;
      pathConversion?: PathConversion;
    };

/**
 * EnrichedLinkObject - LinkObject with validation property added in-place
 *
 * ENRICHMENT PATTERN: CitationValidator adds `validation` property to
 * existing LinkObjects from parser. No wrapper objects created.
 */
export interface EnrichedLinkObject extends LinkObject {
  validation: ValidationMetadata;
}

/**
 * ValidationSummary - Aggregate counts derived from enriched links
 */
export interface ValidationSummary {
  total: number;
  valid: number;
  warnings: number;
  errors: number;
}

/**
 * ValidationResult - CitationValidator.validateFile() return structure
 *
 * CRITICAL: Property names are `summary` and `links` (NOT `results`)
 * This matches the enrichment pattern where links are enriched in-place.
 */
export interface ValidationResult {
  summary: ValidationSummary;
  links: EnrichedLinkObject[];
}
```

**Verification**:
- ✅ File uses discriminated unions (no `as any` needed)
- ✅ PathConversion explicitly typed (not `object`)
- ✅ EnrichedLinkObject extends LinkObject (enrichment pattern)
- ✅ ValidationResult has `{ summary, links }` structure

### Step 3: Read current citationTypes.ts to locate wrong ValidationMetadata

**Command**:

```bash
sed -n '86,100p' tools/citation-manager/src/types/citationTypes.ts
```

**Expected Output** (wrong ValidationMetadata):

```typescript
export interface ValidationMetadata {
  fileExists: boolean;        // NOT IN CONTRACT
  anchorExists: boolean | null; // NOT IN CONTRACT
  suggestions?: string[];      // Should be "suggestion" (singular)
}
```

**Verification**:
- ✅ Confirms wrong ValidationMetadata exists
- ✅ Ready to DELETE and import from validationTypes.ts

### Step 4: DELETE wrong ValidationMetadata from citationTypes.ts

**Action**: Remove lines 86-100 (entire ValidationMetadata interface)

**File**: `tools/citation-manager/src/types/citationTypes.ts`

**Operation**: DELETE these lines

```typescript
export interface ValidationMetadata {
  fileExists: boolean;
  anchorExists: boolean | null;
  suggestions?: string[];
}
```

**Verification**:

```bash
grep "interface ValidationMetadata" tools/citation-manager/src/types/citationTypes.ts
```

**Expected**: (no matches)

### Step 5: ADD import for ValidationMetadata in citationTypes.ts

**Action**: Add import at top of file (after existing imports)

**File**: `tools/citation-manager/src/types/citationTypes.ts` (top of file)

**Code to ADD**:

```typescript
import type { ValidationMetadata } from './validationTypes.js';
```

**Verification**:
- ✅ Import uses type-only import (`import type`)
- ✅ Uses `.js` extension (ESM requirement)
- ✅ ValidationMetadata now imported, not duplicated

### Step 6: Verify TypeScript compiles with new types

**Command**:

```bash
cd /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows
npx tsc --noEmit
```

**Expected Output**:

```text
(compilation errors from unconverted JS files - this is expected)
```

**Verification**:
- ✅ No errors in validationTypes.ts itself
- ✅ No circular dependency errors
- ✅ citationTypes.ts imports ValidationMetadata successfully

### Step 7: Verify no duplicate type definitions (Checkpoint 8a)

**Command**:

```bash
grep -r "^interface ValidationMetadata\|^type ValidationMetadata" tools/citation-manager/src/ --exclude-dir=types
```

**Expected Output**:

```text
(no matches)
```

**Verification**:
- ✅ ValidationMetadata only in types/ directory
- ✅ Single source of truth established
- ✅ Checkpoint 8a passes for ValidationMetadata

### Step 8: Commit type definitions

Use `create-git-commit` skill to commit changes addressing Gaps 1, 2, 7.

**Files to commit**:
- `tools/citation-manager/src/types/validationTypes.ts`
- `tools/citation-manager/src/types/citationTypes.ts`

---

## Task 5.3: Convert CitationValidator.js to CitationValidator.ts

**Status**: 🔲 Pending

**Addresses**:
- Gap 3 - Missing dependency interfaces
- Gap 4 - validateSingleCitation return type mismatch
- Gap 8 - Missing helper method types
- Gap 9 - JSDoc removal

### Files
- `tools/citation-manager/src/CitationValidator.js` → `CitationValidator.ts` (RENAME & MODIFY)

### Step 1: Rename file

**Command**:

```bash
cd /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager
git mv src/CitationValidator.js src/CitationValidator.ts
```

**Verification**:

```bash
ls -la src/CitationValidator.ts
```

**Expected**: File renamed, tracked by git

### Step 2: Delete JSDoc typedefs (lines 4-48)

**Action**: Remove JSDoc type definitions (now replaced by TypeScript)

**File**: `src/CitationValidator.ts`

**Lines to DELETE**: 4-48 (all `@typedef` blocks)

```javascript
/**
 * @typedef {Object} ValidValidation
 * ...
 * @typedef {ValidValidation|ErrorValidation|WarningValidation} ValidationMetadata
 */
```

**Verification**:

```bash
grep "@typedef" src/CitationValidator.ts
```

**Expected**: (no matches)

### Step 3: Add TypeScript imports and inline interfaces

**Action**: Add imports and define dependency interfaces

**File**: `src/CitationValidator.ts` (top of file, after JSDoc removal)

**Complete Code**:

```typescript
import path from 'node:path';
import fs from 'node:fs';
import type { LinkObject, ValidationResult, ValidationMetadata, PathConversion } from './types/validationTypes.js';
import type { ParsedDocument } from './ParsedDocument.js';

// Dependency Injection Interfaces (inline pattern per MarkdownParser.ts)
interface ParsedFileCacheInterface {
  resolveParsedFile(filePath: string): Promise<ParsedDocument>;
}

interface FileCacheInterface {
  resolveFile(filename: string): { found: boolean; path: string | null };
}

// SingleCitationValidationResult - what validateSingleCitation actually returns
interface SingleCitationValidationResult {
  line: number;
  citation: string;
  status: 'valid' | 'error' | 'warning';
  linkType: string;
  scope: string;
  error?: string;
  suggestion?: string;
  pathConversion?: PathConversion;
}
```

**Verification**:
- ✅ Imports from validationTypes.ts (shared types)
- ✅ Inline interfaces for dependencies (Gap 3)
- ✅ SingleCitationValidationResult defined (Gap 4)

### Step 4: Type class properties and constructor

**Action**: Add TypeScript types to class structure

**File**: `src/CitationValidator.ts` (class definition)

**Complete Code**:

```typescript
export class CitationValidator {
  private parsedFileCache: ParsedFileCacheInterface;
  private fileCache: FileCacheInterface;
  private patterns: {
    CARET_SYNTAX: { regex: RegExp; examples: string[]; description: string };
    EMPHASIS_MARKED: { regex: RegExp; examples: string[]; description: string };
    CROSS_DOCUMENT: { regex: RegExp; description: string };
  };

  constructor(
    parsedFileCache: ParsedFileCacheInterface,
    fileCache: FileCacheInterface
  ) {
    this.parsedFileCache = parsedFileCache;
    this.fileCache = fileCache;

    // Pattern registry (existing code stays unchanged)
    this.patterns = { /* ... existing implementation ... */ };
  }
}
```

**Verification**:
- ✅ `private` modifier on dependency fields
- ✅ Constructor params typed with interfaces
- ✅ `patterns` structure explicitly typed

### Step 5: Type public methods

**Action**: Add return types to public API methods

**File**: `src/CitationValidator.ts`

**Complete Code**:

```typescript
async validateFile(filePath: string): Promise<ValidationResult> {
  // Existing implementation unchanged
}

async validateSingleCitation(
  citation: LinkObject,
  contextFile?: string
): Promise<SingleCitationValidationResult> {
  // Existing implementation unchanged
  // Returns the validation result object, NOT EnrichedLinkObject
}
```

**Verification**:
- ✅ `validateFile` returns `ValidationResult`
- ✅ `validateSingleCitation` returns `SingleCitationValidationResult` (Gap 4 fix)

### Step 6: Type private helper methods

**Action**: Add explicit types to all helper methods (Gap 8)

**File**: `src/CitationValidator.ts`

**Complete Code**:

```typescript
// Pattern classification
private classifyPattern(citation: LinkObject): string {
  // Existing implementation
}

// Pattern-specific validators
private validateCaretPattern(citation: LinkObject): SingleCitationValidationResult {
  // Existing implementation
}

private validateEmphasisPattern(citation: LinkObject): SingleCitationValidationResult {
  // Existing implementation
}

private async validateCrossDocumentLink(
  citation: LinkObject,
  contextFile?: string
): Promise<SingleCitationValidationResult> {
  // Existing implementation
}

private validateWikiStyleLink(citation: LinkObject): SingleCitationValidationResult {
  // Existing implementation
}

// Path resolution helpers
private resolveTargetPath(relativePath: string, sourceFile: string): string {
  // Existing implementation
}

private safeRealpathSync(path: string): string {
  // Existing implementation
}

private isFile(path: string): boolean {
  // Existing implementation
}

private isObsidianAbsolutePath(path: string): boolean {
  // Existing implementation
}

private convertObsidianToFilesystemPath(obsidianPath: string, sourceFile: string): string | null {
  // Existing implementation
}

private generatePathResolutionDebugInfo(relativePath: string, sourceFile: string): string {
  // Existing implementation
}

// Anchor validation helpers
private async validateAnchorExists(
  targetFile: string,
  anchorId: string | null,
  citation: LinkObject
): Promise<SingleCitationValidationResult> {
  // Existing implementation
}

// Result construction helper
private createValidationResult(
  citation: LinkObject,
  status: 'valid' | 'error' | 'warning',
  error?: string,
  suggestion?: string,
  pathConversion?: PathConversion
): SingleCitationValidationResult {
  // Existing implementation
}
```

**Verification**:
- ✅ All helper methods explicitly typed
- ✅ `private` modifier on all helpers
- ✅ Return types match actual implementation

### Step 7: Verify TypeScript compilation

**Command**:

```bash
cd /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows
npx tsc --noEmit
```

**Expected Output**:

```text
(Type errors in method bodies - to be fixed in Task 5.5)
```

**Verification**:
- ✅ No errors in class structure itself
- ✅ No import errors
- ✅ Interface definitions valid
- ✅ Method signatures compile

### Step 8: Commit class structure conversion

Use `create-git-commit` skill to commit Task 5.3 completion.

**Files to commit**:
- `src/CitationValidator.ts` (renamed and typed structure)

---

## Task 5.4: Type the enrichment pattern implementation

**Addresses**: Gap 6 (safe discriminated unions), Gap 1 (correct return structure)

### Task 5.4.1: Read current validateFile implementation

**Files**: `src/CitationValidator.ts` (READ - lines 162-214)

**Step 1**: Read baseline JavaScript implementation

```bash
sed -n '162,214p' src/CitationValidator.js
```

**Verification**:
- ✅ Line 179-193: validation object built conditionally
- ✅ Line 196: `link.validation = validation` (in-place enrichment)
- ✅ Line 201-207: summary generated from enriched links
- ✅ Line 210-213: returns `{ summary, links }`

**Step 2**: Identify Gap 6 pattern - incremental object building defeats TypeScript discriminated unions

---

### Task 5.4.2: Implement safe discriminated union construction

**Files**: `src/CitationValidator.ts` (MODIFY - lines 179-193)

**Step 1**: Replace incremental construction with branching

```typescript
// Build discriminated union based on status
let validation: ValidationMetadata;

if (result.status === 'valid') {
 // Valid variant: only status field
 validation = { status: 'valid' };
} else {
 // Error/Warning variant: status + error + optional fields
 validation = {
  status: result.status as 'error' | 'warning',
  error: result.error!,  // Non-null assertion safe (status !== 'valid')
  ...(result.suggestion && { suggestion: result.suggestion }),
  ...(result.pathConversion && { pathConversion: result.pathConversion }),
 };
}
```

**Step 2**: Verify TypeScript compilation - `npx tsc --noEmit`

**Verification**:
- ✅ No "Type 'any' is not assignable" errors
- ✅ Discriminated union compiles correctly

---

### Task 5.4.3: Type the enrichment operation

**Files**: `src/CitationValidator.ts` (MODIFY - line 196)

**Step 1**: Add type assertion for enrichment

```typescript
// ENRICHMENT: Add validation property in-place
(link as EnrichedLinkObject).validation = validation;
```

**Step 2**: Verify enrichment pattern preserved

```bash
sed -n '174,198p' src/CitationValidator.ts | grep -E "new |return \{"
# Expected: No matches (enrichment mutates, doesn't construct)
```

---

### Task 5.4.4: Type summary generation

**Files**: `src/CitationValidator.ts` (MODIFY - lines 201-207)

**Step 1**: Add explicit type to summary variable

```typescript
const summary: ValidationSummary = {
 total: links.length,
 valid: links.filter((link) => (link as EnrichedLinkObject).validation.status === "valid").length,
 warnings: links.filter((link) => (link as EnrichedLinkObject).validation.status === "warning").length,
 errors: links.filter((link) => (link as EnrichedLinkObject).validation.status === "error").length,
};
```

**Step 2**: Verify structure matches contract

```bash
grep -A 5 "interface ValidationSummary" src/types/validationTypes.ts
```

---

### Task 5.4.5: Type return statement

**Files**: `src/CitationValidator.ts` (MODIFY - lines 210-213)

**Step 1**: Cast links array and verify return structure

```typescript
return {
 summary,
 links: links as EnrichedLinkObject[],  // Cast to enriched type
};
```

**Step 2**: Verify return type matches `Promise<ValidationResult>`

```bash
grep -B 2 "async validateFile" src/CitationValidator.ts | head -3
```

---

### Task 5.4.6: Verify TypeScript compilation

**Step 1**: Run TypeScript compiler

```bash
npx tsc --noEmit
```

**Step 2**: Verify no `as any` escapes

```bash
grep "as any" src/CitationValidator.ts
# Expected: (no matches)
```

**Verification**:
- ✅ Zero `as any` casts in entire file
- ✅ Gap 6 resolved (safe discriminated union construction)

---

### Task 5.4.7: Verify enrichment pattern contract

**Step 1**: Verify return structure matches downstream consumers

```bash
grep -n "validationResult.links" src/citation-manager.js src/core/ContentExtractor/*.js
```

**Verification**:
- ✅ Downstream consumers access `.links` property (NOT `.results`)
- ✅ Gap 1 resolved (correct return structure enforced)

**Step 2**: Verify enrichment property exists on links

```bash
grep -n "link.validation.status" src/citation-manager.js src/core/ContentExtractor/*.js
```

---

### Task 5.4.8: Commit Task 5.4 completion

Use `create-git-commit` skill to commit Task 5.4 completion.

**Files to commit**: `src/CitationValidator.ts` (validateFile method with safe discriminated unions)

**Commit message**:
- Subject: "feat(epic5): type validateFile enrichment pattern (Task 5.4)"
- Body: Implements safe discriminated union construction (fixes Gap 6), enforces `{ summary, links }` return structure (fixes Gap 1), preserves in-place enrichment pattern, zero `as any` casts

**Verification**: Commit created successfully, only CitationValidator.ts changed

---

## Task 5.5: Fix type errors and add necessary coercions

**Status**: 🔲 Pending

**Addresses**: Gap 8 (Regex Mismatch), Gap 3 (Null Safety)

**Goal**: Resolve remaining TypeScript compilation errors by adding null coercions and type assertions without changing runtime behavior.

---

### Task 5.5.1: Identify remaining TypeScript errors

**Files**: `src/CitationValidator.ts` (READ - compiler output)

**Step 1**: Run TypeScript compiler to identify errors

```bash
npx tsc --noEmit 2>&1 | grep "CitationValidator.ts"
```

**Expected**: Errors in specific line numbers (TS2532, TS2322, TS7006)

**Verification**:
- ✅ Errors identified and categorized
- ✅ Error types documented (regex undefined, Promise typing, optional access)

**Step 2**: Document error categories for systematic fixes

---

### Task 5.5.2: Fix regex capture group coercions (Gap 8)

**Files**: `src/CitationValidator.ts` (MODIFY - line ~836)

**Step 1**: Fix anchorMatch capture group in generatePathConversionSuggestion

**Current Code** (line 835-836):

```typescript
const anchorMatch = originalCitation.match(/#(.*)$/);
const anchor = anchorMatch ? `#${anchorMatch[1]}` : "";
```

**Issue**: `anchorMatch[1]` is `string | undefined` but contract expects `string`

**Fixed Code**:

```typescript
const anchorMatch = originalCitation.match(/#(.*)$/);
const anchor = (anchorMatch && anchorMatch[1]) ? `#${anchorMatch[1]}` : "";
```

**Why**: Safe null check prevents `undefined` in template literal, matches runtime behavior

**Step 2**: Search for other regex patterns

```bash
grep -n "match\[" src/CitationValidator.ts
grep -n "\.exec(" src/CitationValidator.ts
```

**Expected**: Only one regex capture usage (line 836, fixed in Step 1)

**Step 3**: Verify TypeScript compilation

```bash
npx tsc --noEmit 2>&1 | grep "836"
```

**Expected**: No errors on line 836

**Verification**:
- ✅ Regex capture coercion complete
- ✅ Line 836 compiles without errors

---

### Task 5.5.3: Fix Promise generic types

**Files**: `src/CitationValidator.ts` (MODIFY - line ~174)

**Step 1**: Fix Promise.all implicit any error in validateFile

**Current Code** (line 174-198):

```typescript
await Promise.all(
  links.map(async (link) => {
    const result = await this.validateSingleCitation(link, filePath);
    // ... enrichment logic
    link.validation = validation;
  }),
);
```

**Issue**: TypeScript can't infer return type, reports implicit `any`

**Fixed Code**:

```typescript
await Promise.all<void>(
  links.map(async (link): Promise<void> => {
    const result = await this.validateSingleCitation(link, filePath);
    // ... enrichment logic
    link.validation = validation;
  }),
);
```

**Why**: Explicit `Promise<void>` return type documents side-effect operation

**Step 2**: Verify TypeScript compilation

```bash
npx tsc --noEmit 2>&1 | grep "174\|TS7006"
```

**Expected**: No implicit any errors

**Verification**:
- ✅ Promise typing complete
- ✅ No implicit any errors

---

### Task 5.5.4: Fix optional property access (if needed)

**Files**: `src/CitationValidator.ts` (MODIFY - various locations)

**Step 1**: Check for TS2532 errors (possibly undefined)

```bash
npx tsc --noEmit 2>&1 | grep "TS2532" | grep "CitationValidator.ts"
```

**Expected**: Possibly no errors (baseline already uses optional chaining)

**Step 2**: Fix any remaining optional property access errors (if needed)

**Pattern**: Use optional chaining `?.` for properties that may be undefined

**Note**: Baseline JavaScript already uses optional chaining (line 258), so this step likely unnecessary

**Step 3**: Verify no TS2532 errors remain

```bash
npx tsc --noEmit 2>&1 | grep "TS2532"
```

**Expected**: No TS2532 errors in CitationValidator.ts

---

### Task 5.5.5: Comprehensive TypeScript compilation verification

**Files**: N/A (validation only)

**Step 1**: Run full TypeScript compilation

```bash
npx tsc --noEmit
```

**Expected**: Zero errors in CitationValidator.ts, validationTypes.ts, citationTypes.ts

**Step 2**: Verify no type escape hatches

```bash
grep -n "as any\|@ts-ignore\|@ts-expect-error" src/CitationValidator.ts
```

**Expected**: No matches (no type escape hatches)

**Step 3**: Verify explicit types on helper methods

```bash
grep -E "^\s+(private|public)\s+\w+\(" src/CitationValidator.ts | head -10
```

**Expected**: All methods have explicit return types and parameter types

**Verification**:
- ✅ Zero TypeScript errors in Epic 5 files
- ✅ No `as any` or type escape hatches
- ✅ All helper methods explicitly typed

---

### Task 5.5.6: Run test suite validation

**Files**: N/A (testing only)

**Step 1**: Run citation-manager tests from workspace root

```bash
cd /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows
npm test
```

**Expected**: 313/313 tests passing (same as baseline from Task 5.1)

**Step 2**: Run TypeScript-specific tests

```bash
npm run test:citation
```

**Expected**: All CitationValidator tests passing

**Verification**:
- ✅ 313/313 tests passing
- ✅ Zero new test failures
- ✅ Runtime behavior unchanged

---

### Task 5.5.7: Validate against Component Guide contracts

**Files**: N/A (validation only)

**Step 1**: Extract CitationValidator contracts

```bash
citation-manager extract links "tools/citation-manager/design-docs/component-guides/CitationValidator Implementation Guide.md"
```

**Expected**: Contract snippets showing `{ summary, links }`, ValidationMetadata discriminated union

**Step 2**: Verify type contracts match runtime behavior

```bash
git show 1c571e0:tools/citation-manager/src/CitationValidator.js | grep -A 10 "return {"
```

**Expected**: TypeScript types match JavaScript return structures exactly

**Verification**:
- ✅ Types match Component Guide contracts
- ✅ `validateFile` returns `{ summary, links }`
- ✅ No wrapper objects introduced

---

### Task 5.5.8: Commit Task 5.5 completion

**Files**: `src/CitationValidator.ts` (type coercions added)

**Step 1**: Review changes before commit

```bash
git diff src/CitationValidator.ts
```

**Expected Changes**:
- Regex: `anchorMatch[1]` → `(anchorMatch && anchorMatch[1])`
- Promise: `async (link)` → `async (link): Promise<void>`
- No logic changes

**Step 2**: Commit type coercion fixes

Use `create-git-commit` skill to commit Task 5.5 completion.

**Commit Message**:

```text
feat(epic5): add type coercions for strict null checks (Task 5.5)

Resolves Gap 8 (Regex Mismatch) and ensures TypeScript strict null
checking compiles successfully.

Changes:
- Fix regex capture group undefined → null coercion (line 836)
- Add explicit Promise<void> typing for enrichment loop (line 174)
- Verify zero TypeScript compilation errors
- Maintain 313/313 test pass rate

Technical Details:
- Regex: Use safe pattern `(match && match[1])` instead of `match[1] ?? null`
- Promises: Explicit `Promise<void>` return type for side-effect operations
- No runtime behavior changes - only type annotations

Related: Epic 5 Task 5.5, Gap 8, Gap 3
```

**Verification**:
- ✅ Commit created successfully
- ✅ Only CitationValidator.ts changed
- ✅ Commit message references Task 5.5 and gaps

---

## Task 5.6: Run validation checkpoints

**Status**: 🔲 Pending

**Addresses**:
- FR5: 100% Test Pass Rate
- NFR7: Incremental with Checkpoints

### Files
- N/A (validation only)

### Step 1: Run 8-checkpoint validation script

**Command**:

```bash
cd /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows
./tools/citation-manager/scripts/validate-typescript-migration.sh
```

**Expected Output**:

```text
✅ Checkpoint 1: No TypeScript errors
✅ Checkpoint 2: No 'any' type escapes
✅ Checkpoint 3: All functions have explicit return types
✅ Checkpoint 4: Strict null checks enabled
✅ Checkpoint 5: All tests pass (313/313)
✅ Checkpoint 6: JavaScript consumers compile
✅ Checkpoint 7: Build generates .js + .d.ts
✅ Checkpoint 8a: No duplicate type definitions
✅ Checkpoint 8b: Types imported from shared libraries

All 8 checkpoints passed!
```

**Verification**:
- ✅ All 8 checkpoints pass with zero errors
- ✅ Script exits with code 0 (success)

### Step 2: Verify CitationValidator.ts compiles

**Command**:

```bash
npx tsc --noEmit src/CitationValidator.ts
```

**Expected**: Zero TypeScript errors

**Verification**:
- ✅ No `any` type escapes
- ✅ No strict null check violations
- ✅ All method signatures explicit

### Step 3: Verify no duplicate ValidationMetadata

**Command**:

```bash
grep -r "^interface ValidationMetadata\|^type ValidationMetadata" tools/citation-manager/src/ --exclude-dir=types
```

**Expected**: (no matches)

**Verification**:
- ✅ ValidationMetadata only in `types/validationTypes.ts`
- ✅ Checkpoint 8a passes (single source of truth)

### Step 4: Commit validation checkpoint pass

Use `create-git-commit` skill to commit.

**Commit Message**:

```text
chore(epic5): validation checkpoints pass (Task 5.6)

All 8 checkpoints green after Tasks 5.2-5.5:
- Zero TypeScript compilation errors
- No type escape hatches (any, as any)
- All tests passing (313/313)
- No duplicate type definitions
- Types imported from shared libraries
- Build output correct (.js + .d.ts)

Checkpoint 8 confirms single source of truth for ValidationMetadata.
```

---

## Task 5.7: Test validation and baseline comparison

**Status**: 🔲 Pending

**Addresses**:
- FR5: 100% Test Pass Rate
- FR1: Preserve Runtime Behavior

### Files
- N/A (testing only)

### Step 1: Run full test suite from workspace root

**Command**:

```bash
cd /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows
npm test
```

**Expected Output**:

```text
Test Files  63 passed (63)
     Tests  313 passed (313)
  Start at  XX:XX:XX
  Duration  XXXms
```

**Verification**:
- ✅ 313/313 tests passing (100%)
- ✅ Zero new test failures
- ✅ Same test count as Task 5.1 baseline

### Step 2: Run citation-manager specific tests

**Command**:

```bash
npm run test:citation
```

**Expected**: All CitationValidator tests passing

**Verification**:
- ✅ `citation-validator.test.js` passes
- ✅ `citation-validator-enrichment.test.js` passes
- ✅ `citation-validator-cache.test.js` passes
- ✅ All integration tests pass

### Step 3: Verify test assertions unchanged

**Command**:

```bash
git diff HEAD -- tools/citation-manager/test/integration/citation-validator*.test.js
```

**Expected**: No assertion changes (only type annotations if any)

**Verification**:
- ✅ Test assertions match baseline
- ✅ No `.results` property usage (should be `.links`)
- ✅ No wrapper object expectations

### Step 4: Commit test validation success

Use `create-git-commit` skill to commit.

**Commit Message**:

```text
test(epic5): verify 313/313 tests pass (Task 5.7)

Regression validation confirms:
- Zero test failures after TypeScript migration
- Test count matches Task 5.1 baseline (313 tests)
- No test assertions modified
- Enrichment pattern tests passing
- Integration tests working correctly

Runtime behavior preserved exactly per FR1.
```

---

## Task 5.8: Contract validation

**Status**: 🔲 Pending

**Addresses**:
- Gap 11: Git Diff Comparison Step
- NFR1: No Breaking Changes

### Files
- N/A (validation only)

### Step 1: Verify ValidationResult structure

**Command**:

```bash
cd tools/citation-manager
grep -A 5 "interface ValidationResult" src/types/validationTypes.ts
```

**Expected**:

```typescript
export interface ValidationResult {
  summary: ValidationSummary;
  links: EnrichedLinkObject[];
}
```

**Verification**:
- ✅ Property names are `summary` and `links` (NOT `results`)
- ✅ Matches Component Guide contract exactly

### Step 2: Verify downstream consumers usage

**Command**:

```bash
grep -n "validationResult\.links" src/citation-manager.js src/core/ContentExtractor/*.js
```

**Expected Output**:

```text
src/citation-manager.js:307:  const enrichedLinks = validationResult.links;
src/core/ContentExtractor/extractLinksContent.js:25:  const enrichedLinks = validationResult.links;
src/core/ContentExtractor/ContentExtractor.js:XX:  // uses validationResult.links
```

**Verification**:
- ✅ All consumers access `.links` property
- ✅ No consumers expect `.results` property
- ✅ Enrichment pattern preserved

### Step 3: Verify enrichment pattern usage

**Command**:

```bash
grep -n "link\.validation\.status" src/citation-manager.js src/core/ContentExtractor/*.js
```

**Expected**: Multiple matches showing status checking

**Verification**:
- ✅ Consumers filter by `link.validation.status`
- ✅ Status values: 'valid', 'error', 'warning'
- ✅ No wrapper objects (link itself has validation property)

### Step 4: Compare TypeScript structure to baseline JavaScript

**Command**:

```bash
git diff HEAD~3 -- tools/citation-manager/src/CitationValidator.js
```

**Expected**: Only type annotations added, no logic changes

**Verification**:
- ✅ Line 196 enrichment pattern unchanged: `link.validation = validation`
- ✅ Return structure unchanged: `{ summary, links }`
- ✅ Method logic identical to baseline
- ✅ No wrapper objects introduced

### Step 5: Verify discriminated union typing

**Command**:

```bash
grep -A 10 "type ValidationMetadata" src/types/validationTypes.ts
```

**Expected**:

```typescript
export type ValidationMetadata =
  | { status: "valid" }
  | {
      status: "error";
      error: string;
      suggestion?: string;
      pathConversion?: PathConversion;
    }
  | {
      status: "warning";
      error: string;
      suggestion?: string;
      pathConversion?: PathConversion;
    };
```

**Verification**:
- ✅ Status-based discrimination
- ✅ Error/warning variants require `error` property
- ✅ Suggestion and pathConversion optional
- ✅ TypeScript narrows correctly

### Step 6: Commit contract validation success

Use `create-git-commit` skill to commit.

**Commit Message**:

```text
docs(epic5): contract validation complete (Task 5.8)

Manual verification confirms:
- ValidationResult structure: { summary, links } ✓
- Downstream consumers unchanged ✓
- Enrichment pattern preserved (line 196) ✓
- Discriminated unions type correctly ✓
- Git diff shows only type additions ✓

Gap 11 resolved: Structure comparison matches baseline.
NFR1 verified: No breaking changes introduced.
```

---

## Task 5.9: Commit and documentation

**Status**: 🔲 Pending

**Addresses**:
- NFR7: Incremental Validation (Epic checkpoint)

### Files
- `src/CitationValidator.ts` (git commit)
- `src/types/validationTypes.ts` (git commit)
- `src/types/citationTypes.ts` (git commit)
- `design-docs/features/20251119-type-contract-restoration/typescript-migration-sequencing.md` (MODIFY)

### Step 1: Review all Epic 5 changes

**Command**:

```bash
git status
git diff --stat
```

**Expected Files Changed**:
- `src/CitationValidator.ts` (renamed from .js, typed)
- `src/types/validationTypes.ts` (overwritten with correct types)
- `src/types/citationTypes.ts` (ValidationMetadata import added)

**Verification**:
- ✅ Only Epic 5 files modified
- ✅ No unexpected changes
- ✅ All test files unchanged (assertions preserved)

### Step 2: Create Epic 5 completion commit

Use `create-git-commit` skill to commit.

**Commit Message**:

```text
feat(epic5): complete CitationValidator TypeScript migration

Epic 5: Validation Layer - All gaps resolved
- Task 5.2: Correct type definitions (Gaps 1, 2, 7)
- Task 5.3: Class structure conversion (Gaps 3, 4, 8, 9)
- Task 5.4: Enrichment pattern typing (Gap 6)
- Task 5.5: Strict null checks (Gap 8)
- Task 5.6: 8-checkpoint validation ✓
- Task 5.7: 313/313 tests passing ✓
- Task 5.8: Contract validation ✓

Type Safety:
- Zero TypeScript compilation errors
- Zero 'any' type escapes
- Discriminated unions for ValidationMetadata
- Explicit return types on all methods

Architecture Preservation:
- Enrichment pattern unchanged (line 196)
- ValidationResult: { summary, links }
- Downstream consumers unaffected
- No wrapper objects introduced

Validation:
- All 8 checkpoints pass
- 100% test pass rate (313/313)
- Component Guide contracts verified
- Git diff confirms only type additions

Ready for Epic 6: ContentExtractor
```

**Files to Commit**:
- `src/CitationValidator.ts`
- `src/types/validationTypes.ts`
- `src/types/citationTypes.ts`

### Step 3: Update typescript-migration-sequencing.md

**File**: `design-docs/features/20251119-type-contract-restoration/typescript-migration-sequencing.md`

**Find Section**:

```markdown
### Epic 5: Validation Layer

**Purpose**: Convert validator with enrichment pattern
```

**Update Status**:

```markdown
_Status:_ ✅ Completed (2025-01-27)
_Commit:_ [commit-sha-from-step-2]
```

**Verification**:
- ✅ Status changed from 🔲 Pending to ✅ Completed
- ✅ Commit SHA added
- ✅ Completion date recorded

### Step 4: Commit sequencing doc update

Use `create-git-commit` skill to commit.

**Commit Message**:

```text
docs(epic5): mark Epic 5 complete in sequencing doc

Updated typescript-migration-sequencing.md:
- Status: ✅ Completed (2025-01-27)
- Commit: [sha]
- All deliverables achieved
- Ready to proceed to Epic 6

Epic 5 Success Criteria Met:
1. CitationValidator.ts compiles (zero errors) ✓
2. 313/313 tests passing (100%) ✓
3. Enrichment pattern preserved ✓
4. All 8 checkpoints pass ✓
5. Downstream consumers working ✓
6. No duplicate types ✓
7. Discriminated unions correct ✓
8. Committed and documented ✓
```

**Files to Commit**:
- `design-docs/features/20251119-type-contract-restoration/typescript-migration-sequencing.md`

### Step 5: Final verification

**Command**:

```bash
npm test
npx tsc --noEmit
git log --oneline -5
```

**Expected**:
- ✅ 313/313 tests passing
- ✅ Zero TypeScript errors
- ✅ Two commits visible (Epic 5 completion + sequencing update)

**Verification**:
- ✅ Epic 5 complete and documented
- ✅ Clean git history
- ✅ Ready for Epic 6

---

## Success Criteria

Epic 5 complete when:

1. ✅ CitationValidator.ts compiles with zero TypeScript errors
2. ✅ All 313 tests passing (100%)
3. ✅ Enrichment pattern preserved exactly (in-place validation property)
4. ✅ All 8 validation checkpoints pass
5. ✅ Downstream consumers (citation-manager.js, ContentExtractor.js) unaffected
6. ✅ No duplicate type definitions (Checkpoint 8)
7. ✅ Discriminated unions type correctly
8. ✅ Committed and documented

---

## Gaps

Pre-implementation gap analysis performed 2025-01-27. **All gaps must be addressed before Task 5.2 execution.**

### 🚨 CRITICAL - Must Fix

#### Gap 1: Wrong Types in validationTypes.ts
**Issue**: Current validationTypes.ts contains Epic 4.4 FAILED types (wrapper objects, not enrichment pattern).

**Evidence**: File has `FileValidationSummary` with `results[]` property. Should have `ValidationResult` with `links[]`.

**Fix**: Task 5.2 must REPLACE entire file content, not modify. DELETE all existing types, ADD correct discriminated unions.

**Reference**: [Lessons Learned - Epic 4.4 Failures](../../0-elicit-sense-making-phase/lessons-learned.md)

---

#### Gap 2: Wrong ValidationMetadata in citationTypes.ts
**Issue**: citationTypes.ts already defines ValidationMetadata with WRONG structure (has `fileExists`, `anchorExists` fields not in contract).

**Current** (citationTypes.ts lines 86-100):

```typescript
export interface ValidationMetadata {
  fileExists: boolean;        // NOT IN CONTRACT
  anchorExists: boolean | null; // NOT IN CONTRACT
  suggestions?: string[];      // Should be "suggestion" (singular)
}
```

**Required** (per JSON Schema):

```typescript
type ValidationMetadata =
  | { status: "valid" }
  | { status: "error"; error: string; suggestion?: string; pathConversion?: PathConversion }
  | { status: "warning"; error: string; suggestion?: string; pathConversion?: PathConversion };
```

**Fix**: Task 5.2 must ALSO update citationTypes.ts:
- DELETE existing ValidationMetadata interface
- Import ValidationMetadata from validationTypes.ts instead

**Reference**: [CitationValidator Component Guide - Output Contract](../../../../component-guides/CitationValidator%20Implementation%20Guide.md#Output%20Contract)

---

#### Gap 3: Missing Dependency Interfaces
**Issue**: Task 5.3 imports `ParsedFileCacheInterface` and `FileCacheInterface` but these don't exist.

**Fix Options**:
1. Define minimal inline interfaces in CitationValidator.ts
2. Create src/types/interfaces.ts (adds file)
3. Use concrete types instead of interfaces

**Recommendation**: Option 1 - inline interfaces. Avoids unnecessary abstraction file.

```typescript
// In CitationValidator.ts
interface ParsedFileCacheInterface {
  resolveParsedFile(filePath: string): Promise<ParsedDocument>;
}

interface FileCacheInterface {
  resolveFile(filename: string): { found: boolean; path: string | null };
}
```

---

#### Gap 4: validateSingleCitation Return Type Mismatch
**Issue**: Component Guide says returns `EnrichedLinkObject`, but actual JS code returns validation result object with different structure.

**Component Guide Claims**:

```typescript
validateSingleCitation(link: LinkObject): Promise<EnrichedLinkObject>
```

**Actual JS Returns** (line 854-882):

```typescript
{ line, citation, status, linkType, scope, error?, suggestion?, pathConversion? }
```

**CLI Expects** (citation-manager.js line 373):

```javascript
const validationResult = await this.validator.validateSingleCitation(syntheticLink);
// Uses: validationResult.status, validationResult.error, validationResult.suggestion
```

**Fix**: Type actual return structure, document Component Guide discrepancy as technical debt. Per [Lessons Learned](../../0-elicit-sense-making-phase/lessons-learned.md#Prevention%20Checklist%20for%20Future%20Conversions): DON'T change behavior during migration.

**Correct Signature**:

```typescript
async validateSingleCitation(
  citation: LinkObject,
  contextFile?: string
): Promise<{
  line: number;
  citation: string;
  status: "valid" | "error" | "warning";
  linkType: string;
  scope: string;
  error?: string;
  suggestion?: string;
  pathConversion?: PathConversion;
}>
```

---

### ⚠️ SIGNIFICANT - Affects Type Safety

#### Gap 6: Incomplete Discriminated Union Construction
**Issue**: Task 5.4 uses `as any` defeating discriminated union type safety.

**Current Plan** (Task 5.4 line 145-147):

```typescript
const validation: ValidationMetadata = { status: result.status };
if (result.error) (validation as any).error = result.error;  // ❌ Defeats types
```

**Fix**: Construct discriminated union properly based on status:

```typescript
let validation: ValidationMetadata;
if (result.status === 'valid') {
  validation = { status: 'valid' };
} else {
  const errorBase = {
    status: result.status as 'error' | 'warning',
    error: result.error
  };
  validation = {
    ...errorBase,
    ...(result.suggestion && { suggestion: result.suggestion }),
    ...(result.pathConversion && { pathConversion: result.pathConversion })
  };
}
```

---

#### Gap 7: Missing PathConversion Type
**Issue**: Plan uses `pathConversion?: object` but JSON Schema defines specific structure.

**JSON Schema** (from Component Guide):

```json
"pathConversion": {
  "type": "object",
  "properties": {
    "type": { "const": "path-conversion" },
    "original": { "type": "string" },
    "recommended": { "type": "string" }
  }
}
```

**Fix**: Add to Task 5.2:

```typescript
export interface PathConversion {
  type: "path-conversion";
  original: string;
  recommended: string;
}
```

**Reference**: [ValidationResult JSON Schema](../../../../component-guides/CitationValidator%20Implementation%20Guide.md#`CitationValidator.ValidationResult.Output.DataContract`%20JSON%20Schema)

---

#### Gap 8: Missing Helper Method Types
**Issue**: Plan doesn't specify types for ~15 helper methods beyond main public methods.

**Required Method Signatures**:

```typescript
private classifyPattern(citation: LinkObject): string;
private validateCaretPattern(citation: LinkObject): ReturnType<typeof this.createValidationResult>;
private validateEmphasisPattern(citation: LinkObject): ReturnType<typeof this.createValidationResult>;
private async validateCrossDocumentLink(citation: LinkObject, contextFile?: string): Promise<ReturnType<typeof this.createValidationResult>>;
private validateWikiStyleLink(citation: LinkObject): ReturnType<typeof this.createValidationResult>;
private safeRealpathSync(path: string): string;
private isFile(path: string): boolean;
private isObsidianAbsolutePath(path: string): boolean;
private convertObsidianToFilesystemPath(obsidianPath: string, sourceFile: string): string | null;
private generatePathResolutionDebugInfo(relativePath: string, sourceFile: string): string;
```

**Fix**: Add complete method signatures section to Task 5.3.

---

### ℹ️ MINOR - Process/Documentation

#### Gap 9: No JSDoc Removal Step
**Issue**: Lines 4-48 have JSDoc typedefs that duplicate TypeScript types after conversion.

**Fix**: Add to Task 5.3:

```markdown
**Remove JSDoc typedefs** (lines 4-48):
- Delete all @typedef declarations (ValidationMetadata, EnrichedLinkObject, ValidationResult)
- TypeScript types replace JSDoc
```

---

#### Gap 10: Missing Test Assertion Review
**Issue**: [Lessons Learned Prevention Checklist](../../0-elicit-sense-making-phase/lessons-learned.md#During%20Conversion) requires reviewing test assertions before conversion.

**Fix**: Add Task 5.1.5 before Task 5.2:

```markdown
## Task 5.1.5: Review test assertions

### Commands
```bash
grep -n "validationResult\." test/**/*.test.js
grep -n "link.validation" test/**/*.test.js
```

### Verification
- ✅ Tests expect `{ summary, links }` structure (NOT `{ results, totalCitations }`)
- ✅ Tests expect `link.validation.status` property
- ✅ No tests expect Epic 4.4 wrapper objects

```markdown
Task 5.1.5 complete
```

---

#### Gap 11: No Git Diff Comparison Step
**Issue**: [Lessons Learned checklist](../../0-elicit-sense-making-phase/lessons-learned.md#After%20Conversion) requires comparing before/after to ensure structure unchanged.

**Fix**: Add to Task 5.8:

```bash
# Compare TypeScript structure to baseline JavaScript
git diff HEAD -- src/CitationValidator.js
# Verify: Only type annotations added, no logic changes
```

---

### 📚 References

- [Lessons Learned - Epic 4 Failures](../../0-elicit-sense-making-phase/lessons-learned.md)
- [CitationValidator Component Guide](../../../../component-guides/CitationValidator%20Implementation%20Guide.md)
- [TypeScript Conversion Patterns](../../typescript-migration-design.md#TypeScript%20Conversion%20Patterns)
- [typescript-migration-design](../../typescript-migration-design.md) %% force-extract %%
- [typescript-migration-sequencing](../../typescript-migration-sequencing.md) %% force-extract %%
- [typescript-migration-prd](../../typescript-migration-prd.md) %% force-extract %%
- [Coding Standards and Conventions](../../../../../../../ARCHITECTURE.md#Coding%20Standards%20and%20Conventions)
- [TypeScript Naming Conventions](../../../../../../../ARCHITECTURE.md#TypeScript%20Naming%20Conventions)
- [TypeScript Development Workflow](../../../../../../../ARCHITECTURE.md#TypeScript%20Development%20Workflow)
