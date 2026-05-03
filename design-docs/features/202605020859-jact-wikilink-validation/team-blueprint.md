%% hardening: exempt-defer-language — pre-pipeline-lock baseline %%

---
goal: "Implement jact wikilink validation per plan.md (D1–D5)"
domain: software
complexity: team
topology: sequential-pipeline-with-quality-gates
agent_count: 3
estimated_cost_tier: medium
source_plan: "design-docs/features/202605020859-jact-wikilink-validation/plan.md"
created: 2026-05-02
---

## Mission Summary

%% *Last Modified: 05/02/26 12:57:52* %%

Execute the locked design plan for jact wikilink validation — five sequential Deltas (D1 grammar, D2 residual scanner, D3 coverage-qualified output, D4 wiki page resolver, D5 docs) — against an existing TypeScript codebase with strict Vitest test discipline.

**Why a team (not single agent):** Plan contains a Type I interface change (`manager.validate()` return shape), schema additions to public types, and exit-code refactor coupled to display logic. Each Delta needs (a) implementation, (b) behavior tests proving fail-loud semantics, (c) architectural review against CLAUDE.md and plan rationale. Conflating these into one agent risks losing the BDD discipline the project enforces and skipping the per-Delta quality gate.

**Why not larger:** No genuinely different expertise across roles beyond impl/test/review. Adding a separate type-architect or QA role would overlap with code-reviewer responsibilities (>30% deliverable overlap → merge per anti-pattern watchlist).

---

## Topology: Sequential Pipeline with Per-Delta Quality Gates

%% *Last Modified: 05/02/26 12:57:52* %%

Each Delta cycles: **Implement → Test → Review → User Sign-off → Next Delta**.

```
[D1 Implement] → [D1 Test] → [D1 Review] → [user gate]
       ↓
[D2 Implement] → [D2 Test] → [D2 Review] → [user gate]
       ↓
[D3 Implement] → [D3 Test] → [D3 Review] → [user gate]
       ↓
[D4 Implement] → [D4 Test] → [D4 Review] → [user gate]
       ↓
[D5 Implement] → [D5 Test] → [D5 Review] → [final user gate]
```

