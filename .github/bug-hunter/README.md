# Bug Hunter

Bug Hunter is a multi-agent PR review that runs on Claude Managed Agents and posts its confirmed findings as a PR review. It follows the "Bug hunter" flow from the AI Engineer NYC 2026 workshop *Why One AI Agent Isn't Enough (And How to Run 1,000)* by CJ Avilla and Harrison Stall (chapter at 1:04:45).

## How it works

The slide's rule is "no agent reviews its own finding". Every step after the first uses fresh agents:

1. **Split.** `bug-hunter.mjs` cuts the PR into at most 6 slices of whole files, about 400 changed lines each, in plain code. It skips lockfiles, `dist/`, snapshots, and planning docs (`docs/`, `design-docs/`, `.scratch/`). It uploads each slice as a diff file into the agent's sandbox. A PR with nothing left to review gets a short "nothing to review" comment and no session.
2. **Read.** One agent per slice reads its diff and the code around it, and lists at most 5 suspected bugs.
3. **Pick.** Plain code merges the suspects, drops duplicates, and keeps the top 8.
4. **Prove.** A fresh prover that sees only the claim tries to confirm it, running tests in the sandbox when cheap.
5. **Report.** Only confirmed findings come back.

Steps 2 to 5 live in `system-prompt.md`. The agent runs them as a Managed Agents **dynamic workflow**: a small program that runs many agents in phases, which the server runs in the background. The lead agent only gets a short manifest (title, description, slice paths), never the full diff, and is told to start the workflow before reading anything.

`bug-hunter.mjs` handles the plumbing:

- It finds or creates the agent and its cloud environment. Each name carries a hash of its config, so editing `system-prompt.md` creates a new agent instead of changing the old one.
- It starts a session with the repo mounted at the PR head commit, the slice files beside it, and a cost cap.
- It polls until every workflow run has ended and the session is idle with `end_turn`. That is the documented definition of done. At 75% of the budget it tells the agent to stop its runs and report what is already confirmed.
- If the CI job is cancelled or crashes, it stops and archives the session so nothing keeps spending.
- It posts one PR review. Findings on changed lines become inline comments, and the rest go in the review body. It prints a cost table (per agent role and model) in the job log and the job summary.

## Setup

