%% hardening: exempt-defer-language — pre-pipeline-lock baseline %%

---
goal: "Execute Phase 6 implementation of Deltas D1-D7 in jact extract smart-default-scope plan"
domain: software
complexity: team
topology: sequential-pipeline
agent_count: 3
estimated_cost_tier: medium
---

## Traceability — BI Row Ideal Outcomes [O] (Plan §5)

%% *Last Modified: 05/01/26 18:36:07* %%

Every role and quality gate below traces to one or more locked [O] outcomes:

- **[O1]** User from inside known project resolves by name w/o declaring root
- **[O2]** Agent from inside known project resolves by name w/o rebuilding root
- **[O3]** User gets only content asked for by default; opts into payload when needed
- **[O4]** Natural-root rule retires; agent stops carrying global workaround
- **[O5]** User receives actionable disambiguation prompt naming every candidate on multi-match

## Roles

%% *Last Modified: 05/01/26 18:36:07* %%

1. **Delta Implementer** — Executes the 7 locked Deltas (D1-D7) in dependency order under TDD discipline. Writes failing test → minimal implementation → green → refactor. Commits one Delta per logical unit. Adapted from `application-tech-lead` agent.
2. **Delta Reviewer** — Reviews each Delta's diff against Plan §7a (Delta Architecture) + §7b (Rationale) + project architecture principles. Returns severity-classified findings (blocking/major/minor/nitpick). Reuses `forge:reviewer` agent.
3. **BI-Row Verifier** — Validates each Delta's runtime behavior against §7e Validation Table per BI Row [O]. Returns APPROVED/REJECTED with per-criterion evidence. Reuses `forge:verifier` agent.

## Artifact Chain

%% *Last Modified: 05/01/26 18:36:07* %%

1. Delta Implementer produces **Delta Patch** (git commit: code changes + tests for one Delta from D1-D7, with test output showing RED→GREEN, mapped to source IDs S1a-S5d in §6 Source Map)
2. Delta Reviewer receives Delta Patch, produces **Review Report** (markdown: severity-classified findings against §7a/§7b spec + architecture principles, ship/no-ship verdict)
3. Delta Implementer receives Review Report, produces **Revised Delta Patch** (loops until reviewer clears blocking findings)
4. BI-Row Verifier receives Revised Delta Patch, produces **Verification Report** (markdown: APPROVED/REJECTED per §7e BI Row, with command transcripts as evidence)

## Quality Gates

%% *Last Modified: 05/01/26 18:36:07* %%

- **Delta Patch** must pass `npm run build` + `npm test` locally before Reviewer runs — traces to [O1, O2, O3, O5] depending on Delta
- **Review Report** must clear all `blocking` findings before Verifier runs — prevents §6.5 [i0] regressions during implementation
- **Verification Report** must return APPROVED on the §7e BI Row(s) covered by the Delta before next Delta starts:
  - D1, D3, D5 → must satisfy [O1] + [O2] (in-repo invocation succeeds w/o `--scope`)
  - D2, D7 → must satisfy [O5] (multi-match lists every candidate)
  - D4 → must satisfy [O3] (minimal default; `--verbose` adds payload)
  - D6 → must satisfy [O4] (`jact/CLAUDE.md` examples updated; user CLAUDE.md JACT SCOPE RULE absent)
- **Tech debt encountered during implementation** must be fixed in the same Delta PR (per project CLAUDE.md TECH DEBT POLICY) — never deferred

## Topology

%% *Last Modified: 05/01/26 18:36:07* %%

**Selected:** Sequential pipeline (per-Delta loop)

**Rationale:** Phase 5 §7 is LOCKED — architecture decisions are no longer ambiguous, so the work is execution, not exploration. Strong sequential dependencies exist between Deltas (D2 + D1 are foundations; D3 consumes both; D7 consumes D1 + D2). Within each Delta, the impl→review→verify chain has strict ordering: review depends on patch, verification depends on cleared review. Parallelizing reviewer/verifier would cause rework when reviewer finds blocking issues that invalidate verifier work.

