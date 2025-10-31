# US2.5 `extract file` Subcommand Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Implement `extract file` subcommand enabling direct extraction of complete file content without requiring a source document containing links.

**Architecture:** Reuses synthetic link pattern from US2.4 with `anchorType: null` to signal full-file extraction. Four-phase workflow: (1) Create synthetic LinkObject via LinkObjectFactory, (2) Validate via CitationValidator, (3) Extract via ContentExtractor with `fullFiles: true` flag, (4) Output JSON to stdout.

**Tech Stack:** Node.js, Commander.js, Vitest, existing citation-manager components (LinkObjectFactory, CitationValidator, ContentExtractor, ParsedFileCache)

---

## Task 1 - Basic File Extraction (RED-GREEN-REFACTOR)

### Files
- `tools/citation-manager/test/integration/cli-extract-file.test.js` (CREATE & TEST)
- `tools/citation-manager/test/fixtures/extract-file/sample-document.md` (CREATE)
- `tools/citation-manager/src/citation-manager.js:410-450` (MODIFY)
- `tools/citation-manager/src/citation-manager.js:890-920` (MODIFY)

### Step 1: Create test fixture

Create sample document for testing:

```bash
mkdir -p tools/citation-manager/test/fixtures/extract-file
```

```markdown
# Sample Document

This is a test document for extract file functionality.

## Section 1

Content in section 1.

## Section 2

Content in section 2.

### Subsection 2.1

Nested content.

## Conclusion

Final content.
```

Save to: `tools/citation-manager/test/fixtures/extract-file/sample-document.md`

### Step 2: Write failing integration test (RED)

```javascript
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = join(__dirname, "..", "fixtures", "extract-file");
const CLI_PATH = join(__dirname, "../../src/citation-manager.js");

describe("CLI extract file subcommand - Basic Functionality", () => {
  it("should extract entire file content successfully", async () => {
    // Given: Valid markdown file
    const testFile = join(FIXTURES_DIR, "sample-document.md");

    // When: Execute extract file command
    const { stdout } = await execAsync(
      `node "${CLI_PATH}" extract file "${testFile}"`
    );

    // Then: Output contains complete file content
    const result = JSON.parse(stdout);

    // Verify: Result structure matches OutgoingLinksExtractedContent schema
    expect(result).toHaveProperty("extractedContentBlocks");
    expect(result).toHaveProperty("stats");
    expect(result.stats.uniqueContent).toBe(1);

    // Verify: Content ID exists (not metadata key)
    const contentIds = Object.keys(result.extractedContentBlocks)
      .filter(k => k !== "_totalContentCharacterLength");
    expect(contentIds.length).toBe(1);

    // Verify: Content is non-empty
    const contentBlock = result.extractedContentBlocks[contentIds[0]];
    expect(contentBlock.content.length).toBeGreaterThan(0);
    expect(contentBlock.content).toContain("Sample Document");
    expect(contentBlock.content).toContain("Section 1");
  });
});
```

Save to: `tools/citation-manager/test/integration/cli-extract-file.test.js`

### Step 3: Run test to verify RED

Run: `npm test -- cli-extract-file.test.js`

Expected: FAIL with "Unknown command: file" or similar (command not registered)

### Step 4: Implement extractFile() method (GREEN)

Add method to CitationManager class after extractHeader() method (around line 410):

