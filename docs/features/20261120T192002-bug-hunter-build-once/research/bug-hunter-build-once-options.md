# Bug Hunter: build-once options

## Recommendation

**Recommend option (f): upload one locked ensure-build script, and have provers call it before tests.** The AGENT selects the tool call; deterministic code owns installing dependencies, building once, waiting, reusing the result, logging, and returning an exit code. This is smaller than changing hosting or changing tests in every PR head. It also avoids the unresolved upload-to-repository placement question.

This is a proposal, not an implemented fix or an approved decision. The remaining AI trigger is explicit: a prover can skip the call. A script cannot guarantee that every test went through it unless the HARNESS makes that entry point mandatory. Do not describe this option as zero-AI setup or as an enforced test gate without that additional mechanism.

If **no AGENT-triggered setup at all** is required, choose (a), the self-hosted worker: its documented staging hook runs before any tool. If the separately gated mount-path probe is approved, run that small experiment before investing in a hosting change. A successful marker probe would not by itself prove dependency setup, a complete runtime upload, or a stable platform contract.

Status: PR #137 remains draft; no source implementation, push, or paid session was performed for this report. The paid placement probe is awaiting a USER decision in ask A4. The latest A4 also considers the locked-script option; neither action is authorized by this document.

## Problem and checked contracts

