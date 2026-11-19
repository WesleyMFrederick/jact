# Bug Hunter

Bug Hunter is a multi-agent PR review that runs on Claude Managed Agents and posts its confirmed findings as a PR review. It follows the "Bug hunter" flow from the AI Engineer NYC 2026 workshop *Why One AI Agent Isn't Enough (And How to Run 1,000)* by CJ Avilla and Harrison Stall (chapter at 1:04:45).

## How it works

The slide's rule is "no agent reviews its own finding". Every step uses fresh agents:

1. **Split.** Plain code cuts the diff into even slices.
2. **Read the code.** One agent per slice lists suspected bugs.
3. **Second look.** A fresh agent re-reads every slice, including slices with no hits, for what the first one missed.
4. **Pick the candidates.** Plain code merges and ranks the suspects.
5. **Prove each candidate.** A prover that sees only the claim tries to confirm it, running tests in the sandbox when cheap. A rejected claim goes to one more fresh prover.
6. **Report.** Only confirmed findings come back.

The phases live in `system-prompt.md`. The agent runs them as a Managed Agents **dynamic workflow**: it writes a small program that runs many agents in phases, and the server runs it in the background.

`bug-hunter.mjs` handles the plumbing:

- It finds or creates the agent and its cloud environment. Each name carries a hash of its config, so editing `system-prompt.md` creates a new agent instead of changing the old one.
- It starts a session with the repo mounted at the PR head commit, a cost cap, and the diff in the first message.
- It polls until every workflow run has ended and the session is idle with `end_turn`. That is the documented definition of done.
- It posts one PR review. Findings on changed lines become inline comments, and the rest go in the review body.

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
3. Optional: set repo variables to tune it: `BUG_HUNTER_BUDGET_CENTS` (default `300`), `BUG_HUNTER_MODEL` (default `claude-opus-5-5`), and `BUG_HUNTER_FAIL_ON` (`high`, `medium`, `low`, or `none`; default `high`).

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
- On demand from the main branch: `gh workflow run bug-hunter.yml -f pr_number=128`.

It does not run on every push, because each run spends API credit. Fork PRs are skipped, because GitHub gives them no secrets.

## Check result

| Exit | Check | Meaning |
| ---- | ----- | ------- |
| 0 | pass | No confirmed finding at or above `FAIL_ON` severity. A budget stop or timeout still passes, with a warning. |
| 1 | fail | At least one confirmed finding at or above `FAIL_ON` severity. |
| 2 | fail | The review itself broke, for example a bad API key or an unreadable report. |

## Cost

Each session has a hard cap (`BUDGET_CENTS`, default $3.00). At the cap the run pauses, and the script reports partial results. The cap can overshoot by about one model request per working agent. The Console's monthly spend limit applies on top of this; at $10 a month, expect about three full runs. Raise the limit under **Spending & usage** in the Console before you rely on this check.

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
