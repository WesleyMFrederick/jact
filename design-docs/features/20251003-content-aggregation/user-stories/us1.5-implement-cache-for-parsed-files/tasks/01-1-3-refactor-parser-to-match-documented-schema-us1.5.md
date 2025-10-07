---
story: "User Story 1.5: Implement a Cache for Parsed File Objects"
epic: "Citation Manager Test Migration & Content Aggregation"
phase: "Phase 1: Parser Output Contract Validation & Documentation"
task-id: "1.3"
task-anchor: ^US1-5T1-3
wave: "1e"
implementation-agent: "code-developer-agent"
evaluation-agent: "application-tech-lead"
status: "ready"
---

# Task 1.3: Refactor Parser to Match Documented Schema (GREEN Phase)

**Objective**: Refactor MarkdownParser `extractLinks()` and `extractAnchors()` methods to return the Implementation Guide schema. Make Task 1.2 tests PASS while maintaining zero regressions in existing tests.

**Reference**: [Task ^US1-5T1-3](../us1.5-implement-cache-for-parsed-files.md#^US1-5T1-3)

---

## Reference Schema Documentation

The following schema definitions are from the **Markdown Parser Implementation Guide** and represent the **target state** for MarkdownParser refactoring:

### LinkObject Schema (Target State)

```json
{
  "title": "Link Object",
  "type": "object",
  "properties": {
    "linkType": { "type": "string", "enum": [ "markdown", "wiki" ] },
    "scope": { "type": "string", "enum": [ "internal", "cross-document" ] },
    "anchorType": { "type": ["string", "null"], "enum": [ "header", "block", null ] },
    "source": {
      "type": "object",
      "properties": {
        "path": {
          "type": "object",
          "properties": {
            "absolute": { "type": "string" }
          },
          "required": ["absolute"]
        }
      },
      "required": ["path"]
    },
    "target": {
      "type": "object",
      "properties": {
        "path": {
          "type": "object",
          "properties": {
            "raw": { "type": ["string", "null"] },
            "absolute": { "type": ["string", "null"] },
            "relative": { "type": ["string", "null"] }
          },
          "required": ["raw", "absolute", "relative"]
        },
        "anchor": { "type": ["string", "null"] }
      },
      "required": ["path", "anchor"]
    },
    "text": { "type": ["string", "null"] },
    "fullMatch": { "type": "string" },
    "line": { "type": "integer", "minimum": 1 },
    "column": { "type": "integer", "minimum": 1 }
  },
  "required": [ "linkType", "scope", "anchorType", "source", "target", "text", "fullMatch", "line", "column" ]
}
```

### AnchorObject Schema (Target State)

```json
{
  "title": "Anchor Object",
  "type": "object",
  "properties": {
    "anchorType": { "type": "string", "enum": [ "header", "block" ] },
    "id": { "type": "string" },
    "rawText": { "type": ["string", "null"] },
    "fullMatch": { "type": "string" },
    "line": { "type": "integer", "minimum": 1 },
    "column": { "type": "integer", "minimum": 1 }
  },
  "required": [ "anchorType", "id", "rawText", "fullMatch", "line", "column" ]
}
```

---

## Current State → Required State

### BEFORE: Parser Returns Current Implementation Schema

**Current MarkdownParser.extractLinks()** (`tools/citation-manager/src/MarkdownParser.js`):

```javascript
// Returns current schema (type, text, file, anchor, fullMatch, line, column)
extractLinks(content) {
  const links = [];
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const linkPattern = /\[([^\]]+)\]\(([^)#]+\.md)(#([^)]+))?\)/g;
    let match = linkPattern.exec(line);
    while (match !== null) {
      const text = match[1];
      const file = match[2];
      const anchor = match[4] || null;

      links.push({
        type: "cross-document",        // ❌ Should be linkType
        text: text,
        file: file,                    // ❌ Should be target.path.{raw,absolute,relative}
        anchor: anchor,                // ❌ Should be target.anchor
        fullMatch: match[0],
        line: index + 1,
        column: match.index,
      });
      match = linkPattern.exec(line);
    }
  });

  return links;
}
```

**Current MarkdownParser.extractAnchors()** (`tools/citation-manager/src/MarkdownParser.js`):

```javascript
// Returns current schema (type, anchor, text?, line, column?, level?, rawText?)
extractAnchors(content) {
  const anchors = [];
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    // Obsidian block references
    const obsidianBlockRegex = /\^([a-zA-Z0-9\-_]+)$/;
    const obsidianMatch = line.match(obsidianBlockRegex);
    if (obsidianMatch) {
      anchors.push({
        type: "obsidian-block-ref",    // ❌ Should be anchorType: "block"
        anchor: obsidianMatch[1],      // ❌ Should be id
        fullMatch: obsidianMatch[0],
        line: index + 1,
        column: line.lastIndexOf(obsidianMatch[0]),
      });
    }

    // Standard headers
    const headerRegex = /^(#+)\s+(.+)$/;
    const headerMatch = line.match(headerRegex);
    if (headerMatch) {
      const headerText = headerMatch[2];
      anchors.push({
        type: "header",                // ❌ Should be anchorType
        anchor: headerText,            // ❌ Should be id (with proper encoding)
        text: headerText,              // ❌ Should be rawText
        rawText: headerText,
        level: headerMatch[1].length,  // ❌ Not in documented schema
        line: index + 1,
      });
      // Missing column property
    }
  });

  return anchors;
}
```

**Problems**:
- ❌ Links use `type` instead of `linkType`
- ❌ Links use flat `file` instead of nested `target.path.{raw, absolute, relative}`
- ❌ Links missing `source.path.absolute`, `scope`, `anchorType` properties
- ❌ Anchors use `type` instead of `anchorType`
- ❌ Anchors use `anchor` instead of `id`
- ❌ Anchors inconsistently populate `column` (missing for headers)
- ❌ Anchors include non-schema `level` property (header-specific metadata)
- ❌ Task 1.2 tests FAIL because schema doesn't match Implementation Guide

### AFTER: Parser Returns Implementation Guide Schema

**Refactored MarkdownParser.extractLinks()** (`tools/citation-manager/src/MarkdownParser.js`):

```javascript
// Returns Implementation Guide schema
extractLinks(content) {
  const links = [];
  const lines = content.split("\n");
  const sourceAbsolutePath = this.currentSourcePath; // Set in parseFile()

  lines.forEach((line, index) => {
    // Cross-document links with .md extension
    const linkPattern = /\[([^\]]+)\]\(([^)#]+\.md)(#([^)]+))?\)/g;
    let match = linkPattern.exec(line);
    while (match !== null) {
      const text = match[1];
      const rawPath = match[2];
      const anchor = match[4] || null;

      // Determine link characteristics
      const linkType = "markdown";
      const scope = rawPath ? "cross-document" : "internal";
      const anchorType = anchor ? this.determineAnchorType(anchor) : null;

      // Resolve paths
      const absolutePath = rawPath ? this.resolvePath(rawPath, sourceAbsolutePath) : null;
      const relativePath = absolutePath
        ? this.path.relative(this.path.dirname(sourceAbsolutePath), absolutePath)
        : null;

      links.push({
        linkType: linkType,
        scope: scope,
        anchorType: anchorType,
        source: {
          path: {
            absolute: sourceAbsolutePath
          }
        },
        target: {
          path: {
            raw: rawPath,
            absolute: absolutePath,
            relative: relativePath
          },
          anchor: anchor
        },
        text: text,
        fullMatch: match[0],
        line: index + 1,
        column: match.index
      });
      match = linkPattern.exec(line);
    }

    // Wiki-style links: [[path#anchor|text]]
    const wikiPattern = /\[\[([^#\]]+\.md)?(#([^\]|]+))?\|([^\]]+)\]\]/g;
    match = wikiPattern.exec(line);
    while (match !== null) {
      const rawPath = match[1] || null;
      const anchor = match[3] || null;
      const text = match[4];

      const linkType = "wiki";
      const scope = rawPath ? "cross-document" : "internal";
      const anchorType = anchor ? this.determineAnchorType(anchor) : null;

      const absolutePath = rawPath ? this.resolvePath(rawPath, sourceAbsolutePath) : null;
      const relativePath = absolutePath
        ? this.path.relative(this.path.dirname(sourceAbsolutePath), absolutePath)
        : null;

      links.push({
        linkType: linkType,
        scope: scope,
        anchorType: anchorType,
        source: {
          path: {
            absolute: sourceAbsolutePath
          }
        },
        target: {
          path: {
            raw: rawPath,
            absolute: absolutePath,
            relative: relativePath
          },
          anchor: anchor
        },
        text: text,
        fullMatch: match[0],
        line: index + 1,
        column: match.index
      });
      match = wikiPattern.exec(line);
    }
  });

  return links;
}

// Helper method to determine anchor type from anchor string
determineAnchorType(anchorString) {
  if (!anchorString) return null;

  // Block references start with ^ or match ^alphanumeric pattern
  if (anchorString.startsWith('^') || /^\^[a-zA-Z0-9\-_]+$/.test(anchorString)) {
    return "block";
  }

  // Everything else is a header reference
  return "header";
}

// Helper method to resolve relative paths to absolute paths
resolvePath(rawPath, sourceAbsolutePath) {
  if (this.path.isAbsolute(rawPath)) {
    return rawPath;
  }

  const sourceDir = this.path.dirname(sourceAbsolutePath);
  return this.path.resolve(sourceDir, rawPath);
}
```

**Refactored MarkdownParser.extractAnchors()** (`tools/citation-manager/src/MarkdownParser.js`):

```javascript
// Returns Implementation Guide schema
extractAnchors(content) {
  const anchors = [];
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    // Obsidian block references (end-of-line format: ^anchor-name)
    const obsidianBlockRegex = /\^([a-zA-Z0-9\-_]+)$/;
    const obsidianMatch = line.match(obsidianBlockRegex);
    if (obsidianMatch) {
      anchors.push({
        anchorType: "block",           // ✅ Updated from "type"
        id: obsidianMatch[1],          // ✅ Updated from "anchor"
        rawText: null,                 // ✅ Blocks have no display text
        fullMatch: obsidianMatch[0],
        line: index + 1,
        column: line.lastIndexOf(obsidianMatch[0]) // ✅ Now included
      });
    }

    // Caret syntax anchors (legacy format)
    const caretRegex = /\^([A-Za-z0-9-]+)/g;
    let match = caretRegex.exec(line);
    while (match !== null) {
      const isObsidianBlock = line.endsWith(match[0]);
      if (!isObsidianBlock) {
        anchors.push({
          anchorType: "block",         // ✅ Caret anchors are block type
          id: match[1],                // ✅ Updated from "anchor"
          rawText: null,
          fullMatch: match[0],
          line: index + 1,
          column: match.index          // ✅ Now included
        });
      }
      match = caretRegex.exec(line);
    }

    // Standard header anchors
    const headerRegex = /^(#+)\s+(.+)$/;
    const headerMatch = line.match(headerRegex);
    if (headerMatch) {
      const headerText = headerMatch[2];

      // Always use raw text as anchor for all headers
      anchors.push({
        anchorType: "header",          // ✅ Updated from "type"
        id: headerText,                // ✅ Updated from "anchor", use raw text as ID
        rawText: headerText,           // ✅ Store display text
        fullMatch: headerMatch[0],
        line: index + 1,
        column: 0                      // ✅ Now included (headers start at column 0)
      });

      // Also add Obsidian-compatible anchor (drops colons, URL-encodes spaces)
      const obsidianAnchor = headerText
        .replace(/:/g, "")
        .replace(/\s+/g, "%20");

      if (obsidianAnchor !== headerText) {
        anchors.push({
          anchorType: "header",
          id: obsidianAnchor,          // ✅ Obsidian-encoded variant
          rawText: headerText,
          fullMatch: headerMatch[0],
          line: index + 1,
          column: 0
        });
      }
    }

    // Emphasis-marked anchors: ==**text**==
    const emphasisRegex = /==\*\*([^*]+)\*\*==/g;
    match = emphasisRegex.exec(line);
    while (match !== null) {
      anchors.push({
        anchorType: "block",           // ✅ Emphasis markers are block-style
        id: `==**${match[1]}**==`,     // ✅ Use full marker as ID
        rawText: match[1],             // ✅ Store inner text
        fullMatch: match[0],
        line: index + 1,
        column: match.index            // ✅ Now included
      });
      match = emphasisRegex.exec(line);
    }
  });

  return anchors;
}
```

**Improvements**:
- ✅ Links use `linkType` (markdown|wiki) instead of `type`
- ✅ Links use `scope` (internal|cross-document) to indicate link scope
- ✅ Links use `anchorType` (header|block|null) to categorize anchor type
- ✅ Links use nested `source.path.absolute` structure
- ✅ Links use nested `target.path.{raw, absolute, relative}` structure
- ✅ Anchors use `anchorType` (header|block) instead of `type`
- ✅ Anchors use `id` instead of `anchor`
- ✅ Anchors consistently populate `column` for all anchor types
- ✅ Anchors remove non-schema `level` property
- ✅ Task 1.2 tests PASS (schema matches Implementation Guide)

### Required Changes by Component

**MarkdownParser** (`src/MarkdownParser.js` - MODIFY):
- Update `parseFile()` to store `sourcePath` in instance variable for use in `extractLinks()`
- Refactor `extractLinks()` to return LinkObject schema with linkType, scope, anchorType, source, target
- Add helper method `determineAnchorType(anchorString)` to classify anchors as "header" or "block"
- Add helper method `resolvePath(rawPath, sourceAbsolutePath)` to resolve relative paths
- Refactor `extractAnchors()` to return AnchorObject schema with anchorType, id, rawText
- Ensure all anchor types consistently populate `column` property
- Remove non-schema `level` property from header anchors

**CitationValidator** (`src/CitationValidator.js` - MODIFY):
- Update all references from `link.type` to `link.linkType`
- Update all references from `link.file` to `link.target.path.absolute`
- Update all references from `link.anchor` to `link.target.anchor`
- Update all references from `anchor.type` to `anchor.anchorType`
- Update all references from `anchor.anchor` to `anchor.id`
- Verify validation logic works correctly with nested path structures

**Existing Tests** (`test/*.test.js` - MODIFY):
- Update test assertions from `link.type` to `link.linkType`
- Update test assertions from `link.file` to `link.target.path.absolute` (or `.raw` or `.relative` as needed)
- Update test assertions from `anchor.type` to `anchor.anchorType`
- Update test assertions from `anchor.anchor` to `anchor.id`
- Ensure all tests pass with refactored schema

**Do NOT Modify**:
❌ Test fixtures (read-only)
❌ Factory functions (transparent to schema changes)
❌ CLI orchestrator (transparent to schema changes)
❌ FileCache (independent component)

---

## Scope Boundaries

### ❌ Explicitly OUT OF SCOPE

**Adding new parsing features**:

```javascript
// ❌ VIOLATION: Don't add new link types or extraction methods
extractLinks(content) {
  // Adding extraction for image links, footnotes, etc. - NOT IN SCOPE
}
```

**Changing validation logic**:

```javascript
// ❌ VIOLATION: Don't change how validation works
// Only update property names, not validation algorithms
```

**Modifying FileCache integration**:

```javascript
// ❌ VIOLATION: FileCache integration stays the same
// Don't change how short filenames are resolved
```

### Validation Commands

```bash
# Verify implementation files modified
git status --short
# Expected:
#   M tools/citation-manager/src/MarkdownParser.js
#   M tools/citation-manager/src/CitationValidator.js
#   M tools/citation-manager/test/*.test.js (existing tests updated)

# Run Task 1.2 schema tests (should PASS now)
npm test -- parser-output-contract
# Expected: All tests pass, validating Implementation Guide schema

# Run full test suite (zero regressions)
npm test
# Expected: All tests pass (50+ tests)

# Verify no test fixtures modified
git diff tools/citation-manager/test/fixtures/
# Expected: empty (no changes to fixtures)
```

---

## Validation

### Verify Changes

```bash
# Run Task 1.2 schema tests (must PASS)
npm test -- parser-output-contract
# Expected: All tests pass
#   ✓ should populate links array with documented LinkObject schema
#   ✓ should populate anchors array with documented AnchorObject schema
#   ✓ should correctly populate path variations (raw, absolute, relative)
#   ✓ should validate enum constraints for linkType, scope, anchorType

# Run full test suite (zero regressions)
npm test
# Expected: All tests pass, no failures

# Verify MarkdownParser schema output
node -e "
  import('./tools/citation-manager/src/MarkdownParser.js').then(m => {
    const parser = new m.MarkdownParser(require('fs'));
    const result = parser.parseFile('test/fixtures/valid-citations.md');
    console.log('Link schema:', Object.keys(result.links[0]));
    console.log('Anchor schema:', Object.keys(result.anchors[0]));
  });
"
# Expected:
#   Link schema: linkType,scope,anchorType,source,target,text,fullMatch,line,column
#   Anchor schema: anchorType,id,rawText,fullMatch,line,column
```

### Expected Test Behavior

```bash
# Task 1.2 tests should now PASS
npm test -- parser-output-contract

# Sample expected output:
✓ MarkdownParser Output Contract - Link Schema
  ✓ should populate links array with documented LinkObject schema
  ✓ should correctly populate path variations (raw, absolute, relative)
✓ MarkdownParser Output Contract - Anchor Schema
  ✓ should populate anchors array with documented AnchorObject schema

Test Files  1 passed (1)
Tests  8 passed (8)
```

### Success Criteria

✅ **Schema Refactoring Complete**: MarkdownParser returns Implementation Guide LinkObject and AnchorObject schemas
✅ **Task 1.2 Tests Pass**: All parser-output-contract.test.js tests pass
✅ **Zero Regressions**: Full test suite passes (50+ tests)
✅ **Property Naming Updated**: All `type` → `linkType`/`anchorType`, `file` → `target.path`, `anchor` → `id`/`target.anchor`
✅ **Path Structures Implemented**: Links populate source.path.absolute, target.path.{raw,absolute,relative}
✅ **Consistent Column Population**: All anchor types populate column property
✅ **Validator Updated**: CitationValidator uses new schema properties
✅ **Scope Adherence**: Only schema changes, no new features or validation logic changes

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
- **"Required Changes by Component"**: Verify MarkdownParser refactored, CitationValidator updated, tests updated
- **"Success Criteria"**: Check all ✅ items pass
- **"Validation" → "Verify Changes"**: Run provided bash commands
- **"Scope Boundaries"**: Confirm no new features, only schema changes

Populate the Evaluation Agent Notes section below with your findings.

### Evaluation Agent Notes

> [!attention] **Evaluation Agent:**
> Populate this section during validation execution.

### Validator Model Used
[Record model name and version]

### Task Specification Compliance
[Compare implementation against exact task spec from story]

**Validation Checklist**:
- [ ] Files Modified: MarkdownParser.js, CitationValidator.js, test files updated?
- [ ] Scope Adherence: Only schema changes, no new features?
- [ ] Objective Met: Parser returns Implementation Guide schema?
- [ ] Task 1.2 Tests Pass: All parser-output-contract.test.js tests pass?
- [ ] Zero Regressions: Full test suite passes (50+ tests)?
- [ ] Property Naming: All type/file/anchor properties renamed correctly?
- [ ] Path Structures: Links populate source/target path structures?
- [ ] Validator Integration: CitationValidator uses new schema?

**Scope Boundary Validation**:
- [ ] No new link types or parsing features added
- [ ] No validation logic changes (only property name updates)
- [ ] No FileCache integration changes
- [ ] No test fixture modifications

### Validation Outcome
[PASS or FAIL with specific deviations if FAIL]

### Remediation Required
[Specific fixes needed if FAIL, empty if PASS]
