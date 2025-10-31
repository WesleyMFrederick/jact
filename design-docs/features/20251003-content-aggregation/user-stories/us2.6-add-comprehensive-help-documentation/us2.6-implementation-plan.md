# US2.6 CLI Help Enhancement - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance CLI help documentation to match jq-style clarity with standardized layout

**Architecture:** Pure Commander.js native features (`.addHelpText()`) with no custom abstractions. Add semantic suggestion map for common typos using `program.configureOutput()`.

**Actual Help Order Achieved:**
1. Usage (Commander.js automatic)
2. Description (from `.description()` method)
3. Arguments (Commander.js automatic)
4. Options (from `.option()` calls)
5. Examples (from `.addHelpText('after', ...)`)
6. Exit Codes (from `.addHelpText('after', ...)`)

**Note:** Commander.js's `.addHelpText('before', ...)` places text _before_ the Usage line, not before options. To achieve examples→exit codes after options, use `.addHelpText('after', ...)` with both sections in a single call.

**Tech Stack:** Commander.js 12.x, Node.js native modules

**Important Note on TDD**: This is **presentational work** with no testable business logic. Traditional RED-GREEN-REFACTOR doesn't apply because help text has no unit-testable behavior. Instead, we follow the **spirit of TDD**: make one small change, verify immediately, commit. Each task follows: **ADD → VERIFY → COMMIT**.

---

## Task 1 - Add validate command description and examples

### Files
- `tools/citation-manager/src/citation-manager.js:809-855` (MODIFY)

### Step 1: Add description paragraph and examples before options

Locate the `validate` command definition (line 809) and add `.addHelpText('before', ...)` after `.argument()` and before first `.option()`:

```javascript
program
 .command("validate")
 .description("Validate citations in a markdown file")
 .argument("<file>", "path to markdown file to validate")
 .addHelpText('before', `
citation-manager validate validates all citation links in a markdown file,
checking that target files exist and anchors resolve correctly. It can
output results in CLI-friendly format or JSON for CI/CD integration.

Examples:

    $ citation-manager validate docs/design.md
    $ citation-manager validate file.md --format json
    $ citation-manager validate file.md --lines 100-200
    $ citation-manager validate file.md --fix --scope ./docs
`)
 .option("--format <type>", "output format (cli, json)", "cli")
 // ... rest of options
```

### Step 2: Verify help output

Run: `node tools/citation-manager/src/citation-manager.js validate --help`

Expected output structure:

```text
Usage: citation-manager validate [options] <file>

citation-manager validate validates all citation links in a markdown file,
checking that target files exist and anchors resolve correctly...

Examples:
    $ citation-manager validate docs/design.md
    ...

Arguments:
  file                      path to markdown file to validate

Options:
  --format <type>           output format (cli, json) (default: "cli")
  ...
```

### Step 3: Commit

Use `create-git-commit` skill to commit with message: "Add description and examples to validate command help"

---

## Task 2 - Add option grouping to validate command

### Files
- `tools/citation-manager/src/citation-manager.js:809-855` (MODIFY)

### Step 1: Add option groups

Replace the flat `.option()` calls with grouped options using `.optionsGroup()`:

```javascript
 // After .addHelpText('before', ...)
 .optionsGroup('Output Options')
 .option("--format <type>", "output format (cli, json)", "cli")
 .optionsGroup('Validation Options')
 .option(
  "--lines <range>",
  'validate specific line range (e.g., "150-160" or "157")',
 )
 .option(
  "--fix",
  "automatically fix citation anchors including kebab-case conversions and missing anchor corrections",
 )
 .optionsGroup('Resolution Options')
 .option(
  "--scope <folder>",
  "limit file resolution to specific folder (enables smart filename matching)",
 )
 .action(async (file, options) => {
  // ... existing action handler
 });
```

**Note**: Commander.js may not support `.optionsGroup()` directly. If this method doesn't exist, skip this step and document as tech debt. Options will remain flat.

### Step 2: Verify option grouping

Run: `node tools/citation-manager/src/citation-manager.js validate --help`

Expected: Options should appear in three groups (Output Options, Validation Options, Resolution Options). If `.optionsGroup()` is not available, options will remain flat (acceptable for now).

### Step 3: Commit

Use `create-git-commit` skill to commit with message: "Add option grouping to validate command (if supported)"

---

## Task 3 - Add exit codes to validate command

### Files
- `tools/citation-manager/src/citation-manager.js:809-855` (MODIFY)

### Step 1: Add exit codes after action handler

Add `.addHelpText('after', ...)` after the last option and before `.action()`:

