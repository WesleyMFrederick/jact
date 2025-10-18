# Content Extractor Implementation Guide

## Problem

The content extraction workflow requires solving two distinct code-level problems:

### Extraction Eligibility Problem

Without a structured approach to implementing the extraction eligibility rules from FR4, developers would naturally implement the precedence logic as a **monolithic function with nested if/else chains**. This creates critical problems:

1. **Rules become untestable in isolation** - Precedence logic tightly couples to the orchestrator, preventing independent testing of individual rules
2. **Closed to extension** - Adding new markdown flavors or user-configurable rules requires modifying the core function, violating the Open/Closed Principle
3. **Implicit precedence order** - Rule hierarchy is buried in control flow structure rather than explicit in the architecture
4. **Intertwined rule logic** - Each rule's implementation is tangled with others, preventing reuse and increasing regression risk

### Content Retrieval Problem

Without a centralized component to orchestrate content retrieval, every consumer would duplicate the **extraction dispatch logic**: determining which `ParsedDocument` method to call (`extractSection()`, `extractBlock()`, `extractFullContent()`), handling different return types, packaging results with metadata, and managing extraction errors. This duplication creates **maintenance burden** (changes to extraction logic require updates across all consumers) and **inconsistent error handling** (each consumer implements its own approach to missing sections or invalid anchors).

## Solution

The **`Content Extractor`** component is the central service for content aggregation. It encapsulates two primary responsibilities: **`ExtractionEligibility`** (determining _what_ to fetch using the Strategy Pattern) and **`ContentRetrieval`** (fetching the content chunk via the **`ParsedDocument`** facade). It returns the final aggregated content chunks (**`ContentBlock`** objects) back to the CLI for final output.

---
## Structure

The `Content Extractor` is a single component that uses the **Strategy Pattern** internally to manage eligibility rules. The component orchestrates the complete extraction workflow: **validation** (via internal `CitationValidator` call to discover links), **eligibility analysis** (via the strategy chain), and **content retrieval** (via the ParsedDocument facade).

**Input Contract**: The component receives a `sourceFilePath` from the CLI. The CLI orchestrator validates the source file first to discover all LinkObjects with their source and target paths. These pre-validated links are then used internally by ContentExtractor for eligibility analysis and content extraction. The source file path is extracted from the LinkObject array and validated for consistency (all links share the same `link.source.path.absolute` value).

```mermaid
classDiagram
    direction LR

    class CLIOrchestrator {
        +executeExtractCommand()
    }

    class ContentExtractor {
        -parsedFileCache: ParsedFileCacheInterface
        -citationValidator: CitationValidator
        -eligibilityStrategies: ExtractionStrategy[]
        +extractLinksContent(sourceFilePath: string, cliFlags: Object): Promise~AggregatedContent~
    }

    class ExtractionStrategy {
    <<interface>>
        +getDecision(link: string, cliFlags: Object): Decision|null
    }

    class StopMarkerStrategy {
        +getDecision(link: string, cliFlags: Object): Decision|null
    }

    class ForceMarkerStrategy {
        +getDecision(link: string, cliFlags: Object): Decision|null
    }

    class SectionLinkStrategy {
        +getDecision(link: string, cliFlags: Object): Decision|null
    }

    class CliFlagStrategy {
        +getDecision(link: string, cliFlags: Object): Decision|null
    }

  class ParsedFileCache {
        <<interface>>
        +resolveParsedFile(filePath: string): Promise~ParsedDocument~
    }

    class ParsedDocument {
        <<facade>>
        +getLinks(): array
        +extractSection(headingText: string): string
        +extractBlock(anchorId: string): string
        +extractFullContent(): string
    }

    class ContentBlock {
        +content: string
        +metadata: object
    }

    CLIOrchestrator --> ContentExtractor : calls
    
    ContentExtractor ..> ParsedFileCache : depends on
    ParsedFileCache --> ParsedDocument : returns
    ContentExtractor ..> ParsedDocument : calls methods on
    
    
    
    ContentExtractor ..> ExtractionStrategy : depends & calls methods on
    ExtractionStrategy <|-- StopMarkerStrategy : implements
    ExtractionStrategy <|-- ForceMarkerStrategy : implements
    ExtractionStrategy <|-- SectionLinkStrategy : implements
    ExtractionStrategy <|-- CliFlagStrategy : implements
  
    
    ContentExtractor --> ContentBlock : returns
```

