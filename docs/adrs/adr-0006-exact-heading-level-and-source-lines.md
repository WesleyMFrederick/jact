---
last_verified: 2026-11-19
verified_by: agent
---
## ADR-0006 — Exact heading-level filtering and source lines

**Status:** Accepted. Implemented with tests in [`58b4889`](https://github.com/WesleyMFrederick/jact/commit/58b48898d89753097917b51553e3486fca12c612). Indexed in [003. ADRs](003-adrs.md#003.%20ADRs).

**Context:** The positional H-level is an inclusive ceiling, so selecting only H3 headings currently requires a second search. The delta design that records the evidence and alternatives is local-only and not tracked in Git (`design-docs/features/20260714T184423-jact-outline-cli/jact-outline-cli-delta-design.md`, section "Recommendation"); the tracked contract is [`jact outline <file> [level]`](../spec/005-interfaces.md#%60jact%20outline%20%3Cfile%3E%20level%20%60).

**Decision:** Keep `outline`. Add `--exact-heading-level HN` and `--line-number` with `-n`. Preserve positional H-level semantics. Source lines come from parser-derived, one-based positions.

**Rationale:** Self-contained flags avoid ambiguous meanings, preserve one human-and-agent command surface, and follow established CLI conventions without adding an unneeded range language.

**Consequences:** Existing output is unchanged unless a new flag is supplied. Exact-level orientation becomes one deterministic call. Missing source positions fail clearly. Help and tests must cover filtering, numbering, combined flags, and unchanged defaults.

---
