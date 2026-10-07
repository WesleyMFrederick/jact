# `src/core` Living Specification

**Version:** 1.1.0
**Status:** done

`src/core` is the domain layer of jact: it parses Markdown, checks links, extracts linked content, and plans or applies file edits. It has no command registration, no output formatting, and no exit codes. Those belong to the command-line interface (CLI) layer in the [jact Living Specification](../../../../docs/spec/SPEC.md#jact%20Living%20Specification).

---

## Constitution

This module spec is the source of truth for what `src/core` owns, guarantees, and must not do. It serves contributors who change a core component and reviewers who check a pull request (PR) against it. The repository spec stays the source of truth for CLI flags, data types, and step-by-step workflows; this spec links to those facts and does not copy them.

### Spec Governance

Five rules keep this module spec canonical and small.

| Rule | Description |
|------|-------------|
| **Canonical** | When `src/core` code and this spec differ, the spec is the target; fix the code or update the spec in the same PR |
| **Living** | A PR that changes a core ownership line, guarantee, or boundary updates this spec in the same PR |
| **Layered** | A fact that the repository spec already holds gets one link here, never a copy |
| **Grounded** | Each claim is checked against the current source under `src/core/` |
| **Versioned** | Each change adds a version row; a removed guarantee or boundary is a major version change |

### Spec Sections

Two sections hold module facts; the other topics already live in the repository spec.

| # | Section | Status | Description |
|---|---------|:------:|-------------|
| 001 | [Vision](001-vision.md#001.%20Vision) | done | What core is, its principles, and its guarantees |
| 002 | [Architecture](002-architecture.md#002.%20Architecture) | done | Component ownership, guarantees, and boundaries |
| — | ADRs | N/A | Repository ADRs cover core decisions |
| — | Domain model | N/A | Repository domain model owns types |
| — | Interfaces | N/A | Core exposes no user surface |
| — | Behavior | N/A | Repository behavior section owns workflows |
| — | Testing | N/A | Repository testing section owns conventions |

---

## Quick Reference

These summaries show what core is, is not, and guarantees.

### What `src/core` Is

- The **parser**: Markdown text to a typed parser output, through one micromark extension set
- The **checker**: each parsed link to a valid, warning, or error result
- The **extractor**: linked sections, blocks, and files to deduplicated content
- The **editors**: `--fix` citation repair and `jact rename` move planning, the only code that writes user files

### What `src/core` Is Not

- Not a CLI: it never parses arguments, picks an exit code, or formats a report
- Not a wiring layer: the component factory in `src/factories/` builds and connects the components
- Not a cache owner: the file index (`src/FileCache.ts`) and the parsed-document cache (`src/ParsedFileCache.ts`) sit outside core and are injected

### Core Guarantees

The vision section defines the module guarantees.
See [Core Guarantees](001-vision.md#Core%20Guarantees).

---

## Version History

Each row records one version of this module spec.

| Version | Changes |
|---------|---------|
| 1.0.0 | Initial module spec for `src/core` |
| 1.1.0 | 2026-10-07: Aligned to code; removed internal code names to reduce drift |