```javascript
/**
 * Extract entire file content using synthetic link pattern.
 * Integration: Coordinates LinkObjectFactory → CitationValidator → ContentExtractor.
 *
 * Pattern: Four-phase orchestration workflow
 * 1. Create synthetic LinkObject via factory (anchorType: null)
 * 2. Validate synthetic link via validator
 * 3. Extract content via extractor with fullFiles flag
 * 4. Return OutgoingLinksExtractedContent structure
 *
 * @param {string} targetFile - Path to markdown file to extract
 * @param {Object} options - CLI options (scope, format)
 * @returns {Promise<Object>} OutgoingLinksExtractedContent structure
 */
async extractFile(targetFile, options) {
  try {
    // Decision: Build file cache if --scope provided
    if (options.scope) {
      await this.fileCache.buildCache(options.scope);
    }

    // --- Phase 1: Synthetic Link Creation ---
    // Pattern: Use factory to create unvalidated LinkObject for full file
    const factory = new LinkObjectFactory();
    const syntheticLink = factory.createFileLink(targetFile);

    // --- Phase 2: Validation ---
    // Pattern: Validate synthetic link before extraction (fail-fast on errors)
    const validationResult = await this.validator.validateSingleCitation(syntheticLink, targetFile);

    // Extract validation metadata from result
    const validation = {
      status: validationResult.status,
    };

    if (validationResult.error) {
      validation.error = validationResult.error;
    }

    if (validationResult.suggestion) {
      validation.suggestion = validationResult.suggestion;
    }

    if (validationResult.pathConversion) {
      validation.pathConversion = validationResult.pathConversion;
    }

    // Add validation property to link object
    syntheticLink.validation = validation;

    // Decision: Check validation status before extraction (error handling)
    if (syntheticLink.validation.status === "error") {
      // Boundary: Error output to stderr
      console.error("Validation failed:", syntheticLink.validation.error);
      if (syntheticLink.validation.suggestion) {
        console.error("Suggestion:", syntheticLink.validation.suggestion);
      }
      process.exitCode = 1;
      return;
    }

    // --- Phase 3: Extraction ---
    // Decision: Force fullFiles flag for full-file extraction
    // Pattern: ContentExtractor uses CliFlagStrategy to make link eligible
    const result = await this.contentExtractor.extractContent(
      [syntheticLink],
      { ...options, fullFiles: true }
    );

    // --- Phase 4: Return ---
    // Decision: Return result for CLI to output (CLI handles stdout)
    return result;

  } catch (error) {
    // Decision: System errors use exit code 2
    console.error("ERROR:", error.message);
    process.exitCode = 2;
  }
}
```

Insert at: `tools/citation-manager/src/citation-manager.js:410`

### Step 5: Register CLI subcommand (GREEN)

Add subcommand after extract header registration (around line 890):

```javascript
extractCmd
  .command("file")
  .description("Extract entire file content")
  .argument("<target-file>", "Markdown file to extract")
  .option("--scope <folder>", "Limit file resolution to specified directory")
  .option("--format <type>", "Output format (json)", "json")
  .action(async (targetFile, options) => {
    // Integration: Create CitationManager instance
    const manager = new CitationManager();

    try {
      // Pattern: Delegate to CitationManager orchestration method
      const result = await manager.extractFile(targetFile, options);

      // Decision: Output JSON to stdout if extraction succeeded
      if (result) {
        // Boundary: JSON output to stdout
        console.log(JSON.stringify(result, null, 2));
        process.exitCode = 0;
      }
      // Note: Error exit codes set by extractFile() method

    } catch (error) {
      // Decision: Unexpected errors use exit code 2
      console.error("ERROR:", error.message);
      process.exitCode = 2;
    }
  });
```

Insert at: `tools/citation-manager/src/citation-manager.js:891` (after extract header command)

### Step 6: Run test to verify GREEN

Run: `npm test -- cli-extract-file.test.js`

Expected: PASS - Test should pass with green output

### Step 7: Refactor if needed

Review code for:
- Duplicate logic between extractFile() and extractHeader()
- Code comments clarity
- Variable naming consistency

If refactoring needed, make changes and re-run test to verify still GREEN.

### Step 8: Commit

Use `create-git-commit` skill to commit this task.

---

## Task 2 - File Not Found Error Handling (RED-GREEN-REFACTOR)

### Files
- `tools/citation-manager/test/integration/cli-extract-file.test.js` (MODIFY)

### Step 1: Write failing test for missing file (RED)

Add test to existing test file:

```javascript
describe("CLI extract file subcommand - Error Handling", () => {
  it("should report error when file does not exist", async () => {
    // Given: Non-existent file path
    const missingFile = join(FIXTURES_DIR, "does-not-exist.md");

    // When: Execute extract file command (expect failure)
    try {
      await execAsync(`node "${CLI_PATH}" extract file "${missingFile}"`);
      // If we get here, test should fail
      expect.fail("Command should have failed for missing file");
    } catch (error) {
      // Then: Command exits with non-zero code
      expect(error.code).toBeGreaterThan(0);

      // Then: Error message contains helpful information
      expect(error.stderr || error.stdout).toContain("does not exist");
    }
  });
});
```

