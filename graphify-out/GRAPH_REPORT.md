# Graph Report - src  (2026-05-04)

## Corpus Check
- Corpus is ~25,399 words - fits in a single context window. You may not need a graph.

## Summary
- 191 nodes · 428 edges · 10 communities detected
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
1. `CitationValidator` - 28 edges
2. `JactCli` - 20 edges
3. `FileCache` - 19 edges
4. `ParsedDocument` - 15 edges
5. `createLinkObject()` - 11 edges
6. `MarkdownParser` - 8 edges
7. `ContentExtractor` - 7 edges
8. `isInsideInlineCode()` - 7 edges
9. `levenshteinDistance()` - 7 edges
10. `ParsedFileCache` - 6 edges

## Surprising Connections (you probably didn't know these)
- `createLinkObject()` --calls--> `determineAnchorType()`  [INFERRED]
  src/core/MarkdownParser/createLinkObject.ts → src/core/MarkdownParser/determineAnchorType.ts
- `createLinkObject()` --calls--> `resolvePath()`  [INFERRED]
  src/core/MarkdownParser/createLinkObject.ts → src/core/MarkdownParser/resolvePath.ts
- `createLinkObject()` --calls--> `resolveWikiPath()`  [INFERRED]
  src/core/MarkdownParser/createLinkObject.ts → src/core/MarkdownParser/resolveWikiPath.ts
- `findNearMisses()` --calls--> `levenshteinDistance()`  [INFERRED]
  src/FileCache.ts → src/utils/stringDistance.ts
- `computeValidationSummary()` --calls--> `getLinkClass()`  [INFERRED]
  src/CitationValidator.ts → src/core/getLinkClass.ts

## Communities (10 total, 4 thin omitted)

### Community 0 - "Component Factories & Types"
Cohesion: 0.11
Nodes (15): getLinkClass(), CliFlagStrategy, ExtractionStrategy, ForceMarkerStrategy, SectionLinkStrategy, StopMarkerStrategy, createCitationValidator(), createContentExtractor() (+7 more)

### Community 3 - "Link Detection"
Cohesion: 0.23
Nodes (13): createLinkObject(), detectExtractionMarker(), extractCaretLinks(), extractCiteLinks(), extractLinks(), extractLinksFromTokens(), extractMarkdownLinksRegex(), isDuplicateLink() (+5 more)

### Community 4 - "Path Resolution"
Cohesion: 0.2
Nodes (9): resolveScope(), walkUpFor(), determineAnchorType(), resolvePath(), clamp(), resolveWikiPath(), findNearMisses(), levenshteinDistance() (+1 more)

### Community 5 - "Content Extraction"
Cohesion: 0.28
Nodes (6): analyzeEligibility(), ContentExtractor, extractLinksContent(), generateContentId(), decodeUrlAnchor(), normalizeBlockId()

### Community 7 - "Markdown Parsing"
Cohesion: 0.2
Nodes (3): extractAnchors(), extractHeadings(), MarkdownParser

### Community 9 - "Extraction Cache"
Cohesion: 0.83
Nodes (3): checkExtractCache(), computeCacheKey(), writeExtractCache()

## Knowledge Gaps
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CitationValidator` connect `Citation Validation Logic` to `Component Factories & Types`?**
  _High betweenness centrality (0.239) - this node is a cross-community bridge._
- **Why does `FileCache` connect `File Cache` to `Component Factories & Types`, `Link Detection`, `Path Resolution`, `Markdown Parsing`?**
  _High betweenness centrality (0.176) - this node is a cross-community bridge._
- **Why does `JactCli` connect `CLI Commands` to `Component Factories & Types`?**
  _High betweenness centrality (0.158) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `createLinkObject()` (e.g. with `._createLinkObject()` and `extractMarkdownLinksRegex()`) actually correct?**
  _`createLinkObject()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Should `Component Factories & Types` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._