# 005. Interfaces

**Status:** done

The CLI is the entire public surface — jact ships no HTTP API and no plugin ABI. `src/cli.ts` owns Commander registration; `src/jact-cli.ts` (`JactCli` class) owns orchestration and is independently importable without activating Commander (`src/jact-cli.ts:1-8`).

## `jact validate`

```
jact validate [paths...] [options]
```

Reads Markdown notes and validates their existing citations plus plain file references to Markdown and non-Markdown files. Plain references include prose paths, inline and fenced code paths, and command arguments; non-Markdown targets are checked on disk, not parsed as Markdown.

Plain-path resolution checks exact note-relative and scope-relative candidates, including explicit absolute and tilde paths. It never infers a target by basename or fuzzy filename matching. Missing files and ambiguous exact candidates are reported, not silently repaired or selected. Existing links, definitions, wiki references, and citations are not scanned again as plain paths; URLs, globs, and template placeholders are excluded.

Validation is read-only unless `--fix` is supplied; `--fix --dry-run` also writes nothing. For plain references, `--fix` converts prose `.md` paths into Markdown links while preserving any `#anchor` or `:line` suffix. Commands, inline code, fenced code, and non-Markdown references retain their text formatting; their file targets are still checked. The conversion policy for generic unmarked command lines awaits USER approval and is not finalized here.

**Arguments:**

| Arg | Meaning |
|---|---|
| `paths...` | Zero or more markdown file paths and/or glob patterns; omit when using `--changed` alone. With `--stdin`, exactly one path — the intended on-disk path, not read from disk. |

**Options** (`src/cli.ts:113-164`):

| Flag | Default | Description |
|---|---|---|
| `--format <type>` | `cli` | Output format: `cli` or `json` (single-file mode only) |
| `--lines <range>` | - | Validate a specific line range, e.g. `150-160` or `157` |
| `--scope <folder>` | smart default | Bounds file resolution; plain paths use exact note-relative and scope-relative candidates, without fuzzy guessing |
| `--fix` | - | Apply existing citation anchor/path fixes and convert prose `.md` paths into links; preserve command/code and non-Markdown text formatting |
| `--dry-run` | - | Preview `--fix` changes without writing files |
| `--no-backup` | backup on | With `--fix`, do not write the timestamped `.bak` backup |
| `--verbose` | `false` | Full validation report, including valid references and all diagnostic candidates, instead of minimal errors/warnings-only output |
| `--allow-gitignore` | `false` | Include `.gitignore`-excluded files in the scope scan |
| `--changed` | `false` | Union git working-tree-modified markdown into the selection (batch mode) |
| `--json` | `false` | Batch mode: emit one compact JSON object per file (JSONL) |
| `--stdin` | - | Read markdown from stdin; `<path>` is the intended path, not read from disk |

**Mode selection:** batch mode triggers when `paths.length > 1`, `--changed`, `--json`, or any path is a glob pattern (`cli.ts:225-229`). Otherwise it's single-file mode, unchanged from pre-batch behavior.

**`--stdin` constraints** (`cli.ts:210-223`): exactly one path required; incompatible with any batch-mode trigger (multiple paths, glob, `--changed`, `--json`) — violating either exits 2 with an explicit error.

**`--json` + `--format json` conflict** (`cli.ts:202-208`): passing both exits 2 — they are different shapes (single-file rich JSON vs. batch JSONL) and cannot compose.

**Document opt-out:** `<!-- jact-validate-disable -->` skips the whole document only when it is the first Markdown body block, with at most one parser-recognized YAML frontmatter block before it. The directive must be an exact HTML comment node; a later, fenced, quoted, or near-match comment does not disable validation. This applies to file, `--stdin`, batch, and `--fix` workflows.

### Examples

