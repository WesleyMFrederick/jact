%% hardening: exempt-defer-language — pre-pipeline-lock baseline %%

# Plan: LLM-Optimized Default Output for `jact validate`

%% *Last Modified: 04/29/26 22:26:55* %%

## Goal

%% *Last Modified: 04/29/26 22:26:55* %%

When an LLM runs `jact validate <file> --scope <root>`, the default stdout/stderr should contain **only the information needed to fix link violations** — nothing more.

## Outcomes (Success Criteria)

%% *Last Modified: 04/29/26 22:26:55* %%

1. **Clean file → near-zero output.** When validation passes with no errors/warnings, output is a single line: `OK: 85 citations valid` (or similar). No tree of valid links, no SUMMARY block, no duplicate-filename warnings, no banner.
2. **Dirty file → only what's broken.** When errors/warnings exist, output contains for each: line number, the offending link text, the error message, and the suggested fix. No valid-citation tree.
3. **Human-debuggable on demand.** A `--verbose` flag restores the full current output (tree of valid citations, duplicate-filename warnings, summary block, banner).
4. **JSON unchanged.** `--format json` behavior is preserved exactly. JSON consumers already filter what they need.
5. **Exit codes unchanged.** 0 / 1 / 2 still mean success / validation errors / system error.
6. **No regressions.** All existing tests pass after being updated to reflect the new default contract.

## Constraints

%% *Last Modified: 04/29/26 23:16:49* %%

### Hard (immediate failure if violated)

%% *Last Modified: 04/29/26 23:16:49* %%

- `--format json` output shape is unchanged — JSON consumers must not break
- Exit codes 0 / 1 / 2 are preserved exactly
- `--fix` behavior and output are unchanged
- `ast`, `extract`, `base-paths` commands are untouched

### Soft (discouraged)

%% *Last Modified: 04/29/26 23:16:49* %%

- `--verbose` must restore the *current* output byte-for-byte — no reformatting, no symbol changes
- No color or symbol changes to any output mode

## Context

%% *Last Modified: 04/29/26 22:26:55* %%

Current invocation:
```
jact validate <file> --scope <root>
```
emits ~85+ lines for a clean file: a "Citation Validation Report" banner, a duplicate-filename WARNING from `FileCache`, the full `VALID CITATIONS (N)` tree, a SUMMARY block, validation time, and a final status line. For an LLM that is only trying to repair broken links, every byte of this except the error/warning entries is wasted context. The user's request: make the *default* output be the minimum the LLM needs; keep verbose available behind a flag.

The CLI is a single-file orchestrator (`src/jact.ts`); the formatter lives in one private method. JSON output already contains structured data. Scope of change is small and localized.

## Critical Files

%% *Last Modified: 04/29/26 22:26:55* %%

| File | Role | Change |
|---|---|---|
| `src/jact.ts:64-69` (`CliValidateOptions`) | Validate command options interface | Add `verbose?: boolean` |
| `src/jact.ts:312-423` (`formatForCLI`) | Verbose CLI formatter | Branch on `verbose` flag — minimal output by default, full tree when verbose |
| `src/jact.ts:180-227` (`validate` method) | Pipes options to formatter | Pass `verbose` through to `formatForCLI` |
| `src/jact.ts:1074-1108` (commander definition) | CLI flag parsing | Add `.option("--verbose", "show full validation report including all valid citations", false)` |
| `src/FileCache.ts:108-112` | Duplicate-filename WARNING | Gate emission on a `verbose` constructor option (or a module-level flag); silent by default |
| `src/factories/componentFactory.ts` (`createFileCache`) | DI factory for FileCache | Thread `verbose` flag in |
| `test/validation.test.js` | Asserts verbose strings | Update to add `--verbose` to invocations OR rewrite assertions for new minimal contract |
| `test/cli-warning-output.test.js` | Asserts `SUMMARY:` / `VALID CITATIONS` | Add `--verbose` to invocations |
| `test/cli-execution-detection.test.js:61-62` | Asserts banner | Update to new minimal default OR pass `--verbose` |

