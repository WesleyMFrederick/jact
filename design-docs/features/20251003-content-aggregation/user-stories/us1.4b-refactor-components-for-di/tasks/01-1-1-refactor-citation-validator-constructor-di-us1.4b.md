---
story: "User Story 1.4b: Refactor citation-manager Components for Dependency Injection"
epic: "Epic 1: Citation Manager Test Migration & Content Aggregation"
phase: "Phase 1: Component Constructor Refactoring"
task-id: "1.1"
task-anchor: "^US1-4bT1-1"
wave: "1a"
implementation-agent: "code-developer-agent"
evaluation-agent: "application-tech-lead"
status: "ready"
---

# Task 1.1: Refactor Components for Constructor DI

## Objective

Refactor CitationValidator, MarkdownParser, and FileCache to accept all dependencies via constructor parameters instead of creating them internally.

_Source_: [Task 1.1](../us1.4b-refactor-components-for-di.md#^US1-4bT1-1)

## Current State → Required State

### CitationValidator: BEFORE

```javascript
// Line 1-8: Hard-coded dependency creation
import { MarkdownParser } from "./MarkdownParser.js";

export class CitationValidator {
 constructor() {
  this.parser = new MarkdownParser();  // Hard-coded dependency
  this.fileCache = null;
  // ... pattern validation rules
 }
```

### CitationValidator: AFTER

```javascript
// Line 1-8: Constructor DI pattern
export class CitationValidator {
 constructor(parser, cache) {
  this.parser = parser;      // Injected dependency
  this.fileCache = cache;    // Injected dependency
  // ... pattern validation rules
 }
```

**Problems**:
- Direct import of MarkdownParser creates tight coupling
- Internal instantiation prevents dependency control
- Cannot test with custom parser/cache configurations

**Improvements**:
- Dependencies passed as constructor parameters
- MarkdownParser import removed
- Explicit dependency contracts enable testing flexibility

### MarkdownParser: BEFORE

```javascript
// Line 1: Hard-coded fs import
import { readFileSync } from "node:fs";

export class MarkdownParser {
 constructor() {
  this.anchorPatterns = { /* ... */ };
  this.linkPatterns = { /* ... */ };
 }

 async parseFile(filePath) {
  const content = readFileSync(filePath, "utf8");  // Direct fs usage
  // ...
 }
}
```

### MarkdownParser: AFTER

```javascript
// Line 1: No fs import needed
export class MarkdownParser {
 constructor(fileSystem) {
  this.fs = fileSystem;  // Injected dependency
  this.anchorPatterns = { /* ... */ };
  this.linkPatterns = { /* ... */ };
 }

 async parseFile(filePath) {
  const content = this.fs.readFileSync(filePath, "utf8");  // Use injected fs
  // ...
 }
}
```

**Problems**:
- Direct fs import creates hidden dependency
- Cannot test with custom file system implementations
- Hard to validate file system interactions

**Improvements**:
- File system injected via constructor
- All fs.*calls replaced with this.fs.*
- Explicit file system dependency contract

### FileCache: BEFORE

```javascript
// Line 1-2: Hard-coded fs/path imports
import { readdirSync, realpathSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

export class FileCache {
 constructor() {
  this.cache = new Map();
  this.duplicates = new Set();
 }

 scanDirectory(dirPath) {
  const entries = readdirSync(dirPath);  // Direct fs usage
  // ...
 }
}
```

### FileCache: AFTER

```javascript
// Line 1: No fs/path imports needed
export class FileCache {
 constructor(fileSystem) {
  this.fs = fileSystem;  // Injected dependency
  this.cache = new Map();
  this.duplicates = new Set();
 }

 scanDirectory(dirPath) {
  const entries = this.fs.readdirSync(dirPath);  // Use injected fs
  // ...
 }
}
```

**Problems**:
- Direct fs/path imports create hidden dependencies
- Cannot test with custom file system implementations
- Hard to validate caching behavior with file system interactions

**Improvements**:
- File system injected via constructor
- All fs.*calls replaced with this.fs.*
- Explicit file system dependency contract

## Required Changes by Component

**CitationValidator** (`tools/citation-manager/src/CitationValidator.js`):
- Update constructor signature to `constructor(parser, cache)`
- Remove `import { MarkdownParser } from "./MarkdownParser.js"`
- Remove `this.parser = new MarkdownParser()`
- Change `this.fileCache = null` to `this.fileCache = cache`
- Store parser parameter as `this.parser`
- All validation logic remains unchanged

**MarkdownParser** (`tools/citation-manager/src/MarkdownParser.js`):
- Update constructor signature to `constructor(fileSystem)`
- Remove `import { readFileSync } from "node:fs"`
- Add `this.fs = fileSystem` in constructor
- Replace all `readFileSync(...)` calls with `this.fs.readFileSync(...)`
- All parsing logic remains unchanged

**FileCache** (`tools/citation-manager/src/FileCache.js`):
- Update constructor signature to `constructor(fileSystem)`
- Remove `import { readdirSync, realpathSync, statSync } from "node:fs"`
- Remove `import { join, resolve } from "node:path"` (path utilities still imported from "node:path")
- Add `this.fs = fileSystem` in constructor
- Replace all `readdirSync(...)`, `realpathSync(...)`, `statSync(...)` calls with `this.fs.*` equivalents
- Keep path utilities (join, resolve) imported directly - they are pure functions, not file system operations
- All caching logic remains unchanged

## Do NOT Modify

**Critical Rules**:
- NO constructor validation logic (no parameter type checks, null checks, or error throwing)
- NO business logic changes (validation, parsing, caching algorithms stay identical)
- NO test file modifications (tests will break until Phase 4)
- NO CLI modifications (CLI will break until Phase 3)
- NO factory files created (factory implementation is Phase 2)
- NO import reorganization beyond removing direct dependency imports

**Scope Boundaries**:
- Only modify three component files: CitationValidator.js, MarkdownParser.js, FileCache.js
- Only change constructor signatures and dependency usage patterns
- Preserve all existing validation/parsing/caching logic exactly as-is
- Do not add any new methods or properties

## Validation

### Verify Changes

```bash
# Verify only three component files modified
git status --short | grep "^ M" | wc -l
# Expected: 3

# Verify no new files created
git status --short | grep "^??" | wc -l
# Expected: 0

# Verify CitationValidator constructor signature
grep "constructor(parser, cache)" tools/citation-manager/src/CitationValidator.js
# Expected: constructor(parser, cache) {

# Verify MarkdownParser uses injected fs
grep "this.fs.readFileSync" tools/citation-manager/src/MarkdownParser.js
# Expected: const content = this.fs.readFileSync(filePath, "utf8");

# Verify FileCache uses injected fs
grep "this.fs.readdirSync" tools/citation-manager/src/FileCache.js
# Expected: const entries = this.fs.readdirSync(dirPath);
```

### Expected Test Behavior

```bash
# Tests will FAIL until factory pattern implemented (expected behavior)
npm test
# Expected: Multiple test failures due to missing constructor arguments
# Example: "TypeError: Cannot read property 'parseFile' of undefined"
```

### Success Criteria

- ✅ CitationValidator accepts parser and cache via constructor parameters
- ✅ MarkdownParser accepts fileSystem via constructor parameter
- ✅ FileCache accepts fileSystem via constructor parameter
- ✅ All hard-coded dependency imports removed from components
- ✅ All dependency usage updated to use injected instances (this.parser, this.fs, this.fileCache)
- ✅ No constructor validation logic added
- ✅ No business logic changes (validation/parsing/caching unchanged)
- ✅ Only three files modified: CitationValidator.js, MarkdownParser.js, FileCache.js

## Implementation Agent Instructions

Execute the task specification above. When complete, populate the Implementation Agent Notes section below with:
- Agent model and version used
- Files created/modified
- Implementation challenges encountered
- Validation command results

### Implementation Agent Notes

> [!attention] **AI Agent:**
> Populate this section during implementation execution.

### Agent Model Used
[Record the specific AI agent model and version used]

### Debug Log References
[Reference any debug logs or traces generated]

### Completion Notes
[Notes about completion and any issues encountered]

### File List
[List all files created, modified, or affected]

### Implementation Challenges
[Document challenges encountered and resolutions]

### Validation Results
[Results of running validation commands]

## Evaluation Agent Instructions

Validate the implementation above against the task specification. Your validation must answer:

**Did implementation follow task specification exactly?**

Reference these specification sections:
- **"Required Changes by Component"**: Verify component transformations completed
- **"Success Criteria"**: Check all ✅ items pass
- **"Validation" → "Verify Changes"**: Run provided bash commands
- **"Do NOT Modify"**: Confirm no modifications outside allowed scope

Populate the Evaluation Agent Notes section below with your findings.

### Evaluation Agent Notes

> [!attention] **Evaluation Agent:**
> Populate this section during validation execution.

### Validator Model Used
[Record model name and version]

### Task Specification Compliance

**Validation Checklist**:
- [ ] Files Modified: Only specified files modified per spec?
- [ ] Scope Adherence: No scope creep beyond task specification?
- [ ] Objective Met: Task objective fully achieved?
- [ ] Critical Rules: All non-negotiable requirements followed?
- [ ] Integration Points: Proper integration with existing code?

**Scope Boundary Validation**:
- [ ] ONLY three files modified (CitationValidator.js, MarkdownParser.js, FileCache.js)?
- [ ] NO constructor validation logic added?
- [ ] NO business logic changes beyond structural refactoring?
- [ ] NO new files created?
- [ ] NO import reorganization beyond removing unused imports?
- [ ] Git diff shows ONLY specified changes (constructors, dependency usage)?

**Git-Based Validation Commands**:

```bash
# Verify file count
git status --short | grep "^ M" | wc -l  # Expected: 3

# Verify no new files
git status --short | grep "^??" | wc -l  # Expected: 0

# Verify test directory unchanged
git diff --stat tools/citation-manager/test/  # Expected: no changes
```

### Validation Outcome
[PASS or FAIL with specific deviations if FAIL]

### Remediation Required
[Specific fixes needed if FAIL, empty if PASS]
