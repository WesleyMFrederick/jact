%% hardening: exempt-defer-language — pre-pipeline-lock baseline %%

# Plan: jact Wikilink Validation Support

%% *Last Modified: 05/02/26 09:01:08* %%

*Created: 05/02/26 08:59*

## 1. Critical Instructions

%% *Last Modified: 05/02/26 09:01:08* %%

**Output routing:**
- All phase outputs (findings, BI table, source mapping, architecture, DIFFs) write to THIS plan file
- Chat window: hard gate prompts, numbered options, status only
- CRITICAL INSTRUCTION: Run `/continuous-learning` skill
- CRITICAL INSTRUCTION: Write skill output to this plan file

[C]: Do not output plan content to chat window
[C]: Output chat window content ONLY to chat window, not to plan

### Type I/II Decision Guide

%% *Last Modified: 05/02/26 09:01:08* %%

| Type | Action | Examples |
|------|--------|----------|
| Type I (irreversible) | HARD GATE — USER decides | Locking sections, scope changes, framework selection |
| Type II (reversible) | AGENT executes autonomously | Research, file reads, analysis, building tables, writing to plan |

### Domain Vocabulary

%% *Last Modified: 05/02/26 09:01:08* %%

| Term | Definition |
|------|-----------|
| BID | Baseline / Ideal / Delta — the three transformation buckets |
| [O] outcome | A JTBD outcome statement: actor + capability, no tool/data references |
| Wikilink | Obsidian-flavored markdown link `[[target\|display]]` or `[[target]]` |
| Markdown link | Standard markdown link `[display](path)` |
| Silent failure | A bug that produces plausible-looking output but is wrong (no loud error) |
| AST | Abstract Syntax Tree — the parsed representation of markdown produced by `marked.js` |
| Block anchor | An Obsidian anchor of form `^anchor-id` placed at end of block |
| Caret syntax | Citation reference of form `^FR1`, `^US1-1AC1` |
| Wiki vault | An Obsidian-style markdown collection that uses `[[wikilinks]]` for cross-references |

## 2. Context

%% *Last Modified: 05/02/26 09:01:08* %%

**What is being changed:** The `jact validate` command and its internal parser/validator pipeline (`MarkdownParser`, `CitationValidator`, `LinkObjectFactory`).

**Why:** `jact validate` only parses `[markdown](links)` produced by `marked.js`. Obsidian-flavored `[[wikilinks]]` are invisible to the parser. When LLM agents auto-run `jact validate` after editing wiki-style Obsidian vaults, broken wikilinks pass silently — the worst kind of error (false negative dressed as success).

**Session friction summary:** A wiki concept file containing 10 wikilink occurrences (some broken) returns "OK: 42 citations valid" with `--verbose` showing only standard markdown caret-syntax citations. The 7 broken wikilinks never enter the validation pipeline. Per `the-hardening-principle`, this is a deterministic system failing silently — exactly the failure mode hardened tools must avoid.

**Entry point:** Baseline problem (concrete CLI reproduction provided)

## 3. Artifacts Table

%% *Last Modified: 05/02/26 09:01:08* %%

| Artifact | Path | Role |
|----------|------|------|
| Baseline reproduction file | `0-documents/llm-wiki/wiki/concepts/probabilistic-vs-deterministic-systems.md` | Live evidence of false-negative validation; contains 10 wikilink occurrences |
| jact CLI entry point | `jact/src/jact.ts` | Command orchestration; routes `validate` subcommand |
| Markdown parser | `jact/src/core/MarkdownParser/MarkdownParser.ts` | Produces AST via `marked.js`; entry point for what jact "sees" |
| Citation validator | `jact/src/CitationValidator.ts` | Link/anchor validation logic |
| Link object factory | `jact/src/factories/LinkObjectFactory.ts` | Constructs `LinkObject` instances from parsed nodes |
| Citation type definitions | `jact/src/types/citationTypes.ts` | Type definitions for citation/link shapes |
| Validation type definitions | `jact/src/types/validationTypes.ts` | Validation report type definitions |
| Project CLAUDE.md | `jact/CLAUDE.md` | Architecture overview, citation patterns supported, exit codes |
| ARCHITECTURE-Citation-Manager.md | `jact/design-docs/ARCHITECTURE-Citation-Manager.md` | C4 model for the system |
| MarkdownParser component guide | `jact/design-docs/component-guides/MarkdownParser-Implementation-Guide.md` | Implementation contract for parser |
| CitationValidator component guide | `jact/design-docs/component-guides/CitationValidator-Implementation-Guide.md` | Implementation contract for validator |
| The Hardening Principle | `0-documents/llm-wiki/wiki/concepts/the-hardening-principle.md` | Root principle: silent failure is the most expensive failure mode |

## 4. Phase 1 — Findings

%% *Last Modified: 05/02/26 09:01:08* %%

| ID | Pattern Found | Scope | Trigger | Friction Caused |
|----|--------------|-------|---------|-----------------|
| F1 | `jact validate` reports "OK: 42 citations valid" on a file with 10 wikilink occurrences (≥7 broken) | Global to all `validate` invocations on Obsidian-style files | User or LLM agent runs `jact validate <wiki-file>.md` | Broken wikilinks pass undetected; downstream agents trust the green check and ship broken cross-references |
| F2 | Verbose mode (`--verbose`) lists 42 caret-syntax citations only — wikilinks never appear in the validation report | Reporting layer | User adds `--verbose` to investigate | False sense of completeness; user cannot tell that a class of links was skipped entirely |
| F3 | Wikilink syntax is documented in `CLAUDE.md` as "supported" (`[[#anchor\|Text]]`) but only the `#anchor` (caret) form is actually parsed; the `[[target]]` and `[[target\|display]]` forms are invisible | Documentation vs. implementation | LLM agent reads `CLAUDE.md`, assumes wikilink coverage exists, runs `validate` and trusts the result | Documentation drift: claimed capability does not match implemented capability; agents act on stale contract |
| F4 | LLM agents auto-run `jact validate` as a post-edit safety check; with wikilinks invisible, the safety check provides false confidence | LLM agent workflows touching Obsidian vaults | Any AI/LLM editing a wiki file and running its standard "verify" step | Silent failure mode — per the hardening principle, the most expensive class of failure because trust erodes only after wrong content has propagated |
| F5 | The bug shape is "wrong kind of error" — silent pass instead of loud fail | Architectural / failure-mode level | Wikilink class of input is unrecognized by parser → returns no nodes → no citations to validate → success | Violates the Hardening Principle: deterministic tools should fail loudly with a stack trace, not succeed with omission |

### Hardcoded References Audit

%% *Last Modified: 05/02/26 09:01:08* %%

| Line(s) | What's hardcoded | Issue |
|---------|-----------------|-------|
| `CLAUDE.md` "Citation Patterns Supported" section | `[[#anchor\|Text]]` listed as supported wiki-style | Misleading — only the embedded `#anchor` form works; bare `[[target]]` and `[[target\|display]]` forms are unparseable |

## 5. Phase 2 — Baseline Ideal Outcomes Table
#LOCKED

%% *Last Modified: 05/02/26 15:46:52* %%

| # | Actor | Baseline [O] | Ideal [O] |
|---|-------|-------------|-----------|
| BI-1 | Validator user (human or LLM agent) | Validator user can identify broken standard markdown links in a file | Validator user can identify broken links of any supported syntax in a file (markdown, wikilink, caret), with no class of link silently skipped |
| BI-2 | Validator user | Validator user can review a per-file report listing every link the validator processed | Validator user can review a per-file report that distinguishes which classes of links were processed and which were not, so they can detect silent skip behavior |
| BI-3 | LLM agent running validate as a post-edit safety check | LLM agent receives a "valid" verdict that reflects only a subset of link classes in the file | LLM agent receives a verdict whose scope matches the file's link inventory, so a green result is trustworthy across the full link surface |
| BI-4 | Wiki maintainer | Wiki maintainer can confirm cross-references in a wiki vault stay correct as pages are renamed or removed, for the markdown-link subset | Wiki maintainer can confirm cross-references stay correct across the entire link surface of the vault, including wikilinks, so renames and removals never produce dangling references undetected |
| BI-5 | Author of a wiki file | Author can see which links they wrote in markdown form fail to resolve | Author can see which links they wrote in any supported syntax fail to resolve, so the choice of link syntax does not change which errors are surfaced |
| BI-6 | Tool integrator (CLAUDE.md reader) | Tool integrator can read a list of supported citation patterns and trust that listed patterns are validated | Tool integrator can read a list of supported citation patterns and trust that listed patterns are validated identically, with no documentation-implementation gap on coverage |
| BI-7 | Validator user (human or LLM agent) | Validator user can use `[[wikilinks]]` with a different service level than `[markdown](links)` (e.g., code-block content flagged as false positives, silent skips possible, no explicit broken-link reason) | Validator user can use `[[wikilinks]]` with the same service level as `[markdown](links)`: same false-positive rate (code-block content not flagged for either), same false-negative rate (neither silently skipped), same loud-fail behavior on broken links (explicit `tried: ...` reasons surfaced), and same validator integration (pre-resolved paths consumed by validator) |

---

## 6. Phase 4: Source Mapping
#LOCKED

%% *Last Modified: 05/02/26 09:17:46* %%

### Findings from research

%% *Last Modified: 05/02/26 09:08:30* %%

