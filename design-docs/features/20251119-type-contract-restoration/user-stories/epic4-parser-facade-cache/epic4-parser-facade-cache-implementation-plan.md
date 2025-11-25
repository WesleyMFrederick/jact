# Epic 4: Parser Facade & Cache - TypeScript Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert ParsedDocument and ParsedFileCache from JavaScript to TypeScript while preserving facade encapsulation and Promise caching patterns.

**Architecture:** Facade pattern with lazy-loaded caches, Promise-based read-through cache with concurrent request deduplication. Wraps MarkdownParser output in stable query interface.

**Tech Stack:** TypeScript 5.3+, Map<K,V> for Promise caching, marked.js Token types

---

## Task 1 - Rename ParsedDocument.js to TypeScript

### Files
- `tools/citation-manager/src/ParsedDocument.js` (RENAME to ParsedDocument.ts)

### Step 1: Rename file extension

```bash
cd tools/citation-manager
mv src/ParsedDocument.js src/ParsedDocument.ts
```

### Step 2: Verify file renamed

Run: `ls -la src/ParsedDocument.ts`
Expected: File exists with .ts extension

### Step 3: Verify TypeScript recognizes file

Run: `npx tsc --noEmit`
Expected: May have type errors (will fix in next tasks), but file is recognized

### Step 4: Commit
Use `create-git-commit` skill with message: "refactor(epic4): rename ParsedDocument.js to .ts"

---

## Task 2 - Add type imports to ParsedDocument

### Files
- `tools/citation-manager/src/ParsedDocument.ts` (MODIFY lines 1-10)

### Step 1: Add type imports at top of file

Replace:

```typescript
/**
 * Facade providing stable query interface over MarkdownParser.Output.DataContract
 *
 * Encapsulates parser output complexity and provides high-level query methods
 * for anchor validation, fuzzy matching, and content extraction. Isolates
 * consumers from internal schema changes through lazy-loaded caches and
 * stable public interface.
 *
 * @class ParsedDocument
 */
class ParsedDocument {
```

With:

```typescript
import type {
 ParserOutput,
 LinkObject,
 AnchorObject,
} from "./types/citationTypes.js";

/**
 * Facade providing stable query interface over MarkdownParser.Output.DataContract
 *
 * Encapsulates parser output complexity and provides high-level query methods
 * for anchor validation, fuzzy matching, and content extraction. Isolates
 * consumers from internal schema changes through lazy-loaded caches and
 * stable public interface.
 *
 * @class ParsedDocument
 */
class ParsedDocument {
```

### Step 2: Verify TypeScript compiles

Run: `npx tsc --noEmit`
Expected: Imports resolve correctly, may still have other type errors

### Step 3: Commit
Use `create-git-commit` skill with message: "refactor(epic4): add type imports to ParsedDocument"

---

## Task 3 - Type constructor and private fields

### Files
- `tools/citation-manager/src/ParsedDocument.ts` (MODIFY lines 15-21)

### Step 1: Add type annotations to constructor and fields

Replace:

```typescript
 /**
  * Create a ParsedDocument facade wrapping parser output
  * @param {Object} parserOutput - MarkdownParser.Output.DataContract with { filePath, content, tokens, links, headings, anchors }
  */
 constructor(parserOutput) {
  // Store parser output privately for encapsulation
  this._data = parserOutput;

  // Initialize lazy-load cache for performance
  this._cachedAnchorIds = null;
 }
```

With:

```typescript
 private _data: ParserOutput;
 private _cachedAnchorIds: string[] | null;

 /**
  * Create a ParsedDocument facade wrapping parser output
  * @param parserOutput - MarkdownParser.Output.DataContract with filePath, content, tokens, links, headings, anchors
  */
 constructor(parserOutput: ParserOutput) {
  // Store parser output privately for encapsulation
  this._data = parserOutput;

  // Initialize lazy-load cache for performance
  this._cachedAnchorIds = null;
 }
```

### Step 2: Verify TypeScript compiles

Run: `npx tsc --noEmit`
Expected: Constructor and private fields typed correctly

### Step 3: Commit
Use `create-git-commit` skill with message: "refactor(epic4): type ParsedDocument constructor and private fields"

---

## Task 4 - Type public anchor query methods

### Files
- `tools/citation-manager/src/ParsedDocument.ts` (MODIFY anchor methods)

### Step 1: Add return types to hasAnchor

Replace:

```typescript
 hasAnchor(anchorId) {
```

With:

```typescript
 hasAnchor(anchorId: string): boolean {
```

### Step 2: Add return type to findSimilarAnchors

Replace:

```typescript
 findSimilarAnchors(anchorId) {
```

With:

```typescript
 findSimilarAnchors(anchorId: string): string[] {
```

### Step 3: Add return type to getAnchorIds

Replace:

```typescript
 getAnchorIds() {
```

With:

```typescript
 getAnchorIds(): string[] {
```

### Step 4: Verify TypeScript compiles

Run: `npx tsc --noEmit`
Expected: Anchor query methods typed correctly

### Step 5: Commit
Use `create-git-commit` skill with message: "refactor(epic4): type ParsedDocument anchor query methods"

