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

## 6.5. Phase 5 — [i0] Architecture Eval (Baseline)

%% *Last Modified: 05/01/26 17:42:42* %%

### Citation Context

%% *Last Modified: 05/01/26 17:42:42* %%

`jact extract links` on plan: 0 wiki-links extracted (plan uses inline source refs `src/jact.ts:NNN`). Useful data — no external context dependencies.

### Principle Compliance

%% *Last Modified: 05/01/26 17:42:42* %%

| Category | Status | Details |
|---|---|---|
| Modular Design | ❌ Violates | S1a/b/c shows 3× duplicated `if (options.scope) buildCache(scope)` across `extractLinks/Header/File`. **Avoid Duplication** violation. Delta must centralize fallback logic, not propagate it. |
| Data-First Design | ❌ Violates | S5b: `duplicates: Set<string>` makes "list candidates" unrepresentable (**Illegal States Unrepresentable** violation). Refactor representation first — likely `Map<string, string[]>` (filename → all paths). |
| Action-Based File Org | ➖ Not mentioned | New util file (e.g., `resolveDefaultScope.ts`) likely needed for centralized inference. Not specified in plan. |
| Format/Interface Design | ✅ Compliant | **Progressive Defaults** strongly applied: Row 1/2 baseline = no default; ideal = sensible default + override. Row 3 mirrors `validate`'s minimal/verbose split. |
| MVP Principles | ⚠️ Partial | Rows 1-4 tightly scoped. Row 5 (interactive disambiguation) may exceed MVP — consider "fail with candidate list" before committing to interactive prompt. |
| Deterministic Offloading | ❌ Violates | **No Surprises** at risk: default-scope inference algorithm undefined. What marks "project root" — `.git`, `package.json`, both, target file path walk-up? Without spec, behavior non-deterministic. |
| Self-Contained Naming | ➖ Not mentioned | Naming for new symbols (e.g., `resolveDefaultScope`, `findProjectRoot`) deferred to Phase 5/6. Track. |
| Safety-First Design | ⚠️ Partial | **Clear Contracts** gap: missing scope vs `--scope=.` vs absolute scope = three behaviors. Need explicit contract. **Fail Fast** ✓ for Row 5 ideal (halt-on-ambiguity). |
| Anti-Patterns | ❌ Violates | **Scattered Checks**: 3× scattered `if (options.scope)` already (S1a/b/c); risk of further scatter as deltas add cwd-walk, target-walk, env-var branches per call site. Centralize. |

### Critical Issues (Severity: High)

%% *Last Modified: 05/01/26 17:42:42* %%

1. **Default-scope algorithm undefined** [Deterministic Offloading / No Surprises]. Plan §2 Why says "Natural root inferable from cwd or target file" but doesn't specify the inference order, project-root markers, or fallback behavior. Without spec, Row 1/2 ideal cannot be implemented deterministically.
2. **`duplicates` data shape blocks Row 5 ideal** [Data-First / Illegal States Unrepresentable]. `Set<string>` cannot enumerate candidate paths. Refactor to `Map<string, string[]>` before logic changes.
3. **Scope-fallback duplication** [Modular Design / Avoid Duplication]. 3× `if (options.scope) buildCache(scope)` will become 3× larger duplication if delta adds inference per call site. Extract to single util.
4. **Three-way scope contract ambiguity** [Safety-First / Clear Contracts]. Define semantics for: missing `--scope`, `--scope .`, `--scope <abs>`. Without contract, users + agents cannot predict behavior.

### Recommendations

%% *Last Modified: 05/01/26 17:42:42* %%

1. **Add Phase 5 [i1] Delta row**: specify default-scope inference algorithm — proposed: walk up from cwd seeking `.git` or `package.json`; fall back to walk up from target file path; fail fast with clear error if neither found.
2. **Add Phase 5 [i1] Delta row**: refactor `FileCache.duplicates` from `Set<string>` → `Map<string, string[]>`; update `addToCache()` to append all paths; expose via new method (e.g., `resolveFile()` returns candidate list on multi-match).
3. **Add Phase 5 [i1] Delta row**: extract scope-fallback to single util (e.g., `src/core/resolveScope.ts`) consumed by all 3 extract methods; eliminates S1a/b/c duplication + S2b agent-burden in one move.
4. **Add Phase 5 [i1] Delta row**: document `--scope` contract in CLI help text + `jact/CLAUDE.md`; specify behavior for missing/relative/absolute values.

### Verdict

%% *Last Modified: 05/01/26 17:53:48* %%

- [X] Ready to proceed — all 4 recs authorized + integrated into §7a Delta Architecture
- [ ] Requires revision

### Prioritized Findings (MVP Lens)

%% *Last Modified: 05/01/26 17:42:42* %%

