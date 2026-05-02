# Outcome-Driven Design Plan — `jact extract` Smart Default Scope

%% *Last Modified: 05/01/26 17:10:32* %%

## 1. Critical Instructions

%% *Last Modified: 05/01/26 17:10:32* %%

**Output routing:**
- All phase outputs (findings, BI table, source mapping, architecture, DIFFs) write to THIS plan file
- Chat window: hard gate prompts, numbered options, status only

[C]: Do not output plan content to chat window
[C]: Output chat window content ONLY to chat window, not to plan

### Type I/II Decision Guide

%% *Last Modified: 05/01/26 17:10:32* %%

| Type | Action | Examples |
|------|--------|----------|
| Type I (irreversible) | HARD GATE — USER decides | Locking sections, scope changes, framework selection |
| Type II (reversible) | AGENT executes autonomously | Research, file reads, analysis, building tables |

## 2. Context

%% *Last Modified: 05/01/26 17:10:32* %%

**What is being changed:** `jact` CLI default-scope behavior for `extract file`, `extract header`, and `extract links` commands; output verbosity defaults for `extract file`/`extract header` to match the minimal pattern established by `validate`.

**Why:** USER ran `jact extract file b1-cli-entry-options-decode-design.md` from inside a project repo. Command failed with "File not found" because no `--scope` was provided. USER had to repeat the command with an absolute `--scope` path. The same friction is documented in user-global CLAUDE.md as a JACT SCOPE RULE workaround ("ALWAYS use `--scope` with the repo root path") — workaround instead of fix.

**Session friction summary:** USER and AGENT both burn input tokens typing or remembering absolute paths to pass `--scope` on every invocation, despite the natural project root being inferable from the cwd or the target file's location. Secondary friction: `extract file` returns a verbose JSON dump even when the caller only needs the extracted content; `validate` already has a minimal-default / `--verbose`-opt-in pattern that the extract commands do not follow.

**Entry point:** Baseline problem (USER provided concrete repro + one explicit ideal + one secondary ideal).

## 3. Artifacts Table

%% *Last Modified: 05/01/26 17:10:32* %%

| Artifact | Path | Role |
|----------|------|------|
| Repro session | (current session) | Primary evidence of Baseline behavior — USER ran `jact extract file <name>` without `--scope`, observed failure, then with `--scope` observed success |
| `jact` CLI source | `src/jact.ts` | Target file — defines `extract file`, `extract header`, `extract links` action handlers (lines 1394–1437, 1334–1392, 1276–1332); defines `validate` minimal vs `--verbose` output split (lines 324–515) |
| `JactCli.extractFile` method | `src/jact.ts:738-813` | Target — currently calls `fileCache.buildCache(options.scope)` only if scope is passed; no fallback discovery |
| `JactCli.extractHeader` method | `src/jact.ts:645-701` | Target — same scope handling as extractFile |
| `JactCli.extractLinks` method | `src/jact.ts:555-606` | Target — same scope handling as extractFile |
| `JactCli.validate` method | `src/jact.ts:181-256` | Reference — established minimal-default + `--verbose` pattern that extract should mirror (Finding F2) |
| `formatExtractResult` | `src/formatExtractResult.ts` | Reference — current extract output formatter (markdown / json) |
| User CLAUDE.md JACT SCOPE RULE | `~/.claude/CLAUDE.md` (JACT TOOL RULES section) | Evidence — the workaround rule exists because the underlying friction is unresolved; rule reads "ALWAYS use `--scope` with the repo root path" |
| Project CLAUDE.md | `jact/CLAUDE.md` | Reference — current documented invocation patterns for jact commands |

## 4. Phase 1 — Findings

%% *Last Modified: 05/01/26 17:10:32* %%

| ID | Pattern Found | Scope | Trigger | Friction Caused |
|----|--------------|-------|---------|-----------------|
| F1 | A user runs `jact extract file <filename>` from inside a project repo without `--scope`. Command fails with "File not found" even though the file exists in the project. | `extract file`, `extract header`, `extract links` | Invocation from inside a project where the cwd or target-file location is sufficient to identify the search root | User must re-run the command with a full absolute `--scope` path. Tokens spent on path memorization or re-discovery. Documented globally in CLAUDE.md as a permanent workaround rule. |
| F2 | `jact extract file` always returns a verbose JSON dump (`{extractedContentBlocks, outgoingLinksReport, stats}`). `jact validate` already implemented minimal-default / `--verbose`-opt-in. Extract commands did not follow suit. | `extract file`, `extract header` (default `--format json` path) | Caller wants the extracted content only; gets metadata, source-link reports, and stats by default | Wasted context tokens on metadata the caller did not request. Inconsistent CLI ergonomics across commands of the same tool. |
| F3 | The same friction is captured in user-global CLAUDE.md as a permanent rule rather than a CLI fix. | Cross-project | Every new project + every new agent that uses `jact` | Permanent cognitive tax on every invocation. Workaround rule replicates across projects instead of being eliminated at the source. |

### Hardcoded References Audit

%% *Last Modified: 05/01/26 17:10:32* %%

| Line(s) | What's hardcoded | Issue |
|---------|-----------------|-------|
| `src/jact.ts:561, 652, 744` | `if (options.scope) { fileCache.buildCache(options.scope) }` | No fallback when `options.scope` is undefined — silently skips cache build, then validation fails on cwd-relative lookup |
| `src/jact.ts:1281, 1339, 1398` | `--scope <folder>` Commander options have no default value | Every invocation requires explicit pass; no inferred default |

## 5. Phase 2 — BI Table

%% *Last Modified: 05/01/26 17:10:32* %%

<!-- AWAITING USER LOCK at HARD GATE [e2] -->

| # | Actor | Baseline [O] | Ideal [O] |
|---|-------|-------------|-----------|
| 1 | User invoking the tool | A user must declare the search root explicitly on every invocation that resolves files by name, even when running from inside a project whose root is naturally identifiable. | A user invoking the tool from inside a known project resolves files by name without declaring the search root, and only declares one when overriding the default. |
| 2 | Agent invoking the tool on behalf of a user | An agent must reconstruct an absolute search root for every invocation, often by re-running prior discovery commands or by reading global memory rules instructing it to do so. | An agent invoking the tool from inside a known project resolves files by name without rebuilding the absolute search root, reserving explicit declaration for cross-project resolution. |
| 3 | User receiving extract output | A user receives the full structured payload from an extract invocation — content, link reports, statistics — regardless of whether the user requested anything beyond the content itself. | A user receives only the content they asked for from an extract invocation by default, and opts into the structured payload only when they need it. |
| 4 | Agent maintaining tool-usage rules across projects | An agent carries a persistent global rule that prescribes a workaround for the missing default behavior, applied identically in every project that uses the tool. | An agent reaches for tool-usage rules only for genuine cross-project ambiguity; the rule for the natural-root case becomes unnecessary and can be retired. |

---

**Self-checks:**
- Like-for-like: every Baseline [O] and Ideal [O] is an outcome statement. ✓
- Tool-strip: cells reference "the tool", "extract invocation", "search root", "structured payload", "natural-root case" — abstract enough that the outcome holds even if the CLI surface is restructured (e.g., flag rename, command merge). No explicit `--scope`, `jact`, file paths, or flag names appear in the [O] cells. ✓
- Immutability: Baselines reflect observed reality from the repro session and the existing CLAUDE.md workaround rule. ✓
