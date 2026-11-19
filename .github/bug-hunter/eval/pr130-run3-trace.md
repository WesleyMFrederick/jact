# PR #130 run 3 trace: where the misses were lost

This trace covers Managed Agents session `sesn_01BvNZE7JRpReioMeQpvHLgn`, workflow run `wrun_01QrMmsVwnzHQSXFyjBEnbTG`, and GitHub Actions run 44613043107. The run reviewed commit 3be0371. It was read on 2026-11-19 with `ant auth` and SDK 1.11.0, using read-only calls: `sessions.retrieve`, `sessions.events.list`, `sessions.threads.list`, `sessions.threads.events.list` and `sessions.resources.list`. The raw dumps (one file per thread) are in `/Users/wesleyfrederick/.claude/jobs/728344d2/tmp/run3-trace/`, which is outside the repo.

Each claim is tagged. #OBS means it was observed, and cites a thread id (`sthr_…`) or event id (`sevt_…`). #A means it is an assumption, and states the risk if it is wrong.

## What the API does not expose

Three things were not retrievable, and every gap below follows from them.

- **Reader outputs are not in the event stream.** The reader threads emit no `agent.message`. Their `agent.thinking` events carry no text. A reader's answer exists only in its final model request, for example `sevt_0164Vv3GfQVrT5gWpZbJQ7SB` for the s2 reader, which produced 1,465 output tokens. #OBS
- **The lead's workflow program is not exposed.** The `workflow_run.created` event (`sevt_013WbqXvCzTCXeAE5Sta7Qfu`) carries only the phase names and descriptions, for example Pick: "Merge, dedupe and rank suspects; keep at most 8". The lead thread has no `agent.tool_use` that contains the program. Three paths returned 404: `/v1/sessions/{id}/workflow_runs/{wrun}`, `/v1/sessions/{id}/workflow_runs`, and `/v1/workflow_runs/{wrun}`. #OBS
- **Prover verdict text is also absent.** The verdicts below come from the lead's final report (`sevt_014BngWGnY1yU3ZqS1P4PfgF`), which says "proved 5 suspects. 4 were confirmed and 1 was rejected". #OBS

So Pick's actual caps, and each reader's full suspect list, **cannot be observed**.

## Agents as configured by the lead

- There were 3 readers and 5 provers, and every thread ended with `end_turn`. The lead's final report has `not_covered: []`. #OBS (`threads.json`; idle events such as `sevt_01Xupd1Q7ZAR8QK96Xwsmk8F`)
- All 9 agents ran `claude-opus-5-5` at effort `medium`, with `web_search` and `web_fetch` **disabled**. #OBS (`threads.json`, `agent.tools[0].configs`)
- The reader system prompt says: "Never report style, naming, **docs wording**, or speculative refactors." The lead added "docs wording". It is not in `system-prompt.md`. #OBS (`threads.json`, the reader `agent.system` field)
- Each reader's task text matches the prompt: "Return at most 5 suspected defects". #OBS (`sevt_0111Z6c9jT6Mmy7Ny4K9CmfZ` for s1, `sevt_01N5BteiURGDCVXSS5JZytrJ` for s2, `sevt_01G5NbKacNr6JTwB9Eg961N5` for s3)

## Readers

| Slice | Thread | Tool calls | What it read | Last-turn output tokens |
| --- | --- | --- | --- | --- |
| s1 README | `sthr_016xqD8k3mvYnEL5u9ugnWWm` | 5 | the slice, the full README and workflow, and greps and ranges of `bug-hunter.mjs` | 287 |
| s2 runner | `sthr_01DBTXJD87AFD5RKY568uZBy` | 3 | the slice, all of `bug-hunter.mjs` (`cat -n`, `sevt_01LSELZN7wHnbzH4mDVPLwTM`) and the workflow | 1,465 |
| s3 yml, prompt, package, AGENTS | `sthr_012PUhCVgf1Mn7rEV2i576n9` | 4 | the slice, the workflow, `package.json`, and all of `system-prompt.md` (`sevt_016F7q87vXnbhC7o1BxsVqRK`) | 365 |

The tool calls and output token counts are #OBS. The suspect lists themselves are not observable.

## Pick

- The Pick phase started and ended within 1 µs of the Read phase ending: `sevt_01XW1RfQa476qqYPo6jS5BX2` → `sevt_01K5ivEnXKF6th2pHAZRJPgP`. No model call ran in between, which fits plain code. #OBS
- Pick sent 5 candidates on to provers. Mapped back to slices: 1 from s1 (README), 3 from s2 (mjs) and 1 from s3 (yml). #OBS (the prover task texts below)
- #A: Pick dropped nothing, because 5 is under the cap of 8. Risk if wrong: the lead's program may have applied an unseen filter, such as a severity floor or a dedupe that was too wide. Some misses would then be (b), not (a).