```javascript
 .option(
  "--scope <folder>",
  "limit file resolution to specific folder (enables smart filename matching)",
 )
 .addHelpText('after', `
Exit Codes:
  0  All citations valid
  1  Validation errors found
  2  System error (file not found, permission denied)
`)
 .action(async (file, options) => {
  // ... existing action handler
 });
```

### Step 2: Verify exit codes in help

Run: `node tools/citation-manager/src/citation-manager.js validate --help`

Expected: Exit codes section should appear at the bottom after options.

### Step 3: Commit

Use `create-git-commit` skill to commit with message: "Add exit codes documentation to validate command help"

---

## Task 4 - Verify validate command help completeness

### Files
- None (manual verification only)

### Step 1: Run full help output

Run: `node tools/citation-manager/src/citation-manager.js validate --help`

### Step 2: Verify against design spec

Check that output matches design document structure (lines 52-85 of design plan):
- ✓ Title/Version
- ✓ Usage line
- ✓ Description paragraph
- ✓ Examples (4 examples)
- ✓ Arguments section
- ✓ Options (grouped if supported, flat if not)
- ✓ Exit codes

### Step 3: Document verification

No commit needed - verification checkpoint only.

---

## Task 5 - Add ast command description and examples

### Files
- `tools/citation-manager/src/citation-manager.js:857-865` (MODIFY)

### Step 1: Add description and examples

Locate the `ast` command definition (line 857) and add `.addHelpText('before', ...)`:

```javascript
program
 .command("ast")
 .description("Display markdown AST and citation metadata")
 .argument("<file>", "path to markdown file to analyze")
 .addHelpText('before', `
citation-manager ast displays the internal Abstract Syntax Tree (AST) and
parsed citation metadata from a markdown file. This is useful for debugging
why citations aren't being detected or for inspecting available anchors.

Output includes:
  - tokens: Markdown AST from marked.js parser
  - links: Detected citation links with anchor metadata
  - headings: Parsed heading structure
  - anchors: Available anchor points (headers and blocks)

Examples:

    $ citation-manager ast docs/design.md
    $ citation-manager ast file.md | jq '.links'
    $ citation-manager ast file.md | jq '.anchors | length'
`)
 .action(async (file) => {
  // ... existing action handler
 });
```

### Step 2: Verify ast help output

Run: `node tools/citation-manager/src/citation-manager.js ast --help`

Expected output structure:

```text
Usage: citation-manager ast [options] <file>

citation-manager ast displays the internal Abstract Syntax Tree (AST)...

Output includes:
  - tokens: ...
  - links: ...

Examples:
    $ citation-manager ast docs/design.md
    ...

Arguments:
  file                      path to markdown file to analyze

Options:
  -h, --help                display help for command
```

### Step 3: Commit

Use `create-git-commit` skill to commit with message: "Add description and examples to ast command help"

---

## Task 6 - Verify ast command help completeness

### Files
- None (manual verification only)

### Step 1: Run full help output

Run: `node tools/citation-manager/src/citation-manager.js ast --help`

### Step 2: Verify against design spec

Check that output matches design document structure (lines 123-154 of design plan):
- ✓ Usage line
- ✓ Description paragraph
- ✓ Output structure explanation
- ✓ Examples (3 examples with jq piping)
- ✓ Arguments section
- ✓ Options section

### Step 3: Document verification

No commit needed - verification checkpoint only.

---

## Task 7 - Create semantic suggestion map

### Files
- `tools/citation-manager/src/citation-manager.js:802` (MODIFY - add before program definition)

### Step 1: Add semanticSuggestionMap constant

Add this constant immediately before the `const program = new Command();` line (before line 802):

```javascript
/**
 * Semantic suggestion map for common user mistakes
 *
 * Maps common synonyms and typos to correct commands/options.
 * Used by custom error handler to provide helpful suggestions.
 */
const semanticSuggestionMap = {
 // Command synonyms
 check: ['validate'],
 verify: ['validate'],
 lint: ['validate'],
 parse: ['ast'],
 tree: ['ast'],
 debug: ['ast'],
 show: ['ast'],

 // Option synonyms
 fix: ['--fix'],
 repair: ['--fix'],
 correct: ['--fix'],
 output: ['--format'],
 json: ['--format json'],
 range: ['--lines'],
 folder: ['--scope'],
 directory: ['--scope'],
 path: ['--scope'],
 dir: ['--scope']
};

const program = new Command();
```

### Step 2: Verify code compiles

Run: `node tools/citation-manager/src/citation-manager.js --help`

Expected: No errors, help output displays normally.

### Step 3: Commit

