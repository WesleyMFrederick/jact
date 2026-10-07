# 002. Architecture

**Status:** done

This section maps the six files in `src/validate/`, the guarantees each holds, and the boundaries between them.

## System Overview

The validate module is an orchestration layer over the shared link checker. Single-file and `--stdin` runs call the workflow through `JactCli`. Batch runs select files first, then call the same workflow once per file.

```
single file / --stdin:
  JactCli ──► ValidationWorkflow ──► outcome ──► JactCli renders report

batch:
  cli.ts ──► resolveFileSet ──► sorted .md list
                │  (globs, paths, --changed via git status)
                ▼
         runBatch ──► ValidationWorkflow (one file at a time)
                │
                ▼
         BatchSummary ──► renderHuman | renderJson

ValidationWorkflow:
  prepareScope ──► ParsedFileCache ──► disabled? ──yes──► skipped
                                          │no
                                          ▼
                      CitationValidator ──► --lines filter ──► completed
  any thrown error ──► failed
```

The step order is canonical in [Validate Workflow (single file)](../../../../docs/spec/006-behavior.md#Validate%20Workflow%20(single%20file)) and [Validate Workflow (batch)](../../../../docs/spec/006-behavior.md#Validate%20Workflow%20(batch)).

---

## Components

Each file owns one job and states the guarantees it holds.

### `validation-workflow.ts` — single-input workflow

`ValidationWorkflow` checks one file or one in-memory document and returns a `completed`, `skipped`, or `failed` outcome.

- **Never throws.** Every error becomes a `failed` outcome with the message, so each caller picks its own exit code.
- **Skip before check.** A disabled document returns `skipped` before link checks, nested-codeblock checks, or the line filter.
- **Intended path for memory input.** `--stdin` content resolves scope and relative links from its stated path, and the module never reads that path from disk.
- **Line filter recomputes totals.** `--lines` filters links, then rebuilds the summary from the kept links only.

Tests: `test/unit/jact-validate-stdin.test.ts`, `test/validate/validate-integration.test.ts`, `test/cli-integration/plain-path-validate.test.ts`.

Boundary: the workflow returns data and never formats output; `JactCli` renders notices, reports, and hints.

### `validation-disable.ts` — opt-out directive

This file holds the disable directive text, the skip reason, and the tree check that finds the directive.

- **Exact first body node.** Only an exact `<!-- jact-validate-disable -->` HTML node counts, with at most one YAML frontmatter node before it.
- **One skip reason.** Validation and `--fix` print the same reason string.

Tests: `test/core/MarkdownParser/parser-output-contract.test.js`, `test/validate/validate-integration.test.ts`.

Boundary: it imports only syntax-tree types, so the parser adapter (`src/core/MarkdownParser/mdastAdapter.ts`) and `src/core/apply-citation-fixes.ts` can import it without a cycle.

### `resolve-files.ts` — file-set selection

`resolveFileSet` turns explicit paths, globs, and `--changed` into one list of absolute `.md` paths.

- **Named files bypass ignore rules.** An existing file named on the command line is kept even if `.gitignore` or `.jactignore` excludes it.
- **Sweeps obey ignore rules.** Globs, folders, and `--changed` results drop ignored paths.
- **`--changed` only adds.** It never removes a path-selected file. A glob that matches nothing is tolerated when `--changed` adds a file.
- **Empty is an error, with one exception.** An empty selection throws `NoFilesMatchedError`, except `--changed` alone with no changes.

Tests: `test/validate/resolve-files.test.ts`, `test/validate/resolve-changed-files.test.ts`.

Boundary: it selects files and never opens them; non-Markdown matches drop out silently.

### `resolve-changed-files.ts` — git-changed files

`resolveChangedFiles` reads `git status --porcelain` and returns staged, unstaged, and untracked `.md` paths.

- **Rename resolves to the new path.** A renamed entry yields its destination.
- **Not a repository is an error.** A failed `git` call throws `NotAGitRepositoryError`.

Tests: `test/validate/resolve-changed-files.test.ts`.

Boundary: tests replace `git` through the injected `RunGit` function, never by mocking `node:child_process`.

### `batch-runner.ts` — batch run

`runBatch` calls an injected single-file function on each file in order and totals the results into a `BatchSummary`.

- **Sequential.** One file at a time; the shared file cache and parsed-document cache never race.
- **Pass means zero errors.** A file passes when its error count is zero; warnings never fail a file.
- **Skips counted apart.** A skipped file is `ok` but adds to `skipped`, never to `passed`.
- **One failed outcome stops the batch.** The `src/cli.ts` adapter throws on a `failed` outcome, so an unreadable file ends the run with exit `2` and no report.

Tests: `test/validate/batch-runner.test.ts`, `test/validate/validate-integration.test.ts`.

Boundary: it never imports `CitationValidator`; the caller builds one workflow per batch run and passes it in.

### `renderers.ts` — batch reports

`renderHuman` and `renderJson` are two views of one `BatchSummary`. Shapes: [Output — batch, human (default)](../../../../docs/spec/005-interfaces.md#Output%20—%20batch,%20human%20(default)).

- **Collapse changes display only.** Above five total errors, human output collapses; the summary and exit code stay the same.
- **JSON Lines (JSONL) stays complete.** `renderJson` never collapses.
- **Terminal-safe text.** Human output passes each file path and error message through `terminalText` before it prints.

Tests: `test/validate/renderers.test.ts`.

Boundary: renderers read the summary and never decide the exit code.

---

## Boundary

The module selects, runs, and reports; it never decides link validity, parses Markdown, or writes files. `src/cli.ts` owns flags, mode selection, and exit codes. Fixes and plain-text path conversion live in `src/core/`.

---

## Version History

Each row records one version of this architecture section.

| Version | Changes |
|---------|---------|
| 1.0.0 | First module architecture |
