# US2.7: Remove Deprecated base-paths Command - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove redundant base-paths command and replace with npm script facade pattern

**Architecture:** Facade pattern at npm script level - preserve user interface while delegating to validate command with jq post-processing

**Tech Stack:** Node.js, Commander.js, shell scripting (jq), Vitest

---

## Task 1 - Add npm Script Wrapper Test

### Files
- `tools/citation-manager/test/enhanced-citations.test.js` (MODIFY - add new test)

### Step 1: Write the failing test (RED)

Add this test to `enhanced-citations.test.js` after the existing tests:

```javascript
it("should extract base paths via npm script wrapper", () => {
 // Given: Test file with multiple citations
 const testFile = join(__dirname, "fixtures", "enhanced-citations.md");

 // When: Execute npm script (pipes through validate → jq → sort)
 const output = runCLI(
  `npm run citation:base-paths "${testFile}"`,
  { cwd: join(__dirname, '..', '..', '..') } // Workspace root for npm run
 );

 // Then: Output is newline-separated paths
 const paths = output.trim().split('\n').filter(p => p.length > 0);

 expect(paths.length).toBeGreaterThanOrEqual(6);
 expect(paths).toEqual([...new Set(paths)]); // Unique (sort -u)
 expect(paths).toEqual([...paths].sort()); // Sorted alphabetically

 // Spot-check expected paths
 expect(paths.some(p => p.includes('test-target.md'))).toBe(true);
 expect(paths.some(p => p.includes('design-principles.md'))).toBe(true);
});
```

### Step 2: Run test to verify it fails (Verify RED)

Run: `npm test enhanced-citations.test.js`

Expected output:

```text
FAIL: npm script not found or returns wrong format
```

### Step 3: Update npm script to facade pattern (GREEN)

Edit `package.json` line 19:

**Before:**

```json
"citation:base-paths": "node tools/citation-manager/src/citation-manager.js base-paths",
```

**After:**

```json
"citation:base-paths": "sh -c 'node tools/citation-manager/src/citation-manager.js validate \"$1\" --format json | jq -r \".links[].target.path.absolute\" | sort -u' --",
```

### Step 4: Run test to verify it passes (Verify GREEN)

Run: `npm test enhanced-citations.test.js`

Expected: Test passes with green output

### Step 5: Commit

Use `create-git-commit` skill:

Run: `/git-and-github:create-git-commit`

Commit message should describe: "Implement npm script facade for base-paths using validate + jq pipeline"

---

## Task 2 - Remove Old CLI Command Test

### Files
- `tools/citation-manager/test/enhanced-citations.test.js:64-104` (DELETE test block)

### Step 1: Remove the old test (RED)

Delete the test block at lines 64-104:

```javascript
// DELETE THIS ENTIRE BLOCK:
it("should extract all base paths from enhanced citation file", async () => {
 const testFile = join(__dirname, "fixtures", "enhanced-citations.md");

 try {
  const output = runCLI(
   `node "${citationManagerPath}" base-paths "${testFile}" --format json`,
   {
    cwd: __dirname,
   },
  );

  const result = JSON.parse(output);

  // Should extract multiple base paths
  expect(result.count).toBeGreaterThanOrEqual(6);

  // Should include standard markdown links
  const hasTestTarget = result.basePaths.some((path) =>
   path.includes("test-target.md"),
  );
  expect(hasTestTarget).toBe(true);

  // Should include cite format paths
  const hasDesignPrinciples = result.basePaths.some((path) =>
   path.includes("design-principles.md"),
  );
  expect(hasDesignPrinciples).toBe(true);

  // Should include relative paths from cite format
  const hasArchitecturePatterns = result.basePaths.some((path) =>
   path.includes("patterns.md"),
  );
  expect(hasArchitecturePatterns).toBe(true);
 } catch (error) {
  if (error.status !== 0) {
   console.log("STDOUT:", error.stdout);
   console.log("STDERR:", error.stderr);
  }
  throw new Error(`Base paths extraction failed: ${error.message}`);
 }
});
```

### Step 2: Run test suite (Verify RED)

Run: `npm test`

Expected: All tests pass, test count decreases by 1

### Step 3: No code needed (GREEN)

Test removal is the change. Proceed to verify.

### Step 4: Run test suite (Verify GREEN)

Run: `npm test`

Expected: All tests pass

### Step 5: Commit

Use `create-git-commit` skill:

Run: `/git-and-github:create-git-commit`

Commit message: "Remove CLI command test for deprecated base-paths"

---

## Task 3 - Remove base-paths CLI Command

### Files
- `tools/citation-manager/src/citation-manager.js:938-968` (DELETE command registration)

### Step 1: Identify command block (RED)

Locate the base-paths command registration at lines 938-968 in `citation-manager.js`

### Step 2: Verify help output shows command (Verify RED)

Run: `node tools/citation-manager/src/citation-manager.js --help`

Expected: Help output includes "base-paths" command

### Step 3: Remove command registration (GREEN)

Delete lines 938-968 from `citation-manager.js`:

```javascript
// DELETE THIS ENTIRE BLOCK:
program
 .command("base-paths")
 .description("Extract distinct base paths from citations in a markdown file")
 .argument("<file>", "path to markdown file to analyze")
 .option("--format <type>", "output format (cli, json)", "cli")
 .action(async (file, options) => {
  try {
   const manager = new CitationManager();
   const basePaths = await manager.extractBasePaths(file);

   if (options.format === "json") {
    console.log(
     JSON.stringify({ file, basePaths, count: basePaths.length }, null, 2),
    );
   } else {
    console.log("Distinct Base Paths Found:");
    console.log("========================");
    console.log("");
    basePaths.forEach((path, index) => {
     console.log(`${index + 1}. ${path}`);
    });
    console.log("");
    console.log(
     `Total: ${basePaths.length} distinct base path${basePaths.length === 1 ? "" : "s"}`,
    );
   }
  } catch (error) {
   console.error(`ERROR: ${error.message}`);
   process.exit(1);
  }
 });
```

### Step 4: Verify help and tests (Verify GREEN)

Run: `node tools/citation-manager/src/citation-manager.js --help`
Expected: base-paths command NOT listed

Run: `npm test`
Expected: All tests pass

### Step 5: Commit

Use `create-git-commit` skill:

Run: `/git-and-github:create-git-commit`

Commit message: "Remove base-paths CLI command registration"

---

## Task 4 - Remove extractBasePaths Method

### Files
- `tools/citation-manager/src/citation-manager.js:510-556` (DELETE method)

### Step 1: Verify method exists (RED)

Run: `grep -n "extractBasePaths" tools/citation-manager/src/citation-manager.js`

Expected: Find method definition at line 510

### Step 2: Check for external calls (Verify RED)

Run: `grep -r "\.extractBasePaths" tools/citation-manager/`

Expected: No results (CLI call already removed in Task 3)

### Step 3: Remove method implementation (GREEN)

Delete lines 510-556 from `citation-manager.js`:

```javascript
// DELETE THIS ENTIRE BLOCK:
/**
 * Extract distinct base paths from citations
 *
 * Parses file and extracts all unique target file paths from citations.
 * Converts relative paths to absolute paths for consistency.
 *
 * @param {string} filePath - Path to markdown file
 * @returns {Promise<Array<string>>} Sorted array of absolute paths
 * @throws {Error} If extraction fails
 */
async extractBasePaths(filePath) {
 try {
  const { resolve, dirname, isAbsolute } = await import("node:path");
  const result = await this.validator.validateFile(filePath);

  const basePaths = new Set();
  const sourceDir = dirname(filePath);

  for (const link of result.links) {
   // Extract path from link - prefer target.path.absolute if available
   let path = null;

   if (link.target && link.target.path && link.target.path.absolute) {
    // Use pre-resolved absolute path from link object
    basePaths.add(link.target.path.absolute);
    continue;
   }

   // Fallback: extract path from fullMatch for patterns not captured in target
   // Standard markdown link pattern: [text](path) or [text](path#anchor)
   const standardMatch = link.fullMatch.match(
    /\[([^\]]+)\]\(([^)#]+)(?:#[^)]+)?\)/,
   );
   if (standardMatch) {
    path = standardMatch[2];
   }

   // Citation pattern: [cite: path]
   const citeMatch = link.fullMatch.match(/\[cite:\s*([^\]]+)\]/);
   if (citeMatch) {
    path = citeMatch[1].trim();
   }

   if (path) {
    // Convert relative paths to absolute paths
    const absolutePath = isAbsolute(path)
     ? path
     : resolve(sourceDir, path);
    basePaths.add(absolutePath);
   }
  }

  return Array.from(basePaths).sort();
 } catch (error) {
  throw new Error(`Failed to extract base paths: ${error.message}`);
 }
}
```