Use `create-git-commit` skill to commit with message: "Add semantic suggestion map for CLI error handling"

---

## Task 8 - Configure custom error handler

### Files
- `tools/citation-manager/src/citation-manager.js:802-807` (MODIFY - add after program definition)

### Step 1: Add configureOutput call

Add this immediately after `program.version("1.0.0");` (line 807):

```javascript
program
 .name("citation-manager")
 .description("Citation validation and management tool for markdown files")
 .version("1.0.0");

// Configure custom error output with semantic suggestions
program.configureOutput({
 outputError: (str, write) => {
  const match = str.match(/unknown (?:command|option) '([^']+)'/);
  if (match) {
   const input = match[1].replace(/^--?/, '');
   const suggestions = semanticSuggestionMap[input];

   if (suggestions) {
    write(`Unknown ${match[0].includes('command') ? 'command' : 'option'} '${match[1]}'\n`);
    write(`Did you mean: ${suggestions.join(', ')}?\n`);
    return;
   }
  }
  write(str);
 }
});
```

### Step 2: Verify error handler works

Run invalid commands to test suggestion map:

```bash
# Test command synonym
node tools/citation-manager/src/citation-manager.js check file.md
# Expected: "Unknown command 'check'\nDid you mean: validate?"

# Test option synonym
node tools/citation-manager/src/citation-manager.js validate file.md --json
# Expected: "Unknown option '--json'\nDid you mean: --format json?"
```

### Step 3: Commit

Use `create-git-commit` skill to commit with message: "Configure custom error handler for semantic suggestions"

---

## Task 9 - Verify semantic suggestion map

### Files
- None (manual verification only)

### Step 1: Test command suggestions

Run multiple invalid commands:

```bash
node tools/citation-manager/src/citation-manager.js verify file.md
node tools/citation-manager/src/citation-manager.js lint file.md
node tools/citation-manager/src/citation-manager.js parse file.md
```

Expected: Each should suggest the correct command.

### Step 2: Test option suggestions

Run commands with invalid options:

```bash
node tools/citation-manager/src/citation-manager.js validate file.md --repair
node tools/citation-manager/src/citation-manager.js validate file.md --folder ./docs
node tools/citation-manager/src/citation-manager.js validate file.md --range 100-200
```

Expected: Each should suggest the correct option.

### Step 3: Document verification

No commit needed - verification checkpoint only.

---

## Task 10 - Restructure extract links help to jq pattern

### Files
- `tools/citation-manager/src/citation-manager.js:904-932` (MODIFY)

### Step 1: Restructure help text

Replace the current `.description()` call (lines 906-918) with jq-pattern structure:

```javascript
extractCmd
 .command("links <source-file>")
 .description("Extract content from all links in source document")
 .addHelpText('before', `
citation-manager extract links discovers all citation links in a source
document, validates them, determines extraction eligibility, and outputs
deduplicated content from target files. The workflow includes validation,
eligibility analysis via strategy chain, content retrieval, and SHA-256
deduplication to minimize token usage.

Examples:

    $ citation-manager extract links docs/design.md
    $ citation-manager extract links docs/design.md --full-files
    $ citation-manager extract links docs/design.md --scope ./docs
    $ citation-manager extract links file.md | jq '.stats.compressionRatio'
`)
 .option("--scope <folder>", "Limit file resolution to folder")
 .option("--format <type>", "Output format (reserved for future)", "json")
 .option("--full-files", "Enable full-file link extraction (default: sections only)")
 .addHelpText('after', `
Exit Codes:
  0  At least one link extracted successfully
  1  No eligible links or all extractions failed
  2  System error (file not found, permission denied)
`)
 .action(async (sourceFile, options) => {
  // ... existing action handler
 });
```

### Step 2: Verify extract links help

Run: `node tools/citation-manager/src/citation-manager.js extract links --help`

Expected: Output follows jq pattern: description → examples → options → exit codes

### Step 3: Commit

Use `create-git-commit` skill to commit with message: "Restructure extract links help to jq pattern"

---

## Task 11 - Restructure extract header help to jq pattern

### Files
- `tools/citation-manager/src/citation-manager.js:934-979` (MODIFY)

### Step 1: Restructure help text

Replace current `.addHelpText('after', ...)` (lines 940-957) with `.addHelpText('before', ...)` and move exit codes to `.addHelpText('after', ...)`:

```javascript
extractCmd
 .command("header")
 .description("Extract specific header content from target file")
 .argument("<target-file>", "Markdown file to extract from")
 .argument("<header-name>", "Exact header text to extract")
 .addHelpText('before', `