**Alternatives considered:**
- *Single agent (Level 0):* Rejected — §7e BI-Row verification is a distinct decision authority from implementation. Self-verification has known failure mode where implementer rationalizes "good enough" against [O]. Independent verifier prevents cascade.
- *Parallel-independent across Deltas:* Rejected — D3 depends on D1+D2 outputs; D7 depends on D1+D2 outputs. Parallel start would force rework when foundation Deltas land.
- *Centralized coordinator:* Rejected — only 3 roles, linear flow, no flow-management complexity to justify a coordinator's overhead.

**Delta execution order** (respects dependency DAG from §7a):
1. D2 — `FileCache.entries: Map<string, string[]>` refactor (foundation; data shape before logic)
2. D1 — `src/core/resolveScope.ts` new util (foundation; pure function, no consumers yet)
3. D3 — `applyScope` helper (consumes D1 + D2; eliminates S1a/b/c scattered checks)
4. D7 — Smart error stack M1/M2/M3 (consumes D1 + D2; zero-data-cost enrichment per §7b)
5. D4 — Minimal-default extract output + `--verbose` (independent; mirrors `validate` pattern)
6. D5 — Commander `--scope` help text (documents D1 algorithm at CLI surface)
7. D6 — `jact/CLAUDE.md` examples update (documentation last; reflects shipped behavior)

**Phase 5 [i3] minor findings folded into Phase 6** (per §7f recommendations):
- Pin `ResolveResultFailure.{candidates, scope, nearMisses}` to `src/types/validationTypes.ts`
- Snapshot tests for D7 M1/M2/M3 error message strings
- Levenshtein unit test for `findNearMisses` with distance threshold ≤2

## Anti-Patterns to Guard Against

%% *Last Modified: 05/01/26 18:36:07* %%

- **Self-Verification Cascade:** Implementer marking own work APPROVED without independent BI-Row check. Prevention: Verifier role is non-negotiable gate before next Delta starts; reuses `forge:verifier` agent specifically because it has APPROVED/REJECTED discipline.
- **Architecture Drift:** Implementer "improving" on §7 locked Deltas during coding. Prevention: Reviewer's first check is "does the patch implement the spec as written?" — deviations require returning to plan §7 for re-lock, not silent change.
- **Tech-Debt Deferral:** Implementer encountering smell, filing GH issue instead of fixing in same PR. Prevention: Project CLAUDE.md TECH DEBT POLICY is mandatory — Reviewer rejects any patch that defers debt found within its own diff scope.
- **TDD Skipping on "Simple" Deltas:** Implementer writing impl-first because Delta seems trivial (e.g., D5 help text, D6 doc updates). Prevention: Even doc-only Deltas need a verification step from §7e Validation Table; treat the validation step as the test.
- **Verifier Rubber-Stamping:** Verifier marking APPROVED without command-transcript evidence. Prevention: Verification Report MUST include literal command + output for each [O] check, not paraphrased summary.
- **Cross-Delta Coupling Drift:** D3/D7 modifications drifting into D1's pure-function contract or D2's data shape. Prevention: Reviewer cross-checks consumer Deltas against foundation Delta interfaces before clearing.

## Library Reuse

%% *Last Modified: 05/01/26 18:36:07* %%

| Role              | Source                        | Adaptation                                                             |
| ----------------- | ----------------------------- | ---------------------------------------------------------------------- |
| Delta Implementer | `application-tech-lead` agent | Constrained to executing locked plan §7; no architecture re-litigation |
| Delta Reviewer    | `forge:reviewer` agent        | Direct reuse; review criteria = Plan §7a/§7b + arch principles         |
| BI-Row Verifier   | `forge:verifier` agent        | Direct reuse; acceptance criteria = §7e Validation Table               |

No new agent definitions required.
