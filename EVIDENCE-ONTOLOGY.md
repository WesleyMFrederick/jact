# UNIVERSAL DECISION ONTOLOGY + BUCKET MODEL (ONE-SHEET)

Works for **any entry point** (case interviews, product strategy, hackathons, feature design, transformation programs, research planning). Clients may bring any combination of baseline problems, ideal visions, delta solutions, metrics gaps, or constraints.

**Two layers:** **Ontology** (atomic thinking units) + **Buckets** (Baseline / Ideal / Delta). Any ontology element can live in any bucket.

**Purpose of tagging:** Every tag exists to provide a trace so all downstream work built on it can be traced back to weak claims — assumptions, hypotheses, and unsourced goals that may later prove wrong.

---

## Tag Format Rule

**Every tag MUST use the format: `[TAG: short-display]`**

- The tag type and content are a single bracketed unit with a colon separator
- Examples: `[OBS-001: token expires in 1h] [^S-001]`, `[Q: what is unknown?]`, `[G-001: reduce costs] [^S-002]`
- **Never:** `[TAG] bare text after bracket` — the colon and display content must be inside the brackets
- [Q], [A], and [H] additionally require:
  - Strengthen: (see per-tag rules below)
  - Utility: L/M/H rating + what decision this unlocks
  - Cost: L/M/H — effort to strengthen/resolve
  - Next actions: numbered to-dos to strengthen
  - DRI: Agent | User | {role} — who does the work
- **Expanded block rule:** When a tag with Strengthen/Utility appears inline where follow-up lines don't fit (e.g., inside a table cell), extract it into a standalone block below with a `^TAG-NNN` block anchor. The inline occurrence must then become a link to the block: `[\[TAG-NNN: text\]](#^TAG-NNN)`. Expanded block format:
  ```
  [TAG-NNN] `context-path` Descriptive text | **Strengthen**: ... | **Utility**: ... | **Cost**: ... | **Next actions**: ... | **DRI**: ... ^TAG-NNN
  ```

---

## Ontology Tag Types Table