**Topology rationale:** Strong sequential dependencies between Deltas (D2 needs D1's grammar; D3 needs D1+D2 outputs; D4 reuses D1's `linkType: "wiki"`; D5 documents D1's grammar). Parallel topology would produce inconsistent work requiring rework. Per-Delta gates prevent error cascading — a broken D1 grammar would invalidate D2's residual scanner assumptions and D3's coverage counts.

**Alternatives considered:**
- **Single application-tech-lead agent:** rejected — plan mandates BDD discipline; one agent doing impl+test+review collapses the quality gate and reintroduces the silent-failure mode the feature exists to prevent.
- **Parallel team on independent Deltas:** rejected — D2/D3/D4/D5 all depend on D1's grammar landing first; parallelizing across them would block all three on D1 anyway.
- **5-agent team (one per Delta):** rejected — agent bloat. Same role (implementer), same skills, just different code regions. Merge.

---

## Roles

%% *Last Modified: 05/02/26 12:57:52* %%

### 1. application-tech-lead (Implementation Lead)

%% *Last Modified: 05/02/26 12:57:52* %%

**Responsibilities:**
- Execute D1–D5 in order, one Delta per session
- Update `src/types/citationTypes.ts` and `src/types/validationTypes.ts` first when shape changes (per plan §7a.3)
- Implement core logic: `extractWikilinks` (D1), residual scanner (D2), `getLinkClass` + summary refactor + exit-code refactor (D3), `resolveWikiPath` + `pageNameToSlug` + Levenshtein (D4), CLAUDE.md + JSDoc + component guide updates (D5)
- Run `npm run build` and `npm test` before declaring Delta complete
- Flag any plan ambiguity or unresolved hypothesis ([H-D4-slug] is OPEN — verify at implementation per plan)

**Decision authority:**
- Autonomous: function naming within plan constraints, internal helper extraction, test file organization
- Escalate: any deviation from plan §7a Notes column, any Type I interface change beyond what the plan locks, any new public type

**Artifact produced per Delta:** working code + passing test suite + brief implementation note (which plan rows landed, which hypotheses verified, any deviations)

**Out of scope:** writing BDD tests (delegated), reviewing own code (delegated)

### 2. bdd-test-writer (Behavior Test Writer)

%% *Last Modified: 05/02/26 12:57:52* %%

**Responsibilities:**
- Per Delta, enumerate behavior combos from the plan's expected outputs (D1 grammar covers 10 forms; D2 emits records for unmatched brackets; D3 prints coverage qualifier and exits 1 on unrecognized > 0; D4 resolves slug-normalized names; D5 docs match impl)
- Write Given/When/Then assertions targeting the plan's UI sketches in §7g (minimal mode, verbose mode, JSON mode, exit-code path)
- Specifically test the fail-loud invariants: residual brackets cause exit 1, unrecognized count appears in output, structured-field exit code (not string match)
- Verify the implementation tests for the 11 baseline wikilink occurrences in `0-documents/llm-wiki/wiki/concepts/probabilistic-vs-deterministic-systems.md` per [H-D1-regex] resolution evidence
- Do NOT modify production code; report bugs to implementation lead

**Decision authority:**
- Autonomous: test naming, fixture design, coverage matrix decisions
- Escalate: missing source code (suggests Delta incomplete), test infrastructure gaps

**Artifact produced per Delta:** new `*.test.ts` file(s) under `test/unit/` or `test/integration/` mirroring source structure, all passing

**Out of scope:** modifying source under `src/` (raise findings to impl lead)

### 3. code-reviewer (Architectural Review)

%% *Last Modified: 05/02/26 12:57:52* %%

**Responsibilities:**
- Review each Delta against:
  - The plan's §7a Notes column (Type I changes, schema departures)
  - The plan's §7b rationale (especially the "Why" sections — reviewer ensures intent preserved)
  - `CLAUDE.md` rules (component boundaries, factory pattern, ParsedDocument facade)
  - Strict TypeScript settings (no implicit returns, exact optional property types, etc.)
- Flag:
  - One Invariant One Place violations (plan calls these out explicitly)
  - Scattered Checks regressions (D4's `resolveWikiPath` extraction must hold)
  - Display/logic coupling regressions (D3's exit-code refactor must read structured field)
- Verify GAP-1 through GAP-8 resolutions landed as designed
- Approve or reject the Delta with specific line-level feedback

**Decision authority:**
- Autonomous: review verdict, severity classification (blocking / major / minor / nitpick)
- Escalate: disagreement with plan rationale (raise to user, not silently override)

**Artifact produced per Delta:** review report with verdict (APPROVED / NEEDS-CHANGES / BLOCKED) and per-finding evidence

**Out of scope:** rewriting code (return findings; impl lead fixes)

---

## Artifact Chain

%% *Last Modified: 05/02/26 12:57:52* %%

| Stage | Producer | Artifact | Format | Consumer |
|-------|----------|----------|--------|----------|
| Per-Delta impl | application-tech-lead | Source diff + impl note | git commit + brief markdown | bdd-test-writer |
| Per-Delta test | bdd-test-writer | `*.test.ts` files + coverage matrix | Vitest test files + markdown table | code-reviewer |
| Per-Delta review | code-reviewer | Review report | markdown with line refs | user (gate) |
| User gate | user | Approve / reject | message | application-tech-lead (next Delta) |

**Handoff invariants:**
- Impl → Test: `npm test` passes on existing tests; new code has at least one happy-path test from impl lead
- Test → Review: full coverage matrix attached; all new tests passing; baseline file regression test included
- Review → User: verdict explicit; if BLOCKED, specific blockers listed with plan-section references

---

## Quality Gates

%% *Last Modified: 05/02/26 12:57:52* %%

### Gate 1: After D1 (Grammar Lands)

%% *Last Modified: 05/02/26 12:57:52* %%

- **Acceptance:** `extractWikilinks` parses all 10 forms in plan §7a; baseline file produces 11 LinkObjects (per [H-D1-regex] resolution); old `extractWikiCrossDocLinks` / `extractWikiInternalLinks` deleted; CitationValidator routing wakes up (CI-02 verified).
- **Block on:** missing forms, regex backtracking issues, partial deletion of old extractors.

### Gate 2: After D2 (Residual Scanner Lands)

%% *Last Modified: 05/02/26 12:57:52* %%

- **Acceptance:** Unmatched `[[...]]` produces `UnrecognizedSyntaxRecord`; `unrecognized[]` field on ValidationResult; minimal + verbose display sections per §7g; <50ms scan budget on largest wiki file (per [H-D2-perf]).
- **Block on:** silent-skip persists, schema departure not documented for JSON consumers.

### Gate 3: After D3 (Output + Exit Code)

%% *Last Modified: 05/02/26 12:57:52* %%

- **Acceptance:** `LinkClass` discriminator separate from `linkType`; `byLinkClass` summary; exit code reads structured field at all branches; `manager.validate()` Type I shape change landed cleanly; FAILED-path summary per GAP-2.
- **Block on:** display-string match used for exit code anywhere, Type I change incomplete (callers not updated), missing GAP-1/2/3/4 surface elements.

### Gate 4: After D4 (Page Resolver)

%% *Last Modified: 05/02/26 12:57:52* %%

- **Acceptance:** `resolveWikiPath` extracted to sibling module (DCI-02); `pageNameToSlug` produces correct kebab-case; Levenshtein adaptive threshold computed from full relative path; multi-match returns comma-separated paths; baseline file ≥80% resolution rate (closes [H-D4-slug]).
- **Block on:** `createLinkObject.ts` gains FileCache dependency, Levenshtein threshold fixed at 5 (must be adaptive), suggestion uses basename only.

### Gate 5: After D5 (Docs)

%% *Last Modified: 05/02/26 12:57:52* %%

- **Acceptance:** CLAUDE.md, MarkdownParser.ts JSDoc, component guide all enumerate the 10 forms identically; old function names removed.
- **Block on:** drift between any two of the three locations.

---

## Anti-Patterns Specific to This Project

%% *Last Modified: 05/02/26 12:57:52* %%

1. **Delta Reorder Temptation** — The plan specifies D1 first because D2/D3/D4 all consume D1's grammar output. Skipping ahead to D3 because "exit code refactor is small" produces work that gets thrown out when D1 changes the LinkObject shape. **Resolution:** strict sequential execution; no Delta starts before previous Delta passes its gate.

2. **String-Match Exit Code Persistence** — D3's whole point is removing string-match coupling. Easy to "patch" by adding `"unrecognized"` to the string-match list. **Resolution:** code reviewer specifically inspects exit-code path for `result.includes(...)` patterns — those are blocking findings.

3. **Hypothesis Drift** — Plan has open hypothesis [H-D4-slug] (≥80% resolution rate) marked OPEN at j2/implementation. Easy to skip verification and ship D4 without measuring. **Resolution:** D4 gate requires impl lead to run resolver against baseline file and report (resolved, broken-with-reason) counts before review starts.

4. **Documentation-Implementation Drift Re-introduction** — D5 fixes drift in three locations. If D1's grammar evolves during impl (e.g., handling em dashes differently than spec'd), D5's docs must update or new drift forms. **Resolution:** D5 happens last AND impl lead must re-read D1's actual final grammar before writing D5 docs (not the original plan spec).

---

## Estimated Cost Tier: Medium

%% *Last Modified: 05/02/26 12:57:52* %%

- 5 Deltas × (impl + test + review) = 15 agent invocations minimum
- Plus rework on review failures (assume +30%)
- Per-Delta token budget: ~50–80k input, ~10–20k output
- **Total:** ~1.5–2M input tokens, ~200–300k output tokens across the full feature

---

## Open Questions for User

%% *Last Modified: 05/02/26 12:57:52* %%

1. **Test scope:** Should bdd-test-writer cover JSON-mode consumers explicitly, or focus on minimal/verbose CLI output? Plan §7g.5 includes JSON mode; recommend **including it** because the schema change is the biggest downstream risk.
2. **Final commit strategy:** One commit per Delta, or one squashed commit at the end? Recommend **one per Delta** for bisectability if a regression surfaces post-merge.
3. **Where to run:** Current branch `ast-scope` or new feature branch? Recommend **new feature branch** (`feat/wikilink-validation`) since this is 5 Deltas with type changes.