```bash
jact validate docs/design.md                    # single file, minimal output
jact validate docs/design.md --verbose           # full valid-citation tree
jact validate file.md --format json              # single-file JSON
jact validate file.md --lines 100-200
jact validate file.md --fix --scope ./docs
jact validate file.md --fix --dry-run            # preview fixes, no writes
jact validate file.md --fix --no-backup          # fix without a .bak file
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
or, when the document opts out:
```
SKIPPED: validation disabled by document directive
```
or, with errors/warnings:
```
ERRORS (n)
...
WARNINGS (n)
...
FAILED: X errors, Y warnings
```

Duplicate-filename errors show at most five ranked scope-relative candidates by default, followed by the omitted count and guidance to use `--verbose` or narrow `--scope`. `--verbose` shows every ranked candidate. The same limit applies to the rich single-file JSON suggestion string; internal ranking metadata is not serialized.

Plain-path diagnostics identify the source location and missing target or ambiguous exact candidates. Candidate display does not authorize choosing a target; existing citation duplicate-filename ranking is not a plain-path resolution fallback.

### Output — batch, human (default)

When a batch has at most five errors in total, output retains one status line per file, full error details, and the file-count summary (`src/validate/renderers.ts`):

```
SKIPPED: examples/example.md (validation disabled by document directive)
✅ concepts/bar.md
❌ concepts/foo.md
   Line 94: File not found: concepts/attention-mechanism
---
3 files · 1 passed · 1 failed · 1 skipped
```

When a batch has more than five errors, default output collapses the details and omits passing and skipped file lines. It reports every failing file with that file's error count, preserves the totals, explains the five-error display limit, and prints commands for single-file validation, line filtering, fix preview/application, full `--verbose` expansion, and help discovery:

```
❌ concepts/foo.md (8 errors)
❌ concepts/baz.md (2 errors)
---
3 files · 1 passed · 2 failed · 0 skipped

10 error details hidden because they exceed the default 5-error display limit.
To Drill Into a File: run `jact validate "{{path-to-file}}"`
...
```

`--verbose` bypasses this collapse and renders every file and error. The collapse changes presentation only: any batch with `failed > 0` still exits `1`.

### Output — batch, `--json` (JSONL)

One complete compact JSON object per line, no summary line (`src/validate/renderers.ts`). JSONL does not apply the human display collapse. Skipped rows have `ok: true`, an empty error list, and `skipped: true`; they do not increment `passed`.

```json
{"path":"examples/example.md","ok":true,"errors":[],"skipped":true}
{"path":"concepts/foo.md","ok":false,"errors":[{"line":94,"message":"File not found: concepts/attention-mechanism"}]}
{"path":"concepts/bar.md","ok":true,"errors":[]}
```

---

## `jact rename <source...> <destination>`

```
jact rename <source...> <destination> [options]
```

Previews or applies one guarded batch move. Each source is an arbitrary existing file, a quoted glob, or a directory; existing paths are treated literally before glob expansion. The whole request is one plan: parsed links and incoming plain paths from Markdown notes in scope, relationships between moved notes, and outgoing references in moved Markdown notes are rewritten relative to their final locations. Non-Markdown source files can move without their contents being parsed or rewritten. Rewrites that leave reference text unchanged (for example, two siblings moved together) are not counted.

Plain references use exact pre-move disk resolution, not basename or fuzzy guessing. Rewrites preserve `#anchor` and `:line` suffixes, enclosing quotes/backticks, code formatting, and executable command syntax, including command prefixes such as `/goal plan:`. Rename changes path text; it does not convert plain references into Markdown links. Already-broken references unaffected by the move remain unchanged; an outgoing reference needed for a safe rewrite must have an unambiguous target.

Destination rules, matching `mv`:

- One file source, Markdown or not: `<destination>` is a file path, a directory (existing, or written with a trailing `/`), or a bare filename that keeps the source directory.
- One directory source: the tree moves to `<destination>/<dirname>` when `<destination>` is an existing directory, otherwise to `<destination>`. Every file in the tree moves, Markdown or not, and relative paths inside it are preserved.
- Several sources, or any glob: `<destination>` is a directory; each source lands at `<destination>/<basename>`.

