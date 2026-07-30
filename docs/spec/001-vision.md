# 001. Vision

**Status:** done

## What jact Is

jact ("Just Another Context Tool") is a **markdown citation validation and context-extraction CLI**, written in strict TypeScript (ESM, Node.js). It has two jobs:

1. **Validate** — check that every cross-document link, wiki-link, and anchor reference in a markdown file resolves to something real: a file that exists, a heading that exists, a block reference that exists.
2. **Extract** — given a validated document, pull only the content its links actually point to (a section, a block, or a whole file), deduplicated, so an LLM/agent consuming the document gets the cited content without re-reading everything by hand.

It parses markdown with **micromark + mdast** (`mdast-util-from-markdown`), not a regex scanner and not `marked.js` — see [002-architecture.md](002-architecture.md#MarkdownParser%20%28%60src/core/MarkdownParser/%60%29) for the parser and [003-adrs.md](../adrs/003-adrs.md#ADR-0002%20—%20Regex%20→%20mdast-token%20migration%20%28WMF-35%29) for why. 

[ADR-0002 — Regex → mdast-token migration (WMF-35)](../adrs/003-adrs.md#ADR-0002%20—%20Regex%20→%20mdast-token%20migration%20%28WMF-35%29)

### Core Value Proposition

1. **Catch broken citations before they rot** — a link to a renamed file or deleted heading fails `jact validate` instead of silently 404ing for the next reader
2. **Auto-fix mechanical breakage** — `--fix` repairs path drift (file moved) and anchor drift (heading reworded) without a human re-typing the link
3. **Context extraction for agents** — `jact extract` gives a coding agent exactly the cited section/file content instead of dumping full documents into context
4. **Obsidian-compatible, not Obsidian-locked** — understands wiki-links, block refs (`^id`), and `%%comments%%` but runs standalone from any shell or CI job

### What jact Is Not

- **Not a prose linter** — no style rules, no line-length checks, no MD013-style formatting linting
- **Not a renderer** — never produces HTML; it only reads and (with `--fix`) rewrites markdown source
- **Not an Obsidian plugin** — runs outside Obsidian, with no dependency on the Obsidian runtime
- **Not a general markdown-to-AST library** — the parser's extension set (the Flavor Extension Collection, see [002-architecture.md](002-architecture.md#MarkdownParser%20%28%60src/core/MarkdownParser/%60%29)) is scoped to what jact's own citation/anchor syntax needs, not a general-purpose CommonMark+GFM+Obsidian parser

---

## Design Principles

### 1. Parse, Don't Regex, for Markdown Source

**Principle:** Anything that lives in markdown syntax gets a micromark/mdast extension; regex is reserved for strings that are *not* markdown documents (file paths, CLI error text, slugs, synthetic anchor strings).

**Implications:**
- Citation links, wiki-links, caret/block anchors, `==highlights==`, and `%%comments%%` are each a dedicated micromark syntax + mdast `fromMarkdown` extension, grouped by flavor in `src/core/MarkdownParser/extensions/flavors.ts`
- Heading line numbers come from `node.position` on the mdast tree, not a regex re-find (see `HeadingObject.position` in [004-domain-model.md](004-domain-model.md#HeadingObject))
- Regex still governs: path/URL string shape checks, CLI error-message parsing, filename typo correction, and synthetic `LinkObject`s built from CLI arguments that never pass through the parser
- A small number of residual regex sites remain, documented as known debt — see [003-adrs.md Known Tech Debt](../adrs/003-adrs.md#Known%20Tech%20Debt)

### 2. Single Parse Per File

**Principle:** A given markdown file is parsed at most once per process run, even when multiple validations reference it concurrently.

**Implications:**
- `ParsedFileCache` caches the parse **Promise**, not the resolved value, so concurrent `resolveParsedFile()` calls for the same path share one in-flight parse
- Validating file A, which cites file B, which is also being validated directly, never triggers two parses of B

### 3. Read-Only by Default

**Principle:** `jact validate` never mutates a file. Only `--fix` writes, and it always writes a timestamped `.bak` backup first.

**Implications:**
- `--dry-run` (only meaningful with `--fix`) prints the would-be diff without touching disk
- Path-conversion fixes require an explicit `--scope` (the tool won't guess a resolution folder when correcting a broken path)

### 4. Composable, Scriptable Defaults

**Principle:** Exit codes and output formats are stable enough to drop into CI or a pre-commit hook without a wrapper script.

**Implications:**
- Deterministic exit codes: `0` success, `1` validation/extraction failure, `2` system/usage error — see [005-interfaces.md](005-interfaces.md#Exit%20Codes)
- `--format json` (single-file) and `--json` (batch, JSONL) give machine-readable output alongside human-readable default output
- Smart scope defaults (walk up from cwd, then target file, looking for `.git`/`.obsidian`/`package.json`) mean most invocations need no `--scope` flag at all

---

## Core Guarantees

| Guarantee | Description |
|-----------|-------------|
| **Never mutates without `--fix`** | `validate`, `ast`, `extract` are read-only |
| **Backup before write** | `--fix` always writes a `.bak` before modifying the target file |
| **Deterministic exit codes** | `0`/`1`/`2` consistent across `validate`, `ast`, `extract` |
| **Single parse per file** | `ParsedFileCache` promise-caches by absolute path |
| **Original objects never mutated** | `EnrichedLinkObject` is built via object spread over `LinkObject`, never in-place mutation — see [004-domain-model.md](004-domain-model.md#ValidationMetadata%20/%20EnrichedLinkObject) |
| **Type-safe** | Strict TypeScript: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns` |

---

## Target Users

| User | Use Case |
|------|----------|
| **Vault/docs maintainer** | Catch broken cross-links after renaming or moving files |
| **CI pipeline** | `jact validate --changed --json` gates a PR on citation integrity |
| **Coding agent / LLM workflow** | `jact extract header`/`extract links` pulls only cited content instead of whole files |
| **Pre-commit hook** | Single-file or batch `validate` blocks a commit with broken citations |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0-draft | 2026-07-01 | Initial vision document, replacing component-guides narrative |
