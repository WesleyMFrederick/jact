# 006. Behavior

**Status:** done

This section states what each jact workflow reads, writes, prints, and exits with, in order. Exit code meanings live in [Exit Codes](005-interfaces.md#Exit%20Codes). Code ownership lives in the `src/` module folders.

## Validate Workflow (single file)

Single-file validation checks the link syntax and enabled renderer rules in one Markdown file and prints one report. It writes no files. Before validation, the CLI resolves [Validation configuration and presets](005-interfaces.md#Validation configuration and presets); a configuration or plugin error prints `ERROR: <message>` on stderr and exits `2` without validating or writing anything. File, `--stdin`, and batch validation share steps 1–5.

```text
1. Resolve scope ── no root found ──▶ ERROR: cannot resolve scope … (exit 2)
   │  index the scope folder, even without --scope, so bare wiki page names resolve
   ▼
2. Read the file ── missing ──▶ ERROR: File not found … (exit 2)
   │  --stdin: read standard input; <path> sets config, scope, and relative links
   ▼
3. Parse ── disable directive ──▶ SKIPPED: validation disabled by document directive (exit 0)
   ▼
4. Check every link; detect nested code blocks
   │  plain text and inline code are never checked
   ▼
5. Run enabled rules against the parsed document and validated links
   ▼
6. --lines: keep links and findings in the range; recompute the summary
   ▼
7. Print (human format only, before the report):
   │  scope notices (vault notice, gitignored-target notice)
   │  --verbose: file count and duplicate-filename warning
   ▼
8. Print the report: JSON (--format json), or the minimal or --verbose tree
   │  human format adds a .gitignore hint when a wiki page is not found
   │  and the scope honors a .gitignore
   ▼
9. Exit 0 (no errors) or 1 (link errors or rule errors)
```

A failure in steps 1–4 prints `ERROR: <message>`, or a JSON object with `error`, `file`, and `success: false`, and exits `2`.

The disable directive is the exact comment `<!-- jact-validate-disable -->` as the first body block. One YAML frontmatter block may come before it; blank lines do not count. The comment does not disable validation after other content, inside a code fence or blockquote, or with other text on its line.

### Plain File Paths

The plain path scanner finds file paths written as text or code. Only `--fix` (prose `.md` conversion) and `jact rename` use it; validation never does. The scanner reads prose, inline code, and code blocks from the parsed tree. It skips links, reference definitions, wiki links, citations, images, HTML, YAML, Obsidian comments, URLs, globs, and template paths.

| Rule | Behavior |
|---|---|
| Shape | A bare filename needs an extension. Slash, absolute, and `~/` paths also match. An optional `#anchor` or `:line` suffix follows the path. |
| Edit span | Only the path and suffix. Enclosing quotes, backticks, and fences stay outside. |
| `/goal` | The command verb is not a path; its path operands are. |
| Resolution | Exact existing files only, relative to the note and the scope root. Absolute paths use their own location; `~/` expands from the home folder. Folders are not targets. |
| Outcome | One distinct file resolves. Two distinct files are ambiguous. None is unresolved. jact does no filename search or fuzzy match. |

`--fix` converts only resolved prose `.md` references to Markdown links, with a destination relative to the note:

- The link keeps an `#anchor` in its text and destination. It keeps a line suffix (`:12`, `:L12-L14`) in its text only.
- Non-Markdown paths, inline code, code blocks, `/goal` commands, shell-prompt lines, and unmarked lowercase command-shaped lines stay plain, so commands stay usable. `jact rename` still rewrites their file targets.
- Missing and ambiguous references stay unchanged and unreported, because plain text may not be a path.
- With no resolvable scope, `--fix` skips plain-path conversion.

Validation and `--fix --dry-run` write no files or backups. Applied conversions use the citation-fix backup rules, including `--no-backup`. Edits use source offsets, so a prose match never replaces the same text inside code.

## Validate Workflow (batch)

Batch validation runs the single-file steps 1–5 on many files, one file at a time, and prints one combined report. Several paths, a glob, `--changed`, or `--json` select batch mode.

```text
1. Select files: expand globs, add --changed Markdown files, drop ignored sweep
   │  matches, keep .md only, deduplicate, sort
   │  ── nothing selected ──▶ ERROR (exit 2); --changed alone with no changes → exit 0
   ▼
2. Resolve each selected file's rule set from the user config and its nearest
   │  .jact/config.json ── bad config/plugin ──▶ ERROR on stderr, no validation, exit 2
   ▼
3. Validate each file in order with one shared cache; run its enabled rules
   │  after link validation
   │  ── any file fails (scope, read, size, parse) ──▶ ERROR: <message> on stderr,
   │                                                   no report, exit 2
   ▼
4. Map each file: pass, fail (with link errors and rule findings), or skipped
   ▼
5. Print: JSONL (--json, one object per file) or the human report
   ▼
6. Exit 1 when any file failed; else 0 (passes and skips only)
```

The human report counts skipped files apart from passed files. With five or fewer errors in total, it lists every file and error. Above five, it lists only failing files with per-file error counts, then the totals, why details are hidden, and drill, filter, and fix commands. `--verbose` always prints the full report. JSONL output is always complete. Batch mode prints no scope notices.

## Scope Resolution Order

Every command that needs a project or vault root resolves scope in this order. The first hit wins.

1. **Explicit.** jact trusts `--scope <folder>` without a marker search.
2. **Up from the working folder.** The nearest folder that holds `.git`, `.obsidian`, or `package.json` wins. At one level, `.git` beats `.obsidian` beats `package.json`.
3. **Up from the target file's folder.** Same marker search, different start.
4. **None.** The command fails with `cannot resolve scope. Tried: <folders>. Pass --scope <dir>.`

When `.obsidian` selects the scope, single-file `validate` in human format prints `Scoped to <dir> (nearest Obsidian vault). Override with --scope <dir>.` before its report. JSON output, batch mode, and other commands do not print it.

## Linked-context Backlink Discovery

`extract header ... --extract-linked-content` finds backlinks in every file in the [Scope Resolution Order](#Scope%20Resolution%20Order) scope. A text screen first drops files that cannot link to the root file:

- A file stays when its text contains the root file's name stem, decoded or percent-encoded, in any letter case.
- The root file always stays, so same-file header links remain discoverable.

The screen only drops files. jact parses every remaining file and resolves each possible backlink with the same rules as link validation. An unreadable file, an empty name stem, or a screen failure makes jact parse every scope file. Output, failures, exit codes, and `scope.filesScanned` therefore equal a full scan.

## Path Resolution Strategy Order (cross-document links)

A cross-document link's file check returns the first rule that applies. A path with malformed percent-encoding fails first with `Malformed percent-encoding in link path`.

jact first picks a candidate file, trying in order: `~/` from the home folder; the path relative to the source note (decoded, then raw); the Obsidian vault-absolute form (`0_SoftwareDevelopment/...`); and the path relative to the note's real location when the note is a symbolic link. If none exists, the candidate is the plain relative path.

| # | Rule | Result |
|---|---|---|
| 1 | Wiki link whose parser-resolved file exists | Valid after the anchor check |
| 2 | Wiki link the parser could not resolve | Error `Wiki page not found`, listing every path tried |
| 3 | Candidate is a folder | Warning: link to a file inside the folder |
| 4 | Candidate file exists | Valid after the anchor check; a warning and a path-conversion fix when the file sits in another folder |
| 5 | Filename search in the scope index | Fuzzy or other-folder match: resolved with a path-conversion fix; duplicate names or no match: error `File not found` |

Rule 5 always returns a result, so the chain always ends. For duplicate filenames, jact ranks candidates by folder distance from the expected folder, then by scope-relative path. Default output shows the first five, the omitted count, and recovery guidance. `--verbose` shows all.

## Anchor Matching Order

An anchor check on a resolved target runs these steps in order.

1. **Dropped characters (opt-in).** Only when `obsidian/anchor-dropped-chars` is enabled, a header anchor with characters Obsidian drops is an error: see [Anchors with characters Obsidian drops](#Anchors%20with%20characters%20Obsidian%20drops).
2. **Match.** An anchor matches a heading or block when any form is equal: the exact ID, the URL-encoded or decoded ID, the normalized ID, the raw heading text, the text with backticks added or removed, or both sides with Markdown formatting removed. A block anchor also matches with or without its leading `^`.
3. **Missing caret.** A link that matches only a block anchor and omits `^` is a warning that suggests `#^<id>`.
4. **Kebab-case slug.** A kebab-case slug of a heading fails with a suggestion to use the raw heading text. `--fix` applies it.
5. **No match.** The error `Anchor not found` lists similar anchors, up to five headers, and up to five block references. When a listed header is close, `--fix` uses it.

Same-file `[text](#heading)` links run the same steps against their own file.

### Anchors with characters Obsidian drops

This check runs only when the `obsidian/anchor-dropped-chars` rule is enabled by the `obsidian` preset or a per-rule override; see [Validation configuration and presets](005-interfaces.md#Validation configuration and presets). With no configuration, the default `commonmark` preset leaves it off.

Obsidian drops `:` `#` `|` `^` `[` `]` from heading-link anchors. It renders an anchor that keeps any of these characters as an external link. When the rule is enabled, jact decodes each header anchor (one that does not start with `^`) and checks it for these characters. If the anchor has one, jact replaces each with a space, collapses whitespace, and matches again. When a header matches, the link is an error owned by `obsidian/anchor-dropped-chars`:

- `error`: `Anchor uses characters Obsidian drops (<chars>): #<anchor>`
- `suggestion`: the corrected anchor, `#` + the header text with those characters replaced and whitespace collapsed, spaces encoded as `%20`. Examples: `#Q1%20Does%20the%20gap?` for the heading `Q1: Does the gap?`; `#Trace%20run%20(opsx%20continue)` for the heading `Trace: run (opsx:continue)`
- `anchorConversion`: the same correction, which `--fix` applies

If no header matches after the replacement, the normal `Anchor not found` result applies. When the rule is enabled, its `Available headers` list and fuzzy-match `--fix` correction use the same replacement, so they never suggest an anchor that this rule rejects. When it is disabled, normal matching and suggestions keep those characters.

## Extraction Eligibility Order

Extraction decides per link whether to read its target. Same-file links are excluded, except in linked-context extraction. A link that failed validation is skipped. jact then applies these rules in fixed order; the first decision wins:

1. **Stop marker.** `%%stop-extract-link%%` right after the link makes it ineligible. An explicit stop always wins.
2. **Force marker.** `%%force-extract%%` makes it eligible, without `--full-files`.
3. **Section link.** A link with a header or block anchor is eligible.
4. **CLI flag.** A full-file link is eligible only with `--full-files`. This rule always decides.

An eligible link yields its section, block, or full file. jact deduplicates content by SHA-256 hash. A repeat link increases `duplicateContentDetected` and `tokensSaved` instead of emitting the content again.

## Extraction Read Boundary

Extraction reads a link target only when the target is inside a permitted directory. This rule applies to every target that comes from a link in Markdown: `extract links` (including `--full-files` and force markers), and `extract file` or `extract header` with `--extract-linked-content`. A file that the user names on the command line (`extract file <path>`, `extract header <path>`) is always permitted.

- **Permitted directories.** The scope root (the `--scope` value or the inferred project root) is permitted. Each `--allow-read <dir>` adds one more directory. The flag is repeatable.
- **Check.** jact resolves symbolic links in the target and in each directory, then checks containment. Absolute paths, `~/` paths, `../` traversal, symbolic links to files or parent directories outside the root, and sibling folders that share a name prefix (`/proj-evil` next to `/proj`) are all outside.
- **Result.** jact does not read a blocked target. The link gets status `skipped` with the reason `Blocked: target is outside the project. To allow, add --allow-read <dir>.` jact prints that reason on stderr with the source `file:line`. `extract file` does not follow links in a blocked file. In linked header output, the link shows as `not-followed` with the same reason. A blocked link is an intentional skip, so exit codes follow the existing rules for skipped links.
- **Validation.** `validate` does not use this boundary.

A link path with malformed percent-encoding (for example, `%E0%A4%A`) does not crash jact. Validation reports `Malformed percent-encoding in link path`. Output formatting keeps the raw text.

## Input Size Limits

jact uses fixed limits so that hostile or very large input cannot stop the process.

- **Markdown file size.** jact does not parse a Markdown file larger than 8 MiB. The error is `Skipped <path>: file is larger than 8 MiB.` For a file named on the command line, the command exits with code `2`. For a link target, the link fails with that reason. Parse cost still grows with file size. A 4 MiB file that contains only links validates in about 13 seconds and uses about 3 GB of memory. A file of that kind near 8 MiB can need more memory than Node.js allows. Then the process stops with an out-of-memory error.
- **Similar-anchor suggestions.** jact skips an anchor longer than 256 characters. It compares at most 1,000 anchors for each lookup and at most 20,000,000 character pairs for each target document. After a limit, jact gives fewer suggestions or none. The `Anchor not found` error stays the same.
- **Anchor lookup.** jact normalizes each anchor one time for each parsed document. A link lookup reads only the anchors that share a text form with the link. Many broken links to a document with many headings stay fast.
- **Similar wiki page names.** jact does not compare a file name longer than 256 characters. Such a wiki link gets no page-name suggestion.
- **Directory scan.** The scope index reads each real directory (after symbolic link resolution) one time. A symbolic link loop in the scope does not repeat the scan. A directory that two paths reach is scanned only through the first path.

## Citation Patterns Supported

jact parses six link patterns with its Markdown syntax extensions, not with regular expressions over raw text. Each pattern gets one check.

| Pattern | Example | What validation checks |
|---|---|---|
| Cross-document link | `[Text](path/to/file.md#anchor)` | File, then anchor, per the two orders above |
| Internal anchor link | `[Text](#anchor)` | Anchor in the same file |
| Wiki-style link | `[[file.md#anchor\|text]]` or `[[#anchor\|text]]` | Cross-document form: file, then anchor. Same-file form (`[[#anchor]]`, `[[#^block]]`): anchor in the same file, matched and suggested like a cross-document anchor |
| Caret / block reference | `^FR1`, `^US1-1AC1` | ID format only |
| Emphasis-marked anchor | `==**Component Name**==` | Anchor format only |
| Citation format | `[cite: path]` | Target file, as a cross-document link |

## Fix Workflow (`--fix`)

`--fix` repairs broken citations, applies enabled rule edits, and converts resolved prose `.md` paths in one file. It writes only that file and its backup. Configuration is resolved before any validation or write, as in [Validate Workflow (single file)](#Validate Workflow (single file)). `--fix`, `--dry-run`, or `--no-backup` with batch selection or `--stdin` is a usage error: jact prints `ERROR:` on stderr, validates and writes nothing, and exits `2`.

```text
1. Parse ── disable directive ──▶ SKIPPED: … (file not read again, backed up, or written)
   ▼
2. Validate links; run rules; collect citation fixes, rule edits, and plain-path conversions
   │  ── none ──▶ No auto-fixable citations found in <file>
   │  ── a path fix without --scope ──▶ ERROR: Path corrections require --scope …
   ▼
3. --dry-run: print the diff and stop
   ▼
4. Refuse when the file is a symbolic link, is outside the scope, or its backup path exists
   ▼
5. Write a timestamped .bak backup (skipped with --no-backup), then replace the file in one step
   ▼
6. Print each fix and the backup path
   ▼
7. Validate the file as it now stands on disk (unchanged after --dry-run)
   └─ exit 0 (no errors left) or 1 (link errors or rule errors left)
```

Fix kinds: a path conversion, a kebab-case anchor to its raw heading, a close heading for a missing anchor, and an anchor with characters Obsidian drops when its rule is enabled. An anchor fix replaces only the anchor; the link text stays the same. A fix that leaves a citation unchanged is not applied, counted, or reported.

When `obsidian/no-reference-note-link` is enabled, each local-file split-style usage becomes `[text](dest)` and its definition line is deleted after all usages are rewritten. The destination is preserved byte-for-byte unless jact's own path or anchor correction is folded into it. Other excluded forms are listed in [Validation configuration and presets](005-interfaces.md#Validation configuration and presets).

Rule edits and ordinary fixes share source-offset ranges and apply from the end of the document backward. A citation fix wholly contained in a rule rewrite or deletion is omitted because the rule already folds it in; any remaining overlap stops the fix before backups or writes. A changed citation also stops the fix before writing. Every path that ends in `ERROR:` (configuration/plugin failure, missing file, missing `--scope` for a path fix, refused write, changed or overlapping citations) exits `2`. Every other path, including `SKIPPED:`, "No auto-fixable citations found", and `--dry-run`, ends at step 7.

## Rename Workflow (`jact rename`)

`jact rename` moves Markdown files and folders and rewrites every link and plain path that the move changes. Preview is the default; `--fix` applies.

Source selection: an existing path is literal, even with glob characters such as brackets. jact expands only a non-existing glob, to regular files, and applies ignore rules. A glob with no eligible files is refused. Scope comes from the first source.

```text
1. Plan moves ── invalid, overlapping, or folder holds a symbolic link ──▶ refuse (exit 1)
   │  resolve each destination with mv rules; collect missing destination folders;
   │  map every file inside a moved folder to its new path
   ▼
2. Plan reference edits ── unsafe ──▶ refuse (exit 1)
   │  parse scope notes and every moved file; rewrite each link or plain path whose
   │  target moves or whose file changes folder, to the target's final location
   ▼
3. Preview: print the plan and stop
   ▼
4. Apply (--fix): re-check sources, destinations, and edited files for changes;
   │  back up and stage edits; write; create folders; move
   ▼
5. Verify every rewritten link and plain path at its final location
   ── failure in step 4 or 5 ──▶ best-effort recovery; report errors and kept backups (exit 2)
```

Step 2 refuses the whole plan before any write when:

- a moved file's outgoing link, or one of its plain paths, does not resolve or is ambiguous;
- a note whose reference text would change is physically outside the canonical scope, including another Windows drive or an unrelated network root;
- the moves would break an image embed, which is outside the link model.

Reference discovery through internal symbolic links stays allowed. An outside note with no selected edits does not trigger the containment check. Reference-style images such as `![picture][pic]` use parsed definitions such as `[pic]: notes/p.png`, which follow the link-rewrite rules.

Recovery attempts to reverse every completed move, remove every created folder, and restore every edited file from backups. It continues after recovery errors. It keeps nonempty folders rather than delete files that another process created.

Embed classification comes from parsed syntax, not decoded prose. Escaped examples such as `\!\[\[folder/image.png\]\]` and `!\[\[folder/image.png\]\]`, inline code, and fenced code do not block a move. In `\![[notes/a.md]]`, only the bang is escaped: the ordinary wiki link still follows the link-rewrite rules. A genuine embed that still resolves correctly after a move remains unchanged.

A valid Markdown image with bracketed description text, such as `![[caption]](folder/image.png)`, remains an image. Wiki-like syntax inside an image's description remains description text, including through a nested link; CommonMark still handles its formatting, escapes, entities, and code.

## Version History

| Version | Date | Changes |
|---|---|---|
| 1.0.0-draft | 2026-10-09 | Added preflight configuration, per-file batch presets, post-link rule checks, findings filtering, rule edits and overlap handling; gated Obsidian dropped-character matching behind its rule |
| 1.0.0-draft | 2026-10-07 | `--fix` exits `0` when no link errors are left, `1` when errors remain after fixing or during `--dry-run`, and `2` on `ERROR:`. `--fix`, `--dry-run`, and `--no-backup` with batch selection or `--stdin` are usage errors (exit `2`) |
| 1.0.0-draft | 2026-10-07 | Same-file wiki links are checked against the file's own headings and block anchors; an unknown anchor is an error with anchor suggestions |
| 1.0.0-draft | 2026-10-07 | Aligned to code; removed internal code names to reduce drift. Batch abort on a failed file, scope-notice output, and same-file wiki-link handling stated as observed behavior |
| 1.0.0-draft | 2026-10-07 | Validation checks link syntax only; `plainPaths` removed from `ValidationResult`, so plain text and code never produce errors (issue #110). `--fix` no longer reports unresolved plain text and skips plain conversion without a scope |
| 1.0.0-draft | 2026-10-06 | Parser-owned wiki embed detection distinguishes genuine embeds from escaped prose and code; rename consumes typed embed references without rescanning decoded text |
| 1.0.0-draft | 2026-10-06 | Shared rename containment rejects absolute relative-path results across Windows drives and unrelated network roots; equality and descendants remain accepted |
| 1.0.0-draft | 2026-10-06 | Corrected rename glob eligibility: regular files after ignore filtering, not Markdown-only matches or batch validate's resolver |
| 1.0.0-draft | 2026-10-06 | Rename checks the physical scope of every note selected for reference edits before any writes, without banning internal shortcuts or unaffected external notes |
| 1.0.0-draft | 2026-10-06 | Prose Markdown conversion retains line suffixes only in link text, keeping destinations usable by Markdown clients |
| 1.0.0-draft | 2026-10-05 | Folder rename plans reject symlinks (file or folder shortcuts) before reading links or changing files |
| 1.0.0-draft | 2026-10-06 | Added exact plain-file-path validation and prose Markdown conversion; code and commands retain plain syntax, including uncertain command-shaped lines |
| 1.0.0-draft | 2026-10-05 | Existing rename sources with glob characters remain literal; rollback continues restoring files after directory cleanup errors and reports incomplete recovery |
| 1.0.0-draft | 2026-10-05 | `jact rename` accepts several sources, globs, and directories as one guarded batch with best-effort recovery; creates missing destination directories; refuses moves that would break inline or wiki image embeds |
| 1.0.0-draft | 2026-09-30 | Added the extraction read boundary and `--allow-read`; malformed percent-encoding no longer crashes |
| 1.0.0-draft | 2026-09-25 | Added `--fix --no-backup`; `--fix` skips fixes that leave a citation unchanged |
| 1.0.0-draft | 2026-09-25 | Added the error and `--fix` correction for header anchors with characters Obsidian drops (`: # \| ^ [ ]`) |
| 1.0.0-draft | 2026-08-24 | Added byte-screened backlink candidates with exhaustive fallback and unchanged output semantics |
| 1.0.0-draft | 2026-08-02 | Added progressive disclosure for batches above five errors while preserving complete verbose/JSON output and existing exit-code semantics |
| 1.0.0-draft | 2026-08-02 | Added bounded duplicate diagnostics and parser-derived document opt-out across validation, batch, stdin, and fix |
| 1.0.0-draft | 2026-07-01 | Initial behavior doc, grounded in `src/jact-cli.ts`, `src/core/CitationValidator/*`, `src/core/ContentExtractor/*`, `src/core/resolveScope.ts` |
