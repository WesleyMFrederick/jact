# Workflow: Plan Ingestion → Task Pickup (Pre-Implementation)

%% *Last Modified: 05/04/26 11:44:50* %%

## Purpose

%% *Last Modified: 05/04/26 11:44:50* %%

Cold-start workflow for ingesting a plan via `jact`, reading the State Log to identify the next pending task, and bootstrapping codebase context — everything leading up to implementation.

## Canonical Inline

%% *Last Modified: 05/04/26 11:47:07* %%

```
→(a, b, ∧(c, d, e, f, g), h, i, j, k, l, m, ×(n, τ), o)
```

## Visual Tree

%% *Last Modified: 05/04/26 11:47:17* %%

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
├── [i] analyze State Log → identify next pending task     ← HARD GATE
├── [j] jact extract header "Task X" (Context Bootstrap)
├── [k] read graphify-out/GRAPH_REPORT.md                  ← codebase orientation
├── [l] run LSP commands per Context Bootstrap
├── [m] targeted Read at LSP-identified lines
├── × optional-test-context
│   ├── [n] Read related test/fixture files
│   └── [τ] (skip)
└── [o] TaskCreate to track work
```

## Activity Legend

%% *Last Modified: 05/04/26 11:49:14* %%

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
| [i] | Analyze State Log → identify next pending task | Mental analysis of completion markers + commit hashes | **HARD GATE** — wrong task = wasted context loading |
| [j] | Extract Task X (Context Bootstrap) | `jact extract header <abs-path> "Task X - Name"` | depends on [i] to know which task |
| [k] | Read graph report for codebase orientation | `Read graphify-out/GRAPH_REPORT.md` | orientation before navigation; god nodes reveal key files |
| [l] | LSP symbol location per Context Bootstrap | `LSP goToDefinition`, `LSP findReferences`, `LSP workspaceSymbol` | <1s vs 60–90s for Grep; always LSP first on TS/JS |
| [m] | Targeted Read at LSP-identified lines | `Read <file> offset:<line> limit:<N>` | depends on [l] for file:line; avoids reading full files |
| [n] | Read related test/fixture files | `Read <test-file>` | optional: only when task touches tests |
| [o] | Create task to track work | `TaskCreate` | after context loaded so title + description are accurate |

## Anti-Patterns

%% *Last Modified: 05/04/26 11:48:01* %%

| Anti-Pattern | Why It Fails | Correct Move |
|--------------|--------------|--------------|
| Skip `b` (outline), guess heading names | `jact extract header` fails on wrong heading text | Always render outline first |
| Run `c–g` sequentially | 5× slower, no benefit | Parallel tool calls in one message |
| Include State Log in the `c–g` parallel block | Mixes plan context with task-state signal | Extract State Log separately as `h` |
| Read full source files instead of using LSP+offset | Bloats context, slow on large files | LSP locate → Read offset+limit |
| Skip `k` (graphify) | Search raw files = high token cost | Read GRAPH_REPORT.md for god nodes first |
| Implement before TaskCreate | No tracking, easy to lose state | Create task BEFORE first edit |
| Ask user "which section first?" after outline | Type II question — answer is in the workflow | Just run c–g in parallel |

## Composition Rule Applied

%% *Last Modified: 05/04/26 11:48:01* %%

The HARD GATE at `[i]` enforces **actions before choices**: you must extract State Log (`h`) AND analyze it (`i`) before you can extract the right Task (`j`). The choice of which Task to load is determined by the State Log content — not assumed up front.