#### Fix Now (Blocking MVP)

%% *Last Modified: 05/01/26 17:42:42* %%

1. **Default-scope algorithm spec** — without it, Row 1/2 cannot ship deterministically.
2. **`duplicates` data shape refactor** — without it, Row 5 ideal is unrepresentable.
3. **Scope-fallback centralization** — without it, delta multiplies existing duplication 3×.
4. **Three-way scope contract** — without it, users hit silent surprises.

#### Integrated into Delta (no post-MVP deferral)

%% *Last Modified: 05/01/26 17:53:34* %%

1. **Naming locked:** new util at `src/core/resolveScope.ts` (action-based, primary export `resolveScope`). See §7a D1.
2. **Row 5 depth:** "fail with candidate list" (MVP-first, no interactive prompt). `resolveFile()` returns `candidates: string[]` on duplicate; caller prints list + exits 1. See §7a D2.

#### Already Mitigated

%% *Last Modified: 05/01/26 17:42:42* %%

- Tech debt log captured (`await` removal `jact.ts:653, 745`) — handled in Phase 6 same-DIFF.
- Tool-strip self-check passed at Phase 2 lock.
- LSP validation confirms all symbol locations.

### Type 1/Type 2 Classification of Recommendations

%% *Last Modified: 05/01/26 17:55:18* %%

| # | Rec | Type | Why |
|---|---|---|---|
| 1 | Default-scope algorithm | I | Defines public contract — affects every caller. **Authorized.** |
| 2 | `duplicates` shape refactor | I | Public-API-visible (return type changes). **Authorized.** |
| 3 | Centralize scope-fallback | II | Internal refactor, behavior-equivalent |
| 4 | Document `--scope` contract | II | Doc edit, no behavior change |

## 7. Phase 5 — Delta Architecture

%% *Last Modified: 05/01/26 17:55:18* %%

### 7a. Delta Architecture Table [i1]

%% *Last Modified: 05/01/26 17:55:18* %%

