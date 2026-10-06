# jact — Just Another Context Tool

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/WesleyMFrederick/jact?utm_source=oss&utm_medium=github&utm_campaign=WesleyMFrederick%2Fjact&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

jact is a command-line tool that keeps links between Markdown files healthy and pulls exactly the text you need out of them.

- **Validate** — find links that point to missing files or missing headings.
- **Fix** — rewrite broken heading links to the correct form, with a preview first.
- **Rename** — move or rename a Markdown file and update every link to it.
- **Outline** — show the heading tree of a document.
- **Extract** — print one section, one file, or every linked section, ready to paste into an AI prompt.

It understands standard Markdown links and Obsidian syntax (wiki links, block references like `^FR1`, `%% comments %%`).

## Install

You need Node.js 20 or later.

**From GitHub:**

```bash
npm install -g --allow-git=all github:WesleyMFrederick/jact
jact --help
```

npm 12 and later block installs from git unless you add `--allow-git=all`. npm builds jact during the install.

If the install fails with `EALLOWSCRIPTS`, an `allow-scripts` line in your `~/.npmrc` is the cause. npm 12 rejects that setting while it builds a git dependency. Retry with it disabled: `NPM_CONFIG_USERCONFIG=/dev/null npm install -g --allow-git=all github:WesleyMFrederick/jact`.

**From npm:** not published yet. Once it is, the install will be `npm install -g @wesleymfrederick/jact`.