Add to: `tools/citation-manager/test/integration/cli-extract-file.test.js`

### Step 2: Run test to verify RED

Run: `npm test -- cli-extract-file.test.js`

Expected: FAIL - Test should fail if error handling is insufficient

### Step 3: Verify error handling already works (GREEN)

The existing extractFile() implementation already handles errors through:
1. CitationValidator returning validation errors
2. Check for `validation.status === "error"`
3. Setting `process.exitCode = 1` for validation failures

Run: `npm test -- cli-extract-file.test.js`

Expected: PASS - Test should pass (error handling already implemented)

### Step 4: Refactor if needed

If test fails, enhance error handling in extractFile() method. Otherwise, no changes needed.

### Step 5: Commit

Use `create-git-commit` skill to commit this task.

---

## Task 3 - Scope Option Support (RED-GREEN-REFACTOR)

### Files
- `tools/citation-manager/test/integration/cli-extract-file.test.js` (MODIFY)
- `tools/citation-manager/test/fixtures/extract-file/scoped/nested-file.md` (CREATE)

### Step 1: Create scoped fixture

Create nested directory structure:

```bash
mkdir -p tools/citation-manager/test/fixtures/extract-file/scoped
```

```markdown
# Nested File

This file tests scope resolution.
```

Save to: `tools/citation-manager/test/fixtures/extract-file/scoped/nested-file.md`

### Step 2: Write failing test for scope option (RED)

Add test:

```javascript
describe("CLI extract file subcommand - Scope Option", () => {
  it("should respect scope option for file resolution", async () => {
    // Given: File exists in scoped directory
    const scopedDir = join(FIXTURES_DIR, "scoped");
    const fileName = "nested-file.md"; // Relative filename only

    // When: Execute with scope option
    const { stdout } = await execAsync(
      `node "${CLI_PATH}" extract file "${fileName}" --scope "${scopedDir}"`
    );

    // Then: File is found and content extracted
    const result = JSON.parse(stdout);
    expect(result.stats.uniqueContent).toBe(1);

    const contentIds = Object.keys(result.extractedContentBlocks)
      .filter(k => k !== "_totalContentCharacterLength");
    const contentBlock = result.extractedContentBlocks[contentIds[0]];
    expect(contentBlock.content).toContain("Nested File");
  });
});
```

Add to: `tools/citation-manager/test/integration/cli-extract-file.test.js`

### Step 3: Run test to verify RED

Run: `npm test -- cli-extract-file.test.js`

Expected: FAIL or PASS (scope handling already implemented in extractFile method via fileCache.buildCache)

### Step 4: Verify scope handling works (GREEN)

The existing extractFile() implementation already handles scope through:
1. Check for `options.scope`
2. Call `this.fileCache.buildCache(options.scope)`

Run: `npm test -- cli-extract-file.test.js`

Expected: PASS - Scope handling already works

### Step 5: Refactor if needed

No refactoring needed if test passes.

### Step 6: Commit

Use `create-git-commit` skill to commit this task.

---

## Task 4 - Exit Code Behavior (RED-GREEN-REFACTOR)

### Files
- `tools/citation-manager/test/integration/cli-extract-file.test.js` (MODIFY)

### Step 1: Write failing test for exit codes (RED)

Add tests:

```javascript
describe("CLI extract file subcommand - Exit Codes", () => {
  it("should exit with code 0 when extraction succeeds", async () => {
    // Given: Valid markdown file
    const testFile = join(FIXTURES_DIR, "sample-document.md");

    // When: Execute extract file command
    const { stdout, stderr } = await execAsync(
      `node "${CLI_PATH}" extract file "${testFile}"`
    );

    // Then: Command exits with code 0 (success - implicit in execAsync not throwing)
    const result = JSON.parse(stdout);
    expect(result.stats.uniqueContent).toBeGreaterThan(0);
    expect(stderr).toBe("");
  });

  it("should exit with non-zero code when file not found", async () => {
    // Given: Non-existent file
    const missingFile = join(FIXTURES_DIR, "missing.md");

    // When: Execute extract file command
    try {
      await execAsync(`node "${CLI_PATH}" extract file "${missingFile}"`);
      expect.fail("Should have thrown error");
    } catch (error) {
      // Then: Exit code is non-zero (1 or 2)
      expect(error.code).toBeGreaterThan(0);
    }
  });

  it("should exit with code 1 when validation fails", async () => {
    // Given: Invalid file path that validator rejects
    const invalidFile = "/tmp/nonexistent-citation-test-file.md";

    // When: Execute extract file command
    try {
      await execAsync(`node "${CLI_PATH}" extract file "${invalidFile}"`);
      expect.fail("Should have thrown error");
    } catch (error) {
      // Then: Exit code is 1 (validation error)
      expect(error.code).toBe(1);
    }
  });
});
```