| # | BI | File | Section | Before | After | Notes | CEO Translation |
|---|---|---|---|---|---|---|---|
| D1 | 1, 2, 4 | `src/core/resolveScope.ts` (NEW) | full file | (file does not exist) | New util. Primary export: `resolveScope(opts: { explicit?: string; cwd: string; targetFile?: string }): ScopeResolution`. Algorithm: ① if `explicit` → return as `{source: 'explicit'}`; ② walk up from `cwd` seeking `.git/` → if found, return `{source: 'cwd-git'}`; ③ walk up from `cwd` seeking `package.json` → `{source: 'cwd-pkg'}`; ④ if `targetFile` provided, repeat ②-③ from `dirname(targetFile)` → `{source: 'target-git'\|'target-pkg'}`; ⑤ else `{source: 'none'}` (caller must error). | Marker order: `.git` before `package.json` (repo > package). Pure function, no I/O side effects beyond `fs.existsSync`. | Tool now figures out which folder to search by walking up looking for `.git` or `package.json` — no need to pass folder every call. |
| D2 | 5 | `src/FileCache.ts` | L60-160 | `cache: Map<string, string>` (filename → first path) + `duplicates: Set<string>` (dup filenames only). `addToCache()` keeps first, marks dup; loses subsequent paths. `resolveFile()` returns generic dup msg, no candidates. | Single field: `entries: Map<string, string[]>` (filename → all paths in scan order). `addToCache()` appends. `resolveFile()` returns `{found: false, reason: 'duplicate', candidates: string[], message}` listing every candidate path. | Eliminates dual-state bug (S5c). Public API change: `ResolveResultFailure` adds `candidates?: string[]` for `reason: 'duplicate' \| 'duplicate_fuzzy'`. | When two files share a name, the tool now lists every match instead of swallowing all but the first. |
| D3 | 1, 2 | `src/jact.ts` | L555-606, L645-701, L738-813 | 3× duplicated `if (options.scope) { (await\|sync) buildCache(scope) }` — no fallback when scope absent. | Replace with single helper call `applyScope(this.fileCache, options, targetFile)` in each method. Helper: `private applyScope(cache, options, targetFile?): void` calls `resolveScope` → `cache.buildCache(resolved)` → throws clear error if `source === 'none'`. Also drops spurious `await` (tech debt at L653, L745). | Three call sites collapse to one helper. Eliminates S1a/b/c scattered checks. | Three nearly-identical scope blocks become one shared step — fewer places to break, easier to fix. |
| D4 | 3 | `src/jact.ts` (Commander defs L1334-1437) + `src/formatExtractResult.ts` | extract file/header always full JSON. extract links default verbose. | Add `--verbose` option to `extract file`, `extract header`, `extract links` (mirror `validate`'s pattern at L181). Default = minimal: only `extractedContentBlocks` content array. `--verbose` = current full payload (`extractedContentBlocks` + `outgoingLinksReport` + `stats`). `formatExtractResult` gains `minimal` mode that strips `outgoingLinksReport` + `stats`. | Mirrors `validate` ergonomics. Commander option default: `verbose: false`. | Default output now contains only the content you asked for. Add `--verbose` when you also want link reports and stats. |
| D5 | 1, 2 | `src/jact.ts` Commander defs (L1281, L1339, L1398) + help text | `--scope <folder>` with no default; help text silent on inference. | `--scope <folder>` remains optional. Help text updated: "Folder to search for filename matches. Defaults to nearest ancestor of cwd containing `.git` or `package.json`; falls back to target file's ancestors. Required only when neither cwd nor target reveal a project root." Add `--scope-trace` (boolean, hidden) for debugging which source resolved. | Documents D1 algorithm at the CLI surface so users discover behavior without reading source. | Help text now explains how the tool figures out the folder — no need to memorize a workaround. |
| D6 | 4 | `jact/CLAUDE.md` Citation Tool Commands; `~/.claude/CLAUDE.md` JACT TOOL RULES | Project doc shows abs `--scope` in every example; user CLAUDE.md historically had JACT SCOPE RULE workaround. | Update `jact/CLAUDE.md` examples to omit `--scope` for in-repo calls; show `--scope` only in cross-project example. Note: user CLAUDE.md JACT SCOPE RULE already retired (only JACT CLI PATH RULE remains). | Documentation reflects new defaults. Workaround rule formally retires. | Tool docs now show the simple invocation; the workaround rule is gone. |

### 7b. Design Decisions Rationale [i1]

%% *Last Modified: 05/01/26 17:55:18* %%

#### D1 — `resolveScope` algorithm

%% *Last Modified: 05/01/26 18:06:43* %%

- **[F-ID]** A function whose output is a pure function of its inputs (cwd, targetFile, fs state) is deterministic — by definition. Required by **No Surprises** principle.
- **[OBS]** [^S-jact-extractFile] `src/jact.ts:738-813` accepts `targetFile` as first arg — so target-file-walk-up fallback has the data it needs without new plumbing.
- **[OBS]** [^S-validate-pattern] `src/jact.ts:181-256` `validate` shows established convention: `if (options.scope) buildCache(scope)`. New util replaces that conditional everywhere with a single resolved scope or fail-fast error.
- **[F-ID]** Marker priority `.git` > `package.json` confirmed for jact use cases. Strengthened from [H] via 0_SoftwareDevelopment/ survey [^OBS-marker-survey].
  - Survey result: 25+ repos with `.git`+`package.json` colocated at root (same level — order doesn't matter when colocated). Nested `package.json` cases (e.g., `claude-code-knowledgebase/agentic-workflows/package.json`, `repomix/browser/package.json`, `claude-code-web-ui/frontend/package.json`) are sub-packages within a parent `.git` repo — for markdown citation scope, parent repo wins. No counter-example found where `package.json` should override enclosing `.git`.
^OBS-marker-survey
- **[A]** When neither marker found and no `targetFile` provided, fail fast (`source: 'none'` → caller throws). Risk-if-wrong: minor friction for users running outside any repo who expected cwd-as-scope; mitigation via clear error msg suggesting `--scope .`.

#### D2 — `entries: Map<string, string[]>` refactor

%% *Last Modified: 05/01/26 17:55:18* %%

- **[F-ID]** `Set<string>` cannot represent `(filename → list of paths)`; this is a structural impossibility. Therefore Row 5 ideal is unrepresentable in current data shape (**Illegal States Unrepresentable** violation).
- **[OBS]** [^S-FileCache-duplicates] `src/FileCache.ts:64,79` declares `duplicates: Set<string>`; `addToCache()` L153-160 keeps first path silently — second-and-subsequent paths discarded.
- **[F-ID]** Single `Map<string, string[]>` subsumes both prior fields: `cache.has(f) ↔ entries.has(f)`; `duplicates.has(f) ↔ (entries.get(f)?.length ?? 0) > 1`. Therefore replacement is lossless and simplifies state.

#### D3 — `applyScope` helper extraction

%% *Last Modified: 05/01/26 17:55:18* %%

- **[OBS]** [^S-jact-scattered] `src/jact.ts:561,652,744` shows 3× identical `if (options.scope) buildCache(scope)` blocks. **Avoid Duplication** + **Scattered Checks** anti-pattern.
- **[F-ID]** Centralizing into one helper means D1 algorithm changes (e.g., adding marker file types) ripple through one call site, not three.

#### D4 — Minimal-by-default extract output

%% *Last Modified: 05/01/26 17:55:18* %%

- **[OBS]** [^S-validate-verbose] `validate` at L181 establishes minimal-default + `--verbose` ergonomics. **Follow Conventions**: extract should mirror.
- **[F-ID]** Token economy: minimal output (content only) ≪ full output (content + reports + stats). Default → smaller surface for 80% case (**Progressive Defaults**).

#### D5 — `--scope` help text + `--scope-trace`

%% *Last Modified: 05/01/26 17:55:18* %%

- **[OBS]** [^S-Commander-help] `src/jact.ts:1281` (and analogues) Commander option has no `addHelpText` for `--scope`. Documenting the algorithm at the CLI surface satisfies **Clear Contracts** without forcing source-reading.
- **[H]** `--scope-trace` (debug flag) helps users diagnose unexpected scope inference.
  - Strengthen: skip first round; add only if Phase 6 user testing shows scope-inference confusion. Defer hidden flag if unproven.

#### D6 — CLAUDE.md update

%% *Last Modified: 05/01/26 17:55:18* %%

- **[OBS]** [^S-user-CLAUDE-md] user `~/.claude/CLAUDE.md` JACT SCOPE RULE already retired (current state shows only JACT CLI PATH RULE).
- **[F-ID]** `jact/CLAUDE.md` examples drive agent-future-behavior; updating examples to no-`--scope` form propagates new default downstream.

### 7c. Naming & File Organization [i1]

%% *Last Modified: 05/01/26 17:55:18* %%

| New Symbol/File | Decision | Principle |
|---|---|---|
| `src/core/resolveScope.ts` | Action-based file naming. Primary export = `resolveScope`. | **Transformation Naming**, **Primary Export Pattern** |
| `ScopeResolution` type | Tagged union: `{ scope: string; source: 'explicit'\|'cwd-git'\|'cwd-pkg'\|'target-git'\|'target-pkg'\|'none' }`. Co-located in `resolveScope.ts`. | **Behavior as Data**, **Co-located Helpers** |
| `applyScope(cache, options, targetFile?)` | Private method on `JactCli`. Internal helper, not exported. | **Single Responsibility** |
| `entries: Map<string, string[]>` | Replaces `cache + duplicates` dual-state. | **One Source of Truth** |
| `ResolveResultFailure.candidates?: string[]` | Optional field on existing failure type when `reason: 'duplicate' \| 'duplicate_fuzzy'`. | **Illegal States Unrepresentable** |

### 7e. Validation Table [i2]

%% *Last Modified: 05/01/26 17:55:18* %%

| BI Row | Ideal [O] | Delta(s) | Verification |
|---|---|---|---|
| 1 | User from inside known project resolves by name w/o declaring root | D1, D3, D5 | Run `jact extract file <name>` from inside `jact/` repo (no `--scope`); succeeds. Run from random dir with `--scope` omitted and no markers; fails with actionable error. |
| 2 | Agent resolves by name w/o rebuilding root | D1, D3, D6 | Open new agent session; agent invokes `jact extract file <name>` without abs `--scope`; succeeds without consulting CLAUDE.md rule. |
| 3 | User gets only content asked for by default | D4 | `jact extract file foo.md` outputs minimal content array; `--verbose` adds reports + stats. Token diff observable. |
| 4 | Natural-root rule retires | D6 | `jact/CLAUDE.md` examples updated; user `~/.claude/CLAUDE.md` JACT SCOPE RULE absent (already retired). |
| 5 | User receives actionable disambiguation prompt naming every candidate | D2 | Place duplicate-named files in scope; run `jact extract file <name>`; error lists every candidate path; exit 1. |

### 7d. NBA — Items to Resolve

%% *Last Modified: 05/01/26 18:06:58* %%

| ID | Item | Type | Status |
|---|---|---|---|
| ~~[H-D1-marker-order](#^H-D1-marker-order)~~ | ~~`.git` > `package.json` priority covers jact use cases~~ | ~~H (negate-first)~~ | **Resolved** — survey of `0_SoftwareDevelopment/` found no counter-example; [H]→[F-ID] [OBS-marker-survey](#^OBS-marker-survey) |
| ~~[A-D1-no-marker-fail](#^A-D1-no-marker-fail)~~ | ~~Fail fast when no marker + no targetFile vs fall back to cwd~~ | ~~A~~ | **Resolved** — fail fast (per D1 rationale) |
| H-D5-trace-flag | `--scope-trace` debug flag worth shipping in MVP | H | Open — defer to post-MVP unless Phase 6 shows confusion |
^H-D1-marker-order
^A-D1-no-marker-fail

### 7f. [i3] Eval Hold

%% *Last Modified: 05/01/26 17:55:18* %%

Phase 5 [i3] eval (Delta arch against principles) pending — to dispatch post-lock.