---

## Task 5 - Type public link query methods

### Files
- `tools/citation-manager/src/ParsedDocument.ts` (MODIFY link methods)

### Step 1: Add return type to getLinks

Replace:

```typescript
 getLinks() {
  return this._data.links;
 }
```

With:

```typescript
 getLinks(): LinkObject[] {
  return this._data.links;
 }
```

### Step 2: Verify TypeScript compiles

Run: `npx tsc --noEmit`
Expected: Link query methods typed correctly

### Step 3: Commit
Use `create-git-commit` skill with message: "refactor(epic4): type ParsedDocument link query methods"

---

## Task 6 - Type public extraction methods

### Files
- `tools/citation-manager/src/ParsedDocument.ts` (MODIFY extraction methods)

### Step 1: Add return types to extraction methods

Replace:

```typescript
 extractFullContent() {
  return this._data.content;
 }

 extractSection(headingText, headingLevel) {
```

With:

```typescript
 extractFullContent(): string {
  return this._data.content;
 }

 extractSection(headingText: string, headingLevel: number): string | null {
```

### Step 2: Add return type to extractBlock

Replace:

```typescript
 extractBlock(anchorId) {
```

With:

```typescript
 extractBlock(anchorId: string): string | null {
```

### Step 3: Verify TypeScript compiles

Run: `npx tsc --noEmit`
Expected: Extraction methods typed correctly

### Step 4: Commit
Use `create-git-commit` skill with message: "refactor(epic4): type ParsedDocument extraction methods"

---

## Task 7 - Type private helper methods

### Files
- `tools/citation-manager/src/ParsedDocument.ts` (MODIFY private methods)

### Step 1: Add return types to private helpers

Replace:

```typescript
 _getAnchorIds() {
```

With:

```typescript
 private _getAnchorIds(): string[] {
```

### Step 2: Add types to _fuzzyMatch

Replace:

```typescript
 _fuzzyMatch(target, candidates) {
```

With:

```typescript
 private _fuzzyMatch(target: string, candidates: string[]): string[] {
```

### Step 3: Add types to _calculateSimilarity

Replace:

```typescript
 _calculateSimilarity(str1, str2) {
```

With:

```typescript
 private _calculateSimilarity(str1: string, str2: string): number {
```

### Step 4: Verify TypeScript compiles

Run: `npx tsc --noEmit`
Expected: All private methods typed correctly

### Step 5: Commit
Use `create-git-commit` skill with message: "refactor(epic4): type ParsedDocument private helper methods"

---

## Task 8 - Run validation script and commit ParsedDocument

### Files
- Validation script: `tools/citation-manager/scripts/validate-typescript-migration.sh`

### Step 1: Run 8-checkpoint validation script

Run: `./scripts/validate-typescript-migration.sh`
Expected output:

```text
Running TypeScript migration validation...
✅ All checkpoints passed
```

Expected checkpoints:
- ✅ Checkpoint 1-4: Type safety (tsc --noEmit passes)
- ✅ Checkpoint 5: Tests 314/314 passing
- ✅ Checkpoint 8: No duplicate type definitions

### Step 2: Verify test output shows 314/314

Run: `npm test 2>&1 | grep "Tests.*314"`
Expected: "Tests  314 passed (314)"

### Step 3: Commit ParsedDocument completion
Use `create-git-commit` skill with message: "refactor(epic4): complete ParsedDocument TypeScript migration"

---

## Task 9 - Rename ParsedFileCache.js to TypeScript

### Files
- `tools/citation-manager/src/ParsedFileCache.js` (RENAME to ParsedFileCache.ts)

### Step 1: Rename file extension

```bash
cd tools/citation-manager
mv src/ParsedFileCache.js src/ParsedFileCache.ts
```

### Step 2: Verify file renamed

Run: `ls -la src/ParsedFileCache.ts`
Expected: File exists with .ts extension

### Step 3: Verify TypeScript recognizes file

Run: `npx tsc --noEmit`
Expected: May have type errors (will fix in next tasks)

### Step 4: Commit
Use `create-git-commit` skill with message: "refactor(epic4): rename ParsedFileCache.js to .ts"

---

## Task 10 - Type Map and add imports to ParsedFileCache

### Files
- `tools/citation-manager/src/ParsedFileCache.ts` (MODIFY lines 1-32)

### Step 1: Add type import and update ParsedDocument import

Replace:

```typescript
import { normalize, resolve } from "node:path";
import ParsedDocument from "./ParsedDocument.js";
```

With:

```typescript
import { normalize, resolve } from "node:path";
import ParsedDocument from "./ParsedDocument.js";
import type { ParserOutput } from "./types/citationTypes.js";
import type MarkdownParser from "./MarkdownParser.js";
```

### Step 2: Add type annotation to cache Map

Replace:

```typescript
export class ParsedFileCache {
 /**
  * Initialize cache with markdown parser
  *
  * @param {MarkdownParser} markdownParser - Parser instance for processing markdown files
  */
 constructor(markdownParser) {
  this.parser = markdownParser;
  this.cache = new Map();
 }
```

With:

