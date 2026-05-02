# Plan — `jact extract` smart default scope

%% *Last Modified: 05/01/26 17:13:37* %%

## 1. Critical Instructions

%% *Last Modified: 05/01/26 17:13:37* %%

> [!objective] CRITICAL WORKFLOW
> 1. Run !`/continous-learning` skill
> 2. Use !`/caveman` to save on tokens while writing plan
> 3. ON STARTUP, ALWAYS Ingest this document, run skills, return status in chat window, BECAUSE USER needs to know what we worked on last and what needs to happen next


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

%% *Last Modified: 05/01/26 17:26:04* %%

| Artifact | Path | Role |
|----------|------|------|
| Repro | (current session) | Primary evidence — fail w/o `--scope`, pass w/ abs `--scope` |
| CLI src | `src/jact.ts` | Target — defines `extract file` (1394–1437), `extract header` (1334–1392), `extract links` (1276–1332); `validate` minimal/verbose split (324–515) |
| `extractFile` | `src/jact.ts:738-813` | Target — `if (options.scope) buildCache(scope)`, no fallback |
| `extractHeader` | `src/jact.ts:645-701` | Target — same |
| `extractLinks` | `src/jact.ts:555-606` | Target — same |
| `validate` | `src/jact.ts:181-256` | Reference — minimal default + `--verbose` |
| `formatExtractResult` | `src/formatExtractResult.ts` | Reference — current formatter (md/json) |
| `FileCache` | `src/FileCache.ts` | Target — Row 5 ambiguous-match: `resolveFile()` 175-229, `duplicates` Set<string> 62/78-79, `addToCache` 153-160 silent overwrite |
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

%% *Last Modified: 05/01/26 17:19:29* %%
#LOCKED

%% *Last Modified: 05/01/26 17:27:20* %%

| # | Actor | Baseline [O] | Ideal [O] |
|---|-------|--------------|-----------|
| 1 | User invoking tool | User must declare search root every call resolving by name, even from inside project w/ identifiable root. | User from inside known project resolves by name w/o declaring root; declares only to override default. |
| 2 | Agent invoking tool for user | Agent rebuilds abs search root every call — re-runs discovery or reads global memory rule prescribing it. | Agent from inside known project resolves by name w/o rebuilding root; explicit declaration only for cross-project. |
| 3 | User receiving extract output | User gets full structured payload (content + link reports + stats) every call regardless of need. | User gets only content asked for by default; opts into payload when needed. |
| 4 | Agent maintaining tool rules | Agent carries persistent global rule prescribing workaround for missing default, applied in every project. | Agent reaches for rules only on genuine cross-project ambiguity; natural-root rule retires. |
| 5 | User resolving ambiguous name match | User experiences silent wrong-file resolution or opaque failure when a name matches multiple candidates within the inferred root. | User receives an actionable disambiguation prompt naming every candidate when a name matches multiple files within the inferred root, and the tool halts until the user picks one or narrows the call. |

---

**Self-checks:**
- Like-for-like: every cell = [O]. ✓
- Tool-strip: cells use "tool", "extract invocation", "search root", "structured payload" — abstract, no `--scope`/`jact`/flag names. ✓
- Immutability: Baselines = observed reality (repro + CLAUDE.md rule). ✓

## 6. Phase 4 — Source Mapping

%% *Last Modified: 05/01/26 17:39:15* %%
#LOCKED

%% *Last Modified: 05/01/26 17:39:15* %%

### Artifacts Update [h2.6]

%% *Last Modified: 05/01/26 17:27:20* %%

Added: `src/FileCache.ts` (Row 5 ambiguous-match logic). See §3 update.

### Source Map [h4]

%% *Last Modified: 05/01/26 17:31:39* %%

