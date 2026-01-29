# Epic 6: ContentExtractor TypeScript Migration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert all ContentExtractor JavaScript files to TypeScript while preserving existing architecture, strategy pattern, and data contracts.

**Architecture:** 9 JS files convert to TS in dependency order: types first, then leaf strategies, then chain function, then utilities, then operation file, then orchestrator class. `normalizeAnchor.ts` already converted (Epic 3). `contentExtractorTypes.ts` exists but needs expansion to match runtime structure.

**Tech Stack:** TypeScript 5.3+, Vitest, Node.js ESM, `@types/marked`

**Key Constraint:** 261/279 tests currently pass (18 fail due to `componentFactory.js` blocker — resolves in Epic 7). Validate against 261 passing tests throughout.

**Project Root:** `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows`

---

## Task 1 — Update contentExtractorTypes.ts to match runtime structure

### Context

The existing `contentExtractorTypes.ts` has `OutgoingLinksExtractedContent` but it's **incomplete** — missing `outgoingLinksReport`, `stats`, and processed link types that the actual runtime code produces. We must fix these types FIRST so all subsequent conversions import correct contracts.

**CRITICAL:** Do NOT invent types. Match the actual runtime structure in `extractLinksContent.js` and `ContentExtractor.js`.

### Files

- `tools/citation-manager/src/types/contentExtractorTypes.ts` (MODIFY)

### Step 1: Read existing types and runtime code

Read these files to understand the gap:

```bash
cat tools/citation-manager/src/types/contentExtractorTypes.ts
cat tools/citation-manager/src/core/ContentExtractor/extractLinksContent.js
cat tools/citation-manager/src/core/ContentExtractor/ContentExtractor.js
```

Compare the `OutgoingLinksExtractedContent` interface against what `extractLinksContent.js` actually builds (lines 34-46 for the structure, lines 54-141 for processedLinks entries).

### Step 2: Update contentExtractorTypes.ts

Replace the incomplete `OutgoingLinksExtractedContent` and add missing types. The complete file should be:

```typescript
import type { LinkObject } from './citationTypes.js';
import type { EnrichedLinkObject } from './validationTypes.js';

/**
 * CLI flags affecting content extraction behavior.
 * Integration: Passed to ContentExtractor and strategy chain.
 */
export interface CliFlags {
 /** Extract full file content instead of sections */
 fullFiles?: boolean;
}

/**
 * Strategy interface for extraction eligibility evaluation.
 * Pattern: Strategy pattern with null return indicating "pass to next strategy".
 */
export interface ExtractionEligibilityStrategy {
 getDecision(
  link: LinkObject,
  cliFlags: CliFlags
 ): { eligible: boolean; reason: string } | null;
}

/**
 * Eligibility decision returned by strategy chain.
 */
export interface EligibilityDecision {
 eligible: boolean;
 reason: string;
}

/**
 * Source link traceability entry within a content block.
 */
export interface SourceLinkEntry {
 rawSourceLink: string;
 sourceLine: number;
}

/**
 * Single extracted content block with deduplication metadata.
 * Keyed by SHA-256 content hash in extractedContentBlocks.
 */
export interface ExtractedContentBlock {
 content: string;
 contentLength: number;
 sourceLinks: SourceLinkEntry[];
}

/**
 * Processed link entry in the outgoing links report.
 * Each link gets one entry regardless of extraction outcome.
 */
export interface ProcessedLinkEntry {
 sourceLink: EnrichedLinkObject;
 contentId: string | null;
 status: "extracted" | "skipped" | "success" | "error" | "failed";
 eligibilityReason?: string;
 failureDetails?: {
  reason: string;
 };
}

/**
 * Outgoing links report section of extraction output.
 */
export interface OutgoingLinksReport {
 processedLinks: ProcessedLinkEntry[];
 sourceFilePath?: string;
}

/**
 * Extraction statistics for deduplication metrics.
 */
export interface ExtractionStats {
 totalLinks: number;
 uniqueContent: number;
 duplicateContentDetected: number;
 tokensSaved: number;
 compressionRatio: number;
}

/**
 * Complete extraction result — the public output contract.
 * Built incrementally during extraction with inline deduplication.
 *
 * CRITICAL: This must match what extractLinksContent.js and
 * ContentExtractor.extractContent() actually return at runtime.
 */
export interface OutgoingLinksExtractedContent {
 extractedContentBlocks: {
  _totalContentCharacterLength: number;
  [contentId: string]: ExtractedContentBlock | number;
 };
 outgoingLinksReport: OutgoingLinksReport;
 stats: ExtractionStats;
}
```

