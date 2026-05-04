# Workflow: Plan Ingestion → Task Pickup (Pre-Implementation)

%% *Last Modified: 05/04/26 11:44:50* %%

## Purpose

%% *Last Modified: 05/04/26 11:44:50* %%

Cold-start workflow for ingesting a plan via `jact`, reading the State Log to identify the next pending task, and bootstrapping codebase context — everything leading up to implementation.

## Canonical Inline

%% *Last Modified: 05/04/26 11:44:50* %%

```
→(a, b, ∧(c, d, e), f, g, h, i, j, ×(k, τ), l)
```

## Visual Tree

%% *Last Modified: 05/04/26 11:44:50* %%

```
→ plan-ingestion-to-task-pickup
├── [a] user provides absolute plan path
├── [b] render heading outline via `jact ast | jq`
├── ∧ extract-plan-context
│   ├── [c] jact extract header "Goal"
│   ├── [d] jact extract header "Files to Modify"
│   └── [e] jact extract header "State Log"
├── [f] analyze State Log → identify next pending task     ← HARD GATE
├── [g] jact extract header "Task X" (Context Bootstrap)
├── [h] read graphify-out/GRAPH_REPORT.md                  ← codebase orientation
├── [i] run LSP commands per Context Bootstrap
├── [j] targeted Read at LSP-identified lines
├── × optional-test-context
│   ├── [k] Read related test/fixture files
│   └── [τ] (skip)
└── [l] TaskCreate to track work
```

## Activity Legend

%% *Last Modified: 05/04/26 11:44:50* %%

| Node | Activity | Tool / Command |
|------|----------|----------------|
| [a] | User provides absolute plan path | — |
| [b] | Render heading outline (file structure scan) | `/jact-displaying-headings` skill OR `jact ast <abs-path> \| jq -r '.headings[] \| "\(("  " * (.level - 1)))\("#" * .level) \(.text)"'` |
| [c] | Extract Goal section | `jact extract header <abs-path> "Goal"` |
| [d] | Extract Files to Modify section | `jact extract header <abs-path> "Files to Modify"` |
| [e] | Extract State Log section | `jact extract header <abs-path> "State Log"` |
| [f] | Analyze State Log → identify next pending task | Mental analysis of completion markers + commit hashes |
| [g] | Extract Task X (Context Bootstrap) | `jact extract header <abs-path> "Task X - Name"` |
| [h] | Read graph report for codebase orientation | `Read graphify-out/GRAPH_REPORT.md` |
| [i] | LSP symbol location per Context Bootstrap | `LSP goToDefinition`, `LSP findReferences`, `LSP workspaceSymbol` |
| [j] | Targeted Read at LSP-identified lines | `Read <file> offset:<line> limit:<N>` |
| [k] | Read related test/fixture files | `Read <test-file>` |
| [l] | Create task to track work | `TaskCreate` |

## Why This Order

%% *Last Modified: 05/04/26 11:44:50* %%

### 1. `b` (outline) before `c/d/e` (sections)

%% *Last Modified: 05/04/26 11:44:50* %%

You must see the heading structure before you know which exact heading text to pass to `jact extract header`. The outline is the cheap scan; section extraction is the targeted pull.

### 2. `c/d/e` in parallel

%% *Last Modified: 05/04/26 11:44:50* %%

Goal, Files to Modify, and State Log are independent sections — no dependency between them. Run all three header extracts in a single message with parallel tool calls.

### 3. `f` (State Log analysis) before `g` (Task extraction)

%% *Last Modified: 05/04/26 11:44:50* %%

You cannot extract "Task X" until you know which X is next. The State Log tells you what's done (commit hashes) and what's pending. This is a **HARD GATE** — wrong task = wasted context loading.

### 4. `h` (graphify) before `i` (LSP)

%% *Last Modified: 05/04/26 11:44:50* %%

Graphify gives community structure and god nodes — orientation. LSP gives precise symbol locations. Read the map before navigating individual streets.

### 5. `i` (LSP) before `j` (Read)

%% *Last Modified: 05/04/26 11:44:50* %%

For TS/JS projects, **always use LSP first** for symbol lookups (per project CLAUDE.md). LSP returns `file:line` in <1s; raw Grep/Glob is 60–90s and noisier. Then `Read` with `offset`/`limit` for line-level inspection.

### 6. `k` (test files) optional

%% *Last Modified: 05/04/26 11:44:50* %%

Test context only needed when the task involves test changes (e.g., removing `.skip`, adding new tests). For pure refactor tasks, skip.

### 7. `l` (TaskCreate) at the end

%% *Last Modified: 05/04/26 11:44:50* %%

Once context is loaded and you know the task scope, create the task with full title and description. Earlier creation = stale or vague task.

## Anti-Patterns

%% *Last Modified: 05/04/26 11:44:50* %%

| Anti-Pattern | Why It Fails | Correct Move |
|--------------|--------------|--------------|
| Skip `b` (outline), guess heading names | `jact extract header` fails on wrong heading text | Always render outline first |
| Run `c/d/e` sequentially | 3× slower, no benefit | Parallel tool calls in one message |
| Read full source files instead of using LSP+offset | Bloats context, slow on large files | LSP locate → Read offset+limit |
| Skip `h` (graphify) | Search raw files = high token cost | Read GRAPH_REPORT.md for god nodes first |
| Implement before TaskCreate | No tracking, easy to lose state | Create task BEFORE first edit |
| Ask user "which section first?" after outline | Type II question — answer is in the workflow | Just run c/d/e in parallel |

## Composition Rule Applied

%% *Last Modified: 05/04/26 11:44:50* %%

The HARD GATE at `[f]` enforces **actions before choices**: you must read State Log (`e`) AND analyze it (`f`) before you can extract the right Task (`g`). The choice of which Task to load is determined by the State Log content — not assumed up front.