- **Wikilink extraction code paths exist but are too narrow.** `extractWikiCrossDocLinks` (extractLinks.ts:420-457) requires `.md` extension AND `|display`. `extractWikiInternalLinks` (extractLinks.ts:463-499) requires `#anchor` AND `|display`. Bare `[[Page Name]]`, `[[Page Name|Display]]` (no `.md`), `[[page-slug]]`, and `[[Page Name#section]]` (no `.md`) all silently skip extraction.
- **Validator has wiki support already.** `CitationValidator.classifyPattern` (CitationValidator.ts:313-319) routes `linkType: "wiki"` to `WIKI_STYLE` (internal) or `CROSS_DOCUMENT` (cross-doc). Code path is live — parser just isn't feeding it.
- **Type union already includes `wiki`.** `LinkObject.linkType` (citationTypes.ts:29) is `"markdown" | "wiki"`. No type changes required.
- **`marked.lexer()` does not see wikilinks.** Token-based extraction misses them entirely; this is correct (wikilinks aren't CommonMark). Detection is the regex fallback's responsibility — that's where the gap lives.
- **Path resolution for wiki page names is unimplemented.** `resolvePath.ts` resolves explicit file paths. `FileCache.resolveFile(filename)` exists for short-filename lookup. Resolving `[[Page Name]]` to a vault file requires either an `.md` append heuristic or a vault-wide title index. Reuse `FileCache` if possible.
- **Documentation drift confirmed.** `CLAUDE.md` "Citation Patterns Supported" lists only `[[#anchor|Text]]`. `MarkdownParser.ts` JSDoc (lines 31-35) lists `[[file.md#anchor|text]]` and `[[#anchor|text]]`. Both omit the bare `[[Page Name]]` form most common in Obsidian.

### Source Mapping Table

%% *Last Modified: 05/02/26 09:08:50* %%

| # | Baseline [O] | Source ID | Source | Baseline Notes |
|---|-------------|-----------|--------|----------------|
| BI-1 | Validator user identifies broken links of any supported syntax | S1a | `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/MarkdownParser/extractLinks.ts:420-457` (`extractWikiCrossDocLinks`) | Regex `/\[\[([^#\]]+\.md)(#([^\|]+?))?\|([^\]]+)\]\]/g` requires `.md` AND `\|display`; misses every common Obsidian form |
| BI-1 | (same) | S1b | `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/MarkdownParser/extractLinks.ts:463-499` (`extractWikiInternalLinks`) | Regex `/\[\[#([^\|]+)\|([^\]]+)\]\]/g` requires `#anchor` AND `\|display`; misses `[[Page]]` and `[[Page\|Display]]` |
| BI-1 | (same) | S1c | `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/CitationValidator.ts:303-342` (`classifyPattern`) | Already routes `linkType: "wiki"` to `WIKI_STYLE` or `CROSS_DOCUMENT` — code path is live |
| BI-1 | (same) | S1d | `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/types/citationTypes.ts:27-79` (`LinkObject`) | Type union `"markdown" \| "wiki"` already supports both syntaxes — no type changes needed |
| BI-1 | (same) | S1e | `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/MarkdownParser/createLinkObject.ts` | Factory accepts `linkType: "wiki"`; passes `rawPath` to `resolvePath` — wiki page names without `.md` will fail path resolution downstream |
| BI-2 | Validator user reviews per-file report distinguishing processed/unprocessed link classes | S2a | `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts` (validate command output formatting) | Verbose mode lists individual citations but no "skipped class" diagnostic; no way to see what didn't get processed |
| BI-2 | (same) | S2b | `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/types/validationTypes.ts` | Validation report type may need a "coverage" or "syntaxes-processed" field |
| BI-3 | LLM agent receives verdict matching file's link inventory | S3a | (covered by S1a-S1e + S2a) | Trustworthy verdict requires (1) parser sees all link classes, (2) report surfaces coverage; resolves via BI-1 + BI-2 deltas |
| BI-4 | Wiki maintainer confirms cross-references stay correct including wikilinks | S4a | `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/MarkdownParser/resolvePath.ts` | Resolves explicit relative paths; does not resolve bare wiki page names (no `.md`) to vault files |
| BI-4 | (same) | S4b | `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/FileCache.ts` (`resolveFile(filename)`) | Existing short-filename resolver — candidate for reuse to resolve `[[Page Name]]` against the vault scope |
| BI-5 | Author sees broken links across syntaxes | S5a | (covered by S1a-S1e) | Same parser/validator path |
| BI-6 | Tool integrator trusts documented patterns are validated identically | S6a | `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/CLAUDE.md` "Citation Patterns Supported" section | Lists `[[#anchor\|Text]]` only — claims a wiki-style capability narrower than typical Obsidian usage and out of sync with what the parser ought to support |
| BI-6 | (same) | S6b | `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/MarkdownParser/MarkdownParser.ts:31-35` JSDoc | Claims "wiki-style: `[[file.md#anchor\|text]]` or `[[#anchor\|text]]`" — same narrow set as CLAUDE.md |
| BI-6 | (same) | S6c | `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/component-guides/MarkdownParser Component Guide.md` | Implementation contract for the parser — must be updated to reflect expanded wiki coverage |

### Artifacts Table — Updates

%% *Last Modified: 05/02/26 09:08:30* %%

New sources discovered during [h2.5] not in the original §3 Artifacts Table:

| Artifact | Path | Role |
|----------|------|------|
| `extractLinks.ts` | `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/MarkdownParser/extractLinks.ts` | Bug location — narrow wikilink regex; primary delta target |
| `createLinkObject.ts` | `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/MarkdownParser/createLinkObject.ts` | Link object factory — already supports `wiki` linkType; downstream path resolution may need extension |
| `resolvePath.ts` | `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/MarkdownParser/resolvePath.ts` | Path resolution — needs extension for wiki page names without `.md` |
| `FileCache.ts` | `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/FileCache.ts` | Filename-based file resolution — candidate for reuse for vault page name lookup |

## 6.5. [i0] Baseline Architecture Principles Evaluation

%% *Last Modified: 05/02/26 09:01:08* %%

### Citation Context

%% *Last Modified: 05/02/26 09:20:27* %%

`jact extract links` was not run against the baseline sources — the wikilink gap under evaluation is precisely why jact cannot extract wikilinks from the target file. This is noted as consistent with the bug being investigated.

Linked documentation read directly:
- `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/ARCHITECTURE-PRINCIPLES.md` — not present in project root; resolved from sibling repo at `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/workflows/tools/jact/ARCHITECTURE-PRINCIPLES.md`
- `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/llm-wiki/wiki/concepts/the-hardening-principle.md` — read in full
- `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/component-guides/MarkdownParser Component Guide.md` — read in full

---

### Results Summary

%% *Last Modified: 05/02/26 09:20:27* %%

| Principle Category | Status | Highest-Severity CI |
|--------------------|--------|---------------------|
| Modular Design | ❌ Violates | CI-02: Validator routing exists but parser never feeds it — cross-component contract broken |
| Data-First Design | ✅ Compliant | — |
| Action-Based File Organization | ✅ Compliant | — |
| Format/Interface Design | ❌ Violates | CI-05: Output reports "OK: N citations valid" with no coverage qualifier when a link class is entirely absent |
| MVP Principles | ➖ Partial | CI-06: Documented wiki support exceeds actual implementation scope |
| Deterministic Offloading | ❌ Violates | CI-01 (Critical): Tool produces false-negative deterministic output — silent pass on broken links |
| Self-Contained Naming | ❌ Violates | CI-07: `extractWikiCrossDocLinks` name claims wiki cross-doc coverage but only handles `.md|display` form |
| Safety-First Design | ❌ Violates | CI-03 (Critical): No fail-fast on unrecognized link syntax class; silent skip instead of loud error |
| Anti-Patterns | ❌ Violates | CI-04: Regex constraints scatter the "what counts as a wikilink" invariant across two functions |

---

### Findings & CI (Critical Issues) Status Table

%% *Last Modified: 05/02/26 10:10:18* %%

| CI ID | Severity | Principle Violated | Evidence | Description | CEO Translation |
|-------|----------|--------------------|----------|-------------|-----------------|
| CI-01 | Critical | Deterministic Offloading — No Surprises (`^prioritize-deterministic-operations`) | `extractLinks.ts:426` regex `/\[\[([^#\]]+\.md)(#([^\|]+?))?\|([^\]]+)\]\]/g`; `extractLinks.ts:469` regex `/\[\[#([^\|]+)\|([^\]]+)\]\]/g`; `jact.ts:568` `OK: ${result.summary.total} citations valid` | Identical input (a file with 10 wikilinks) produces different results depending on whether the links have `.md` extension and `\|display` — output is NOT identical for equivalent semantic inputs. A bare `[[Page Name]]` and `[[Page Name.md\|Page Name]]` are logically equivalent cross-document links but only the latter is detected. Violates "identical inputs and instructions must yield consistent, deterministic results" because the tool's behavior is governed by syntactic formatting details that are orthogonal to the link's semantic meaning. | The validator says "all good" on files with broken wikilinks. Whether a link gets seen at all depends on cosmetic details (with or without `.md`, with or without display text) that have nothing to do with whether it's actually broken. |
| CI-02 | High | Modular Design — Black Box Interfaces (`^black-box-interfaces`), Loose Coupling Tight Cohesion (`^loose-coupling-tight-cohesion`) | `CitationValidator.ts:312-319` (`classifyPattern` wiki routing); `extractLinks.ts:420-499` (extraction functions that never produce wiki objects for common forms) | The validator's `classifyPattern` method has live `linkType: "wiki"` routing at lines 312-319 that is permanently dead for the three most common Obsidian wikilink forms (`[[Page]]`, `[[Page\|Display]]`, `[[Page#section]]`). The parser's public contract promises `LinkObject[]` containing all links — but silently omits an entire syntactic class. The validator cannot compensate because it depends on the parser's output as its only input. The interface between MarkdownParser and CitationValidator is not a clean black box: knowing "wiki support exists" requires knowing it only works for two narrow regex forms, not the link type union. | The validator already knows how to handle wikilinks, but the parser never feeds them in for the most common Obsidian forms. The wiring exists but the seam is disconnected. |
| CI-03 | Critical | Safety-First Design — Fail Fast (`^fail-fast`), Clear Contracts (`^clear-contracts`) | `extractLinks.ts:420-499` (both wiki extraction functions return void with no unmatched-syntax signal); `jact.ts:568` final output line | When wikilinks are present but don't match extraction regexes, nothing signals the gap. No counter tracks "wikilinks seen but not extracted." No warning surfaces in the CLI output. `formatForCLIMinimal` at `jact.ts:505-572` only reports `errors`, `warnings`, and `total citations`; there is no `skipped` or `unrecognized_syntax` bucket. This is a textbook violation of Fail Fast: the error (unrecognized syntax) is present at parse time but never surfaced. Per the Hardening Principle (`the-hardening-principle.md:52,170`), silent failures are the most expensive failure mode. | When the parser hits a wikilink it can't read, nothing surfaces — no warning, no counter, no exit code. The most expensive failure mode (silent) is the default. |
| CI-04 | Medium | Anti-Patterns — Scattered Checks (`^scattered-checks`), One Invariant One Place (`^one-invariant-one-place`) | `extractLinks.ts:426` wikiCrossDocRegex; `extractLinks.ts:469` wikiRegex | The invariant "what constitutes a wikilink" is encoded redundantly across two separate regex patterns in two separate functions. `extractWikiCrossDocLinks` encodes the cross-doc form; `extractWikiInternalLinks` encodes the internal form. Neither function covers bare-name (`[[Page]]`) or no-display (`[[Page#anchor]]`) forms. Adding a new wiki form requires knowing to update both functions and understanding how their regexes interact. This violates One Invariant One Place: the wikilink grammar is a single domain concept fragmented across two sites. | The rule for "what counts as a wikilink" lives in two regex patterns in two functions. Adding a new wiki form requires editing both and reasoning about how they interact. |
| CI-05 | High | Format/Interface Design — Progressive Defaults (`^progressive-defaults`), Clear Contracts (`^clear-contracts`) | `jact.ts:568` `OK: ${result.summary.total} citations valid`; `jact.ts:397` `Processed: ${result.summary.total} citations found` | The CLI output line "OK: 42 citations valid" provides no indication of which link syntaxes were in scope. A user or LLM agent reading this output has no way to know wikilinks were not processed. The default output format makes a closed-world claim ("N citations valid") without qualifying the coverage ("N citations of type X valid; wikilinks not scanned"). The interface violates Progressive Defaults by offering no mechanism to discover what was skipped, even at `--verbose`. | "OK: 42 citations valid" hides what was actually checked. A reader can't tell if wikilinks were processed or skipped — closed-world claim with no scope qualifier. |
| CI-06 | Medium | MVP Principles — Reality Check (`^reality-check`), Scope Adherence (`^scope-adherence`) | `CLAUDE.md` "Citation Patterns Supported" lists `[[#anchor\|Text]]`; `MarkdownParser.ts:31-35` JSDoc lists `[[file.md#anchor\|text]]` and `[[#anchor\|text]]`; `MarkdownParser Component Guide.md` testing section claims parser identifies "all link syntaxes (markdown, wiki, cross-document, internal)" | Documentation in three separate locations (`CLAUDE.md`, `MarkdownParser.ts` JSDoc, and the component guide) claims wiki-style support that only covers two narrow regex forms. The documented capability is `[[file.md#anchor\|text]]` and `[[#anchor\|text]]` — both with mandatory display text. The actual Obsidian common forms (`[[Page Name]]`, `[[Page\|Display]]`, `[[Page#section]]`) are absent from both implementation and documentation. This is documentation-implementation drift: the stated scope was never verified against what's actually implemented. | Three docs (CLAUDE.md, JSDoc, component guide) claim wiki support that the code doesn't deliver. Readers trust the docs, find a gap, lose trust. |
| CI-07 | Low | Self-Contained Naming — Descriptive Labels (`^descriptive-labels`), Confusion Prevention (`^confusion-prevention`) | `extractLinks.ts:420` function `extractWikiCrossDocLinks`; `extractLinks.ts:417` JSDoc "Extract wiki-style cross-document links: `[[file.md#anchor\|text]]`" | The function name `extractWikiCrossDocLinks` and its JSDoc claim to extract wiki cross-document links. In practice, it only extracts the subset `[[file.md#anchor\|display]]` — requiring `.md` extension AND a display text component. The name creates a false contract: a reader (or agent) consulting this function to understand wiki cross-doc extraction will believe the full form is covered. The JSDoc at line 417 partially mitigates this by showing the example form, but the function name still overpromises. | A function called `extractWikiCrossDocLinks` only handles a narrow subset of wiki cross-doc links. The name overpromises what the code delivers. |
| CI-08 | Low | Data-First Design — Illegal States Unrepresentable (`^illegal-states-unrepresentable`) | `citationTypes.ts:29` `linkType: "markdown" \| "wiki"`; `resolvePath.ts:11-27` (resolves explicit paths only); `createLinkObject.ts:28-30` (`resolvePath` called unconditionally with `rawPath`) | `LinkObject` type union correctly includes `"wiki"` and the type system is sound for links that are extracted. However, when a wiki cross-doc link without `.md` extension is eventually extracted (post-Delta), `rawPath` will be a bare page name like `"Page Name"` — not a relative file path. `resolvePath` will `resolve(sourceDir, "Page Name")` producing a filesystem path that doesn't exist. The type system doesn't distinguish "resolved filesystem path" from "vault page name needing title-index lookup." This is a latent illegal-state risk that the Delta must address. Severity Low now because it only becomes active when extraction is fixed. | After the Delta fixes extraction, bare page names like "Page Name" (no `.md`, no path) hit a resolver that expects file paths. Latent bug — the type system can't tell "resolved file path" from "vault page name needing lookup." |

---

## 7. Phase 5: Delta Architecture

%% *Last Modified: 05/02/26 09:25:30* %%

### 7a. Delta Architecture Table

%% *Last Modified: 05/02/26 12:39:54* %%

| # | BI Row | File | Section | Before | After | Notes | CEO Translation |
|---|--------|------|---------|--------|-------|-------|-----------------|
|[D1](#D1%20—%20Consolidated%20Wikilink%20Grammar) | BI-1, BI-3, BI-4, BI-5 | `src/core/MarkdownParser/extractLinks.ts` | wiki extractor functions (lines 417-499) + new top-level dispatcher | Two narrow regexes: `extractWikiCrossDocLinks` requires `.md` AND `\|display`; `extractWikiInternalLinks` requires `#anchor` AND `\|display`. Common Obsidian forms (`[[Page]]`, `[[Page\|Display]]`, `[[Page#section]]`) silently skipped. | Single consolidated wikilink grammar function (`extractWikilinks`) recognizes the full Obsidian form set: `[[Page]]`, `[[Page\|Display]]`, `[[Page.md]]`, `[[Page.md\|Display]]`, `[[Page#section]]`, `[[Page#section\|Display]]`, `[[Page.md#section]]`, `[[Page.md#section\|Display]]`, `[[#anchor]]`, `[[#anchor\|Display]]`. Output `LinkObject[]` with `linkType: "wiki"` for each. Display text defaults to raw target when omitted. | Replaces two narrow regexes with one grammar function. The "what counts as a wikilink" invariant lives in one place. Delete or deprecate the two old extractors after migration. | The parser now recognizes every common Obsidian wikilink shape in one place, instead of silently dropping the seven shapes the old regexes never knew how to read. |
| [D2](#D2%20—%20Residual-Bracket%20Scanner%20(Fail-Fast)) | BI-2, BI-3 | `src/core/MarkdownParser/extractLinks.ts` + `src/types/validationTypes.ts` | Residual-bracket scanner + ValidationReport schema | Unmatched `[[...]]` bracket sequences silently dropped. No counter, no diagnostic. | After all extractors run, scan source text for residual `[[...]]` patterns the grammar did not consume. Emit `UnrecognizedSyntaxRecord { line, column, rawText, syntaxFamily: "wiki" }` per occurrence. Add `unrecognized: UnrecognizedSyntaxRecord[]` field to ValidationReport (parallel array alongside `links`). **Display sections (per [GAP-1](#^GAP-1)):** Minimal mode emits an `UNRECOGNIZED (K)` section between `ERRORS` and the trailer summary line; per-occurrence records use the form `- Line N: <rawText>` followed by indented `reason: ...`. Verbose mode emits an `UNRECOGNIZED SYNTAX (K)` section in the same vertical position relative to its `CRITICAL ERRORS` and `WARNINGS` sections, using the existing `├─ Line N: <rawText>` / `└─ <reason>` indentation pattern. | Fail-fast signal for any wiki bracket sequence the grammar can't handle. **Schema departure note (per [i3] DCI-04):** `unrecognized` is a new top-level array on `ValidationReport`, alongside existing `links` and `summary`. JSON consumers that destructure `{ summary, links }` will silently miss `unrecognized` records — they will need to add `unrecognized` to their destructure or use `result.summary.unrecognizedCount` (added in D3) for the count-only case. NBA grep confirmed no active JSON consumers exist today; future consumers can adopt the new shape from day one. | Any wiki bracket sequence the parser cannot read becomes a visible diagnostic with line and column instead of a silent skip. |
| [D3](#D3%20—%20Coverage-Qualified%20Output) | BI-2, BI-3, BI-6 | `src/jact.ts` (`formatForCLIMinimal` lines 505-572 + exit-code logic lines 1280-1295) + `src/types/validationTypes.ts` (ReportSummary schema) + `src/types/citationTypes.ts` (new `LinkClass` discriminator) + new `src/core/getLinkClass.ts` | CLI summary line + ReportSummary schema + exit-code path + display-class taxonomy | (a) `OK: 42 citations valid` — closed-world claim with no coverage qualifier. (b) Exit code logic at jact.ts:1288-1293 string-matches `"FAILED:"` / `"VALIDATION FAILED"` in display output to set exit 1; everything else exits 0. Display string is structurally coupled to exit semantics. (c) `LinkObject.linkType` is only `"markdown" \| "wiki"` — no `caret` value exists; caret citations are `linkType: "markdown"` with `anchorType: "block"`. | (a) New display-layer type `LinkClass = "markdown" \| "wiki" \| "caret"` distinct from `LinkObject.linkType`. (b) New `getLinkClass(link: LinkObject): LinkClass` classifier: `wiki → "wiki"`; `markdown + anchorType="block" → "caret"`; `markdown + anchorType≠"block" → "markdown"`. (c) Add `byLinkClass: Record<LinkClass, number>` and `unrecognizedCount: number` to `ReportSummary`. (d) Output: `OK: 42 citations valid (markdown: 30, wiki: 10, caret: 2; 0 unrecognized)`. (e) **Schema revision (per [GAP-5](#^GAP-5)):** make `summary.errors` a derived count: `errors = brokenLinkCount + unrecognizedCount`. Add `summary.errorBreakdown: { brokenLinks: N, unrecognized: K }` for consumers wanting class-level detail. Existing `summary.errors > 0` predicate now structurally catches both failure classes — no consumer-doc reliance required. (f) **Manager return-shape change + exit-code refactor (per [GAP-6](#^GAP-6) + GAP-5):** `manager.validate()` return shape changes from `Promise<string>` to `Promise<{ output: string, result: ValidationResult }>` (Type I interface change — see Notes). Exit-code predicate (all branches): `process.exit(result.summary.errors > 0 \|\| result.summary.unrecognizedCount > 0 ? 1 : 0)` — explicit `\|\| unrecognizedCount > 0` disjunct retained as belt-and-suspenders even though (e) makes `errors` already derived (survives future schema drift if `errors` derivation changes). JSON branch drops `JSON.parse(result)` since it gets `result` directly. Display string becomes purely cosmetic. (g) **FAILED-path summary line (per [GAP-2](#^GAP-2)):** `FAILED: ${errors} errors[, ${warnings} warnings][, ${unrecognized} unrecognized] (markdown: N, wiki: N, caret: N)` — inline byLinkClass breakdown for consistency with `OK:` line shape. (h) **Verbose SUMMARY block additions (per [GAP-3](#^GAP-3)):** between `- Critical errors:` and `- Validation time:`, add two lines: `- By link class: markdown=N, wiki=N, caret=N` and `- Unrecognized: K`. (i) **Verbose trailer branch order (per [GAP-4](#^GAP-4)):** `errors > 0 → "VALIDATION FAILED"`; else if `unrecognizedCount > 0 → "VALIDATION FAILED - K unrecognized syntax records"`; else if `warnings > 0 → "VALIDATION PASSED WITH WARNINGS"`; else `"ALL CITATIONS VALID"`. Trailer must be loud-fail consistent with structured-field exit code. | Three coupled changes: (1) new `LinkClass` discriminator separates display from extraction taxonomy; (2) coverage qualifier in summary; (3) exit code driven by structured fields, not string matching. Change (3) closes the loop — without it, unrecognized brackets would print but exit 0, re-introducing silent-pass. **Type I change (per [GAP-6](#^GAP-6)):** `manager.validate()` return-shape change from `Promise<string>` to `Promise<{ output, result }>` is an interface contract change — requires an ADR note alongside this Delta. | The summary now declares what was checked, by class, and the exit code reads a structured field instead of the display string — so adding a new line never breaks the fail-loud contract. |
| [D4](#D4%20—%20Wiki%20Page%20Name%20Resolution%20via%20FileCache) | BI-1, BI-4 | new `src/core/MarkdownParser/resolveWikiPath.ts` + `src/core/MarkdownParser/createLinkObject.ts` (call new resolver) + `src/FileCache.ts` (reuse) + new `src/utils/wikiPageSlug.ts` | Wiki page name resolution module + factory wire-up | `resolvePath(sourceDir, rawPath)` called unconditionally from `createLinkObject.ts`; for `rawPath = "The Hardening Principle"` (no `.md`, no `/`), produces `<sourceDir>/The Hardening Principle` which doesn't exist. FileCache has no slug normalization — `"The Hardening Principle"` does not match `the-hardening-principle.md`. `createLinkObject.ts` is currently a pure construction factory with no I/O dependency. | (a) New `src/core/MarkdownParser/resolveWikiPath.ts` exports `resolveWikiPath(rawPath: string, sourceAbsolutePath: string, fileCache?: FileCache): ResolvedPath` containing the two-step resolution: (1) `FileCache.resolveFile(rawPath)` exact (handles `[[the-hardening-principle]]` and `[[the-hardening-principle.md]]`); (2) on miss, `FileCache.resolveFile(pageNameToSlug(rawPath) + ".md")` (handles `[[The Hardening Principle]]`); (3) on miss in both: return `{ resolved: false, attempted: [raw, slug + ".md"] }` so validator reports `"wiki page not found in vault (tried: <raw>, <slug>.md)"`. (b) `createLinkObject.ts` calls `resolveWikiPath(...)` for `linkType === "wiki" && !rawPath.includes("/")`; otherwise calls existing `resolvePath` unchanged. (c) New module `wikiPageSlug.ts` exports `pageNameToSlug(s: string): string` = lowercase + replace whitespace with `-` + strip non-`[a-z0-9\-_]` chars + collapse repeated `-`. (d) FileCache stays as injected dependency (not baked into the factory). (e) **Levenshtein suggestion (per [GAP-7](#^GAP-7), threshold + display revised post-[7g] per [GAP-8](#^GAP-8)):** when both `FileCache.resolveFile(rawPath)` and `FileCache.resolveFile(slug + ".md")` miss, compute Levenshtein distance from `slug + ".md"` against the **basename** of every known FileCache file (basename only — wikilinks have no folder context, so distance against full paths would balloon by the folder-prefix length and prevent legitimate typo matches). Use existing `src/utils/stringDistance.ts`. **Adaptive threshold** (replaces fixed `≤ 5`): `threshold = clamp(min: 3, max: 10, value: floor(0.2 × candidateRelativePath.length))` — threshold is computed from the **full relative path length** (not basename length) because deeper paths carry more contextual information and warrant more typo headroom; floor of 3 always catches small typos in shallow paths; ceiling of 10 prevents absurd matches on very long paths; 20% middle ("1-in-5 characters wrong") scales consistently across vault depths. **Path-aware display + multi-match disambiguation:** collect all candidates whose basename distance ≤ threshold; if exactly 1, set `validation.suggestion` to its **full relative path** (e.g., `wiki/concepts/the-hardening-principle.md`); if ≥2, set `validation.suggestion` to a comma-separated list of full relative paths (e.g., `wiki/concepts/the-hardening-principle.md, wiki/summaries/the-hardening-principle.md`) so the agent sees parent-folder context and can self-correct on duplicate-basename cases. Existing CLI minimal-mode (`jact.ts:520-522`) and JSON-mode suggestion-print paths surface it without further changes. Updates target file list to add `src/utils/stringDistance.ts` (reuse) and `src/CitationValidator.ts` (suggestion wiring). | **Revised per [i3] DCI-02:** Resolution logic extracted to its own module so `createLinkObject.ts` stays a pure construction factory with no FileCache dependency. New module follows existing pattern (`resolvePath.ts` sibling). Disambiguation suffixes like `[[Page (concept)]]` slug to `page-concept.md` — surfaces as broken-link if no such file (correct loud-fail behavior). | Wiki page names like "The Hardening Principle" now resolve to the matching kebab-case file, with explicit attempted-name reasons when no match exists. |
| [D5](#D5%20—%20Documentation%20Alignment%20+%20Naming%20Cleanup) | BI-6 | `jact/CLAUDE.md` (Citation Patterns) + `src/core/MarkdownParser/MarkdownParser.ts` (lines 31-35 JSDoc) + `src/core/MarkdownParser/extractLinks.ts` (function names + JSDoc) + `design-docs/component-guides/MarkdownParser Component Guide.md` | Documentation alignment + naming | CLAUDE.md and JSDoc list narrow `[[file.md#anchor\|text]]` and `[[#anchor\|text]]` only. `extractWikiCrossDocLinks` name overpromises actual coverage. Component guide claims "all link syntaxes" without enumerating wiki forms. | CLAUDE.md "Citation Patterns Supported" enumerates all 10 wikilink forms covered by D1. MarkdownParser.ts JSDoc updated to match. Old extractor functions removed (replaced by `extractWikilinks` from D1) — no naming-mismatch surface remains. Component guide gains a "Wikilink Grammar" subsection citing the 10 forms with examples. | Closes documentation drift in three locations. After D5, reading any of the three docs yields the same wikilink coverage list as the implementation. | The docs and the implementation now describe the same set of supported wikilink shapes, ending the documented-vs-actual drift that misled readers. |

#### 7a.1 BI ↔ Delta Coverage

%% *Last Modified: 05/02/26 09:25:30* %%

| BI Row | Covered By | Status |
|--------|-----------|--------|
| BI-1 — Validator user identifies broken links of any supported syntax | D1, D4 | ✅ Full |
| BI-2 — Per-file report distinguishing processed/unprocessed link classes | D2, D3 | ✅ Full |
| BI-3 — LLM agent receives verdict matching file's link inventory | D1, D2, D3 | ✅ Full |
| BI-4 — Wiki maintainer cross-references stay correct including wikilinks | D1, D4 | ✅ Full |
| BI-5 — Author sees broken links across syntaxes | D1 | ✅ Full |
| BI-6 — Tool integrator trusts documented patterns are validated identically | D5 | ✅ Full |

#### 7a.2 CI ↔ Delta Coverage

%% *Last Modified: 05/02/26 09:37:04* %%

| CI ID (Severity) | Covered By | Mechanism |
|------------------|-----------|-----------|
| CI-01 (Critical) — Silent false-negative result | D1 | Broadened grammar produces `LinkObject` for all common wiki forms; validator routing (already live) processes them |
| CI-02 (High) — Dead validator wiki routing | D1 | Parser feeds `linkType: "wiki"` LinkObjects; `classifyPattern` (CitationValidator.ts:312-319) wakes up |
| CI-03 (Critical) — No fail-fast on unrecognized wiki syntax | D2 | Residual-bracket scanner emits diagnostic; D3 surfaces it in CLI |
| CI-04 (Medium) — Scattered wikilink invariant | D1 | Single grammar function replaces two regex sites |
| CI-05 (High) — Output carries no coverage qualifier | D3 (revised) | New `LinkClass` display-layer type + `getLinkClass` classifier + `byLinkClass` and `unrecognizedCount` on ReportSummary; CLI prints both. Exit-code path refactored to read structured field, not display string |
| CI-06 (Medium) — Documentation drift in three locations | D5 | CLAUDE.md, JSDoc, component guide aligned to D1 grammar |
| CI-07 (Low) — Misleading function name | D5 | Old `extractWikiCrossDocLinks` removed (D1 replaces); no naming-overpromise remains |
| CI-08 (Low) — `resolvePath` called with bare page name post-fix | D4 | FileCache reuse for vault page name resolution; explicit broken-link reason on miss |

#### 7a.3 Data Shape Deltas

%% *Last Modified: 05/02/26 12:51:31* %%

Consolidated TypeScript shape declarations for the type changes spread across D1–D5. Single source of truth for implementation; resolves the prose-scattering identified in [7g] review. Each shape is annotated with the originating Delta and any GAP-driven revisions.

**File: `src/types/citationTypes.ts`** — extend `LinkObject.linkType` (no shape change required; `"wiki"` already exists).

**File: `src/types/validationTypes.ts`** — additive changes plus one derived field.

```typescript
// per D3 — new display-layer discriminator (separate from LinkObject.linkType)
export type LinkClass = "markdown" | "wiki" | "caret";

// per D2 — new record type for residual-bracket scanner output
export interface UnrecognizedSyntaxRecord {
  line: number;        // 1-based
  column: number;      // 0-based
  rawText: string;     // matched bracket sequence, e.g. "[[malformed[["
  syntaxFamily: "wiki"; // reserved for future families (e.g. "caret")
}

// per D3 — ReportSummary extended; `errors` becomes derived (per GAP-5)
export interface ValidationSummary {
  total: number;
  valid: number;
  warnings: number;
  errors: number;                                  // derived: brokenLinks + unrecognized (per GAP-5)
  byLinkClass: Record<LinkClass, number>;          // per D3
  unrecognizedCount: number;                       // per D3
  errorBreakdown: {                                // per D3 (e), GAP-5
    brokenLinks: number;
    unrecognized: number;
  };
}

// per D2 — ValidationResult gains top-level `unrecognized[]` (parallel to `links`)
export interface ValidationResult {
  summary: ValidationSummary;
  links: EnrichedLinkObject[];
  unrecognized: UnrecognizedSyntaxRecord[];        // per D2
  validationTime?: string;
}

// per D4 (e), GAP-8 — ValidationMetadata.suggestion semantics revised
// `suggestion` is a single string. For multi-match (duplicate basenames within
// adaptive Levenshtein threshold), use comma-space separator: "path/a.md, path/b.md".
// Type signature unchanged from current `validationTypes.ts` — only semantics evolve.
```

**File: `src/core/MarkdownParser/resolveWikiPath.ts`** (new, per D4) — return shape for the wiki-path resolver.

```typescript
// per D4 — resolver return shape; `attempted` carries both raw and slug forms for the error message
export type ResolvedPath =
  | { resolved: true; absolutePath: string }
  | { resolved: false; attempted: [rawPath: string, slugPath: string] };
```

**File: `src/jact.ts` — `manager.validate()` signature** (per D3 (f), GAP-6) — **Type I interface change**.

```typescript
// BEFORE
validate(path: string, opts: ValidateOptions): Promise<string>;

// AFTER — caller receives both formatted output and structured result
validate(path: string, opts: ValidateOptions): Promise<{
  output: string;        // formatted display string (CLI minimal/verbose/JSON)
  result: ValidationResult; // structured shape; exit-code predicate reads this
}>;
```

**Exit-code predicate** (per D3 (f)):
```typescript
process.exit(
  result.summary.errors > 0 || result.summary.unrecognizedCount > 0 ? 1 : 0
);
// `|| unrecognizedCount > 0` retained as belt-and-suspenders (per D3 (f)) even
// though `errors` is now derived (per GAP-5) — survives future schema drift.
```

**Implementation checklist** (consumers of these shapes):

- [ ] `CitationValidator.validateFile()` populates `summary.byLinkClass`, `summary.unrecognizedCount`, `summary.errorBreakdown`, and top-level `unrecognized[]`.
- [ ] `getLinkClass(link)` classifier added at `src/core/getLinkClass.ts` (per D3).
- [ ] `formatForCLIMinimal` / verbose / JSON formatters read `summary.byLinkClass` and `unrecognized[]` (per D2 [GAP-1], D3 [GAP-2/3/4]).
- [ ] `manager.validate()` callers updated for `Promise<{ output, result }>` return shape.
- [ ] CitationValidator suggestion-wiring populates `validation.suggestion` from `resolveWikiPath` failure path (per D4 (e), GAP-8).

### 7b. Design Decisions Rationale

%% *Last Modified: 05/02/26 09:25:30* %%

#### D1 — Consolidated Wikilink Grammar

%% *Last Modified: 05/02/26 09:25:30* %%

**Decision:** Replace `extractWikiCrossDocLinks` (extractLinks.ts:420-457) and `extractWikiInternalLinks` (extractLinks.ts:463-499) with a single `extractWikilinks` function whose grammar covers all 10 common Obsidian wikilink forms. [^S-D1a] [^S-D1b]

**Why one function, not two:** [F-ID: One Invariant One Place — the question "what counts as a wikilink" is a single domain concept that must have a single representation per Anti-Patterns §`^one-invariant-one-place`]. The existing split partitions by `(has-extension × has-display)` — an arbitrary syntactic axis, not a semantic one. A reader extending wikilink support must currently know to update both functions and reason about their regex interaction. [^S-CI04]

> **[H-D1-regex]** Single regex with optional groups (`#section?`, `\|display?`, `.md?`) is more maintainable than four narrow regexes for the 10 wikilink forms.
> - Negate-first: Find a wikilink form where a single regex produces wrong captures due to greedy/non-greedy interaction with `]]` boundary.
> - Utility: H — determines D1 implementation shape
> - Cost: L — design + verify against baseline file
> - **Resolution evidence:** Regex `/\[\[([^\|\]#]+)(?:#([^\|\]]+))?(?:\|([^\]]+))?\]\]/g` captures: target (group 1), optional section (group 2), optional display (group 3). Verified against `0-documents/llm-wiki/wiki/concepts/probabilistic-vs-deterministic-systems.md` — all 11 occurrences captured: `[[the-hardening-principle\|The Hardening Principle]]`, `[[The Hardening Principle (concept)]]` (×3), `[[The Hardening Principle]]` (×2), `[[Silent Failure]]`, `[[Separation of Concerns]]`, `[[Determinism]]`, `[[Building Effective Agents]]`, `[[Hardening Principle — Open Questions Research]]`. Em dashes, parentheses, and spaces in page names handled correctly.

^H-D1-regex

**Why preserve `linkType: "wiki"` discriminator:** [OBS-D1a: validator already routes wiki to `WIKI_STYLE` or `CROSS_DOCUMENT` at CitationValidator.ts:312-319] [^S-D1c]. No type changes needed; the discriminator is the seam between parser and validator, and it works.

#### D2 — Residual-Bracket Scanner (Fail-Fast)

%% *Last Modified: 05/02/26 10:36:11* %%

**Decision:** After all link extractors run, scan the source text for `[[...]]` patterns the grammar did not consume. Each unmatched occurrence becomes an `UnrecognizedSyntaxRecord` in the validation report.

**Why scan after extraction (not during):** [F-ID: A grammar's unmatched-input set is the complement of its matched-input set]. Detecting unmatched brackets requires either (a) tagging each consumed range during extraction or (b) running a residual scan over the raw text after extraction. (b) is simpler and decouples from the grammar's internal mechanics. [H: residual scan adds <5ms for files under 1MB]
  - Strengthen: Benchmark residual regex on the largest file in `0-documents/llm-wiki/`. Fail if >50ms.
  - Utility: M — determines whether (a) or (b) is correct shape
  - Cost: L — single benchmark
  - Next actions: 1. Find largest wiki file 2. Time `wc -c` and residual regex run 3. Compare to budget
  - DRI: Agent

**Why a separate `unrecognized` bucket (not just "errors"):** [F-ID: Errors and unrecognized syntax are distinct ontological categories]. An error is a known-broken instance of a known type (e.g., `[[Real Page]]` resolves to nothing). An unrecognized record is a parse-time failure: the tool literally cannot tell you whether it is broken or valid. Conflating them hides the silent-failure class the Hardening Principle warns against. [^S-hardening]

> **[A-D2-schema]** (From [i3] DCI-04) D2's `unrecognized: UnrecognizedSyntaxRecord[]` parallel array on `ValidationReport` departs from the existing enrichment pattern (per-item data in `links`, aggregate in `summary`); JSON consumers that destructure `{ summary, links }` will silently miss the new field.
> - Strengthen: Confirm via NBA grep that no current JSON consumers exist; document the schema departure for future consumers.
> - Utility: M — determines whether the schema change needs a migration plan or just a note
> - Cost: L — already verified via NBA [A-D3-exitcode] grep
> - Risk-if-wrong: Future JSON consumers miss `unrecognized` records and re-introduce silent-pass failure mode at their layer
> - **Resolution evidence:** NBA grep already confirmed zero active JSON consumers. **D2 row in §7a updated** with explicit Schema departure note in the Notes column listing the new field shape and the consumer-migration path (use `summary.unrecognizedCount` for count-only; destructure `unrecognized` for per-occurrence detail). Closes DCI-04.

^A-D2-schema

#### D3 — Coverage-Qualified Output

%% *Last Modified: 05/02/26 10:35:31* %%

**Decision (revised after [i3] eval):** Three coupled changes. (a) Introduce display-layer type `LinkClass = "markdown" \| "wiki" \| "caret"` distinct from `LinkObject.linkType`. (b) New `getLinkClass(link: LinkObject): LinkClass` classifier in `src/core/getLinkClass.ts` derives the class from `(linkType, anchorType)`. (c) Replace `OK: ${total} citations valid` with `OK: ${total} citations valid (markdown: N, wiki: N, caret: N; ${unrecognizedCount} unrecognized)` driven by `byLinkClass: Record<LinkClass, number>` and `unrecognizedCount: number` on `ReportSummary`. (d) Refactor exit-code path at `jact.ts:1280-1295` to read structured fields, not display strings: `process.exit(parsed.summary.errors > 0 \|\| parsed.summary.unrecognizedCount > 0 ? 1 : 0)`. [^S-D3a] [^S-D3b] [^S-D3c]

**Why a separate `LinkClass` (not adding `caret` to `LinkObject.linkType`):** [E: [OBS-D3-types] (`/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/types/citationTypes.ts:29` defines `linkType: "markdown" \| "wiki"`; caret citations are `linkType: "markdown"` with `anchorType: "block"` per existing taxonomy) refutes the original D3 spec which treated `byLinkType` as if it could produce a `caret` bucket directly] [^S-D3-types]. `LinkObject.linkType` describes *extraction syntax*, not user-facing display category. Adding `"caret"` to that union would conflate two distinct concepts and break existing extractors that assert `linkType === "markdown"` for caret-bearing markdown links. The fix is a separate display-layer discriminator computed from `(linkType, anchorType)`.

**Why per-class breakdown:** [OBS-D3a: current output asserts `total = N valid` with no qualifier] [^S-D3b]. A reader cannot distinguish "all link classes fully covered" from "one class returned zero objects because parser is broken." Per-class counts make the closed-world claim auditable: a known wiki-heavy file with `wiki: 0` is itself a signal.

**Why exit code refactor (not a string-match patch):** [E: [OBS-D3-exit] (jact.ts:1288-1293 sets exit 1 by string-matching `"FAILED:"` or `"VALIDATION FAILED"` in display output) refutes the original D3 implicit assumption that "non-zero unrecognized → exit 1" would just work] [^S-D3-exit]. The current implementation has zero coverage for the new `OK: ... (... 3 unrecognized)` string — it would exit 0. Two patch options exist: (P1) extend the string-match list to include `"unrecognized"` substring; (P2) refactor to read the structured `summary.unrecognizedCount` field. P2 is correct because [F-ID: One Invariant One Place — exit code is a structural concern that must derive from structured data, not from cosmetic string formatting that could change in any future commit] [F-ID: per the Hardening Principle, a deterministic tool that cannot classify its input must fail loudly] [^S-hardening]. Exit code 0 with non-zero unrecognized count would re-introduce the silent-pass failure mode under a new name.

**Why `errors > 0 || unrecognizedCount > 0`:** [F-ID: Errors and unrecognized are distinct ontological categories per D2 rationale, and both invalidate the OK contract]. Either condition must trip exit 1. The minimal/verbose branches at jact.ts:1280-1295 must be refactored to receive (or re-parse) the structured `ValidationReport.summary` so they can apply the same predicate. Display string then becomes purely cosmetic.

**[A-D3-exitcode] (RESOLVED at [nba]):** No active CI/hook consumes `jact validate` exit code today (grep across `.yml`, `.yaml`, `.sh`, `.json`, `.toml` returned only design-doc YAML). D3 ships with new exit-code logic; downstream agents that begin consuming exit codes will see correct fail-loud behavior from day one.

> **[A-D3-exitcode]** LLM agents and CI scripts treat exit code 1 as "fix this before continuing".
> - Strengthen: Check whether any caller ignores `jact validate` exit codes.
> - Utility: M — determines whether D3 needs companion call-site updates
> - Cost: L — grep CI/hook locations
> - Risk-if-wrong: D3 ships but downstream agents still see green checks because callers swallow exit codes
> - **Resolution evidence:** Grep across `**/*.{yml,yaml,sh,json,toml}` in jact repo returned only 2 design-doc YAML files. No active CI workflow, husky hook, Claude Code hook, or settings.json hook consumes `jact validate` exit code today. Risk is null at ship time; future consumers will see correct fail-loud behavior.

^A-D3-exitcode

> **[H-D3-linkclass]** (From [i3] DCI-01) `byLinkType: Record<LinkType, number>` cannot produce a `caret` bucket because `LinkObject.linkType` is `"markdown" \| "wiki"` only.
> - Strengthen: Read `citationTypes.ts:29` and confirm the type union; identify how caret citations are currently typed.
> - Utility: H — determines whether D3 schema is implementable as written
> - Cost: L — single source-code read
> - **Resolution evidence:** Confirmed at `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/types/citationTypes.ts:29` — `linkType: "markdown" \| "wiki"`. Caret citations are `linkType: "markdown"` with `anchorType: "block"` (line 35). Adding `"caret"` to `linkType` would conflate extraction syntax with display class, breaking existing caret extraction logic. **D3 revised** to introduce separate `LinkClass = "markdown" \| "wiki" \| "caret"` display-layer type with `getLinkClass(link: LinkObject): LinkClass` classifier; `ReportSummary.byLinkClass: Record<LinkClass, number>`. Closes DCI-01.

^H-D3-linkclass

> **[H-D3-exitwire]** (From [i3] DCI-03) Exit code at `jact.ts:1288-1293` is set by string-matching display output for `"FAILED:"` / `"VALIDATION FAILED"`. D3's `OK: ... (N unrecognized)` output would exit 0 even with non-zero unrecognized — silent pass.
> - Strengthen: Read `jact.ts:1280-1295` and confirm the exit-code logic; verify D3 output string would not match either trigger.
> - Utility: H — determines whether D3 closes the silent-pass failure mode or re-introduces it
> - Cost: L — single source-code read
> - **Resolution evidence:** Confirmed at `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts:1280-1295`. Current logic: `process.exit(result.includes("FAILED:") \|\| result.includes("VALIDATION FAILED") ? 1 : 0)` for minimal/verbose; `process.exit(parsed.summary?.errors > 0 ? 1 : 0)` for JSON. D3's new output starts with `OK:` and would not match either string — silent pass. **D3 revised** to refactor exit-code path to read structured `ValidationReport.summary` field: `process.exit(parsed.summary.errors > 0 \|\| parsed.summary.unrecognizedCount > 0 ? 1 : 0)` for all branches. Display string becomes purely cosmetic. Closes DCI-03.

^H-D3-exitwire

#### D4 — Wiki Page Name Resolution via FileCache

%% *Last Modified: 05/02/26 10:40:32* %%

**Decision:** Two-step resolver. When `linkType === "wiki"` AND `rawPath` has no `/`: (1) try `FileCache.resolveFile(rawPath)` exact; (2) on miss, try `FileCache.resolveFile(pageNameToSlug(rawPath) + ".md")`. On miss in both: leave `targetPath` unresolved; validator reports broken with reason `"wiki page not found in vault (tried: <raw>, <slug>.md)"`. [^S-D4a] [^S-D4b]

**Why reuse FileCache, not build a vault title-index:** [OBS-D4a: FileCache.resolveFile already exists for short-filename lookup against scope] [^S-D4b] [F-ID: MVP Principles — Reality Check (`^reality-check`) — solve the smallest version of the problem first]. Building a vault-wide title index from H1 or frontmatter introduces (a) a new cache lifecycle to manage, (b) ambiguity rules when multiple files share an H1, (c) initialization cost on every run, and (d) a dependency on every file having a parseable H1. Slug normalization captures the common Obsidian convention (page name = Title Case of slug) without any of these costs.

**Why slug normalization is required (revised from initial design):** [E: [OBS-D4-survey] (8 unique page names in baseline file; only `the-hardening-principle` matches FileCache directly without normalization, the other 7 use Title Case forms like `The Hardening Principle`, `Silent Failure`, `Separation of Concerns`) refutes [H-D4-original: ≥80% of wikilink resolutions succeed via filename match without ambiguity]] [^S-D4-survey]. Filename-only resolution achieves ~12% match rate on the baseline file. Adding kebab-case slug normalization (`"The Hardening Principle"` → `the-hardening-principle`) recovers the remaining cases where page name is Title Case of slug. Cases that still fail (`[[Page (concept)]]` disambiguation suffixes; pages whose filenames have date prefixes like `0001-page.md`; pages that genuinely don't exist) surface as broken with the explicit attempted slugs printed in the reason — this is correct loud-fail behavior per the Hardening Principle, not a silent skip. [^S-hardening]

**Why surface attempted slugs in the error reason:** [F-ID: Self-Contained Naming — error reasons must be diagnostic without further context]. The reader sees both what was searched and the slug-normalization rule applied, so they can either (a) rename the wiki page, (b) fix the file's filename, or (c) recognize the disambiguation-suffix limitation as a known scope boundary.

**Known MVP limitation — disambiguation suffixes:** Wikilinks with disambiguation suffixes like `[[The Hardening Principle (concept)]]` slug to `the-hardening-principle-concept` and will not resolve unless a file with that slug exists. Obsidian's native behavior treats these as separate pages, but the slug rule cannot distinguish "intended duplicate" from "intended base page". This is a documented MVP limitation; full disambiguation resolution requires title-index work that is out of scope for this Delta.

> **[H-D4-filematch]** ≥80% of wikilink resolutions in target vault succeed via filename match without ambiguity. **FALSIFIED**
> - Negate-first: Find wiki page names that don't match any filename, or filenames matching multiple page names.
> - Utility: H — determines whether D4 ships as filename-match or needs vault-index extension
> - Cost: L — survey wiki folder
> - **Resolution evidence:** Survey of baseline file referenced 8 unique wiki page names; only 1 (`the-hardening-principle`) matches FileCache exactly. The remaining 7 (`The Hardening Principle`, `Silent Failure`, `Separation of Concerns`, `Determinism`, `Building Effective Agents`, `The Hardening Principle (concept)`, `Hardening Principle — Open Questions Research`) all use Title Case page names that do not match any kebab-case filename without normalization. Match rate ≈12.5%, far below 80%. **D4 revised** to include slug normalization step (see new [H-D4-slug]).

^H-D4-filematch

> **[H-D4-slug]** Adding kebab-case slug normalization (`"The Hardening Principle"` → `the-hardening-principle.md`) raises wiki page resolution rate to ≥80% in target vault. **OPEN — verify at [j2] implementation**
> - Replaces: [H-D4-filematch](#^H-D4-filematch) (FALSIFIED — filename match alone achieves only ≈12.5%)
> - Negate-first: Find ≥20% of wiki page references that fail to resolve even with slug normalization (e.g., disambiguation suffixes, date-prefixed filenames, frontmatter-only titles).
> - Utility: H — determines whether D4 ships as MVP or needs vault title-index extension
> - Cost: M — implement `pageNameToSlug`, run against baseline file at implementation time
> - Next actions: 1. Implement `pageNameToSlug` per D4 spec 2. Run new D4 resolver against baseline file 3. Count (resolved, broken-with-explicit-reason) for each unique page name 4. If broken-rate >20%, surface as new NBA item before [j2] lock
> - DRI: Agent (verification at implementation phase)

^H-D4-slug

> **[H-D4-factory]** (From [i3] DCI-02) Embedding `FileCache.resolveFile()` calls inside `createLinkObject.ts` factory adds I/O dependency to a previously-pure construction module and gives it a second responsibility (resolution strategy selection).
> - Strengthen: Read `createLinkObject.ts` and confirm it currently has no FileCache dependency; verify the proposed D4 placement adds I/O.
> - Utility: H — determines whether D4 violates Single Responsibility / Scattered Checks
> - Cost: L — single source-code read
> - **Resolution evidence:** Confirmed `createLinkObject.ts` is a pure construction factory calling `resolvePath` (pure path computation, no I/O). **D4 revised** to extract wiki resolution into new sibling module `src/core/MarkdownParser/resolveWikiPath.ts` (mirrors existing `resolvePath.ts` pattern). `createLinkObject.ts` calls `resolveWikiPath()` for wiki bare-page-name case; otherwise calls `resolvePath` unchanged. FileCache stays as injected dependency. Closes DCI-02.

^H-D4-factory

#### D5 — Documentation Alignment + Naming Cleanup

%% *Last Modified: 05/02/26 09:25:30* %%

**Decision:** Update CLAUDE.md "Citation Patterns Supported" + MarkdownParser.ts JSDoc + MarkdownParser Component Guide to enumerate the 10 wikilink forms covered by D1. Old function names removed (replaced by `extractWikilinks` from D1). [^S-D5a] [^S-D5b] [^S-D5c]

**Why update all three docs in the same Delta:** [F-ID: One Invariant One Place applies to documentation as well as code]. Three locations claiming wiki support is itself a violation; updating one and leaving two stale would re-create the drift the [i0] eval flagged as CI-06.

**Why remove old function names rather than rename:** [F-ID: D1 already replaces them]. Renaming `extractWikiCrossDocLinks` → `extractWikilinks` would still leave the second function (`extractWikiInternalLinks`) as a partial implementation. D1's grammar consolidation makes both obsolete; deletion is cleaner than rename + dead-code retention.

### 7c. Domain Translation

%% *Last Modified: 05/02/26 09:25:30* %%

All Deltas are code-domain. No skill/prompt/org translations required for this plan. Skipping the per-domain breakdown; full code mapping is in 7a.

### 7d. NBA Prioritization

%% *Last Modified: 05/02/26 12:40:11* %%

11 NBA items total (8 prior + 3 added after [i1]-re-entry post-[7g] gaps): 9 Resolved, 2 Open (verify at implementation/[k]). The [i1] re-entry round added [H-D4-suggestion-threshold] (Open), [A-D3-adr-pending] (Open until [k]), and [Q-source-mapping-update] (Resolved by Type 2 grep — `CitationValidator.ts` already mapped at S1c; `stringDistance.ts` is reused-only and does not require new source-mapping row).

| ID | Type | Description | Status | Resolution |
|----|------|-------------|--------|------------|
| ~~[H-D1-regex](#^H-D1-regex)~~ | [H] | Single regex with optional groups handles all 10 wikilink forms vs. multiple narrow regexes | **Confirmed** | Designed regex `/\[\[([^\|\]#]+)(?:#([^\|\]]+))?(?:\|([^\]]+))?\]\]/g` — verified against baseline file. All 11 wikilink occurrences captured correctly; optional groups handle missing `#section` and `\|display`. No greedy/non-greedy interaction failure with `]]` boundary because `[^\]]+` is non-greedy by exclusion. Implementation may use this regex directly. |
| ~~[H-D2-perf]~~ | [H] | Residual `[[...]]` scan adds <5ms for files under 1MB | **Confirmed by reasoning** | Largest wiki file in scope is 160KB (`/0-documents/llm-wiki/_inbox/papers-and-articles-summaries/260330162000-mamba/2312.00752/2312.00752.md`). Single linear regex pass over 160KB on V8 is sub-millisecond. 5ms budget has ≥10× headroom. Benchmark deferred — re-open this NBA item if any future scope expansion brings vault to multi-MB files. |
| ~~[A-D3-exitcode](#^A-D3-exitcode)~~ | [A] | LLM agents and CI scripts treat exit code 1 as "fix this before continuing" | **Resolved (no current consumers to break)** | Grep across `**/*.{yml,yaml,sh,json,toml}` in `jact/` returned 2 matches — both are design-doc YAML files (`design-docs/features/20260429-validate-llm-optimized-output/{success-criteria,constraints}.yaml`), not active CI/hook scripts. No `.github/workflows/`, `.husky/`, `.claude/hooks/`, or `.claude/settings.json` script consumes `jact validate` exit code today. D3 ships with new exit-code logic; downstream agents that begin consuming exit codes will see correct fail-loud behavior from day one. |
| ~~[H-D4-filematch](#^H-D4-filematch)~~ | [H] | ≥80% of wikilink resolutions in target vault succeed via filename match without ambiguity | **Confirmed** — falsified; spawned [H-D4-slug](#^H-D4-slug) | Survey of baseline file: 8 unique page names; only 1 (`the-hardening-principle`) matches FileCache directly. The other 7 use Title Case forms. Match rate ≈12.5%, far below 80% threshold. D4 revised — added `pageNameToSlug` slug normalization step. |
| [H-D4-slug](#^H-D4-slug) | [H] | Slug normalization (`"The Hardening Principle"` → `the-hardening-principle.md`) raises wiki page resolution rate to ≥80% in target vault | **Open** — verify at [j2] implementation | Will be validated by running new D4 resolver against baseline file; assert all 8 referenced pages either resolve or produce explicit broken-link reasons. |
| ~~[H-D3-linkclass](#^H-D3-linkclass)~~ | [H] | (From [i3] DCI-01) `byLinkType: Record<LinkType, number>` cannot produce a `caret` bucket because `LinkObject.linkType` is `"markdown" \| "wiki"` only; caret citations are `linkType: "markdown"` with `anchorType: "block"`. Original D3 spec was unimplementable as written. | **Confirmed (Delta revised)** | Verified at `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/types/citationTypes.ts:29` — `linkType: "markdown" \| "wiki"`. **D3 revised** to introduce a separate display-layer type `LinkClass = "markdown" \| "wiki" \| "caret"` and a `getLinkClass(link: LinkObject): LinkClass` classifier in new `src/core/getLinkClass.ts`. ReportSummary uses `byLinkClass`. Closes DCI-01 and fully resolves CI-05. |
| ~~[H-D3-exitwire](#^H-D3-exitwire)~~ | [H] | (From [i3] DCI-03) Exit code at `jact.ts:1288-1293` string-matches `"FAILED:"` / `"VALIDATION FAILED"`. D3's `OK: ... (... N unrecognized)` output starts with `OK:` → exits 0 → silent pass even when unrecognized brackets are present. | **Confirmed (Delta revised)** | Verified at `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts:1280-1295`. Current logic: `process.exit(result.includes("FAILED:") \|\| result.includes("VALIDATION FAILED") ? 1 : 0)`. **D3 revised** to refactor exit-code path to read the structured `ValidationReport.summary` field directly: `process.exit(parsed.summary.errors > 0 \|\| parsed.summary.unrecognizedCount > 0 ? 1 : 0)`. Display string becomes purely cosmetic. Closes DCI-03 and fully resolves CI-03. |
| ~~[H-D4-factory](#^H-D4-factory)~~ | [H] | (From [i3] DCI-02) D4 originally embedded `FileCache.resolveFile()` calls inside `createLinkObject.ts` factory. The factory currently has one job (construct LinkObject, call `resolvePath`, return) with no I/O dependency. Adding FileCache I/O makes the factory stateful, harder to test, and gives it a second responsibility. | **Confirmed (Delta revised)** | Verified at `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/MarkdownParser/createLinkObject.ts` — pure construction, calls `resolvePath` for path resolution. **D4 revised** to extract wiki resolution into new sibling module `src/core/MarkdownParser/resolveWikiPath.ts` (mirrors existing `resolvePath.ts` pattern). `createLinkObject.ts` calls `resolveWikiPath()` for wiki bare-page-name case; `resolvePath()` unchanged for all other cases. FileCache stays as injected dependency, not baked into factory. Closes DCI-02. |
| ~~[A-D2-schema](#^A-D2-schema)~~ | [A] | (From [i3] DCI-04) D2 adds `unrecognized: UnrecognizedSyntaxRecord[]` as a parallel array on `ValidationReport`, alongside existing `links` and `summary`. Current JSON consumers that destructure `{ summary, links }` will silently miss the new field. | **Resolved (note added; no current consumers)** | NBA grep already confirmed no active JSON consumers of `jact validate` output exist today (only design-doc YAML references). D2 row in §7a updated with explicit "Schema departure note" in the Notes column listing the new field shape and the consumer-migration path (use `summary.unrecognizedCount` for count-only; destructure `unrecognized` for per-occurrence detail). Future consumers adopt the new shape from day one. Closes DCI-04. |
| [H-D4-suggestion-threshold](#^H-D4-suggestion-threshold) | [H] | (From [i1]-re-entry GAP-7, revised post-[7g] per [GAP-8](#^GAP-8)) Basename-Levenshtein matching with adaptive threshold `clamp(3, 10, floor(0.2 × candidateRelativePath.length))` (threshold scales with full path length so deeper paths get proportional typo headroom) and full-relative-path display (with multi-match comma-list for duplicate basenames) produces useful wiki-page suggestions in ≥80% of broken-wiki cases without surfacing spurious matches, AND surfaces parent-folder context (e.g., `concepts/` vs `summaries/`) so agents can self-correct on duplicate-basename ambiguity. | **Open** — verify at [m] implementation | Threshold + display validated by running new D4 (e) suggester against baseline file's 7 unresolvable wiki references; assert (1) ≥6 of 7 either get a useful suggestion or correctly produce no suggestion, (2) when ≥2 vault files share a basename within threshold, suggestion lists all matching full relative paths separated by `, `. If spurious-match rate exceeds 20%, OR if duplicate-basename cases fail to surface folder context, surface as new NBA item before [j2] re-lock. |
| [A-D3-adr-pending](#^A-D3-adr-pending) | [A] | (From [i1]-re-entry GAP-6) The `manager.validate()` return-shape change from `Promise<string>` to `Promise<{ output, result }>` is a Type I interface contract change. An ADR is required so future maintainers can trace why the contract changed. | **Open** — write ADR at [k] before DIFFs land | Add to [k] DIFF phase: write ADR-NNN documenting the return-shape change, the GAP-6 motivation (display-string-coupled exit code is a Hardening-Principle violation), and the migration path for any future caller. ADR location: `design-docs/adrs/`. |
| ~~[Q-source-mapping-update](#^Q-source-mapping-update)~~ | [Q] | (From [i1]-re-entry GAP-7) Does the GAP-7 amendment (D4 (e) Levenshtein suggestion using `src/utils/stringDistance.ts`) require amending §6 Source Mapping table? | **Resolved by Type 2 grep** | Grep across plan.md confirmed: (a) `src/CitationValidator.ts` already mapped at S1c (line 136); GAP-7 wiring there is in scope of existing mapping. (b) `src/utils/stringDistance.ts` is a reuse-only dependency (no modification); per source-mapping convention (file mapped only when a Delta modifies it), no new row required. (c) The D4 row in §7a (e) explicitly lists both files in its target list for traceability. No §6 amendment needed; no §3 artifacts-table amendment needed. |

> **[H-D4-suggestion-threshold]** (From [i1]-re-entry GAP-7, revised post-[7g] per [GAP-8](#^GAP-8)) Basename-Levenshtein matching with adaptive threshold `clamp(3, 10, floor(0.2 × candidateRelativePath.length))` (threshold scales with full path length so deeper paths get proportional typo headroom) and full-relative-path display (with multi-match comma-list for duplicate basenames) produces useful wiki-page suggestions in ≥80% of broken-wiki cases without surfacing spurious matches, AND surfaces parent-folder context so agents can self-correct on duplicate-basename ambiguity (e.g., `wiki/concepts/the-hardening-principle.md` vs `wiki/summaries/the-hardening-principle.md`).
> - Negate-first: (1) Find ≥3 broken wiki references where adaptive threshold surfaces an irrelevant basename (e.g., suggests `the-hardening-method.md` when intent was `the-hardening-principle.md` because basename distance happens to fall under threshold). (2) Find a duplicate-basename case where the suggestion line shows only one path (silently dropping the alternative), defeating the disambiguation purpose.
> - Utility: H — determines whether threshold + display are correctly tuned before ship; directly affects how trustworthy the `suggestion:` line is to LLM agents creating wiki files "willy nilly" across `concepts/`, `summaries/`, and similar folder taxonomies.
> - Cost: M — implement D4 (e) revised per §7a, run against baseline file's 7 unresolvable wiki references at implementation time.
> - Next actions: 1. Implement D4 (e) per revised spec (basename match + adaptive threshold + multi-match full-path display) 2. Run D4 (e) against the 7 unresolvable wiki page names from the baseline file 3. For each, score (useful suggestion / no suggestion / spurious suggestion); separately assert any duplicate-basename case lists all matching full relative paths 4. If spurious rate >20% OR duplicate-basename cases drop alternatives, tune threshold formula (e.g., adjust 0.2 ratio or floor/ceiling) or expand display rule, surface as new NBA item.
> - DRI: Agent (verification at [m] implementation phase)

^H-D4-suggestion-threshold

> **[A-D3-adr-pending]** (From [i1]-re-entry GAP-6) The `manager.validate()` return-shape change from `Promise<string>` to `Promise<{ output, result }>` is a Type I interface contract change. An ADR is required so future maintainers can trace why the contract changed.
> - Strengthen: Confirm at [k] that the DIFF phase task list includes "write ADR-NNN" as an explicit deliverable; verify ADR template exists at `design-docs/adrs/`.
> - Utility: M — without ADR, future readers have no rationale trail for why `validate()` returns a tuple instead of a string; forces archaeological reading of the plan file.
> - Cost: L — single ADR document, ~1 page.
> - Risk-if-wrong: A future contributor "simplifies" `validate()` back to `Promise<string>`, breaking the structured-field exit-code contract and re-introducing the silent-pass failure mode at the exit-code layer. ADR is the durable defense.
> - Next actions: 1. At [k] DIFF phase, add explicit task: "Write ADR-NNN documenting `manager.validate()` return-shape change" 2. ADR cites GAP-6 and Hardening-Principle motivation 3. ADR includes migration note for any future caller 4. Mark Resolved when ADR is committed.
> - DRI: Agent (at [k] DIFF phase, before DIFFs are applied)

^A-D3-adr-pending

> **[Q-source-mapping-update]** (From [i1]-re-entry GAP-7) Does the GAP-7 amendment (D4 (e) Levenshtein suggestion using `src/utils/stringDistance.ts` and writing to `src/CitationValidator.ts`) require amending §6 Source Mapping table or §3 Artifacts Table?
> - Strengthen: Grep plan.md for prior references to both files; check existing source-mapping convention for "reuse" vs. "modify" file inclusion rules.
> - Utility: H — determines whether [j2] re-lock requires re-locking source mapping (cascades back two HARD GATEs).
> - Cost: L — single grep + convention check.
> - **Resolution evidence:** Grep confirmed (a) `src/CitationValidator.ts` already mapped at S1c (line 136 in §6) — GAP-7 wiring in CitationValidator.ts falls within existing mapping scope. (b) `src/utils/stringDistance.ts` is reuse-only (D4 (e) calls existing function, no modification) — source mapping convention is to map files that a Delta MODIFIES; reuse-only dependencies are noted in §7a "File" column instead. (c) D4 row in §7a (e) explicitly lists both files in its target list for traceability. **Conclusion:** No §6 amendment required; no §3 amendment required. [j2] re-lock does not cascade back to [h5b].

^Q-source-mapping-update

### 7e. Validation Table

%% *Last Modified: 05/02/26 09:25:30* %%

For each Ideal [O] from §5, this table maps O → D → verification method. Verification commands MUST run against the live baseline reproduction file (`0-documents/llm-wiki/wiki/concepts/probabilistic-vs-deterministic-systems.md`) where possible.

| BI # | Ideal [O] | Delta(s) | Acceptance Criteria | Verification Method |
|------|-----------|----------|---------------------|---------------------|
| BI-1 | Validator user can identify broken links of any supported syntax in a file (markdown, wikilink, caret), with no class of link silently skipped | D1, D4 | (a) `jact validate <baseline-file>` reports ≥7 broken wikilinks (matches the known-broken count). (b) `--verbose` lists each wikilink occurrence with `linkType: "wiki"`. | Run `jact validate 0-documents/llm-wiki/wiki/concepts/probabilistic-vs-deterministic-systems.md --verbose` post-implementation; assert ≥7 broken wikilinks reported with line numbers. |
| BI-2 | Validator user can review a per-file report that distinguishes which classes of links were processed and which were not, so they can detect silent skip behavior | D2, D3 | (a) Summary line includes `byLinkType` breakdown. (b) Non-zero `unrecognizedCount` produces per-occurrence diagnostic with line + raw text. | Construct test file with one `[[Page]]`, one `[[#anchor]]`, one `[[malformed[[`. Assert summary shows wiki: 2, unrecognized: 1; diagnostic prints `[[malformed[[` with location. |
| BI-3 | LLM agent receives a verdict whose scope matches the file's link inventory, so a green result is trustworthy across the full link surface | D1, D2, D3 | Exit code 0 IFF (a) all links resolved AND (b) `unrecognizedCount === 0`. Exit code 1 otherwise. | Test matrix: (file with all links valid + zero unrecognized → exit 0); (file with one broken wikilink → exit 1); (file with one unrecognized bracket sequence → exit 1). |
| BI-4 | Wiki maintainer can confirm cross-references stay correct across the entire link surface of the vault, including wikilinks, so renames and removals never produce dangling references undetected | D1, D4 | (a) Renaming a wiki page produces broken-link errors for all `[[Old Page]]` references on next validate. (b) Bare page name `[[Page Name]]` resolves via FileCache to `Page Name.md` in scope. | Pre/post rename test: validate before rename (zero errors), rename file, re-validate (errors for each referrer). Assert error reason includes `"wiki page not found in vault"`. |
| BI-5 | Author can see which links they wrote in any supported syntax fail to resolve, so the choice of link syntax does not change which errors are surfaced | D1 | A markdown link `[X](missing.md)` and a wikilink `[[Missing Page]]` both produce broken-link errors with comparable diagnostic detail (file, line, column, target, reason). | Construct twin-form test file. Assert validation report contains both errors with parallel structure. |
| BI-6 | Tool integrator can read a list of supported citation patterns and trust that listed patterns are validated identically, with no documentation-implementation gap on coverage | D5 | (a) CLAUDE.md "Citation Patterns Supported" enumerates exactly the 10 wikilink forms. (b) MarkdownParser JSDoc lists same 10. (c) Each documented form has a corresponding test asserting parser produces a `LinkObject` for it. | Doc-implementation parity test: parse the documentation list, parse the test fixture, assert sets equal. Failing this test means D5 is incomplete or D1 has drifted. |

### 7f. [i3] Delta Architecture Eval Results

%% *Last Modified: 05/02/26 09:32:35* %%

#### Post-[i3] Resolution Status

%% *Last Modified: 05/02/26 11:51:10* %%

All 4 DCI findings from the [i3] eval below have been resolved in the i1-nba re-loop. The eval tables are preserved as historical record.

| DCI ID | Severity | Status | Resolution Mechanism |
|--------|----------|--------|----------------------|
| DCI-01 | Critical | ✅ Resolved | D3 revised — new `LinkClass = "markdown" \| "wiki" \| "caret"` display-layer type + `getLinkClass(link): LinkClass` classifier in `src/core/getLinkClass.ts`; `ReportSummary.byLinkClass: Record<LinkClass, number>` |
| DCI-02 | Medium | ✅ Resolved | D4 revised — wiki resolution extracted into new sibling `src/core/MarkdownParser/resolveWikiPath.ts`; `createLinkObject.ts` stays a pure factory calling the resolver instead of embedding FileCache logic |
| DCI-03 | High | ✅ Resolved | D3 revised — exit-code path refactored to read structured `ValidationReport.summary` field; `process.exit(parsed.summary.errors > 0 \|\| parsed.summary.unrecognizedCount > 0 ? 1 : 0)` for all branches; display string is purely cosmetic |
| DCI-04 | Low | ✅ Resolved | D2 row in §7a updated with explicit Schema departure note; NBA grep confirmed no current JSON consumers; future consumers adopt new shape from day one |

**Updated CI closure status (post-revision):** All 8 [i0] CIs (CI-01 through CI-08) now fully closed by the revised Delta. CI-03 closed by D2 + revised D3 (structured exit-code drives loud-fail). CI-05 closed by revised D3 (`byLinkClass` produces correct 3-bucket breakdown).

**Workflow state:** [j2] HARD GATE pending USER review. Two re-loops complete: (1) post-[i3] DCI resolution; (2) post-[7g] UI-sketch GAP resolution (7 amendments to D2/D3/D4 §7a, 3 NBA items added, 1 resolved). Open NBA items: [H-D4-slug](#^H-D4-slug) (verify at [m]), [H-D4-suggestion-threshold](#^H-D4-suggestion-threshold) (verify at [m]), [A-D3-adr-pending](#^A-D3-adr-pending) (write at [k]).

---

#### Citation Context

%% *Last Modified: 05/02/26 09:32:35* %%

`jact extract links` not run against the plan file (wikilink gap is still unfixed at evaluation time). Source files read directly:
- `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/MarkdownParser/extractLinks.ts` (lines 410-499)
- `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/types/validationTypes.ts` (full)
- `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/types/citationTypes.ts` (full)
- `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/MarkdownParser/createLinkObject.ts` (full)
- `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/MarkdownParser/resolvePath.ts` (full)
- `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/FileCache.ts` (full)
- `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts` (lines 200-500, 640-700, 1270-1295)
- `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/CitationValidator.ts` (lines 303-342)
- Architecture Principles: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/workflows/tools/jact/ARCHITECTURE-PRINCIPLES.md`

---

#### Results Summary

%% *Last Modified: 05/02/26 09:32:35* %%

| Principle Category | Status | Highest-Severity DCI |
|--------------------|--------|----------------------|
| Modular Design | ⚠️ Partial | DCI-02: D4 places FileCache resolution logic inside `createLinkObject.ts` (construction factory), violating SRP |
| Data-First Design | ❌ Violates | DCI-01 (Critical): D3 proposes `byLinkType: Record<LinkType, number>` but displays `caret: N` — caret is not a `linkType` value; illegal state in the proposed schema |
| Action-Based File Organization | ✅ Compliant | New `src/utils/wikiPageSlug.ts` with primary export `pageNameToSlug` is correctly placed and named |
| Format/Interface Design | ❌ Violates | DCI-03: D3 exit-code contract is broken — CLI output for `unrecognizedCount > 0` emits `OK: N citations valid (... 1 unrecognized)` but `jact.ts:1288-1293` triggers exit 1 only on `"FAILED:"` / `"VALIDATION FAILED"` string presence |
| MVP Principles | ✅ Compliant | D4 MVP limitations (disambiguation suffixes) correctly scoped and documented |
| Deterministic Offloading | ✅ Compliant | D2 residual scan is deterministic; D3 fail-loud on unrecognized is correct in intent |
| Self-Contained Naming | ✅ Compliant | `extractWikilinks`, `pageNameToSlug`, `UnrecognizedSyntaxRecord` all self-describing |
| Safety-First Design | ⚠️ Partial | DCI-03 (see above): D3 fail-fast on unrecognized is designed but the exit-code wire-up is incomplete |
| Anti-Patterns | ⚠️ Partial | DCI-02: Resolution concern (FileCache + slug lookup) leaks into construction factory — scattered resolution logic |

---

#### Findings & Required-Revision Table

%% *Last Modified: 05/02/26 09:32:35* %%

| DCI ID | Severity | Principle Violated | Evidence | Description | Required Revision | CEO Translation |
|--------|----------|--------------------|----------|-------------|-------------------|-----------------|
| DCI-01 | **Critical / Blocking** | Data-First — Illegal States Unrepresentable (`^illegal-states-unrepresentable`); One Source of Truth (`^one-source-of-truth`) | `citationTypes.ts:29`: `linkType: "markdown" \| "wiki"` — caret is NOT a linkType. D3 §7a example output: `(markdown: 30, wiki: 10, caret: 2)`. D3 §7b proposes `byLinkType: Record<LinkType, number>`. | D3 proposes a `byLinkType` summary field keyed by `LinkType`. But `LinkType` (the actual type union) is only `"markdown" \| "wiki"`. Caret-syntax links have `linkType: "markdown"` and `anchorType: "block"` — they are NOT a distinct link type. The D3 example output `(caret: 2)` cannot be produced by iterating `links` grouped by `linkType`. To produce a three-bucket breakdown the code would need to branch on `(linkType === "markdown" && anchorType === "block")` as a special case. This either (a) makes the schema design wrong — `byLinkType` is misnamed if it actually groups by `linkType + anchorType` — or (b) requires adding `"caret"` to the `linkType` union, which is a type-model change not mentioned in the Delta. Either way, the proposed schema cannot produce the documented output without violating the type system or adding hidden branching logic. | **Before [j2] lock:** Revise D3 to one of: (a) name the field `byLinkClass` and define a new `LinkClass = "markdown" \| "wiki" \| "caret"` type derived from `(linkType, anchorType)` — clearly document it is a display-layer classification, not a schema linkType; OR (b) drop the `caret` bucket from the display format and emit only `(markdown: N, wiki: N; K unrecognized)`. Option (a) is preferred — it retains full auditability. | |
| DCI-02 | **Medium** | Modular Design — Single Responsibility (`^single-responsibility`); Anti-Patterns — Scattered Checks (`^scattered-checks`) | `createLinkObject.ts`: currently has one job (construct LinkObject from params, call `resolvePath`, return). D4 proposes adding `if (linkType === "wiki" && rawPath has no "/")` + two `FileCache.resolveFile()` calls inside this factory. `FileCache` is not currently a dependency of `createLinkObject.ts`. | D4 routes wiki page-name resolution through `createLinkObject.ts` by adding FileCache lookups inside the factory. This gives the construction factory a second concern: file resolution strategy selection. `createLinkObject.ts` currently calls `resolvePath(rawPath, sourceAbsolutePath)` — a pure path computation with no I/O. Adding FileCache calls introduces a stateful, I/O-dependent operation into what was a pure factory. The resolution concern belongs in `resolvePath.ts` (extended for wiki paths) or in a new `resolveWikiPath.ts` sibling, called by `createLinkObject.ts` via the same pattern it already uses for `resolvePath`. This also affects testability: `createLinkObject.ts` currently needs no mocks; post-D4, it requires a FileCache instance. | **Recommended before [j2]:** Revise D4 to extract wiki path resolution into `resolvePath.ts` (add a wiki-aware branch) or a new `src/core/MarkdownParser/resolveWikiPath.ts`. `createLinkObject.ts` calls `resolveWikiPath(rawPath, sourceAbsolutePath, fileCache?)` instead of embedding FileCache logic directly. FileCache remains an optional dependency injected at parse time, not baked into the factory. | |
| DCI-03 | **High / Blocking** | Safety-First — Fail Fast (`^fail-fast`); Clear Contracts (`^clear-contracts`); Format/Interface — Simplicity First (`^simplicity-first`) | `jact.ts:1285-1293` exit-code logic: CLI path checks `result.includes("FAILED:")` or `result.includes("VALIDATION FAILED")` to set exit 1. D3's proposed success-line format for non-zero `unrecognizedCount`: `OK: 42 citations valid (markdown: 30, wiki: 10, caret: 2; 1 unrecognized)`. | D3 intends exit code 1 when `unrecognizedCount > 0`. But the current CLI-mode exit-code logic in `jact.ts:1288-1293` fires exit 1 only when the output string contains `"FAILED:"` or `"VALIDATION FAILED"`. D3's proposed output line for the unrecognized case starts with `OK:` — it does NOT contain `"FAILED:"`. Therefore, a file with unrecognized wikilink syntax will exit 0 (green) after D3 ships, defeating the entire Hardening Principle goal of the feature. This is a concrete wire-up gap between the design intent in §7b and the actual exit-code mechanism in the codebase. The gap exists because the design describes the summary line format but does not update the exit-code trigger logic. | **Before [j2] lock:** D3 must explicitly specify either: (a) the unrecognized-case output line begins with `FAILED:` instead of `OK:` (simplest — aligns with existing trigger pattern); OR (b) `jact.ts` exit-code logic is extended to parse `unrecognizedCount` from the summary line; OR (c) `ValidationResult` carries an `unrecognizedCount` field that the exit-code path checks directly (preferred — removes string-parsing fragility). Add this as an explicit item in §7a D3's "After" column. | |
| DCI-04 | **Low** | Format/Interface — Progressive Defaults (`^progressive-defaults`); Stable Schemas (`^stable-schemas`) | `validationTypes.ts`: current `ValidationResult` shape has `summary`, `links`, `validationTime`. D2 proposes adding `unrecognized: UnrecognizedSyntaxRecord[]` as a new top-level field. D3 proposes adding `byLinkType` (or `byLinkClass`) and `unrecognizedCount` to `ValidationSummary`. | D2 proposes `unrecognized` as a parallel array alongside `links` in `ValidationResult`. This departs from the existing enrichment pattern where all per-item data lives in `links` and all aggregate data lives in `summary`. `UnrecognizedSyntaxRecord` items are parse-time findings — per the enrichment pattern, they would normally join `links` with a special `validation.status`. However, they cannot be `EnrichedLinkObject` because they were never parsed into `LinkObject`s. The design choice to add a separate array is arguably correct (they are not links), but it adds a second iteration target for consumers of `ValidationResult`. The `--format json` output will now have a third top-level array. Existing JSON consumers (CI scripts, LLM agents) that destructure `{ summary, links }` will silently miss `unrecognized`. | **Recommend before [j2]:** §7a D2 should note the schema departure explicitly. Either (a) accept the new field and add a migration note for JSON consumers (low risk — NBA confirmed no active consumers), or (b) surface `unrecognized` records as a count-only field in `summary` (simpler schema, less per-item detail). Accept as-is given NBA confirmed no current JSON consumers; document the schema change in §7a D2 notes. | |

---

#### CI Coverage Verification (§7a.2 Claims)

%% *Last Modified: 05/02/26 09:32:35* %%

The §7a.2 table claims all 8 CIs are closed. Verification against principle definitions:

| CI ID | §7a.2 Claim | Verified? | Notes |
|-------|-------------|-----------|-------|
| CI-01 (Critical) | D1 closes via broadened grammar | ✅ Yes | D1 grammar regex covers all 10 Obsidian forms |
| CI-02 (High) | D1 feeds wiki LinkObjects to live validator routing | ✅ Yes | `classifyPattern` at CitationValidator.ts:312-319 already routes `linkType: "wiki"` |
| CI-03 (Critical) | D2 + D3 close via residual scanner + exit code | ⚠️ Partial | D2 scanner emits `UnrecognizedSyntaxRecord` correctly; D3 exit-code wire-up is broken (DCI-03) — CI-03 NOT fully closed until DCI-03 resolved |
| CI-04 (Medium) | D1 closes via single grammar function | ✅ Yes | One regex replaces two scattered regex sites |
| CI-05 (High) | D3 closes via `byLinkType` + `unrecognizedCount` | ⚠️ Partial | Closes the display-format gap, but `byLinkType` schema has `caret` category mismatch (DCI-01) — CI-05 NOT fully closed until DCI-01 resolved |
| CI-06 (Medium) | D5 closes via doc alignment | ✅ Yes | Three documentation sites updated in same Delta |
| CI-07 (Low) | D5 closes via function deletion + rename | ✅ Yes | Old extractors removed; `extractWikilinks` replaces both |
| CI-08 (Low) | D4 closes via FileCache reuse + slug normalization | ✅ Yes (with note) | Correct approach; DCI-02 recommends extraction of resolution logic out of createLinkObject.ts — does not block correctness |

**Net result: CI-01, CI-02, CI-04, CI-06, CI-07, CI-08 are cleanly closed by Delta. CI-03 and CI-05 are partially closed pending DCI-03 and DCI-01 revisions respectively.**

---

#### Prioritized Findings

%% *Last Modified: 05/02/26 09:32:35* %%

##### Fix Now (Blocking [j2] Lock)

%% *Last Modified: 05/02/26 09:32:35* %%

1. **DCI-01** (Critical) — `byLinkType: Record<LinkType, number>` cannot produce a `caret` bucket from the type system. Illegal state in the proposed schema. Blocks CI-05 closure and produces uncompilable or incorrect D3 code. Requires Delta revision before lock.

2. **DCI-03** (High) — D3 exit-code wire-up is broken: unrecognized syntax produces `OK:` output, which exits 0 under current `jact.ts:1288-1293` logic. Core Hardening Principle goal of D3 (fail loud on unrecognized) will silently fail at ship. Requires explicit specification of how exit-code trigger fires for unrecognized case.

##### Fix Before Implementation (Recommended)

%% *Last Modified: 05/02/26 09:32:35* %%

3. **DCI-02** (Medium) — FileCache resolution logic leaks into `createLinkObject.ts` factory. Does not block correctness but adds I/O dependency to a previously-pure module and makes tests harder. Recommend extracting into `resolveWikiPath.ts` or extending `resolvePath.ts`.

##### Accept / Note

%% *Last Modified: 05/02/26 09:32:35* %%

4. **DCI-04** (Low) — `unrecognized` as a parallel array in `ValidationResult` departs from enrichment pattern. Acceptable given NBA confirmed no active JSON consumers. Should be noted in D2 spec column.

## 7g. UI Sketch — CLI Output Validation

%% *Last Modified: 05/02/26 11:15:12* %%

### 7g.1 Scope and Method

%% *Last Modified: 05/02/26 11:15:12* %%

**Purpose:** Validate that Deltas D1–D5 produce coherent stdout across all three CLI output modes (minimal default, `--verbose`, `--format json`) and that the exit-code path stays loud-fail across every mode. This is a validation pass on locked Deltas — not exploration of alternatives.

**Method:** Pick one realistic test scenario from the baseline reproduction file. Sketch the **Before** (current main) and **After** (post-D1–D5) output for each mode. Surface any specification gaps where a Delta's stated intent is not fully expressed in stdout.

**Inputs verified before sketching:**
- Current `formatForCLI` (verbose) — `jact/src/jact.ts:380-497`
- Current `formatForCLIMinimal` — `jact/src/jact.ts:505-572`
- Current `formatAsJSON` — `jact/src/jact.ts:579-581`
- Current exit-code logic — `jact/src/jact.ts:1275-1296`
- Current `ValidationResult` schema — `jact/src/types/validationTypes.ts:69-73`

### 7g.2 Test Scenario

%% *Last Modified: 05/02/26 11:15:12* %%

**File:** `0-documents/llm-wiki/wiki/concepts/probabilistic-vs-deterministic-systems.md`

**Link inventory in the file** (per [H-D1-regex] resolution evidence):

| Class | Count | Examples |
|-------|-------|----------|
| Markdown links | ~30 | `[Some Doc](some-doc.md)` |
| Caret citations | ~2 | `^FR1`, `^US1-1AC1` |
| Wikilinks (parser-visible today) | 0 | (parser regexes match no occurrences in this file) |
| Wikilinks (parser-blind today) | 11 | `[[The Hardening Principle]]`, `[[Silent Failure]]`, etc. |
| Unrecognized brackets | 1 (synthetic) | `[[malformed[[` (added to test fixture) |

**Expected post-Delta resolution outcomes** for the 11 wikilinks:
- ✅ 1 resolves via filename: `[[the-hardening-principle\|The Hardening Principle]]` → `the-hardening-principle.md`
- ✅ ~6 resolve via slug normalization (D4): `[[The Hardening Principle]]` → `the-hardening-principle.md`, etc.
- ❌ ~4 break with explicit reason: disambiguation suffixes like `[[The Hardening Principle (concept)]]`, etc.
- 🚨 1 unrecognized: `[[malformed[[`

This produces the test matrix below.

### 7g.3 Minimal Mode (default `jact validate`)

%% *Last Modified: 05/02/26 11:15:12* %%

#### Before (main today)

%% *Last Modified: 05/02/26 11:15:12* %%

```
OK: 32 citations valid
```

(11 wikilinks invisible to parser → not counted, not validated. Synthetic `[[malformed[[` invisible. Exit 0. Silent pass.)

#### After (post-D1–D5)

%% *Last Modified: 05/02/26 12:41:22* %%

```
ERRORS (4)
- Line 14: [[The Hardening Principle (concept)]]
  error: wiki page not found in vault (tried: The Hardening Principle (concept), the-hardening-principle-concept.md)
  suggestion: wiki/concepts/the-hardening-principle.md, wiki/summaries/the-hardening-principle.md, raw-sources/claude-code-principles/the-hardening-principle.md
- Line 22: [[The Hardening Principle (concept)]]
  error: wiki page not found in vault (tried: The Hardening Principle (concept), the-hardening-principle-concept.md)
  suggestion: wiki/concepts/the-hardening-principle.md, wiki/summaries/the-hardening-principle.md, raw-sources/claude-code-principles/the-hardening-principle.md
- Line 38: [[The Hardening Principle (concept)]]
  error: wiki page not found in vault (tried: The Hardening Principle (concept), the-hardening-principle-concept.md)
  suggestion: wiki/concepts/the-hardening-principle.md, wiki/summaries/the-hardening-principle.md, raw-sources/claude-code-principles/the-hardening-principle.md
- Line 51: [[Hardening Principle — Open Questions Research]]
  error: wiki page not found in vault (tried: Hardening Principle — Open Questions Research, hardening-principle-open-questions-research.md)
  suggestion: wiki/syntheses/hardening-principle-open-questions.md

UNRECOGNIZED (1)                                            ← GAP-1: D2 does not specify this section
- Line 79: [[malformed[[
  reason: bracket sequence did not match wikilink grammar

FAILED: 4 errors, 1 unrecognized                            ← GAP-2: spec says minimal-mode summary lives on the OK: line, not FAILED: line
```

**Note on suggestions:** Per D4 (e) revised post-[7g] (see [GAP-8](#^GAP-8)), when wiki resolution fails the validator computes Levenshtein distance from the attempted slug against the **basename** of every FileCache file. **Adaptive threshold scales with each candidate's full relative path length**: `clamp(3, 10, floor(0.2 × candidateRelativePath.length))` — deeper paths get proportional typo headroom. If exactly 1 candidate is within threshold → `validation.suggestion` = full relative path; if ≥2 candidates (duplicate basenames in different folders) → comma-separated list of full relative paths so the agent sees parent-folder context (e.g., `wiki/concepts/...` vs `wiki/summaries/...`).

**How suggestions fire on the 4 errors above:**

| Slug attempted | Closest basename | Basename dist | Candidate full path | Path len | Threshold | Match? |
|----------------|------------------|---------------|---------------------|----------|-----------|--------|
| `the-hardening-principle-concept.md` | `the-hardening-principle.md` | 8 | `wiki/concepts/the-hardening-principle.md` | 40 | 8 | ✅ |
| same | same | 8 | `wiki/summaries/the-hardening-principle.md` | 41 | 8 | ✅ |
| same | same | 8 | `raw-sources/claude-code-principles/the-hardening-principle.md` | 60 | 10 | ✅ |
| `hardening-principle-open-questions-research.md` | `hardening-principle-open-questions.md` | 9 | `wiki/syntheses/hardening-principle-open-questions.md` | 52 | 10 | ✅ |

Lines 14/22/38 (3 candidates within threshold) → multi-match comma-list. Line 51 (1 candidate) → single full path. Agents creating files "willy nilly" across `concepts/`, `summaries/`, `raw-sources/` see the duplicate-basename ambiguity surfaced explicitly.

**Trace to Deltas:**

| stdout fragment | Delta | Source |
|-----------------|-------|--------|
| `ERRORS (4)` + per-occurrence wiki errors | D1 (parser sees them) + D4 (resolution attempts the slugs and fails loud) | §7a D1, §7a D4 |
| `suggestion: <full relative path(s)>` line under broken wiki errors (when basename distance ≤ adaptive threshold) | D4 (e) (revised post-[7g] per [GAP-8](#^GAP-8)) | §7a D4 (e) |
| `UNRECOGNIZED (1)` section + per-occurrence | D2 (residual scanner emits records) | §7a D2 |
| `FAILED: 4 errors, 1 unrecognized` summary | D3 (coverage qualifier on summary) | §7a D3 |
| Exit code 1 | D3 (structured-field exit-code path) | §7a D3 |

#### Validation findings

%% *Last Modified: 05/02/26 12:41:38* %%

> **~~[GAP-1]~~** **Status: ✅ Resolved** ([i1]-re-entry, 05/02/26). D2 specifies emitting `UnrecognizedSyntaxRecord` per occurrence but does not specify WHERE in minimal/verbose CLI output the per-occurrence records print. Without an `UNRECOGNIZED (K)` section parallel to `ERRORS (N)` and `WARNINGS (M)`, the "loud fail" collapses to a count-only signal — the user/agent sees `1 unrecognized` but cannot locate which bracket sequence failed.
> - Strengthen: Read jact.ts:505-572 sections; confirm there is no per-occurrence print path for unrecognized records as currently designed.
> - Utility: H — determines whether D2 is fully implementable from the current spec
> - Cost: L — single source-code read + spec amendment
> - **Resolution evidence:** §7a D2 "After" column amended to specify both display sections — minimal mode emits `UNRECOGNIZED (K)` section between `ERRORS` and the trailer summary line, with `- Line N: <rawText>` per-occurrence records; verbose mode emits `UNRECOGNIZED SYNTAX (K)` section in same vertical position relative to `CRITICAL ERRORS` / `WARNINGS`, using existing `├─ Line N: <rawText>` / `└─ <reason>` indentation pattern.
> - DRI: Agent (spec amendment before [j2] lock) — **DONE**

^GAP-1

> **~~[GAP-2]~~** **Status: ✅ Resolved** ([i1]-re-entry, 05/02/26 — USER decided INLINE). D3 specifies the coverage-qualified summary line under the `OK:` (success) path: `OK: 42 citations valid (markdown: 30, wiki: 10, caret: 2; 0 unrecognized)`. But the FAILED path's summary line at jact.ts:551-561 currently reads `FAILED: 4 errors, 1 warnings`. D3 does not specify whether the FAILED path also gains a coverage qualifier (e.g., `FAILED: 4 errors, 1 unrecognized (markdown: 30, wiki: 10, caret: 2)`) or whether `unrecognized` is reported in the FAILED line at all. Without explicit spec, the implementer will guess.
> - Strengthen: Read §7a D3 "After" column; verify it covers both `OK:` and `FAILED:` summary line shapes.
> - Utility: M — determines whether D3 spec is complete enough to implement deterministically
> - Cost: L — spec amendment
> - **Resolution evidence:** §7a D3 "After" column amended at sub-item (g) — FAILED line locked as `FAILED: ${errors} errors[, ${warnings} warnings][, ${unrecognized} unrecognized] (markdown: N, wiki: N, caret: N)`. USER selected INLINE byLinkClass breakdown ([GAP-2 decision in §7g.8](#^GAP-2-decision)) over continuation-line layout — consistency with `OK:` line shape; no conditional formatter logic.
> - DRI: Agent (spec amendment before [j2] lock) — **DONE**

^GAP-2

> **~~[GAP-7]~~** **Status: ✅ Resolved** ([i1]-re-entry, 05/02/26 — spawned [H-D4-suggestion-threshold](#^H-D4-suggestion-threshold) Open). D4 specifies the broken-wiki error reason as `wiki page not found in vault (tried: <raw>, <slug>.md)` but does not specify generating a Levenshtein-distance suggestion against known FileCache filenames. jact already has the suggestion infrastructure: `src/utils/stringDistance.ts` is used by `validate` and `extract` for markdown-link path suggestions, and `formatForCLIMinimal` at jact.ts:520-522 already prints `suggestion: <text>` from `validation.suggestion`. Without this hook, a user/agent receives the failed-attempt list but no actionable next step (e.g., "did you mean `the-hardening-principle.md`?") even though the matching mechanism is one function call away.
> - Strengthen: Confirm `stringDistance.ts` exposes a closest-match API (or scan-and-rank pattern) usable from `resolveWikiPath.ts`; verify FileCache exposes a filename iteration path.
> - Utility: H — actionable suggestions are the difference between "broken link, fix it yourself" and "broken link, here's the likely target"
> - Cost: L — call existing closest-match function with the attempted slug as needle and FileCache filenames as haystack
> - **Resolution evidence:** §7a D4 "After" column amended at sub-item (e) — when both `FileCache.resolveFile(rawPath)` and `FileCache.resolveFile(slug + ".md")` miss, compute Levenshtein distance from `slug + ".md"` against all FileCache filenames using existing `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/utils/stringDistance.ts`; if min distance ≤ 5, set `validation.suggestion` to closest match. Existing CLI minimal-mode (`jact.ts:520-522`) and JSON-mode suggestion-print paths surface it. Threshold tuning tracked as new NBA item [H-D4-suggestion-threshold](#^H-D4-suggestion-threshold) — verify at [m] implementation.
> - DRI: Agent (D4 spec amendment before [j2] lock) — **DONE**

^GAP-7

> **~~[GAP-8]~~** **Status: ✅ Resolved** ([7g] interactive review, 05/02/26 — revised [H-D4-suggestion-threshold](#^H-D4-suggestion-threshold)). GAP-7's resolution specified Levenshtein distance against FileCache filenames with fixed threshold ≤ 5. Two issues surfaced during 7g UI review: (1) **Hard threshold breaks at length extremes** — distance 5 means 83% of a 6-char path or 8% of a 60-char path; consistency requires adaptive scaling. (2) **Filename-only matching discards folder context** — vault has duplicate basenames in different folders (verified: `the-hardening-principle.md` exists in `wiki/concepts/`, `wiki/summaries/`, and `raw-sources/claude-code-principles/`); when an agent creates wiki refs without folder qualifier, a suggestion that returns only one path silently drops the alternatives, defeating disambiguation. Without folder context, agents creating wiki files "willy nilly" across `concepts/`, `summaries/`, `_drafts/`, etc. cannot self-correct.
> - Strengthen: Verify multiple basenames exist in vault (already confirmed via `find` — 3 files share `the-hardening-principle.md` basename, 5 hardening-related files total); compute that path-aware distance (slug → full path) balloons by folder-prefix length and breaks legitimate typo matches (e.g., slug `the-hardening-principle.md` → full path `wiki/concepts/the-hardening-principle.md` distance ≈ 14, would exceed any reasonable threshold).
> - Utility: H — without resolution, suggestion feature ships incoherent: either silently picks one duplicate-basename file (wrong half the time) or refuses to fire on small typos (under-utilizes existing infrastructure).
> - Cost: L — spec amendment to D4 (e) + NBA revision.
> - **Resolution evidence:** §7a D4 (e) amended — match on **basename** (typos live there, not in folder prefixes); use **adaptive threshold scaled to full relative path length** `clamp(3, 10, floor(0.2 × candidateRelativePath.length))` (floor=3 catches small typos in shallow paths; ceiling=10 prevents absurd matches in very deep paths; 20% middle "1-in-5 characters wrong" scales with vault depth — deeper paths get proportional typo headroom because they carry more contextual signal); **multi-match disambiguation** for duplicate basenames (return comma-separated list of full relative paths so agent sees all candidates with parent-folder context); **full-relative-path display** so agents see parent folder. NBA item [H-D4-suggestion-threshold](#^H-D4-suggestion-threshold) revised correspondingly. The 4 broken wiki errors in the §7g.3 baseline scenario now naturally demonstrate both single-match (Line 51) and multi-match (Lines 14/22/38) suggestion shapes.
> - DRI: Agent (D4 spec amendment before [j2] re-lock) — **DONE**

^GAP-8

### 7g.4 Verbose Mode (`jact validate --verbose`)

%% *Last Modified: 05/02/26 11:15:12* %%

#### Before (main today)

%% *Last Modified: 05/02/26 11:15:12* %%

```
Citation Validation Report
==========================

Processed: 32 citations found

VALID CITATIONS (32)
├─ Line 5: [Some Doc](some-doc.md)
├─ Line 7: ^FR1
└─ ... (30 more) ...

SUMMARY:
- Total citations: 32
- Valid: 32
- Warnings: 0
- Critical errors: 0
- Validation time: 12ms

ALL CITATIONS VALID
```

(11 wikilinks invisible. Exit 0. Silent pass.)

#### After (post-D1–D5)

%% *Last Modified: 05/02/26 12:42:07* %%

```
Citation Validation Report
==========================

Processed: 39 citations found                              ← D1: parser now produces 7 wiki LinkObjects (32 + 7)

CRITICAL ERRORS (4)
├─ Line 14: [[The Hardening Principle (concept)]]
│  ├─ wiki page not found in vault (tried: The Hardening Principle (concept), the-hardening-principle-concept.md)
│  └─ suggestion: wiki/concepts/the-hardening-principle.md, wiki/summaries/the-hardening-principle.md, raw-sources/claude-code-principles/the-hardening-principle.md
│
├─ Line 22: [[The Hardening Principle (concept)]]
│  ├─ wiki page not found in vault (tried: The Hardening Principle (concept), the-hardening-principle-concept.md)
│  └─ suggestion: wiki/concepts/the-hardening-principle.md, wiki/summaries/the-hardening-principle.md, raw-sources/claude-code-principles/the-hardening-principle.md
│
├─ Line 38: [[The Hardening Principle (concept)]]
│  ├─ wiki page not found in vault (tried: The Hardening Principle (concept), the-hardening-principle-concept.md)
│  └─ suggestion: wiki/concepts/the-hardening-principle.md, wiki/summaries/the-hardening-principle.md, raw-sources/claude-code-principles/the-hardening-principle.md
│
└─ Line 51: [[Hardening Principle — Open Questions Research]]
   ├─ wiki page not found in vault (tried: Hardening Principle — Open Questions Research, hardening-principle-open-questions-research.md)
   └─ suggestion: wiki/syntheses/hardening-principle-open-questions.md

UNRECOGNIZED SYNTAX (1)                                    ← GAP-1 (same gap as minimal): D2 must specify this section
├─ Line 79: [[malformed[[
   └─ bracket sequence did not match wikilink grammar

VALID CITATIONS (35)
├─ Line 3: [Some Doc](some-doc.md)
├─ Line 5: [[the-hardening-principle\|The Hardening Principle]]    ← D1: wiki link extracted
├─ Line 9: [[The Hardening Principle]]                            ← D4: resolved via slug normalization
└─ ... (32 more) ...

SUMMARY:
- Total citations: 39
- Valid: 35
- Warnings: 0
- Critical errors: 4
- Unrecognized: 1                                          ← GAP-3: D3 spec is silent on adding this line
- By link class: markdown=30, wiki=7, caret=2              ← GAP-3: D3 spec is silent on adding this line
- Validation time: 14ms

VALIDATION FAILED - Fix 4 critical errors                  ← GAP-4: trailer logic at jact.ts:479-494 only branches on errors/warnings
```

**Note on suggestions:** Same logic as §7g.3 minimal mode — D4 (e) revised post-[7g] (see [GAP-8](#^GAP-8)) adds basename-Levenshtein matching with **adaptive threshold scaled to full relative path length** `clamp(3, 10, floor(0.2 × candidateRelativePath.length))` and full-relative-path display. Suggestion lines surface as a second `└─` rung under the error reason, demoting the existing reason rung from `└─` to `├─`. Lines 14/22/38 demonstrate **multi-match disambiguation** (3 candidates share `the-hardening-principle.md` basename across `wiki/concepts/`, `wiki/summaries/`, `raw-sources/claude-code-principles/`); Line 51 demonstrates **single-match** (only `wiki/syntheses/hardening-principle-open-questions.md` within threshold). See §7g.3 firing-table for distance + threshold computation.

#### Validation findings

%% *Last Modified: 05/02/26 12:10:09* %%

> **~~[GAP-3]~~** **Status: ✅ Resolved** ([i1]-re-entry, 05/02/26). D3 specifies the minimal-mode `OK:` summary line gets `(markdown: N, wiki: N, caret: N; K unrecognized)`. Verbose mode has its own `SUMMARY:` block at jact.ts:466-477 listing `- Total citations`, `- Valid`, `- Warnings`, `- Critical errors`, `- Validation time`. D3 does not specify whether the verbose SUMMARY block gains `- Unrecognized: K` and `- By link class: markdown=N, wiki=N, caret=N` lines. If verbose mode is supposed to be the human-friendly "what happened" view, omitting the breakdown there contradicts the design intent.
> - Strengthen: Read §7a D3 "After" column; check whether verbose `SUMMARY:` block is mentioned.
> - Utility: M — determines completeness of D3 verbose-mode spec
> - Cost: L — spec amendment
> - **Resolution evidence:** §7a D3 "After" column amended at sub-item (h) — verbose `SUMMARY:` block gains two lines between `- Critical errors:` and `- Validation time:`: `- By link class: markdown=N, wiki=N, caret=N` and `- Unrecognized: K` (each on its own line for human-friendly scanability).
> - DRI: Agent (spec amendment before [j2] lock) — **DONE**

^GAP-3

> **~~[GAP-4]~~** **Status: ✅ Resolved** ([i1]-re-entry, 05/02/26). Verbose-mode trailer line at jact.ts:479-494 has three branches: `VALIDATION FAILED` (if errors > 0), `VALIDATION PASSED WITH WARNINGS` (if warnings > 0), `ALL CITATIONS VALID` (else). D3 makes exit code 1 fire when `unrecognizedCount > 0` even with zero errors. The current branch logic would print `ALL CITATIONS VALID` while the process exits 1 — directly contradictory output.
> - Strengthen: Read jact.ts:479-494 branches; confirm there is no path for unrecognized.
> - Utility: H — determines whether verbose mode contradicts itself when unrecognized > 0 and errors = 0
> - Cost: L — spec amendment + branch addition
> - **Resolution evidence:** §7a D3 "After" column amended at sub-item (i) — verbose trailer branch order locked: `errors > 0 → "VALIDATION FAILED"`; else if `unrecognizedCount > 0 → "VALIDATION FAILED - K unrecognized syntax records"`; else if `warnings > 0 → "VALIDATION PASSED WITH WARNINGS"`; else `"ALL CITATIONS VALID"`. Trailer is now loud-fail consistent with structured-field exit code from sub-item (f) — closes contradiction loophole.
> - DRI: Agent (spec amendment before [j2] lock) — **DONE**

^GAP-4

### 7g.5 JSON Mode (`jact validate --format json`)

%% *Last Modified: 05/02/26 11:15:12* %%

#### Before (main today — `ValidationResult` shape)

%% *Last Modified: 05/02/26 11:15:12* %%

```json
{
  "summary": {
    "total": 32,
    "valid": 32,
    "warnings": 0,
    "errors": 0
  },
  "links": [
    { "fullMatch": "[Some Doc](some-doc.md)", "line": 3, "linkType": "markdown", "validation": { "status": "valid" } }
  ],
  "validationTime": "12ms"
}
```

(11 wikilinks invisible. Exit 0. Silent pass for JSON consumers as well.)

#### After (post-D1–D5)

%% *Last Modified: 05/02/26 12:42:52* %%

```json
{
  "summary": {
    "total": 39,
    "valid": 35,
    "warnings": 0,
    "errors": 4,
    "byLinkClass": { "markdown": 30, "wiki": 7, "caret": 2 },
    "unrecognizedCount": 1
  },
  "links": [
    { "fullMatch": "[[the-hardening-principle|The Hardening Principle]]", "line": 5, "linkType": "wiki", "validation": { "status": "valid" } },
    { "fullMatch": "[[The Hardening Principle]]", "line": 9, "linkType": "wiki", "validation": { "status": "valid" } },
    { "fullMatch": "[[The Hardening Principle (concept)]]", "line": 14, "linkType": "wiki", "validation": { "status": "error", "error": "wiki page not found in vault (tried: The Hardening Principle (concept), the-hardening-principle-concept.md)", "suggestion": "wiki/concepts/the-hardening-principle.md, wiki/summaries/the-hardening-principle.md, raw-sources/claude-code-principles/the-hardening-principle.md" } },
    { "fullMatch": "[[Hardening Principle — Open Questions Research]]", "line": 51, "linkType": "wiki", "validation": { "status": "error", "error": "wiki page not found in vault (tried: Hardening Principle — Open Questions Research, hardening-principle-open-questions-research.md)", "suggestion": "wiki/syntheses/hardening-principle-open-questions.md" } }
  ],
  "unrecognized": [
    { "line": 79, "column": 0, "rawText": "[[malformed[[", "syntaxFamily": "wiki" }
  ],
  "validationTime": "14ms"
}
```

Schema deltas: `summary.byLinkClass` and `summary.unrecognizedCount` added by D3; `unrecognized[]` top-level array added by D2; `links[i].validation.suggestion?: string` added by D4 (e) revised post-[7g] (see [GAP-8](#^GAP-8)) — present when a broken wiki ref's basename distance to a vault file falls within the **adaptive threshold scaled to candidate full relative path length** `clamp(3, 10, floor(0.2 × candidateRelativePath.length))`; value is full relative path (single match) or comma-separated full relative paths (multi-match for duplicate basenames). Line 14 (representative of Lines 22/38 — same shape) demonstrates **multi-match** (3 paths within threshold for the duplicate `the-hardening-principle.md` basename); Line 51 demonstrates **single-match**. See §7g.3 firing-table for distance + threshold computation per row.

Note: `suggestion` is a single string (not an array) so existing CLI suggestion-print paths work without consumer-side change. Multi-match cases use `, ` (comma-space) as the separator; consumers wanting structured candidates can `.split(", ")`.

#### Validation findings

%% *Last Modified: 05/02/26 12:10:25* %%

> **~~[GAP-5]~~** **Status: ✅ Resolved** ([i1]-re-entry, 05/02/26). D2/D3 add a separate top-level `unrecognized: [...]` array and `summary.unrecognizedCount` field. Existing JSON consumers that destructure `{ summary, links }` and check `summary.errors > 0` for failure detection will silently miss the new failure mode. Documentation cannot enforce this — code and interface must provide the feedback. Per Hardening Principle, a separate counter the consumer must remember to check is itself a silent-failure surface; the moment any future consumer forgets, the silent-pass re-emerges at the consumer layer.
> - Strengthen: Confirm that folding `unrecognizedCount` into `summary.errors` does not break the per-occurrence detail captured in `unrecognized: [...]` (it does not — they are different views of the same failure surface).
> - Utility: H — determines whether existing failure-detection predicates (`summary.errors > 0`) automatically catch the new failure mode without consumer changes
> - Cost: L — additive schema change to summary aggregator
> - Risk-if-wrong: Same silent-pass failure mode shifts from parser layer to consumer layer; Hardening Principle violated at a different boundary
> - **Resolution evidence:** §7a D3 "After" column amended at sub-item (e) — `summary.errors` is now a derived count: `errors = brokenLinkCount + unrecognizedCount`. Added `summary.errorBreakdown: { brokenLinks: N, unrecognized: K }` for consumers wanting class-level detail. Existing `summary.errors > 0` predicate now structurally catches both failure classes — no consumer-doc reliance. Per-occurrence diagnostics still in `unrecognized: [...]` (per D2) and `links[].validation`. Schema makes failure mode unmissable structurally.
> - DRI: Agent (D3 revision before [j2] lock) — **DONE**

^GAP-5

### 7g.6 Exit Code Path (Both String-Match and Structured-Field Branches)

%% *Last Modified: 05/02/26 11:15:12* %%

#### Before (main today — jact.ts:1275-1296)

%% *Last Modified: 05/02/26 11:15:12* %%

```typescript
if (options.format === "json") {
  const parsed = JSON.parse(result);
  if (parsed.error) process.exit(2);
  else process.exit(parsed.summary?.errors > 0 ? 1 : 0);    // does NOT check unrecognizedCount
} else {
  if (result.includes("ERROR:")) process.exit(2);
  else process.exit(result.includes("FAILED:") || result.includes("VALIDATION FAILED") ? 1 : 0);  // string-match
}
```

#### After (per §7a D3 revised spec)

%% *Last Modified: 05/02/26 11:15:12* %%

```typescript
if (options.format === "json") {
  const parsed = JSON.parse(result);
  if (parsed.error) process.exit(2);
  else process.exit(parsed.summary.errors > 0 || parsed.summary.unrecognizedCount > 0 ? 1 : 0);
} else {
  /* GAP-6: D3 says "minimal/verbose branches read structured ValidationReport.summary"
     but manager.validate() returns string only. Implementation choice between:
       (a) manager.validate() returns { output: string, result: ValidationResult }
       (b) re-parse the formatted string (fragile)
     D3 spec is silent on which path. */
}
```

#### Validation findings

%% *Last Modified: 05/02/26 12:10:45* %%

> **~~[GAP-6]~~** **Status: ✅ Resolved** ([i1]-re-entry, 05/02/26 — USER decided KEEP explicit predicate; spawned [A-D3-adr-pending](#^A-D3-adr-pending) Open). §7a D3 "After" column says "for minimal/verbose branches, read the structured `ValidationReport.summary` (not the display string)". But the current code path is `result = await manager.validate(...)` returning a `string`. The structured `ValidationResult` is internal to `manager.validate()`. To run the structured-field exit-code predicate, the manager must return both the string AND the result, OR jact.ts must run validation twice. The plan does not specify which.
> - Strengthen: Trace `manager.validate()` return contract through jact.ts call sites; confirm the structured object is not currently exposed.
> - Utility: H — determines D3 implementation shape (return-shape change vs. re-parse vs. validation re-run)
> - Cost: L — spec amendment
> - **Resolution evidence:** §7a D3 "After" column amended at sub-item (f) — `manager.validate()` return shape changes from `Promise<string>` to `Promise<{ output: string, result: ValidationResult }>`. Exit-code predicate (all branches) reads structured fields directly: `process.exit(result.summary.errors > 0 || result.summary.unrecognizedCount > 0 ? 1 : 0)` — explicit `|| unrecognizedCount > 0` retained per [USER decision](#^GAP-5-6-decision) (belt-and-suspenders survives future schema drift). JSON branch drops `JSON.parse(result)`. Type I marker added to D3 Notes column. ADR tracked as new NBA item [A-D3-adr-pending](#^A-D3-adr-pending) — write at [k] before DIFFs land.
> - DRI: Agent (spec amendment before [j2] lock; ADR after) — **DONE (spec); ADR pending [k]**

^GAP-6

### 7g.7 Delta-to-stdout Traceability

%% *Last Modified: 05/02/26 11:15:12* %%

| Delta | Minimal mode visible change | Verbose mode visible change | JSON mode visible change | Exit-code wire |
|-------|----------------------------|-----------------------------|--------------------------|----------------|
| D1 (grammar) | `total` count rises by N wiki links; ERRORS section gains wiki rows | Same; `Processed: N citations found` rises; VALID CITATIONS section lists wiki entries | `links[]` gains `linkType: "wiki"` entries | indirect: more errors → may flip exit |
| D2 (residual scanner) | new `UNRECOGNIZED (K)` section (GAP-1); summary count `K unrecognized` (GAP-2) | new `UNRECOGNIZED SYNTAX (K)` section (GAP-1); SUMMARY block `- Unrecognized: K` line (GAP-3); trailer branch (GAP-4) | new top-level `unrecognized: [...]` array; `summary.unrecognizedCount` | direct: `unrecognizedCount > 0 → exit 1` |
| D3 (coverage-qualified output) | `OK:` line gains `(markdown: N, wiki: N, caret: N; K unrecognized)`; FAILED line gains qualifier (GAP-2); structured-field exit (GAP-6) | SUMMARY block gains breakdown lines (GAP-3); trailer branch updated (GAP-4); structured-field exit (GAP-6) | `summary.byLinkClass`, `summary.unrecognizedCount` | direct: `errors > 0 \|\| unrecognizedCount > 0 → exit 1` |
| D4 (wiki page name resolution) | wiki ERRORS entries print explicit `wiki page not found in vault (tried: ...)` reason | Same in CRITICAL ERRORS section | `links[].validation.error` carries the same string for unresolved wiki links | indirect: resolution failure → error → exit 1 |
| D5 (doc alignment) | (none — documentation only) | (none) | (none — but component guide explains the new shape per GAP-5) | (none) |

### 7g.8 Validation Result

%% *Last Modified: 05/02/26 12:41:42* %%

**Verdict (post-amendments):** All **8 specification gaps Resolved** — 7 via [i1] re-entry + 1 ([GAP-8](#^GAP-8)) via [7g] interactive review revising D4 (e). D2/D3/D4 "After" columns amended in §7a; no Delta deletions or additions; no re-architecture. Two Type I choice points decided by USER ([GAP-2 inline](#^GAP-2-decision), [GAP-5/6 explicit-disjunct](#^GAP-5-6-decision)). Architecture is ready for [j2] lock pending [nba] re-verify scan.

| Gap | Severity | Affected Delta | Affected Output | Resolution | Status |
|-----|----------|---------------|-----------------|------------|--------|
| [GAP-1](#^GAP-1) | High | D2 | Minimal + Verbose | `UNRECOGNIZED (K)` section between ERRORS and trailer (minimal); `UNRECOGNIZED SYNTAX (K)` parallel to CRITICAL ERRORS / WARNINGS (verbose) | ✅ Resolved — D2 After |
| [GAP-2](#^GAP-2) | Medium | D3 | Minimal | FAILED line: `FAILED: ${errors} errors[, ${warnings} warnings][, ${unrecognized} unrecognized] (markdown: N, wiki: N, caret: N)` — inline byLinkClass per USER decision | ✅ Resolved — D3 After (g) |
| [GAP-3](#^GAP-3) | Medium | D3 | Verbose | `- By link class: …` + `- Unrecognized: K` lines added between `- Critical errors:` and `- Validation time:` in SUMMARY block | ✅ Resolved — D3 After (h) |
| [GAP-4](#^GAP-4) | High | D3 | Verbose | Trailer branch order: errors → unrecognized → warnings → all-valid; loud-fail consistent with exit code | ✅ Resolved — D3 After (i) |
| [GAP-5](#^GAP-5) | Medium | D3 | JSON | `summary.errors = brokenLinks + unrecognized` (derived); `summary.errorBreakdown` added for detail — schema enforces feedback structurally | ✅ Resolved — D3 After (e) |
| [GAP-6](#^GAP-6) | High | D3 | Exit code (all branches) | `manager.validate()` returns `Promise<{ output, result }>`; exit predicate `errors > 0 \|\| unrecognizedCount > 0` retained explicit per USER (belt-and-suspenders); Type I marker added in Notes; ADR pending at [k] | ✅ Resolved — D3 After (f) + Notes |
| [GAP-7](#^GAP-7) | High | D4 | Minimal + Verbose + JSON | Levenshtein suggestion via existing `stringDistance.ts`; populates `validation.suggestion`; reuses CLI/JSON suggestion-print paths (initial spec — see GAP-8 for revisions) | ✅ Resolved — D4 After (e) |
| [GAP-8](#^GAP-8) | High | D4 | Minimal + Verbose + JSON | GAP-7's fixed threshold ≤ 5 + filename-only matching revised: **basename match** + **adaptive threshold scaled to full path length** `clamp(3, 10, floor(0.2 × candidateRelativePath.length))` + **multi-match disambiguation** with **full-relative-path display** so duplicate basenames across folders surface parent-folder context to agents | ✅ Resolved — D4 After (e) revised |

**USER decisions (Type I):**
- **[GAP-2 layout]** USER selected INLINE byLinkClass in FAILED summary line — consistency with `OK:` line, no conditional layout. ^GAP-2-decision
- **[GAP-5/6 exit predicate]** USER selected explicit `errors > 0 \|\| unrecognizedCount > 0` over simplified `errors > 0` — belt-and-suspenders survives future schema drift. ^GAP-5-6-decision

**Next:** Run [nba] re-verify scan against amended §7a/§7b; surface any new [H]/[Q]/[A] in §7d NBA table; then present revised state at [j2] HARD GATE.

## 8. Implementation Sequencing Brainstorm

%% *Last Modified: 05/02/26 13:09:33* %%

### 8.1 Delta Boundary & Dependency Audit

%% *Last Modified: 05/02/26 13:09:33* %%

[F-ID: D1 is the foundation — every other Delta depends on D1 producing `LinkObject[]` with `linkType: "wiki"`.] Derived from §7a row 1 (D1) being referenced by D2 (residual scan complement of D1's grammar), D3 (`byLinkClass` counts D1 output), D4 (resolves D1's wiki targets), D5 (renames functions D1 introduces).

[F-ID: D3 is the only non-self-contained Delta — Type I `manager.validate()` interface change couples types + 3 formatters + exit-code path.] Derived from §7a row 3 (D3): "Manager return-shape change + exit-code refactor (per [GAP-6](#^GAP-6))" — `Promise<string>` → `Promise<{ output, result }>`.

[F-ID: D4 carries the only OPEN hypothesis with H utility.] Derived from §7b D4 hypothesis status — `[H-D4-slug]` marked **OPEN — verify at [j2] implementation**, all other H/A in §7b are RESOLVED.

| Delta | Self-contained? | Depends on | Risk | Open H |
|-------|----------------|-----------|------|--------|
| D1 | ✅ Yes — single grammar function swap | — | LOW | None (`[H-D1-regex]` resolved) |
| D2 | ✅ Yes — additive `unrecognized[]` field | D1 grammar must be settled (residual = complement) | LOW | `[H: <5ms benchmark]` (cheap) |
| D3 | ❌ **No** — Type I interface change spans types + jact.ts + formatters | D1 (LinkClass counting), D2 (unrecognizedCount) | **HIGH** (interface contract) | None |
| D4 | ✅ Yes — new `resolveWikiPath.ts` module + factory wire-in | D1 (valueless without wiki LinkObjects) | MEDIUM | **`[H-D4-slug]` OPEN** |
| D5 | ✅ Yes — 3 doc files | D1 (function names removed) | TRIVIAL | None |

### 8.2 Sequencing Strategies (Two-Dimensional: Rework Risk × Time-to-Validation)

%% *Last Modified: 05/02/26 13:09:33* %%

| # | Strategy | Order | Rework Risk | Time-to-Validation | Plan Files |
|---|----------|-------|-------------|---------------------|-----------|
| **S1** | **Strict Dependency** | D1 → D2 → D3 → D4 → D5 | **LOW** — each layer confirmed before next; no spec rework expected | **LATE** — silent-fail contract closes only after D3 ships (mid-sequence) | **5** (one per Delta) |
| **S2** ⭐ | **Hypothesis-First Spike** | **Spike:** D1-min grammar + D4 resolver vs. baseline file → measure resolution rate. Hard gate ≥80%. If pass → D1-full → D2 → D3 → D5. If fail → escalate D4 to vault title-index work, revisit D1 boundary. | **LOWEST** — kills `[H-D4-slug]` (only open H) before locking D1/D2/D3 grammar+schema | **FASTEST** for the riskiest unknown; loud-fail contract closes on plan #3 | **2** (1 spike plan + 1 build plan) |
| **S3** | **Loud-Fail Vertical Slice** | Slice A: D1 + D2 + D3-min (silent-fail closed; all wikis "broken-but-loud") → Slice B: D4 (broken→valid for resolvable pages) → Slice C: D5 docs | **MEDIUM** — D3 Type I interface locked early; D4 surprises (`[H-D4-slug]` failure) force re-touch of interface or re-shape of D1 grammar | **FAST** for the *highest-value outcome* (loud-fail contract delivered in plan #1) | **3** (vertical slices) |

### 8.3 Recommendation: S2 (Hypothesis-First Spike)

%% *Last Modified: 05/02/26 13:19:39* %%

**Why S2:**
1. [F-ID: `[H-D4-slug]` is the only un-falsified H with H utility and shape-changing failure mode.] If <80% resolve rate, D4 needs vault title-index work that may reshape D1's grammar (e.g., emit different LinkObject sub-shapes for resolved-by-slug vs. resolved-by-title-index).
2. Spike cost is bounded: minimal D1 regex + D4 resolver + run against `0-documents/llm-wiki/wiki/concepts/probabilistic-vs-deterministic-systems.md` baseline file. Already-falsified `[H-D4-filematch]` (12.5% match) means spike has high information value.
3. If H holds, remaining 4 Deltas ship in mechanical strict-dependency order with zero re-spec risk.

**Plan files (using `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/features/plan-template.md`):**

Both plans live in `design-docs/features/202605020859-jact-wikilink-validation/`. Each plan's **Context** section MUST link back to this design plan for traceability — wikilink form: `[[plan#<header>]]` or markdown form: `[Design §X](../plan.md#<header-anchor>)`.

#### Agent Pipeline (per plan)

%% *Last Modified: 05/02/26 13:23:12* %%

**Token-economy note:** Per jact-extract token-economy rule, agent dispatch prompts MUST NOT embed design-plan content verbatim. Each prompt below contains only file paths + `jact extract header` commands; agents pull content on-demand. The `<design-plan>` placeholder = `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/features/202605020859-jact-wikilink-validation/plan.md`. The `<target-plan>` placeholder = the plan file the agent is populating (e.g., `plan-01-spike-wikilink-resolution.md` or `plan-02-implement-deltas.md`). The `<plan-header>` placeholder = `Plan 1: \`plan-01-spike-wikilink-resolution.md\`` or `Plan 2: \`plan-02-implement-deltas.md\``.

| Stage | Agent | Output | Dispatch Prompt (token-light) |
|-------|-------|--------|------------------------------|
| 1. **Author plan from template** | `application-tech-lead` | Plan file populated from `plan-template.md` with Context/Baseline Tracing/Tech Debt/File Changes/Verification | `Populate <target-plan> from the template. Step 1: Run \`jact extract header <design-plan> "<plan-header>"\` to retrieve your goal, traceability links, and command list. Step 2: Execute every command in the "Commands sub-agent runs to populate" bullet list — those commands give you template skeleton + design-plan sections to fill in. Step 3: Add traceability links from the "Traceability links" bullet list to the Context section. Do NOT embed design-plan content; cite via wikilinks/markdown links so agents downstream re-read on demand. Honor SKETCH RULES (signatures + types + key decisions only; no function bodies).` |
| 2. **Add BDD test assertions** | `bdd-test-writer` | Test sketches in File Changes "ADDED" blocks per template SKETCH RULES (assertions only, not bodies) | `Add BDD-style test assertions to <target-plan>. Step 1: Run \`jact extract header <design-plan> "<plan-header>"\` for plan goal + acceptance criteria. Step 2: Run \`jact extract header <design-plan> "7g. UI Sketch — CLI Output Validation"\` (Plan 2 only) for Before/After output expectations. Step 3: For each ADDED/MODIFIED file in <target-plan>, write Given-When-Then assertions covering: (a) the goal's acceptance criteria, (b) edge cases from §7g sub-sections, (c) any [H-…] hypothesis verification step. Output goes in the "Test assertions" comment block of File Changes "ADDED" code sketches.` |
| 3. **Phase-sequence + assign agents** | `plan-sequencer` (this skill) — re-run per plan | `## Phased Task Sequence` section appended; coder/reviewer/orchestrator assignments + escalation policy | `Phase-sequence <target-plan>. Read <target-plan> directly (use \`jact ast <target-plan>\` first to get the heading map, then \`jact extract header <target-plan> "<header>"\` per section as needed). Apply plan-sequencer SOP Phases 1–8: parse File Changes / Tech Debt / Verification → derive dependency graph → topologically sort into Phase 0–5 → insert STATE-READ/STATE-WRITE/COMMIT handoffs and review gates → append \`## Phased Task Sequence\` section to <target-plan>. Use the agent capability table in plan-sequencer SOP Phase 4 for coder/reviewer assignments and the three-tier escalation policy from SOP Phase 6.` |

#### Plan 1: `plan-01-spike-wikilink-resolution.md`

%% *Last Modified: 05/02/26 13:28:43* %%

**Goal:** Minimal D1 grammar function + D4 `resolveWikiPath` + `pageNameToSlug`. Hard gate: ≥80% resolution rate against baseline file's 8 unique wiki page names. Failure escalates to revised D4 design (vault title-index work).

**Traceability links to add in Plan 1's Context section:**
- `[Design §2 Context](../plan.md#2.%20Context)` — problem statement
- `[Design §7b D1 — Consolidated Wikilink Grammar](../plan.md#D1%20—%20Consolidated%20Wikilink%20Grammar)` — grammar spec
- `[Design §7b D4 — Wiki Page Name Resolution via FileCache](../plan.md#D4%20—%20Wiki%20Page%20Name%20Resolution%20via%20FileCache)` — resolver spec
- `[Design §7b ^H-D4-slug](../plan.md#^H-D4-slug)` — hypothesis being tested

**Commands sub-agent runs to populate Plan 1:**
- `jact extract file /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/features/plan-template.md` — pull the empty template skeleton (Context, Baseline Tracing Guide, Tech Debt, File Changes ADDED/MODIFIED/REMOVED/UNTOUCHED, Verification) before filling sections
- `jact extract header <design-plan> "Type I/II Decision Guide"` — copy decision framework into plan header
- `jact extract header <design-plan> "Domain Vocabulary"` — copy term definitions
- `jact extract header <design-plan> "2. Context"` — paraphrase into Plan 1's Context section
- `jact extract header <design-plan> "7a. Delta Architecture Table"` — full Delta table; use **D1 and D4 rows only** for File / Section / Before / After columns. This is the source of truth for File Changes "MODIFIED" entries (`extractLinks.ts:417-499`, `createLinkObject.ts`) and "ADDED" entries (`resolveWikiPath.ts`, `wikiPageSlug.ts`). Row text supplies the line-range citations the §7b rationale headers omit.
- `jact extract header <design-plan> "7a.3 Data Shape Deltas"` — TypeScript shapes; use **`ResolvedPath` block (per D4)** for the new `resolveWikiPath.ts` return-type sketch in File Changes "ADDED"
- `jact extract header <design-plan> "D1 — Consolidated Wikilink Grammar"` — D1 decision rationale + `[H-D1-regex]` resolution evidence (regex pattern, captured forms) — *the why behind the §7a D1 row*
- `jact extract header <design-plan> "D4 — Wiki Page Name Resolution via FileCache"` — D4 resolver design + slug rule + `[H-D4-slug]` open status — *the why behind the §7a D4 row*
- `jact extract header <design-plan> "7g.2 Test Scenario"` — extract baseline file path + 8-page-name inventory for spike acceptance test
- `jact extract file <design-plan>` then grep for `^[\^]S-D[14]` footnotes — pull source-file paths/lines (`extractLinks.ts:420-499`, `createLinkObject.ts:28-30`, `FileCache.ts`) into Baseline Tracing Guide
- `jact ast /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/FileCache.ts | jq` — confirm `FileCache.resolveFile` signature for Baseline Tracing Guide LSP commands section

**Agent path:** `application-tech-lead` (author) → `bdd-test-writer` (spike acceptance assertions: count resolved/broken per page name) → `plan-sequencer` (phase the spike work).

#### Plan 2: `plan-02-implement-deltas.md`

%% *Last Modified: 05/02/26 13:19:56* %%

**Goal:** D1 (full grammar + tests) → D2 (residual scanner + benchmark) → D3 (Type I interface change + formatters + exit-code refactor) → D4 (productionize spike + Levenshtein suggestions) → D5 (docs alignment). Phase boundaries align with §8.1 Delta dependency order.

**Traceability links to add in Plan 2's Context section:**
- `[Design §2 Context](../plan.md#2.%20Context)`
- `[Design §6.5 [i0] Baseline Architecture Principles Eval](../plan.md#6.5.%20%5Bi0%5D%20Baseline%20Architecture%20Principles%20Evaluation)` — CI list this plan closes
- `[Design §7a Delta Architecture Table](../plan.md#7a.%20Delta%20Architecture%20Table)` — full Delta spec
- `[Design §7a.3 Data Shape Deltas](../plan.md#7a.3%20Data%20Shape%20Deltas)` — TypeScript shapes (single source of truth)
- `[Design §7b D1–D5 Rationale](../plan.md#7b.%20Design%20Decisions%20Rationale)` — every design decision
- `[Design §7g UI Sketch](../plan.md#7g.%20UI%20Sketch%20—%20CLI%20Output%20Validation)` — verification baseline (Before/After per output mode)

**Commands sub-agent runs to populate Plan 2:**
- `jact extract file /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/features/plan-template.md` — pull the empty template skeleton before filling sections
- `jact extract header <design-plan> "Type I/II Decision Guide"` — header
- `jact extract header <design-plan> "Domain Vocabulary"` — header
- `jact extract header <design-plan> "2. Context"` — Context section (paraphrase + link back)
- `jact extract header <design-plan> "7a. Delta Architecture Table"` — full table (drives File Changes "MODIFIED" entries with file paths + line ranges)
- `jact extract header <design-plan> "7a.3 Data Shape Deltas"` — copy TypeScript shapes verbatim into File Changes "ADDED" code blocks for new types and interface changes
- `jact extract header <design-plan> "D1 — Consolidated Wikilink Grammar"` — D1 phase rationale + regex pattern
- `jact extract header <design-plan> "D2 — Residual-Bracket Scanner (Fail-Fast)"` — D2 phase rationale + `[H: <5ms benchmark]` task
- `jact extract header <design-plan> "D3 — Coverage-Qualified Output"` — D3 phase rationale + Type I interface change note + exit-code predicate
- `jact extract header <design-plan> "D4 — Wiki Page Name Resolution via FileCache"` — D4 phase rationale + Levenshtein adaptive threshold spec
- `jact extract header <design-plan> "D5 — Documentation Alignment + Naming Cleanup"` — D5 phase: 3 doc files to update
- `jact extract header <design-plan> "7g.3 Minimal Mode (default \`jact validate\`)"` — Before/After CLI output for verification
- `jact extract header <design-plan> "7g.4 Verbose Mode (\`jact validate --verbose\`)"` — Before/After CLI output for verification
- `jact extract header <design-plan> "7g.5 JSON Mode (\`jact validate --format json\`)"` — Before/After JSON shape for verification
- `jact extract header <design-plan> "7g.6 Exit Code Path (Both String-Match and Structured-Field Branches)"` — exit-code refactor verification
- `jact extract file <design-plan>` then grep `^[\^]S-` footnotes — copy all source file paths/line ranges into Baseline Tracing Guide
- `jact ast /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts | jq` — confirm `manager.validate` + `formatForCLIMinimal` line ranges for LSP commands section
- `jact ast /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/types/validationTypes.ts | jq` — confirm current `ValidationResult` / `ReportSummary` shapes for the type-extension diff

**Agent path:** `application-tech-lead` (author from template — large scope, organize as 5 internal phase headings D1→D2→D3→D4→D5) → `bdd-test-writer` (test assertions per Delta — wikilink form coverage, residual-scanner emission, exit-code matrix, slug-resolver rate, doc-link parity) → `plan-sequencer` (re-run on populated plan to phase-sequence and assign coder/reviewer/orchestrator with escalation policy).

**Total: 2 plan files.**

[A: User may prefer 5 plan files (one per Delta) for granular review checkpoints. Risk-if-wrong: 2-file structure forces D2/D3/D4/D5 review at one large milestone instead of 4 small ones. Mitigation: Plan 2 can be structured with explicit phase headings (Phase D1, Phase D2…) acting as internal checkpoints — `plan-sequencer` will surface each as a separate phase with its own review gate.]

---

## 9. Post-Plan-01 Baseline Reconciliation

%% *Last Modified: 05/03/26 16:38:51* %%

Plan-01 squash-merged in commit `ec85098` (date 2026-05-03), shipping a larger scope than the §8.3 hypothesis-first spike framing originally anticipated. This section reconciles the §7a Delta Architecture Table against shipped reality so plan-02 authors work from current state, not pre-spike assumptions.

### 9.1 Plan-01 Shipped (commit `ec85098`)

%% *Last Modified: 05/03/26 16:38:51* %%

**D1 — Consolidated Wikilink Grammar:** SHIPPED.
- `src/core/MarkdownParser/extractWikilinks.ts` covers all 10 Obsidian wikilink forms.
- Old `extractWikiCrossDocLinks` / `extractWikiInternalLinks` removed from `extractLinks.ts`.

**D4 — Wiki Page Name Resolution (core):** SHIPPED.
- `src/core/MarkdownParser/resolveWikiPath.ts` implements 2-step exact-then-slug resolution.
- `src/utils/wikiPageSlug.ts` exports `pageNameToSlug`.
- `FileCache` is REQUIRED end-to-end through `MarkdownParser → extractLinks → extractWikilinks → createLinkObject` (changed from optional after Plan-01 Gate-2 review).
- `CitationValidator` consumes parser-resolved wiki paths (no re-resolution in validator).
- Loud-fail surfacing renders `Tried: <raw>, <slug>.md` for broken wiki errors.

**Code-block / inline-code exclusion (Plan-01 Phase 5+6 scope creep):** SHIPPED.
- `src/core/MarkdownParser/isInsideCodeBlock.ts`, `src/core/MarkdownParser/isInsideInlineCode.ts`.

**Hardening pipeline scaffolding:** PARTIAL.
- `eslint.config.js` flat config + `HARDENING-ALLOWLIST` injectable-types ban (D1-§9f).
- `scripts/{defer-language-scan,find-dead-fields,prod-callgraph-trace,service-level-smoke,plan-eval}.sh`.
- `test/hardening-pipeline/c1-d1-injectable-bans.test.ts` … `c6-fixture-template.test.ts`.
- C6 closed (current session — `design-docs/hardening-pipeline/{state.md,fixture-template.md}` restored).
- C3 RED: ~28 pre-pipeline-lock historical features/* docs contain banned-token vocabulary. Closure plan: `design-docs/features/202605030000-hardening-pipeline-c3-closure/plan.md` — exemption-marker rollout + `.archive/**` walker exclusion.

### 9.2 Remaining Scope for Plan-02

%% *Last Modified: 05/03/26 16:38:51* %%

| Delta | Original §7a Spec | Shipped in `ec85098` | Plan-02 Residual |
|-------|-------------------|---------------------|------------------|
| **D1** | 10-form grammar + tests | ✅ Module + tests | Adversarial CommonMark fixtures only (`AC1–AC6` from `design-docs/hardening-pipeline/fixture-template.md`) |
| **D2** | Residual scanner + `unrecognized[]` field + display blocks | ❌ | **Full scope** |
| **D3** | `LinkClass` discriminator + `getLinkClass.ts` + summary extensions + Type-I `manager.validate()` interface change + structured-field exit-code refactor + verbose SUMMARY block + trailer branch order | ❌ | **Full scope** |
| **D4** | Resolver + slugifier + Levenshtein adaptive-threshold + path-aware suggestion + multi-match disambiguation | ✅ resolver + slugifier | Levenshtein layer only (basename distance, `clamp(3, 10, floor(0.2 × pathLen))`, multi-match) |
| **D5** | 3 doc locations | ❌ | **Full scope** |

### 9.3 Plan-02 Sequencing (Post-Reconciliation)

%% *Last Modified: 05/03/26 16:38:51* %%

**Plan file:** `design-docs/features/202605020859-jact-wikilink-validation/plan-02-implement-deltas.md` (single monolithic plan, internal phase headings P1–P5).

**Phase order:**
- **P1 (Adversarial Fixtures, ex-D1)** — Author `test/fixtures/adversarial-commonmark/AC1–AC6.md`. Verify D1 grammar passes all 6 cases. Risk: surfaces parser-correctness bugs (Plan-01 Gate-3 Item 4 class).
- **P2 (D2 Residual Scanner)** — Add `UnrecognizedSyntaxRecord` type + `unrecognized[]` on `ValidationResult` + minimal/verbose CLI sections. Service-smoke gate verifies writers + readers both > 0.
- **P3 (D3 Coverage-Qualified Output + Type-I Interface)** — Add `LinkClass` + `getLinkClass.ts` + `byLinkClass`/`unrecognizedCount`/`errorBreakdown` on `ReportSummary` + `manager.validate()` `Promise<{output, result}>` + structured-field exit-code predicate + verbose SUMMARY block + trailer branch order. Largest phase; explicit ADR required for the Type-I interface change.
- **P4 (D4 Levenshtein Suggestion Layer)** — Add adaptive-threshold basename-distance scan to `resolveWikiPath` miss path. Path-aware suggestion display in `CitationValidator`. Multi-match disambiguation.
- **P5 (D5 Documentation Alignment)** — Update `jact/CLAUDE.md` Citation Patterns, `MarkdownParser.ts` JSDoc, `design-docs/component-guides/MarkdownParser Component Guide.md`. All three enumerate the same 10-form list.

**Precondition:** `design-docs/features/202605030000-hardening-pipeline-c3-closure/plan.md` GREEN before P1 begins. Plan-02 does NOT reference the hardening plan — once C3 is GREEN, the gates self-enforce on every plan-02 commit.

**Agent path (per §8.3 pipeline):** `application-tech-lead` (author from template — 5 internal phase headings) → `bdd-test-writer` (assertions per phase) → `plan-sequencer` (phase-sequence + agent assignments + escalation policy).

---

## 10. Source Footnotes

%% *Last Modified: 05/02/26 09:25:30* %%

[^S-D1a]: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/MarkdownParser/extractLinks.ts:420-457` — `extractWikiCrossDocLinks` requires `.md` AND `\|display`
[^S-D1b]: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/MarkdownParser/extractLinks.ts:463-499` — `extractWikiInternalLinks` requires `#anchor` AND `\|display`
[^S-D1c]: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/CitationValidator.ts:312-319` — `classifyPattern` wiki routing already live
[^S-CI04]: §6.5 CI-04 — scattered wikilink invariant across two regex sites
[^S-D3a]: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts:568` — `OK: ${result.summary.total} citations valid`
[^S-D3b]: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/jact.ts:505-572` — `formatForCLIMinimal` no coverage qualifier
[^S-D4a]: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/MarkdownParser/createLinkObject.ts:28-30` — `resolvePath` called unconditionally with `rawPath`
[^S-D4b]: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/FileCache.ts` — `resolveFile(filename)` short-filename resolver
[^S-D5a]: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/CLAUDE.md` "Citation Patterns Supported" section
[^S-D5b]: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/src/core/MarkdownParser/MarkdownParser.ts:31-35` JSDoc
[^S-D5c]: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/jact/design-docs/component-guides/MarkdownParser Component Guide.md` testing section
[^S-hardening]: `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/llm-wiki/wiki/concepts/the-hardening-principle.md` — silent failure is the most expensive failure mode