Add to: `tools/citation-manager/test/integration/cli-extract-file.test.js`

### Step 2: Run test to verify RED

Run: `npm test -- cli-extract-file.test.js`

Expected: FAIL or PASS (exit code handling likely already implemented)

### Step 3: Verify exit code handling (GREEN)

The existing implementation handles exit codes:
- Success: `process.exitCode = 0`
- Validation error: `process.exitCode = 1`
- System error: `process.exitCode = 2`

Run: `npm test -- cli-extract-file.test.js`

Expected: PASS - Exit codes already correct

### Step 4: Refactor if needed

No changes needed if tests pass.

### Step 5: Commit

Use `create-git-commit` skill to commit this task.

---

## Task 5 - Help Documentation (RED-GREEN-REFACTOR)

### Files
- `tools/citation-manager/test/integration/cli-extract-file.test.js` (MODIFY)
- `tools/citation-manager/src/citation-manager.js:891` (MODIFY)

### Step 1: Write failing test for help output (RED)

Add test:

```javascript
describe("CLI extract file subcommand - Help Documentation", () => {
  it("should display help text for extract file subcommand", async () => {
    // Given: Extract file help flag

    // When: Execute help command
    const { stdout } = await execAsync(
      `node "${CLI_PATH}" extract file --help`
    );

    // Then: Help output contains description
    expect(stdout).toContain("Extract entire file content");
    expect(stdout).toContain("target-file");
    expect(stdout).toContain("--scope");
    expect(stdout).toContain("--format");
  });

  it("should list extract file in top-level extract help", async () => {
    // Given: Extract help flag

    // When: Execute extract help
    const { stdout } = await execAsync(
      `node "${CLI_PATH}" extract --help`
    );

    // Then: Extract file subcommand is listed
    expect(stdout).toContain("file");
    expect(stdout).toContain("links");
    expect(stdout).toContain("header");
  });
});
```

Add to: `tools/citation-manager/test/integration/cli-extract-file.test.js`

### Step 2: Run test to verify RED

Run: `npm test -- cli-extract-file.test.js`

Expected: FAIL - Help text incomplete

### Step 3: Add comprehensive help documentation (GREEN)

Enhance the CLI subcommand registration:

```javascript
extractCmd
  .command("file")
  .description("Extract entire file content")
  .argument("<target-file>", "Markdown file to extract")
  .option("--scope <folder>", "Limit file resolution to specified directory")
  .option("--format <type>", "Output format (json)", "json")
  .addHelpText("after", `
Examples:
  # Extract entire file
  $ citation-manager extract file docs/architecture.md

  # Extract with scope restriction
  $ citation-manager extract file architecture.md --scope ./docs

  # Pipe to jq for filtering
  $ citation-manager extract file file.md | jq '.extractedContentBlocks'

Exit Codes:
  0  File extracted successfully
  1  File not found or validation failed
  2  System error (permission denied, parse error)

Notes:
  - Extracts complete file content without requiring source document
  - Output is JSON OutgoingLinksExtractedContent structure
  - Use --scope for smart filename resolution in large projects
  `)
  .action(async (targetFile, options) => {
    // ... existing action implementation ...
  });
```

Modify at: `tools/citation-manager/src/citation-manager.js:891`

### Step 4: Run test to verify GREEN

Run: `npm test -- cli-extract-file.test.js`

Expected: PASS - All help tests pass

### Step 5: Refactor if needed

Review help text for clarity and consistency with other subcommands.

### Step 6: Commit

Use `create-git-commit` skill to commit this task.

---

## Task 6 - Run Full Test Suite