citation-manager extract header extracts content from a specific header
section in a target file without requiring a source document with links.
Uses synthetic link creation and the same extraction pipeline as extract
links for consistent behavior.

Examples:

    $ citation-manager extract header plan.md "Task 1: Implementation"
    $ citation-manager extract header docs/guide.md "Overview" --scope ./docs
    $ citation-manager extract header file.md "Design" | jq '.extractedContentBlocks'
`)
 .option("--scope <folder>", "Limit file resolution scope")
 .option("--format <type>", "Output format (json)", "json")
 .addHelpText('after', `
Exit Codes:
  0  Header extracted successfully
  1  Header not found or validation failed
  2  System error (file not found, permission denied)
`)
 .action(async (targetFile, headerName, options) => {
  // ... existing action handler
 });
```

### Step 2: Verify extract header help

Run: `node tools/citation-manager/src/citation-manager.js extract header --help`

Expected: Output follows jq pattern: description → examples → options → exit codes

### Step 3: Commit

Use `create-git-commit` skill to commit with message: "Restructure extract header help to jq pattern"

---

## Task 12 - Restructure extract file help to jq pattern

### Files
- `tools/citation-manager/src/citation-manager.js:981-1029` (MODIFY)

### Step 1: Restructure help text

Replace current `.addHelpText('after', ...)` (lines 987-1007) with `.addHelpText('before', ...)` and move exit codes to `.addHelpText('after', ...)`:

```javascript
extractCmd
 .command("file")
 .description("Extract entire file content")
 .argument("<target-file>", "Markdown file to extract")
 .addHelpText('before', `
citation-manager extract file extracts the entire content of a markdown
file without requiring a source document with links. Creates a synthetic
full-file link and uses the same extraction and deduplication pipeline
as extract links for consistent output structure.

Examples:

    $ citation-manager extract file docs/architecture.md
    $ citation-manager extract file architecture.md --scope ./docs
    $ citation-manager extract file file.md | jq '.extractedContentBlocks'
    $ citation-manager extract file file.md | jq '.stats'
`)
 .option("--scope <folder>", "Limit file resolution to specified directory")
 .option("--format <type>", "Output format (json)", "json")
 .addHelpText('after', `
Exit Codes:
  0  File extracted successfully
  1  File not found or validation failed
  2  System error (permission denied, parse error)
`)
 .action(async (targetFile, options) => {
  // ... existing action handler
 });
```

### Step 2: Verify extract file help

Run: `node tools/citation-manager/src/citation-manager.js extract file --help`

Expected: Output follows jq pattern: description → examples → options → exit codes

### Step 3: Commit

Use `create-git-commit` skill to commit with message: "Restructure extract file help to jq pattern"

---

## Task 13 - Verify all extract command help outputs

### Files
- None (manual verification only)

### Step 1: Verify extract links help

Run: `node tools/citation-manager/src/citation-manager.js extract links --help`

Check structure matches design spec (lines 203-233 of design plan).

### Step 2: Verify extract header help

Run: `node tools/citation-manager/src/citation-manager.js extract header --help`

Check structure matches design spec (lines 274-303 of design plan).

### Step 3: Verify extract file help

Run: `node tools/citation-manager/src/citation-manager.js extract file --help`

Check structure matches design spec (lines 344-371 of design plan).

### Step 4: Document verification

No commit needed - verification checkpoint only.

---

## Task 14 - Update PRD status for US2.6

### Files
- `tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-prd.md:591` (MODIFY)

### Step 1: Update status line

Change line 591 from:

```markdown
_Status_: Pending
```

To:

```markdown
_Status_: ✅ COMPLETE (2025-10-31)
```

### Step 2: Verify change

Run: `git diff tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-prd.md`

Expected: Shows status change from "Pending" to "✅ COMPLETE (2025-10-31)".

### Step 3: Commit

Use `create-git-commit` skill to commit with message: "Mark US2.6 as COMPLETE in PRD"

---

## Task 15 - Update CLI Architecture Overview

### Files
- `tools/citation-manager/design-docs/component-guides/CLI Architecture Overview.md` (MODIFY)

### Step 1: Add help documentation section

Add new section after the "Command Registry" intro paragraph (after line 22):