Missing destination directories are listed in the preview and created on `--fix`.

| Flag | Default | Description |
|---|---|---|
| `--scope <folder>` | smart default (inferred from the first source) | Bounds sources, destinations, and backlink discovery |
| `--fix` | `false` | Apply moves and reference edits; omission is a read-only preview |
| `--json` | `false` | Emit the structured rename result for the whole batch |
| `--allow-gitignore` | `false` | Include ignored Markdown notes while discovering incoming links and plain paths |

The plan is refused (exit `1`, nothing written) when:

- a source does not exist, is outside scope, or is neither a file nor a directory
- a glob matches no eligible files
- a destination exists, leaves scope, equals its source, or two sources map to the same destination
- a directory would move into itself, one source sits inside another directory source, or one destination sits inside another moved directory
- a moved note's outgoing cross-document link or selected plain path cannot resolve unambiguously, because its post-move path is unknown
- a move would break an image embed (see below)

**Non-Markdown files.** Any existing file can be selected directly or carried by a directory or batch move. Parsed links — `[text](file.pdf)`, `[[dir/file.png]]` — and plain paths in Markdown notes are rewritten when their targets move, including non-Markdown targets. Non-Markdown references retain their plain/code formatting. Image embeds (`![alt](path)`, `![[dir/file]]`) remain outside jact's link model and are not treated as plain paths: rename cannot rewrite them and `jact validate` cannot check them. Before writing, rename scans every Markdown file in scope (and every moved one) for image embeds whose target would no longer resolve after the moves and refuses the plan, listing each `file:line`. Embeds inside a moved directory that point into the same tree keep working because the tree's shape is preserved, and bare-name `![[file.png]]` embeds resolve by name in Obsidian, so neither blocks a move.

On apply, jact preserves the existing backup behavior: it backs up every edited file and every moved `.md` source file, stages edits, writes them, creates missing directories, and moves files and whole directories. It then verifies every rewritten relationship at its final location against the planned target: parsed links are re-parsed, and plain paths are checked with exact disk resolution rather than relying on the citation parser. Any failure undoes completed moves, removes the created directories, restores edited files, and exits `2`; backups stay on disk. Backups of files inside a moved directory move with it, and reported backup paths are final locations.

**JSON result.** One object per request: `scope`, `applied`, `moves` (`kind` `file` or `directory`, `source`, `destination`, and `movedFiles` for directories), `directories` (missing directories, outermost first), `links`, `files` (`path` at its final location, `links`), and `backups`. A single file source without a glob also carries the original top-level `source` and `destination` fields; human output for that case keeps its `Source:`/`Destination:` lines, while batches print a `Moves:` list.

```bash
jact rename docs/old.md new.md --scope .                 # preview same-directory rename
jact rename docs/old.md archive/ --scope . --fix         # move, retaining old.md
jact rename docs/old.md archive/new.md --scope . --fix   # move and rename
jact rename a.md b.md new/dir/ --fix                     # several files into a new directory
jact rename "concepts/*.md" archive/concepts/            # glob into a directory
jact rename notes/old-folder archive/ --fix              # move a whole directory tree
jact rename data/results.json archive/ --scope . --fix   # move a non-Markdown file
jact rename plan.md data/results.json archive/ --fix     # mixed file types in one batch
jact rename "data/*.json" archive/data/ --scope .        # non-Markdown glob preview
```

**Exit codes:** `0` preview or apply succeeded; `1` invalid or unsafe plan with no writes; `2` file-system, parse, commit, or rollback failure.

---

## `jact outline <file> [level]`

```
jact outline <file> [level] [options]
```

