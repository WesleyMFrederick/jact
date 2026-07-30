# 004. Domain Model

**Status:** done

Canonical types live in `src/types/*.ts`. Every entity below cites its exact source file — treat that file as the ground truth if this doc and the code ever diverge.

## Core Entities

### LinkObject

A parsed markdown reference (`file.ts:src/types/citationTypes.ts:28-76`). Created by `MarkdownParser` (real links) or `LinkObjectFactory` (synthetic links for `extract header`/`extract file`), consumed by `CitationValidator`.

**Fields:**
- `linkType: "markdown" | "wiki"`
- `scope: "internal" | "cross-document"`
- `anchorType: "header" | "block" | null` — null when the link has no anchor
- `source.path.absolute: string | null`
- `target.path.raw: string | null` — null for internal links
- `target.path.absolute: string | null` — null if unresolved or internal
- `target.path.relative: string | null` — null if unresolved or internal
- `target.path.attempted?: readonly string[]` — wiki resolver attempt log, present only on failed wiki resolution
- `target.anchor: string | null`
- `text: string | null` — null for caret references
- `fullMatch: string`
- `line: number` — 1-based
- `column: number` — 0-based
- `extractionMarker: {fullMatch, innerText} | null` — null if no `%%marker%%` follows the link
- `validation?: ValidationMetadata` — added by `CitationValidator`, absent on raw parser output

Internal links (`scope: "internal"`) have `target.path.*` all null since they reference an anchor within the same document, not an external file.

```ts
// path: src/types/citationTypes.ts:28
export interface LinkObject {
	linkType: "markdown" | "wiki";
	scope: LinkScope;
	anchorType: "header" | "block" | null;
	source: { path: { absolute: string | null } };
	target: {
		path: {
			raw: string | null;
			absolute: string | null;
			relative: string | null;
			attempted?: readonly string[];
		};
		anchor: string | null;
	};
	text: string | null;
	fullMatch: string;
	line: number;
	column: number;
	extractionMarker: { fullMatch: string; innerText: string } | null;
	validation?: ValidationMetadata;
}
```

---

### AnchorObject

A potential link target in a document — a heading or a block reference (`src/types/citationTypes.ts:86-121`). Created by `MarkdownParser.extractAnchors()`. Discriminated union on `anchorType` so header-only fields (`urlEncodedId`) can never appear on a block anchor.

**`header` variant:**
- `id: string` — raw heading text
- `urlEncodedId: string` — URL-encoded id for Obsidian compatibility (always present)
- `rawText: string`
- `fullMatch: string`, `line: number` (1-based), `column: number` (0-based)

**`block` variant:**
- `id: string` — block id, e.g. `FR1` or `^my-anchor`
- `rawText: null` — always null for block anchors
- `fullMatch: string`, `line: number`, `column: number`

Sources: header anchors come from ATX headings walked via `unist-util-visit` on the mdast tree (setext headings are skipped, matching the prior contract). Block/caret/emphasis anchors come from the `caretAnchor` and `highlight` mdast node types the parser already produced — see `src/core/MarkdownParser/extractAnchors.ts:46-186`.

---

### HeadingObject

A heading extracted from the mdast tree (`src/types/citationTypes.ts:127-138`). Created by `MarkdownParser.extractHeadings()`.

**Fields:**
- `level: number` — 1-6
- `text: string` — inline text with ATX markers stripped, inline markdown (backticks, emphasis) preserved
- `raw: string` — raw markdown slice including `#` symbols
- `position?: Position` — **source position from the mdast heading node.** This is a load-bearing detail: line numbers for headings come from `node.position` on the parsed tree, not a regex re-scan of the file (`src/core/MarkdownParser/extractHeadings.ts:41-54`).

---

### ParserOutput

The complete contract returned by `MarkdownParser.parseFile()` (`src/types/citationTypes.ts:144-158`).

```ts
// path: src/types/citationTypes.ts:144
export interface ParserOutput {
	filePath: string;
	content: string;
	ast: Root;              // mdast Root — internal reader for the ParsedDocument facade
	links: LinkObject[];
	headings: HeadingObject[];
	anchors: AnchorObject[]; // potential link targets in the document
}
```

---

### ValidationMetadata / EnrichedLinkObject