```markdown
### Help Documentation Pattern

All commands follow the **jq-style help layout pattern**:

1. **Title/Version** - Tool name and version (Commander default)
2. **Usage** - Command syntax (Commander default)
3. **Description** - Paragraph explaining what command does (`.addHelpText('before', ...)`)
4. **Examples** - Real-world usage patterns (included in `.addHelpText('before', ...)`)
5. **Command Options** - Flags and arguments (Commander `.option()` calls)
6. **Exit Codes** - Return codes for automation (`.addHelpText('after', ...)` for complex commands)

**Rationale**: Examples before options (jq pattern) lets users see real usage before diving into flags. This matches how developers actually learn CLI tools.

**Implementation**: Uses Commander.js native `.addHelpText()` method only. No custom abstractions or template helpers.

**Semantic Suggestions**: Custom error handler provides "Did you mean...?" suggestions for common typos and synonyms (e.g., "check" → "validate", "--folder" → "--scope").

---
```

### Step 2: Verify documentation reads clearly

Read the updated section to ensure it flows well with existing content.

### Step 3: Commit

Use `create-git-commit` skill to commit with message: "Document help pattern in CLI Architecture Overview"

---

## Task 16 - Update CLI Orchestrator Implementation Guide

### Files
- `tools/citation-manager/design-docs/component-guides/CLI Orchestrator Implementation Guide.md` (MODIFY)

### Step 1: Add help documentation section

Find the "Key Architectural Patterns" section (around line 20) and add new pattern:

```markdown
**Key Architectural Patterns:**
- **Orchestration Pattern**: CLI coordinates workflow phases without containing business logic
- **Factory Pattern**: Component instantiation with DI for testability
- **Separation of Concerns**: Validator validates, Extractor extracts, CLI coordinates
- **Fix Logic Exception**: Fix command contains application logic (documented tech debt)
- **Help Documentation Pattern**: jq-style layout using Commander.js `.addHelpText()` (US2.6)
```

### Step 2: Add semantic suggestion map to structure section

In the structure section (after the class diagram), add:

```markdown
### Semantic Suggestion Map

The CLI includes a `semanticSuggestionMap` constant that maps common user mistakes to correct commands/options:

```javascript
const semanticSuggestionMap = {
 // Command synonyms
 check: ['validate'],
 verify: ['validate'],
 lint: ['validate'],
 parse: ['ast'],
 // ... etc
};
```

Custom error handler uses this map via `program.configureOutput()` to provide helpful suggestions:

```text
$ citation-manager check file.md
Unknown command 'check'
Did you mean: validate?
```

**Design Decision**: Uses Commander.js native error handling hooks rather than custom error classes. Keeps CLI layer thin and focused on presentation.

```markdown

### Step 3: Verify documentation clarity

Read updated sections to ensure they integrate well with existing content.

### Step 4: Commit

Use `create-git-commit` skill to commit with message: "Document help patterns in CLI Orchestrator guide"

---

## Success Criteria (US2.6 Acceptance Criteria)

**AC1**: validate command help includes description, options, examples, exit codes ✅
**AC2**: ast command help includes description, output structure, use cases ✅
**AC3**: extract command top-level help lists subcommands ✅ (Commander.js default)
**AC4**: extract subcommands restructured to match jq pattern (description → examples → options → exit codes) ✅
**AC5**: Standard help flags work for all commands (Commander.js default) ✅

---

## Verification Checklist

Before marking US2.6 complete:

- [ ] `citation-manager validate --help` shows description, examples, options (grouped if supported), exit codes
- [ ] `citation-manager ast --help` shows description, output structure, examples
- [ ] `citation-manager extract links --help` follows jq pattern
- [ ] `citation-manager extract header --help` follows jq pattern
- [ ] `citation-manager extract file --help` follows jq pattern
- [ ] Semantic suggestion map catches typos: `citation-manager check file.md`
- [ ] Semantic suggestion map catches option typos: `citation-manager validate file.md --folder ./docs`
- [ ] PRD shows US2.6 status as "✅ COMPLETE (2025-10-31)"
- [ ] CLI Architecture Overview documents help pattern
- [ ] CLI Orchestrator Implementation Guide documents help patterns

---

## Notes on TDD Adaptation

This implementation follows the **spirit of TDD** (immediate verification, frequent commits, small changes) rather than the **letter of TDD** (RED-GREEN-REFACTOR with failing tests) because:

1. **No testable behavior**: Help text is presentational with no business logic to unit test
2. **Manual verification**: The only way to verify help text is to run `--help` and visually inspect output
3. **Commander.js framework**: Help generation is handled by the framework, not custom code

Each task follows: **ADD → VERIFY → COMMIT**
- **ADD**: Make one small help text change
- **VERIFY**: Run `--help` command and confirm output matches design spec
- **COMMIT**: Commit immediately using `create-git-commit` skill

This approach maintains TDD's benefits (incremental progress, immediate feedback, clear rollback points) while acknowledging that presentational work doesn't have traditional unit tests.
