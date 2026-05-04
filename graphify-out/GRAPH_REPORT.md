# Graph Report - src  (2026-05-04)

## Corpus Check
- Corpus is ~25,399 words - fits in a single context window. You may not need a graph.

## Summary
- 192 nodes · 431 edges · 10 communities detected
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Component Factories & Types|Component Factories & Types]]
- [[_COMMUNITY_Citation Validation Logic|Citation Validation Logic]]
- [[_COMMUNITY_CLI Commands|CLI Commands]]
- [[_COMMUNITY_Link Detection|Link Detection]]
- [[_COMMUNITY_Path Resolution|Path Resolution]]
- [[_COMMUNITY_Content Extraction|Content Extraction]]
- [[_COMMUNITY_Document Abstraction|Document Abstraction]]
- [[_COMMUNITY_Markdown Parsing|Markdown Parsing]]
- [[_COMMUNITY_File Cache|File Cache]]
- [[_COMMUNITY_Extraction Cache|Extraction Cache]]

## God Nodes (most connected - your core abstractions)
1. `CitationValidator` - 29 edges
2. `JactCli` - 20 edges
3. `FileCache` - 20 edges
4. `ParsedDocument` - 15 edges
5. `createLinkObject()` - 11 edges
6. `ContentExtractor` - 8 edges
7. `MarkdownParser` - 8 edges
8. `isInsideInlineCode()` - 7 edges
9. `levenshteinDistance()` - 7 edges
10. `ParsedFileCache` - 6 edges

## Surprising Connections (you probably didn't know these)
- `FileCache` --references--> `Q&A: CitationValidator Bottleneck`  [EXTRACTED]
  src/FileCache.ts → graphify-out/memory/query_20260504_161520_why_does_citationvalidator_bottleneck_validation_a.md
- `CitationValidator` --references--> `Q&A: CitationValidator Bottleneck`  [EXTRACTED]
  src/CitationValidator.ts → graphify-out/memory/query_20260504_161520_why_does_citationvalidator_bottleneck_validation_a.md
- `ContentExtractor` --references--> `Q&A: CitationValidator Bottleneck`  [EXTRACTED]
  src/core/ContentExtractor/ContentExtractor.ts → graphify-out/memory/query_20260504_161520_why_does_citationvalidator_bottleneck_validation_a.md
- `resolveWikiPath()` --calls--> `createLinkObject()`  [INFERRED]
  src/core/MarkdownParser/resolveWikiPath.ts → src/core/MarkdownParser/createLinkObject.ts
- `findNearMisses()` --calls--> `levenshteinDistance()`  [INFERRED]
  src/FileCache.ts → src/utils/stringDistance.ts

## Communities (10 total, 4 thin omitted)

### Community 0 - "Component Factories & Types"
Cohesion: 0.16
Nodes (12): checkExtractCache(), computeCacheKey(), writeExtractCache(), createCitationValidator(), createContentExtractor(), createFileCache(), createMarkdownParser(), createParsedFileCache() (+4 more)

### Community 1 - "Citation Validation Logic"
Cohesion: 0.18
Nodes (15): createLinkObject(), detectExtractionMarker(), determineAnchorType(), extractCaretLinks(), extractCiteLinks(), extractLinks(), extractLinksFromTokens(), extractMarkdownLinksRegex() (+7 more)

### Community 3 - "Link Detection"
Cohesion: 0.16
Nodes (7): getLinkClass(), CliFlagStrategy, ExtractionStrategy, ForceMarkerStrategy, SectionLinkStrategy, StopMarkerStrategy, computeValidationSummary()

### Community 5 - "Content Extraction"
Cohesion: 0.26
Nodes (7): Q&A: CitationValidator Bottleneck, analyzeEligibility(), ContentExtractor, extractLinksContent(), generateContentId(), decodeUrlAnchor(), normalizeBlockId()

### Community 7 - "Markdown Parsing"
Cohesion: 0.2
Nodes (3): extractAnchors(), extractHeadings(), MarkdownParser

### Community 8 - "File Cache"
Cohesion: 0.26
Nodes (7): resolveScope(), walkUpFor(), clamp(), resolveWikiPath(), findNearMisses(), levenshteinDistance(), pageNameToSlug()

## Knowledge Gaps
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CitationValidator` connect `CLI Commands` to `Component Factories & Types`, `Link Detection`, `Content Extraction`?**
  _High betweenness centrality (0.240) - this node is a cross-community bridge._
- **Why does `FileCache` connect `Extraction Cache` to `Component Factories & Types`, `Citation Validation Logic`, `Content Extraction`, `Markdown Parsing`, `File Cache`?**
  _High betweenness centrality (0.185) - this node is a cross-community bridge._
- **Why does `JactCli` connect `Path Resolution` to `Component Factories & Types`?**
  _High betweenness centrality (0.158) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `createLinkObject()` (e.g. with `._createLinkObject()` and `determineAnchorType()`) actually correct?**
  _`createLinkObject()` has 7 INFERRED edges - model-reasoned connections that need verification._