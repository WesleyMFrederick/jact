# 005. Interfaces

**Status:** done

The CLI is the entire public surface — jact ships no HTTP API and no plugin ABI. `src/cli.ts` owns Commander registration; `src/jact-cli.ts` (`JactCli` class) owns orchestration and is independently importable without activating Commander (`src/jact-cli.ts:1-8`).

## `jact validate`

```
jact validate [paths...] [options]
```

**Arguments:**

| Arg | Meaning |
|---|---|
| `paths...` | Zero or more markdown file paths and/or glob patterns; omit when using `--changed` alone. With `--stdin`, exactly one path — the intended on-disk path, not read from disk. |

**Options** (`src/cli.ts:113-164`):

| Flag | Default | Description |
|---|---|---|
| `--format <type>` | `cli` | Output format: `cli` or `json` (single-file mode only) |
| `--lines <range>` | - | Validate a specific line range, e.g. `150-160` or `157` |
| `--scope <folder>` | smart default | Limit file resolution to a folder (enables smart filename matching) |
| `--fix` | - | Auto-fix citation anchors/paths, including kebab-case conversions |
| `--dry-run` | - | Preview `--fix` changes without writing files |
| `--verbose` | `false` | Full validation report (all valid citations, duplicate-filename warnings, summary block) instead of minimal errors/warnings-only output |
| `--allow-gitignore` | `false` | Include `.gitignore`-excluded files in the scope scan |
| `--changed` | `false` | Union git working-tree-modified markdown into the selection (batch mode) |
| `--json` | `false` | Batch mode: emit one compact JSON object per file (JSONL) |
| `--stdin` | - | Read markdown from stdin; `<path>` is the intended path, not read from disk |

**Mode selection:** batch mode triggers when `paths.length > 1`, `--changed`, `--json`, or any path is a glob pattern (`cli.ts:225-229`). Otherwise it's single-file mode, unchanged from pre-batch behavior.

**`--stdin` constraints** (`cli.ts:210-223`): exactly one path required; incompatible with any batch-mode trigger (multiple paths, glob, `--changed`, `--json`) — violating either exits 2 with an explicit error.

**`--json` + `--format json` conflict** (`cli.ts:202-208`): passing both exits 2 — they are different shapes (single-file rich JSON vs. batch JSONL) and cannot compose.

### Examples

```bash
jact validate docs/design.md                    # single file, minimal output
jact validate docs/design.md --verbose           # full valid-citation tree
jact validate file.md --format json              # single-file JSON
jact validate file.md --lines 100-200
jact validate file.md --fix --scope ./docs
jact validate file.md --fix --dry-run            # preview fixes, no writes
jact validate "concepts/*.md"                    # glob batch mode
jact validate a.md b.md c.md                     # explicit multi-path batch
jact validate --changed                          # all markdown you edited
jact validate "**/*.md" --json                   # JSONL for CI/agents
cat draft.md | jact validate <path> --stdin      # validate unwritten content
```

### Output — single-file, human (default, minimal)

```
OK: <N> citations valid
```
or, with errors/warnings:
```
ERRORS (n)
...
WARNINGS (n)
...
FAILED: X errors, Y warnings
```

### Output — batch, human (default)

One line per file, plus a summary line (`src/validate/renderers.ts:20-34`):

```
✅ concepts/bar.md
❌ concepts/foo.md
   Line 94: File not found: concepts/attention-mechanism
---
2 files · 1 passed · 1 failed
```

### Output — batch, `--json` (JSONL)

One compact JSON object per line, no summary line (`renderers.ts:56-58`):

```json
{"path":"concepts/foo.md","ok":false,"errors":[{"line":94,"message":"File not found: concepts/attention-mechanism"}]}
{"path":"concepts/bar.md","ok":true,"errors":[]}
```

---

## `jact ast <file>`

```
jact ast <file> [--scope <folder>]
```

Displays the parsed markdown AST and extracted citation metadata (links, headings, anchors) as JSON, for debugging. Output includes the full `ParserOutput` contract — see [004-domain-model.md](004-domain-model.md#ParserOutput).

```bash
jact ast docs/design.md
jact ast file.md | jq '.links'
jact ast file.md | jq '.anchors | length'
jact ast plan.md --scope ./other-repo    # explicit scope override
```

---

## `jact extract links <source-file>`

```
jact extract links <source-file> [options]
```

| Flag | Default | Description |
|---|---|---|
| `--scope <folder>` | smart default | Folder search matches |
| `--format <type>` | `json` | Output format (reserved for future) |
| `--full-files` | - | Enable full-file link extraction (default: sections only) |
| `--session <id>` | - | Session ID for cache deduplication (skips extraction on cache hit) |
| `-v, --verbose` | `false` | Include `outgoingLinksReport` + `stats` in output |

Validates every link in the source document first, then extracts referenced content (section, block, or full file per link) with deduplication. Output is `OutgoingLinksExtractedContent` JSON — see [004-domain-model.md](004-domain-model.md#Extraction%20Types%20%28%60src/types/extraction-types.ts%60%29).

**Exit codes:** `0` at least one link extracted successfully (or cache hit via `--session`); `1` no eligible links / all extractions failed; `2` system error.

```bash
jact extract links docs/design.md
jact extract links docs/design.md --full-files
jact extract links docs/design.md --session abc123
jact extract links file.md | jq '.stats.compressionRatio'
```

---

## `jact extract header <target-file> <header-name>`

```
jact extract header <target-file> <header-name> [options]
```

Builds a synthetic header link via `LinkObjectFactory.createHeaderLink()`, validates it, extracts the section content. `--format` choices: `markdown` (default) or `json` (`cli.ts:428-432`).

**Exit codes:** `0` header extracted; `1` header not found or validation failed; `2` system error.

```bash
jact extract header plan.md "Task 1: Implementation"
jact extract header docs/guide.md "Overview" --scope ./docs
jact extract header file.md "Design" | jq '.extractedContentBlocks'
```

---

## `jact extract file <target-file>`

```
jact extract file <target-file> [options]
```

Builds a synthetic full-file link via `LinkObjectFactory.createFileLink()`, validates it, extracts the entire file content. `--format` is `json` only.

---

## `jact:base-paths` (npm script, not a jact subcommand)

`package.json` defines `jact:base-paths` as a shell wrapper: `extract links "$1" --verbose | jq -r '.outgoingLinksReport.processedLinks[] | select(.sourceLink.target.path.absolute) | .sourceLink.target.path.absolute' | sort -u`. There is no `jact base-paths` command in `src/cli.ts` — it is composed entirely from `extract links --verbose` plus `jq`.

---

## Exit Codes

| Code | When |
|---|---|
| `0` | Success — all citations valid (validate), all files passed (batch), extraction produced content |
| `1` | Validation/extraction failure — errors found, no eligible links, header not found |
| `2` | System/usage error — file not found, permission denied, parse error, bad flag combination, glob matched nothing and nothing else was selected, not a git repository |

Exit code `2` is consistent across `validate`, `ast`, and `extract` for system-level failures — this is a deliberate compatibility guarantee (batch-validate feature ADR D4, `design-docs/features/20260701T041917-batch-validate/spec/003-adrs.md`).

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0-draft | 2026-07-01 | Initial interfaces doc, grounded in `src/cli.ts` |