### Step 4: Verify tests pass (Verify GREEN)

Run: `npm test`

Expected: All tests pass

### Step 5: Commit

Use `create-git-commit` skill:

Run: `/git-and-github:create-git-commit`

Commit message: "Remove extractBasePaths method implementation"

---

## Task 5 - Remove Claude Code Permission

**STATUS: NOT APPLICABLE - File does not exist in repository**

The `.claude/settings.local.json` file does not exist in the repository and is git-ignored (line 115 of `.gitignore`). This file contains developer-specific overrides and is never committed to version control. The shared `settings.json` does NOT contain this permission.

**Developer Action (Optional):** If you have a local `.claude/settings.local.json` file, manually remove: `"Bash(npm run citation:base-paths:*)"`

No commit is needed for this change.

---

## Task 6 - Update Documentation

### Files
- `tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-prd.md` (MODIFY - mark US2.7 complete)
- `tools/citation-manager/README.md` (MODIFY - document facade pattern)
- `tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-architecture.md` (MODIFY - add facade pattern notes)

### Step 1: Review current documentation (RED)

Read these files to understand what needs updating:
- PRD shows US2.7 status as "Pending"
- README may reference base-paths command
- Architecture doc may need facade pattern documentation

### Step 2: Identify update locations (Verify RED)

Run: `grep -n "US2.7\|Story 2.7" tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-prd.md`

Expected: Find status line showing "Pending"

### Step 3: Update all documentation (GREEN)

#### Update 1: content-aggregation-prd.md

Find the changelog section and add entry:

```markdown
| 2025-11-01 | 3.2     | Mark US2.7 as COMPLETE - base-paths command removed, npm script facade pattern implemented, zero regressions confirmed | Application Tech Lead (Claude Sonnet 4.5) |
```

Find US2.7 section and update status:

```markdown
_Status_: ✅ COMPLETE (2025-11-01)
```

#### Update 2: README.md

Add section explaining the facade pattern:

```markdown
### base-paths (Facade Pattern)

The base-paths command is implemented as an npm script facade that wraps the validate command.

Usage: npm run citation:base-paths file.md

This is equivalent to: npm run citation:validate file.md --format json | jq -r '.links[].target.path.absolute' | sort -u

Rationale: With the Validation Enrichment Pattern (US1.8), LinkObjects include target.path.absolute directly. The facade preserves the convenient interface while eliminating redundant code.
```

#### Update 3: content-aggregation-architecture.md

Add architectural note about facade pattern in the relevant section:

```markdown
### Facade Pattern at npm Script Level (US2.7)

The base-paths functionality is implemented as a facade at the package.json level rather than in application code. The npm script pipes validate output through jq for path extraction.

Architectural Decision: This demonstrates the Adapter pattern at an unconventional level - the package manager layer. Benefits:
- Preserves user-facing interface (backward compatibility)
- Eliminates code duplication (single source of truth in validate)
- Documents migration path (users can see new pattern in package.json)
- Enables eventual removal if usage declines (localized to package.json)

This pattern is appropriate for deprecation without breaking existing workflows.
```

### Step 4: Verify documentation accuracy (Verify GREEN)

Read updated documentation to ensure:
- Dates are correct
- Status updates are accurate
- Examples are valid
- No broken links

### Step 5: Commit

Use `create-git-commit` skill:

Run: `/git-and-github:create-git-commit`

Commit message: "Update documentation for US2.7 completion - facade pattern implemented"

---

## Plan Complete

**Total Tasks**: 6
**Estimated Time**: 45-60 minutes
**Commits**: 6 (one per task)
**Test Philosophy**: TDD - RED, GREEN, REFACTOR cycle for each task

**Verification Checklist**:
- [ ] npm script facade works end-to-end
- [ ] Old CLI command removed
- [ ] Old method removed
- [ ] Permission removed
- [ ] No orphaned references
- [ ] Documentation updated
- [ ] All tests pass (expect count to match: original - 1 old test + 1 new test = same total)
- [ ] 6 commits created

---

## Execution Handoff

Plan complete and saved to `/Users/wesleyfrederick/Documents/ObsidianVaultNew/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/design-docs/features/20251003-content-aggregation/user-stories/us2.7-remove-deprecated-base-paths-command/us2.7-remove-deprecated-base-paths-command-implement-plan.md`

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
