# Harness hook contracts

Research record for `jact setup` and `jact hook`, gathered 2026-11-19. It states what each harness was observed to do and where the observation came from. The steps for users are in [Wire jact into an agent harness](../harness-hooks.md#Wire%20jact%20into%20an%20agent%20harness).

Tags: `#OBS` means seen in a command output or a file. `#A` means believed but not verified.

## What each harness was observed to do

| Harness | Hook point | Event sent to the hook | How text returns to the model |
|---|---|---|---|
| Claude Code 2.1.328 | `hooks.PostToolUse` in `.claude/settings.json`; matcher on tool name | JSON on standard input: `tool_name`, `tool_input.file_path`, `cwd`, `session_id` | `{"decision":"block","reason"}` or `hookSpecificOutput.additionalContext` |
| Codex 0.160.0 | `hooks.PostToolUse` in `.codex/hooks.json`; tool name `apply_patch` | JSON on standard input: `tool_input.command` holds the patch text; file names are on `*** Add File:` lines | The same two shapes as Claude Code |
| Gemini CLI 0.41.2 | `hooks.AfterTool` in `.gemini/settings.json`; matcher is a regular expression | JSON on standard input: `tool_name`, `tool_input`, `tool_response`, `session_id`, `cwd`, `hook_event_name`, `timestamp` | `hookSpecificOutput.additionalContext`, appended to the tool result |
| pi 1.4.0 | `.pi/extensions/<name>.ts`; `pi.on("tool_result", handler)` | `event.toolName`, `event.input.path`, `event.content`, `ctx.cwd` | The handler returns `{content, isError}` |
| omp 19.0.0 | `.omp/extensions/<name>.ts`; the same `tool_result` event | The same fields as pi | The same return value as pi |

## Evidence

- #OBS Claude Code, Codex, pi, and omp each ran a live session in which the installed hook caught a broken link. Claude Code, pi, and omp also added linked content on a read. [^live]
- #OBS Gemini CLI builds the `AfterTool` event from `tool_name`, `tool_input`, and `tool_response` plus five base fields, and appends `additionalContext` to the tool result. [^gemini-code]
- #OBS Gemini CLI 0.41.2 could not start a model session: the server answered `UNSUPPORTED_CLIENT` for the signed-in account. The latest published version is 0.69.0. [^gemini-login]
- #A A current Gemini CLI still sends `tool_input.file_path` for `write_file`, `replace`, and `read_file`. Risk if wrong: the Gemini hook stays silent. Cost to verify: one run of `node scripts/hooks-e2e.mjs gemini` after the login works. The parser also accepts `path` and `absolute_path`.
- #OBS pi skips a project's extensions until the project is trusted. Print mode cannot show the prompt, so it needs `--approve`. [^pi-trust]
- #OBS Codex ran the project hook only with `--dangerously-bypass-hook-trust` and a trusted project in a run without a UI. Codex has no read event: it reads files through shell commands. [^live]
- #OBS A user-level `~/.codex/hooks.json` can already hold hook entries from another tool on five events, so setup must merge and never overwrite. [^codex-existing]
- #OBS Codex's `workspace-write` sandbox keeps a project's `.codex` folder read-only. It refused `jact setup codex` and Codex's own patch tool. So Codex cannot wire itself. [^codex-sandbox]
- #A In an interactive Codex session, the user can approve the command to run outside the sandbox. Risk if wrong: none for the guide, which tells the user to run the command in a terminal. Cost to verify: one interactive session.
- #OBS An agent that had only the README and the guide wired its own harness on the first attempt: Claude Code in 15 seconds, pi in 14, omp in 90. Codex could not write the file and gave the user the command to run, in 73 seconds. [^readme-setup]
- #OBS Four agents found the setup command in the README in 3.6 to 9.9 seconds, each with the correct answer. [^readme-find]

## Prior art that shaped the interface

- #OBS graphify installs hooks with one function for each harness. Each function loads the existing JSON, removes its own earlier entry, appends a new entry, and writes the file. The hook command is the tool's own subcommand, `graphify hook-check`. jact copies both ideas. [^graphify]
- #OBS graphify replaces a config file that is not valid JSON with an empty object. jact refuses instead, so a typing error in a settings file cannot delete other tools' hooks. [^graphify]
- #OBS beads uses `bd setup <agent>` with the flags `--print`, `--check`, `--remove`, `--project`, and `--global`, and one source file plus one test file for each agent. jact copies the command name and the flag names. [^beads]

[^live]: #OBS `node scripts/hooks-e2e.mjs claude codex pi omp`, 2026-11-19. Each run passed. The hook log recorded `kind: "write", failed: true` for each harness and `kind: "read"` with content for Claude Code, pi, and omp.
[^gemini-code]: #OBS `@google/gemini-cli/bundle/chunk-6DSAZLFF.js:320905` (`fireAfterToolEvent`), `:321071` (`createBaseInput`), `:302256` (`getAdditionalContext`), version 0.41.2.
[^gemini-login]: #OBS `gemini -p "Reply with OK" --skip-trust` printed `IneligibleTierError ... reasonCode: 'UNSUPPORTED_CLIENT'`. `npm view @google/gemini-cli version` printed `0.69.0`.
[^pi-trust]: #OBS `@earendil-works/pi-coding-agent/docs/security.md`, section "Project trust without an interactive prompt", and `docs/cli.md:237` (`-a`, `--approve`). A live run without `--approve` recorded zero hook calls; the same run with it recorded two.
[^codex-existing]: #OBS A `~/.codex/hooks.json` on the test machine held entries from one other tool on `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PermissionRequest`, and `Stop`.
[^codex-sandbox]: #OBS `codex exec -s workspace-write`, 2026-11-19. Codex reported that `.codex` "is explicitly read-only", and its log shows `patch rejected: writing outside of the project; rejected by user approval settings`.
[^readme-setup]: #OBS 2026-11-19. A throwaway project held `README.md` and `docs/harness-hooks.md`. The prompt was "Set up jact for this harness. The instructions are in README.md." Commands: `claude -p <prompt> --setting-sources project --allowedTools Read "Bash(jact:*)"`, `codex exec -s workspace-write --skip-git-repo-check <prompt>`, `pi -p <prompt> --no-session`, `omp -p <prompt> --no-session`. Pass means `jact setup <harness> --check` exited 0 afterward. The test put this branch's build first on `PATH`, because the installed `jact` was an older build without `setup`. Before the README named the sandbox limit, the Codex run took 126 seconds and 77,866 tokens to reach the same answer; afterward, 73 seconds and 22,180 tokens.
[^readme-find]: #OBS 2026-11-19. A folder held only `README.md`. The prompt was "Using only README.md in this folder, reply with the one command that sets up jact for Codex and the file it writes. Nothing else." Whole-run times: Claude Code 3.7 seconds, pi 7.2, Codex 9.9, omp 3.6 and 4.6 with `--no-extensions`. With the test machine's own omp extensions on, omp took 8.7 to 9.5 seconds, and one of those extensions added a turn that replaced the visible reply in 3 of 4 runs.
[^graphify]: #OBS graphify `graphify/__main__.py:787-816` (`_install_codex_hook`) and `:305-316` (`_install_gemini_hook`).
[^beads]: #OBS beads `cmd/bd/setup.go:503-512` and the folder `cmd/bd/setup/`.
