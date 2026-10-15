# 005. Interfaces

**Status:** done

This section maps each command to the code that registers it, runs it, and sets its exit code, and states the rules for help pages. Command meaning, flags, and output shapes live in [005. Interfaces](../../../../docs/spec/005-interfaces.md#005.%20Interfaces).

## Command-to-Code Map

Each row names the contract section and the files that act on one command. `src/cli.ts` registers every row.

| Command | Contract | Runs in | Exit code set in |
|---|---|---|---|
| `validate`, one file | [`jact validate`](../../../../docs/spec/005-interfaces.md#%60jact%20validate%60) | `src/jact-cli.ts`; the `--fix` recheck uses a fresh validate workflow | `src/cli.ts` |
| `validate`, batch | Same section | `src/validate/` batch runner and renderers | `src/cli.ts` |
| `rename` | [`jact rename <source...> <destination>`](../../../../docs/spec/005-interfaces.md#%60jact%20rename%20%3Csource...%3E%20%3Cdestination%3E%60) | `src/jact-cli.ts`, then the core rename planner | `src/cli.ts` |
| `vault-link` | [`jact vault-link <note> [target]`](../../../../docs/spec/005-interfaces.md#%60jact%20vault-link%20%3Cnote%3E%20target%20%60) | `src/cli.ts`, with the core vault link fixer | `src/cli.ts` |
| `outline` | [`jact outline <file> [level]`](../../../../docs/spec/005-interfaces.md#%60jact%20outline%20%3Cfile%3E%20level%20%60) | `src/jact-cli.ts` | `src/cli.ts` |
| `ast` | [`jact ast <file>`](../../../../docs/spec/005-interfaces.md#%60jact%20ast%20%3Cfile%3E%60) | `src/jact-cli.ts` | `src/cli.ts` |
| `extract links` | [`jact extract links <source-file>`](../../../../docs/spec/005-interfaces.md#%60jact%20extract%20links%20%3Csource-file%3E%60) | `src/jact-cli.ts` | `src/jact-cli.ts`; `src/cli.ts` for a `--session` cache hit |
| `extract header` | [`jact extract header <target-file> <header-name>`](../../../../docs/spec/005-interfaces.md#%60jact%20extract%20header%20%3Ctarget-file%3E%20%3Cheader-name%3E%60) | `src/jact-cli.ts`, with a synthetic header link | Both files |
| `extract file` | [`jact extract file <target-file>`](../../../../docs/spec/005-interfaces.md#%60jact%20extract%20file%20%3Ctarget-file%3E%60) | `src/jact-cli.ts`, with a synthetic file link | Both files |

---

## Help-Text Contract

Each help page is part of the command contract. A reviewer compares it with the contract section in the map above.

| Help part | Rule |
|---|---|
| Usage line | Matches the usage block in the contract section; a parent's command list shows each command's own usage line |
| Arguments and options | Each flag, default, and value list matches the contract table |
| Value lists | A flag with a fixed set of values declares Commander choices, so a wrong value fails before the action runs |
| Shared flags | Every `--scope` flag uses the shared scope description; the three `extract` commands share one `-v, --verbose` description |
| Examples | Each command shows at least one runnable example |
| Exit Codes | The last block; one row per code, with the meaning from the contract's exit-code line |

A PR that changes a flag, default, or exit path updates the help text, the repository contract section, and this map together.

### Extra Help Blocks

Some commands add blocks between the examples and the exit codes.

| Command | Extra blocks |
|---|---|
| `validate` | Default output, batch mode, and rule presets |
| `rename` | Safety |
| `vault-link` | Behavior |
| `outline` | Default heading ceiling |
| `ast` | Output fields: every top-level JSON key |

---

## Parser Rejections

Commander rejects an unknown command, an unknown flag, a missing required argument, a value outside its choices, or an argument that fails a custom parser. It does so before any action runs, so nothing is read or written.

- A known synonym, such as `check` for `validate` or `json` for `--format json`, gets a "Did you mean" line instead of the default message.
- Every rejection exits `2`, the usage-error code in [Exit Codes](../../../../docs/spec/005-interfaces.md#Exit%20Codes); help and version output exit `0`.
- `rename` declares its paths optional, so a missing source or destination reaches the action and exits `1` as a refused plan.

---

## Local State

Two features keep files under `.jact/claude-cache` in the working folder.

| Feature | Key | Effect |
|---|---|---|
| `extract links --session <id>` | Session ID and source file | A hit skips extraction and exits `0` |
| `outline` next-step reminders | Session ID and target file | Reminders show once; `--cache-reset` shows them again |

The outline session ID comes from the environment, as in [Environment Variables](../../../../docs/spec/005-interfaces.md#Environment%20Variables).

---

## Programmatic Surface

`src/jact-cli.ts` loads without Commander, so tests and scripts can import the orchestrator alone. It exports the orchestrator class, its outline and file-extraction outcome types, and the linked-content hint builder. The registry imports the class and the hint builder.

---

## Version History

| Version | Changes |
|---|---|
| 1.1.0 | 2026-10-15: Parser rejections exit `2`; command lists show each command's own usage; `ast` lists all output fields and exit codes; `validate` declares format choices and reuses the shared scope description |
| 1.0.0 | 2026-10-11: Initial command-to-code map and help-text contract |