| #     | Baseline [O]                                            | Source ID | Source                                    | Baseline Notes                                                                                                                                |
| ----- | ------------------------------------------------------- | --------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | User declares search root every call                    | S1a       | `src/jact.ts:561`                         | `extractLinks`: `if (options.scope) buildCache(scope)` — undefined → skip cache → cwd-relative resolve fails.                                 |
| 1     | ""                                                      | S1b       | `src/jact.ts:652`                         | `extractHeader`: same no-fallback pattern.                                                                                                    |
| 1     | ""                                                      | S1c       | `src/jact.ts:744`                         | `extractFile`: same.                                                                                                                          |
| 1     | ""                                                      | S1d       | `src/jact.ts:1281`                        | Commander `--scope <folder>` no default — `extract links`.                                                                                    |
| 1     | ""                                                      | S1e       | `src/jact.ts:1339`                        | Commander `--scope <folder>` no default — `extract header`.                                                                                   |
| 1     | ""                                                      | S1f       | `src/jact.ts:1398`                        | Commander `--scope <folder>` no default — `extract file`.                                                                                     |
| ~~2~~ | ~~Agent rebuilds abs search root every call~~           | ~~S2a~~   | ~~`~/.claude/CLAUDE.md` JACT SCOPE RULE~~ | ~~Global rule mandates abs `--scope` per call — workaround codified, every project + agent inherits cog tax.~~                                |
| 2     | Agent rebuilds abs search root every call               | S2b       | `src/jact.ts:561,652,744`                 | Same no-fallback root cause as Row 1; agent compensates via S2a.                                                                              |
| 3     | User gets full structured payload every call            | S3a       | `src/jact.ts:1394-1437`                   | `extract file`: no `--verbose` opt; line 1426 `console.log(JSON.stringify(result, null, 2))` — always full dump.                              |
| 3     | ""                                                      | S3b       | `src/jact.ts:1334-1392`                   | `extract header`: `--format markdown\|json` (default md) but no minimal/verbose split — md still includes link reports + stats via formatter. |
| 3     | ""                                                      | S3c       | `src/jact.ts:181-256` (REF)               | `validate`: minimal default + `--verbose` opt-in (`options.verbose`) — pattern to mirror.                                                     |
| 3     | ""                                                      | S3d       | `src/formatExtractResult.ts`              | Md/json formatter — no minimal-vs-verbose layer.                                                                                              |
| 3     | ""                                                      | S3e       | `src/jact.ts:592`                         | `extractLinks`: `console.log(JSON.stringify(extractionResult, null, 2))` — always full.                                                       |
| 4     | Agent carries global rule prescribing workaround        | S4a       | `~/.claude/CLAUDE.md` JACT SCOPE RULE     | Codified workaround. Same source as S2a, different actor lens (rule maintenance, not invocation).                                             |
| 4     | ""                                                      | S4b       | `jact/CLAUDE.md`                          | Project doc shows abs `--scope` in every example invocation — replicates rule downstream.                                                     |
| 5     | User halted by actionable disambiguation on multi-match | S5a       | `src/FileCache.ts:175-229`                | `resolveFile()` returns generic msg ("Multiple files named X found in scope") on duplicate — no candidate paths listed.                       |
| 5     | ""                                                      | S5b       | `src/FileCache.ts:64, 79`                 | `duplicates: Set<string>` (decl L64, init L79) stores filenames only, not paths. Cannot enumerate candidates without re-scan.                 |
| 5     | ""                                                      | S5c       | `src/FileCache.ts:153-160`                | `addToCache()`: first path wins; subsequent duplicates discarded silently — original-vs-dup paths both unrecoverable from public API.         |
| 5     | ""                                                      | S5d       | `src/jact.ts:766-779`                     | `extractFile` pathConversion uses single recommended path — no halt-on-ambiguity flow.                                                        |

### Self-Checks [h2.5, h2.6]

%% *Last Modified: 05/01/26 17:32:04* %%

- Source IDs unique per row, format `S{row}{letter}` ✓
- All 5 BI rows covered ✓
- New artifact `src/FileCache.ts` added to §3 ✓
- Source IDs trace forward into Phase 5/6 (Delta architecture, DIFFs) ✓

### LSP Validation

%% *Last Modified: 05/01/26 17:32:04* %%

LSP `documentSymbol` run on `src/jact.ts` + `src/FileCache.ts` to verify symbol locations claimed in source map.

**Commands used:**

```
LSP operation=documentSymbol filePath=src/jact.ts line=1 character=1
LSP operation=documentSymbol filePath=src/FileCache.ts line=1 character=1
```

**Confirmed (LSP-reported line = source-map line):**

| Source ID | Symbol | Claim | LSP Reports | Status |
|---|---|---|---|---|
| S1a, S3e | `extractLinks` (Method) | L555-606 | L555 | ✓ |
| S1b | `extractHeader` (Method) | L645-701 | L645 | ✓ |
| S1c, S5d | `extractFile` (Method) | L738-813 | L738 | ✓ |
| S3c | `validate` (Method) | L181-256 | L181 | ✓ |
| S3a | `extract file` action() | L1394-1437 | callback L1415 | ✓ (within range) |
| S3b | `extract header` action() | L1334-1392 | callback L1360 | ✓ (within range) |
| S5a | `resolveFile` (Method) | L175-229 | L175 | ✓ |
| S5b | `cache`/`duplicates` props | L64, 79 | `cache` L63, `duplicates` L64; init L79 | ✓ (corrected from L62,78-79) |
| S5c | `addToCache` (Method) | L153-160 | L153 | ✓ |

**Not LSP-applicable (markdown / Commander option strings):**

- S1d/e/f Commander `--scope` option lines (1281, 1339, 1398) — verified via Read in `[h2]`, not LSP-addressable
- S2a, S4a `~/.claude/CLAUDE.md` — markdown
- S4b `jact/CLAUDE.md` — markdown

### Tech Debt Surfaced (during LSP validation)

%% *Last Modified: 05/01/26 17:32:04* %%

LSP diagnostics flagged spurious `await` on synchronous `FileCache.buildCache()` (returns `CacheStats`, not `Promise`). Pattern inconsistent with `validate` (L190 — no await, correct).

| File:Line | Code | Issue | Resolution |
|---|---|---|---|
| `src/jact.ts:653` | `await this.fileCache.buildCache(options.scope)` (extractHeader) | TS80007: `'await' has no effect` | Drop `await` during Phase 6 DIFFs |
| `src/jact.ts:745` | `await this.fileCache.buildCache(options.scope)` (extractFile) | TS80007: `'await' has no effect` | Drop `await` during Phase 6 DIFFs |

Both lines fall inside Delta scope (S1b, S1c) — fix in same DIFF that adds default-scope fallback.