| **Tag**                  | **Requires**                                                                                                                                                                                     | **Valid Source Examples**                                                                                                                                                                                                                                                                                                                                                                      | **Invalid Source Examples**                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[OBS] Observation**    | Exact pointer for a Simple Read, OR Reproduction Command + Result with explicit boundary crossings.                                                                                              | **Simple Reads:**<br>• `[OBS-001: token expires in 1h] [^S-001]` auth.ts confirms 1h expiry<br>• `[OBS-002: always output JSON] [^S-002]` system prompt mandates JSON<br><br>**Executions:**<br>• `[OBS-003: parsed 3 anchors] [^S-003]` extract.js output<br><br>**Footnotes:**<br>`[^S-001]: /abs/path/src/auth.ts:12-15`<br>`[^S-002]: /abs/path/system-prompt.md:42`<br>`[^S-003]: /abs/path/extract.js:1-50` → `node extract.js` | `[OBS: Context says it outputs JSON]`_(Secondhand)_<br><br>`[OBS: it failed]` _(Not a literal result)_                                                                                              |
| **[F-ID] Identity Fact** | Truth by definition, math, or structural logic (Probability = 1.0).                                                                                                                              | • `[F-ID: Profit = Revenue - Cost]`<br>• `[F-ID: Total Latency = Net + App + DB]`<br>• `[F-ID: Time Spent (Path A) = Time Lost (Alternative Paths)]`                                                                                                                                                                                                                                           | `[F-ID: AWS costs are too high]`_(Assumption)_                                                                                                                                                      |
| **[F-LK] Locked Fact**   | High-confidence empirical reality frozen for the current decision cycle.                                                                                                                         | • `[F-LK: Q3 Revenue = $4.2M] [^S-001]` frozen from NetSuite Q3 close<br>• `[F-LK: DB size = 4TB] [^S-002]` per RDS metrics<br><br>**Footnotes:**<br>`[^S-001]: /abs/path/finance/q3-close.xlsx:Revenue`<br>`[^S-002]: RDS console → db.metrics.storage`                                                                                                                                        | `[F-LK: We will reach $5M next quarter]`_(Hypothesis)_                                                                                                                                              |
| **[M] Metric**           | A numerical observation. Follows the exact same rules as `[OBS]`: precise pointer OR command + result.                                                                                           | **Simple Reads:**<br>• `[M-001: jest ^29.5.0] [^S-001]` dependency version<br>• `[M-002: rate limit 5000/hr] [^S-002]` GitHub API cap<br><br>**Executions:**<br>• `[M-003: log file 94KB] [^S-003]` measured via wc<br><br>**Footnotes:**<br>`[^S-001]: /abs/path/package.json:14`<br>`[^S-002]: GitHub API Docs, Rate Limits section`<br>`[^S-003]: wc -c logs.txt` → `94KB`                     | `[M: about 94KB]`_(Estimation)_<br><br>`[M: Customer Acquisition Cost]` _(No pointer)_                                                                                                              |
| **[E] Evidence**         | An observation (`[OBS]` or `[M]`) + Source + Link that updates a Hypothesis.                                                                                                                     | • `[E: [OBS] (Mixpanel drop-off @ step 2) supports [H] (UX confusing)]`<br>• `[E: [M] (DB CPU 99%) refutes [H] (Network bottleneck)]`                                                                                                                                                                                                                                                          | `[E: The marketing campaign failed]`_(Missing observation link)_                                                                                                                                    |
| **[H] Hypothesis**       | A mutable claim about reality requiring validation (Probability 0–1). _Must include strengthening steps & utility._                                                                              | • `[H: Redis cuts latency 50%]` synthesized claim<br>  - Strengthen: Find a case where Redis does NOT cut latency (negate-first)<br>  - Utility: H — determines caching architecture<br>  - Cost: M — requires staging env benchmark<br>  - Next actions: 1. Set up staging Redis 2. Run load test without Redis 3. Run with Redis 4. Compare p95<br>  - DRI: Agent<br>• `[H: free trial increases funnel 20%] [^S-001]` based on competitor analysis<br>  - Strengthen: Check if competitors with free trials have higher churn (negate-first)<br>  - Utility: H — decides pricing model<br>  - Cost: H — requires A/B test infrastructure<br>  - Next actions: 1. Analyze competitor churn data 2. Design A/B test 3. Run for 2 weeks<br>  - DRI: User<br><br>**Footnote:**<br>`[^S-001]: /abs/path/research/competitor-analysis.md:34-41` | `[H: Profit = Revenue - Cost]` _(Identity Fact)_                                                                                                                                                    |
| **[A] Assumption**       | Provisional claim to unblock progress. **If wrong, it introduces risk to any other decisions built upon it.** _Must include strengthening steps, utility, & Risk-if-wrong._                      | • `[A: Users understand the 'Archive' icon]`<br>  - Strengthen: Usability test with 5 users<br>  - Utility: H — determines icon redesign<br>  - Cost: M — requires recruiting test participants<br>  - Next actions: 1. Draft test script 2. Recruit 5 users 3. Run sessions<br>  - DRI: User<br>  - Risk-if-wrong: Icon redesign delays launch by 2 weeks<br>• `[A: Legacy API behaves identically to v2]` | `[A: wc -l src/index.ts → 142]` _(Observation)_                                                                                                                                                     |
| **[C] Constraint**       | Non-negotiable boundary condition that limits the solution space.                                                                                                                                | • `[C: SOC2 compliance required] [^S-001]` per Legal mandate<br>• `[C: jq required by hook] [^S-002]` pre-commit dependency<br><br>**Footnotes:**<br>`[^S-001]: /abs/path/legal/compliance-tickets.md:92`<br>`[^S-002]: /abs/path/.husky/pre-commit:7`                                                                                                                                          | `[C: We should use GraphQL]` _(Decision)_                                                                                                                                                           |
| **[O] Outcome**          | A stable, end state a person or system inhabits — independent of how it was built, what came before, or what enables it. _(No from/to language, no condition clauses, no tool/data references)._ | • `[O: Regulators can identify top-emitting vessels in their jurisdiction]`<br>• `[O: Analysts can explain and defend any emissions estimate to external auditors]`                                                                                                                                                                                                                            | `[O: Build an emissions dashboard]`_(Feature)_<br><br>`[O: Move compliance teams from manual to automated]`_(Delta/Transition)_<br><br>`[O: Increase model accuracy to 85%]`_(Key Result / Metric)_ |
| **[G] Goal**             | Directional intent or strategic motivation explaining _why_ outcomes matter. Requires a source pointer (same format as [OBS]) so the goal's origin is traceable.                                 | • `[G-001: reduce infrastructure costs] [^S-001]` strategic priority<br>• `[G-002: expand to enterprise market] [^S-002]` growth target<br>• `[G-003: unify BID and TDD] [^S-003]` workflow consolidation<br><br>**Footnotes:**<br>`[^S-001]: /abs/path/strategy.md:14`<br>`[^S-002]: /abs/path/transcripts/f642.jsonl:12`<br>`[^S-003]: /abs/path/proposal.md:3`                                  | `[G: Cost per click]`_(Metric)_<br><br>`[G: Improve performance]`_(No source pointer)_<br><br>`[G: cut costs]`_(No footnote — source untraceable)_<br><br>`[G: enter APAC]`_(No footnote — source untraceable)_ |
| **[Q] Question**         | A labeled uncertainty organizing exploration and evidence collection. _Must include strengthening steps & utility._                                                                              | • `[Q: Why did churn spike in March?]`<br>  - Strengthen: Pull cohort data by signup month, check for billing changes<br>  - Utility: H — determines retention strategy<br>  - Cost: L — data already in analytics<br>  - Next actions: 1. Export March cohort 2. Cross-ref with billing changelog 3. Interview 3 churned users<br>  - DRI: Agent<br>• `[Q: header/extract same path?]`<br>  - Strengthen: Read both modules, compare path resolution logic<br>  - Utility: M — determines if we can share a path utility<br>  - Cost: L — code review only<br>  - Next actions: 1. Read header module 2. Read extract module 3. Diff path logic<br>  - DRI: Agent | `[Q: API response is 400ms]` _(Observation)_                                                                                                                                                        |
| **[P] Priority**         | Relative importance or ordering of questions, goals, or hypotheses.                                                                                                                              | • `[P: Reliability > Feature Velocity]`<br>• `[P: Resolving Q1 is required before Q2]`                                                                                                                                                                                                                                                                                                         | `[P: We need to fix the bug]` _(Goal/Decision)_                                                                                                                                                     |
| **[D] Decision**         | Explicit resource commitment or allocation among options. Commits [F-Rule: Time] or budget. Must reference supporting evidence tags (OBS, F-LK, A, C, H) that justify the commitment.            | • `[D: acquire new accounts] [^S-001]` growth path primary<br>• `[D: use three-file module]` Based on: OBS-007 (CLI pattern), C-001 (no Effect)<br><br>**Footnote:**<br>`[^S-001]: /abs/path/strategy/growth-plan.md:22`                                                                                                                                                                        | `[D: SOC2 compliance required]` _(Constraint)_<br><br>`[D: The API returns JSON]` _(Observation)_<br><br>`[D: use oldest param for sync]` _(No supporting evidence — could be hallucination)_        |