### Files
- None (verification only)

### Step 1: Run complete test suite

Run: `npm test`

Expected: All tests pass (unit, integration, all test files)

### Step 2: Check test coverage (optional)

Run: `npm run test:coverage`

Review coverage report for new code.

### Step 3: Fix any failures

If any tests fail:
1. Identify failing test
2. Debug issue
3. Fix implementation
4. Re-run tests
5. Repeat until all tests pass

### Step 4: Verify CLI commands manually

Test each acceptance criteria manually:

```bash
# AC1: Command exists
node tools/citation-manager/src/citation-manager.js extract file --help

# AC2: Extract entire file
node tools/citation-manager/src/citation-manager.js extract file tools/citation-manager/test/fixtures/extract-file/sample-document.md

# AC3: Scope option works
node tools/citation-manager/src/citation-manager.js extract file nested-file.md --scope tools/citation-manager/test/fixtures/extract-file/scoped

# AC4: Error for missing file
node tools/citation-manager/src/citation-manager.js extract file nonexistent.md

# AC5: Success exit code (check with echo $?)
node tools/citation-manager/src/citation-manager.js extract file tools/citation-manager/test/fixtures/extract-file/sample-document.md
echo $?  # Should be 0

# AC6: Failure exit code
node tools/citation-manager/src/citation-manager.js extract file missing.md
echo $?  # Should be 1 or 2

# AC7: Help documentation
node tools/citation-manager/src/citation-manager.js extract --help
node tools/citation-manager/src/citation-manager.js extract file --help
```

---

## Task 7 - Update Documentation

### Files
- `tools/citation-manager/README.md` (MODIFY - if exists)
- `tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-prd.md` (MODIFY - update status)

### Step 1: Update README (if exists)

Check if README exists:

Run: `ls tools/citation-manager/README.md`

If exists, add extract file documentation:

```markdown
### Extract File Subcommand

Extract the complete content of a markdown file without requiring a source document:

```bash
# Basic usage
citation-manager extract file <target-file>

# With scope restriction
citation-manager extract file <target-file> --scope <folder>

# Examples
citation-manager extract file docs/architecture.md
citation-manager extract file guide.md --scope ./docs
```

Output format: JSON OutgoingLinksExtractedContent structure

Exit codes:
- 0: Success
- 1: Validation error (file not found)
- 2: System error

### Step 2: Update PRD status

Update user story status in PRD:

```markdown
_Status_: Complete
```

Modify at: `tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-prd.md` (US2.5 section)

### Step 3: Commit documentation updates

Use `create-git-commit` skill to commit documentation changes.

---

## Task 8 - Finish Development Branch

### Files
- None (workflow only)

### Step 1: Use finishing-a-development-branch skill

Use the `finishing-a-development-branch` skill to:
1. Review implementation against acceptance criteria
2. Choose merge strategy (PR, direct merge, or cleanup)
3. Merge back to feature branch

### Step 2: Execute skill recommendation

Follow the skill's guidance to complete the development branch workflow.

---

## Summary

This implementation plan follows TDD RED-GREEN-REFACTOR cycles for each feature:
1. **Task 1**: Core extraction functionality
2. **Task 2**: Error handling
3. **Task 3**: Scope option support
4. **Task 4**: Exit code correctness
5. **Task 5**: Help documentation
6. **Task 6**: Full test suite verification
7. **Task 7**: Documentation updates
8. **Task 8**: Branch completion workflow

**Key Patterns:**
- Synthetic link creation via LinkObjectFactory
- Four-phase orchestration (Create → Validate → Extract → Output)
- Reuse of existing components (no ContentExtractor changes needed)
- `fullFiles: true` flag enables CliFlagStrategy
- Consistent with US2.4 extract header pattern

**Files Modified:**
- `tools/citation-manager/src/citation-manager.js` (add extractFile method + CLI registration)
- `tools/citation-manager/test/integration/cli-extract-file.test.js` (new test suite)

**Files Created:**
- Test fixtures for integration tests

**No Changes Needed:**
- `src/factories/LinkObjectFactory.js` (createFileLink already implemented)
- `src/core/ContentExtractor/` (reuses existing extraction logic)
- `src/CitationValidator.js` (reuses existing validation)