1. **ExtractionStrategy**: Base interface defining the contract for eligibility rule strategies (`getDecision(link, cliFlags)`)
2. **StopMarkerStrategy, ForceMarkerStrategy, SectionLinkStrategy, CliFlagStrategy**: Concrete strategy implementations executed in precedence order
3. **ParsedFileCache**: The dependency used to retrieve ParsedDocument instances
4. **ParsedDocument**: The facade providing content extraction methods (`extractSection()`, `extractBlock()`, `extractFullContent()`)
5. **ContentBlock**: The composite object returned containing extracted content and metadata
6. **ContentExtractor**: The class that orchestrates eligibility analysis and content retrieval

---

## Public Contracts

The component's interface is designed as a single execution point to hide internal complexity and ensure the CLI remains thin and focused on application orchestration.

### Input Contract

**Dependencies (injected via constructor):**
1. **`ParsedFileCache`**: For retrieving parsed documents
2. **`CitationValidator`**: For validating citations before extraction
3. **`eligibilityStrategies`**: Array of strategy objects for eligibility rules

**Public Method: `extractLinksContent(sourceFilePath, cliFlags)`**
1. **`sourceFilePath`** (string): Absolute path to the source markdown file containing citations
2. **`cliFlags`** (object): Command-line options (e.g., `{ fullFiles: true }`) to be evaluated by the eligibility strategies

### Output Contract

The `extractLinksContent()` method returns a `Promise` that resolves with an **`AggregatedContent`** object containing an array of **`ContentBlock`** objects, which contain the extracted content and necessary source metadata.

- **ContentBlock Structure**: The internal object structure contains:
  - `content` (string): The extracted markdown chunk (section, block, or full file).
  - `metadata` (object): Source attribution information (e.g., `sourceFile`, `sectionHeading`, `lineRange`).
- **Final Output**: The CLI uses this aggregated array to perform the final file write.

---

## File Structure

```text
tools/citation-manager/
└── src/
    ├── core/
    │   └── ContentExtractor/                           // Component folder (TitleCase per coding standards)
    │       ├── ContentExtractor.js                    // Main component class (entry point)
    │       ├── analyzeEligibility.js                  // Eligibility analysis operation (verb-noun pattern)
    │       └── eligibilityStrategies/                 // Strategy pattern implementations
    │           ├── ExtractionStrategy.js             // Base interface for all eligibility rules
    │           ├── StopMarkerStrategy.js             // Concrete rule: %%stop-extract-link%%
    │           ├── ForceMarkerStrategy.js            // Concrete rule: %%extract-link%%
    │           ├── SectionLinkStrategy.js            // Concrete rule: Anchor-based links eligible by default
    │           └── CliFlagStrategy.js                // Concrete rule: --full-files flag evaluation
    │
    └── factories/
        └── componentFactory.js                        // createContentExtractor() factory with DI wiring
```

