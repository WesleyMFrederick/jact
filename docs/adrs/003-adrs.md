# 003. ADRs

**Status:** done

Architecture Decision Records reconstructed from commit history, in-repo design docs, and source comments. Each cites its evidence.

## ADR-0001 — DI-via-factory pattern

**Decision:** All component construction goes through `src/factories/componentFactory.ts` (`createMarkdownParser`, `createFileCache`, `createParsedFileCache`, `createCitationValidator`, `createContentExtractor`), each accepting optional dependency overrides and falling back to production defaults.

**Context:** Commit `ce18a19` (October 2025) introduced the pattern with the explicit stated intent of improved testability — components previously constructed their own dependencies inline, making it hard to inject test doubles without importing concrete production classes.

**Consequences:** Every consumer (CLI, tests) gets a consistent construction path. `src/types/componentInterfaces.ts` re-exports the minimal `ParsedFileCacheLike`/`FileCacheLike` interfaces specifically so factories and consumers can depend on interfaces, not concrete classes, avoiding transitive/circular imports. This is long-stable infrastructure, untouched by the more recent parser migrations below.

---

## ADR-0002 — Regex → mdast-token migration (WMF-35)

**Decision:** Retire hand-rolled regex extraction (links, wikilinks, anchors, carets, extraction markers) in favor of tokens the micromark/mdast parser already produces (see [002-architecture.md](../spec/002-architecture.md#MarkdownParser%20%28%60src/core/MarkdownParser/%60%29) for the resulting parser design), threading the parsed `ast: Root` and heading `position` data through `MarkdownParser`'s output contract.

**Context:** jact originally parsed with `marked.js` (`c701361` bumped marked 15→17; `638a457`/`bd22f4e` show the codebase adapting to marked's `Tokens` types). Marked's token shape leaked directly into jact's own contracts, and files that needed structural data (line numbers, nesting) were often re-scanned with regex on top of the marked pass — effectively tokenizing twice. `mdastAdapter.ts` originally called extraction functions without passing the parsed AST at all, forcing every extractor back onto regex regardless of the underlying parser.

**Decision path** (commits `8eeb79f` → `d379c59` → `14e83a4` → `408642a`, all tagged `WMF-35`):
1. Phase 1 — thread the mdast tree and `HeadingObject.position` through `MarkdownParser` (D1, D3).
2. Phase 2 — `wikilink` micromark extension (D2).
3. Phase 4 — `obsidianLink` permissive-link micromark extension (carve-out).
4. Final squash (`408642a`) — replace all five extractors (`extractAnchors`, `extractLinks`, `extractWikilinks`, `extractObsidianLinks`, `extractHeadings`) with mdast-token-based implementations; retire the regex re-extraction layer and its code-guard fallback; add `validate --stdin` in the same merge.

**Consequences:** 783 tests passing at merge time, build clean. Heading line numbers now come from `node.position` on the tree, not a regex re-find — a `HeadingObject.position?: Position` field was added specifically to carry this (see [004-domain-model.md](../spec/004-domain-model.md#HeadingObject)). `extractCaretLinks`/`extractCiteLinks` (the old regex functions) no longer exist in `src/`.

**Known residual debt (documented, not yet migrated):** the follow-on regex census (`design-docs/features/20260701T161127-markdown-flavor-extension-collection/regex-extraction-census.md`) found two remaining "migrate" verdicts — `AnchorMatcher.cleanMarkdownForComparison` (re-parses already-tokenized text with regex) and `citationFixer`'s citation-string re-parse — plus two "thread-field" verdicts (`determineAnchorType`'s `^[a-zA-Z0-9-_]+$` classification and `CARET_SYNTAX_REGEX`/`EMPHASIS_MARKED_REGEX` in `CitationValidator.ts`) where a tokenizer already knows the answer but a downstream regex re-derives it instead of reading a threaded field.

---

## ADR-0003 — Flavor Extension Collection

**Decision:** Group every micromark/mdast extension by *markdown flavor* (`commonmark`, `obsidian`) in one registry (`src/core/MarkdownParser/extensions/flavors.ts`), each flavor a self-contained group of tokenizer triples (syntax + fromMarkdown). `assemble.ts` composes `allFlavors` into what `MarkdownParser` consumes; adding a construct means adding one group to the registry, nothing else.

**Context:** Full design in `design-docs/features/20260701T161127-markdown-flavor-extension-collection/markdown-flavor-extension-collection-design.md`. Decision rule for regex vs. tokenizer, established by the same design: (1) a construct that lives in markdown source always gets a tokenizer extension — regex can't handle code-span/nesting/escaping context correctly; (2) a regular-language token in a *non-markdown* string (URL fragment, path, filename) stays regex — running document grammar over a fragment mis-parses it; (3) a downstream regex re-classifying what a tokenizer already knew should thread a structured field through the token instead of either extreme.

**Alternatives considered:** a stock wiki-link parsing package was tried and rejected for not matching Obsidian's actual syntax variations, which is why jact wrote its own `wikilink`/`obsidianLink` extensions rather than adopting a third-party one.

**Consequences (good):** "what does jact parse?" is answered by reading one file. New flavors (e.g. GFM tables, footnotes) are additive — a new group in the registry, picked up automatically by `assemble()`.

**Consequences (deferred, explicitly not in this slice):**
- An `anchorFlavorPolicy: "obsidian" | "github"` knob for `AnchorMatcher` — GFM-style slugs and Obsidian's kebab-reduction currently conflict, and today's behavior hardcodes the Obsidian stance. Deferred because it's a separate reviewable change to the validator surface.
- Threading an `anchorKind` field onto `wikilink`/`citation`/`obsidianLink` nodes so `determineAnchorType` and the caret/emphasis regexes in `CitationValidator` become field reads instead of re-classification. Deferred — touches node shape across 3 extensions plus validator paths; no current bug traces to it, so it stayed a documented smell rather than urgent work.

A fuller inventory of remaining architecture-principle gaps in this area (naming, boundary violations flagged during the design pass) is tracked in `design-docs/features/20260701T161127-markdown-flavor-extension-collection/architecture-principles-findings.md`.

---

## ADR-0004 — ParsedFileCache single-parse guarantee

**Decision:** `ParsedFileCache.resolveParsedFile()` caches the **Promise** returned by `parser.parseFile()`, keyed by the normalized absolute path, and stores it in the cache *before* awaiting it.

**Context:** Solves three named problems (`src/ParsedFileCache.ts:6-17`): (1) parser encapsulation — callers get a stable `ParsedDocument` facade, not raw parser output; (2) wasted re-parsing — the same file is frequently referenced by multiple citing documents in one validation run; (3) concurrent duplicate work — validating several files that all reference the same target could otherwise trigger overlapping `parseFile()` calls for that target before the first one completes.

**Consequences:** Caching the Promise (not the resolved value) is the mechanism that closes the concurrency gap — two calls to `resolveParsedFile()` for the same path while the first parse is still in flight return the *same* Promise, not two separate parses. Failed promises are evicted from the cache (`.catch(() => this.cache.delete(cacheKey))`) so a subsequent call can retry rather than being stuck on a permanently-rejected cached Promise. `seedParsedFile()` is the escape hatch for in-memory content (`--stdin`) that never touches disk but still needs to participate in the same cache.

---

## ADR-0005 — Batch validate: globs, `--changed`, `--json`

**Decision:** `jact validate` gained multi-path/glob/`--changed`/`--json` support as a pure orchestration layer over the existing single-file `CitationValidator` — no validation logic was forked or duplicated.

Full context, alternatives, and diagram: `design-docs/features/20260701T041917-batch-validate/spec/003-adrs.md`. Key sub-decisions (D1-D6):

| # | Decision |
|---|---|
| D1 | Globs via **tinyglobby**, promoted to a runtime dependency (already in the tree transitively; `fs.glob` is untyped under the project's `lib: ES2022`) |
| D2 | `--changed` = staged+unstaged+untracked `.md` via `git status --porcelain`, **unioned** into the path/glob selection (adds files, never shrinks); alone → just the changed set |
| D3 | New `--json` → compact `{path, ok, errors}` JSONL; existing `--format json` (single-file, different shape) untouched; passing both is an exit-2 error |
| D4 | Keep exactly 3 exit codes, `0`/`1`/`2` — matches single-file's existing exit-2-on-missing-file behavior |
| D5 | Zero-match glob → exit 2 **only when it is the sole selector**; if `--changed` contributed files, proceed on the union; `--changed` with zero changes → exit 0 (normal, not an error) |
| D6 | Sequential execution in v1; parallel deferred — `validateOne` typically closes over a shared `FileCache`/`ParsedFileCache`, and concurrent validation against the same cache risks races |

**Consequences (accepted costs):** two JSON surfaces coexist (`--format json` rich single-file vs. `--json` compact batch) — passing both is a clean error, not silent precedence. `--changed` couples batch mode to `git`; running outside a repo is a clean exit-2 error, not a crash. Sequential execution is slower on large file sets — accepted for v1, revisit with a worker pool only if it becomes a real bottleneck.

---

## Known Tech Debt

Two existing findings docs already catalogue open gaps against architecture principles and against the ADR-0002 migration's own stated scope. This spec surfaces them rather than duplicating them — read the source docs for detail:

- `design-docs/features/20260701T161127-markdown-flavor-extension-collection/architecture-principles-findings.md` — naming and boundary-violation findings from the Flavor Extension Collection design pass.
- `design-docs/features/20260701T161127-markdown-flavor-extension-collection/regex-extraction-census.md` — the residual regex sites called out in ADR-0002 above (`AnchorMatcher.cleanMarkdownForComparison`, `citationFixer`'s citation-string re-parse, and the two thread-field candidates in `determineAnchorType`/`CitationValidator`).

Neither is fixed by this spec-writing pass — they're pre-existing, already-documented debt, listed here so a future contributor doesn't have to rediscover them.

---

## Superseded Documentation

The living specification in `docs/spec/` and ADRs in `docs/adrs/` replace `design-docs/component-guides/` (deprecated 2026-07-01). The most consequential drifts found between the old guides and current code:

1. **Parser engine**: the old MarkdownParser guide describes `marked.js`; current code has zero `marked` imports and parses exclusively via micromark/mdast (ADR-0002 above). jact's own `CLAUDE.md` architecture section repeats this same stale claim.
2. **CLI split**: the old CLI guides describe a single orchestrator class; current code is deliberately split into `src/cli.ts` (Commander registration, issue #29) and `src/jact-cli.ts` (`JactCli`, orchestration) — see [002-architecture.md](../spec/002-architecture.md#CLI%20Orchestrator:%20%60src/cli.ts%60%20+%20%60src/jact-cli.ts%60).
3. **CitationValidator modularization**: the old CitationValidator guide predates the extraction of `AnchorMatcher.ts`, `PathResolver.ts`, and the `pathResolutionStrategies/` strategy array (issue #28) — current `CitationValidator` is a thin coordinator, not a monolith.

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 1.0.0-draft | 2026-07-01 | Initial ADR set, reconstructed from git history and in-repo design docs |
