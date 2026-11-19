# Harness hook contracts

Research record for `jact setup` and `jact hook`, gathered 2026-11-19. It states what each harness was observed to do and where the observation came from. The steps for users are in [Wire jact into an agent harness](../harness-hooks.md#Wire%20jact%20into%20an%20agent%20harness).

Tags: `#OBS` means seen in a command output, a file, or a named document. `#A` means believed but not verified. `#H` means a claim with a test that can refute it.

## What each harness was observed to do

| Harness | Hook point | Event sent to the hook | How text returns to the model |
|---|---|---|---|
| Claude Code 2.1.328 | `hooks.PostToolUse` in `.claude/settings.json`; matcher on tool name | JSON on standard input: `tool_name`, `tool_input.file_path`, `cwd`, `session_id` | `{"decision":"block","reason"}` or `hookSpecificOutput.additionalContext` |
| Codex 0.160.0 | `hooks.PostToolUse` in `.codex/hooks.json`; tool name `apply_patch` | JSON on standard input: `tool_input.command` holds the patch text; file names are on `*** Add File:` lines | The same two shapes as Claude Code |
| Antigravity CLI (`agy`), from its documentation, not run | One hook name as a top-level key in `.agents/hooks.json`; events `PostToolUse`, `PreInvocation`, `Stop`; the tool matcher is a regular expression | JSON on standard input: `toolCall.name`, `toolCall.args.TargetFile` or `AbsolutePath`, `workspacePaths`, `conversationId`, `error`. The event name is absent. | `PostToolUse` must answer `{}`. `PreInvocation` answers `{"injectSteps":[{"ephemeralMessage"}]}`. `Stop` answers `{"decision":"continue","reason"}`. |
| Gemini CLI 0.41.2 | `hooks.AfterTool` in `.gemini/settings.json`; matcher is a regular expression | JSON on standard input: `tool_name`, `tool_input`, `tool_response`, `session_id`, `cwd`, `hook_event_name`, `timestamp` | `hookSpecificOutput.additionalContext`, appended to the tool result |
| pi 1.4.0 | `.pi/extensions/<name>.ts`; `pi.on("tool_result", handler)` | `event.toolName`, `event.input.path`, `event.content`, `ctx.cwd` | The handler returns `{content, isError}` |
| omp 19.0.0 | `.omp/extensions/<name>.ts`; the same `tool_result` event | The same fields as pi | The same return value as pi |

## Evidence

- #OBS Claude Code, Codex, pi, and omp each ran a live session in which the installed hook caught a broken link. Claude Code, pi, and omp also added linked content on a read. [^live]
- #OBS Gemini CLI builds the `AfterTool` event from `tool_name`, `tool_input`, and `tool_response` plus five base fields, and appends `additionalContext` to the tool result. [^gemini-code]
- #OBS Gemini CLI 0.41.2 could not start a model session: the server answered `UNSUPPORTED_CLIENT` for the signed-in account. The latest published version is 0.69.0. [^gemini-login]
- #OBS Google replaced Gemini CLI with Antigravity CLI on 2026-06-18 for unpaid, Google One, and Google AI Pro and Ultra accounts. Gemini CLI still serves paid API keys and enterprise accounts. [^agy-transition]
- #A That change caused the refusal, not the age of the installed CLI. An update of Gemini CLI does not fix it for this account. An earlier draft of this record said the opposite. Risk if wrong: none for the design, because `jact setup gemini` stays for the accounts that Gemini CLI still serves.
- #A A current Gemini CLI still sends `tool_input.file_path` for `write_file`, `replace`, and `read_file`. Risk if wrong: the Gemini hook stays silent. Cost to verify: one run of `node scripts/hooks-e2e.mjs gemini` with an account that Gemini CLI still serves. The parser also accepts `path` and `absolute_path`.
- #OBS pi skips a project's extensions until the project is trusted. Print mode cannot show the prompt, so it needs `--approve`. [^pi-trust]
- #OBS Codex ran the project hook only with `--dangerously-bypass-hook-trust` and a trusted project in a run without a UI. Codex has no read event: it reads files through shell commands. [^live]
- #OBS A user-level `~/.codex/hooks.json` can already hold hook entries from another tool on five events, so setup must merge and never overwrite. [^codex-existing]
- #OBS Codex's `workspace-write` sandbox keeps a project's `.codex` folder read-only. It refused `jact setup codex` and Codex's own patch tool. So Codex cannot wire itself. [^codex-sandbox]
- #A In an interactive Codex session, the user can approve the command to run outside the sandbox. Risk if wrong: none for the guide, which tells the user to run the command in a terminal. Cost to verify: one interactive session.
- #OBS An agent that had only the README and the guide wired its own harness on the first attempt: Claude Code in 15 seconds, pi in 14, omp in 90. Codex could not write the file and gave the user the command to run, in 73 seconds. [^readme-setup]
- #OBS Four agents found the setup command in the README in 3.6 to 9.9 seconds, each with the correct answer. [^readme-find]

## Antigravity CLI: built from the documentation, not run

No Antigravity CLI session ran. Each `#OBS` in this section is what a document states. Whether the program does what its documentation states is the first `#A`.

- #OBS `agy` is not installed on the test machine, and its sign-in needs a browser. [^agy-absent]
- #OBS The documentation states that hooks load from `.agents/hooks.json` in the project and from `~/.gemini/config/hooks.json` for the user. It states that hooks in `~/.gemini/antigravity-cli/settings.json` are not loaded. A separate test by another author found the same two files. [^agy-docs] [^agy-where]
- #OBS The documentation states the file shape. Each top-level key is a hook name that the user chooses. Its value holds event keys: `SessionStart`, `PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation`, `Stop`. A tool event lists `{"matcher", "hooks": [{"type": "command", "command", "timeout"}]}`. The other four events list the command objects directly, with no matcher. [^agy-docs]
- #OBS The documentation states the input: camelCase JSON on standard input with `conversationId`, `workspacePaths`, `transcriptPath`, `artifactDirectoryPath`, and `modelName`. `PostToolUse` adds `toolCall.name`, `toolCall.args`, `stepIdx`, and `error`, which is empty when the tool succeeded. No field names the event, and no field names the working folder. [^agy-docs]
- #OBS The documentation names the file tools and their path fields: `write_to_file`, `replace_file_content`, and `multi_replace_file_content` use `TargetFile`; `view_file` uses `AbsolutePath`. [^agy-docs]
- #OBS The documentation states the outputs. `PostToolUse` "Returns an empty JSON object". `PreInvocation` accepts `injectSteps`, with the example `{"injectSteps": [{"ephemeralMessage": "Remember to lint"}]}`. `Stop` needs `decision`: the value `continue` keeps the agent running and gives `reason` to the model, and each other value lets it stop. [^agy-docs]
- #A Antigravity CLI does what its documentation states. Risk if wrong: the hook stays silent, or `agy` reports a hook error. Cost to verify: install `agy`, sign in one time, then run `node scripts/hooks-e2e.mjs antigravity`.
- #A A Gemini CLI `AfterTool` hook does not run in `agy`. The documentation lists six events, and `AfterTool` is not one of them. It also does not list `.gemini/settings.json` as a hooks file. So `jact setup gemini` does nothing for Antigravity CLI. Risk if wrong: none, because `jact setup antigravity` writes a different file.
- #H `PreInvocation` runs before each model call, so the model gets jact's result at its next step. Support: the documentation calls `invocationNum` the number "of the current model invocation". Rival: it runs one time for each user turn. In that case the `Stop` hook hands a broken-link report over, and linked content from a read is lost. Test that refutes: the live run prints which event handed the result over.
- #A The model reads an `ephemeralMessage`. The documentation calls it "A transient system message". Risk if wrong: `PreInvocation` takes the held report and the model never sees it. The `Stop` fallback does not help then, because the report is gone. Cost to verify: the same live run, which fails unless the model replies that it saw the report.
- #A A hook that prints `{}` on bad input, and exits 0, never stops `agy`. The documentation does not state what a non-zero exit, text on standard error, or a timeout does. Risk if wrong: low, because jact always prints JSON and exits 0.
- #A `agy` may ask the user to trust a workspace before it runs that workspace's hooks. One third-party guide says so; Google's hook page does not. Risk if wrong: the project hook stays silent until the user trusts the folder. Cost to verify: the `/hooks` command in `agy` lists the hooks it loaded.
- #OBS The installed wiring passes with the documented events. The check reads `.agents/hooks.json`, runs the command of each event, and confirms that the matcher selects the four file tools and not `run_command`. [^agy-synthetic]
- #OBS A `PreInvocation` call with nothing to hand over takes about 90 milliseconds, and a `Stop` call about 85. Antigravity CLI pays the first one before each model call. [^agy-cost]

## Prior art that shaped the interface

- #OBS graphify installs hooks with one function for each harness. Each function loads the existing JSON, removes its own earlier entry, appends a new entry, and writes the file. The hook command is the tool's own subcommand, `graphify hook-check`. jact copies both ideas. [^graphify]
- #OBS graphify replaces a config file that is not valid JSON with an empty object. jact refuses instead, so a typing error in a settings file cannot delete other tools' hooks. [^graphify]
- #OBS beads uses `bd setup <agent>` with the flags `--print`, `--check`, `--remove`, `--project`, and `--global`, and one source file plus one test file for each agent. jact copies the command name and the flag names. [^beads]

[^live]: #OBS `node scripts/hooks-e2e.mjs claude codex pi omp`, 2026-11-19. Each run passed. The hook log recorded `kind: "write", failed: true` for each harness and `kind: "read"` with content for Claude Code, pi, and omp.
[^gemini-code]: #OBS `@google/gemini-cli/bundle/chunk-6DSAZLFF.js:320905` (`fireAfterToolEvent`), `:321071` (`createBaseInput`), `:302256` (`getAdditionalContext`), version 0.41.2.
[^gemini-login]: #OBS `gemini -p "Reply with OK" --skip-trust` printed `IneligibleTierError ... reasonCode: 'UNSUPPORTED_CLIENT'`. `npm view @google/gemini-cli version` printed `0.69.0`.
[^agy-transition]: #OBS [Transitioning Gemini CLI to Antigravity CLI](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/), Google Developers Blog, and the banner on geminicli.com, both read 2026-11-19.
[^agy-absent]: #OBS `command -v agy` printed nothing on 2026-11-19. No `agy` file was in `/opt/homebrew/bin`, `/usr/local/bin`, `~/.local/bin`, or `~/bin`.
[^agy-docs]: #OBS [Hooks](https://antigravity.google/docs/hooks), Google Antigravity documentation, read 2026-11-19 through a page fetch. The fetch limits each quote to 125 characters, so field names are exact and longer examples are paraphrased.
[^agy-where]: #OBS Mete Atamel, [Where does Antigravity look for Hooks?](https://atamel.dev/posts/2026/07-16_where_agy_hooks/), 2026-07-16. The author's hook script takes the event name as a command argument and prints `{"decision": "stop"}` for `Stop`. jact does the same.
[^agy-synthetic]: #OBS `node scripts/hooks-e2e.mjs antigravity --synthetic`, 2026-11-19: pass, with the line `handed to the model by: PreInvocation`.
[^agy-cost]: #OBS 2026-11-19, 15 runs of `node dist/cli.js hook antigravity --event <event>` on one macOS machine. `PreInvocation`: median 90 milliseconds, range 82 to 117. `Stop`: median 85, range 81 to 136.
[^pi-trust]: #OBS `@earendil-works/pi-coding-agent/docs/security.md`, section "Project trust without an interactive prompt", and `docs/cli.md:237` (`-a`, `--approve`). A live run without `--approve` recorded zero hook calls; the same run with it recorded two.
[^codex-existing]: #OBS A `~/.codex/hooks.json` on the test machine held entries from one other tool on `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PermissionRequest`, and `Stop`.
[^codex-sandbox]: #OBS `codex exec -s workspace-write`, 2026-11-19. Codex reported that `.codex` "is explicitly read-only", and its log shows `patch rejected: writing outside of the project; rejected by user approval settings`.
[^readme-setup]: #OBS 2026-11-19. A throwaway project held `README.md` and `docs/harness-hooks.md`. The prompt was "Set up jact for this harness. The instructions are in README.md." Commands: `claude -p <prompt> --setting-sources project --allowedTools Read "Bash(jact:*)"`, `codex exec -s workspace-write --skip-git-repo-check <prompt>`, `pi -p <prompt> --no-session`, `omp -p <prompt> --no-session`. Pass means `jact setup <harness> --check` exited 0 afterward. The test put this branch's build first on `PATH`, because the installed `jact` was an older build without `setup`. Before the README named the sandbox limit, the Codex run took 126 seconds and 77,866 tokens to reach the same answer; afterward, 73 seconds and 22,180 tokens.
[^readme-find]: #OBS 2026-11-19. A folder held only `README.md`. The prompt was "Using only README.md in this folder, reply with the one command that sets up jact for Codex and the file it writes. Nothing else." Whole-run times: Claude Code 3.7 seconds, pi 7.2, Codex 9.9, omp 3.6 and 4.6 with `--no-extensions`. With the test machine's own omp extensions on, omp took 8.7 to 9.5 seconds, and one of those extensions added a turn that replaced the visible reply in 3 of 4 runs.
[^graphify]: #OBS graphify `graphify/__main__.py:787-816` (`_install_codex_hook`) and `:305-316` (`_install_gemini_hook`).
[^beads]: #OBS beads `cmd/bd/setup.go:503-512` and the folder `cmd/bd/setup/`.
