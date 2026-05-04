# Graph Report - .  (2026-05-04)

## Corpus Check
- Large corpus: 284 files · ~230,702 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 348 nodes · 727 edges · 13 communities detected
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_CLI Orchestration|CLI Orchestration]]
- [[_COMMUNITY_Link Validation|Link Validation]]
- [[_COMMUNITY_File Resolution & Caching|File Resolution & Caching]]
- [[_COMMUNITY_MarkdownParser Core|MarkdownParser Core]]
- [[_COMMUNITY_Content Extraction|Content Extraction]]
- [[_COMMUNITY_Factory Pattern|Factory Pattern]]
- [[_COMMUNITY_Cache Management|Cache Management]]
- [[_COMMUNITY_JactCli CLI|JactCli CLI]]
- [[_COMMUNITY_Eligibility Analysis|Eligibility Analysis]]
- [[_COMMUNITY_ParsedDocument Facade|ParsedDocument Facade]]
- [[_COMMUNITY_MarkdownParser|MarkdownParser]]
- [[_COMMUNITY_Wiki Path Resolution|Wiki Path Resolution]]
- [[_COMMUNITY_CLI Test Utilities|CLI Test Utilities]]

## God Nodes (most connected - your core abstractions)
1. `CitationValidator` - 36 edges
2. `FileCache` - 29 edges
3. `JactCli` - 20 edges
4. `createCitationValidator()` - 17 edges
5. `createContentExtractor()` - 16 edges
6. `ParsedDocument` - 15 edges
7. `ParsedFileCache` - 14 edges
8. `createMarkdownParser()` - 14 edges
9. `extractLinks()` - 12 edges
10. `ContentExtractor` - 11 edges

## Surprising Connections (you probably didn't know these)
- `computeValidationSummary()` --calls--> `getLinkClass()`  [INFERRED]
  src/CitationValidator.ts → src/core/getLinkClass.ts
- `resolveWikiPath()` --calls--> `levenshteinDistance()`  [INFERRED]
  src/core/MarkdownParser/resolveWikiPath.ts → src/utils/stringDistance.ts
- `createLinkObject()` --calls--> `resolveWikiPath()`  [INFERRED]
  src/core/MarkdownParser/createLinkObject.ts → src/core/MarkdownParser/resolveWikiPath.ts
- `findNearMisses()` --calls--> `levenshteinDistance()`  [INFERRED]
  src/FileCache.ts → src/utils/stringDistance.ts
- `extractLinksContent()` --calls--> `decodeUrlAnchor()`  [INFERRED]
  src/core/ContentExtractor/extractLinksContent.ts → src/core/ContentExtractor/normalizeAnchor.ts

## Communities (44 total, 5 thin omitted)

### Community 0 - "CLI Orchestration"
Cohesion: 0.11
Nodes (15): createLinkObject(), detectExtractionMarker(), determineAnchorType(), extractCaretLinks(), extractCiteLinks(), extractLinks(), extractLinksFromTokens(), extractMarkdownLinksRegex() (+7 more)

### Community 1 - "Link Validation"
Cohesion: 0.1
Nodes (7): FileCache, findNearMisses(), isGitignored(), matchWildcardPattern(), parseGitignore(), patternMatches(), levenshteinDistance()

### Community 2 - "File Resolution & Caching"
Cohesion: 0.14
Nodes (8): createEligibilityAnalyzer(), CliFlagStrategy, ExtractionStrategy, ForceMarkerStrategy, SectionLinkStrategy, StopMarkerStrategy, formatExtractResult(), TestStrategy

### Community 5 - "Factory Pattern"
Cohesion: 0.16
Nodes (5): createCitationValidator(), createContentExtractor(), createFileCache(), createMarkdownParser(), createParsedFileCache()

### Community 6 - "Cache Management"
Cohesion: 0.17
Nodes (7): checkExtractCache(), computeCacheKey(), writeExtractCache(), resolveScope(), walkUpFor(), LinkObjectFactory, detectNestedCodeblocks()

### Community 8 - "Eligibility Analysis"
Cohesion: 0.27
Nodes (6): analyzeEligibility(), ContentExtractor, extractLinksContent(), generateContentId(), decodeUrlAnchor(), normalizeBlockId()

### Community 10 - "MarkdownParser"
Cohesion: 0.2
Nodes (3): extractAnchors(), extractHeadings(), MarkdownParser

### Community 11 - "Wiki Path Resolution"
Cohesion: 0.29
Nodes (3): clamp(), resolveWikiPath(), pageNameToSlug()

## Knowledge Gaps
- **1 isolated node(s):** `TestStrategy`
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CitationValidator` connect `MarkdownParser Core` to `Content Extraction`, `Factory Pattern`, `Cache Management`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Why does `FileCache` connect `Link Validation` to `CLI Orchestration`, `Content Extraction`, `Factory Pattern`, `Cache Management`, `MarkdownParser`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **Why does `JactCli` connect `JactCli CLI` to `Factory Pattern`, `Cache Management`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **What connects `TestStrategy` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `CLI Orchestration` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Link Validation` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `File Resolution & Caching` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._