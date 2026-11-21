# Wire jact into an agent harness

An agent that writes Markdown breaks links. An agent that reads Markdown misses the pages a file links to. A harness hook fixes both, because the harness runs jact after each file write and each file read. The agent does not need to remember.

## Set up in one command

Run this in the project folder. jact must be on the `PATH` ([Install](../README.md#Install)).

```bash
jact setup <harness>
```

| Harness | Command | File jact writes | jact runs after | One more step |
|---|---|---|---|---|
| Claude Code | `jact setup claude` | `.claude/settings.json` | `Write`, `Edit`, `MultiEdit`, `Read` | None |
| Codex | `jact setup codex` | `.codex/hooks.json` | `apply_patch` | Run the command in your own terminal, not through Codex. Then start `codex`, run `/hooks`, trust the jact entry |
| Antigravity CLI (`agy`) | `jact setup antigravity` | `.agents/hooks.json` | `write_file`, `edit_file`, `read_file` | None in the tested runs. To confirm, start `agy` and run `/hooks`: the list must show a hook named `jact`. |
| Gemini CLI | `jact setup gemini` | `.gemini/settings.json` | `write_file`, `replace`, `read_file` | Trust the folder when Gemini asks |
| pi | `jact setup pi` | `.pi/extensions/jact.ts` | `write`, `edit`, `read` | Start `pi` and trust the project, or run `/trust` |
| omp | `jact setup omp` | `.omp/extensions/jact.ts` | `write`, `edit`, `read` | None |

**Which Google command do you run?** Google moved unpaid, Google One, and Google AI Pro and Ultra accounts from Gemini CLI to Antigravity CLI on 2026-06-18. If you start your agent with `agy`, use `jact setup antigravity`. Use `jact setup gemini` only where the `gemini` command still runs, which is a paid API key or an enterprise account. Antigravity CLI does not read the file that `jact setup gemini` writes.

Options, the same for each harness:

| Option | Effect |
|---|---|
| `--global` | Write the user-level file instead, so each project gets the hook: `~/.claude/settings.json`, `~/.codex/hooks.json`, `~/.gemini/config/hooks.json` (Antigravity CLI), `~/.gemini/settings.json` (Gemini CLI), `~/.pi/agent/extensions/jact.ts`, `~/.omp/agent/extensions/jact.ts` |
| `--print` | Print the file that setup would write. Write nothing. |
| `--check` | Exit 0 when the wiring is installed, 1 when it is not. JSON formatting and unrelated hooks do not affect the result. |
| `--remove` | Remove only jact's hook, including from shared groups. Cannot be combined with `--print` or `--check`. |
| `--command <command>` | The command the harness runs to start jact. Default: `jact`. Use a full path when the harness does not see your `PATH`. |

Setup is safe to run again. It keeps hook entries from other tools, it replaces its own entry instead of adding a second, and it refuses a config file that is not valid JSON.

**If you are an agent and setup prints `Cannot write`:** your sandbox protects the harness's own config folder. Do not look for another route. Give the user the same command to run in a terminal. Codex does this for `.codex/`.

## Check that it works

1. Run `jact setup <harness> --check`. Exit code 0 means the wiring is in place.
2. Start a new session in the harness. Ask the agent: "Create `docs/jact-check.md` with one line: `See [missing](missing.md).`"
3. The agent must report a broken link to `missing.md`. Delete the file afterward.

To see each hook call, set `JACT_HOOK_LOG=<file>` in the environment of the harness. jact appends one JSON line for each call.

In a clone of this repository, `node scripts/hooks-e2e.mjs <harness>` runs steps 1 to 3 in a throwaway project with a real harness session. Add `--synthetic` to skip the model call while still loading the installed event matchers, commands, or extension.

## What the model sees

| Event | jact runs | The model sees |
|---|---|---|
| Write or edit of a `.md` file, links valid | `jact validate <file>` | Nothing |
| Write or edit of a `.md` file, links broken | `jact validate <file>` | Each broken link with its line, the error, and a suggested fix |
| Read of a `.md` file | `jact extract links <file> --session <id>` | The sections that file links to, one time for each session, cut at 20,000 characters |
| Any other tool, or a file that is not `.md` | Nothing | Nothing |

A hook call always exits 0. If jact fails, the hook prints nothing and the harness continues. The read hook stores its session cache in `.jact/` in the project; add that folder to `.gitignore`.

### Antigravity CLI: the model sees it one step later

Antigravity CLI gives a tool hook no way to answer the model. So jact uses three hooks there, and one name, `jact`, holds all three in `.agents/hooks.json`.

| Hook | When Antigravity CLI runs it | What jact does |
|---|---|---|
| `PostToolUse` | After a file write or read | Runs the check. Holds the result in `.jact/hook-pending/` in the project. Prints `{}`. |
| `PreInvocation` | Before a model call | Hands the held result to the model as a system message, one time. Prints `{}` when nothing is held. |
| `Stop` | When the agent is about to stop | If a broken-link report is still held, makes the agent continue one time with that report. Otherwise lets it stop. |

If the agent repairs the file before the report is handed over, jact withdraws the report.

The system message stays in the conversation, so the model can still use the linked content many steps later. jact does not use Antigravity CLI's `ephemeralMessage`: in version 1.5.12 the model lost one after a single model call, and jact does not send the same linked content twice in one conversation.

The write and read path passed in live Antigravity CLI 1.5.12 sessions with two Gemini models and one Claude model, with the sandbox on and off. Each time, the model's reply quoted the broken-link report and the linked content. The `Stop` fallback passed in a session that had no `PreInvocation` hook. When the model starts a write and a read in one step, the next `PreInvocation` call hands over both results in one message.

## Any other harness

A harness needs one thing: a point that runs code after a tool call. Then follow these steps.

1. Find where the harness runs code after a tool call, and how that code sends text back to the model.
2. After a file write, edit, or read, run `jact hook pi`. Send this JSON on standard input:

   ```json
   { "tool_name": "write", "tool_input": { "path": "docs/guide.md" }, "cwd": "/abs/project", "session_id": "abc" }
   ```

3. Read standard output. Empty output means there is nothing to tell the model. Otherwise it is one JSON object:

   ```json
   { "context": "text for the model", "failed": true }
   ```

4. Add `context` to the tool result. When `failed` is true, mark the tool result as an error so the model fixes the links.
5. Run the check in [Check that it works](#Check%20that%20it%20works).

`jact hook` accepts these input fields:

| Field | Values |
|---|---|
| `tool_name`, or `toolCall.name` | A write: `write`, `edit`, `multiedit`, `write_file`, `edit_file`, `replace`, `apply_patch`, `write_to_file`, `replace_file_content`, `multi_replace_file_content`. A read: `read`, `read_file`, `view_file`. Letter case does not matter. Other names are ignored. |
| `tool_input`, or `toolCall.args` | The file, in one of: `file_path`, `path`, `absolute_path`, `Path`, `TargetFile`, `AbsolutePath`, a `paths` list, or patch text that has `*** Add File:`, `*** Update File:`, or `*** Move to:` lines |
| `cwd`, or the first entry of `workspacePaths` | The project folder. Relative paths resolve from it. Default: the current folder. |
| `session_id`, or `conversationId` | Optional. Lets the read hook add each linked section one time only. |
| `error` | Read only beside `toolCall`. Text here means the tool call failed, and jact does nothing. |
| `hookEventName` | Read only by `jact hook antigravity`, and only when `--event` is absent. |

The harness name selects the output format:

| Name | Output on broken links | Output on a read |
|---|---|---|
| `pi`, `omp` | `{"context", "failed": true}` | `{"context", "failed": false}` |
| `claude`, `codex` | `{"decision": "block", "reason"}` | `{"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext"}}` |
| `gemini` | `{"hookSpecificOutput": {"hookEventName": "AfterTool", "additionalContext"}}` | The same shape |
| `antigravity` | `{}` now. Later `{"injectSteps": [{"systemMessage": {"systemMessage"}}]}` from `--event PreInvocation`, or `{"decision": "continue", "reason"}` from `--event Stop` | `{}` now. Later the same `injectSteps` shape from `--event PreInvocation` |

`jact hook antigravity` takes `--event PostToolUse`, `--event PreInvocation`, or `--event Stop`. Without `--event`, it reads `hookEventName` from the input. Antigravity CLI 1.5.12 sends that field, but Google's hook page does not list it, so `jact setup antigravity` writes `--event` in each command. Use this name for another harness whose tool hook cannot answer the model.

A harness that accepts Claude Code hook settings can use `jact hook claude` without changes. A harness with no hook point can use the rule in [Rule for agents without hooks](#Rule%20for%20agents%20without%20hooks).

## Rule for agents without hooks

Add this to `AGENTS.md` or `CLAUDE.md`:

```markdown
After you write or edit a Markdown file, run `jact validate <file>` and fix each error.
Before you read a long Markdown file, run `jact outline <file>`, then `jact extract header <file> "<heading>"` for the section you need.
```

## Limits

- **Codex has no read hook.** Codex reads files through shell commands, so there is no read event. jact runs on writes only.
- **Codex cannot wire itself.** The `workspace-write` sandbox keeps a project's `.codex/` folder read-only, so `jact setup codex` fails when Codex runs it. A person must run that one command.
- **Trust steps are the harness's own.** Codex, Gemini CLI, and pi do not run a project's hooks until you trust them. Without a UI, the flags are `--dangerously-bypass-hook-trust` (Codex), `--skip-trust` (Gemini CLI), and `--approve` (pi). Antigravity CLI 1.5.12 ran a new project's hooks with no trust step in runs without a UI.
- **Antigravity CLI's tool names are not the names in its documentation.** Version 1.5.12 sends `write_file`, `edit_file`, and `read_file`, with the file in `Path`. Google's hook page names `write_to_file`, `replace_file_content`, `multi_replace_file_content`, and `view_file`, which no tested session sent. jact matches both sets. If a later version renames the tools, the hook goes silent. To check on your machine, run `node scripts/hooks-e2e.mjs antigravity` in a clone of this repository. It passes only when the model's reply shows the broken-link report and the linked content.
- **Two Antigravity CLI paths have not run in a live session.** The live runs used the project file, `.agents/hooks.json`, in sessions without a UI. The path that `--global` writes, `~/.gemini/config/hooks.json`, comes from Google's documentation. No interactive session ran, so a trust step there is possible.
- **Antigravity CLI gets the report one step later**, and its `PreInvocation` hook adds about 0.09 seconds before each model call.
- **Antigravity CLI's sandbox can hide jact from the agent.** With `--sandbox`, the agent's shell tool does not see files under `~/Documents`. The hooks still run. But an agent that you ask to set jact up fails on its first try when jact is installed from a folder there. Run `jact setup antigravity` in your own terminal in that case.
- **The model still judges the text.** Antigravity CLI tells the model that a hook supplied the message. In the tests a Claude model used an ordinary fact from it, and would not repeat a "launch code" that arrived the same way.
- **Gemini CLI serves fewer accounts.** Since 2026-06-18 it works only with a paid API key or an enterprise account. An update of Gemini CLI does not change that. Other Google accounts use Antigravity CLI.
- **Cost.** One hook call takes about 0.35 seconds. See [Measured value](#Measured%20value).

## Verified harness versions

Checked on 2026-11-19 with `scripts/hooks-e2e.mjs`. "Live" means a real model session wrote a broken link and read a file, and the hook log recorded both.

| Harness | Version | Sample event | Live session | Agent set itself up from the README |
|---|---|---|---|---|
| Claude Code | 2.1.328 | Pass | Pass: write caught, read enriched | Pass in 15 seconds |
| Codex | 0.160.0 | Pass | Pass: write caught | Blocked by Codex's sandbox. Codex gave the user the command to run, in 73 seconds. |
| pi | 1.4.0 | Pass | Pass: write caught, read enriched | Pass in 14 seconds |
| omp | 19.0.0 | Pass | Pass: write caught, read enriched | Pass in 90 seconds. omp also ran the check in a new session. |
| Antigravity CLI | 1.5.12 | Pass | Pass: write caught, read enriched, and the model's reply quoted both. Three models: Gemini 4 Neon, Gemini 3.8 Flash, Claude Sonnet 5.5. Also with `--sandbox`. | Pass in 31 seconds. With `--sandbox`: pass in 54 seconds, on the second try. |
| Gemini CLI | 0.41.2 | Pass | Not run: Google moved this account type to Antigravity CLI, so the server refused the session. The event fields were checked against the CLI's own code. | Not run |

For the last column, the agent had only `README.md` and this guide, and one request: "Set up jact for this harness. The instructions are in README.md." Pass means `jact setup <harness> --check` exited 0 afterward, on the first attempt.

Each pull request runs the same wiring and event checks without a model: `test/hooks/` and `test/cli-integration/hook-setup-commands.test.ts`. Sources for each harness contract: [Harness hook contracts](research/harness-hook-contracts.md#Harness%20hook%20contracts).

## Measured value

Measured on this repository's own Markdown (36 files in `docs/` and `src/`) on 2026-11-19. Reproduce with `node scripts/measure-agent-value.mjs docs src`.

| Question | Result |
|---|---|
| How much does an agent load to read one section? | Median 1,891 characters for the outline plus one section. The whole file is a median 9,270 characters: **83% less**. Range across 23 files: 54% to 95%. |
| How fast is a link check? | **331 links in about 1 second**, with no model call |
| Does it find real problems? | **3 broken links** in 3 committed files |
| What does a hook cost? | About **0.35 seconds** for each write or read |
| How fast does an agent find the setup command in the README? | **4 to 12 seconds**, correct each time: Claude Code 3.7, omp 4.6, pi 7.2, Codex 9.9, Antigravity CLI 10.7 to 11.5 (6.3 to 7.2 with its fast model) |

Method for the first row: for each file of 4,000 characters or more that has two or more H2 sections, compare the file length with the length of `jact outline` output plus the file's median-length H2 section from `jact extract header`.

When no files qualify for the reading measurement, the script prints an explanatory message instead of saving percentages. When no Markdown files are found, it also reports that hook timing is unavailable.

Method for the last row: a real session in a folder that holds only `README.md` was asked for the command that sets up jact for Codex and the file it writes. The time is the whole run, startup included. Antigravity CLI needs 5.5 to 6.5 seconds for a prompt that reads no file, so its default model misses a 10-second target by 0.7 to 1.5 seconds.
