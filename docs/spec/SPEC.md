# jact Living Specification

**Version:** 1.0.0-draft
**Date:** 2026-07-01
**Status:** Draft — In Progress

---

## Constitution

This specification is the **canonical source of truth** for how jact is designed to behave. It serves:

1. **New contributors / agents** — one place to understand how jact works, without diffing six component guides against the code
2. **Contributors extending the parser or validator** — clear contracts for `LinkObject`, `AnchorObject`, and the Flavor Extension Collection
3. **PR review** — a checklist target: "does the code match the spec?"
4. **Downstream consumers of the CLI** (scripts, CI, agents) — a stable description of commands, flags, JSON shapes, and exit codes

### Spec Governance

| Rule | Description |
|------|-------------|
| **Canonical** | When code and spec diverge, the spec is the target; the code needs updating (or the spec needs a same-PR update — see below) |
| **Living** | Behavior-changing PRs must update the relevant spec section in the same PR |
| **Grounded** | Every behavioral claim in this spec is checked against `src/` — no claim survives that the code doesn't back |
| **Comprehensive** | Covers every CLI surface, domain type, and validation/extraction behavior |
| **Superseding** | This spec replaces `design-docs/component-guides/` (deprecated 2026-07-01, retained for history only) |

### Spec Sections

| # | Section | Status | Description |
|---|---------|:------:|-------------|
| 001 | [Vision](001-vision.md#001. Vision) | done | What jact is, what it is not |
| 002 | [Architecture](002-architecture.md#002. Architecture) | done | Component diagram + component specs |
| 003 | [ADRs](../adrs/003-adrs.md#003. ADRs) | done | Architecture Decision Records |
| 004 | [Domain Model](004-domain-model.md#004. Domain Model) | done | Core types: LinkObject, AnchorObject, HeadingObject, etc. |
| 005 | [Interfaces](005-interfaces.md#005. Interfaces) | done | CLI commands, flags, exit codes, JSON shapes |
| 006 | [Behavior](006-behavior.md#006. Behavior) | done | Validate/extract workflows, path & anchor resolution order |
| 007 | [Testing](007-testing.md#007. Testing) | done | Test layout, conventions, TDD approach |
| 008 | [Capabilities](008-capabilities.md#008. Capabilities) | done | Feature matrix, shipped vs designed |
| 009 | [Actors](009-actors.md#009. Actors) | done | Human / LLM agent / hook / CI consumers and their constraints |
| 010 | [Integrations](010-integrations.md#010. Integrations) | done | Hook contract, agent workflows, npm link, AppMap |

**Sections deliberately omitted** (vs the 22-section headroom template — mirror the format, not the section count): compliance, deployment, disaster-recovery, governance, observability, operations, policies, security, data, diagrams, quality, migration. A local single-user CLI has no meaningful content for them today — an empty scaffold would read as coverage and hide what's actually unspecified. Add any of these the day jact grows the corresponding surface (e.g. observability if telemetry lands).

---

## Quick Reference

### What jact Is

- A **markdown citation validation and context-extraction CLI** (Node.js / TypeScript, ESM)
- A tool that parses markdown via **micromark + mdast** (not marked.js — see [002-architecture.md](002-architecture.md#MarkdownParser%20%28%60src/core/MarkdownParser/%60%29)) and validates cross-document links, wiki-links, and caret/block anchors
- A **context-extraction tool** for LLM/agent workflows: `jact extract` pulls only the cited section/file content a document actually links to, deduplicated

### What jact Is Not

- Not a general-purpose markdown linter (no prose style, no line length, no MD013-style rules)
- Not a markdown renderer — it never produces HTML or a rendered preview
- Not a full Obsidian plugin — it understands Obsidian-flavored syntax (wiki-links, block refs, `%%comments%%`) but runs standalone, outside Obsidian

### Core Guarantees

1. **Never mutates without `--fix`** — `validate` is read-only; only `--fix` writes, and always writes a timestamped `.bak` first
2. **Parse-don't-regex for markdown source** — anything that lives in markdown syntax is tokenized via a micromark/mdast extension (the Flavor Extension Collection), not re-derived with regex; regex is reserved for non-markdown strings (paths, CLI text, slugs) — see [003-adrs.md ADR-0003](../adrs/003-adrs.md#ADR-0003%20—%20Flavor%20Extension%20Collection)
3. **Single parse per file** — `ParsedFileCache` guarantees a file is parsed at most once per process, even under concurrent requests — see [002-architecture.md](002-architecture.md#ParsedFileCache%20%28%60src/ParsedFileCache.ts%60%29)
4. **Deterministic exit codes** — `0` success, `1` validation/extraction failure, `2` system error — consistent across `validate`, `ast`, and `extract`

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0-draft | 2026-07-01 | Initial living spec, replacing `design-docs/component-guides/` |