1. Connect GitHub Actions to Anthropic with [Workload Identity Federation](https://platform.claude.com/docs/en/manage-claude/wif-providers/github-actions.md). No API key is created or stored. Each run, GitHub signs a short-lived token that says "this is a `pull_request` run of WesleyMFrederick/jact", and Anthropic trades it for a 10-minute access token.
   1. In the Claude Console, go to **Settings → Workload identity → Connect workload** and select **GitHub Actions**.
   2. Use these values: issuer `https://token.actions.githubusercontent.com` (discovery), audience `https://api.anthropic.com`, subject prefix `repo:WesleyMFrederick/jact:`, claim `repository_owner` = `WesleyMFrederick`, scope `workspace:developer`, lifetime `600`.
   3. Copy the four IDs the wizard shows into repo variables. They are identifiers, not secrets:
      ```bash
      gh variable set ANTHROPIC_FEDERATION_RULE_ID -R WesleyMFrederick/jact --body fdrl_...
      gh variable set ANTHROPIC_SERVICE_ACCOUNT_ID -R WesleyMFrederick/jact --body svac_...
      gh variable set ANTHROPIC_ORGANIZATION_ID   -R WesleyMFrederick/jact --body <org uuid>
      gh variable set ANTHROPIC_WORKSPACE_ID      -R WesleyMFrederick/jact --body wrkspc_...   # only if the rule covers more than one workspace
      ```
2. Create the trigger label: `gh label create bug-hunt -R WesleyMFrederick/jact --description "Run Bug Hunter on this PR"`.
3. Optional: set repo variables to tune it: `BUG_HUNTER_BUDGET_CENTS` (default `1500`), `BUG_HUNTER_MODEL` (default `claude-opus-5-5`), and `BUG_HUNTER_FAIL_ON` (`high`, `medium`, `low`, or `none`; default `high`).

## Where secrets live

No secret is ever written to a `.env` file, the repo, or the agent's sandbox. The talk's rule (chapter "Credential vaults & locking down tools", 1:27:50) is that credentials must never touch the sandbox, because anything on the agent's disk can be talked out of it.

| Secret | Stored in | Who can read it |
| ------ | --------- | --------------- |
| Anthropic access | Nowhere. GitHub's OIDC token is exchanged per run for a 10-minute Anthropic token | Only the CI step that calls the API. The agent never sees it. The federation rule accepts only tokens from this repo. |
| `GITHUB_TOKEN` | Issued by GitHub per job, expires when the job ends | Only the CI step, to read the PR and post the review. It is not passed to the agent. |
| Repo access for the agent | None | jact is public, so the sandbox clones it without a token. |

The agent finds bugs and returns JSON. It cannot push, comment, or call GitHub, because it has no credential to do so. Only the CI script writes to GitHub, after the session ends.

If the agent ever needs to call an outside API, store that key in a Managed Agents [vault](https://platform.claude.com/docs/en/managed-agents/vaults.md) and pass `vault_ids` when creating the session. The platform swaps a placeholder for the real value at the network edge, only for the hosts you allow. The sandbox holds only the placeholder. For a private repo, set `REPO_TOKEN` to a read-only token scoped to that one repo.

## When it runs

- When a non-draft PR opens, or when a draft PR is marked ready for review.
- When you add the `bug-hunt` label. To run it again, remove the label and add it back.

There is no manual `gh workflow run` trigger: the Anthropic federation rule accepts only `pull_request` runs. A labeled run uses the workflow file from the PR's own merge commit, so a PR branched before Bug Hunter merged needs a rebase first.

It does not run on every push, because each run spends API credit. Fork PRs are skipped, because GitHub gives them no secrets.

## Check result

| Exit | Check | Meaning |
| ---- | ----- | ------- |
| 0 | pass | No confirmed finding at or above `FAIL_ON` severity. A budget stop or timeout also passes, but the review heading says "did not finish" and the job shows a warning. |
| 1 | fail | At least one confirmed finding at or above `FAIL_ON` severity. |
| 2 | fail | The review itself broke, for example a bad API key or an unreadable report. |

## Cost

Each session has a hard cap (`BUDGET_CENTS`, default $15.00). At the cap the run pauses, the script stops the session, and the review says it did not finish. The cap can overshoot by about one model request per working agent. The Console's monthly spend limit applies on top of this. Each run's real cost appears in the review footer and in a per-agent cost table in the job summary; set `BUG_HUNTER_BUDGET_CENTS` to about 1.5 times the cost of a typical finished run.

## Run it locally

```bash
cd .github/bug-hunter && npm ci --ignore-scripts
ant auth login   # or any credential the SDK resolves; never write a key to a .env file
GITHUB_TOKEN="$(gh auth token)" GITHUB_REPOSITORY=WesleyMFrederick/jact PR_NUMBER=128 DRY_RUN=1 node bug-hunter.mjs
```

`DRY_RUN=1` prints the review instead of posting it.

## Sources and open questions

- The talk says Bug Hunter is "available as a template and also in Claude Code". As of 2026-11-19, no Bug Hunter template, template API, or official GitHub Action for it appears in the [Managed Agents docs index](https://platform.claude.com/llms.txt). So this is a hand-built version of the flow on the slide.
- API shapes come from these pages: [dynamic workflows](https://platform.claude.com/docs/en/managed-agents/multiagent-orchestration.md), [knowing when a run is done](https://platform.claude.com/docs/en/managed-agents/workflow-runs.md), [GitHub repo mounts](https://platform.claude.com/docs/en/managed-agents/github.md), [session budgets](https://platform.claude.com/docs/en/managed-agents/budgets.md) (`amount` is whole US cents as a string), and [the event stream](https://platform.claude.com/docs/en/managed-agents/events-and-streaming.md). They use beta header `managed-agents-2026-04-01`, which SDK `@anthropic-ai/sdk@1.11.0` sends.
- Managed Agents sessions are not eligible for Zero Data Retention. The PR diff and repo contents are stored with the session until it is deleted.