## Default Output Contract (the LLM-facing format)

%% *Last Modified: 04/29/26 22:26:55* %%

**No errors, no warnings:**
```
OK: 85 citations valid
```

**Errors and/or warnings present:**
```
ERRORS (2)
- Line 47: [`foo.md`](path/to/foo.md)
  error: File not found: path/to/foo.md
  suggestion: Did you mean path/to/foo-v2.md?
- Line 93: [`SKILL.md L130`](path/to/SKILL.md)
  error: Anchor not found: ^L130
  suggestion: Use #section-name (Obsidian raw header format)

WARNINGS (1)
- Line 32: [`SKILL.md L4, L114, L128`](path/to/SKILL.md)
  suggestion: Use raw header format for better Obsidian compatibility

FAILED: 2 errors, 1 warning
```

Rationale for fields kept: `line`, `fullMatch`, `error`, `suggestion` are exactly what an LLM needs to locate and rewrite the offending markdown. Everything else (validation time, totals breakdown beyond final line, banner, valid tree) is dropped.

## `--help` Interface Changes

%% *Last Modified: 04/29/26 22:33:07* %%

### Current (`jact validate --help`)

%% *Last Modified: 04/29/26 22:33:07* %%

```
Usage: jact validate [options] <file>

Validate citations in a markdown file, checking that target files exist and
anchors resolve correctly

Arguments:
  file                path to markdown file to validate

Options:
  --format <type>     output format (cli, json) (default: "cli")
  --lines <range>     validate specific line range (e.g., "150-160" or "157")
  --scope <folder>    limit file resolution to specific folder (enables smart filename matching)
  --fix               automatically fix citation anchors including kebab-case conversions and missing anchor corrections
  -h, --help          display help for command

Examples:
    $ jact validate docs/design.md
    $ jact validate file.md --format json
    $ jact validate file.md --lines 100-200
    $ jact validate file.md --fix --scope ./docs

Exit Codes:
  0  All citations valid
  1  Validation errors found
  2  System error (file not found, permission denied)
```

### New (`jact validate --help`)

%% *Last Modified: 04/29/26 22:33:07* %%

```
Usage: jact validate [options] <file>

Validate citations in a markdown file, checking that target files exist and
anchors resolve correctly. By default emits only errors and warnings
(LLM-optimized); use --verbose for the full human-readable report.

Arguments:
  file                path to markdown file to validate

Options:
  --format <type>     output format (cli, json) (default: "cli")
  --lines <range>     validate specific line range (e.g., "150-160" or "157")
  --scope <folder>    limit file resolution to specific folder (enables smart filename matching)
  --fix               automatically fix citation anchors including kebab-case conversions and missing anchor corrections
  --verbose           show full validation report: all valid citations, duplicate-filename warnings, summary block (default: minimal output with only errors/warnings)
  -h, --help          display help for command

Default Output (no --verbose):
  Clean file: "OK: <N> citations valid"
  Errors/warnings: "ERRORS (n)" and/or "WARNINGS (n)" blocks listing line, link, error, suggestion; ends with "FAILED: X errors, Y warnings"

Examples:
    $ jact validate docs/design.md                    # minimal output (default)
    $ jact validate docs/design.md --verbose          # full report with valid-citation tree
    $ jact validate file.md --format json             # JSON output (unchanged)
    $ jact validate file.md --lines 100-200
    $ jact validate file.md --fix --scope ./docs

Exit Codes:
  0  All citations valid
  1  Validation errors found
  2  System error (file not found, permission denied)
```

### Concrete edits in `src/jact.ts:1075-1107`

%% *Last Modified: 04/29/26 22:33:07* %%

1. Update `.description(...)` at line 1076-1078 to mention default-minimal-output behavior.
2. Insert the `--verbose` option (between current `--fix` at line 1089 and `.addHelpText` at line 1093).
3. Replace the `addHelpText("after", \`...\`)` block (line 1093-1106) with the new examples + "Default Output" subsection shown above.