- `package.json:15-18` defines `build` as `npm run clean && tsc`; `clean` removes `dist/` and the incremental-build state. Concurrent builds can erase files another prover is executing. This is the [independent review's finding](https://github.com/WesleyMFrederick/jact/pull/137#pullrequestreview-6002488318), not a hypothetical reason to repeat the failed run.
- Native CLI tests already use repository-relative output: for example, `test/cli-integration/extract-command.test.js:15` runs `node dist/cli.js`. No existing `JACT_CLI` or `JACT_DIST` override was found by the targeted search. That is a bounded search result, not a guarantee about every possible invocation.
- [File paths](https://platform.claude.com/docs/en/managed-agents/files#file-paths): “The path you specify is rooted under the session’s uploads directory.” `/data.csv` becomes `/mnt/session/uploads/data.csv`. Mounted files are read-only copies. Setting a file's `mount_path` to `/workspace/repo/dist/cli.js` is **not documented** as mounting it inside the repository.
- [Repository resources](https://platform.claude.com/docs/en/managed-agents/github#github-mcp-and-session-resources) describe repository `mount_path` as “The directory under `/workspace` to clone the repository into.” The example uses `/workspace/repo`. Moving the repository under uploads is not a documented escape hatch.
- [Multiple files](https://platform.claude.com/docs/en/managed-agents/files#multiple-files) permits at most 500 files per session. The inspected local build contains 96 runtime JavaScript files; all of `dist/` contains 384 files including declarations and maps. The checkout has 476 tracked files. Thus **dist-only fits** before other uploads, while a complete tracked-file snapshot plus only runtime JavaScript already needs 572 files. Recount the exact manifest for the actual PR head; these counts are a local snapshot, not a fixed product limit.[^counts]
- Runtime JavaScript is not a dependency bundle. Executing it directly under uploads also needs the correct module/package context and dependencies. Node resolves bare imports relative to the importing module's location, not simply the shell's working directory; see [Node module resolution](https://nodejs.org/api/esm.html#resolution-algorithm-specification). Copying output into the installed repository avoids that particular path issue.
- SDK `@anthropic-ai/sdk@1.11.0` was inspected after installation. `SessionCreateParams` exposes resources and initial events, but no setup-command field. Initial events are messages, not a deterministic shell hook. `BetaCloudConfigParams` exposes `type`, `networking`, and `packages`, but no pre-agent repository command. These are findings about the inspected SDK contracts, not proof that no undocumented capability exists. See [SDK evidence](#SDK%20evidence).

## Options at a glance

“AI step” below means mechanical setup still selected by an AGENT. Bug investigation and the choice of what test to run remain judgment work in every option.

| Option | What runs where | Remaining setup AI step | Cost and principal risk |
| --- | --- | --- | --- |
| (a) Self-hosted worker | Runner builds; our spawn/staging code places checkout, dependencies, slices, and build in an isolated worker before tools run. | None for setup. | Highest hosting/security ownership; provider pricing needs confirmation. |
| (b) Test/bootstrap change | Runner uploads build; a modified test harness reads an explicit CLI path or copies the build before tests. | Test invocation and possibly dependency/environment setup; not intrinsically zero. | Modest code change, but old frozen PR heads lack it. |
| (c) Dist-only plus fixed instruction | Runner builds/uploads runtime output; lead copies it into the cloud repository and installs dependencies once before dispatch. | One lead setup command, plus honoring its completion before dispatch. | Small change; prompt-controlled ordering remains. |
| (d) Serialized or isolated prover builds | Provers build in cloud; a lock covers each build-and-test lifecycle, or each prover has a separate checkout/output tree. | Each prover initiates setup/build/test. | Repeated work or storage; build-only locking is insufficient. |
| (e) Other approaches | Direct overlay probe, uploaded archive/bootstrap, or runner-side custom test tool. | Varies; detailed below. | Either unverified placement or a larger execution-contract change. |
| (f) Uploaded locked ensure-build script | Script lives under uploads; first caller installs/builds in the repository; later callers wait and reuse. | Provers invoke one fixed script before tests. | Smallest recommended change; bypass and crash handling must be explicit. |

## (a) Self-hosted worker

**What runs where.** The GitHub runner checks out the exact PR head, runs `npm ci --ignore-scripts` and `npm run build` once, and records the SHA and build exit code. A per-session spawn handler stages that snapshot, compatible dependencies, build, and diff slices into the worker's repository directory. Only after successful staging does it start the worker that serves tools. The native tests retain `dist/cli.js`.

The platform explicitly documents [staging files before any tool runs](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-per-session#stage-files-for-a-session): pass references in session metadata, retrieve that metadata in the spawn/`--on-work` handler, then stage the files. The [spawn-script pattern](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-per-session#launch-sandboxes-with-a-spawn-script) and [SDK poller](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-per-session#launch-sandboxes-from-the-sdk-poller) provide the deterministic boundary.

**Remaining AI.** None for build/staging. The AGENT starts investigating only after the SYSTEM has prepared the files.

**Cost and risk.** More operational work: per-session isolation, compatible OS/architecture for dependencies, credentials, network restrictions, cleanup, readiness, and failed-stage reporting. Do not run untrusted PR code on a general-purpose developer host or a credential-rich runner. These responsibilities are assigned to us by the [self-hosted security model](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-security#what-you-own). [Self-hosted pricing](https://platform.claude.com/docs/en/about-claude/pricing#claude-managed-agents-pricing) requires contacting Anthropic; no dollar estimate was obtained.

**Important incompatibility.** Self-hosted sessions [reject `file` and `github_repository` resources](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes#session-resources) with HTTP 400. We must replace the current resource-based checkout/upload flow with our own staging. This is not just changing an environment ID.

## (b) Test/bootstrap change

**What runs where.** The runner builds and uploads `dist/` under `/mnt/session/uploads/jact-dist`. Tests change to honor an explicit CLI path, or a test-runner bootstrap copies that output into the repository before native CLI tests. A path override must migrate every relevant test caller; merely exporting a new environment variable does nothing for the current hardcoded tests.

**Remaining AI.** An AGENT still invokes the test runner and may need to install dependencies or set the variable unless software supplies those steps. A deterministic bootstrap can own copying after invocation, but does not become a pre-session hook. Direct execution under uploads must solve Node dependency resolution and package metadata too.

**Cost and risk.** Lower hosting cost than (a), but changes the test contract and must cover CLI subprocesses, alternate entry points, and fixture paths. **Frozen PR heads miss the change** until they contain it. Supplying an external test config could bootstrap an old head, but then every invocation must select that config; it is another changed entry-point contract, not an already-honored override.

**Evidence.** [Files and their upload root](https://platform.claude.com/docs/en/managed-agents/files#file-paths), [Node resolution](https://nodejs.org/api/esm.html#resolution-algorithm-specification), and the current native test command above. The env-var/bootstrap interface is proposed, not documented platform functionality.

## (c) Upload only dist/ plus one fixed instruction

**What runs where.** The runner checks out the PR head, installs without lifecycle scripts, builds once, and uploads the runtime output with its relative tree preserved. The lead receives one fixed setup instruction: install dependencies without running `prepare`, copy the uploaded tree into repository `dist/`, and dispatch provers only after successful completion. The 96-JavaScript-file snapshot fits below 500; slices and any other runtime assets still count. Including declarations/maps is optional for CLI runtime, not automatically correct for every future head.

**Remaining AI.** One lead-triggered setup command and the lead's decision to wait before dispatching. Provers themselves need no build. An AGENT skipping, repeating, or partially performing setup remains possible without a code-enforced gate.

**Cost and risk.** Small workflow/runner change; build errors can fail early on the runner. It still spends model turns on mechanical setup, requires dependency installation inside the sandbox, and needs complete assets matching the exact SHA. Repeating a copying/installing command while tests run can recreate a shared-state race even without compiling.

**Evidence.** [File mounts](https://platform.claude.com/docs/en/managed-agents/files#file-paths), [500-file cap](https://platform.claude.com/docs/en/managed-agents/files#multiple-files), and the [documented distinction between creating and starting a session](https://platform.claude.com/docs/en/managed-agents/sessions#creating-a-session). Creating the session earlier does not supply a runner-side shell endpoint.

## (d) Leave builds with provers, serialized or isolated

**Serialized variant.** Each prover acquires a shared lock, installs/builds, runs its tests, then releases the lock. To protect arbitrary repeated builds, the lock must cover **both build and test use**, not just compilation: a second prover can otherwise acquire it and run `clean` while the first is testing. All callers must use the same wrapper, including direct build/clean invocations. This sacrifices test parallelism and may repeat installation/compilation.

**Isolated variant.** Give each prover its own checkout, dependencies, and output tree. A unique TypeScript `outDir` alone is insufficient: existing tests still execute repository `dist/cli.js`, and `npm run build` still cleans the shared default output. Either isolate whole repository paths or also migrate the consumer contract as in (b).

**Remaining AI.** Each prover initiates its wrapper/build/test flow. Isolation or lock enforcement has to be implemented in code; “please serialize builds” is not serialization.

**Cost and risk.** More build time or disk use; shared locks require timeout/crash semantics; isolated checkouts require lifecycle cleanup. This avoids overlap only if all mutations/readers use the contract. It is not build-once, unlike (f).

**Evidence.** `package.json:15-18`, the [reviewed race](https://github.com/WesleyMFrederick/jact/pull/137#pullrequestreview-6002488318), and [TypeScript outDir](https://www.typescriptlang.org/tsconfig/outDir.html). Node's [exclusive-open flags](https://nodejs.org/api/fs.html#file-system-flags) provide an atomic lock primitive, not automatic reader/build coordination.

## (e) Other approaches

| Approach | What runs where and remaining AI | Cost, risk, and evidence |
| --- | --- | --- |
| Direct file overlay into repository | Runner builds/uploads; platform would need to place files directly at repository `dist/`. No AI copy if supported; dependency preparation is still separate. | Smallest runner-build path, but conflicts with the documented upload-root interpretation. SDK string types do not establish server placement. Only the approval-gated probe below can test current behavior, not establish future support. [File paths](https://platform.claude.com/docs/en/managed-agents/files#file-paths). |
| One archive plus bootstrap | Runner builds/packs; uploads one archive and one script. AGENT invokes the script to extract into the repository before tests. | Avoids per-file resource pressure, but not the setup trigger or shared-write ordering problem. Same readiness/locking concerns as (f); extraction must reject unsafe paths. [File resources](https://platform.claude.com/docs/en/managed-agents/files#mounting-files-in-a-session). |
| Runner-side custom test tool | Runner prepares the checkout/build once; a custom tool runs requested tests in that isolated execution environment and returns exit status/logs. AGENT chooses tests, not setup commands. | Deterministic setup without a cloud mount, but a new execution surface: fixture/repro patches, command policy, isolation, and result attribution. Native cloud Bash tests would still lack the build unless disabled/routed. The platform documents [application-executed custom tools](https://platform.claude.com/docs/en/managed-agents/tools#custom-tools). |
| Upload a whole runnable snapshot | Runner uploads repository files plus build, rather than using a repository resource. AGENT still needs dependency/bootstrap handling. | Full tracked snapshot plus runtime output exceeds 500 in the inspected checkout. A filtered subset may fit, but risks omitting fixtures, history, or support files; no such subset was verified. [500-file limit](https://platform.claude.com/docs/en/managed-agents/files#multiple-files). |

## (f) Upload a locked ensure-build script

**What runs where.** The runner uploads one fixed, versioned `ensure-jact-build.mjs` as a file resource, mounted at `/mnt/session/uploads/ensure-jact-build.mjs`. It lives outside the frozen PR head, so no test migration or earlier merge is needed. Provers invoke it with the shared repository path and expected session/head identity. It installs dependencies and builds **inside the cloud repository**, preserving native `dist/cli.js` paths.

**Proposed code contract, not an implementation:**

1. Use an atomic lock (`mkdir` without recursive success-on-existing behavior, or exclusive `open` with `wx`) and readiness state scoped to the same session, repository, and exact head. Store this state outside the directory that `clean` deletes.
2. The first caller acquires the lock, verifies the head, runs `npm ci --ignore-scripts`, then `npm run build`. Suppressing install lifecycle scripts avoids a second implicit build from `prepare`.
3. Publish readiness only after both commands exit successfully and the expected CLI output exists. Other callers wait, then verify identity/readiness and reuse the result. They do **not** run another install, build, or clean.
4. Log every call: session/head, owner versus waiter/reuse, elapsed time, subprocess exit code, and final exit code. Fail nonzero on setup/build failure, timeout, or inconsistent output. Do not silently fall back to a different build.
5. After readiness, treat output as fixed for the rest of the session. If `dist/` disappears or a new head is requested, fail and abort/restart the session rather than rebuilding over active readers.

**Remaining AI.** Each prover must select the one fixed script call before using CLI output. That is ordinary tool invocation, not AGENT-authored installation/build sequencing. The script replaces those mechanical decisions with code. It does not itself force a prover to call it or prevent arbitrary Bash from bypassing it.

**Weak spots and preconditions:**

- **Skipped call:** a prover testing before readiness can still race the first build. “Every prover calls the script” is a prompt obligation until the HARNESS gates test execution. No script-only claim can erase this limitation.
- **Crash/stale lock:** a killed builder can leave partial output and a lock. Waiters must time out and fail loudly. Do not delete an apparently old lock automatically: a slow live builder could still be cleaning/writing. Recovery means aborting the affected session or an independently proven safe owner-death policy, not an unbounded wait or blind unlock.
- **Preexisting dist:** it need not be absent first. Directory existence alone is never proof of a successful build for this head/session. The first controlled call builds once before readiness; later calls trust the readiness contract, not a directory left by a cached checkout.
- **Reader coordination:** a lock alone prevents simultaneous builders, not a later build overlapping earlier readers. Build-once readiness and a no-rebuild-after-ready rule are essential. Direct `npm run build`, `clean`, or another `npm ci` can bypass the script and invalidate that protection.
- **Scope:** this option builds in the sandbox, not on the GitHub runner. It satisfies code-owned build mechanics and reuse, but changes the earlier runner-build-only scope. It also assumes Node/npm and the required package-network access are available.

**Cost and risk.** Lowest expected implementation/hosting cost among the paths that work with existing frozen heads and native tests: one uploaded script, one sandbox install/build, no new hosting. This is a relative estimate, not a benchmark or dollar quote. Remaining risk is contract bypass plus crash/lifecycle handling; provider token/runtime charges still apply when the AGENT invokes the tool.

**Evidence.** The [upload location contract](https://platform.claude.com/docs/en/managed-agents/files#file-paths) is sufficient for the script itself; it need not overlay the repository. [Node exclusive flags](https://nodejs.org/api/fs.html#file-system-flags) document `wx` failing if the lock already exists. `package.json:15-18` supplies the actual install/build-clean behavior. The [tool model](https://platform.claude.com/docs/en/managed-agents/tools#available-tools) lets an AGENT request Bash; the deterministic script, not the model, runs the mechanical sequence.

## SDK evidence

Inspected version: `@anthropic-ai/sdk@1.11.0`, available as a [versioned npm package](https://www.npmjs.com/package/@anthropic-ai/sdk/v/1.11.0). Paths below are **local-only installed SDK files**, not tracked repository sources:

| Installed file and lines | Contract checked | Finding |
| --- | --- | --- |
| `.github/bug-hunter/node_modules/@anthropic-ai/sdk/resources/beta/sessions/sessions.d.ts:276-308` | `BetaManagedAgentsFileResourceParams`, `BetaManagedAgentsGitHubRepositoryResourceParams` | Each accepts a string `mount_path`; comments give default uploads/repository paths. No overlay guarantee, root-override promise, or placement-order contract. |
| `.github/bug-hunter/node_modules/@anthropic-ai/sdk/resources/beta/sessions/sessions.d.ts:776-835` | `SessionCreateParams` | Includes `resources`, `initial_events`, `metadata`, and budget. No shell setup-command field. |
| `.github/bug-hunter/node_modules/@anthropic-ai/sdk/resources/beta/environments/environments.d.ts:177-192` | `BetaCloudConfigParams` | Only `type`, `networking`, and `packages`. No pre-start repository command. |

The corresponding public contracts are [creating sessions](https://platform.claude.com/docs/en/managed-agents/sessions#creating-a-session), [cloud configuration](https://platform.claude.com/docs/en/managed-agents/environments#configuration-options), and [file paths](https://platform.claude.com/docs/en/managed-agents/files#file-paths). A permissive TypeScript string is not proof that the server supports every destination. No undocumented destination or traversal workaround is recommended.

## Minimal placement probe — approval required, not run

**Question.** Does this platform version actually place an uploaded marker at a repository path, despite the published uploads-root description? This is a placement experiment only: no dependency installation, compilation, test suite, subagents, or Bug Hunter review.

**Setup.** Resolve the public PR #137 head once (`gh api repos/WesleyMFrederick/jact/pulls/137 --jq .head.sha`) and record that full SHA as `HEAD_SHA`. Do not use an unpushed local merge SHA. Upload one UTF-8 file containing `jact-build-placement-probe-v1` followed by a newline; record its returned ID as `FILE_ID`. Create a dedicated agent using `claude-haiku-4-5-20251001`, no MCP/skills/multiagent, and only Bash enabled:

```json
{
  "type": "agent_toolset_20260401",
  "default_config": { "enabled": false },
  "configs": [{ "name": "bash", "enabled": true }]
}
```

Use a compatible cloud environment with Git available. In the session-creation request, use these exact resource shapes, substituting only the recorded SHA and uploaded file ID:

```javascript
resources: [
  {
    type: "github_repository",
    url: "https://github.com/WesleyMFrederick/jact",
    mount_path: "/workspace/repo",
    checkout: { type: "commit", sha: HEAD_SHA }
  },
  {
    type: "file",
    file_id: FILE_ID,
    mount_path: "/workspace/repo/dist/build-placement-probe.txt"
  }
],
budget: { type: "limit", max_list_cost: { amount: "25", currency: "USD" } }
```

The system/user instruction is: **Run exactly the following read-only Bash command once. Report its raw output and exit code, then stop. Do not copy, create, move, link, install, build, repair, or retry anything.**

```bash
set -eu
git -C /workspace/repo rev-parse HEAD
for p in \
  /workspace/repo/dist/build-placement-probe.txt \
  /mnt/session/uploads/workspace/repo/dist/build-placement-probe.txt
do
  if test -f "$p"; then
    printf 'FOUND %s\n' "$p"
    ls -l "$p"
    cat "$p"
  else
    printf 'MISSING %s\n' "$p"
  fi
done
```

**Interpretation.** A marker with the exact content at the first path, before any copying, supports direct repository placement in that session. Only the second path supports the documented uploads-root reading. Missing/wrong SHA, resource rejection, missing markers, or an AGENT that modifies files makes the result negative or inconclusive; do not invent a fallback or retry. Even a positive result needs platform-contract confirmation before relying on an undocumented behavior. It does not prove a complete `dist/` tree, dependency resolution, or absence of build calls in a full review.

**Cost estimate, not measured:** roughly **$0.01–$0.05** for one short Haiku session. An illustrative 10,000 input tokens plus 500 output tokens costs $0.0125 at [Haiku 4.5 model rates](https://platform.claude.com/docs/en/about-claude/pricing#model-pricing); one minute adds about $0.0013 at [Managed Agents runtime rates](https://platform.claude.com/docs/en/about-claude/pricing#session-runtime). Hidden/tool prompts and actual duration can change the total. Request a 25-cent list-cost budget (`amount: "25"` is cents), impose a caller-side 60-second deadline, terminate after the result, and do not retry automatically. [Budget enforcement](https://platform.claude.com/docs/en/managed-agents/budgets#when-a-session-reaches-its-budget) allows the in-flight request to finish, so the final cost can exceed the nominal threshold slightly.

**Evidence to save if approved:** resource-create response or validation error, resolved head, marker/file ID, session/model/budget, actual tool-call command and output, exit code, and final measured cost. Keep IDs, session logs, and raw output in local-only evidence, not a public answer key. A text claim from the AGENT without its tool result is not a placement result.

## Verification boundary

This document records primary-doc/SDK research and proposed interfaces. None of (a)–(f) was implemented or exercised for this report, and the paid probe was not run. The current draft's unsafe build prompt has not been removed in isolation; no partial build fix is being presented as ready. The existing [Bug Hunter operating instructions](../../../../.github/bug-hunter/README.md#How%20it%20works) remain the implementation reference until an approved option is built and verified.

[^counts]: Local-only archived observation: `docs/features/20261120T192002-bug-hunter-build-once/evidence/sessions/2026-11-20T23-18-10-913Z_01a1fb40-cee1-749f-ab53-35a14301a186.03e1b80c47cf.jsonl:L740` records 476 tracked files and 96 built JavaScript files (command at L736). The same archive's L846 records 384 total build files: 96 JavaScript, 96 declaration files, and 192 maps. The archive is intentionally uncommitted and will not resolve from a clone. Reproduce the counts after building the chosen head with `git ls-files | wc -l`, `find dist -type f -name '*.js' | wc -l`, and `find dist -type f | wc -l`.
