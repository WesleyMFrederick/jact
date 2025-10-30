# US2.4: Implement `extract header` Subcommand - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement `extract header <target-file> "<header-name>" [options]` CLI subcommand that extracts specific section content from target files without requiring a source document with links

**Architecture:** CLI Orchestrator extends `extract` command with `header` subcommand. LinkObjectFactory (Level 4 helper) creates synthetic LinkObject from CLI parameters. CitationManager class extended with extractHeader() method implementing four-phase workflow: (1) create synthetic link via factory, (2) validate link via validator.validateSingleCitation(), (3) extract content via contentExtractor.extractContent(), (4) output OutgoingLinksExtractedContent JSON to stdout. Separation of concerns: factory creates, validator validates, extractor extracts, CLI coordinates.

**Tech Stack:** Node.js ESM, Commander.js for CLI, existing citation-manager components (CitationValidator, ContentExtractor, ParsedFileCache), Vitest for testing

**Commit Strategy:** Git commit after each task (Tasks 1-8) with full attribution. Final comprehensive commit represents complete US2.4 implementation.

---
## Task 0: Development Environment Setup

Use `using-git-worktrees` skill to create clean development environment

### Step 1: Commit current work

Ensure cli-extract-feature branch is clean before creating worktree

Run: `git status`
Run: `git add .`
Run: `git commit -m "wip: save current work before us2.4 worktree"`

### Step 2: Create worktree for US2.3

Use `using-git-worktrees` skill to create isolated development environment

Branch: `us2.4-extract-header-subcommand`
Worktree: `../cc-workflows-us2.4/`

---
## Task 1: LinkObjectFactory - createHeaderLink() Basic Structure

### Files
- `tools/citation-manager/src/factories/LinkObjectFactory.js` (CREATE)
- `tools/citation-manager/test/unit/factories/link-object-factory.test.js` (CREATE)

### Purpose
Create Level 4 helper factory for synthetic LinkObject construction. Validates createHeaderLink() produces valid LinkObject structure matching MarkdownParser output contract.

### Step 1: Write failing test for basic header link structure

Create `tools/citation-manager/test/unit/factories/link-object-factory.test.js`:

```javascript
import { /* Vitest test functions */ } from "vitest";
import { /* LinkObjectFactory */ } from "../../../src/factories/LinkObjectFactory.js";

describe("LinkObjectFactory - Header Link Creation", () => {
  it("should create header link with required LinkObject properties", () => {
    // Given: Target file path and header name from CLI input
    const targetPath = "/absolute/path/to/target.md";
    const headerName = "Section Header";

    // When: Create synthetic header link
    const factory = /* new LinkObjectFactory() */;
    const link = /* factory.createHeaderLink(targetPath, headerName) */;

    // Then: Link has required LinkObject structure
    // Verification: Matches parser output contract for header links
    expect(link.linkType).toBe("markdown");
    expect(link.scope).toBe("cross-document");
    expect(link.anchorType).toBe("header");
    expect(link.target.anchor).toBe(headerName);
    expect(link.validation).toBeNull(); // Pre-validation state
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- link-object-factory.test.js`

Expected: FAIL - Cannot find module 'LinkObjectFactory.js'

### Step 3: Implement LinkObjectFactory with createHeaderLink()

Create `tools/citation-manager/src/factories/LinkObjectFactory.js`:

```javascript
/**
 * LinkObjectFactory - Level 4 helper for CLI Orchestrator synthetic link creation.
 * Integration: Produces unvalidated LinkObjects matching MarkdownParser output contract.
 *
 * Pattern: Adapts CLI string inputs to complex LinkObject data structure
 * Architectural Level: C4 Level 4 (Code) - internal CLI helper, not standalone component
 */
export class LinkObjectFactory {

  /**
   * Create synthetic LinkObject for header extraction from CLI parameters.
   * Integration: Produces LinkObject matching MarkdownParser output contract.
   *
   * @param targetPath - Absolute or relative path to target markdown file
   * @param headerName - Exact header text to extract
   * @returns Unvalidated LinkObject with anchorType="header"
   */
  createHeaderLink(targetPath, headerName) {
    // --- LinkObject Construction ---
    // Integration: Match LinkObject data contract from MarkdownParser output
    // Pattern: Progressive enhancement - validation property added later by CitationValidator
    return {
      linkType: "markdown",
      scope: "cross-document",
      anchorType: "header",
      source: {
        path: {
          absolute: process.cwd()  // Decision: CLI invocation directory as source context
        }
      },
      target: {
        path: {
          raw: targetPath,
          absolute: targetPath,  // Task 2 will add path normalization
          relative: targetPath
        },
        anchor: headerName
      },
      text: headerName,
      fullMatch: `[${headerName}](${targetPath}#${headerName})`,
      line: 0,      // Pattern: Synthetic links have no source line number
      column: 0,
      extractionMarker: null,
      validation: null  // Decision: Pre-validation state, enriched later by validator
    };
  }
}
```

### Step 4: Run test to verify it passes

Run: `npm test -- link-object-factory.test.js`

Expected: PASS (1/1 tests)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 2: LinkObjectFactory - createHeaderLink() Path Normalization

### Files
- `tools/citation-manager/src/factories/LinkObjectFactory.js` (MODIFY)
- `tools/citation-manager/test/unit/factories/link-object-factory.test.js` (MODIFY)

### Purpose
Add path resolution logic to convert relative paths to absolute paths for target file location.

### Step 1: Write failing test for path normalization

Add to `link-object-factory.test.js`:

```javascript
it("should normalize relative path to absolute path", () => {
  // Given: Relative target path from CLI
  const relativePath = "./docs/target.md";

  // When: Create header link
  const factory = /* new LinkObjectFactory() */;
  const link = /* factory.createHeaderLink(relativePath, "Header") */;

  // Then: Path normalized to absolute
  // Verification: Uses Node.js path.resolve() for normalization
  expect(link.target.path.raw).toBe(relativePath);
  expect(link.target.path.absolute).toContain("target.md");
  expect(path.isAbsolute(link.target.path.absolute)).toBe(true);
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- link-object-factory.test.js`

Expected: FAIL - absolute path equals raw path (no normalization)

### Step 3: Add path normalization logic

Update `LinkObjectFactory.js`:

```javascript
import path from "node:path";

export class LinkObjectFactory {

  createHeaderLink(targetPath, headerName) {
    // --- Path Normalization ---
    // Boundary: Resolve relative paths to absolute using Node.js path module
    const absolutePath = path.resolve(targetPath);
    const relativePath = path.relative(process.cwd(), absolutePath);

    // --- LinkObject Construction ---
    return {
      linkType: "markdown",
      scope: "cross-document",
      anchorType: "header",
      source: {
        path: {
          absolute: process.cwd()
        }
      },
      target: {
        path: {
          raw: targetPath,
          absolute: absolutePath,      // Pattern: Normalized absolute path
          relative: relativePath        // Pattern: Relative from cwd
        },
        anchor: headerName
      },
      text: headerName,
      fullMatch: `[${headerName}](${targetPath}#${headerName})`,
      line: 0,
      column: 0,
      extractionMarker: null,
      validation: null
    };
  }
}
```

### Step 4: Run test to verify it passes

Run: `npm test -- link-object-factory.test.js`

Expected: PASS (2/2 tests)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 3: LinkObjectFactory - createFileLink() Basic Structure

### Files
- `tools/citation-manager/src/factories/LinkObjectFactory.js` (MODIFY)
- `tools/citation-manager/test/unit/factories/link-object-factory.test.js` (MODIFY)

### Purpose
Add createFileLink() method for full-file extraction (US2.5 prerequisite). Creates LinkObject with anchorType=null.

### Step 1: Write failing test for file link structure

Add to `link-object-factory.test.js`:

```javascript
describe("LinkObjectFactory - File Link Creation", () => {
  it("should create file link with anchorType null", () => {
    // Given: Target file path from CLI (no header specified)
    const targetPath = "/absolute/path/to/target.md";

    // When: Create synthetic file link
    const factory = /* new LinkObjectFactory() */;
    const link = /* factory.createFileLink(targetPath) */;

    // Then: Link has null anchorType for full-file extraction
    // Verification: Full-file links have no anchor
    expect(link.anchorType).toBeNull();
    expect(link.target.anchor).toBeNull();
    expect(link.linkType).toBe("markdown");
    expect(link.scope).toBe("cross-document");
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- link-object-factory.test.js`

Expected: FAIL - factory.createFileLink is not a function

### Step 3: Implement createFileLink()

Add to `LinkObjectFactory.js`:

```javascript
  /**
   * Create synthetic LinkObject for full-file extraction from CLI parameters.
   * Integration: Produces LinkObject matching MarkdownParser output contract.
   *
   * @param targetPath - Absolute or relative path to target markdown file
   * @returns Unvalidated LinkObject with anchorType=null (full-file link)
   */
  createFileLink(targetPath) {
    // --- Path Normalization ---
    // Boundary: Resolve relative paths to absolute using Node.js path module
    const absolutePath = path.resolve(targetPath);
    const relativePath = path.relative(process.cwd(), absolutePath);

    // --- LinkObject Construction ---
    // Pattern: anchorType=null indicates full-file link (no section/block)
    return {
      linkType: "markdown",
      scope: "cross-document",
      anchorType: null,  // Decision: Null anchor = full-file extraction
      source: {
        path: {
          absolute: process.cwd()
        }
      },
      target: {
        path: {
          raw: targetPath,
          absolute: absolutePath,
          relative: relativePath
        },
        anchor: null  // Decision: No anchor for full-file links
      },
      text: path.basename(targetPath),  // Pattern: Use filename as display text
      fullMatch: `[${path.basename(targetPath)}](${targetPath})`,
      line: 0,
      column: 0,
      extractionMarker: null,
      validation: null
    };
  }
```

### Step 4: Run test to verify it passes

Run: `npm test -- link-object-factory.test.js`

Expected: PASS (3/3 tests)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 4: CitationManager - extractHeader() Method

### Files
- `tools/citation-manager/src/CitationManager.js` (MODIFY)
- `tools/citation-manager/test/unit/citation-manager.test.js` (MODIFY)

### Purpose
Implement extractHeader() orchestration method with four-phase workflow: create synthetic link → validate → extract → output.

### Step 1: Write failing test for extractHeader orchestration

Add to `citation-manager.test.js`:

```javascript
describe("CitationManager - extractHeader()", () => {
  it("should orchestrate synthetic link creation, validation, and extraction", async () => {
    // Fixture: Use US2.3 plan as realistic test document
    // Research: Path to us2.3 implementation plan fixture
    const targetFile = /* resolve path to us2.3-implement-extract-links-subcommand-implement-plan.md */;
    const headerName = "Task 1: LinkObjectFactory - createHeaderLink() Basic Structure";

    // Given: CitationManager with real components
    const manager = /* new CitationManager() */;

    // When: Extract specific header from target file
    const result = /* await manager.extractHeader(targetFile, headerName, {}) */;

    // Then: Result contains extracted content for specified header
    // Verification: OutgoingLinksExtractedContent structure returned
    expect(result).toHaveProperty("extractedContentBlocks");
    expect(result).toHaveProperty("outgoingLinksReport");
    expect(result.stats.uniqueContent).toBeGreaterThan(0);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- citation-manager.test.js`

Expected: FAIL - manager.extractHeader is not a function

### Step 3: Implement extractHeader() with four-phase workflow

Add to `CitationManager` class:

```javascript
import { LinkObjectFactory } from "./factories/LinkObjectFactory.js";

class CitationManager {

  /**
   * Extract specific header content from target file using synthetic link pattern.
   * Integration: Coordinates LinkObjectFactory → CitationValidator → ContentExtractor.
   *
   * Pattern: Four-phase orchestration workflow
   * 1. Create synthetic LinkObject via factory
   * 2. Validate synthetic link via validator
   * 3. Extract content via extractor (if valid)
   * 4. Return OutgoingLinksExtractedContent structure
   *
   * @param targetFile - Path to markdown file containing header
   * @param headerName - Exact header text to extract
   * @param options - CLI options (scope)
   * @returns OutgoingLinksExtractedContent structure
   */
  async extractHeader(targetFile, headerName, options) {
    try {
      // Decision: Build file cache if --scope provided
      if (options.scope) {
        await this.fileCache.buildCache(options.scope);
      }

      // --- Phase 1: Synthetic Link Creation ---
      // Pattern: Use factory to create unvalidated LinkObject from CLI parameters
      const factory = new LinkObjectFactory();
      const syntheticLink = factory.createHeaderLink(targetFile, headerName);

      // --- Phase 2: Validation ---
      // Pattern: Validate synthetic link before extraction (fail-fast on errors)
      // Integration: CitationValidator enriches link with validation metadata
      const validatedLink = await this.validator.validateSingleCitation(syntheticLink);

      // Decision: Check validation status before extraction (error handling)
      if (validatedLink.validation.status === "error") {
        // Boundary: Error output to stderr
        console.error("Validation failed:", validatedLink.validation.error);
        if (validatedLink.validation.suggestion) {
          console.error("Suggestion:", validatedLink.validation.suggestion);
        }
        process.exitCode = 1;
        return;
      }

      // --- Phase 3: Extraction ---
      // Pattern: Extract content from validated link
      // Integration: ContentExtractor processes single-link array
      const result = await this.contentExtractor.extractContent([validatedLink], options);

      // --- Phase 4: Return ---
      // Decision: Return result for CLI to output (CLI handles stdout)
      return result;

    } catch (error) {
      // Decision: System errors use exit code 2
      console.error("ERROR:", error.message);
      process.exitCode = 2;
    }
  }
}
```

### Step 4: Run test to verify it passes

Run: `npm test -- citation-manager.test.js`

Expected: PASS (validation and extraction complete)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 5: CLI - Extract Header Command Registration

### Files
- `tools/citation-manager/src/citation-manager.js` (MODIFY)
- `tools/citation-manager/test/cli-integration/extract-header.test.js` (CREATE)

### Purpose
Register `extract header` subcommand with Commander.js. Wire CLI action handler to CitationManager.extractHeader().

### Step 1: Write failing CLI integration test

Create `tools/citation-manager/test/cli-integration/extract-header.test.js`:

```javascript
import { /* Vitest test functions */ } from "vitest";
import { /* CLI test helper */ } from "../helpers/cli-runner.js";
import path from "node:path";

describe("CLI - extract header command", () => {
  it("should extract specified header from target file", async () => {
    // Fixture: US2.3 implementation plan as realistic test document
    const targetFile = /* resolve path to us2.3 plan fixture */;
    const headerName = "Task 10: CitationManager - extractLinks() Phase 1 Validation";

    // When: Run extract header command
    const output = /* await runCLI(`extract header "${targetFile}" "${headerName}"`) */;

    // Then: Output contains OutgoingLinksExtractedContent JSON
    // Verification: Valid JSON with expected structure
    const result = JSON.parse(output);
    expect(result).toHaveProperty("extractedContentBlocks");
    expect(result).toHaveProperty("outgoingLinksReport");

    // Verification: Content extracted for specified header
    expect(result.stats.uniqueContent).toBe(1);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- extract-header.test.js`

Expected: FAIL - Unknown command 'extract header'

### Step 3: Register extract header command

Add to `citation-manager.js` (after extract links command):

```javascript
program
  .command("extract header")
  .description("Extract specific header content from target file")
  .argument("<target-file>", "Markdown file to extract from")
  .argument("<header-name>", "Exact header text to extract")
  .option("--scope <folder>", "Limit file resolution scope")
  .action(async (targetFile, headerName, options) => {
    // Integration: Create CitationManager instance
    const manager = new CitationManager();

    try {
      // Pattern: Delegate to CitationManager orchestration method
      const result = await manager.extractHeader(targetFile, headerName, options);

      // Decision: Output JSON to stdout if extraction succeeded
      if (result) {
        // Boundary: JSON output to stdout
        console.log(JSON.stringify(result, null, 2));
        process.exitCode = 0;
      }
      // Note: Error exit codes set by extractHeader() method

    } catch (error) {
      // Decision: Unexpected errors use exit code 2
      console.error("ERROR:", error.message);
      process.exitCode = 2;
    }
  });
```

### Step 4: Run test to verify it passes

Run: `npm test -- extract-header.test.js`

Expected: PASS (1/1 tests)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 6: CLI Integration Tests - Error Scenarios

### Files
- `tools/citation-manager/test/cli-integration/extract-header.test.js` (MODIFY)

### Purpose
Add integration tests for error scenarios: header not found, validation errors, exit codes.

### Step 1: Write failing test for header not found

Add to `extract-header.test.js`:

```javascript
it("should exit with code 1 when header not found", async () => {
  // Fixture: US2.3 plan
  const targetFile = /* resolve fixture path */;
  const invalidHeader = "Nonexistent Header Name";

  // When: Attempt to extract non-existent header
  // Then: Command exits with code 1
  // Research: Vitest patterns for asserting exit codes
  await expect(
    /* runCLI(`extract header "${targetFile}" "${invalidHeader}"`) */
  ).rejects.toThrow(); // Exit code 1 causes rejection
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- extract-header.test.js`

Expected: FAIL (test structure needs implementation)

### Step 3: Implement test with exit code validation

Update test:

```javascript
it("should exit with code 1 when header not found", async () => {
  // Fixture: US2.3 plan
  const targetFile = /* resolve us2.3 plan path */;
  const invalidHeader = "Nonexistent Header Name";

  // When: Extract non-existent header
  let exitCode;
  try {
    /* await runCLI(`extract header "${targetFile}" "${invalidHeader}"`) */;
  } catch (error) {
    // Pattern: Capture exit code from error
    exitCode = /* extract from error */;
  }

  // Then: Exit code 1 (validation failure)
  // Verification: US2.4 AC7 exit code behavior
  expect(exitCode).toBe(1);
});

it("should display validation error with suggestion", async () => {
  // Given: Target file with headers
  const targetFile = /* resolve fixture */;
  const similarHeader = "Task 1: LinkObjectFactory"; // Partial match

  // When: Extract header with typo
  let stderr;
  try {
    /* await runCLI(`extract header "${targetFile}" "${similarHeader}"`) */;
  } catch (error) {
    stderr = /* extract stderr from error */;
  }

  // Then: Error message with suggestion shown
  // Verification: US2.4 AC5 diagnostic information
  expect(stderr).toContain("Validation failed");
  expect(stderr).toContain("Suggestion");
});
```

### Step 4: Run test to verify it passes

Run: `npm test -- extract-header.test.js`

Expected: PASS (3/3 tests)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 7: CLI Help Documentation

### Files
- `tools/citation-manager/src/citation-manager.js` (MODIFY)

### Purpose
Add help documentation for extract header subcommand at both top-level and subcommand levels.

### Step 1: Write failing test for help output

Add to `extract-header.test.js`:

```javascript
describe("CLI Help Documentation", () => {
  it("should show extract header in top-level help", async () => {
    // When: Request top-level extract help
    const output = /* await runCLI("extract --help") */;

    // Then: Help lists header subcommand
    // Verification: US2.4 AC10 top-level help
    expect(output).toContain("header");
    expect(output).toContain("Extract specific header content");
  });

  it("should show detailed help for extract header subcommand", async () => {
    // When: Request subcommand help
    const output = /* await runCLI("extract header --help") */;

    // Then: Detailed usage and examples shown
    // Verification: US2.4 AC10 subcommand help
    expect(output).toContain("Usage:");
    expect(output).toContain("<target-file>");
    expect(output).toContain("<header-name>");
    expect(output).toContain("--scope");
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- extract-header.test.js`

Expected: FAIL (help text missing)

### Step 3: Add detailed help text

Update `citation-manager.js`:

```javascript
program
  .command("extract header")
  .description("Extract specific header content from target file")
  .argument("<target-file>", "Markdown file to extract from")
  .argument("<header-name>", "Exact header text to extract")
  .option("--scope <folder>", "Limit file resolution scope")
  .addHelpText("after", `
Examples:
  # Extract specific section from design document
  $ citation-manager extract header plan.md "Task 1: Implementation"

  # Extract with scope limiting
  $ citation-manager extract header docs/guide.md "Overview" --scope ./docs

Exit Codes:
  0  Header extracted successfully
  1  Header not found or validation failed
  2  System error (file not found, permission denied)

Notes:
  - Header name must match exactly (case-sensitive)
  - Extracts complete section until next same-level heading
  - Output is JSON OutgoingLinksExtractedContent structure
  `)
  .action(async (targetFile, headerName, options) => {
    // ... existing action handler
  });
```

### Step 4: Run test to verify it passes

Run: `npm test -- extract-header.test.js`

Expected: PASS (5/5 tests)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 8: Regression Validation

### Files
- None (run existing tests)

### Purpose
Verify zero regressions to existing functionality (validate, extract links commands).

### Step 1: Run full test suite

Run: `npm test`

Expected: All 267+ existing tests PASS, new tests PASS

### Step 2: Verify test count increase

Verify:
- LinkObjectFactory unit tests: +3 tests
- CitationManager unit tests: +1 test
- CLI integration tests: +5 tests
- Total new tests: +9 tests
- Total tests: 276+ (267 baseline + 9 new)

### Step 3: Verify zero regressions

Confirm:
- All validate command tests pass
- All extract links command tests pass
- All ContentExtractor tests pass
- All CitationValidator tests pass

### Step 4: Create commit

Use `create-git-commit` skill

---

## Verification Checklist

Before marking US2.4 complete, verify:

- [ ] LinkObjectFactory created with createHeaderLink() and createFileLink()
- [ ] Path normalization working for relative and absolute paths
- [ ] CitationManager.extractHeader() implements four-phase workflow
- [ ] CLI extract header command registered with Commander.js
- [ ] --scope option functional for file resolution
- [ ] Validation errors reported to stderr with suggestions
- [ ] Exit code 0 on success, 1 on validation failure, 2 on system error
- [ ] Help documentation at both top-level and subcommand levels
- [ ] Integration tests using US2.3 plan as realistic fixture
- [ ] Full test suite passing with zero regressions (276+ tests)

All checkboxes must be checked before US2.4 completion.

---

## Related Documentation

- [US2.4 User Story](../content-aggregation-prd.md#Story%202.4%20Implement%20extract%20header%20Subcommand)
- [CLI Orchestrator Implementation Guide](../../component-guides/CLI%20Orchestrator%20Implementation%20Guide.md)
- [Epic 2 Whiteboard - LinkObjectFactory](../content-aggregation-prd.md#LinkObjectFactory%20(Level%204%20Code%20Detail%20of%20CLI%20Orchestrator))
- [Content Extractor Implementation Guide](../../component-guides/Content%20Extractor%20Implementation%20Guide.md)
- [CitationValidator Implementation Guide](../../component-guides/CitationValidator%20Implementation%20Guide.md)

**Test Fixture Used:**
- `/Users/wesleyfrederick/Documents/ObsidianVaultNew/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/design-docs/features/20251003-content-aggregation/user-stories/us2.3-implement-extract-links-subcommand/us2.3-implement-extract-links-subcommand-implement-plan.md`
