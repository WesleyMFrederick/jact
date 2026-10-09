# 008. Capabilities

**Status:** done

This feature matrix lists what jact does and where a user reaches each capability. Command and flag details live in [005. Interfaces](005-interfaces.md#005.%20Interfaces).

## Feature Matrix

Every capability below ships in this checkout.

| Capability | Where |
|---|---|
| Check cross-document Markdown links and their anchors | [`jact validate`](005-interfaces.md#%60jact%20validate%60) |
| Check link syntax only: plain text, inline code, and fenced code never produce an error | `jact validate` |
| Check unsaved content that arrives on standard input, for hooks and pipes | `jact validate --stdin` |
| Check many files at once, chosen by path, glob, or git changes, with one summary | `jact validate <paths...>`, `--changed`, `--json` |
| Check only the links and rule findings inside a line range | `jact validate --lines N-M` |
| Select renderer validation presets with user defaults and nearest-project overrides | [Validation configuration and presets](005-interfaces.md#Validation configuration and presets) |
| Enable or disable individual rules and load custom validation plugins | [Validation configuration and presets](005-interfaces.md#Validation configuration and presets) |
| Detect Obsidian local-file split-style links and dropped-character anchors | `obsidian/no-reference-note-link`, `obsidian/anchor-dropped-chars` under the `obsidian` preset |
| Rewrite split-style note links inline and delete their definitions | `jact validate --fix` with `obsidian/no-reference-note-link` enabled |
| Repair broken citation paths and anchors, with a dry-run preview and an optional backup | `jact validate --fix` |
| Turn a prose `.md` path into a Markdown link when it resolves to exactly one file; code and commands keep their text | `jact validate --fix` |
| Move files, folders, batches, and globs, and rewrite every link and plain path that the move changes | [`jact rename`](005-interfaces.md#%60jact%20rename%20%3Csource...%3E%20%3Cdestination%3E%60) |
| Keep `#anchor`, `:line` suffixes, code formatting, and runnable command text during a move; verify the result and roll back on failure | `jact rename --fix` |
| Resolve links across another project | `--scope <dir>` (inferred from the working folder inside a repository) |
| Print a file's heading tree before an extract | [`jact outline`](005-interfaces.md#%60jact%20outline%20%3Cfile%3E%20level%20%60) |
| Show the parsed syntax tree and link data, for debugging | `jact ast <file>` |
| Extract linked content, one section, or one whole file | `jact extract links`, `jact extract header`, `jact extract file` |
| List the target paths that a file links to | `npm run jact:base-paths <file>` (an npm script, not a `jact` command) |
| Parse Obsidian syntax: wiki links, caret anchors, highlights, comments, citations, and permissive links | [ADR-0003 — Flavor Extension Collection](../adrs/003-adrs.md#ADR-0003%20—%20Flavor%20Extension%20Collection) |

## Plain Paths in Commands

A move rewrites plain paths in prose and in commands; `--fix` converts only prose paths. A command line, including an unmarked line that looks like a command, keeps its runnable plain-path text. `jact rename` still updates the path inside it.
