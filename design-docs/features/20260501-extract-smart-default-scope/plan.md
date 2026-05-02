# Plan — `jact extract` smart default scope

%% *Last Modified: 05/01/26 17:13:37* %%

## 1. Critical Instructions

%% *Last Modified: 05/01/26 17:13:37* %%

**Routing:**
- Phase output → this file
- Chat → gates + status only

[C]: No plan content in chat
[C]: No chat content in plan

### Type I/II

%% *Last Modified: 05/01/26 17:13:37* %%

| Type | Action | Examples |
|------|--------|----------|
| I (irrev) | HARD GATE → USER | Lock, scope chg, framework |
| II (rev) | AGENT auto | Read, grep, tables |

## 2. Context

%% *Last Modified: 05/01/26 17:13:37* %%

**Change:** `jact` default-scope for `extract file/header/links` + minimal output default for `extract file/header` (match `validate`).

**Why:** USER ran `jact extract file b1-cli-entry-options-decode-design.md` from repo cwd → "File not found". Re-ran w/ abs `--scope` → worked. Same friction codified in user CLAUDE.md as JACT SCOPE RULE workaround → not fix.

**Friction:** USER + AGENT burn tokens on abs paths every call. Natural root inferable from cwd or target file. Also: `extract file` dumps verbose JSON; `validate` already has minimal-default + `--verbose`.

**Entry:** Baseline problem (concrete repro + explicit ideals).

## 3. Artifacts

%% *Last Modified: 05/01/26 17:13:37* %%

| Artifact | Path | Role |
|----------|------|------|
| Repro | (current session) | Primary evidence — fail w/o `--scope`, pass w/ abs `--scope` |
| CLI src | `src/jact.ts` | Target — defines `extract file` (1394–1437), `extract header` (1334–1392), `extract links` (1276–1332); `validate` minimal/verbose split (324–515) |
| `extractFile` | `src/jact.ts:738-813` | Target — `if (options.scope) buildCache(scope)`, no fallback |
| `extractHeader` | `src/jact.ts:645-701` | Target — same |
| `extractLinks` | `src/jact.ts:555-606` | Target — same |
| `validate` | `src/jact.ts:181-256` | Reference — minimal default + `--verbose` |
| `formatExtractResult` | `src/formatExtractResult.ts` | Reference — current formatter (md/json) |
| User CLAUDE.md | `~/.claude/CLAUDE.md` (JACT TOOL RULES) | Evidence — workaround rule = unfixed friction |
| Project CLAUDE.md | `jact/CLAUDE.md` | Reference — current invocation patterns |

## 4. Phase 1 — Findings

%% *Last Modified: 05/01/26 17:13:37* %%

| ID | Pattern | Scope | Trigger | Friction |
|----|---------|-------|---------|----------|
| F1 | `jact extract file <name>` from repo cwd w/o `--scope` → "File not found" tho file in repo | extract file/header/links | Call from inside project where cwd or target loc → root | Re-run w/ abs `--scope`. Token burn. Codified globally as workaround. |
| F2 | `extract file` always dumps full JSON (`extractedContentBlocks` + `outgoingLinksReport` + `stats`). `validate` has minimal default + `--verbose`. Extract didn't follow. | extract file/header (json default) | Caller wants content only, gets metadata + link report + stats | Wasted ctx tokens. Inconsistent CLI ergonomics same tool. |
| F3 | Friction → permanent rule in user CLAUDE.md, not CLI fix | Cross-project | Every project + agent using `jact` | Permanent cog tax. Rule replicates → not eliminated at source. |

### Hardcoded refs

%% *Last Modified: 05/01/26 17:13:37* %%

| Line(s) | What | Issue |
|---------|------|-------|
| `src/jact.ts:561, 652, 744` | `if (options.scope) fileCache.buildCache(options.scope)` | No fallback — undefined → skip cache → cwd-relative fail |
| `src/jact.ts:1281, 1339, 1398` | Commander `--scope <folder>` no default | Every call needs explicit pass |

## 5. Phase 2 — BI

%% *Last Modified: 05/01/26 17:13:37* %%

<!-- AWAITING USER LOCK at HARD GATE [e2] -->

| # | Actor | Baseline [O] | Ideal [O] |
|---|-------|--------------|-----------|
| 1 | User invoking tool | User must declare search root every call resolving by name, even from inside project w/ identifiable root. | User from inside known project resolves by name w/o declaring root; declares only to override default. |
| 2 | Agent invoking tool for user | Agent rebuilds abs search root every call — re-runs discovery or reads global memory rule prescribing it. | Agent from inside known project resolves by name w/o rebuilding root; explicit declaration only for cross-project. |
| 3 | User receiving extract output | User gets full structured payload (content + link reports + stats) every call regardless of need. | User gets only content asked for by default; opts into payload when needed. |
| 4 | Agent maintaining tool rules | Agent carries persistent global rule prescribing workaround for missing default, applied in every project. | Agent reaches for rules only on genuine cross-project ambiguity; natural-root rule retires. |

---

**Self-checks:**
- Like-for-like: every cell = [O]. ✓
- Tool-strip: cells use "tool", "extract invocation", "search root", "structured payload" — abstract, no `--scope`/`jact`/flag names. ✓
- Immutability: Baselines = observed reality (repro + CLAUDE.md rule). ✓