Displays a parser-derived, quoted heading outline. The optional positional `level` accepts `H1` through `H6`, defaults to `H2`, and is an inclusive ceiling. For example, positional `H3` shows H1 through H3. The exact-filter and source-line behavior follows [ADR-0006 — Exact heading-level filtering and source lines](../adrs/adr-0006-exact-heading-level-and-source-lines.md#ADR-0006 — Exact heading-level filtering and source lines).

| Flag | Default | Description |
|---|---|---|
| `--exact-heading-level <level>` | - | Show only headings at one level (`H1` through `H6`); positional `level` semantics stay unchanged |
| `-n, --line-number` | `false` | Prefix each heading with its parser-derived, one-based source line |
| `--expand <headings>` | - | Fully expand comma-separated heading branches |
| `--within <parent>` | - | Limit the outline and heading resolution to one parent branch |
| `--cache-reset` | `false` | Show next-step reminders again for the active session and target |
| `--scope <folder>` | smart default | Folder search matches |

Exact-level output excludes all other heading levels and does not mark deliberately filtered descendants as collapsed. Line-number output uses a right-aligned six-character line field followed by two spaces. If a visible heading has no parser source position, the command fails clearly instead of re-scanning Markdown.

The first successful outline for a session and file also shows concise next-step commands: expand collapsed branches when present, show only the selected level with source lines via `--exact-heading-level` and `-n`, extract a section, and discover the remaining outline options via `jact outline -h`. The reminder revision is part of its cache namespace, so newly added guidance appears once after an upgrade instead of being hidden by an older reminder marker.

```bash
jact outline docs/guide.md
jact outline docs/guide.md H3
jact outline docs/guide.md --exact-heading-level H3 --line-number
jact outline handbook.md H2 --expand "Install" --within "Guide"
```

**Exit codes:** `0` outline rendered, including a valid file with no headings; `1` heading selector missing, ambiguous, or unsupported; `2` file lookup, scope, permission, parse, or source-position error.

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

Builds a synthetic header link via `LinkObjectFactory.createHeaderLink()`, validates it, and extracts the section content. The default `markdown` output prefixes every extracted line in `cat -n` format: a right-aligned six-character source line followed by a tab. `--format json` preserves raw content and returns the structured extraction contract.

`--extract-linked-content [depth]` also extracts linked sections, blocks, and whole markdown files, following links to `depth` (default `1`, minimum `1`), and lists backlinks to the header across the scope. The markdown output labels every block with `Source: file:start-end` and, for linked blocks, `Via: file:line` (the link that pulled it in). The same next-step hints and `--max-chars` content map as [`jact extract file <target-file>`](#`jact extract file <target-file>`) apply; the header map keeps the backlinks and failures lists.

**Exit codes:** `0` header extracted (and all linked content resolved); `1` header not found, validation failed, or some linked content failed to resolve; `2` system error.

```bash
jact extract header plan.md "Task 1: Implementation"
jact extract header docs/guide.md "Overview" --scope ./docs
jact extract header file.md "Design" --format json | jq '.extractedContentBlocks'
jact extract header plan.md "Overview" --extract-linked-content 2
```

---

## `jact extract file <target-file>`

```
jact extract file <target-file> [options]
```

Builds a synthetic full-file link via `LinkObjectFactory.createFileLink()`, validates it, and extracts the entire file content. The default `markdown` output prefixes every line in `cat -n` format using its original one-based source line. `--format json` returns the structured extraction contract with raw, unnumbered content.

`--extract-linked-content [depth]` also extracts what the file links to, following linked files up to `depth` levels (whole number ≥ 1; default `1`). Linked section and block links extract that section or block; full-file links to `.md` files extract the file and, while depth remains, its links. Each file is followed once, so link cycles end. Links marked `%%stop-extract-link%%` are neither extracted nor followed. Without the option, only the target file is extracted.

If a linked target cannot be extracted (file not found, anchor not found, or file not readable), jact still extracts the other links, lists each failed link as `file:line — reason` under `## Failures` (on stderr as `Failures:` for `json`), and exits `1`. Stop-marker links are intentional skips, not failures.

After the content, `jact outline`-style next-step hints follow — on stdout for `markdown`, on stderr for `json` so stdout stays parseable. A `[+] … To Go Deeper` hint with the next depth appears only when the depth limit cut off links that would add content.

`--max-chars <n>` (default `28000`, whole number ≥ 1) caps `markdown` output from `--extract-linked-content`. When the full output would exceed it, jact prints a **content map** instead: one row per block with its `Source`, `Via`, character count, and a command that loads only that block (`jact extract header` for section links, `jact extract file` for whole-file links, a line range for block links). A `To Print Everything Anyway` hint gives the `--max-chars` value that prints it all. The default fits a default Claude Code Bash result, which shows 30,000 characters inline. `json` output is never replaced.

```bash
jact extract file docs/architecture.md
jact extract file docs/architecture.md --format json | jq '.extractedContentBlocks'
jact extract file docs/plan.md --extract-linked-content
jact extract file docs/plan.md --extract-linked-content 2
jact extract file docs/plan.md --extract-linked-content --max-chars 100000
```

---

## `jact:base-paths` (npm script, not a jact subcommand)

`package.json` defines `jact:base-paths` as a shell wrapper: `extract links "$1" --verbose | jq -r '.outgoingLinksReport.processedLinks[] | select(.sourceLink.target.path.absolute) | .sourceLink.target.path.absolute' | sort -u`. There is no `jact base-paths` command in `src/cli.ts` — it is composed entirely from `extract links --verbose` plus `jq`.

---

## Exit Codes

| Code | When |
|---|---|
| `0` | Success — citations and plain file references valid, files passed, extraction produced content, or outline rendered |
| `1` | Validation/extraction/selection failure — errors found, no eligible links, header not found, or outline selector unresolved |
| `2` | System/usage error — file not found, permission denied, parse error, missing requested source position, bad flag combination, glob matched nothing and nothing else was selected, or not a git repository |

Exit code `2` is consistent across `validate`, `outline`, `ast`, and `extract` for system-level failures — this is a deliberate compatibility guarantee (batch-validate feature ADR D4, `design-docs/features/20260701T041917-batch-validate/spec/003-adrs.md`).

Single-file `validate` sets `process.exitCode` and does not call `process.exit()`. Node writes the full report to a piped stdout (for example, `jact validate file.md --format json | jq`) before the process exits, including reports larger than 64KB.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0-draft | 2026-10-06 | Approved plain-path validation and prose Markdown conversion contract; arbitrary-file rename/move with plain-path rewrites, exact resolution, suffix/command preservation, and post-transaction verification |
| 1.0.0-draft | 2026-09-25 | Added `validate --fix --no-backup`; `--fix` no longer counts or reports fixes that leave a citation unchanged |
| 1.0.0-draft | 2026-09-25 | Single-file `validate` writes its complete report to a piped stdout; before, output stopped at 64KB |
| 1.0.0-draft | 2026-09-25 | `extract file --extract-linked-content` lists links it could not extract under `## Failures` and exits `1`, instead of skipping them without a message |
| 1.0.0-draft | 2026-09-25 | Added `--extract-linked-content [depth]` to `extract file` and `extract header` (replaces `extract header --linked-context`) with depth-limited link following, `Source:`/`Via:` labels, and next-step hints; linked section and block content now carries source start lines; both commands print a content map above `--max-chars` |
| 1.0.0-draft | 2026-08-13 | Made numbered markdown the default output for `extract header` and `extract file`; explicit JSON remains raw |
| 1.0.0-draft | 2026-08-02 | Added five-error batch disclosure threshold, failing-file error counts, drill/filter/fix guidance, and verbose expansion without changing exit codes |
| 1.0.0-draft | 2026-08-02 | Added bounded duplicate-path diagnostics, verbose expansion, and explicit document-skip output |
| 1.0.0-draft | 2026-07-31 | Added contextual outline next-step guidance for exact-level filtering, source lines, extraction, expansion, and help discovery |
| 1.0.0-draft | 2026-07-31 | Added parser-derived outline interface, exact heading-level filtering, and source-line prefixes |
| 1.0.0-draft | 2026-07-01 | Initial interfaces doc, grounded in `src/cli.ts` |
