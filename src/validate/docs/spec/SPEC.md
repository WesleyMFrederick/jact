# validate Module Living Specification

**Version:** 1.2.0
**Status:** done

The `src/validate/` module runs the `jact validate` workflow for one file or many files and reports the result. It orchestrates link checks and enabled validation rules and writes no files. This spec covers what the module owns and the rules it must keep. The repo spec owns the command-line interface (CLI) contract and the step order.

---

## Constitution

This spec is the module-level layer under the [jact Living Specification](../../../../docs/spec/SPEC.md#jact%20Living%20Specification). It states module ownership, guarantees, and boundaries. It links to the repo spec for every fact that the repo spec holds.

### Spec Governance

Four rules keep this spec canonical and small.

| Rule | Description |
|------|-------------|
| **Canonical** | When code and this spec differ, the spec is the target. Fix the code, or update the spec in the same pull request (PR). |
| **Living** | A PR that changes module behavior updates this spec in the same PR. |
| **Layered** | Repo governance applies here: see [Spec Governance](../../../../docs/spec/SPEC.md#Spec%20Governance). This spec never restates a repo-spec fact. |
| **Versioned** | Each change increments the version. A broken guarantee is a major version change. |

### Spec Sections

Two sections are done; the other topics belong to the repo spec.

| # | Section | Status | Description |
|---|---------|:------:|-------------|
| 001 | [Vision](001-vision.md#001.%20Vision) | done | What the module is, what it is not, its guarantees |
| 002 | [Architecture](002-architecture.md#002.%20Architecture) | done | One component per file, guarantees, boundaries |
| — | ADRs | N/A | Batch decisions live in [feature ADR](../../../../design-docs/features/20260701T041917-batch-validate/spec/003-adrs.md#Decision) |
| — | Interfaces | N/A | Repo spec owns CLI contract |
| — | Behavior | N/A | Repo spec owns workflow order |
| — | Domain model | N/A | Shared types live in `src/types/` |
| — | Testing | N/A | Architecture names each enforcing test |

---

## Quick Reference

These links point to the facts that a reader of this module needs first.

| Need | Canonical source |
|------|------------------|
| Flags, mode selection, output shapes | [`jact validate`](../../../../docs/spec/005-interfaces.md#%60jact%20validate%60) |
| Presets, configuration, and plugins | [Validation configuration and presets](../../../../docs/spec/005-interfaces.md#Validation configuration and presets) |
| Single-file step order | [Validate Workflow (single file)](../../../../docs/spec/006-behavior.md#Validate%20Workflow%20(single%20file)) |
| Batch step order | [Validate Workflow (batch)](../../../../docs/spec/006-behavior.md#Validate%20Workflow%20(batch)) |
| Exit codes | [Exit Codes](../../../../docs/spec/005-interfaces.md#Exit%20Codes) |
| Module guarantees | [Core Guarantees](001-vision.md#Core%20Guarantees) |

---

## Change Log

The module spec is at version 1.2.0.

| Version | Changes |
|---------|---------|
| 1.0.0 | First module spec: vision and architecture |
| 1.1.0 | 2026-10-07: Aligned to code; removed internal code names to reduce drift |
| 1.2.0 | 2026-10-09: Added rule orchestration and canonical configuration reference |