_Source_: [File Naming Patterns](../../../../design-docs/Architecture%20-%20Baseline.md#File%20Naming%20Patterns)

## Whiteboard

How ContentExtractor Orchestrates Complete Extraction Workflow

```js
// ContentExtractor owns the entire extraction workflow
async extractLinksCotent(sourceFilePath, cliFlags) {
 // Step 1: Validate file and discover links (internal prerequisite)
 const validationResult = await this.citationValidator.validateFile(sourceFilePath);

 if (!validationResult.isValid) {
  throw new ValidationError("Cannot extract from file with broken citations");
 }

 // Step 2: Get parsed document to access links
 const parsedDoc = await this.parsedFileCache.resolveParsedFile(sourceFilePath);
 const allLinks = parsedDoc.getLinks();

 // Step 3-7: Process each link
 const contentBlocks = [];
 for (const link of allLinks) {
  // 3. Check eligibility using Strategy Pattern
  const decision = this.analyzeEligibility(link, cliFlags);

  if (decision.eligible) {
   // 4. Get target file path
   const targetFilePath = link.target.path.absolute;

   // 5. Get ParsedDocument from cache
   const targetDoc = await this.parsedFileCache.resolveParsedFile(targetFilePath);

   // 6. Determine which extraction method to call based on anchorType
   let content;
   if (link.anchorType === "header") {
     // Extract section (need heading text from anchor)
     content = targetDoc.extractSection(link.target.anchor);
   } else if (link.anchorType === "block") {
     // Extract block
     content = targetDoc.extractBlock(link.target.anchor);
   } else if (link.anchorType === null) {
     // Full file extraction
     content = targetDoc.extractFullContent();
   }

   // 7. Package into ContentBlock with metadata
   const contentBlock = {
     content: content,
     metadata: {
       sourceFile: link.source.path.absolute,
       targetFile: link.target.path.absolute,
       anchor: link.target.anchor,
       line: link.line,
       column: link.column
     }
   };
   contentBlocks.push(contentBlock);
  }
 }

 // Step 8: Aggregate and return
 return this.aggregateContent(contentBlocks);
}
```
  
  Key LinkObject Properties Used

  1. `link.target.path.absolute` - Which file to fetch ParsedDocument for
  2. `link.anchorType` - Which extraction method to call ("header", "block", null)
  3. `link.target.anchor` - The anchor ID to pass to extraction method
  4. `link.source.path.absolute` - For ContentBlock metadata (attribution)
  5. `link.line`, `link.column` - For ContentBlock metadata (source location)

  The Strategy Pattern's Role

  The eligibility strategies also navigate LinkObject:
- `link.extractionMarker` - Check for force/stop markers (added in US2.1)
- `link.anchorType` - SectionLinkStrategy checks if not null
- `link.scope` - Potentially filter by internal vs cross-document

  So ContentExtractor uses LinkObject properties to route extraction decisions and dispatch to the correct ParsedDocument methods.

---

## Architectural Decision: Validation Enrichment Pattern

**Decision Date**: 2025-10-17
**Status**: Recommended for Implementation

### Problem: Massive Data Duplication

The current architectural approach creates separate data structures for parser output (`LinkObject`) and validation results (`ValidationResult`), leading to 80% data duplication:

**LinkObject** (from MarkdownParser):

```typescript
{
  linkType: "markdown",      // ← Duplicated in ValidationResult
  line: 42,                   // ← Duplicated
  column: 5,                  // ← Duplicated
  fullMatch: "[text](file)",  // ← Duplicated as "citation"
  target: { path: "file.md", anchor: "#section" },
  // ... other structural data
}
```

**ValidationResult.results[0]** (from CitationValidator):

```typescript
{
  line: 42,                   // ← Duplicate
  column: 5,                  // ← Duplicate
  citation: "[text](file)",   // ← Duplicate (fullMatch)
  linkType: "markdown",       // ← Duplicate
  status: "error",            // ← UNIQUE (only 3-4 fields are new!)
  error: "Anchor not found",  // ← UNIQUE
  suggestion: "#similar"      // ← UNIQUE
}
```

**Impact**:
- Memory overhead (storing same data twice)
- Redundant `getLinks()` calls (validator fetches, extractor fetches again)
- Architectural messiness (data flow passes same information multiple times)

### Recommended Solution: Hybrid Validation Enrichment

Validation metadata should live **on the LinkObject** itself, eliminating duplication while preserving separation of concerns for summary reporting.

#### Enhanced LinkObject Schema

```typescript
interface LinkObject {
  // Original parser data (unchanged)
  linkType: "markdown" | "wiki",
  scope: "cross-document" | "internal",
  target: { path, anchor },
  line: number,
  column: number,
  fullMatch: string,

  // Validation metadata (added AFTER validation)
  validation?: {
    status: "valid" | "warning" | "error",
    error?: string,           // Only when status = "error"
    suggestion?: string,      // Only when status = "error" | "warning"
    pathConversion?: object   // Only when relevant
  }
}
```

#### ValidationResult Schema (Summary Only)

```typescript
interface ValidationResult {
  summary: {
    total: number,
    valid: number,
    warnings: number,
    errors: number
  },
  links: LinkObject[]  // Return enriched links (no duplication!)
}
```

#### Implementation Pattern

```typescript
class CitationValidator {
  async validateFile(filePath): ValidationResult {
    const parsed = await this.parsedFileCache.resolveParsedFile(filePath)
    const links = parsed.getLinks()

    // Enrich each link with validation metadata
    for (const link of links) {
      const result = await this.validateSingleLink(link)
      link.validation = {
        status: result.status,
        error: result.error,
        suggestion: result.suggestion
      }
    }

    // Return summary + enriched links (no duplication!)
    return {
      summary: this.generateSummary(links),
      links: links
    }
  }
}
```

#### ContentExtractor Usage

```typescript
class ContentExtractor {
  async extractLinksContent(sourceFilePath, cliFlags) {
    // Step 1: Validate and get enriched links
    const { summary, links } = await this.citationValidator.validateFile(sourceFilePath)

    if (summary.errors > 0) {
      throw new Error("Cannot extract from file with broken citations")
    }

    // Step 2: Use enriched links directly (no redundant fetch!)
    const eligibleLinks = links.filter(link =>
      link.validation.status === "valid" &&
      this.isEligible(link, cliFlags)
    )

    // Step 3: Extract content from eligible links
    const contentBlocks = []
    for (const link of eligibleLinks) {
      const targetDoc = await this.parsedFileCache.resolveParsedFile(link.target.path.absolute)
      const content = this.extractContent(targetDoc, link)
      contentBlocks.push({ content, metadata: this.buildMetadata(link) })
    }

    return this.aggregateContent(contentBlocks)
  }
}
```

### Benefits

1. **Zero Duplication**: Validation data stored once on LinkObject (50% memory reduction)
2. **Single Data Flow**: One object passes through pipeline (parse → validate → filter → extract)
3. **No Redundant Calls**: Validator returns enriched links; extractor uses them directly
4. **Natural Lifecycle**: Progressive enhancement pattern (base data + validation metadata)
5. **Separation Preserved**: Summary stays separate for CLI reporting needs

### Type Safety (Preventing Illegal States)

Use TypeScript discriminated unions to prevent invalid states:

```typescript
// Base link (from parser - unvalidated)
interface UnvalidatedLinkObject {
  linkType: "markdown" | "wiki",
  target: { path, anchor },
  line: number,
  column: number,
  // No validation field = explicitly unvalidated
}

// After validation
interface ValidatedLinkObject extends UnvalidatedLinkObject {
  validation: {
    status: "valid" | "warning" | "error",
    error?: string,
    suggestion?: string
  }
}

type LinkObject = UnvalidatedLinkObject | ValidatedLinkObject

// Type guard
function isValidated(link: LinkObject): link is ValidatedLinkObject {
  return 'validation' in link
}

// Usage with type safety
for (const link of links) {
  if (isValidated(link) && link.validation.status === "error") {
    console.log(link.validation.error)  // TypeScript knows this exists
  }
}
```

### Migration Impact

**Files Requiring Updates**:
1. `CitationValidator.js` - Return `{ summary, links }` instead of separate validation results
2. `ContentExtractor.js` - Use enriched links from validator (remove redundant `getLinks()`)
3. `MarkdownParser.js` - LinkObject schema unchanged (validation field added post-parse)
4. `citation-manager.js` CLI - Handle enriched links for display/reporting
5. Type definitions - Add discriminated union types for validated vs unvalidated links

**Backward Compatibility**: Breaking change requiring coordinated update across validator → extractor → CLI

### Implementation Priority

**Timing**: Implement during US2.1 (Extraction Eligibility) to avoid architectural refactoring later
**Risk**: Medium (requires coordinated changes across 3+ components)
**Value**: High (eliminates fundamental duplication, cleaner architecture for Epic 2)

### Impacted Documentation

The following design documents require updates to reflect the Validation Enrichment Pattern:

**Component Guides (Direct Impact)**:
1. `CitationValidator Implementation Guide.md` - Output contract changes from separate ValidationResult to enriched LinkObjects
2. `Content Extractor Implementation Guide.md` - Input contract changes to receive enriched links directly from validator
3. `Markdown Parser Implementation Guide.md` - Clarify that `validation` property is added post-parse, not by parser

**Architecture Documents (Direct Impact)**:
4. `content-aggregation-architecture.md` - Data flow between validator → extractor changes
~~5. `Architecture.md` - Component contracts and data models require updates~~

**Feature Documents (Direct Impact)**:
6. `content-aggregation-prd.md` - Validation output format specification changes
~~7. `content-aggregation-architecture-whiteboard.md` - Contains the ADR itself, may need workflow updates~~

**User Stories (Implementation Impact)**:
8. `us2.1-implement-extraction-eligibility-strategy-pattern.md` - ADR states "implement during US2.1"
9. `us1.7-implement-parsed-document-facade.md` - May affect facade's interaction with enriched links
10. `us1.5-implement-cache-for-parsed-files.md` - Cache may need to handle enriched LinkObjects

**Total**: 10 documents requiring updates to reflect the Validation Enrichment Pattern

---

## Related Files
- [Psuedocode Style Guide](../../../../agentic-workflows/patterns/Psuedocode%20Style%20Guide.md)
- [Architecture - Baseline](../../../../design-docs/Architecture%20-%20Baseline.md)
- [ParsedFileCache Implementation Guide](../../../../../resume-coach/design-docs/examples/component-guides/ParsedFileCache%20Implementation%20Guide.md)
- [ParsedDocument Implementation Guide](ParsedDocument%20Implementation%20Guide.md)
- [us2.1-implement-extraction-eligibility-strategy-pattern](../features/20251003-content-aggregation/user-stories/us2.1-implement-extraction-eligibility-strategy-pattern/us2.1-implement-extraction-eligibility-strategy-pattern.md)
- [content-aggregation-architecture-whiteboard](../features/20251003-content-aggregation/research/content-aggregation-architecture-whiteboard.md)