---

## Tag Properties & Special Rules

**Confidence scale:** [F-ID] P=1.0, immutable → [F-LK] high confidence, frozen per cycle → [H] P∈[0,1], mutable → [A] provisional, risk propagates downstream if wrong

**Required follow-up** (for [H], [A], [Q] — per Tag Format Rule):
1. **Strengthen:** (see per-tag rules below)
2. **Utility:** L/M/H rating + what decision this unlocks
3. **Cost:** L/M/H — effort to strengthen/resolve
4. **Next actions:** numbered to-dos to strengthen
5. **DRI:** Agent | User | {role} — who does the work

- [A] additionally requires:
  - **Risk-if-wrong:** what downstream decisions break if this assumption fails?

### Per-Tag Strengthen Rules

- **[H] Strengthen must be negate-first:** What evidence would disprove this hypothesis?
  Design the first test to falsify, not confirm. If your first action proves the hypothesis, great.
  But the default posture is: try to break it.
- **[Q] Strengthen:** What evidence/steps would resolve this question?
- **[A] Strengthen:** What would confirm or refute this provisional claim?

### Outcome ([O]) — Extended Rules

**Outcomes speak to a person or group's motivations.** JTBD-style: the actor can do X. Full stop.

In the **Ideal bucket**, outcomes gain a comparative _-er_ suffix (better, quicker, more reliably) — this is what produces key result metrics when compared against baseline outcomes. The **Delta bucket** designs the change that impacts outcomes.

| ✓ Pattern | Why |
|---|---|
| "Regulators can identify top-emitting vessels in their jurisdiction" | Stable capability, actor-owned, tool-agnostic |
| "Analysts can explain and defend any emissions estimate to external auditors" | Durable — holds regardless of model or vendor |

| ✗ Anti-Pattern | Actually Is |
|---|---|
| "Build an emissions dashboard" | Output / feature |
| "Move compliance teams from manual to automated" | Delta / transition |
| "Increase model accuracy to 85%" | Key result / metric |
| "Estimates remain auditable when AIS data is incomplete" | Constraint / design requirement |

**Three Disqualifiers** — strip the [O] tag if it contains:
1. **From/to language** — transition, not a state
2. **Condition clauses** — even when, as long as, provided that
3. **Tool or data references** — via AIS, through the dashboard, using the model

If any appear, the real outcome is one level above.

---

## PART 2 — BUCKETS (STATE ORGANIZATION)

Buckets = **system states**, not ontology types. Any element can exist in any bucket.

**Why three buckets:** Regardless of where a client enters (problem, vision, solution, metrics, constraints), separating baseline and ideal in the same ontology units forces assumptions about current state and target state to surface before any delta commits resources. Unexamined assumptions in either bucket propagate through every downstream decision.

| Bucket | Key Question | Purpose |
|---|---|---|
| **BASELINE** — Current State | Where are we now? | Understand reality and constraints before change |
| **IDEAL** — Target State | If success were fully achieved, what would the world look like? | Define evaluation criteria for solutions |
| **DELTA** — Transformation Path | What changes could move us toward the ideal? | Decision and planning |

---

# PART 3 — ENTRY POINT ADAPTATION

Clients may start anywhere:

| Client Entry | First Action |
|-------------|-------------|
| Baseline problem | Map BASELINE → infer IDEAL |
| Ideal vision | Clarify IDEAL → map BASELINE |
| Solution idea | Treat as DELTA H → reconstruct IDEAL + BASELINE |
| Metrics gap | Map METRICS → infer IDEAL |
| Constraints | Map CONSTRAINTS → define feasible IDEAL |
| Mixed | Decompose into ontology → bucket |

Core Rule:

> Always reconstruct all three buckets before deciding.

---

# PART 4 — UNIVERSAL FLOW

1. Decompose prompt into ontology elements
2. Place elements into buckets (Baseline / Ideal / Delta)
3. Identify gaps (Q)
4. Evaluate deltas against constraints and outcomes
5. Decide next action or recommendation

---
