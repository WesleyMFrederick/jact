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

%% *Last Modified: 05/04/26 11:47:37* %%

| Node | Activity | Tool / Command |
|------|----------|----------------|
| [a] | User provides absolute plan path | — |
| [b] | Render heading outline (file structure scan) | `/jact-displaying-headings` skill OR `jact ast <abs-path> \| jq -r '.headings[] \| "\(("  " * (.level - 1)))\("#" * .level) \(.text)"'` |
| [c] | Extract Goal section | `jact extract header <abs-path> "Goal"` |
| [d] | Extract Current Behavior section | `jact extract header <abs-path> "Current Behavior"` |
| [e] | Extract Target Behavior section | `jact extract header <abs-path> "Target Behavior"` |
| [f] | Extract Root Cause section | `jact extract header <abs-path> "Root Cause"` |
| [g] | Extract Files to Modify section | `jact extract header <abs-path> "Files to Modify"` |
| [h] | Extract State Log section | `jact extract header <abs-path> "State Log"` |
| [i] | Analyze State Log → identify next pending task | Mental analysis of completion markers + commit hashes |
| [j] | Extract Task X (Context Bootstrap) | `jact extract header <abs-path> "Task X - Name"` |
| [k] | Read graph report for codebase orientation | `Read graphify-out/GRAPH_REPORT.md` |
| [l] | LSP symbol location per Context Bootstrap | `LSP goToDefinition`, `LSP findReferences`, `LSP workspaceSymbol` |
| [m] | Targeted Read at LSP-identified lines | `Read <file> offset:<line> limit:<N>` |
| [n] | Read related test/fixture files | `Read <test-file>` |
| [o] | Create task to track work | `TaskCreate` |

## Why This Order

%% *Last Modified: 05/04/26 11:44:50* %%

### 1. `b` (outline) before `c–g` (sections)

%% *Last Modified: 05/04/26 11:48:01* %%

You must see the heading structure before you know which exact heading text to pass to `jact extract header`. The outline is the cheap scan; section extraction is the targeted pull.

### 2. `c–g` in parallel

%% *Last Modified: 05/04/26 11:48:01* %%

Goal, Current Behavior, Target Behavior, Root Cause, and Files to Modify are all independent of each other. Run all five header extracts in a single message with parallel tool calls.

### 3. `h` (State Log) sequential after `c–g`

%% *Last Modified: 05/04/26 11:48:01* %%

State Log is read separately because its purpose is different — it's not plan context, it's task-pickup state. Extract it alone so analysis (`i`) has a clean signal.

### 4. `i` (State Log analysis) before `j` (Task extraction)

%% *Last Modified: 05/04/26 11:48:01* %%

You cannot extract "Task X" until you know which X is next. The State Log tells you what's done (commit hashes) and what's pending. This is a **HARD GATE** — wrong task = wasted context loading.

### 5. `k` (graphify) before `l` (LSP)

%% *Last Modified: 05/04/26 11:48:01* %%

Graphify gives community structure and god nodes — orientation. LSP gives precise symbol locations. Read the map before navigating individual streets.

### 6. `l` (LSP) before `m` (Read)

%% *Last Modified: 05/04/26 11:48:01* %%

For TS/JS projects, **always use LSP first** for symbol lookups (per project CLAUDE.md). LSP returns `file:line` in <1s; raw Grep/Glob is 60–90s and noisier. Then `Read` with `offset`/`limit` for line-level inspection.

### 7. `n` (test files) optional

%% *Last Modified: 05/04/26 11:48:01* %%

Test context only needed when the task involves test changes (e.g., removing `.skip`, adding new tests). For pure refactor tasks, skip.

### 8. `o` (TaskCreate) at the end

%% *Last Modified: 05/04/26 11:48:01* %%

Once context is loaded and you know the task scope, create the task with full title and description. Earlier creation = stale or vague task.

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
