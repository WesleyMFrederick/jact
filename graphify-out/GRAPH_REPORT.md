# Graph Report - .  (2026-05-04)

## Corpus Check
- Corpus is ~25,399 words - fits in a single context window. You may not need a graph.

## Summary
- 402 nodes · 963 edges · 14 communities detected
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 41 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Link Parsing & Extraction|Link Parsing & Extraction]]
- [[_COMMUNITY_Link Objects & Factory|Link Objects & Factory]]
- [[_COMMUNITY_File System Utilities|File System Utilities]]
- [[_COMMUNITY_Parser Strategy Patterns|Parser Strategy Patterns]]
- [[_COMMUNITY_Markdown AST Processing|Markdown AST Processing]]
- [[_COMMUNITY_Type Definitions|Type Definitions]]
- [[_COMMUNITY_Test Fixtures & Setup|Test Fixtures & Setup]]
- [[_COMMUNITY_Validation & Testing|Validation & Testing]]
- [[_COMMUNITY_Scope Resolution|Scope Resolution]]
- [[_COMMUNITY_Content Operations|Content Operations]]
- [[_COMMUNITY_File Cache & Lookup|File Cache & Lookup]]
- [[_COMMUNITY_Extraction Caching|Extraction Caching]]
- [[_COMMUNITY_Plan Ingestion Workflow|Plan Ingestion Workflow]]
- [[_COMMUNITY_Community 44|Community 44]]

## God Nodes (most connected - your core abstractions)
1. `CitationValidator` - 40 edges
2. `FileCache` - 37 edges
3. `JactCli` - 21 edges
4. `createCitationValidator()` - 19 edges
5. `createContentExtractor()` - 18 edges
6. `ParsedFileCache` - 17 edges
7. `ParsedDocument` - 16 edges
8. `createMarkdownParser()` - 16 edges
9. `ContentExtractor` - 15 edges
10. `createLinkObject()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `FileCache` --references--> `Q&A: CitationValidator Bottleneck`  [EXTRACTED]
  src/FileCache.ts → graphify-out/memory/query_20260504_161520_why_does_citationvalidator_bottleneck_validation_a.md
- `CitationValidator` --references--> `Q&A: CitationValidator Bottleneck`  [EXTRACTED]
  src/CitationValidator.ts → graphify-out/memory/query_20260504_161520_why_does_citationvalidator_bottleneck_validation_a.md
- `ContentExtractor` --references--> `Q&A: CitationValidator Bottleneck`  [EXTRACTED]
  src/core/ContentExtractor/ContentExtractor.ts → graphify-out/memory/query_20260504_161520_why_does_citationvalidator_bottleneck_validation_a.md
- `FileCache` --references--> `FileCache GitIgnore Tests`  [INFERRED]
  src/FileCache.ts → test/unit/FileCache.gitignore.test.ts
- `FileCache` --references--> `AST Default Scope Tests`  [INFERRED]
  src/FileCache.ts → test/integration/ast-default-scope.test.ts

## Hyperedges (group relationships)
- **FileCache Implementation** — filecache_filecache, filecache_buildcache, filecache_scandirectory [EXTRACTED 1.00]
- **Plan Ingestion Workflow Steps** — planingestion_context_extraction, planingestion_semantic_analysis, planingestion_state_log [EXTRACTED 1.00]

## Communities (45 total, 5 thin omitted)

### Community 0 - "Link Parsing & Extraction"
Cohesion: 0.06
Nodes (27): createLinkObject(), detectExtractionMarker(), determineAnchorType(), extractAnchors(), extractHeadings(), hasNestedTokens(), extractCaretLinks(), extractCiteLinks() (+19 more)

### Community 1 - "Link Objects & Factory"
Cohesion: 0.08
Nodes (4): LinkObjectFactory, detectNestedCodeblocks(), formatExtractResult(), ParsedFileCache

### Community 2 - "File System Utilities"
Cohesion: 0.08
Nodes (9): ForceMarkerStrategy, SectionLinkStrategy, StopMarkerStrategy, createCitationValidator(), createContentExtractor(), createFileCache(), createMarkdownParser(), createParsedFileCache() (+1 more)

### Community 3 - "Parser Strategy Patterns"
Cohesion: 0.18
Nodes (5): getLinkClass(), CliFlagStrategy, ExtractionStrategy, computeValidationSummary(), TestStrategy

### Community 5 - "Type Definitions"
Cohesion: 0.22
Nodes (8): Q&A: CitationValidator Bottleneck, analyzeEligibility(), createEligibilityAnalyzer(), ContentExtractor, extractLinksContent(), generateContentId(), decodeUrlAnchor(), normalizeBlockId()

### Community 6 - "Test Fixtures & Setup"
Cohesion: 0.15
Nodes (6): resolveScope(), walkUpFor(), clamp(), resolveWikiPath(), levenshteinDistance(), pageNameToSlug()

### Community 10 - "File Cache & Lookup"
Cohesion: 0.29
Nodes (7): buildCache, FileCache, GitIgnore Pattern Handling, parseGitignore, scanDirectory, AST Default Scope Tests, FileCache GitIgnore Tests

### Community 11 - "Extraction Caching"
Cohesion: 0.73
Nodes (3): checkExtractCache(), computeCacheKey(), writeExtractCache()

### Community 12 - "Plan Ingestion Workflow"
Cohesion: 0.5
Nodes (4): Extract Plan Context, Semantic Task Identification, State Log Management, Plan Ingestion Task Pickup Workflow

## Knowledge Gaps
- **9 isolated node(s):** `TestStrategy`, `scanDirectory`, `resolveFile`, `parseGitignore`, `GitIgnore Pattern Handling` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `FileCache` connect `Link Parsing & Extraction` to `Link Objects & Factory`, `File System Utilities`, `Parser Strategy Patterns`, `Type Definitions`?**
  _High betweenness centrality (0.141) - this node is a cross-community bridge._
- **Why does `CitationValidator` connect `Markdown AST Processing` to `Link Objects & Factory`, `File System Utilities`, `Parser Strategy Patterns`, `Type Definitions`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._
- **Why does `JactCli` connect `Validation & Testing` to `Link Objects & Factory`, `File System Utilities`, `Parser Strategy Patterns`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **What connects `TestStrategy`, `scanDirectory`, `resolveFile` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Link Parsing & Extraction` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Link Objects & Factory` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `File System Utilities` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._