### Step 3: Verify TypeScript compiles

```bash
cd tools/citation-manager && npx tsc --noEmit
```

Expected: Zero new errors (existing JS files are not checked by tsc).

### Step 4: Run tests

```bash
cd tools/citation-manager && npm test
```

Expected: 261 passed, 18 failed (same as before — type changes don't affect runtime).

### Step 5: Commit

Use `create-git-commit` skill:

```text
feat(epic6): [Task 1] update contentExtractorTypes.ts to match runtime structure
```

---

## Task 2 — Convert ExtractionStrategy.js to TypeScript

### Context

Base strategy class. All 4 concrete strategies extend this. Currently a plain JS class with a `getDecision` method that returns `null`. After conversion, concrete strategies will implement `ExtractionEligibilityStrategy` interface from types.

### Files

- `tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/ExtractionStrategy.js` → rename to `.ts` (MODIFY)

### Step 1: Read current file

```bash
cat tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/ExtractionStrategy.js
```

### Step 2: Rename and convert

Rename file from `.js` to `.ts`:

```bash
cd tools/citation-manager && git mv src/core/ContentExtractor/eligibilityStrategies/ExtractionStrategy.js src/core/ContentExtractor/eligibilityStrategies/ExtractionStrategy.ts
```

Replace contents with typed version:

```typescript
import type { LinkObject } from '../../../types/citationTypes.js';
import type { CliFlags, EligibilityDecision } from '../../../types/contentExtractorTypes.js';

/**
 * Base class for extraction eligibility strategies.
 * Strategy Pattern: Each rule encapsulated in its own class.
 */
export class ExtractionStrategy {
 /**
  * Evaluate link eligibility based on strategy-specific criteria.
  * @param link - Link to evaluate
  * @param cliFlags - CLI flags
  * @returns Decision if strategy applies, null to pass to next strategy
  */
 getDecision(link: LinkObject, cliFlags: CliFlags): EligibilityDecision | null {
  return null;
 }
}
```

### Step 3: Verify TypeScript compiles

```bash
cd tools/citation-manager && npx tsc --noEmit
```

Expected: Zero new errors.

### Step 4: Run tests

```bash
cd tools/citation-manager && npm test
```

Expected: 261 passed, 18 failed (unchanged).

### Step 5: Commit

```text
feat(epic6): [Task 2] convert ExtractionStrategy.js to TypeScript
```

---

## Task 3 — Convert 4 concrete strategy files to TypeScript

### Context

Four strategy classes extending `ExtractionStrategy`. Each is small (15-30 lines), similar structure. Convert all in one task since they're structurally identical and independent of each other.

### Files

- `tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/StopMarkerStrategy.js` → `.ts` (MODIFY)
- `tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/ForceMarkerStrategy.js` → `.ts` (MODIFY)
- `tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/SectionLinkStrategy.js` → `.ts` (MODIFY)
- `tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/CliFlagStrategy.js` → `.ts` (MODIFY)

### Step 1: Read all 4 strategy files

```bash
cat tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/StopMarkerStrategy.js
cat tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/ForceMarkerStrategy.js
cat tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/SectionLinkStrategy.js
cat tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/CliFlagStrategy.js
```

### Step 2: Rename all files

```bash
cd tools/citation-manager && \
git mv src/core/ContentExtractor/eligibilityStrategies/StopMarkerStrategy.js src/core/ContentExtractor/eligibilityStrategies/StopMarkerStrategy.ts && \
git mv src/core/ContentExtractor/eligibilityStrategies/ForceMarkerStrategy.js src/core/ContentExtractor/eligibilityStrategies/ForceMarkerStrategy.ts && \
git mv src/core/ContentExtractor/eligibilityStrategies/SectionLinkStrategy.js src/core/ContentExtractor/eligibilityStrategies/SectionLinkStrategy.ts && \
git mv src/core/ContentExtractor/eligibilityStrategies/CliFlagStrategy.js src/core/ContentExtractor/eligibilityStrategies/CliFlagStrategy.ts
```

### Step 3: Convert each file

**StopMarkerStrategy.ts:**

```typescript
import type { LinkObject } from '../../../types/citationTypes.js';
import type { CliFlags, EligibilityDecision } from '../../../types/contentExtractorTypes.js';
import { ExtractionStrategy } from './ExtractionStrategy.js';

/**
 * Strategy checking for %%stop-extract-link%% marker.
 * Highest precedence rule - prevents extraction regardless of other rules.
 */
export class StopMarkerStrategy extends ExtractionStrategy {
 getDecision(link: LinkObject, cliFlags: CliFlags): EligibilityDecision | null {
  if (link.extractionMarker?.innerText === 'stop-extract-link') {
   return {
    eligible: false,
    reason: 'stop-extract-link marker prevents extraction',
   };
  }
  return null;
 }
}
```

**ForceMarkerStrategy.ts:**

```typescript
import type { LinkObject } from '../../../types/citationTypes.js';
import type { CliFlags, EligibilityDecision } from '../../../types/contentExtractorTypes.js';
import { ExtractionStrategy } from './ExtractionStrategy.js';

/**
 * Strategy checking for %%force-extract%% marker.
 * Forces extraction of full-file links without --full-files flag.
 */
export class ForceMarkerStrategy extends ExtractionStrategy {
 getDecision(link: LinkObject, cliFlags: CliFlags): EligibilityDecision | null {
  if (link.extractionMarker?.innerText === 'force-extract') {
   return {
    eligible: true,
    reason: 'force-extract overrides defaults',
   };
  }
  return null;
 }
}
```

**SectionLinkStrategy.ts:**

```typescript
import type { LinkObject } from '../../../types/citationTypes.js';
import type { CliFlags, EligibilityDecision } from '../../../types/contentExtractorTypes.js';
import { ExtractionStrategy } from './ExtractionStrategy.js';

/**
 * Strategy for default section/block link behavior.
 * Links with anchors are eligible by default.
 */
export class SectionLinkStrategy extends ExtractionStrategy {
 getDecision(link: LinkObject, cliFlags: CliFlags): EligibilityDecision | null {
  if (link.anchorType !== null) {
   return {
    eligible: true,
    reason: 'Markdown anchor links eligible by default',
   };
  }
  return null;
 }
}
```

**CliFlagStrategy.ts:**

```typescript
import type { LinkObject } from '../../../types/citationTypes.js';
import type { CliFlags, EligibilityDecision } from '../../../types/contentExtractorTypes.js';
import { ExtractionStrategy } from './ExtractionStrategy.js';

/**
 * Strategy evaluating --full-files CLI flag.
 * Terminal strategy - always returns decision (never null).
 */
export class CliFlagStrategy extends ExtractionStrategy {
 getDecision(link: LinkObject, cliFlags: CliFlags): EligibilityDecision | null {
  if (cliFlags.fullFiles === true) {
   return {
    eligible: true,
    reason: 'CLI flag --full-files forces extraction',
   };
  }
  return {
   eligible: false,
   reason: 'Full-file link ineligible without --full-files flag',
  };
 }
}
```

### Step 4: Verify TypeScript compiles

```bash
cd tools/citation-manager && npx tsc --noEmit
```

Expected: Zero new errors.

### Step 5: Run tests

```bash
cd tools/citation-manager && npm test
```

Expected: 261 passed, 18 failed (unchanged).

### Step 6: Commit

```text
feat(epic6): [Task 3] convert 4 concrete strategy files to TypeScript
```

---

## Task 4 — Convert analyzeEligibility.js to TypeScript

### Context

Chain-of-responsibility function that loops through strategies. Also has a factory function `createEligibilityAnalyzer`. Small file (35 lines).

### Files

- `tools/citation-manager/src/core/ContentExtractor/analyzeEligibility.js` → `.ts` (MODIFY)

### Step 1: Read current file

```bash
cat tools/citation-manager/src/core/ContentExtractor/analyzeEligibility.js
```

### Step 2: Rename and convert

```bash
cd tools/citation-manager && git mv src/core/ContentExtractor/analyzeEligibility.js src/core/ContentExtractor/analyzeEligibility.ts
```

Replace contents:

```typescript
import type { LinkObject } from '../../types/citationTypes.js';
import type {
 CliFlags,
 EligibilityDecision,
 ExtractionEligibilityStrategy,
} from '../../types/contentExtractorTypes.js';

/**
 * Analyze link eligibility using strategy chain.
 * Returns first non-null decision from precedence-ordered strategies.
 *
 * @param link - Link to analyze
 * @param cliFlags - CLI flags
 * @param strategies - Strategy chain in precedence order
 * @returns Eligibility decision
 */
export function analyzeEligibility(
 link: LinkObject,
 cliFlags: CliFlags,
 strategies: ExtractionEligibilityStrategy[],
): EligibilityDecision {
 for (const strategy of strategies) {
  const decision = strategy.getDecision(link, cliFlags);
  if (decision !== null) {
   return decision;
  }
 }
 return { eligible: false, reason: 'No strategy matched' };
}

/**
 * Factory function creating configured analyzer.
 * Encapsulates strategy array for reuse.
 *
 * @param strategies - Ordered strategy chain
 * @returns Configured analyzer function
 */
export function createEligibilityAnalyzer(
 strategies: ExtractionEligibilityStrategy[],
): (link: LinkObject, cliFlags: CliFlags) => EligibilityDecision {
 return (link: LinkObject, cliFlags: CliFlags) =>
  analyzeEligibility(link, cliFlags, strategies);
}
```

### Step 3: Verify TypeScript compiles

```bash
cd tools/citation-manager && npx tsc --noEmit
```

### Step 4: Run tests

```bash
cd tools/citation-manager && npm test
```

Expected: 261 passed, 18 failed (unchanged).

### Step 5: Commit

```text
feat(epic6): [Task 4] convert analyzeEligibility.js to TypeScript
```

---

## Task 5 — Convert generateContentId.js to TypeScript

### Context

Simple utility function using Node.js `crypto` to generate SHA-256 hash. 21 lines.

### Files

- `tools/citation-manager/src/core/ContentExtractor/generateContentId.js` → `.ts` (MODIFY)

### Step 1: Read current file

```bash
cat tools/citation-manager/src/core/ContentExtractor/generateContentId.js
```

### Step 2: Rename and convert

```bash
cd tools/citation-manager && git mv src/core/ContentExtractor/generateContentId.js src/core/ContentExtractor/generateContentId.ts
```

Replace contents:

```typescript
import { createHash } from 'crypto';

/**
 * Generate content-based identifier using SHA-256 hashing.
 * Integration: Uses Node.js crypto module for deterministic hashing.
 *
 * @param content - Content string to hash
 * @returns 16-character hex hash (truncated SHA-256)
 */
export function generateContentId(content: string): string {
 const hash = createHash('sha256');
 hash.update(content);
 const fullHash = hash.digest('hex');
 return fullHash.substring(0, 16);
}
```

### Step 3: Verify TypeScript compiles

```bash
cd tools/citation-manager && npx tsc --noEmit
```

### Step 4: Run tests

```bash
cd tools/citation-manager && npm test
```

Expected: 261 passed, 18 failed (unchanged).

### Step 5: Commit

```text
feat(epic6): [Task 5] convert generateContentId.js to TypeScript
```

---

## Task 6 — Convert extractLinksContent.js to TypeScript

### Context

Primary extraction operation (167 lines). Orchestrates validation → eligibility → content retrieval → deduplication. Imports `analyzeEligibility`, `generateContentId`, and `normalizeAnchor`. Uses `ParsedFileCache`, `CitationValidator`, and `ParsedDocument` facades.

**CRITICAL:** This file uses dynamic imports and destructured dependency injection. Type the dependencies parameter carefully. Do NOT change the enrichment/deduplication logic — only add types.

### Files

- `tools/citation-manager/src/core/ContentExtractor/extractLinksContent.js` → `.ts` (MODIFY)

### Step 1: Read current file carefully

```bash
cat tools/citation-manager/src/core/ContentExtractor/extractLinksContent.js
```

Pay attention to:
- The destructured `{ parsedFileCache, citationValidator, eligibilityStrategies }` param
- The `deduplicatedOutput` structure shape
- How `processedLinks` entries differ by status (skipped vs success vs error)

### Step 2: Rename and convert

```bash
cd tools/citation-manager && git mv src/core/ContentExtractor/extractLinksContent.js src/core/ContentExtractor/extractLinksContent.ts
```

Replace contents. Key typing decisions:

1. **Dependencies param**: Use inline interface (consumer-defined, per coding standards)
2. **deduplicatedOutput**: Type as the growing structure, cast to `OutgoingLinksExtractedContent` at return
3. **ParsedDocument**: Use inline interface for the facade methods we call (`extractSection`, `extractBlock`, `extractFullContent`)
4. **CitationValidator**: Use inline interface for `validateFile`

```typescript
import type { EnrichedLinkObject, ValidationResult } from '../../types/validationTypes.js';
import type {
 CliFlags,
 ExtractionEligibilityStrategy,
 ExtractionStats,
 OutgoingLinksExtractedContent,
 OutgoingLinksReport,
 ProcessedLinkEntry,
 ExtractedContentBlock,
} from '../../types/contentExtractorTypes.js';
import { analyzeEligibility } from './analyzeEligibility.js';
import { generateContentId } from './generateContentId.js';
import { decodeUrlAnchor, normalizeBlockId } from './normalizeAnchor.js';

/**
 * Consumer-defined interface for ParsedFileCache dependency.
 * Only declares the method this operation needs.
 */
interface ParsedFileCacheDep {
 resolveParsedFile(filePath: string): Promise<ParsedDocumentDep>;
}

/**
 * Consumer-defined interface for ParsedDocument facade.
 * Only declares the methods this operation calls.
 */
interface ParsedDocumentDep {
 extractSection(headingText: string): string | null;
 extractBlock(blockId: string | null): string;
 extractFullContent(): string;
}

/**
 * Consumer-defined interface for CitationValidator dependency.
 */
interface CitationValidatorDep {
 validateFile(filePath: string): Promise<ValidationResult>;
}

/**
 * Dependencies for extractLinksContent operation.
 */
interface ExtractLinksContentDeps {
 parsedFileCache: ParsedFileCacheDep;
 citationValidator: CitationValidatorDep;
 eligibilityStrategies: ExtractionEligibilityStrategy[];
}

/**
 * Extract content from links in source file with deduplication.
 * Primary operation orchestrating validation -> eligibility -> content retrieval -> deduplication.
 *
 * @param sourceFilePath - Path to source file containing links
 * @param cliFlags - CLI flags (e.g., { fullFiles: boolean })
 * @param dependencies - Component dependencies
 * @returns Deduplicated extraction result
 */
export async function extractLinksContent(
 sourceFilePath: string,
 cliFlags: CliFlags,
 { parsedFileCache, citationValidator, eligibilityStrategies }: ExtractLinksContentDeps,
): Promise<OutgoingLinksExtractedContent> {
 // PHASE 1: Validation (AC3)
 const validationResult: ValidationResult = await citationValidator.validateFile(sourceFilePath);
 const enrichedLinks: EnrichedLinkObject[] = validationResult.links;

 // AC15: Filter out internal links before processing
 const crossDocumentLinks = enrichedLinks.filter(
  (link) => link.scope !== 'internal',
 );

 // PHASE 2: Initialize Deduplicated Structure
 const extractedContentBlocks: Record<string, ExtractedContentBlock> = {};
 const processedLinks: ProcessedLinkEntry[] = [];
 const stats: ExtractionStats = {
  totalLinks: 0,
  uniqueContent: 0,
  duplicateContentDetected: 0,
  tokensSaved: 0,
  compressionRatio: 0,
 };

 // PHASE 3: Process each link with deduplication
 for (const link of crossDocumentLinks) {
  stats.totalLinks++;

  // AC4: Skip validation errors
  if (link.validation.status === 'error') {
   processedLinks.push({
    sourceLink: link,
    contentId: null,
    status: 'skipped',
    failureDetails: {
     reason: `Link failed validation: ${link.validation.error}`,
    },
   });
   continue;
  }

  // AC4: Check eligibility using strategy chain
  const eligibilityDecision = analyzeEligibility(
   link,
   cliFlags,
   eligibilityStrategies,
  );
  if (!eligibilityDecision.eligible) {
   processedLinks.push({
    sourceLink: link,
    contentId: null,
    status: 'skipped',
    failureDetails: {
     reason: `Link not eligible: ${eligibilityDecision.reason}`,
    },
   });
   continue;
  }

  // PHASE 4: Content Retrieval with Deduplication (AC5-AC7)
  try {
   const decodedPath = decodeURIComponent(link.target.path.absolute as string);
   const targetDoc = await parsedFileCache.resolveParsedFile(decodedPath);

   let extractedContent: string;
   if (link.anchorType === 'header') {
    const decodedAnchor = decodeUrlAnchor(link.target.anchor);
    const result = targetDoc.extractSection(decodedAnchor ?? '');
    if (!result) {
     throw new Error(`Heading not found: ${decodedAnchor}`);
    }
    extractedContent = result;
   } else if (link.anchorType === 'block') {
    const normalizedAnchor = normalizeBlockId(link.target.anchor);
    extractedContent = targetDoc.extractBlock(normalizedAnchor);
   } else {
    extractedContent = targetDoc.extractFullContent();
   }

   // Deduplication
   const contentId = generateContentId(extractedContent);

   if (!(contentId in extractedContentBlocks)) {
    extractedContentBlocks[contentId] = {
     content: extractedContent,
     contentLength: extractedContent.length,
     sourceLinks: [],
    };
    stats.uniqueContent++;
   } else {
    stats.duplicateContentDetected++;
    stats.tokensSaved += extractedContent.length;
   }

   processedLinks.push({
    sourceLink: link,
    contentId: contentId,
    status: 'success',
    eligibilityReason: eligibilityDecision.reason,
   });
  } catch (error) {
   processedLinks.push({
    sourceLink: link,
    contentId: null,
    status: 'error',
    failureDetails: { reason: `Extraction failed: ${(error as Error).message}` },
   });
  }
 }

 // PHASE 5: Calculate Final Statistics
 const totalContentSize = Object.values(extractedContentBlocks)
  .reduce((sum, block) => sum + block.contentLength, 0);
 stats.compressionRatio =
  totalContentSize + stats.tokensSaved === 0
   ? 0
   : stats.tokensSaved / (totalContentSize + stats.tokensSaved);

 // Add JSON size metadata
 const jsonSize = JSON.stringify(extractedContentBlocks).length;

 return {
  extractedContentBlocks: {
   _totalContentCharacterLength: jsonSize,
   ...extractedContentBlocks,
  },
  outgoingLinksReport: {
   processedLinks,
  },
  stats,
 } as OutgoingLinksExtractedContent;
}
```

### Step 3: Verify TypeScript compiles

```bash
cd tools/citation-manager && npx tsc --noEmit
```

Fix any type errors. Common issues:
- `link.target.path.absolute` may need `as string` assertion (nullable in LinkObject)
- `error.message` needs `(error as Error).message`
- `normalizeBlockId` returns `string | null`, `extractBlock` expects `string` — may need null coercion

### Step 4: Run tests

```bash
cd tools/citation-manager && npm test
```

Expected: 261 passed, 18 failed (unchanged).

### Step 5: Commit

```text
feat(epic6): [Task 6] convert extractLinksContent.js to TypeScript
```

---

## Task 7 — Convert ContentExtractor.js to TypeScript

### Context

Orchestrator class (226 lines). Has constructor DI, delegates to operation files. Two extraction paths: `extractLinksContent()` (validates internally) and `extractContent()` (receives pre-validated links).

**CRITICAL:** The `extractContent()` method has dynamic imports at lines 66-70. Convert these to static imports at the top of the file since all imported modules are now TypeScript.

### Files

- `tools/citation-manager/src/core/ContentExtractor/ContentExtractor.js` → `.ts` (MODIFY)

### Step 1: Read current file

```bash
cat tools/citation-manager/src/core/ContentExtractor/ContentExtractor.js
```

### Step 2: Rename and convert

```bash
cd tools/citation-manager && git mv src/core/ContentExtractor/ContentExtractor.js src/core/ContentExtractor/ContentExtractor.ts
```

Replace contents. Key decisions:
1. **Constructor params**: Use inline consumer-defined interfaces (per coding standards)
2. **Static imports**: Replace dynamic `await import()` calls with static imports at top
3. **extractContent return**: Type as `Promise<OutgoingLinksExtractedContent>`
4. **Preserve both extraction paths** exactly as they exist

```typescript
import type { LinkObject } from '../../types/citationTypes.js';
import type { EnrichedLinkObject, ValidationResult } from '../../types/validationTypes.js';
import type {
 CliFlags,
 EligibilityDecision,
 ExtractionEligibilityStrategy,
 ExtractedContentBlock,
 ExtractionStats,
 OutgoingLinksExtractedContent,
 ProcessedLinkEntry,
} from '../../types/contentExtractorTypes.js';
import { analyzeEligibility } from './analyzeEligibility.js';
import { extractLinksContent as extractLinksContentOp } from './extractLinksContent.js';
import { generateContentId } from './generateContentId.js';
import { decodeUrlAnchor, normalizeBlockId } from './normalizeAnchor.js';

/**
 * Consumer-defined interface for ParsedFileCache dependency.
 */
interface ParsedFileCacheInterface {
 resolveParsedFile(filePath: string): Promise<ParsedDocumentInterface>;
}

/**
 * Consumer-defined interface for ParsedDocument facade.
 */
interface ParsedDocumentInterface {
 extractSection(headingText: string): string | null;
 extractBlock(blockId: string | null): string;
 extractFullContent(): string;
}

/**
 * Consumer-defined interface for CitationValidator dependency.
 */
interface CitationValidatorInterface {
 validateFile(filePath: string): Promise<ValidationResult>;
}

/**
 * Content Extractor component orchestrating extraction eligibility analysis.
 * Component entry point following TitleCase naming convention.
 */
export class ContentExtractor {
 private eligibilityStrategies: ExtractionEligibilityStrategy[];
 private parsedFileCache: ParsedFileCacheInterface;
 private citationValidator: CitationValidatorInterface;

 /**
  * Create ContentExtractor with eligibility strategies and dependencies.
  */
 constructor(
  eligibilityStrategies: ExtractionEligibilityStrategy[],
  parsedFileCache: ParsedFileCacheInterface,
  citationValidator: CitationValidatorInterface,
 ) {
  this.eligibilityStrategies = eligibilityStrategies;
  this.parsedFileCache = parsedFileCache;
  this.citationValidator = citationValidator;
 }

 /**
  * Analyze link eligibility using strategy chain.
  */
 analyzeEligibility(link: LinkObject, cliFlags: CliFlags): EligibilityDecision {
  return analyzeEligibility(link, cliFlags, this.eligibilityStrategies);
 }

 /**
  * Extract content from links in source file.
  * Thin wrapper delegating to operation file.
  */
 async extractLinksContent(
  sourceFilePath: string,
  cliFlags: CliFlags,
 ): Promise<OutgoingLinksExtractedContent> {
  return await extractLinksContentOp(sourceFilePath, cliFlags, {
   parsedFileCache: this.parsedFileCache,
   citationValidator: this.citationValidator,
   eligibilityStrategies: this.eligibilityStrategies,
  });
 }

 /**
  * Extract content from pre-validated enriched links.
  * CLI handles Phase 1 validation, passes enriched links here.
  */
 async extractContent(
  enrichedLinks: EnrichedLinkObject[],
  cliFlags: CliFlags,
 ): Promise<OutgoingLinksExtractedContent> {
  // AC15: Filter out internal links before processing
  const crossDocumentLinks = enrichedLinks.filter(
   (link) => link.scope !== 'internal',
  );

  // Initialize Deduplicated Structure
  const extractedContentBlocks: Record<string, ExtractedContentBlock> = {};
  const processedLinks: ProcessedLinkEntry[] = [];
  const stats: ExtractionStats = {
   totalLinks: 0,
   uniqueContent: 0,
   duplicateContentDetected: 0,
   tokensSaved: 0,
   compressionRatio: 0,
  };

  // Process each link with deduplication
  for (const link of crossDocumentLinks) {
   stats.totalLinks++;

   // AC4: Skip validation errors
   if (link.validation.status === 'error') {
    processedLinks.push({
     sourceLink: link,
     contentId: null,
     status: 'skipped',
     failureDetails: {
      reason: `Link failed validation: ${link.validation.error}`,
     },
    });
    continue;
   }

   // AC4: Check eligibility using strategy chain
   const eligibilityDecision = analyzeEligibility(
    link,
    cliFlags,
    this.eligibilityStrategies,
   );
   if (!eligibilityDecision.eligible) {
    processedLinks.push({
     sourceLink: link,
     contentId: null,
     status: 'skipped',
     failureDetails: {
      reason: `Link not eligible: ${eligibilityDecision.reason}`,
     },
    });
    continue;
   }

   // Content Retrieval with Deduplication (AC5-AC7)
   try {
    const decodedPath = decodeURIComponent(link.target.path.absolute as string);
    const targetDoc = await this.parsedFileCache.resolveParsedFile(decodedPath);

    let extractedContent: string;
    if (link.anchorType === 'header') {
     const decodedAnchor = decodeUrlAnchor(link.target.anchor);
     const result = targetDoc.extractSection(decodedAnchor ?? '');
     if (!result) {
      throw new Error(`Heading not found: ${decodedAnchor}`);
     }
     extractedContent = result;
    } else if (link.anchorType === 'block') {
     const blockId = normalizeBlockId(link.target.anchor);
     extractedContent = targetDoc.extractBlock(blockId);
    } else {
     extractedContent = targetDoc.extractFullContent();
    }

    // Deduplication
    const contentId = generateContentId(extractedContent);
    const contentLength = extractedContent.length;

    if (extractedContentBlocks[contentId]) {
     stats.duplicateContentDetected++;
     stats.tokensSaved += contentLength;
    } else {
     extractedContentBlocks[contentId] = {
      content: extractedContent,
      contentLength,
      sourceLinks: [],
     };
     stats.uniqueContent++;
    }

    // Add source link traceability
    extractedContentBlocks[contentId].sourceLinks.push({
     rawSourceLink: link.fullMatch,
     sourceLine: link.line,
    });

    processedLinks.push({
     sourceLink: link,
     contentId,
     status: 'extracted',
    });
   } catch (error) {
    processedLinks.push({
     sourceLink: link,
     contentId: null,
     status: 'failed',
     failureDetails: {
      reason: (error as Error).message,
     },
    });
   }
  }

  // Calculate compression ratio
  if (stats.totalLinks > 0) {
   const totalPotentialTokens =
    (stats.uniqueContent + stats.duplicateContentDetected) *
    (stats.tokensSaved / Math.max(stats.duplicateContentDetected, 1));
   const actualTokens =
    stats.uniqueContent *
    (stats.tokensSaved / Math.max(stats.duplicateContentDetected, 1));
   stats.compressionRatio =
    stats.duplicateContentDetected > 0
     ? (1 - actualTokens / totalPotentialTokens) * 100
     : 0;
  }

  // Add JSON size metadata
  const jsonSize = JSON.stringify(extractedContentBlocks).length;

  return {
   extractedContentBlocks: {
    _totalContentCharacterLength: jsonSize,
    ...extractedContentBlocks,
   },
   outgoingLinksReport: {
    processedLinks,
   },
   stats,
  } as OutgoingLinksExtractedContent;
 }
}
```

### Step 3: Verify TypeScript compiles

```bash
cd tools/citation-manager && npx tsc --noEmit
```

### Step 4: Run tests

```bash
cd tools/citation-manager && npm test
```

Expected: 261 passed, 18 failed (unchanged). If more tests fail, check import paths — the `componentFactory.js` imports `ContentExtractor.js` which no longer exists (now `.ts`). This is the KNOWN blocker that resolves in Epic 7.

### Step 5: Commit

```text
feat(epic6): [Task 7] convert ContentExtractor.js to TypeScript orchestrator
```

---

## Task 8 — Run 8-checkpoint validation and commit

### Context

Final validation step. Run the migration validation script and confirm all checkpoints pass.

### Files

- `tools/citation-manager/scripts/validate-typescript-migration.sh` (READ)
- No modifications

### Step 1: Run validation script

```bash
cd tools/citation-manager && ./scripts/validate-typescript-migration.sh
```

Check each checkpoint:
1. TypeScript compilation: `npx tsc --noEmit` → 0 errors
2. No `any` escapes in converted files
3. Explicit return types on public methods
4. Strict null checks passing
5. Tests: 261+ passing (18 fail from componentFactory blocker — acceptable per Epic 4 learnings)
6. JS consumers backward compatible
7. Build output: `npx tsc --build` generates `.js` + `.d.ts`
8. Type organization: No duplicate type definitions

### Step 2: Manual checkpoint 8 verification

```bash
cd tools/citation-manager && grep -r "^interface ExtractionEligibilityStrategy\|^type ExtractionEligibilityStrategy\|^export interface ExtractionEligibilityStrategy" src/ --include="*.ts" | grep -v "contentExtractorTypes.ts"
```

Expected: Zero matches (types only in `types/` directory).

```bash
cd tools/citation-manager && grep -r "^interface EligibilityDecision\|^export interface EligibilityDecision" src/ --include="*.ts" | grep -v "contentExtractorTypes.ts"
```

Expected: Zero matches.

### Step 3: Verify no JS source files remain in ContentExtractor

```bash
ls tools/citation-manager/src/core/ContentExtractor/*.js 2>/dev/null
ls tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/*.js 2>/dev/null
```

Expected: No `.js` files found (all converted to `.ts`).

### Step 4: Final commit if not already committed

```text
docs(epic6): [Task 8] validation complete - all 8 checkpoints pass
```

---

## Post-Epic Checklist

After all 8 tasks complete:

1. [ ] All ContentExtractor `.js` files converted to `.ts`
2. [ ] `normalizeAnchor.ts` unchanged (already TypeScript)
3. [ ] `contentExtractorTypes.ts` expanded with full runtime types
4. [ ] 261+ tests passing (18 componentFactory failures expected)
5. [ ] `npx tsc --noEmit` zero errors
6. [ ] No duplicate type definitions outside `types/`
7. [ ] All strategy classes typed with `ExtractionEligibilityStrategy` interface
8. [ ] Update sequencing document: Epic 6 status → ✅ Completed
