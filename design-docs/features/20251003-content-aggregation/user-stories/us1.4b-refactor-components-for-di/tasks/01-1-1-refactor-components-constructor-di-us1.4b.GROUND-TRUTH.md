---
story: "User Story 1.4b: Refactor citation-manager Components for Dependency Injection"
epic: "Citation Manager Test Migration & Content Aggregation"
phase: "Phase 1: Component Constructor Refactoring"
task-id: "1.1"
task-anchor: "^US1-4bT1-1"
wave: "1a"
implementation-agent: "code-developer-agent"
evaluation-agent: "application-tech-lead"
status: "ready"
---

# Task 1.1: Refactor Components for Constructor DI

**Objective**: Refactor CitationValidator, MarkdownParser, and FileCache to accept all dependencies via constructor parameters instead of creating them internally.

_Reference_: [Task 1.1 in Story US1.4b](../us1.4b-refactor-components-for-di.md#^US1-4bT1-1)

---

## Current State → Required State

### BEFORE: Hard-Coded Dependencies

**CitationValidator.js** (lines 1-31):

```javascript
import { existsSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { MarkdownParser } from "./MarkdownParser.js";

export class CitationValidator {
 constructor() {
  this.parser = new MarkdownParser();  // ❌ Hard-coded dependency
  this.fileCache = null;
  // ... validation rules
 }
 // ...
}
```

**MarkdownParser.js** (lines 1-19):

```javascript
import { readFileSync } from "node:fs";
import { marked } from "marked";

export class MarkdownParser {
 constructor() {
  // ❌ Direct imports, no injection
  this.anchorPatterns = { /* ... */ };
  this.linkPatterns = { /* ... */ };
 }

 async parseFile(filePath) {
  const content = readFileSync(filePath, "utf8");  // ❌ Direct fs usage
  const tokens = marked.lexer(content);  // ❌ Direct marked usage
  // ...
 }
}
```

**FileCache.js** (lines 1-8):

```javascript
import { readdirSync, realpathSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

export class FileCache {
 constructor() {
  // ❌ Direct imports, no injection
  this.cache = new Map();
  this.duplicates = new Set();
 }
}
```

### AFTER: Constructor Dependency Injection

**CitationValidator.js**:

```javascript
import { existsSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

export class CitationValidator {
 constructor(parser, cache) {  // ✅ Injected dependencies
  this.parser = parser;
  this.fileCache = cache;

  // Validation rules remain unchanged
  this.patterns = { /* ... */ };
 }
 // All methods unchanged - just use this.parser
}
```

**MarkdownParser.js**:

```javascript
import { marked } from "marked";

export class MarkdownParser {
 constructor(fileSystem) {  // ✅ Injected fs dependency
  this.fs = fileSystem;

  // Pattern definitions unchanged
  this.anchorPatterns = { /* ... */ };
  this.linkPatterns = { /* ... */ };
 }

 async parseFile(filePath) {
  const content = this.fs.readFileSync(filePath, "utf8");  // ✅ Use injected fs
  const tokens = marked.lexer(content);
  // ...
 }
}
```

**FileCache.js**:

```javascript
export class FileCache {
 constructor(fileSystem, pathModule) {  // ✅ Injected dependencies
  this.fs = fileSystem;
  this.path = pathModule;
  this.cache = new Map();
  this.duplicates = new Set();
 }

 buildCache(scopeFolder) {
  this.cache.clear();
  this.duplicates.clear();

  const absoluteScopeFolder = this.path.resolve(scopeFolder);  // ✅ Use injected path
  let targetScanFolder;

  try {
   targetScanFolder = this.fs.realpathSync(absoluteScopeFolder);  // ✅ Use injected fs
  } catch (_error) {
   targetScanFolder = absoluteScopeFolder;
  }
  // ...
 }
}
```

### Problems with Current State

- **Hard-Coded Dependencies**: Components create dependencies internally, making them tightly coupled
- **Untestable Isolation**: Cannot inject real dependencies for integration testing
- **Violates Workspace Principles**: Deviates from workspace "Explicit Dependencies" and "Real Systems, Fake Fixtures" principles
- **Prevents DI Pattern**: Cannot use factory pattern or constructor injection per workspace architecture

### Improvements in Required State

- **Explicit Dependencies**: All dependencies passed via constructor parameters
- **Testable Components**: Can inject real fs/path/parser for integration tests
- **Workspace Alignment**: Follows workspace DI architecture principles
- **Factory-Ready**: Enables factory pattern implementation in Phase 2

### Required Changes by Component

**CitationValidator** (`tools/citation-manager/src/CitationValidator.js`):
- Accept `parser` and `cache` as constructor parameters
- Remove internal `new MarkdownParser()` instantiation
- Remove unused MarkdownParser import

**MarkdownParser** (`tools/citation-manager/src/MarkdownParser.js`):
- Accept `fileSystem` as constructor parameter
- Replace all direct `fs` calls with `this.fs` calls
- Remove unused fs import

**FileCache** (`tools/citation-manager/src/FileCache.js`):
- Accept `fileSystem` and `pathModule` as constructor parameters
- Replace all direct `fs.*` calls with `this.fs.*`
- Replace all direct `path.*` calls with `this.path.*`
- Remove unused fs and path imports

**Do NOT modify**:
- Validation/parsing/caching logic (business logic stays identical)
- Method signatures (except constructors)
- Pattern definitions, regex patterns, validation rules
- File structure or organization
- Any files outside the three components listed above

---

## Validation

### Verify Changes

After refactoring, verify component instantiation requires dependencies:

```bash
# Should show constructor signatures with parameters
grep -n "constructor(" tools/citation-manager/src/CitationValidator.js
grep -n "constructor(" tools/citation-manager/src/MarkdownParser.js
grep -n "constructor(" tools/citation-manager/src/FileCache.js
```

**Expected Output**:

```text
CitationValidator.js:6: constructor(parser, cache) {
MarkdownParser.js:5: constructor(fileSystem) {
FileCache.js:5: constructor(fileSystem, pathModule) {
```

Verify no hard-coded dependency instantiation remains:

```bash
# Should return NO matches
grep -n "new MarkdownParser()" tools/citation-manager/src/CitationValidator.js
grep -n "readFileSync" tools/citation-manager/src/MarkdownParser.js | grep -v "this.fs"
```

### Expected Test Behavior

After refactoring, existing tests will FAIL because they use old constructors. This is EXPECTED and will be fixed in Phase 4.

**Current Tests (will break)**:

```javascript
// Old instantiation - will fail after refactoring
const validator = new CitationValidator();
```

**Required After Refactoring**:

```javascript
// Must provide dependencies
const parser = new MarkdownParser(fs);
const cache = new FileCache(fs, path);
const validator = new CitationValidator(parser, cache);
```

### Success Criteria

✅ CitationValidator constructor accepts `(parser, cache)` parameters
✅ MarkdownParser constructor accepts `(fileSystem)` parameter
✅ FileCache constructor accepts `(fileSystem, pathModule)` parameters
✅ No components create dependencies internally
✅ All `fs.*` calls use `this.fs.*` in MarkdownParser and FileCache
✅ All `path.*` calls use `this.path.*` in FileCache
✅ CitationValidator uses injected `this.parser` (no new MarkdownParser())
✅ All validation/parsing/caching logic unchanged

---

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

---

## Evaluation Agent Instructions

Validate the implementation above against the task specification. Your validation must answer:

**Did implementation follow task specification exactly?**

Reference these specification sections:
- **"Required Changes by Component"**: Verify all three components refactored correctly
- **"Success Criteria"**: Check all ✅ items pass
- **"Validation" → "Verify Changes"**: Run provided bash commands
- **"Scope Boundaries"**: Confirm no modifications outside allowed scope

Populate the Evaluation Agent Notes section below with your findings.

### Evaluation Agent Notes

> [!attention] **Evaluation Agent:**
> Populate this section during validation execution.

### Validator Model Used
[Record model name and version]

### Task Specification Compliance
[Compare implementation against exact task spec from story]

**Validation Checklist**:
- [ ] Files Modified: Only CitationValidator.js, MarkdownParser.js, FileCache.js modified?
- [ ] Scope Adherence: No scope creep beyond constructor refactoring?
- [ ] Objective Met: All three components accept dependencies via constructor?
- [ ] Critical Rules: No internal dependency creation remains?
- [ ] Integration Points: Components use injected dependencies correctly?

**Scope Boundary Validation**:
- [ ] ONLY 3 files modified (no test files, no factory files)?
- [ ] NO constructor validation logic added?
- [ ] NO business logic changes beyond dependency injection?
- [ ] NO new files created?
- [ ] NO import reorganization beyond removing unused imports?
- [ ] Git diff shows ONLY constructor and dependency usage changes?

### Validation Outcome
[PASS or FAIL with specific deviations if FAIL]

### Remediation Required
[Specific fixes needed if FAIL, empty if PASS]