## Provers

| Thread | Claim (from the task text) | Verdict | Evidence |
| --- | --- | --- | --- |
| `sthr_01MVGscqnS64QnhbrpSBf3n6` (`sevt_01BPz9C5NJsciZeny63VHYsD`) | An unrelated label cancels a running hunt (yml:20) | confirmed, = F3 | Read the workflow; traced concurrency against the job `if` |
| `sthr_01PW5qvdxdspuXu8TXPD3Poh` (`sevt_016GHMgBL3kUQ4aEcuHNLbYJ`) | The wrap-up is sent to a finished session (mjs:418) | confirmed, = F9 | Ran `assess()` on a synthetic event list (`sevt_015tCYz3XNRvpiZTyzE8Thrv`) |
| `sthr_01DjT9voLEsrXxNV5cA8VuW4` (`sevt_01X8XivMDnFBqPp3kt1xG4kb`) | The signal handler is killed before it archives (mjs:468) | confirmed, matches F4 in part | Traced the 30 s wait against the ~10 s kill window. It names the bash-child problem only as "may also" |
| `sthr_01Nf3q41crbG4DBHxQNTFaks` (`sevt_019VU1E6yzR1t8gp9QLTkmaU`) | The draft-PR label is ignored, contrary to the README (README:62) | confirmed, = F13 | Read the workflow `if` and the README |
| `sthr_01BvDvVm2xp5xhgkN54bYkyK` (`sevt_01H7dVtFKBcbUX6UA3MNX7Vw`) | One transient API error while polling gives exit 2 (mjs:412) | **rejected** | A fake 503 server showed the SDK retries: "ok idle requests 3" (`sevt_01Vt7XXSjYLxLgjG4yFYY1SL`) |

The claims, tool calls and outcomes are #OBS. The verdicts come from the lead's report, `sevt_014BngWGnY1yU3ZqS1P4PfgF`. No prover ran `npm ci`, so F10's race did not occur in this run. #OBS (prover tool calls)

## The 7 misses

None of the 7 is (c). The only rejected claim is the transient-API-error one, and it matches no answer-key bug. #OBS (`sthr_01BvDvVm2xp5xhgkN54bYkyK`)

| Miss | Slice | Verdict | Basis |
| --- | --- | --- | --- |
| F6 parseReport fence | s2 | **(a) or (b), ambiguous** | The reader saw the code (`sevt_01LSELZN7wHnbzH4mDVPLwTM`). Its output (`sevt_0164Vv3GfQVrT5gWpZbJQ7SB`, 1,465 tokens) is large enough for 5 suspects, and only 3 from s2 reached provers. Up to 2 s2 suspects may have been cut at Pick. |
| F7 files without a patch | s2 | **(a) or (b), ambiguous** | Same as F6. Also needs knowledge of GitHub API behavior, and readers had no web access. |
| F8 retries_exhausted | s2 | **(a) or (b), ambiguous** | Same as F6. Needs the Managed Agents docs, and readers had no web access. #OBS that web was off |
| F14 no cleanup on failure | s2 | **(a) or (b), ambiguous** | Same as F6. |
| F10 concurrent npm ci | s3 | **likely (a)** | The reader read all of `system-prompt.md` (`sevt_016F7q87vXnbhC7o1BxsVqRK`). Its final turn was 365 tokens including thinking, which is room for about 1 suspect, and exactly 1 s3 candidate went on. Needs the shared-sandbox docs (no web). #A, risk: a terse list of 2–3 could fit in 365 tokens |
| F11 no pipefail | s3 | **likely (a)** | The reader read the workflow (`sevt_011suJHJ57xMzijSHAQHfoJz`). The output-size argument is the same as for F10. |
| F12 federation rule scope | s1 | **likely (a)** | The reader read the README (`sevt_01Xdqz8p6PJj1eBqruErUJhs`). Its final turn was 287 tokens, and 1 s1 candidate went on. Judging F12 needs the WIF `sub` claim formats (no web), and "docs wording" was excluded. #A, same risk as F10 |

## What changed from the earlier inference

- **Held:** no miss was rejected by a prover, and Pick's top-8 cut was not what lost them. The rejected candidate turns out not to be a key bug at all.
- **Did not hold, or not provable:** the earlier claim that the 5-per-reader cap never applied, and that all misses were (a), was too strong. The s2 reader may have returned more suspects than reached provers. Whether Pick cut 1–2 of them cannot be seen, because neither reader outputs nor the program are exposed.
- **New:** at the readers, three misses (F8, F10, F12) need external docs, and every agent ran with web tools off. The lead also added "docs wording" to the reader exclusions.
