---
last_verified: 2026-11-19
verified_by: agent
---
# jact — Just Another Context Tool

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/WesleyMFrederick/jact?utm_source=oss&utm_medium=github&utm_campaign=WesleyMFrederick%2Fjact&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

jact keeps the links in a Markdown wiki working and gives an AI agent only the section it needs. It is a command-line tool that runs on your machine with no model call.

## Why agents need it

| An agent that | With jact | Measured on this repository's docs |
|---|---|---|
| reads a whole file to use one section | `jact outline`, then `jact extract header` | **83% fewer characters** loaded (median of 23 files) |
| writes a link to a file or heading that does not exist | `jact validate` | **331 links checked in about 1 second**; 3 broken links found |
| forgets to run the check | a harness hook runs it | **0.35 seconds** for each hook call |

Method and the command to reproduce: [Measured value](docs/harness-hooks.md#Measured%20value).

## Install

You need Node.js 22.12 or later.

```bash
npm install -g --allow-git=root github:WesleyMFrederick/jact
jact --help
```

If the install fails, see [Install](docs/user-guide.md#Install).

## Wire jact into your agent harness

Agents: to set up jact for your harness, run one line in the project folder.

```bash
jact setup claude        # Claude Code:           writes .claude/settings.json
jact setup codex         # Codex:                 writes .codex/hooks.json
jact setup antigravity   # Antigravity CLI (agy): writes .agents/hooks.json
jact setup gemini        # Gemini CLI:            writes .gemini/settings.json
jact setup pi            # pi:                    writes .pi/extensions/jact.ts
jact setup omp           # omp:                   writes .omp/extensions/jact.ts
```

Then confirm: `jact setup <harness> --check` exits with code 0.

Google's command-line agent is now Antigravity CLI. Use `antigravity` when you run `agy`. Use `gemini` only where the `gemini` command still runs.

If setup prints `Cannot write`, your sandbox protects the harness config (Codex does this for `.codex/`). Give the user the same line to run in a terminal.

After setup, the harness runs jact by itself:

- **After a Markdown write or edit**, the model sees each broken link with a suggested fix.
- **After a Markdown read**, the model gets the sections that file links to, one time for each session.

Setup merges into an existing file and keeps other tools' hooks. Add `--global` for all projects, `--print` to preview, `--remove` to undo.

| You need | Go to |
|---|---|
| The extra step for Codex, Antigravity CLI, Gemini CLI, or pi | [Set up in one command](docs/harness-hooks.md#Set%20up%20in%20one%20command) |
| What each harness was tested with | [Verified harness versions](docs/harness-hooks.md#Verified%20harness%20versions) |
| Proof that the hook runs | [Check that it works](docs/harness-hooks.md#Check%20that%20it%20works) |
| A harness that is not in the list | [Any other harness](docs/harness-hooks.md#Any%20other%20harness) |
| An agent with no hook support | [Rule for agents without hooks](docs/harness-hooks.md#Rule%20for%20agents%20without%20hooks) |

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
- Line 1: [Missing](setup.md#Nope)
  error: Anchor not found: #Nope
  suggestion: Available headers: "Setup" → #Setup, "Prerequisites" → #Prerequisites, "Troubleshooting" → #Troubleshooting
- Line 2: [Gone](gone.md)
  error: File not found: gone.md
  ...

FAILED: 2 errors
```

A clean file prints one line, for example `OK: 4 citations valid`, and exits with code `0`.

Validate many files at once with a glob:

```text
$ jact validate "docs/**/*.md"
❌ /project/docs/guide.md
   Line 1: Anchor not found: #Nope
   Line 2: File not found: gone.md
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

Tell your agent to run `jact -h` (and `jact <command> -h`) to learn the commands and options. The help page of each runnable command, such as `jact validate -h` or `jact extract header -h`, includes examples and exit codes, so the agent does not need a copy of this README; the top-level `jact -h` and the `jact extract -h` group page list commands instead. For example, add this to your agent instructions file (such as `AGENTS.md` or `CLAUDE.md`):

````markdown
## `jact` — Markdown Context Tool

`jact` = source of truth for Markdown links, structure, extraction. **Parse only Markdown files (`.md`). Never run `outline`, `extract`, `validate`, or `ast` on `.ts`, `.json`, `.yaml`, or other non-Markdown files — fail or garbage.** Exception: `jact rename` can move non-Markdown files and update the Markdown links to them.

Use before `Read` on large markdown files.

**Discovery first:** No memorize commands. Run `jact -h` or `jact <cmd> -h` — options self-document.

**Core principle — orient before extract:**
1. Orient: `jact outline <file>` → heading tree. Go deeper with `jact outline <file> H3` or `--expand "Section"`.
2. Extract: `jact extract header <file> "Section"` → only what task needs. Duplicate name → add `--within "Parent"`.
3. Follow links (optional): add `--extract-linked-content` → section plus the sections it links to.

Never `Read` large file cold. Orient first. Extract narrow.

**Validation:** Run `jact validate <file>` after Write/Edit on `.md`. Skip if a hook already runs it. Unsaved draft → `cat draft.md | jact validate <path> --stdin`.

**Fallback:** jact unavailable → `Read` with explicit offset/limit.

**HARD RULE — parse Markdown only:** File no end `.md`, do NOT parse it with jact. Use `Read` or `Grep`. Moving it with `jact rename` is fine.
````

## Commands

| Command | What it does |
|---|---|
| `jact validate <file>` | Find links to missing files or headings. `--fix` repairs heading links. |
| `jact outline <file>` | Show the heading tree. |
| `jact extract header <file> "<heading>"` | Print one section. |
| `jact extract links <file>` | Print each section that the file links to. |
| `jact rename <old> <new>` | Move a file or folder, then update the links to it. |
| `jact setup <harness>` | Wire jact into an agent harness. |

Exit codes: `0` success, `1` broken links, `2` system error.

- A worked example: [Quick start](docs/user-guide.md#Quick%20start)
- Each command with examples: [Commands](docs/user-guide.md#Commands)
- Standard Markdown and Obsidian syntax that jact reads: [Supported link syntax](docs/user-guide.md#Supported%20link%20syntax)
- The exact contract of each flag: [005. Interfaces](docs/spec/005-interfaces.md#005.%20Interfaces)

With the `obsidian` preset (see [Validation presets](docs/user-guide.md#Validation%20presets)), jact also reports heading links that contain characters Obsidian removes from links, such as `:`, and suggests the corrected anchor.

## How links are resolved

For a standard Markdown link, jact tries these steps in order:

0. For a path that starts with `~/`, the path inside your home folder.
1. The path relative to the file that contains the link.
2. An Obsidian vault-style path (relative to a parent folder of the source file).
3. The same path after following symlinks.
4. A filename search inside the **scope** folder.

A wiki link such as `[[setup]]` usually skips these steps: jact uses the file the parser already found, or reports `Wiki page not found` with every path it tried. The full order is in [Path Resolution Strategy Order (cross-document links)](docs/spec/006-behavior.md#Path%20Resolution%20Strategy%20Order%20%28cross-document%20links%29).

The scope folder defaults to the nearest parent of your current folder that contains `.git`, `.obsidian`, or `package.json`; at one level, `.git` wins over `.obsidian`, which wins over `package.json`. If no parent of your current folder has one, jact searches up from the checked file's folder the same way. Use `--scope <folder>` to set it yourself, for example when you check files in another project. Details: [Scope Resolution Order](docs/spec/006-behavior.md#Scope%20Resolution%20Order).

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

Each runnable command's `--help` page (for example `jact extract header --help`, not the `jact extract` group page) lists its exact exit codes.

## Development

```bash
git clone https://github.com/WesleyMFrederick/jact.git
cd jact
npm install          # also builds dist/
npm run build        # rebuild after you change src/
npm run check        # type-check and test
node dist/cli.js     # run the CLI you just built
```

The source is TypeScript in `src/`; tests are in `test/`.

Vitest excludes `.claude/` and `.scratch/` from test discovery so shared configuration and scratch folders can hold other checkouts without running their tests. Its default exclusions for `node_modules/` and `.git/` remain in place.

Design documentation:

- [jact Living Specification](docs/spec/SPEC.md#jact%20Living%20Specification) — what jact does and why.
- [005. Interfaces](docs/spec/005-interfaces.md#005.%20Interfaces) — every command and flag in detail.
- [003. ADRs](docs/adrs/003-adrs.md#003.%20ADRs) — recorded design decisions.