**From source** (to change the code): see [Development](#Development).

## Quick start

Given `docs/guide.md`:

```markdown
See [Setup notes](setup.md#Prerequisites) and [Missing](setup.md#Nope).
Also [Gone](gone.md).
```

Validate it:

```text
$ jact validate docs/guide.md
ERRORS (2)
- Line 9: [Missing](setup.md#Nope)
  error: Anchor not found: #Nope
  suggestion: Available headers: "Setup" → #Setup, "Prerequisites" → #Prerequisites, "Troubleshooting" → #Troubleshooting
- Line 10: [Gone](gone.md)
  error: File not found: gone.md
  ...

FAILED: 2 errors
```

A clean file prints one line, for example `OK: 4 citations valid`, and exits with code `0`.

Validate many files at once with a glob:

```text
$ jact validate "docs/**/*.md"
❌ /project/docs/guide.md
   Line 9: Anchor not found: #Nope
   Line 10: File not found: gone.md
✅ /project/docs/setup.md
---
2 files · 1 passed · 1 failed · 0 skipped
```

## Using jact with AI agents

jact was built to give AI coding agents precise context without loading whole files.

- `outline` followed by `extract header` lets an agent read one section instead of a full document.
- `extract ... --extract-linked-content` gathers a section and the sections it references in one call.
- `validate --stdin` checks a draft before the agent saves it, so it works well in an editor hook.
- `validate --json` gives one result per line for scripts and CI.
- `extract links --session <id>` skips work already extracted in the same session.
- When the environment variable `JACT_SESSION_ID` is set, `outline` shows its usage tips once per session instead of on every call.

Tell your agent to run `jact -h` (and `jact <command> -h`) to learn the commands and options. Each help page includes examples and exit codes, so the agent does not need a copy of this README. For example, add this to your agent instructions file (such as `AGENTS.md` or `CLAUDE.md`):

````markdown
## `jact` — Markdown Context Tool

`jact` = source of truth for Markdown links, structure, extraction. **Markdown files only (`.md`). Never run jact on `.ts`, `.json`, `.yaml`, or non-markdown — fail or garbage.**

Use before `Read` on large markdown files.

**Discovery first:** No memorize commands. Run `jact -h` or `jact <cmd> -h` — options self-document.

**Core principle — orient before extract:**
1. Orient: `jact outline <file>` → heading tree. Go deeper with `jact outline <file> H3` or `--expand "Section"`.
2. Extract: `jact extract header <file> "Section"` → only what task needs. Duplicate name → add `--within "Parent"`.
3. Follow links (optional): add `--extract-linked-content` → section plus the sections it links to.

Never `Read` large file cold. Orient first. Extract narrow.

**Validation:** Run `jact validate <file>` after Write/Edit on `.md`. Skip if a hook already runs it. Unsaved draft → `cat draft.md | jact validate <path> --stdin`.

**Fallback:** jact unavailable → `Read` with explicit offset/limit.

**HARD RULE — Markdown only:** File no end `.md`, do NOT use jact. Use `Read` or `Grep`.
````

## Commands

Every command has a full help page: `jact <command> --help`.

### `validate` — check links

```bash
jact validate docs/design.md                 # one file
jact validate docs/design.md --verbose       # full report, including valid links
jact validate "docs/**/*.md"                 # glob (batch mode)
jact validate a.md b.md c.md                 # several files (batch mode)
jact validate --changed                      # Markdown files changed in your git working tree
jact validate docs/design.md --lines 100-200 # only links on these lines
jact validate docs/design.md --format json   # full JSON report for one file
jact validate "**/*.md" --json               # one JSON line per file (for CI)
cat draft.md | jact validate docs/draft.md --stdin   # check text that is not saved yet
```

With `--stdin`, jact reads the Markdown from standard input. The path you give is where the file *would* live; jact uses it to resolve relative links but does not read it.

### `validate --fix` — repair heading links

`--fix` rewrites heading links that point at a real heading but use the wrong form (for example a lowercase, dash-separated slug instead of the exact heading text).

```text
$ jact validate docs/plan.md --fix --dry-run
DRY RUN — 1 fix would be applied to docs/plan.md:

  Line 3 (anchor):
    - [install steps](guide.md#install)
    + [install steps](guide.md#Install)

No files were written (--dry-run).
```

- `--dry-run` shows the changes and writes nothing.
- Without `--dry-run`, jact saves a timestamped `.bak` copy of the file before it writes. Add `--no-backup` to skip the copy.

### `rename` — move files or folders and update their links

`rename` previews by default. Add `--fix` to apply. Give it one or more sources and then a destination, like `mv`. A source can be a `.md` file, a quoted glob, or a folder.

```text
$ jact rename docs/setup.md getting-started.md
Rename preview.
Source: /project/docs/setup.md
Destination: /project/docs/getting-started.md
Updated links: 3 in 2 files
  2  /project/docs/guide.md
  1  /project/docs/plan.md
No files written. Re-run with --fix to apply this plan.
```

```bash
jact rename docs/old.md new-name.md --fix     # rename in place
jact rename docs/old.md archive/ --fix        # move into a folder
jact rename docs/old.md archive/new.md --json # machine-readable plan
jact rename a.md b.md new/dir/ --fix          # move several files; creates new/dir
jact rename "concepts/*.md" archive/          # move every match of a glob
jact rename notes/old-folder archive/ --fix   # move a whole folder (images included)
```

Existing source paths are treated literally, even when their names contain glob characters such as brackets. With several sources or a glob, the destination is a folder and each file keeps its name. A folder moves into the destination if that folder exists, otherwise it becomes the destination. Missing folders are created on `--fix`.

The whole command is one plan. Links between the moved files, links into them, and links out of them are all correct afterward. With `--fix`, jact makes backups, moves everything, updates the links, then checks every link again. If a step fails, it attempts to undo every change. A recovery error does not stop the remaining recovery steps; jact reports errors and retained backups for manual recovery. It never deletes another process's files to remove a newly created folder.

jact does not rewrite image embeds (`![alt](path)`, `![[folder/image.png]]`). If a move would break one, rename refuses and lists them; nothing changes.

### `outline` — show the heading tree

```text
$ jact outline docs/guide.md
"Guide"
├── "Install"
└── "Usage"
```

```bash
jact outline docs/guide.md H3                            # show headings down to level 3 (default: H2)
jact outline docs/guide.md --exact-heading-level H2 -n   # only level-2 headings, with line numbers
jact outline docs/guide.md --expand "Install,Usage"      # show everything under these headings
jact outline handbook.md --within "Guide"                # only the branch under "Guide"
```

`[*]` after a heading means it has hidden subheadings. Use `jact ast` if you need the full parser output as JSON.

### `extract` — pull content out of Markdown

**One section** — the heading and everything under it, with source line numbers:

```text
$ jact extract header docs/setup.md "Prerequisites"
     3	## Prerequisites
     4
     5	Node 20+.
```

If two sections share a name, pick one with `--within "<parent heading>"`.

**One whole file:**

```bash
jact extract file docs/architecture.md
jact extract file docs/architecture.md --format json
```

**A file or section plus what it links to:**

```bash
jact extract file docs/plan.md --extract-linked-content      # follow links one level deep
jact extract file docs/plan.md --extract-linked-content 3    # follow links three levels deep
jact extract header docs/plan.md "Overview" --extract-linked-content
```

Each linked block is labeled with where it came from (`Source: setup.md:3-6`, `Via: guide.md:9`). Broken links are listed under `## Failures`. If the output is larger than `--max-chars` (default 28000), jact prints a map of the content instead of the content.

**Every link in a document**, returned as JSON with duplicate content removed:

```bash
jact extract links docs/design.md
jact extract links docs/design.md --full-files   # also include links to whole files
jact extract links docs/design.md | jq '.extractedContentBlocks'
```

By default, `extract links` includes links to sections and skips links to whole files. Control single links with a marker after the link:

```markdown
- [whole guide](guide.md) %%force-extract%%
- [not needed](setup.md#Troubleshooting) %%stop-extract-link%%
```

### `ast` — debug the parser

```bash
jact ast docs/design.md | jq '.links'
jact ast docs/design.md | jq '.anchors | length'
```

Prints the parsed Markdown tree, detected links, headings, and anchors as JSON.

## Supported link syntax

| Syntax | Example |
|---|---|
| Markdown link to a heading | `[Setup](setup.md#Prerequisites)` |
| Markdown link to a heading with spaces | `[Guide](guide.md#Getting%20Started)` |
| Markdown link to a file | `[Guide](guide.md)` |
| Link within the same file | `[Above](#Install)` |
| Home-relative path | `[Notes](~/notes/todo.md)` |
| Wiki link | `[[setup#Troubleshooting\|fixes]]` |
| Block anchor | `- Must be fast. ^NFR1` |
| Link to a block anchor | `[[#^NFR1]]` |

**Heading anchors use the exact heading text.** Write `#Getting%20Started` (or `#Getting Started` inside wiki links), not the lowercase slug `#getting-started`. jact reports slugs as errors and suggests the exact form; `--fix` rewrites them. This matches how Obsidian resolves links.

jact also reports heading links that contain characters Obsidian removes from links, such as `:`, and suggests the corrected anchor.

## How links are resolved

For each link, jact tries these steps in order:

1. The path relative to the file that contains the link.
2. An Obsidian vault-style path (relative to a parent folder of the source file).
3. The same path after following symlinks.
4. A filename search inside the **scope** folder.

The scope folder defaults to the nearest parent of your current folder that contains `.git` or `package.json`. Use `--scope <folder>` to set it yourself, for example when you check files in another project.

Step 4 lets jact find `setup.md` even if the relative path is wrong. If two files in scope have the same name, jact does not guess: it reports the link as broken and lists both matches.

## Ignoring files

### `.jactignore`

Put a `.jactignore` file (same syntax as `.gitignore`) in the folder you scan:

```gitignore
# .jactignore
test/fixtures/
archive/
```

- Ignore rules apply to globs, folders, `--changed`, and scope scans.
- A file you name directly is always checked, even if it is ignored.
- jact also skips files that `.gitignore` excludes. Use `--allow-gitignore` to include them. `.jactignore` still applies.
- jact always skips folders such as `node_modules/`, `dist/`, and `.git/`.

### Skip one document

Put this comment as the first line of the document (after YAML front matter, if any):

```markdown
<!-- jact-validate-disable -->
```

`validate` then reports the file as `SKIPPED`.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success. All links are valid, or the command finished. |
| `1` | Something failed a check: a broken link, a missing heading, or an unsafe rename plan. |
| `2` | System error: file not found, permission denied, parse error, or a glob that matched nothing. |

Each command's `--help` page lists its exact exit codes.

## Development

```bash
git clone https://github.com/WesleyMFrederick/jact.git
cd jact
npm install          # also builds dist/
npm run build        # rebuild after you change src/
npm test             # run the Vitest suite
npm run check        # type-check and test
node dist/cli.js     # run the CLI you just built
npm link             # optional: put this checkout's `jact` on your PATH
```

The source is TypeScript in `src/`; tests are in `test/`.

Design documentation:

- [jact Living Specification](docs/spec/SPEC.md#jact%20Living%20Specification) — what jact does and why.
- [005. Interfaces](docs/spec/005-interfaces.md#005.%20Interfaces) — every command and flag in detail.
- [003. ADRs](docs/adrs/003-adrs.md#003.%20ADRs) — recorded design decisions.