## Implementation Steps

%% *Last Modified: 04/29/26 22:32:47* %%

1. **Add `verbose` to `CliValidateOptions`** (`src/jact.ts:64-69`).
2. **Refactor `formatForCLI`** (`src/jact.ts:312`):
   - Accept new param `verbose: boolean`.
   - When `verbose === true`: keep current implementation byte-for-byte.
   - When `verbose === false` (default): emit only `ERRORS` and `WARNINGS` blocks (skip `VALID CITATIONS`, banner, `SUMMARY`, validation time). Final line = `OK: N citations valid` on clean, or `FAILED: X errors, Y warnings` otherwise.
3. **Thread `verbose` through `validate()`** (`src/jact.ts:180-227`) into `formatForCLI` calls (lines 221, 227).
4. **Wire commander flag and update `--help`** (`src/jact.ts:1075-1107`):
   - Add `.option("--verbose", "show full validation report including all valid citations and duplicate-filename warnings (default: minimal LLM-optimized output)", false)` between the existing `--fix` and `.addHelpText` calls.
   - Update the `addHelpText("after", ...)` block to document the new default behavior and add a `--verbose` example.
5. **Gate `FileCache` duplicate WARNING** (`src/FileCache.ts:108-112`):
   - Add optional `verbose?: boolean` to `FileCache` constructor.
   - Wrap `console.error("WARNING: Found duplicate filenames...")` in `if (this.verbose)`.
   - Update `componentFactory.ts` `createFileCache` signature to accept and forward `verbose`.
   - Pass `options.verbose` from `JactCli.validate()` into the factory call.
6. **Update tests:**
   - `test/validation.test.js` lines 23, 44, 306: change to either pass `--verbose` to keep current assertions, or rewrite to assert the new contract (`OK:`, `FAILED:`).
   - `test/cli-warning-output.test.js` lines 68, 89, 112-129, 179: add `--verbose` to test invocations (these tests are about the warning ordering inside the verbose tree — keep them on verbose).
   - `test/cli-execution-detection.test.js:61-62`: update to assert minimal default (`OK:`) OR pass `--verbose`.
   - Add **one new test** for the minimal default contract: clean file → exact `OK: N citations valid`; broken file → contains `ERRORS (` and `FAILED:` and does NOT contain `VALID CITATIONS` or `SUMMARY:`.
7. **Build and validate:**
   - `npm run build`
   - `npm test`
8. **Update README / `--help` example block** at `src/jact.ts:1095-1106` to document `--verbose`.

## Verification (End-to-End)

%% *Last Modified: 04/29/26 22:26:55* %%

Run after `npm run build`:

```bash
# Clean file — should print ONE line, no warnings
jact validate /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/_planning/20260429-architecture-principles-restructure.md --scope /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents
# Expected: "OK: 85 citations valid"

# Verbose — should print the current full report
jact validate <same-file> --scope <same-scope> --verbose
# Expected: full banner + VALID CITATIONS tree + SUMMARY + ALL CITATIONS VALID

# Broken file — should print only errors/warnings
jact validate test/fixtures/<broken-fixture>.md
# Expected: ERRORS (n) block, FAILED: ... line, NO VALID CITATIONS section

# JSON unchanged
jact validate <file> --format json | head -c 100
# Expected: same JSON shape as before

# Exit codes
jact validate <clean-file> --scope <scope>; echo "exit=$?"   # 0
jact validate <broken-file> --scope <scope>; echo "exit=$?"  # 1
jact validate /nonexistent.md; echo "exit=$?"                # 2
```

Token-count check (the actual goal):
```bash
jact validate <clean-file> --scope <scope> | wc -c    # baseline before: ~6KB; target: <100 bytes
```

## Out of Scope

%% *Last Modified: 04/29/26 22:26:55* %%

- Changing JSON output format
- Changing `--fix` output
- Changing `ast` / `extract` / `base-paths` commands
- Color/symbol changes
- Refactoring the validator core
