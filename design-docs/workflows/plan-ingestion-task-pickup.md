# Workflow: Plan Ingestion → Task Pickup → Implementation

%% *Last Modified: 05/04/26 11:53:47* %%

## Purpose

%% *Last Modified: 05/04/26 11:53:54* %%

Cold-start workflow for ingesting a plan via `jact`, reading the State Log to identify the next pending task, bootstrapping codebase context, implementing, and closing the loop with a State Log update.

## Canonical Inline

%% *Last Modified: 05/04/26 11:54:09* %%

```
→(a, b, ∧(c, d, e, f, g), h, ×(i, τ), j, k, l, m, n, ×(o, τ), p, ↻(q, τ), r)
```

## Visual Tree

%% *Last Modified: 05/04/26 11:54:09* %%

```
→ plan-ingestion-to-task-pickup
├── [a] user provides absolute plan path
├── [b] render heading outline via `jact ast | jq`
├── ∧ extract-plan-context
│   ├── [c] jact extract header "Goal"
│   ├── [d] jact extract header "Current Behavior"
│   ├── [e] jact extract header "Target Behavior"
│   ├── [f] jact extract header "Root Cause"
│   └── [g] jact extract header "Files to Modify"
├── [h] jact extract header "State Log"
├── × prior-session-context
│   ├── [i] git show <hash from State Log>
│   └── [τ] (skip — no prior commit)
├── [j] analyze State Log → identify next pending task     ← HARD GATE
├── [k] jact extract header "Task X" (Context Bootstrap)
├── [l] read graphify-out/GRAPH_REPORT.md                  ← codebase orientation
├── [m] run LSP commands per Context Bootstrap
├── [n] targeted Read at LSP-identified lines
├── × optional-test-context
│   ├── [o] Read related test/fixture files
│   └── [τ] (skip)
├── [p] TaskCreate to track work
├── ↻ implement-task
│   ├── [q] implement task step                            ← do part
│   └── [τ] (redo — iterate until done)
└── [r] update ## State Log in plan file
```

## Activity Legend

%% *Last Modified: 05/04/26 11:54:25* %%

| Node | Activity | Tool / Command | Why |
|------|----------|----------------|-----|
| [a] | User provides absolute plan path | — | jact requires absolute paths |
| [b] | Render heading outline | `/jact-displaying-headings` skill OR `jact ast <abs-path> \| jq -r '.headings[] \| "\(("  " * (.level - 1)))\("#" * .level) \(.text)"'` | Must know exact heading text before calling extract |
| [c] | Extract Goal section | `jact extract header <abs-path> "Goal"` | parallel: independent of d–g |
| [d] | Extract Current Behavior section | `jact extract header <abs-path> "Current Behavior"` | parallel: independent of c, e–g |
| [e] | Extract Target Behavior section | `jact extract header <abs-path> "Target Behavior"` | parallel: independent of c–d, f–g |
| [f] | Extract Root Cause section | `jact extract header <abs-path> "Root Cause"` | parallel: independent of c–e, g |
| [g] | Extract Files to Modify section | `jact extract header <abs-path> "Files to Modify"` | parallel: independent of c–f |
| [h] | Extract State Log section | `jact extract header <abs-path> "State Log"` | sequential: task-pickup state, not plan context |
| [i] | Read last commit from prior session | `git show <hash>` (hash from State Log) | optional: only if State Log contains a commit hash; surfaces what changed without re-reading full context |
| [j] | Analyze State Log → identify next pending task | Mental analysis of completion markers + commit hashes | **HARD GATE** — wrong task = wasted context loading |
| [k] | Extract Task X (Context Bootstrap) | `jact extract header <abs-path> "Task X - Name"` | depends on [j] to know which task |
| [l] | Read graph report for codebase orientation | `Read graphify-out/GRAPH_REPORT.md` | orientation before navigation; god nodes reveal key files |
| [m] | LSP symbol location per Context Bootstrap | `LSP goToDefinition`, `LSP findReferences`, `LSP workspaceSymbol` | <1s vs 60–90s for Grep; always LSP first on TS/JS |
| [n] | Targeted Read at LSP-identified lines | `Read <file> offset:<line> limit:<N>` | depends on [m] for file:line; avoids reading full files |
| [o] | Read related test/fixture files | `Read <test-file>` | optional: only when task touches tests |
| [p] | Create task to track work | `TaskCreate` | after context loaded so title + description are accurate |
| [q] | Implement task step | Edit/Write/Bash as needed | do-part of ↻ loop; repeats until task complete |
| [r] | Update `## State Log` in plan file | `Edit` plan file | Write: commit hash + semantic intent (what decision was made and why). Skip: file lists, diffs, line numbers — git has those |

## Anti-Patterns

%% *Last Modified: 05/04/26 11:54:36* %%

| Anti-Pattern | Why It Fails | Correct Move |
|--------------|--------------|--------------|
| Skip `b` (outline), guess heading names | `jact extract header` fails on wrong heading text | Always render outline first |
| Run `c–g` sequentially | 5× slower, no benefit | Parallel tool calls in one message |
| Include State Log in the `c–g` parallel block | Mixes plan context with task-state signal | Extract State Log separately as `h` |
| Read full source files instead of using LSP+offset | Bloats context, slow on large files | LSP locate → Read offset+limit |
| Skip `l` (graphify) | Search raw files = high token cost | Read GRAPH_REPORT.md for god nodes first |
| Implement before TaskCreate `[p]` | No tracking, easy to lose state | Create task BEFORE first edit |
| Ask user "which section first?" after outline | Type II question — answer is in the workflow | Just run c–g in parallel |
| Write file lists or diffs in State Log `[r]` | Duplicates what `git show <hash>` already surfaces | Write commit hash + semantic intent only |

## Composition Rule Applied

%% *Last Modified: 05/04/26 11:54:36* %%

The HARD GATE at `[j]` enforces **actions before choices**: you must extract State Log (`h`), optionally read the prior commit (`i`), then analyze (`j`) before you can extract the right Task (`k`). The choice of which Task to load is determined by the State Log content — not assumed up front.
