# `src/types` Living Specification

**Version:** 1.1.0
**Status:** done

`src/types` is the shared type vocabulary of jact: TypeScript declarations that every layer imports to agree on data shapes. It holds no runtime code. The repository spec owns the meaning of each data shape; see the [jact Living Specification](../../../../docs/spec/SPEC.md#jact%20Living%20Specification).

---

## Constitution

This module spec is the source of truth for what `src/types` owns, guarantees, and must not do. It serves contributors who add or change a shared type and reviewers who check a pull request (PR) against it. The repository spec stays the source of truth for type fields and JSON output shapes. This spec links to those facts and does not copy them.

### Spec Governance

Five rules keep this module spec canonical and small.

| Rule | Description |
|------|-------------|
| **Canonical** | When `src/types` code and this spec differ, the spec is the target; fix the code or update the spec in the same PR |
| **Living** | A PR that changes an ownership line, guarantee, or boundary of this module updates this spec in the same PR |
| **Layered** | A fact that the repository spec already holds gets one link here, never a copy |
| **Grounded** | Each claim is checked against the current source under `src/types/` |
| **Versioned** | Each change adds a version row; a removed guarantee or boundary is a major version change |

### Spec Sections

Two sections hold module facts; the other topics already live in the repository spec.

| # | Section | Status | Description |
|---|---------|:------:|-------------|
| 001 | [Vision](001-vision.md#001.%20Vision) | done | What the module is, its principles, and its guarantees |
| 002 | [Architecture](002-architecture.md#002.%20Architecture) | done | File ownership, guarantees, and boundaries |
| — | Architecture decision records (ADRs) | N/A | Repository ADRs cover type decisions |
| — | Domain model | N/A | Repository domain model owns fields |
| — | Interfaces | N/A | Types expose no user surface |
| — | Behavior | N/A | Declarations have no runtime behavior |
| — | Testing | N/A | Compiler checks; repository owns tests |

---

## Quick Reference

These summaries show what the module is, is not, and guarantees.

### What `src/types` Is

- The **data contracts** between the parser, validator, extractor, file cache, and command-line interface (CLI)
- The **strategy contract** that each extraction eligibility rule implements
- One **import point** for the dependency-injection interfaces that core components define
- The **parser vocabulary**: the token names and syntax-tree node types that jact's Markdown extensions register with the micromark parser and the mdast tree format

### What `src/types` Is Not

- Not runtime code: it holds no functions, classes, constants, or default values
- Not the documentation of type fields: the [Domain Model](../../../../docs/spec/004-domain-model.md#004.%20Domain%20Model) section owns them
- Not the owner of the dependency-injection interfaces: core component files define them, and this module re-exports them

### Core Guarantees

The vision section defines the module guarantees.
See [Core Guarantees](001-vision.md#Core%20Guarantees).

---

## Version History

Each row records one version of this module spec.

| Version | Changes |
|---------|---------|
| 1.0.0 | Initial module spec for `src/types` |
| 1.1.0 | 2026-10-07: Aligned to code; removed internal code names to reduce drift |