```typescript
export class ParsedFileCache {
 private parser: MarkdownParser;
 private cache: Map<string, Promise<ParsedDocument>>;

 /**
  * Initialize cache with markdown parser
  *
  * @param markdownParser - Parser instance for processing markdown files
  */
 constructor(markdownParser: MarkdownParser) {
  this.parser = markdownParser;
  this.cache = new Map<string, Promise<ParsedDocument>>();
 }
```

### Step 3: Verify TypeScript compiles

Run: `npx tsc --noEmit`
Expected: Map generic and imports typed correctly

### Step 4: Commit
Use `create-git-commit` skill with message: "refactor(epic4): type ParsedFileCache Map and add imports"

---

## Task 11 - Type constructor and resolveParsedFile method

### Files
- `tools/citation-manager/src/ParsedFileCache.ts` (MODIFY resolveParsedFile method)

### Step 1: Add return type to resolveParsedFile

Replace:

```typescript
 async resolveParsedFile(filePath) {
```

With:

```typescript
 async resolveParsedFile(filePath: string): Promise<ParsedDocument> {
```

### Step 2: Verify TypeScript compiles

Run: `npx tsc --noEmit`
Expected: Method signature typed correctly

### Step 3: Commit
Use `create-git-commit` skill with message: "refactor(epic4): type ParsedFileCache resolveParsedFile method"

---

## Task 12 - Verify facade wrapping pattern preserved

### Files
- `tools/citation-manager/src/ParsedFileCache.ts` (VERIFY lines 56-65)

### Step 1: Verify Promise caching pattern

Run: `grep -A 10 "parsePromise.then" src/ParsedFileCache.ts`
Expected output showing facade wrapping:

```typescript
  const parsedDocPromise = parsePromise.then(
   (contract) => new ParsedDocument(contract),
  );
```

### Step 2: Verify cache stores ParsedDocument Promise

Run: `grep "cache.set" src/ParsedFileCache.ts`
Expected: `this.cache.set(cacheKey, parsedDocPromise);`

### Step 3: Verify non-null assertion safe after has() check

Run: `grep -B 2 "cache.get" src/ParsedFileCache.ts`
Expected: `if (this.cache.has(cacheKey))` check before `.get(cacheKey)`

### Step 4: Add non-null assertion if needed

If `cache.get(cacheKey)` doesn't have `!`, update:

```typescript
  if (this.cache.has(cacheKey)) {
   return this.cache.get(cacheKey)!;
  }
```

### Step 5: Commit
Use `create-git-commit` skill with message: "refactor(epic4): verify facade wrapping pattern in ParsedFileCache"

---

## Task 13 - Run final validation script and commit Epic 4

### Files
- Validation script: `tools/citation-manager/scripts/validate-typescript-migration.sh`

### Step 1: Run 8-checkpoint validation script

Run: `./scripts/validate-typescript-migration.sh`
Expected output:

```text
Running TypeScript migration validation...
✅ All checkpoints passed
```

### Step 2: Verify all checkpoints explicitly

Run each checkpoint manually:

#### Checkpoint 1-4: Type Safety

```bash
npx tsc --noEmit
```

Expected: Zero errors

#### Checkpoint 5: Tests Pass

```bash
npm test
```

Expected: Tests  314 passed (314)

#### Checkpoint 6: Build Output

```bash
npx tsc --build
```

Expected: Generates .js + .d.ts files in dist/

#### Checkpoint 8: No Duplicate Types

```bash
grep -r "^interface LinkObject\|^type LinkObject" src/ --exclude-dir=types
```

Expected: No matches (types only in types/ directory)

### Step 3: Verify facade pattern preserved

Run: `grep "new ParsedDocument(contract)" src/ParsedFileCache.ts`
Expected: Line found showing facade wrapping

### Step 4: Verify Promise caching pattern

Run: `grep "Map<string, Promise<ParsedDocument>>" src/ParsedFileCache.ts`
Expected: Line found with correct generic type

### Step 5: Final commit for Epic 4
Use `create-git-commit` skill with message: "refactor(epic4): complete Parser Facade & Cache TypeScript migration

- ParsedDocument.ts: Typed all query and extraction methods
- ParsedFileCache.ts: Typed Promise caching with Map<string, Promise<ParsedDocument>>
- Preserved facade encapsulation pattern (wraps ParserOutput in ParsedDocument)
- Preserved Promise caching pattern (concurrent request deduplication)
- All 8 checkpoints passing (314/314 tests, zero TypeScript errors)
- No duplicate type definitions (types/ single source of truth)

Epic 4 complete. Ready for Epic 5 (CitationValidator with discriminated unions)."

---

## Execution Summary

**Epic 4 Complete When:**
- ✅ ParsedDocument.ts with all methods typed
- ✅ ParsedFileCache.ts with Map<string, Promise<ParsedDocument>>
- ✅ Facade pattern preserved (wraps ParserOutput)
- ✅ Promise caching preserved (concurrent deduplication)
- ✅ 8 checkpoints passing
- ✅ 314/314 tests maintained

**Next Epic:** Epic 5 - CitationValidator with discriminated unions for enrichment pattern
