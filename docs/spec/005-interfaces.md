# 005. Interfaces

**Status:** done

The command-line interface (CLI) is the public user surface of jact; validation plugins extend its rule checks. jact ships no HTTP API. Commands, flags, exit codes, printed output, and JSON shapes in this section are contracts: hooks, scripts, and agents depend on them. `src/cli.ts` registers every command; `jact <command> --help` prints its flags and usage examples.

Each command that takes `--scope <folder>` defaults to a smart scope. The order is in [Scope Resolution Order](006-behavior.md#Scope%20Resolution%20Order).

## `jact validate`

```
jact validate [paths...] [options]
```

`jact validate` checks the link syntax of Markdown notes and reports broken links and anchors. It checks Markdown links, reference definitions, wiki links, and citations. Plain text, inline code, and fenced code are never link targets. A word that contains `/` or `.`, a slash command, or a path in prose or code never produces an error.

Validation writes no files unless `--fix` is set. `--fix --dry-run` also writes nothing. `--fix` converts a prose `.md` path into a Markdown link only when exactly one existing file matches an exact note-relative or scope-relative candidate. It never guesses by basename or fuzzy match, and it keeps any `#anchor` or `:line` suffix. jact leaves unresolved, ambiguous, code, command, and non-Markdown text unchanged and does not report it. URLs, globs, template placeholders, and existing link syntax are never converted.

**Arguments:**

| Arg | Meaning |
|---|---|
| `paths...` | Zero or more Markdown file paths or glob patterns. Omit with `--changed` alone. With `--stdin`, exactly one path: the intended on-disk path, which jact does not read. |

**Options:**

| Flag | Default | Description |
|---|---|---|
| `--format <type>` | `cli` | `cli` or `json`; single-file mode only |
| `--lines <range>` | - | Check one line range, such as `150-160` or `157` |
| `--scope <folder>` | smart default | Bounds file resolution and `--fix` prose-path candidates |
| `--fix` | - | Single-file mode only: apply citation anchor and path fixes, and convert resolved prose `.md` paths into links |
| `--dry-run` | - | With `--fix`, print a diff and write nothing |
| `--no-backup` | backup on | With `--fix`, skip the timestamped `.bak` backup |
| `--verbose` | `false` | Full report with valid links and every duplicate-file candidate; in batch mode, expand collapsed error details |
| `--allow-gitignore` | `false` | Include `.gitignore`-excluded files in the scope scan |
| `--changed` | `false` | Add git working-tree-modified Markdown to the selection (batch mode) |
| `--json` | `false` | Batch mode: print one compact JSON object per file (JSON Lines, JSONL) |
| `--stdin` | - | Read Markdown from standard input; the one path argument is the intended path |

**Mode selection:** batch mode runs when there is more than one path, any path is a glob, or `--changed` or `--json` is set. Otherwise jact runs in single-file mode. Batch mode ignores `--format`.

**Usage errors (exit `2`):** `--stdin` with zero or several paths, or with any batch trigger; `--json` together with `--format json`; `--fix`, `--dry-run`, or `--no-backup` together with any batch trigger or with `--stdin`. The two JSON outputs have different shapes and cannot combine. On a usage error jact validates nothing and writes nothing.

**Document opt-out:** `<!-- jact-validate-disable -->` skips the whole document only when it is the first Markdown body block. At most one YAML frontmatter block may come before it. The directive must be an exact HTML comment node; a later, fenced, quoted, or near-match comment does not count. The opt-out applies to file, `--stdin`, batch, and `--fix` runs.

### Validation configuration and presets

`jact validate` reads `$XDG_CONFIG_HOME/jact/config.json`. If `XDG_CONFIG_HOME` is unset or empty, it reads `~/.config/jact/config.json`. The nearest `.jact/config.json` overrides that user configuration. The search starts in the checked file's folder and walks upward. Other ancestor project configurations are not merged. Batch mode resolves configuration separately for each file. `--stdin` uses the intended file path.

The configuration keys are:

| Key | Shape | Meaning |
|---|---|---|
| `preset` | string | Select the preset; the project value overrides the user value |
| `rules` | object of rule ID → `"off"` or `"error"` | Override preset defaults; project entries override matching user entries |
| `plugins` | array of strings | User config only; relative paths start at the user config folder, and package names resolve from that folder |

Only the user config may list `plugins`; a project config that lists them exits `2` before any plugin code runs because a downloaded repository could run code with your permissions.

The default preset is `commonmark`, which enables no additional rules. It does not change the parser's supported syntax or turn off ordinary link checks. The `obsidian` preset enables both built-in rules:

| Rule ID | Check |
|---|---|
| `obsidian/no-reference-note-link` | Reject local-file split-style links: `[text][label]`, `[label][]`, and `[label]` with a reference definition. Skip footnotes, `scheme:` URLs such as `https:` and `obsidian:`, same-file `#anchor` definitions, and unused definitions. |
| `obsidian/anchor-dropped-chars` | Enable [Anchors with characters Obsidian drops](006-behavior.md#Anchors with characters Obsidian drops). This check no longer runs with no configuration. |

Setting a rule to `"error"` enables it regardless of preset; `"off"` disables it. For example, a project can keep the Obsidian preset but opt out of one check:

```json
{
  "preset": "obsidian",
  "rules": { "obsidian/no-reference-note-link": "off" }
}
```

Plugins are imported as modules and must default-export `{ rules: [{ id, preset, check }], presets?: string[] }`. Each rule has a unique namespaced ID, a preset name, and a synchronous `check(context)` returning findings. The context supplies the file path, parsed document, and validated links. Rules declare their presets; optional `presets` declares additional names. The same resolved plugin registers once. Plugins execute code in the jact process. Load only trusted modules. The TypeScript contract is `src/types/validationRuleTypes.ts`.

**Configuration errors (exit `2`):** malformed JSON, unknown keys or invalid value shapes, unknown presets or rule IDs, missing or unloadable plugins, invalid default exports, and duplicate rule IDs print `ERROR: <message>` on stderr naming the configuration file or plugin. Configuration for every selected file is resolved before validation begins: jact validates nothing and writes nothing on these errors, including in batch and `--fix` modes.

Rule errors count in `summary.errors` and fail validation with exit `1`. `--lines` filters rule findings as well as links. Rule edits follow [Fix Workflow (`--fix`)](006-behavior.md#Fix Workflow (`--fix`)).


### Output — single-file, human (default, minimal)

Single-file output is one status line, or error and warning blocks with a final count.

```
OK: <N> citations valid
```
or, when the document opts out:
```
SKIPPED: validation disabled by document directive
```
or, with errors or warnings:
```
ERRORS (n)
...
WARNINGS (n)
...
FAILED: X errors, Y warnings
```

`--format json` prints the full validation result: a `summary` object (`total`, `valid`, `warnings`, `errors`), a `links` list, and a top-level `findings` array. Each finding contains `ruleId`, one-based `line`, zero-based `column`, `message`, and optional `source` and `edits`; an edit contains source offsets `start`, exclusive `end`, and `replacement`. Link errors owned by a rule carry `validation.ruleId`. The shared result fields are in [ValidationResult](004-domain-model.md#ValidationResult). A missing file prints `{"error", "file", "success": false}` and exits `2`. Human error lines append `[rule-id]` when owned by a rule.

A duplicate-filename error shows at most five ranked, scope-relative candidates, then the omitted count and a hint to use `--verbose` or a narrower `--scope`. `--verbose` shows every candidate. The JSON suggestion string uses the same limit.

### Output — batch, human (default)

With five or fewer errors in total, batch output shows one status line per file, every error, and a file-count summary.

```
SKIPPED: /abs/examples/example.md (validation disabled by document directive)
✅ /abs/concepts/bar.md
❌ /abs/concepts/foo.md
   Line 94: File not found: concepts/attention-mechanism
---
3 files · 1 passed · 1 failed · 1 skipped
```

With more than five errors, default output collapses. It lists each failing file with its error count, keeps the summary, and explains the five-error display limit. It then prints commands to check one file, filter lines, preview and apply fixes, expand with `--verbose`, and open help.

```
❌ /abs/concepts/foo.md (8 errors)
❌ /abs/concepts/baz.md (2 errors)
---
3 files · 1 passed · 2 failed · 0 skipped

10 error details hidden because they exceed the default 5-error display limit.
To Drill Into a File: run `jact validate "{{path-to-file}}"`
...
```

`--verbose` turns off the collapse. The collapse changes display only: a batch with one or more failed files exits `1`.

### Output — batch, `--json` (JSONL)

`--json` prints one complete JSON object per file, one per line, with no summary line and no collapse.

```json
{"path":"/abs/examples/example.md","ok":true,"errors":[],"skipped":true}
{"path":"/abs/concepts/foo.md","ok":false,"errors":[{"line":94,"message":"File not found: concepts/attention-mechanism"}]}
{"path":"/abs/concepts/bar.md","ok":true,"errors":[]}
```

- `path` — the selected file
- `ok` — `true` when the file has zero errors; warnings never fail a file
- `errors` — one `{line, message}` per link error or rule finding; `line` is `null` for a file-level error. Rule-owned messages end with `[rule-id]`.
- `skipped` — present and `true` only for an opted-out file, which does not count as passed

---

## `jact rename <source...> <destination>`

```
jact rename <source...> <destination> [options]
```

`jact rename` previews or applies one guarded batch move and rewrites every affected reference. A source is an existing file of any type, a quoted glob, or a directory. An existing source path is literal, even when its name contains brackets. Only a source that does not exist expands as a glob, and only to regular files that pass ignore rules.

One request is one plan. jact rewrites, relative to final locations:

- parsed links and plain paths in in-scope Markdown notes that point at a moved file
- outgoing references in moved Markdown notes
- references between moved notes

jact never parses or rewrites the content of a moved non-Markdown file. A rewrite that leaves the reference text unchanged is not counted.

Plain references resolve against the disk before the move, by exact path only. Rewrites keep `#anchor` and `:line` suffixes, quotes, backticks, code formatting, and command syntax such as `/goal plan:`. Rename changes path text; it never turns a plain reference into a Markdown link. An already-broken reference that the move does not affect stays unchanged.

Destination rules follow `mv`:

- One file source: `<destination>` is a file path, a directory (existing, or ending in `/`), or a bare filename that keeps the source directory.
- One directory source: the tree moves to `<destination>/<dirname>` when `<destination>` is an existing directory, otherwise to `<destination>`. Every file moves, and relative paths inside the tree stay the same.
- Several sources, or any glob: `<destination>` is a directory, and each source lands at `<destination>/<basename>`.

The preview lists missing destination directories; `--fix` creates them.

| Flag | Default | Description |
|---|---|---|
| `--scope <folder>` | smart default | Bounds sources, destinations, and the physical location of each note that gets a reference edit |
| `--fix` | `false` | Apply moves and reference edits; without it, jact only previews |
| `--json` | `false` | Print the structured result for the whole batch |
| `--allow-gitignore` | `false` | Include ignored Markdown notes when jact searches for references |

jact refuses the plan with exit `1` and writes nothing when:

- a source or destination argument is missing
- a source does not exist, is outside scope, or is neither a file nor a directory
- a source directory contains a symlink at any depth; preview and `--fix` both report its path
- a glob matches no eligible files
- a destination exists, leaves scope, equals its source, or two sources map to one destination
- a directory would move into itself, a source sits inside a directory source, or a destination sits inside a moved directory
- a moved note has an outgoing link or selected plain path with no single resolved target
- a note that needs a reference edit resolves physically outside scope, including through a symlink
- a move would break an image embed

Reference search follows symlinks. A shortcut to a note inside scope is allowed. An outside note that needs no edit stays unchanged. An outside note that needs an edit refuses the whole plan before any write. Its error, on standard error in both human and `--json` modes, tells the agent to ask the user whether to widen scope, to preview first, and to apply only after the preview succeeds.

**Non-Markdown files and embeds.** Any file can move, alone, in a batch, or inside a directory. Parsed links such as `[text](file.pdf)` or `[[dir/file.png]]` and plain paths are rewritten when their target moves; non-Markdown references keep their formatting. Image embeds (`![alt](path)`, `![[dir/file]]`) are outside the jact link model, so rename cannot rewrite them and `jact validate` cannot check them. Rename refuses a plan that would break an embed and lists each `file:line`. These embeds do not block a move:

- a reference-style image such as `![picture][pic]`; jact rewrites its `[pic]: notes/p.png` definition
- an embed inside a moved directory that points into the same tree
- a bare-name `![[file.png]]`, which Obsidian resolves by name

**Apply and recovery.** On `--fix`, jact backs up every edited file and every moved source file, then writes edits, creates directories, and moves files. It then re-checks each rewritten relationship at its final location against the planned target. On failure, jact attempts to undo every move, remove every created directory, and restore every edited file, and exits `2`. Recovery is best-effort: jact continues past recovery errors, keeps non-empty created directories, and reports errors and kept backup paths. A backup inside a moved directory moves with it, and the reported path is its final location.

**JSON result.** `--json` prints one object per request:

- `scope`, `applied`
- `moves` — `kind` (`file` or `directory`), `source`, `destination`, and `movedFiles` for directories
- `directories` — missing directories, outermost first
- `links` — total rewritten references
- `files` — `path` at its final location and its `links` count
- `backups` — backup file paths
- `source`, `destination` — only for a single file source without a glob

Human output for a single file prints `Source:` and `Destination:` lines; a batch prints a `Moves:` list.

**Exit codes:** `0` preview or apply succeeded; `1` invalid or unsafe plan, no writes; `2` file-system, parse, commit, or recovery failure.

---

## `jact outline <file> [level]`

```
jact outline <file> [level] [options]
```

`jact outline` prints a quoted tree of the parsed headings in one file. The optional `level` is `H1` through `H6`, defaults to `H2`, and is an inclusive ceiling: `H3` shows H1 through H3. Exact-level and source-line rules follow [ADR-0006 — Exact heading-level filtering and source lines](../adrs/adr-0006-exact-heading-level-and-source-lines.md#ADR-0006 — Exact heading-level filtering and source lines).

| Flag | Default | Description |
|---|---|---|
| `--exact-heading-level <level>` | - | Show only one level (`H1` through `H6`); `level` keeps its meaning |
| `-n, --line-number` | `false` | Prefix each heading with its one-based source line |
| `--expand <headings>` | - | Fully expand comma-separated heading branches |
| `--within <parent>` | - | Limit the outline and heading lookup to one parent branch |
| `--cache-reset` | `false` | Show next-step reminders again for this session and file |
| `--scope <folder>` | smart default | Folder for filename matches |

Exact-level output hides every other level and does not mark filtered children as collapsed. Line numbers sit in a right-aligned six-character field followed by two spaces. A visible heading with no parser source position fails the command.

After the tree, jact prints next-step commands: expand collapsed branches, filter one level with line numbers, extract a section, and open `jact outline -h`. With a session ID, jact shows them once per session and file. The reminder set has a revision, so new guidance shows once after an upgrade.

**Exit codes:** `0` outline printed, including a file with no headings; `1` heading selector missing, ambiguous, or unsupported; `2` file lookup, scope, permission, parse, or source-position error.

---

## `jact ast <file>`

```
jact ast <file> [--scope <folder>]
```

`jact ast` prints the parser output for one file as JSON, for debugging. The top-level keys are `filePath`, `content`, `ast`, `links`, `embeds`, `headings`, `anchors`, and `validationDisabled`. The fields are in [ParserOutput](004-domain-model.md#ParserOutput). Errors exit `2`.

---

## `jact extract links <source-file>`

```
jact extract links <source-file> [options]
```

`jact extract links` checks every link in the source note, then prints the linked content as deduplicated JSON.

| Flag | Default | Description |
|---|---|---|
| `--scope <folder>` | smart default | Folder for filename matches |
| `--allow-read <dir>` | - | Also let links read files in `<dir>`; repeatable. See [Extraction Read Boundary](006-behavior.md#Extraction Read Boundary) |
| `--format <type>` | `json` | Reserved; output is always JSON |
| `--full-files` | - | Also extract full-file links (default: sections and blocks only) |
| `--session <id>` | - | Skip extraction when this session already extracted the file |
| `-v, --verbose` | `false` | Add `outgoingLinksReport` and `stats` to the output |

Default output holds only `extractedContentBlocks`. The fields are in [Extraction Types (`src/types/extraction-types.ts`)](004-domain-model.md#Extraction%20Types%20%28%60src/types/extraction-types.ts%60%29).

**Exit codes:** `0` at least one link extracted, or a `--session` cache hit; `1` no eligible links, or every extraction failed; `2` system error, such as a missing source file.

---

## `jact extract header <target-file> <header-name>`

```
jact extract header <target-file> <header-name> [options]
```

`jact extract header` prints one section of a file. The default `markdown` output prefixes each line in `cat -n` format: a right-aligned six-character source line, then a tab. `--format json` prints raw content in the extraction JSON shape.

| Flag | Default | Description |
|---|---|---|
| `--scope <folder>` | smart default | Folder for filename matches |
| `--allow-read <dir>` | - | As in [`jact extract links <source-file>`](#`jact extract links <source-file>`); without it, jact does not read linked targets outside scope |
| `--within <parent>` | - | Resolve the header only among children of one unique parent |
| `--extract-linked-content [depth]` | off; depth `1` | Also extract linked content to `depth` (whole number ≥ 1), plus backlinks to the header in scope |
| `--max-chars <n>` | `28000` | With `--extract-linked-content`: above this size, print a content map |
| `-v, --verbose` | `false` | Add `outgoingLinksReport` and `stats` |
| `--format <type>` | `markdown` | `markdown` or `json` |

With `--extract-linked-content`, the markdown output labels each block `Source: file:start-end`, and each linked block `Via: file:line` (the link that pulled it in). Next-step hints and the `--max-chars` content map work as in [`jact extract file <target-file>`](#`jact extract file <target-file>`). The header content map also lists backlinks and failures.

**Exit codes:** `0` header extracted and all linked content resolved; `1` header not found, or some linked content failed; `2` system error, such as a missing file.

---

## `jact extract file <target-file>`

```
jact extract file <target-file> [options]
```

`jact extract file` prints a whole file. The default `markdown` output prefixes each line in `cat -n` format with its one-based source line. `--format json` prints raw content in the extraction JSON shape.

| Flag | Default | Description |
|---|---|---|
| `--scope <folder>` | smart default | Folder for filename matches |
| `--allow-read <dir>` | - | Also let links read files in `<dir>`; repeatable. See [Extraction Read Boundary](006-behavior.md#Extraction Read Boundary) |
| `--extract-linked-content [depth]` | off; depth `1` | Also extract linked content, following linked files to `depth` (whole number ≥ 1) |
| `--max-chars <n>` | `28000` | With `--extract-linked-content`: above this size, print a content map |
| `-v, --verbose` | `false` | Add `outgoingLinksReport` and `stats` |
| `--format <type>` | `markdown` | `markdown` or `json` |

**Linked content.** A section or block link extracts that section or block. A full-file link to a `.md` file extracts the file and, while depth remains, follows its links. jact follows each file once, so link cycles end. A link marked `%%stop-extract-link%%` is neither extracted nor followed. jact does not read or follow targets outside scope unless `--allow-read` permits them.

**Failures.** When a linked target cannot be extracted (file not found, anchor not found, or file not readable), jact still extracts the other links. It lists each failure as `file:line — reason` under `## Failures`, or under `Failures:` on standard error for `json`, and exits `1`. A stop-marker link is a skip, not a failure.

**Next-step hints.** After the content, jact prints `jact outline`-style hints: on standard output for `markdown`, on standard error for `json`, so standard output stays parseable. A `[+] … To Go Deeper` hint with the next depth appears only when the depth limit left out links that would add content.

**Content map.** When `--extract-linked-content` markdown output would exceed `--max-chars`, jact prints a content map instead. Each row is one block with its `Source`, `Via`, character count, and a command that loads only that block. A `To Print Everything Anyway` hint gives the `--max-chars` value that prints everything. The default fits a default Claude Code Bash result, which shows 30,000 characters inline. jact never replaces `json` output with a map.

**Exit codes:** `0` file extracted, with no linked failures; `1` target file not found or invalid, or a linked target failed; `2` system error, such as a permission or parse error.

---

## `jact:base-paths` (npm script, not a jact subcommand)

`npm run jact:base-paths <file>` prints the unique absolute target paths of every link in `<file>`. It runs `jact extract links <file> --verbose` and reads the `outgoingLinksReport` with `jq`. There is no `jact base-paths` command.

---

## Environment Variables

`jact outline` reads a session ID from the environment to show next-step reminders once per session.

| Variable | Effect |
|---|---|
| `JACT_SESSION_ID` | Session ID for outline reminders; wins over `CLAUDE_SESSION_ID` |
| `CLAUDE_SESSION_ID` | Session ID for outline reminders when `JACT_SESSION_ID` is not set |

Without either variable, `jact outline` shows its reminders on every run.

---

## Terminal Output Safety

Commands that jact prints for you to run are safe to paste into Bash or Zsh. Retry commands, next-step hints, and content-map load commands put each document-derived argument in single quotes. A plain token such as `Guide` or `docs/a.md` stays bare. A control character goes in an octal `$'\ooo'` escape. If a positional argument starts with `-`, the options come first and `--` ends option parsing.

Human-readable messages do not print raw control characters from documents or paths. jact shows each one as a visible `\uXXXX` escape. This stops document text from sending terminal escape sequences (ANSI codes) or fake extra lines. JSON and JSONL output is not changed. Extracted Markdown content is printed as it is in the source file.

---

## Exit Codes

Every command uses three exit codes, and hooks depend on them.

| Code | When |
|---|---|
| `0` | Success: links valid, files passed, extraction produced content, outline printed, or rename succeeded; `--changed` with no changes |
| `1` | Content failure: errors found, no eligible links, header or target file not found by extraction, outline selector unresolved, or rename plan refused |
| `2` | System or usage error: missing file, permission denied, parse error, missing source position, bad flag combination, a glob that matched nothing when nothing else was selected, or not a git repository |

The three-code contract is a recorded decision: D4 in [Decision](../../design-docs/features/20260701T041917-batch-validate/spec/003-adrs.md#Decision).

Command-specific exceptions:

- In batch mode, a file that jact cannot read stops the whole batch with exit `2` and no report.

Single-file `validate` writes its full report to a piped standard output before it exits, including reports larger than 64 KB.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0-draft | 2026-10-09 | Moved project configuration to `.jact/config.json`. Restricted plugins to user configuration. Project plugin lists cause exit `2` before plugin code runs. |
| 1.0.0-draft | 2026-10-09 | Added renderer presets, user/project configuration, per-rule overrides, plugin contract, findings output, and exit-2 configuration failures; Obsidian dropped-character checking is no longer enabled by default |
| 1.0.0-draft | 2026-10-07 | Aligned to code; removed internal code names to reduce drift. Added missing `extract header --within` and `-v` flags, the batch-mode flags that jact ignores, single-file JSON keys, rename exit `1` for missing arguments, `extract file` exit `1` for a missing target, outline session variables, and the `--fix` and batch-read exit exceptions |
| 1.0.0-draft | 2026-10-07 | `validate --fix` follows the three-code contract: exit `1` when errors remain after fixing or during `--dry-run`, `2` on a system error. `--fix`, `--dry-run`, and `--no-backup` with batch selection or `--stdin` are usage errors (exit `2`) instead of being ignored |
| 1.0.0-draft | 2026-10-07 | `validate` checks link syntax only; plain text and code paths no longer produce errors (issue #110). `--fix` converts only resolved prose `.md` paths and no longer reports unresolved plain text |
| 1.0.0-draft | 2026-10-06 | Rename refuses the whole plan before writes when a note selected for reference edits resolves physically outside scope; internal shortcuts and unaffected external notes remain allowed |
| 1.0.0-draft | 2026-10-06 | Approved plain-path validation and prose Markdown conversion contract; arbitrary-file rename/move with plain-path rewrites, exact resolution, suffix/command preservation, and post-transaction verification |
| 1.0.0-draft | 2026-09-30 | Printed commands use single-quote shell quoting instead of JSON strings, so document text cannot run shell commands when pasted; human-readable messages escape control characters |
| 1.0.0-draft | 2026-09-25 | Added `validate --fix --no-backup`; `--fix` no longer counts or reports fixes that leave a citation unchanged |
| 1.0.0-draft | 2026-09-25 | Single-file `validate` writes its complete report to a piped stdout; before, output stopped at 64KB |
| 1.0.0-draft | 2026-09-25 | `extract file --extract-linked-content` lists links it could not extract under `## Failures` and exits `1`, instead of skipping them without a message |
| 1.0.0-draft | 2026-09-25 | Added `--extract-linked-content [depth]` to `extract file` and `extract header` (replaces `extract header --linked-context`) with depth-limited link following, `Source:`/`Via:` labels, and next-step hints; linked section and block content now carries source start lines; both commands print a content map above `--max-chars` |
| 1.0.0-draft | 2026-08-13 | Made numbered markdown the default output for `extract header` and `extract file`; explicit JSON remains raw |
| 1.0.0-draft | 2026-08-02 | Added five-error batch disclosure threshold, failing-file error counts, drill/filter/fix guidance, and verbose expansion without changing exit codes |
| 1.0.0-draft | 2026-08-02 | Added bounded duplicate-path diagnostics, verbose expansion, and explicit document-skip output |
| 1.0.0-draft | 2026-07-31 | Added contextual outline next-step guidance for exact-level filtering, source lines, extraction, expansion, and help discovery |
| 1.0.0-draft | 2026-07-31 | Added parser-derived outline interface, exact heading-level filtering, and source-line prefixes |
| 1.0.0-draft | 2026-07-01 | Initial interfaces doc |
