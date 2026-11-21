---
created: 2026-11-19T11:50:56
last_modified: 2026-11-19T17:21:49
---
# Bug Hunter

Bug Hunter is a multi-agent PR review that runs on Claude Managed Agents and posts its confirmed findings as a PR review. It follows the "Bug hunter" flow from the AI Engineer NYC 2026 workshop *Why One AI Agent Isn't Enough (And How to Run 1,000)* by CJ Avilla and Harrison Stall (chapter at 1:04:45).

## How it works

The slide's rule is "no agent reviews its own finding". Every step after the first uses fresh agents:

1. **Split.** `bug-hunter.mjs` cuts the PR into at most 6 slices of whole files, about 400 changed lines each, in plain code. It skips lockfiles, `dist/`, snapshots, and planning docs (`docs/`, `design-docs/`, `.scratch/`). It uploads each slice as a diff file into the agent's sandbox, plus the build helper `ensure-jact-build.mjs` (see [Build once per session](#Build%20once%20per%20session)). A PR with nothing left to review gets a short "nothing to review" comment and no session.
2. **Read.** One agent per slice reads its diff and the code around it, and lists at most 5 suspected bugs.
3. **Pick.** Plain code merges the suspects, drops duplicates, and keeps the top 8.
4. **Prove.** A fresh prover that sees only the claim tries to confirm it, running tests in the sandbox when cheap. Before any test it runs the one build command from the manifest, then `npx vitest run <file>` from the repo root. It never runs `npm ci`, `npm run build`, or `npm run clean` itself.
5. **Report.** Only confirmed findings come back.

