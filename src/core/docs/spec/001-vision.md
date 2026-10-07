# 001. Vision

**Status:** done

`src/core` turns Markdown files into checked links, extracted content, and safe file edits, so every jact command shares one set of rules.

## What `src/core` Is

`src/core` is the domain layer under the jact command-line interface (CLI); it returns data or report strings, never exit codes. The whole tool: [What jact Is](../../../../docs/spec/001-vision.md#What%20jact%20Is).

### Core Value Proposition

Core gives each command the same parser, the same link checks, and the same safety rules.

1. **One parse model** — validation, extraction, fix, and rename read the same syntax tree
2. **One link verdict** — every link gets a valid, warning, or error result from one checker
3. **Safe edits** — the two write paths refuse unsafe targets and write nothing on a partial failure

### What `src/core` Is Not

- Not a CLI — it never parses arguments, sets exit codes, or prints formatted reports
- Not a dependency wiring layer — `src/factories/componentFactory.ts` builds components
- Not a file index — `src/FileCache.ts` and `src/ParsedFileCache.ts` are injected from outside core

## Design Principles

Three principles decide where new core code goes.

### 1. Dependencies Come In, Never Get Built

**Principle:** A core component receives its parser, caches, and strategies from its caller.

**Implications:**
- The factory owns construction: [ADR-0001 — DI-via-factory pattern](../../../../docs/adrs/003-adrs.md#ADR-0001%20—%20DI-via-factory%20pattern)

### 2. One Syntax Source

**Principle:** Every Markdown construct comes from the jact micromark extension set, never from a separate regular expression.

**Implications:**
- The rule and its extension registry: [ADR-0003 — Flavor Extension Collection](../../../../docs/adrs/003-adrs.md#ADR-0003%20—%20Flavor%20Extension%20Collection)
- The plain-path scanner parses with the same extensions as the parser

### 3. Writes Are Opt-In and All-or-Nothing

**Principle:** Only the fix and rename paths write user files, and each writes all planned edits or none.

**Implications:**
- The repository read-only rule: [3. Read-Only by Default](../../../../docs/spec/001-vision.md#3.%20Read-Only%20by%20Default)
- A stale citation, an overlapping edit, or an unsafe target stops the write before the first byte

## Core Guarantees

Core guarantees one verdict per link, bounded reads, and safe writes.

| Guarantee | Description | Enforced by |
|-----------|-------------|-------------|
| **Parser links stay unchanged** | The checker returns a new enriched link and never mutates the parser's link | `test/regressions/37-enrichLinkObject-immutability.test.ts` |
| **Plain text is not a link** | Validation checks parsed links only; plain paths and code never fail validation | `test/cli-integration/plain-path-validate.test.ts` |
| **Bounded extraction reads** | Extraction reads a linked target only inside the permitted directories | `test/integration/extract-read-boundary.test.ts` |
| **Safe fix writes** | `--fix` refuses symbolic links, out-of-scope files, and changed citations | `test/cli-integration/validate-fix-write-safety.test.ts`, `test/unit/jact-cli-fix-safety.test.ts` |
| **Rename is one batch** | `jact rename` refuses an unsafe plan before it writes, and rolls back a failed apply | `test/cli-integration/rename-command.test.ts` |
| **Excludes-only backlink screen** | The backlink filter only removes parse candidates; it never adds a backlink | `test/core/LinkedHeaderContext/backlink-candidate-filter.test.ts` |

## Target Users

Core serves jact's own orchestration code and its tests, not end users.

| User | Use Case |
|------|----------|
| **`src/jact-cli.ts`** | Runs extract, fix, and rename through core components |
| **`src/validate/`** | Runs single-file and batch validation through the checker |
| **Test suites** | Inject fakes through the `*Like` interfaces |

## Version History

Each row records one version of this vision.

| Version | Changes |
|---------|---------|
| 1.0.0 | Initial vision for `src/core` |
