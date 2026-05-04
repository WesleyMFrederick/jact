# Plan Cold-Start Workflow

%% *Last Modified: 05/04/26 11:41:49* %%

Formal process tree for bootstrapping context and picking up work from a plan file.

## Canonical Process Tree

%% *Last Modified: 05/04/26 11:41:49* %%

```
→(a, b, ∧(c, d, e), f, ×(g, h), i)
```

## Visual Tree

%% *Last Modified: 05/04/26 11:41:49* %%

```
→ plan-cold-start
├── [a] load plan file                                    ← source of truth
├── [b] display plan structure via jact                   ← orient user
└── ∧ extract sections (in parallel)
    ├── [c] extract Goal section
    ├── [d] extract Files to Modify section
    └── [e] extract State Log section
├── [f] run context bootstrap                             ← HARD GATE
├── × task-continuation
│   ├── [g] IF State Log has completed tasks: pick up next pending task
│   └── [h] IF State Log is empty: identify task from Goal + Files to Modify
└── [i] implement task
```

## Activity Legend

%% *Last Modified: 05/04/26 11:41:49* %%

| Node | Activity | Purpose |
|------|----------|---------|
| [a] | `Read("/path/to/plan.md")` | Load plan file into context |
| [b] | `/jact-displaying-headings <path>` + `jact extract header <path> "<section>"` | Show outline, offer targeted extraction |
| [c] | `jact extract header <path> "Goal"` | Understand objective |
| [d] | `jact extract header <path> "Files to Modify"` | Scope of changes |
| [e] | `jact extract header <path> "State Log"` | Previous session progress |
| [f] | Run: graphify check, LSP command bootstrap, load architecture docs | Build mental model of codebase |
| [g] | `TaskList` → find pending/unblocked task from State Log entries | Resume interrupted work |
| [h] | Parse Goal + Files to Modify, create initial task | Start fresh work |
| [i] | Follow task implementation steps (e.g., debug, fix, test, commit) | Execute the work |

## Semantic Notes

%% *Last Modified: 05/04/26 11:41:49* %%

### Parallel Extraction (∧)

%% *Last Modified: 05/04/26 11:41:49* %%

Sections [c], [d], [e] can extract in any order — they are independent `jact extract header` calls. Parallelizing reduces context bootstrap latency.

### Task Continuation (×)

%% *Last Modified: 05/04/26 11:41:49* %%

The choice [g/h] depends on State Log **content**, not structure:
- **[g] path:** State Log has entries with commit hashes or "COMPLETED" markers → previous work exists
- **[h] path:** State Log is empty or only contains rules → starting fresh

### HARD GATE at [f]

%% *Last Modified: 05/04/26 11:41:49* %%

Context bootstrap is mandatory before implementation. Architecture understanding (graphify, LSP, design docs) prevents debugging in isolation.

### Implementation [i]

%% *Last Modified: 05/04/26 11:41:49* %%

Not expanded here — each task has its own sub-tree (e.g., debug-pattern-matching-task would have its own process tree). [i] is a **call site** to the task's process tree.

## Traces

%% *Last Modified: 05/04/26 11:41:49* %%

### Trace 1: Resume Work (Cold Start with State Log)

%% *Last Modified: 05/04/26 11:41:49* %%

```
Load plan.md 
→ Display outline 
→ Extract Goal (parallel) + Extract Files (parallel) + Extract State Log (parallel)
→ Bootstrap context (graphify, LSP, architecture docs)
→ State Log has entries: pick up Task #1 (negate-patterns)
→ Implement: debug, fix, test, commit
```

### Trace 2: Fresh Work (State Log Empty)

%% *Last Modified: 05/04/26 11:41:49* %%

```
Load plan.md 
→ Display outline 
→ Extract Goal + Extract Files + Extract State Log (parallel)
→ Bootstrap context
→ State Log empty: identify Task #1 from Goal + Files
→ Implement: debug, fix, test, commit
```

## Implementation Notes

%% *Last Modified: 05/04/26 11:41:49* %%

### Per CLAUDE.md Rules

%% *Last Modified: 05/04/26 11:41:49* %%

- **ALWAYS** run `/jact-displaying-headings` on plan file BEFORE extraction (orients user to structure)
- **ALWAYS** use `jact extract header` for sections (cheaper than re-reading full file)
- **ALWAYS** update State Log with commit hashes after each session (enables cold starts)
- **NEVER** ask user "which section" — extract all three sections (they are independent)
- **ALWAYS** run context bootstrap before implementation (prevents tunnel vision)

### Checklist Before [i] (Implement)

%% *Last Modified: 05/04/26 11:41:49* %%

- [ ] Goal understood (section [c] read)
- [ ] Files to Modify scoped (section [d] read)
- [ ] State Log checked (section [e] read)
- [ ] Architecture context loaded (graphify, LSP bootstrap, design docs)
- [ ] Next task identified (via [g] or [h])
- [ ] Task tools initialized (TaskCreate or TaskList for continuation)

---

%% *Last Modified: 2026-05-04* %%