Steps 2 to 5 live in [system-prompt.md · How to work](system-prompt.md#How%20to%20work). The agent runs them as a Managed Agents **dynamic workflow**: a small program that runs many agents in phases, which the server runs in the background. The lead agent only gets a short manifest (title, description, slice paths), never the full diff, and is told to start the workflow before reading anything.

`bug-hunter.mjs` handles the plumbing:

- It finds or creates the agent and its cloud environment. Each name carries a hash of its config, so editing `system-prompt.md` creates a new agent instead of changing the old one.
- It starts a session with the repo mounted at the PR head commit, the slice files and the build helper beside it, and a cost cap. The first message carries the exact build command for that session.
- It polls until every workflow run has ended and the session is idle with `end_turn`. That is the documented definition of done. At 75% of the budget it tells the agent to stop its runs and report what is already confirmed.
- If the CI job is cancelled or crashes, it stops and archives the session so nothing keeps spending. A job killed with no signal (SIGKILL, a lost runner) runs no cleanup: that session spends until its budget cap, or until the next Bug Hunter run for the same PR stops it.
- It posts one PR review. Findings on changed lines become inline comments, and the rest go in the review body. It prints a cost table (per agent role and model) in the job log and the job summary.

### Build once per session

`npm run build` starts with `clean`, which deletes `dist/`. When several provers each built the repo, one prover's build could delete `dist/cli.js` while another was testing with it. So the build runs once per session, inside the sandbox, through one script:

- The runner uploads `ensure-jact-build.mjs` as a session file. It lands at `/mnt/session/uploads/ensure-jact-build.mjs`, because file mounts sit under the session's uploads directory ([file paths](https://platform.claude.com/docs/en/managed-agents/files#file-paths)). The runner never runs the script and never builds the PR itself, and it deletes the upload with the slice files when the run ends.
- The manifest gives the exact command: `node /mnt/session/uploads/ensure-jact-build.mjs --repo /workspace/repo --head <PR head sha> --session <session id>`. The lead copies it into every prover's prompt.
- The first caller checks that the repo is at that head, takes a lock in the repo's git directory, and runs `npm ci --ignore-scripts`, then `npm run build`, exactly once. Every later caller waits for that build and reuses it. A `dist/` folder that was there before is never taken as proof of a build.
- If install or build fails, that caller and every later one exit with the same failing code; nothing retries. A caller that waits on the lock longer than 5 minutes (the default) fails loudly instead of deleting it. If ready output goes missing, or a different head or session calls, the script fails instead of rebuilding. Each call logs one line with its outcome and exit code.

**Limit.** The script decides how and when the build runs, but a model still has to call it. The system prompt tells provers to call it before any test and never to run `npm ci`, `npm run build`, or `npm run clean` directly, but nothing enforces that: a prover can skip the call or run a direct build, and that brings the race back. The options compared before this design was chosen are in [Bug Hunter: build-once options](../../docs/features/20261120T192002-bug-hunter-build-once/research/bug-hunter-build-once-options.md#Recommendation).

## Setup

1. Connect GitHub Actions to Anthropic with [Workload Identity Federation](https://platform.claude.com/docs/en/manage-claude/wif-providers/github-actions.md). No API key is created or stored. Each run, GitHub signs a short-lived token that says "this is a `pull_request` run of WesleyMFrederick/jact", and Anthropic trades it for a 10-minute access token.
   1. In the Claude Console, go to **Settings → Workload identity → Connect workload** and select **GitHub Actions**.
   2. Use these values: issuer `https://token.actions.githubusercontent.com` (discovery), audience `https://api.anthropic.com`, subject prefix `repo:WesleyMFrederick/jact:pull_request`, claim `repository_owner` = `WesleyMFrederick`, scope `workspace:developer`, lifetime `600`.
   3. The rule trusts every `pull_request` job in this repo, not only Bug Hunter's: anyone who can push a branch here can add a workflow that gets a token. A claim on the workflow file does not close this, because a PR can edit that file too. Keep push access to people you would trust with the Anthropic workspace.
   4. Copy the four IDs the wizard shows into repo variables. They are identifiers, not secrets:
      ```bash
      gh variable set ANTHROPIC_FEDERATION_RULE_ID -R WesleyMFrederick/jact --body fdrl_...
      gh variable set ANTHROPIC_SERVICE_ACCOUNT_ID -R WesleyMFrederick/jact --body svac_...
      gh variable set ANTHROPIC_ORGANIZATION_ID   -R WesleyMFrederick/jact --body <org uuid>
      gh variable set ANTHROPIC_WORKSPACE_ID      -R WesleyMFrederick/jact --body wrkspc_...   # only if the rule covers more than one workspace
      ```
2. Create the trigger label: `gh label create bug-hunt -R WesleyMFrederick/jact --description "Run Bug Hunter on this PR"`.
3. Optional: set repo variables to tune it: `BUG_HUNTER_BUDGET_CENTS` (default `1500`), `BUG_HUNTER_MODEL` (default `claude-opus-5-5`), and `BUG_HUNTER_FAIL_ON` (`high`, `medium`, `low`, or `none`; default `high`).

`FAIL_ON` (set by `BUG_HUNTER_FAIL_ON` in CI) accepts only the case-sensitive values `high`, `medium`, `low`, and `none`. Any other value, including `Medium`, is a configuration error: the runner names the invalid value and allowed values, then exits 2 before making API calls. Unset or empty values still default to `high`.

## Where secrets live

No secret is ever written to a `.env` file, the repo, or the agent's sandbox. The talk's rule (chapter "Credential vaults & locking down tools", 1:27:50) is that credentials must never touch the sandbox, because anything on the agent's disk can be talked out of it.

| Secret | Stored in | Who can read it |
| ------ | --------- | --------------- |
| Anthropic access | Nowhere. GitHub's OIDC token is exchanged per run for a 10-minute Anthropic token | Only the CI step that calls the API. The agent never sees it. The federation rule accepts only `pull_request` runs of this repo, so other workflows here (such as the npm release job) cannot get a token. |
| `GITHUB_TOKEN` | Issued by GitHub per job, expires when the job ends | Only the CI step, to read the PR and post the review. It is not passed to the agent. |
| Repo access for the agent | None | jact is public, so the sandbox clones it without a token. |

The agent finds bugs and returns JSON. It cannot push, comment, or call GitHub, because it has no credential to do so. Only the CI script writes to GitHub, after the session ends.

If the agent ever needs to call an outside API, store that key in a Managed Agents [vault](https://platform.claude.com/docs/en/managed-agents/vaults.md) and pass `vault_ids` when creating the session. The platform swaps a placeholder for the real value at the network edge, only for the hosts you allow. The sandbox holds only the placeholder. For a private repo, set `REPO_TOKEN` to a read-only token scoped to that one repo.

## When it runs

- When a non-draft PR opens, or when a draft PR is marked ready for review.
- When you add the `bug-hunt` label to a non-draft PR. To run it again, remove the label and add it back. On a draft PR the label does nothing: the check shows as skipped. Mark the PR ready for review instead.

There is no manual `gh workflow run` trigger: the Anthropic federation rule accepts only `pull_request` runs. A labeled run uses the workflow file from the PR's own merge commit, so a PR branched before Bug Hunter merged needs a rebase first.

It does not run on every push, because each run spends API credit. Fork PRs are skipped, because GitHub gives them no secrets.

## Check result

| Exit | Check | Meaning |
| ---- | ----- | ------- |
| 0 | pass | No confirmed finding at or above `FAIL_ON` severity. A budget stop or timeout also passes, but the review heading says "did not finish" and the job shows a warning. |
| 1 | fail | A finished review has at least one confirmed finding at or above `FAIL_ON` severity. |
| 2 | fail | Invalid configuration, or the review itself broke: a failed login, an agent stopped by repeated API errors (`retries_exhausted`), or a report that breaks the JSON schema. |

## Cost

Each session has a hard cap (`BUDGET_CENTS`, default $15.00). At the cap the run pauses, the script stops the session, and the review says it did not finish. The cap can overshoot by about one model request per working agent. The Console's monthly spend limit applies on top of this. Each run's real cost appears in the review footer and in a per-agent cost table in the job summary; set `BUG_HUNTER_BUDGET_CENTS` to about 1.5 times the cost of a typical finished run.

## Run it locally

```bash
cd .github/bug-hunter && npm ci --ignore-scripts
ant auth login   # or any credential the SDK resolves; never write a key to a .env file
GITHUB_TOKEN="$(gh auth token)" GITHUB_REPOSITORY=WesleyMFrederick/jact PR_NUMBER=128 DRY_RUN=1 node bug-hunter.mjs
```

`DRY_RUN=1` prints the review instead of posting it. `PLAN_ONLY=1` prints the slices and the agent's first message, then stops before any Anthropic call, so it costs nothing.

### Exam mode: replay a fixed commit range

To score a newer Bug Hunter against an answer key written for an old snapshot, give the range instead of a pull request number. Both values must be full 40-character SHAs:

```bash
GITHUB_TOKEN="$(gh auth token)" GITHUB_REPOSITORY=WesleyMFrederick/jact \
  BASE_SHA=<base sha> HEAD_SHA=<head sha> REPORT_FILE=/path/outside/the/repo/report.json \
  node bug-hunter.mjs
```

Exam mode never posts a review. It describes the change with the commit subjects inside the range, so no later commit or pull request text reaches the agent. Each exam's session title carries its own prefix and a run label (`RUN_LABEL`, default a timestamp), so exams and CI runs never stop each other, and several exams on one snapshot can run at once. GitHub's compare API returns at most 300 files, and exam mode refuses a larger range. `REPORT_FILE` saves the report, session id, agent, model and cost as JSON; keep it outside this repo.

The sandbox still holds the repository's git history. Before scoring an exam run, scan its session events for commits made after `HEAD_SHA`; a hit means the run saw the future and its score does not count.

## Inspect a past run

GitHub's job log shows only counts. The full record of every run (each agent's suspects, each prover's verdict, the workflow, the cost) stays in the Anthropic Console workspace. Read it there to learn why a run found or missed a bug.

1. Sign in once per machine: `brew install anthropics/tap/ant`, then `ant auth login`. This signs in to the Console (platform.claude.com). A Claude subscription (Claude Code or claude.ai) is a separate account and cannot read Console sessions. The login is stored in `~/.config/anthropic/`, never in the repo or a `.env` file.
2. Find the session id (`sesn_...`) in the job log.
3. Read it with the SDK in this folder. The SDK picks up the `ant` login with no environment variables. These calls only read and cost nothing:

   ```js
   import Anthropic from "@anthropic-ai/sdk";
   const client = new Anthropic();
   await client.beta.sessions.retrieve(sessionId);                     // status, title, usage
   for await (const t of client.beta.sessions.threads.list(sessionId)) {} // one thread per agent
   for await (const e of client.beta.sessions.events.list(sessionId)) {}  // the event stream
   ```

Never call `sessions.create` or `events.send` while inspecting: those start paid work.

## Sources and open questions

- The talk says Bug Hunter is "available as a template and also in Claude Code". As of 2026-11-19, no Bug Hunter template, template API, or official GitHub Action for it appears in the [Managed Agents docs index](https://platform.claude.com/llms.txt). So this is a hand-built version of the flow on the slide.
- API shapes come from these pages: [dynamic workflows](https://platform.claude.com/docs/en/managed-agents/multiagent-orchestration.md), [knowing when a run is done](https://platform.claude.com/docs/en/managed-agents/workflow-runs.md), [GitHub repo mounts](https://platform.claude.com/docs/en/managed-agents/github.md), [session budgets](https://platform.claude.com/docs/en/managed-agents/budgets.md) (`amount` is whole US cents as a string), and [the event stream](https://platform.claude.com/docs/en/managed-agents/events-and-streaming.md). They use beta header `managed-agents-2026-04-01`, which SDK `@anthropic-ai/sdk@1.11.0` sends.
- Managed Agents sessions are not eligible for Zero Data Retention. The PR diff and repo contents are stored with the session until it is deleted.
