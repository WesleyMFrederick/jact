# Extract --format markdown — Whiteboard

> **Change:** extract-format-markdown
> **Domain:** CLI / Extract commands
> **Date:** 2026-03-16

## Original Request

[OBS-001: GH issue #23](https://github.com/WesleyMFrederick/jact/issues/23) [^S-001]
^OBS-001

```
feat(extract): add --format markdown output for skill injection use case.
jact extract header outputs JSON by default, which includes metadata alongside
the extracted content. When used inside Claude Code skills via !`command` dynamic
injection syntax, the agent receives JSON it must parse. The actual markdown content
is buried in .extractedContentBlocks.<id>.content. A --format markdown flag should
output only the extracted markdown content, no JSON wrapper.
```

[G-001: enable raw markdown output from jact extract commands for Claude Code skill injection] [^S-001]
^G-001

---

## Evidence Glossary

![Ontology Tag Types Table](../../../EVIDENCE-ONTOLOGY.md#Ontology%20Tag%20Types%20Table)%% force-extract %%

---

## Artifacts Investigated

### CLI & Orchestration
- [jact.ts CLI entry point](../../../src/jact.ts) — CLI command definitions (lines 1170-1341), orchestrator methods (lines 439-613)
- [jact.ts extract header action](../../../src/jact.ts:1252-1284) — header CLI action, outputs JSON via `console.log(JSON.stringify(result))`
- [jact.ts extract file action](../../../src/jact.ts:1307-1329) — file CLI action, same JSON output pattern
- [jact.ts extract links method](../../../src/jact.ts:467-518) — links orchestrator, JSON output at line 504

### Types
- [contentExtractorTypes.ts](../../../src/types/contentExtractorTypes.ts) — `OutgoingLinksExtractedContent` (line 95), `CliExtractOptions` (line 119), `ExtractedContentBlock` (line 44)

### Consumers / Hooks
- Claude Code skill `!`jact extract header ...`` injection syntax — consumes stdout directly

---

## Baseline Bucket

### Baseline Observations

1. [OBS-002: three extract subcommands share output pattern] [^S-002] `header`, `file`, and `links` all serialize `OutgoingLinksExtractedContent` as JSON to stdout ^OBS-002
2. [OBS-003: header/file output at CLI action level] [^S-003] header (line 1272) and file (line 1318) call `console.log(JSON.stringify(result))` in the CLI action handler ^OBS-003
3. [OBS-004: links output inside orchestrator] [^S-004] `extractLinks()` calls `console.log(JSON.stringify(extractionResult))` at line 504 — output is inside the method, not the CLI action ^OBS-004
4. [OBS-005: CliExtractOptions.format already exists but is unused] [^S-005] `format?: string` defined at line 121 but no branching logic consumes it ^OBS-005
5. [OBS-006: content blocks keyed by SHA hash] [^S-006] `extractedContentBlocks` uses content hash as key, with `_totalContentCharacterLength` as metadata entry. Each block has `.content` (string), `.contentLength`, `.sourceLinks` ^OBS-006
6. [OBS-007: CLI --format options are decorative] [^S-007] all three subcommands define `--format <type>` with default "json" but no handler branches on the value ^OBS-007
7. [OBS-009: each extract method has exactly 1 caller] [^S-008] LSP `findReferences`: `extractHeader` called at jact.ts:1263 only, `extractFile` at jact.ts:1313 only, `extractLinks` at jact.ts:1217 only ^OBS-009
8. [OBS-010: CliExtractOptions in types file is dead export] [^S-009] LSP `findReferences` on types:119 returns 0 external refs — the local interface at jact.ts:70 is what all 7 call sites use ^OBS-010
9. [OBS-011: OutgoingLinksExtractedContent used in 4 files, 11 refs] [^S-010] LSP `findReferences`: types:95, extractLinksContent.ts (3 refs), ContentExtractor.ts (4 refs), jact.ts (3 refs) — core return type ^OBS-011

### Baseline Questions

1. ~~[Q-001: should extractLinks also support --format markdown?]~~ [^S-001] **Resolved** — scope is `extract header` only. Default output for `extract header` changes to markdown. `extract links` and `extract file` unchanged. ^Q-001

### Baseline Facts-Locked

1. [F-LK-001: ExtractedContentBlock.content is type string] [^S-006] the `.content` field is always a string containing raw markdown ^F-LK-001

### Baseline Outcomes

1. [O-B1: skill authors assemble raw content from structured output using external tooling] [^S-003] three `console.log(JSON.stringify(...))` call sites produce full JSON — skills must pipe through `jq` to extract `.content` ^O-B1
2. [O-B2: jact extract shows everything to everyone] [^S-005] [^S-007] `OutgoingLinksExtractedContent` is the sole output type; `CliExtractOptions.format` defined but unused — one shape, no consumer differentiation ^O-B2

### Baseline → Source Mapping

| # | Baseline Outcome | Source | Baseline Notes |
|---|-----------------|--------|----------------|
| 1 | [O-B1](#^O-B1) | `src/jact.ts` lines 1270-1272 (header), 1316-1318 (file), 504 (links) | Three `console.log(JSON.stringify(...))` call sites produce full JSON |
| 2 | [O-B2](#^O-B2) | `src/types/contentExtractorTypes.ts` lines 95-102; `src/jact.ts` line 72 | Single output type `OutgoingLinksExtractedContent`; `format` field defined but unused |

---

## Ideal Bucket

### Ideal Observations

1. [OBS-008: desired output matches jq pipe] [^S-001] The target output is exactly what `jq -r '.extractedContentBlocks | to_entries[] | select(.value | type == "object") | .value.content'` produces — raw markdown content only ^OBS-008

### Ideal Constraints

1. ~~[C-001: default format must remain JSON]~~ [^S-001] **Corrected** — `extract header` default changes TO markdown. GH issue AC is superseded by user decision: markdown is the default for `extract header`. `extract links` and `extract file` defaults unchanged (JSON). ^C-001
2. [C-002: multiple blocks separated by ---] [^S-001] AC says: "Multiple content blocks concatenated in extraction order with `---` separator" ^C-002

### Ideal Assumptions

1. ~~[A-001: format logic belongs in CLI action, not orchestrator methods]~~ [^S-003] **Confirmed by LSP** — OBS-009 shows each method has exactly 1 caller (CLI action). For header/file, format branching goes in CLI action. For links, extractLinks must return result instead of printing (refactor needed per Q-002). ^A-001

### Ideal Outcomes

1. [O-I1: skill authors get just enough context, just in time] [^S-001] raw markdown content directly from `jact extract` — no jq, no JSON parsing, no metadata overhead ^O-I1
2. [O-I2: jact extract speaks each caller's language] [^S-001] role-specific output matched to consumer needs — JSON for pipelines, markdown for skill injection ^O-I2

### Ideal Questions

### Ideal Decisions

1. [D-001: change `extract header` default output to raw markdown] [^S-001] Scope: `extract header` only. Default flips from JSON to markdown. `--format json` available for callers who need the full metadata. Based on: OBS-007 (format plumbing exists), Q-001 resolved (header only), G-001 (skill injection goal) ^D-001

---

## Delta Bucket

### Delta Potential Decisions

1. [D-002: add formatExtractResult helper function] Based on: OBS-003 (two CLI actions share pattern), OBS-004 (links differs) — a shared formatter avoids triple duplication ^D-002
2. [D-003: promote CliExtractOptions to canonical type, delete local copy in jact.ts:70] Based on: OBS-010 (dead export with 0 refs), ^one-source-of-truth, ^illegal-states-unrepresentable — refactor jact.ts:70 local interface to import from contentExtractorTypes.ts. Update format field to `"markdown" | "json"` union (parse, don't validate). Architecture principles are non-negotiable. ^D-003

### Delta Hypotheses

1. ~~[H-001: change touches only CLI layer, no core component changes needed]~~ [^S-008] **Confirmed by LSP** — `findReferences` on `OutgoingLinksExtractedContent` shows core components (ContentExtractor, extractLinksContent) return the type unchanged. Format conversion is a pure projection of `.extractedContentBlocks[id].content` — no core changes needed. ^H-001
2. ~~[H-002: extract header always returns exactly one content block]~~ [^S-003] **Confirmed by test** — `extractHeader` passes `[enrichedLink]` (single-element array) to `ContentExtractor.extractContent`. Loop processes 1 link → 1 block. Nested citations in extracted content are preserved verbatim, not followed. The `---` separator logic in C-002 is dead code for `extract header`. Test: `test/cli-integration/extract-header-block-count.test.ts` (3 cases: simple header, nested citations, verbatim preservation). ^H-002

### Delta Outcomes

1. [O-D1: skill authors request just the content they need in one call] bridges O-B1 → O-I1 ^O-D1
2. [O-D2: jact extract gives each caller only what they need] bridges O-B2 → O-I2 ^O-D2

### Delta Questions

1. [Q-002: the `extract links` command prints its output from the wrong place] [^S-004] ^Q-002
   - Today, `extract header` and `extract file` return data to the command handler, which decides how to print it. But `extract links` prints directly from inside the business logic. This means we can't add format switching to `extract links` without either duplicating the format logic or refactoring where printing happens.
   - Strengthen: check if any tests depend on the current print location
   - Utility: M — needed only if we later add `--format markdown` to `extract links`
   - Cost: M — touches tests that assert on stdout
   - DRI: Agent
   - **Not blocking for this change** — Q-001 resolved: scope is `extract header` only

### Delta Folder Map

```
src/
  jact.ts                              ← REUSE — add format branching in extract header CLI action (lines 1252-1284)
                                         REUSE — update extract header -h help text: default "markdown", choices ["markdown", "json"]
                                         REFACTOR (D-003) — delete local CliExtractOptions interface (line 70), import from contentExtractorTypes.ts
  types/
    contentExtractorTypes.ts           ← REUSE — update CliExtractOptions.format to `"markdown" | "json"` union (D-003: promote to canonical)
  core/
    ContentExtractor/
      ContentExtractor.ts              ← UNTOUCHED — returns OutgoingLinksExtractedContent unchanged
      extractLinksContent.ts           ← UNTOUCHED — returns OutgoingLinksExtractedContent unchanged
    MarkdownParser/                    ← UNTOUCHED — no output formatting concern
  factories/                           ← UNTOUCHED — no output formatting concern
design-docs/
  component-guides/
    CLI Architecture Overview.md       ← UPDATE — document extract header default format change and --format json opt-in
    ContentExtractor Component Guide.md ← REVIEW — verify no output formatting references need updating
test/
  unit/                                ← ADD — format markdown tests
  integration/                         ← ADD — CLI --format markdown end-to-end tests
```

### Delta LSP Commands (run before coding)

```
# Confirm callers of every function being modified
LSP findReferences: jact.ts:557 (extractHeader)
LSP findReferences: jact.ts:650 (extractFile)
LSP findReferences: jact.ts:467 (extractLinks)

# Confirm safe scope for format helper — no existing formatExtract* functions
LSP workspaceSymbol: "format" (check for naming collisions)

# Confirm domain type shapes for function signatures
LSP documentSymbol: contentExtractorTypes.ts (OutgoingLinksExtractedContent, ExtractedContentBlock, CliExtractOptions)
```

### BDI Summary Table

| # | Baseline [O] | Delta [O] | Ideal [O] |
|---|-------------|-----------|-----------|
| 1 | [O-B1](#^O-B1) Skill authors assemble raw content from structured output using external tooling | [O-D1](#^O-D1) Skill authors request just the content they need in one call | [O-I1](#^O-I1) Skill authors get just enough context, just in time |
| 2 | [O-B2](#^O-B2) jact extract shows everything to everyone | [O-D2](#^O-D2) jact extract gives each caller only what they need | [O-I2](#^O-I2) jact extract speaks each caller's language |

---

## Next Best Actions Prioritization Table

### Tier 1 — High utility, blocks design

| # | Item | Utility | Cost | DRI | Status |
|---|------|---------|------|-----|--------|
| 1 | ~~[Q-001](#^Q-001) (scope: all 3 subcommands or just header?)~~ | Medium | Low | User | **Resolved** — header only, default to markdown |
| 2 | ~~[A-001](#^A-001) (format logic in CLI vs orchestrator)~~ | High | Low | Agent | **Resolved** — confirmed CLI layer |
| 3 | ~~[H-002](#^H-002) (does extract header ever return multiple blocks?)~~ | High | Low | Agent | **Resolved** — confirmed always 1 block, tested |

### Tier 2 — Medium utility, informs implementation

| # | Item | Utility | Cost | DRI | Status |
|---|------|---------|------|-----|--------|
| 4 | ~~[H-001](#^H-001) (CLI-only change, no core changes)~~ | High | Low | Agent | **Resolved** — confirmed by LSP |
| 5 | [D-003](#^D-003) (promote CliExtractOptions to canonical) | High | Low | Agent | **Decided** — architecture principles non-negotiable, parse don't validate |

### Tier 3 — Low utility, defer

| # | Item | Utility | Cost | DRI | Status |
|---|------|---------|------|-----|--------|
| 6 | [Q-002](#^Q-002) (extract links prints from wrong place) | Medium | Medium | Agent | Deferred — not blocking, header-only scope |

---

## Evidence Source Paths

[^S-001]: `gh issue view 23` — GH issue #23 body
[^S-002]: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts:467-518` — extractLinks method
[^S-003]: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts:1252-1284` — extract header CLI action
[^S-004]: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts:504` — extractLinks console.log
[^S-005]: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/types/contentExtractorTypes.ts:119-123` — CliExtractOptions
[^S-006]: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/types/contentExtractorTypes.ts:44-48` — ExtractedContentBlock
[^S-007]: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts:1179,1237,1291` — --format option definitions
[^S-008]: LSP `findReferences` on `extractHeader` (jact.ts:557), `extractFile` (jact.ts:650), `extractLinks` (jact.ts:467) — each has exactly 1 caller
[^S-009]: LSP `findReferences` on `CliExtractOptions` (contentExtractorTypes.ts:119) — 0 external references, dead export
[^S-010]: LSP `findReferences` on `OutgoingLinksExtractedContent` (contentExtractorTypes.ts:95) — 11 refs across 4 files
