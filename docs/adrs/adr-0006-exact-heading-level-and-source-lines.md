## ADR-0006 — Exact heading-level filtering and source lines

**Context:** The positional H-level is an inclusive ceiling, so selecting only H3 headings currently requires a second search. The [delta design](../../design-docs/features/20260714T184423-jact-outline-cli/jact-outline-cli-delta-design.md#Recommendation) records the evidence and alternatives.

**Decision:** Keep `outline`. Add `--exact-heading-level HN` and `--line-number` with `-n`. Preserve positional H-level semantics. Source lines come from parser-derived, one-based positions.

**Rationale:** Self-contained flags avoid ambiguous meanings, preserve one human-and-agent command surface, and follow established CLI conventions without adding an unneeded range language.

**Consequences:** Existing output is unchanged unless a new flag is supplied. Exact-level orientation becomes one deterministic call. Missing source positions fail clearly. Help and tests must cover filtering, numbering, combined flags, and unchanged defaults.

---
