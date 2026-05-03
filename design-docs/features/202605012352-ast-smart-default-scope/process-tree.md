%% hardening: exempt-defer-language — pre-pipeline-lock baseline %%
---
title: AST Smart-Default-Scope — Process Tree (4-Layer Skeleton)
date: 2026-05-02
feature_id: 202605012352-ast-smart-default-scope
status: skeleton — awaiting USER fleshing per layer
layers: 4
---

# AST Smart-Default-Scope — Process Tree
%% *Last Modified: 05/02/26 00:52:35* %%

## User's initial request
~~~markdown
/tasks-convert-prompt

  /continuous-learning

    Ideal Outcome:
    1.Using the scope folder functionality works the same for jact <extract | ast>
      JTBD: USER/AGENT have a consistent experience when using arguments, regardless of sub-commands --> Creates a pleasing and logical UI

    Baseline:

    wesleyfrederick@mac jact % jact extract file plan.md
    Validation failed: File not found: /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/plan.md
    Suggestion: 'plan.md' matched 2 files in scope=/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact (source: cwd-git):
      /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/features/20260501-extract-smart-default-scope/plan.md
    Pass --scope to narrow. Tried: /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/plan.md


  wesleyfrederick@mac jact % jact ast plan.md
  node:fs:440
      return binding.readFileUtf8(path, stringToFlags(options.flag));
                     ^

  Error: ENOENT: no such file or directory, open 'plan.md'
      at Object.readFileSync (node:fs:440:20)
      at MarkdownParser.parseFile (file:///Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/dist/core/MarkdownParser/MarkdownParser.js:57:33)
      at JactCli.getAst (file:///Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/dist/jact.js:82:28)
      at Command.<anonymous> (file:///Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/dist/jact.js:946:31)
      at Command.listener [as _actionHandler] (/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/node_modules/commander/lib/command.js:568:17)
      at /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/node_modules/commander/lib/command.js:1604:14
      at Command._chainOrCall (/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/node_modules/commander/lib/command.js:1488:12)
      at Command._parseCommand (/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/node_modules/commander/lib/command.js:1603:27)
      at /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/node_modules/commander/lib/command.js:1367:27
      at Command._chainOrCall (/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/node_modules/commander/lib/command.js:1488:12) {
    errno: -2,
    code: 'ENOENT',
    syscall: 'open',
    path: 'plan.md'
  }

  Node.js v24.10.0


  ---

  [C]onstraints:
  1. Clarify goal using guidnace instruction at: https://docs.adenhq.com/building-agent/concepts/outcome-driven-development#1-start-with-a-goal
  2. Define success crtieria per guidance at: https://docs.adenhq.com/building-agent/concepts/outcome-driven-development#2-define-criteria
  3. Create succuess criteria using one of the metrics defined at: https://docs.adenhq.com/building-agent/concepts/goals-outcomes#success-criteria
  4. Define constraints per guidance
  5. Persist all design documents in /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/features/202605012352-ast-smart-default-scope
  6. Persist structured content in a yaml format
  7. Our final implement will use the workflow outlined at: https://docs.adenhq.com/building-agent/concepts/outcome-driven-development

  ---

  [H]ypothesis (for this agentic loop only. Do not confuse this agentic loop with the spec to update ast scope functionality
  8. AGENT can run in #AUTONMOUS-MODE to complete this loop of continous learning.
  9. AGENT can leverage the work we jsut completed for extract scope.
  10. AGENT can surface the correct Type I decisions to USER
  11. AGENT can use the loop slash command to correctly use the outcome driven development loop combined with continous learningn loop
  12. AGENT can THINK DEEPLY first and  present its four steps framework to USER derived from G. Poyla's "How To Solve It" 1945 book BEFORE attempting to EDIT/UPDATE/CREATE
    1. Understand the problem: clarify what you are trying to solve, what information you have, what constraints exist, and what a successful answer would look like. Pólya prompts questions like “What is the unknown?”, “What are the
  data?”, and “What is the condition?” to force clear problem definition before acting.
    2. Devise a plan: find a path from the facts you have to the result you want, often by relating the problem to something familiar or by reframing it. Pólya suggests strategies such as using a related problem, restating the problem,
  considering simpler or analogous cases, and checking whether you have used all the relevant information.
    3. Carry out the plan: execute carefully and verify each step as you go. Pólya emphasizes checking whether each step is clearly correct and whether you can justify it, not just pushing ahead mechanically (remember, carry out
  #AUTONMOUS-MODE)
    4. Look back: review the result, test whether it makes sense, and ask what the solution teaches you for future problems. Pólya explicitly asks whether you can check the result, derive it differently, see it more directly, or reuse
  the method on another problem.
~~~



## Layer model

%% *Last Modified: 05/02/26 00:52:35* %%

| Layer | Loop | Concern |
|---|---|---|
| 1 (outermost) | `/continuous-learning` | friction capture across sessions/features |
| 2 | `/loop` (ODD) | goal → criteria → constraints → build → iterate |
| 3 | feature build (Pólya 4-step) | one iteration: understand → devise → carry out → look back |
| 4 (innermost) | TDD red-green-refactor | actual code: read → test → implement |

Each outer layer wraps the next inner one. Code investigation lives **only** in Layer 4. Layer 3's "understand problem" is strategic, not source-level.

Slash-command status (this session): `/continuous-learning` and `/loop` are referenced by the user but not loaded in available skills. Activities annotated where invocation is required.

---

## Canonical inline

%% *Last Modified: 05/02/26 02:03:05* %%

```
↻(→(a1, a2, a3, a4, →(d, e, f, ↻(→(→(i, j, ↻(→(l, m, n, o, p, q, r), τ), k), g), h)), b, c), τ)
```

---

### Visual tree

%% *Last Modified: 05/02/26 02:11:00* %%

```
↻ layer-1: continuous-learning                                  ← OUTERMOST
├── → do-part
│   ├── [a1] parse prompt
│   ├── [a2] catalog prompt
│   ├── [a3] session Pólya-1 (pre-flight)
│   ├── [a4] load session context
│   ├── ↻ layer-2: ODD-loop (/loop)
│   │   ├── → do-part
│   │   │   ├── [d] define goal (ODD-1)
│   │   │   ├── [e] define success criteria (ODD-2)
│   │   │   ├── [f] define constraints (ODD-3)
│   │   │   └── ↻ build-iterate
│   │   │       ├── → do-part
│   │   │       │   ├── → layer-3: Pólya feature-build
│   │   │       │   │   ├── [i] understand problem (strategic, NOT code)
│   │   │       │   │   ├── [j] devise plan (YAML design artifacts)
│   │   │       │   │   ├── ↻ layer-4: TDD red-green-refactor
│   │   │       │   │   │   ├── → do-part
│   │   │       │   │   │   │   ├── [l] understand current code
│   │   │       │   │   │   │   ├── [m] write failing test (RED)
│   │   │       │   │   │   │   ├── [n] verify RED
│   │   │       │   │   │   │   ├── [o] implement minimum (GREEN)
│   │   │       │   │   │   │   ├── [p] verify GREEN
│   │   │       │   │   │   │   ├── [q] refactor
│   │   │       │   │   │   │   └── [r] verify still GREEN
│   │   │       │   │   │   └── [τ] redo-part: next test increment (silent)
│   │   │       │   │   └── [k] look back (per-feature reflection)
│   │   │       │   └── [g] verify against criteria              ← HARD GATE
│   │   │       └── [h] redo-part: refine + rebuild on criteria miss
│   ├── [b] capture learnings via /continuous-learning
│   └── [c] persist learning files
└── [τ] redo-part: next task / session (silent)
```

---

### Activity legend

%% *Last Modified: 05/02/26 02:11:49* %%

| Node | Layer | Activity                                                  | Skill / Tool                                      |
| ---- | ----- | --------------------------------------------------------- | ------------------------------------------------- |
| [a1] | 1     | parse prompt (extract slash-cmds, tags, code blocks, baselines, constraints, hypotheses) | input-token scan |
| [a2] | 1     | catalog prompt (index tokens → goal / constraint / hypothesis / baseline / cmd) | seed for artifacts table |
| [a3] | 1     | session Pólya-1 (pre-flight): known? unknown? data? asked-to-find? restate? diagram? enough-info? domain-vocab? | Pólya-1 question pass |
| [a4] | 1     | load session context (MEMORY.md, CLAUDE.md, transcript, prior PRs); refine [a3] answers | session-start hook |
| [b]  | 1     | capture learnings (frictions, anti-patterns, resolutions) | `/continuous-learning`                            |
| [c]  | 1     | persist learning files                                    | Write to learnings-files dir                      |
| [d]  | 2     | define goal                                               | `/loop` ODD-1 + adenhq.com guidance               |
| [e]  | 2     | define measurable success criteria                        | `/loop` ODD-2 + goals-outcomes metrics            |
| [f]  | 2     | define constraints                                        | `/loop` ODD-3                                     |
| [g]  | 2     | verify against criteria                                   | re-run baseline, regression suite                 |
| [h]  | 2     | redo: refine + rebuild on criteria miss                   | iteration trigger                                 |
| [i]  | 3     | understand problem (strategic)                            | Pólya-1: read user prompt, prior PRs, goal traces |
| [j]  | 3     | devise plan (design artifacts)                            | Pólya-2: Write YAML to design-docs/               |
| [k]  | 3     | look back (per-feature reflection)                        | Pólya-4: synthesize learnings                     |
| [l]  | 4     | understand current code                                   | LSP, Read, `git show`                             |
| [m]  | 4     | write failing test (RED)                                  | Vitest                                            |
| [n]  | 4     | verify RED                                                | `npm test`                                        |
| [o]  | 4     | implement minimum (GREEN)                                 | Edit                                              |
| [p]  | 4     | verify GREEN                                              | `npm test`                                        |
| [q]  | 4     | refactor                                                  | Edit                                              |
| [r]  | 4     | verify still GREEN                                        | `npm test`                                        |

#### [a1] parse prompt

%% *Last Modified: 05/02/26 02:12:40* %%

Read raw input. No interpret yet. Extract tokens:

- slash-cmds → `/tasks-convert-prompt`, `/continuous-learning`, `/loop`
- tags → `#AUTONOMOUS-MODE`, `#PATTERN-LEARNING`, `#INTERACTIVE-MODE`
- code blocks → CLI baselines, error stacks, file paths
- explicit sections → `[H]ypothesis`, `[C]onstraints`, `Ideal Outcome`, `Baseline`
- inline refs → paths, URLs, GH issues, prior PRs

Out: token list. No judgment. Feeds [a2].

#### [a2] catalog prompt

%% *Last Modified: 05/02/26 02:12:40* %%

Index [a1] tokens → bucket table:

| Bucket        | What lives here                                    |
| ------------- | -------------------------------------------------- |
| goal          | Ideal Outcome rows, JTBD statements                |
| constraint    | `[C]` rows, must/never clauses, persist-to paths   |
| hypothesis    | `[H]` rows, "AGENT can…" claims                    |
| baseline      | CLI output, error traces, current behavior         |
| slash-cmd     | invocation + args                                  |
| domain-vocab  | USER terms (jact, scope, ODD, Pólya, BID, …)       |

Out: cataloged prompt. Seeds artifacts table at [b] (CL skill).

#### [a3] session Pólya-1 (pre-flight)

%% *Last Modified: 05/02/26 02:12:40* %%

First pass from [a1]+[a2] alone. Refined after [a4] context loads. Pre-flight, not per-iteration ([i] = per-iteration at Layer 3).

| Q                          | Answer source                                          |
| -------------------------- | ------------------------------------------------------ |
| known?                     | [a2] catalog: goal + baseline + constraint buckets     |
| unknown?                   | gaps in [a2]: missing inputs, unspecified targets      |
| data?                      | [a1] code blocks + paths + quoted output               |
| asked-to-find?             | [a2] goal bucket → success criteria draft              |
| restate simple?            | one-sentence problem                                   |
| diagram?                   | mermaid / process tree / data shape                    |
| enough info?               | gaps → Type-1 q to USER. No assume.                    |
| domain-vocab clear?        | every term definable? no → ask USER                    |

Out: first-pass answers + open Type-1 q's. Surface gaps BEFORE [a4]. Loop = re-ask after [a4] enriches ctx.

#### [a4] load session context

%% *Last Modified: 05/02/26 02:12:40* %%

Read in order:

1. project `CLAUDE.md` (repo invariants)
2. global `~/.claude/CLAUDE.md` (USER critical instructions)
3. `MEMORY.md` if present
4. recent transcript / prior PRs cited in prompt
5. `design-docs/` referenced in prompt

Re-run [a3] q's with full ctx. Compare first-pass vs. refined → log deltas. Type-1 escalations still open → ask USER before [d].

Out: grounded session model. Hand off → [d] ODD-1.

---

## Deliberately NOT yet specified

%% *Last Modified: 05/02/26 00:52:35* %%

This is a skeleton. The following are open until USER fleshes them out per layer:

- **Layer 1** — what triggers session start; what learnings format to use; where files persist
- **Layer 2** — the actual goal/criteria/constraints content for THIS feature
- **Layer 3** — what "understand problem" produces as artifact; what "look back" outputs
- **Layer 4** — test fixtures, exact test names, refactor targets

## Halt

%% *Last Modified: 05/02/26 00:52:35* %%

Skeleton persisted. Awaiting USER direction on which layer to flesh out first.
