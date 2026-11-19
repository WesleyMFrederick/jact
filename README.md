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
jact setup claude   # Claude Code: writes .claude/settings.json
jact setup codex    # Codex:       writes .codex/hooks.json
jact setup gemini   # Gemini CLI:  writes .gemini/settings.json
jact setup pi       # pi:          writes .pi/extensions/jact.ts
jact setup omp      # omp:         writes .omp/extensions/jact.ts
```

Then confirm: `jact setup <harness> --check` exits with code 0.

If setup prints `Cannot write`, your sandbox protects the harness config (Codex does this for `.codex/`). Give the user the same line to run in a terminal.

After setup, the harness runs jact by itself:

- **After a Markdown write or edit**, the model sees each broken link with a suggested fix.
- **After a Markdown read**, the model gets the sections that file links to, one time for each session.

Setup merges into an existing file and keeps other tools' hooks. Add `--global` for all projects, `--print` to preview, `--remove` to undo.

| You need | Go to |
|---|---|
| The trust step for Codex, Gemini CLI, or pi | [Set up in one command](docs/harness-hooks.md#Set%20up%20in%20one%20command) |
| Proof that the hook runs | [Check that it works](docs/harness-hooks.md#Check%20that%20it%20works) |
| A harness that is not in the list | [Any other harness](docs/harness-hooks.md#Any%20other%20harness) |
| An agent with no hook support | [Rule for agents without hooks](docs/harness-hooks.md#Rule%20for%20agents%20without%20hooks) |

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

## Development

```bash
git clone https://github.com/WesleyMFrederick/jact.git
cd jact
npm install          # also builds dist/
npm run build        # rebuild after you change src/
npm run check        # type-check and test
node dist/cli.js     # run the CLI you just built
```

Design documentation: [jact Living Specification](docs/spec/SPEC.md#jact%20Living%20Specification) and [003. ADRs](docs/adrs/003-adrs.md#003.%20ADRs).