`src/types/validationTypes.ts`. `CitationValidator.validateSingleCitation()` returns a new `EnrichedLinkObject` built by object-spreading `{ ...link, validation: meta }` — the original `LinkObject` is never mutated (tracked as Issue #37 in the source comments, `validationTypes.ts:1-9`).

```ts
// path: src/types/validationTypes.ts:38
export type ValidationMetadata =
	| { status: "valid" }
	| { status: "error"; error: string; suggestion?: string; pathConversion?: PathConversion }
	| { status: "warning"; message: string; suggestion?: string; pathConversion?: PathConversion };

// path: src/types/validationTypes.ts:60
export interface EnrichedLinkObject extends LinkObject {
	validation: ValidationMetadata;
}
```

`LinkClass = "markdown" | "wiki" | "caret"` (`validationTypes.ts:20`) is a separate **display-layer** discriminator from `LinkObject.linkType`, so reporting/formatting can distinguish caret-block citations from header citations without touching the syntactic `linkType` field.

`PathConversion` (`validationTypes.ts:26-30`) carries an auto-fix suggestion: `{ type: "path-conversion", original: string, recommended: string }`.

---

### ValidationResult

`CitationValidator.validateFile()`'s return shape (`validationTypes.ts:80-84`). **Property names are `summary` and `links`, not `results`** — this matches the enrichment pattern where links are enriched in place within the array.

```ts
// path: src/types/validationTypes.ts:67
export interface ValidationSummary {
	total: number;
	valid: number;
	warnings: number;
	errors: number;
}

// path: src/types/validationTypes.ts:80
export interface ValidationResult {
	summary: ValidationSummary;
	links: EnrichedLinkObject[];
	validationTime?: string;
}
```

---

## Batch-Validate Types (`src/types/cli-types.ts`)

Added for the `jact validate` batch-mode feature (multiple paths, globs, `--changed`, `--json`).

```ts
// path: src/types/cli-types.ts:79
export interface BatchValidateOptions {
	paths: string[];
	changed: boolean;
	json: boolean;
}

// path: src/types/cli-types.ts:93
export interface FileResult {
	path: string;
	ok: boolean;        // true iff summary.errors === 0
	errors: ValidationError[];
}

// path: src/types/cli-types.ts:107
export interface ValidationError {
	line: number | null; // 1-indexed; null = file-level, not tied to a line
	message: string;
}

// path: src/types/cli-types.ts:122
export interface BatchSummary {
	total: number;
	passed: number;
	failed: number;
	results: FileResult[];
}
```

**Gotcha:** `ValidationError.line` is `number | null`, **not optional** (`line?`). Under jact's `exactOptionalPropertyTypes`, an absent key and an explicit `null` are distinct types — the JSONL contract always emits the `line` key, so a file-level error is an explicit `null`, never a missing field.

---

## Extraction Types (`src/types/extraction-types.ts`)

```ts
// path: src/types/extraction-types.ts:12
export interface EligibilityDecision {
	eligible: boolean;
	reason: string;
}

// path: src/types/extraction-types.ts:29
export interface ExtractedContentBlock {
	content: string;
	contentLength: number;
	sourceLinks?: SourceLinkEntry[]; // { rawSourceLink, sourceLine }
}

// path: src/types/extraction-types.ts:39
export interface ProcessedLinkEntry {
	sourceLink: EnrichedLinkObject;
	contentId: string | null;
	status: "extracted" | "skipped" | "success" | "error" | "failed";
	eligibilityReason?: string;
	failureDetails?: { reason: string };
}

// path: src/types/extraction-types.ts:65
export interface ExtractionStats {
	totalLinks: number;
	uniqueContent: number;
	duplicateContentDetected: number;
	tokensSaved: number;
	compressionRatio: number;
}

// path: src/types/extraction-types.ts:80 — public output contract of extract commands
export interface OutgoingLinksExtractedContent {
	extractedContentBlocks: {
		_totalContentCharacterLength: number;
		[contentId: string]: ExtractedContentBlock | number;
	};
	outgoingLinksReport: { processedLinks: ProcessedLinkEntry[]; sourceFilePath?: string };
	stats: ExtractionStats;
}
```

`ExtractionEligibilityStrategy` (`src/types/strategy-types.ts:15-17`) is the strategy interface: `getDecision(link, cliFlags): EligibilityDecision | null` — `null` means "defer to the next strategy in the chain."

---

## FileCache Types (`src/types/fileCacheTypes.ts`)

```ts
// path: src/types/fileCacheTypes.ts:3
export interface CacheStats {
	totalFiles: number;
	duplicates: number;
	scopeFolder: string;
	realScopeFolder: string;
}

// path: src/types/fileCacheTypes.ts:10
export interface ResolveResultSuccess {
	found: true;
	path: string;
	fuzzyMatch?: boolean;
	correctedFilename?: string;
	message?: string;
}

// path: src/types/fileCacheTypes.ts:18
export interface ResolveResultFailure {
	found: false;
	reason: "duplicate" | "not_found" | "duplicate_fuzzy";
	message: string;
	candidates?: string[];         // reason: 'duplicate' | 'duplicate_fuzzy'
	scope?: ScopeResolution;
	nearMisses?: string[];         // reason: 'not_found'; top-3 Levenshtein ≤ 2
	attemptedPaths?: readonly string[];
}

export type ResolveResult = ResolveResultSuccess | ResolveResultFailure;
```

---

## Relationships

```
ParserOutput 1───N LinkObject
ParserOutput 1───N HeadingObject
ParserOutput 1───N AnchorObject
LinkObject   1───1 ValidationMetadata (added during validation → EnrichedLinkObject)
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
| 1.0.0-draft | 2026-07-01 | Initial domain model, grounded in `src/types/*.ts` |
