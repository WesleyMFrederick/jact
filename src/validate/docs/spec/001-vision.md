# 001. Vision

**Status:** done

## What the validate Module Is

The validate module is the one workflow behind `jact validate`. It takes one Markdown file, in-memory content, or a file set, checks each document's links, and returns a result. Callers render the result; the module never prints a single-file report itself.

### What It Does

The module selects files, checks links, and reports one result per file.

1. **Single-input workflow** — scope, parse, opt-out check, link check, and line filter for one file or for `--stdin` content
2. **File-set selection** — globs, explicit paths, and git-changed Markdown resolved into one sorted, deduplicated list
3. **Batch run** — one file at a time through the same single-input workflow, totaled into a batch summary
4. **Batch reports** — a human view and a JSON Lines (JSONL) view of the same summary

### What It Is Not

The module orchestrates; other modules hold the logic.

- Not a link checker — `CitationValidator` decides if a link is valid
- Not a parser — `MarkdownParser` builds the syntax tree and finds links
- Not a fixer — `--fix` lives in `src/core/apply-citation-fixes.ts`
- Not a plain-text path scanner — `src/core/plain-file-paths.ts` serves `--fix` and `jact rename` only
- Not the command-line interface (CLI) — `src/cli.ts` owns flags, mode selection, and exit codes

## Design Principles

Three principles keep the module safe to run on any note.

### 1. Link Syntax Only

**Principle:** Only Markdown link syntax is a link target.

**Implications:**
- Markdown links, reference definitions, wiki links, and citations are checked
- Plain text, inline code, and fenced code never produce an error
- The full rule: [`jact validate`](../../../../docs/spec/005-interfaces.md#%60jact%20validate%60)

### 2. One Workflow, Many Entry Points

**Principle:** File, `--stdin`, and batch validation share one `ValidationWorkflow`.

**Implications:**
- A batch file gets the same result as the same file run alone
- A fix to the workflow reaches every entry point at once

### 3. Read-Only by Default

**Principle:** Validation reads files and writes nothing.

**Implications:**
- The repo guarantee: [Core Guarantees](../../../../docs/spec/001-vision.md#Core%20Guarantees)
- Writes happen only in the `--fix` path, outside this module

## Core Guarantees

Six guarantees hold for every caller; the architecture section names the enforcing tests.

| Guarantee | Description |
|-----------|-------------|
| **Never writes** | No module file writes to disk; the workflow reads, parses, and returns |
| **Link syntax only** | Prose and code that look like paths produce no error |
| **Exact opt-out** | Only the parser-derived disable flag skips a document |
| **Skips are not passes** | A skipped file counts as `skipped`, never as `passed` |
| **Stable order** | Every file list is absolute, deduplicated, and sorted |
| **Sequential batch** | One file at a time, so shared caches never race |

## Target Users

Two caller groups use the module.

| User | Use Case |
|------|----------|
| **Writers and agents** | Check notes before a commit, or check unsaved content via `--stdin` |
| **Continuous integration (CI) and hooks** | Check many files and parse one JSON object per file |

## Version History

The vision is at version 1.0.0.

| Version | Changes |
|---------|---------|
| 1.0.0 | First module vision |
