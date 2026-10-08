# 004. Domain Model

**Status:** done

This section defines the entities that jact callers see. A field list appears only where jact prints the shape as JSON.

Shared data shapes are declared in `src/types/`. Dependency-injection interfaces are not domain entities: each is defined beside its consuming core component and re-exported from `src/types/`.

## Core Entities

Five entities describe one parsed document. [`jact ast <file>`](005-interfaces.md#`jact ast <file>`) prints them as JSON.

### LinkObject

A link object is one parsed reference to an anchor or another file. The `extract header` and `extract file` commands also build synthetic links from their arguments.

**Fields:**
- `linkType` — `"markdown"` or `"wiki"`
- `scope` — `"internal"` (an anchor in the same document) or `"cross-document"`
- `anchorType` — `"header"`, `"block"`, or `null` when the link has no anchor
- `source.path.absolute` — the document that holds the link
- `target.path.raw` (as written), `target.path.absolute`, `target.path.relative` (resolved) — `null` for internal links; resolved paths are `null` when unresolved
- `target.path.attempted` — paths tried by a failed wiki resolution
- `target.anchor` — anchor text, or `null`
- `text` — display text; `null` for caret references
- `fullMatch` — the source text of the link
- `line` (1-based), `column` (0-based)
- `extractionMarker` — the following `%%…%%` marker (`fullMatch`, `innerText`), or `null`
- `validation` — added by validation (see below)

---

### AnchorObject

An anchor object is a heading or block reference that a link can target. The `anchorType` field selects the variant.

**`header` variant:** `id` (heading text, or an explicit `{#custom-id}`), `urlEncodedId` (Obsidian-style encoded id, always present), `rawText`, `fullMatch`, `line`, `column`.

**`block` variant:** `id` (block id, such as `FR1`), `rawText` (always `null`), `fullMatch`, `line`, `column`. It never has `urlEncodedId`.

Only ATX headings (`# Heading`) produce header anchors; setext headings do not.

---

### HeadingObject

A heading object is one heading in the document, in source order.

**Fields:**
- `level` — 1 to 6
- `text` — heading text without ATX markers; inline Markdown such as backticks and emphasis stays
- `raw` — the source text of the heading, including `#` markers
- `position` — the source position from the parsed tree; heading line numbers never come from a second text scan

---

### EmbedReference

An embed reference is one inline image or Obsidian wiki embed. Embeds are separate from links.

**Fields:**
- `kind` — `"markdown"` (inline image) or `"wiki"` (`![[…]]` embed)
- `target` — the destination; for a wiki embed, the text before any `#`, `^`, or `|` suffix
- `line` — 1-based; `0` when the parsed node has no position

A reference-style image (`![alt][ref]`) is not an embed reference. Its link definition represents it.

---

### ParserOutput

Parser output is the complete parsed form of one document. `jact ast` prints it.

**Fields:**
- `filePath`, `content` — the source path and text
- `ast` — the Markdown syntax tree (mdast)
- `validationDisabled` — `true` when the document opts out of validation; the directive rules are in [`jact validate`](005-interfaces.md#`jact validate`)
- `links`, `embeds`, `headings`, `anchors` — lists of the entities above

---

### ValidationMetadata / EnrichedLinkObject

Validation metadata is the result of checking one link. An enriched link object is a link object plus its `validation` field. Validation builds a new object; it never changes the original link.

The `status` field selects the variant:

| Status | Fields |
|---|---|
| `valid` | none |
| `error` | `error` (message), optional `suggestion`, `pathConversion`, `anchorConversion` |
| `warning` | `message`, optional `suggestion`, `pathConversion`, `anchorConversion` |

A path conversion or anchor conversion carries the fix that `--fix` applies: `type` (`"path-conversion"` or `"anchor-conversion"`), `original`, and `recommended`.

JSON output renders duplicate-filename candidates into the `suggestion` string and omits the candidate data.

---

### ValidationResult

A validation result is the outcome of checking one document. `jact validate --format json` prints it.

**Fields:**
- `summary` — counts: `total`, `valid`, `warnings`, `errors`
- `links` — every enriched link object in the checked range
- `validationTime` — elapsed time, such as `"0.4s"`
- `lineRange` — the applied range, such as `"150-160"`; present only with `--lines`

With `--lines`, the summary counts only the links in the range. A document that opts out prints zero counts, an empty `links` list, `skipped: true`, and `skipReason`.

---

## Batch-Validate Types (`src/types/cli-types.ts`)

A file result is the outcome of checking one file in batch mode. [`jact validate`](005-interfaces.md#`jact validate`) `--json` prints one per line.

**File result fields:**
- `path` — the file as selected
- `ok` — `true` when the file has no errors
- `errors` — one entry per error: `line` and `message`
- `skipped` — `true` only for a document that opts out; absent otherwise

The `line` key is always present; a file-level error has `line: null`.

The batch summary counts `total`, `passed`, `failed`, and `skipped` files; a skip is not a pass. The summary sets the exit code but is not printed as JSON.

---

## Extraction Types (`src/types/extraction-types.ts`)

Extraction output is the deduplicated content that `extract` commands print as JSON. Default JSON holds only `extractedContentBlocks`; `--verbose` adds `outgoingLinksReport` and `stats`.

**`extractedContentBlocks`** — a map from content id to block. A content id is the first 16 hexadecimal characters of the SHA-256 hash of the content, so equal content is stored once. Each block has:
- `content`, `contentLength`
- `startLine` — 1-based source line of the first content line, when known
- `sourceLinks` — the links that pulled in the block: `rawSourceLink`, `sourceLine`

The map also holds `_totalContentCharacterLength`, the length of the serialized blocks.

**`outgoingLinksReport.processedLinks`** — one entry per link:
- `sourceLink` — the enriched link object
- `contentId` — the block id, or `null` when nothing was extracted
- `status` — `"extracted"`, `"skipped"` (not extracted: validation error, ineligible, unresolved, or outside the read boundary), or `"failed"`
- `failureDetails.reason` — why a link was skipped or failed

**`stats`:** `totalLinks`, `uniqueContent`, `duplicateContentDetected`, `tokensSaved`, `compressionRatio`.

**Linked-context output.** `jact extract header --extract-linked-content --format json` prints a different shape, marked `mode: "linked-context"`. It adds `complete`, `depth`, `root`, `outgoingLinks`, `backlinks`, and `failures`, and each content block names its `source`.

Eligibility rules in `src/core/ContentExtractor/` decide which links are extracted.

---

## FileCache Types (`src/types/fileCacheTypes.ts`)

A file resolution result is the outcome of finding a file by name in the scope. A failure has a reason: `not_found`, `duplicate`, or `duplicate_fuzzy`. A duplicate failure keeps every candidate, ranked by directory distance from the expected location, then by scope-relative path. Only the output formatter limits the display; see [`jact validate`](005-interfaces.md#`jact validate`).

---

## Relationships

One parsed document owns its links, embeds, headings, and anchors.

```
ParserOutput 1───N LinkObject
ParserOutput 1───N EmbedReference
ParserOutput 1───N HeadingObject
ParserOutput 1───N AnchorObject
LinkObject   1───1 ValidationMetadata (validation adds it → EnrichedLinkObject)
ValidationResult 1───N EnrichedLinkObject
BatchSummary 1───N FileResult
FileResult   1───N ValidationError
OutgoingLinksExtractedContent 1───N ProcessedLinkEntry
ProcessedLinkEntry 1───1 EnrichedLinkObject (sourceLink)
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0-draft | 2026-10-07 | Aligned to code; removed internal code names to reduce drift |
| 1.0.0-draft | 2026-10-06 | Added typed inline-image and wiki-embed references to the required parser output contract |
| 1.0.0-draft | 2026-08-13 | Added optional extracted-content start lines for source-numbered command output |
| 1.0.0-draft | 2026-08-02 | Added parser disable state, structured duplicate-path diagnostics, and skipped batch results |
| 1.0.0-draft | 2026-07-01 | Initial domain model, grounded in `src/types/*.ts` |
