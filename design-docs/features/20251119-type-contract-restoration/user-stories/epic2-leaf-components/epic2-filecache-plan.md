# Epic 2: FileCache TypeScript Migration - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert FileCache.js to TypeScript with explicit types while preserving all functionality

**Architecture:** Simple Map-based cache with no external dependencies, uses class-based dependency injection for fs/path modules

**Tech Stack:** TypeScript 5.3+, Node.js fs/path modules, Vitest

---

## Task 1 - Rename FileCache.js to FileCache.ts

### Files
- `tools/citation-manager/src/FileCache.js` (RENAME to .ts)

### Step 1: Rename file extension

Run: `git mv tools/citation-manager/src/FileCache.js tools/citation-manager/src/FileCache.ts`
Expected: File renamed successfully

### Step 2: Verify file was renamed

Run: `ls tools/citation-manager/src/FileCache.ts`
Expected: File exists with .ts extension

### Step 3: Run tests to establish baseline

Run: `cd tools/citation-manager && npm test`
Expected: All tests pass (may have import warnings, that's expected)

### Step 4: Commit rename

Use `create-git-commit` skill with message:

```text
refactor(typescript-migration): rename FileCache.js to .ts

- Epic 2: FileCache conversion to TypeScript
- Rename only, no type annotations yet
- All tests passing
```

---

## Task 2 - Add type annotations to constructor and private fields

### Files
- `tools/citation-manager/src/FileCache.ts:30-35` (MODIFY)

### Step 1: Add TypeScript types to constructor and fields

Replace lines 30-35:

```typescript
constructor(fileSystem, pathModule) {
 this.fs = fileSystem;
 this.path = pathModule;
 this.cache = new Map(); // filename -> absolute path
 this.duplicates = new Set(); // filenames that appear multiple times
}
```

With:

```typescript
private fs: typeof import('fs');
private path: typeof import('path');
private cache: Map<string, string>; // filename -> absolute path
private duplicates: Set<string>; // filenames that appear multiple times

constructor(fileSystem: typeof import('fs'), pathModule: typeof import('path')) {
 this.fs = fileSystem;
 this.path = pathModule;
 this.cache = new Map<string, string>();
 this.duplicates = new Set<string>();
}
```

### Step 2: Run TypeScript compiler check

Run: `cd tools/citation-manager && npx tsc --noEmit`
Expected: Zero errors (or only errors from other unconverted files)

### Step 3: Run tests

Run: `cd tools/citation-manager && npm test`
Expected: 314/314 tests passing

### Step 4: Commit type annotations

Use `create-git-commit` skill

---

## Task 3 - Add return type to buildCache method

### Files
- `tools/citation-manager/src/FileCache.ts:47` (MODIFY)

### Step 1: Define CacheStats interface and add return type

After line 35 (after constructor), add interface:

```typescript
// Types defined inline: FileCache is leaf component with no consumers needing these types
// If future components need these types, migrate to src/types/fileCacheTypes.ts
interface CacheStats {
 totalFiles: number;
 duplicates: number;
 scopeFolder: string;
 realScopeFolder: string;
}
```

Then modify line 47:

```typescript
buildCache(scopeFolder): CacheStats {
```

To:

```typescript
buildCache(scopeFolder: string): CacheStats {
```

### Step 2: Run TypeScript compiler check

Run: `cd tools/citation-manager && npx tsc --noEmit`
Expected: Zero errors

### Step 3: Run tests

Run: `cd tools/citation-manager && npm test`
Expected: 314/314 tests passing

### Step 4: Commit return type

Use `create-git-commit` skill

---

## Task 4 - Add return type to scanDirectory method

### Files
- `tools/citation-manager/src/FileCache.ts:81` (MODIFY)

### Step 1: Add void return type

Change line 81:

```typescript
scanDirectory(dirPath) {
```

To:

```typescript
private scanDirectory(dirPath: string): void {
```

### Step 2: Run TypeScript compiler check

Run: `cd tools/citation-manager && npx tsc --noEmit`
Expected: Zero errors

### Step 3: Run tests

Run: `cd tools/citation-manager && npm test`
Expected: 314/314 tests passing

### Step 4: Commit return type

Use `create-git-commit` skill

---

## Task 5 - Add return type to addToCache method

### Files
- `tools/citation-manager/src/FileCache.ts:106` (MODIFY)

### Step 1: Add void return type

Change line 106:

```typescript
addToCache(filename, fullPath) {
```

To:

```typescript
private addToCache(filename: string, fullPath: string): void {
```

### Step 2: Run TypeScript compiler check

Run: `cd tools/citation-manager && npx tsc --noEmit`
Expected: Zero errors

### Step 3: Run tests

Run: `cd tools/citation-manager && npm test`
Expected: 314/314 tests passing

### Step 4: Commit return type

Use `create-git-commit` skill

---

## Task 6 - Add return type to resolveFile method

### Files
- `tools/citation-manager/src/FileCache.ts:128` (MODIFY)

### Step 1: Define ResolveResult interface and add return type

After CacheStats interface, add:

```typescript
interface ResolveResultSuccess {
 found: true;
 path: string;
 fuzzyMatch?: boolean;
 correctedFilename?: string;
 message?: string;
}

interface ResolveResultFailure {
 found: false;
 reason: 'duplicate' | 'not_found' | 'duplicate_fuzzy';
 message: string;
}

type ResolveResult = ResolveResultSuccess | ResolveResultFailure;
```

Then change line 128:

```typescript
resolveFile(filename) {
```

To:

```typescript
resolveFile(filename: string): ResolveResult {
```

### Step 2: Run TypeScript compiler check

Run: `cd tools/citation-manager && npx tsc --noEmit`
Expected: Zero errors (discriminated unions should work correctly)

### Step 3: Run tests

Run: `cd tools/citation-manager && npm test`
Expected: 314/314 tests passing

### Step 4: Commit return type

Use `create-git-commit` skill

---

## Task 7 - Add return type to findFuzzyMatch method

### Files
- `tools/citation-manager/src/FileCache.ts:189` (MODIFY)

### Step 1: Add nullable return type

Change line 189:

```typescript
findFuzzyMatch(filename) {
```

To:

```typescript
private findFuzzyMatch(filename: string): ResolveResult | null {
```

### Step 2: Run TypeScript compiler check

Run: `cd tools/citation-manager && npx tsc --noEmit`
Expected: Zero errors

### Step 3: Run tests

Run: `cd tools/citation-manager && npm test`
Expected: 314/314 tests passing

### Step 4: Commit return type

Use `create-git-commit` skill

---

## Task 8 - Add return type to getAllFiles method

### Files
- `tools/citation-manager/src/FileCache.ts:277` (MODIFY)

### Step 1: Define FileEntry interface and add return type

After ResolveResult types, add:

```typescript
interface FileEntry {
 filename: string;
 path: string;
 isDuplicate: boolean;
}
```

Then change line 277:

```typescript
getAllFiles() {
```

To:

```typescript
getAllFiles(): FileEntry[] {
```

### Step 2: Run TypeScript compiler check

Run: `cd tools/citation-manager && npx tsc --noEmit`
Expected: Zero errors

### Step 3: Run tests

Run: `cd tools/citation-manager && npm test`
Expected: 314/314 tests passing

### Step 4: Commit return type

Use `create-git-commit` skill

---

## Task 9 - Add return type to getCacheStats method

### Files
- `tools/citation-manager/src/FileCache.ts:286` (MODIFY)

### Step 1: Define CacheStatsDetail interface and add return type

After FileEntry interface, add:

```typescript
interface CacheStatsDetail {
 totalFiles: number;
 duplicateCount: number;
 duplicates: string[];
}
```

Then change line 286:

```typescript
getCacheStats() {
```

To:

```typescript
getCacheStats(): CacheStatsDetail {
```

### Step 2: Run TypeScript compiler check

Run: `cd tools/citation-manager && npx tsc --noEmit`
Expected: Zero errors

### Step 3: Run tests

Run: `cd tools/citation-manager && npm test`
Expected: 314/314 tests passing

### Step 4: Commit return type

Use `create-git-commit` skill

---

## Task 10 - Run 8-checkpoint validation script

### Files
- N/A (validation only)

### Step 1: Execute validation script

Run: `cd tools/citation-manager && ./scripts/validate-typescript-migration.sh`
Expected: All 8 checkpoints pass

### Step 2: Verify no duplicate type definitions

Run: `grep -r "^interface FileCache\|^type FileCache\|^class FileCache" tools/citation-manager/src/ --exclude-dir=types`
Expected: Only one match in FileCache.ts

### Step 3: Document validation success

Validation complete for Epic 2: FileCache

- ✅ TypeScript compilation: 0 errors
- ✅ Tests: 314/314 passing
- ✅ No duplicate types
- ✅ All 8 checkpoints pass

---

## Task 11 - Update sequencing document with completion status

### Files
- `tools/citation-manager/design-docs/features/20251119-type-contract-restoration/typescript-migration-sequencing.md:76-77` (MODIFY)

### Step 1: Get commit hash

Run: `git rev-parse HEAD`
Expected: Full commit hash

### Step 2: Update sequencing document status

Change lines 76-77:

```markdown
_Status:_ 🔲 Pending
_Commit:_
```

To:

```markdown
_Status:_ ✅ Completed (2025-01-24)
_Commit:_ <commit-hash-from-step-1>
```

### Step 3: Commit sequencing update

Use `create-git-commit` skill

---

## Final Validation Checklist

**Before marking Epic 2 complete:**
- ✅ FileCache.ts has all explicit return types
- ✅ No `any` types used
- ✅ `Map<string, string>` typed cache
- ✅ `Set<string>` typed duplicates
- ✅ Discriminated unions for ResolveResult
- ✅ All 314 tests passing
- ✅ TypeScript compiler: 0 errors
- ✅ Checkpoint 8: No duplicate definitions
- ✅ Sequencing doc updated
- ✅ Git commits clean and atomic

**Success Criteria Met:**
- Component converted with zero breaking changes
- All architecture patterns preserved
- Type safety enforced at compile time
