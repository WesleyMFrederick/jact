# Graph Report - jact  (2026-05-04)

## Corpus Check
- 156 files · ~213,903 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 390 nodes · 954 edges · 13 communities detected
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `02a29b85`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]

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
- `resolveWikiPath()` --calls--> `createLinkObject()`  [INFERRED]
  src/core/MarkdownParser/resolveWikiPath.ts → src/core/MarkdownParser/createLinkObject.ts
- `findNearMisses()` --calls--> `levenshteinDistance()`  [INFERRED]
  src/FileCache.ts → src/utils/stringDistance.ts

## Communities (44 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (26): createLinkObject(), detectExtractionMarker(), determineAnchorType(), extractAnchors(), extractHeadings(), hasNestedTokens(), extractCaretLinks(), extractCiteLinks() (+18 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (6): createCitationValidator(), createContentExtractor(), createFileCache(), createMarkdownParser(), createParsedFileCache(), ParsedFileCache

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (5): createEligibilityAnalyzer(), CliFlagStrategy, ForceMarkerStrategy, SectionLinkStrategy, StopMarkerStrategy

### Community 3 - "Community 3"
Cohesion: 0.18
Nodes (6): getLinkClass(), ExtractionStrategy, detectNestedCodeblocks(), computeValidationSummary(), formatExtractResult(), TestStrategy

### Community 4 - "Community 4"
Cohesion: 0.13
Nodes (7): resolveScope(), walkUpFor(), clamp(), resolveWikiPath(), findNearMisses(), levenshteinDistance(), pageNameToSlug()

### Community 6 - "Community 6"
Cohesion: 0.24
Nodes (7): Q&A: CitationValidator Bottleneck, analyzeEligibility(), ContentExtractor, extractLinksContent(), generateContentId(), decodeUrlAnchor(), normalizeBlockId()

### Community 12 - "Community 12"
Cohesion: 0.73
Nodes (3): checkExtractCache(), computeCacheKey(), writeExtractCache()

## Knowledge Gaps
- **1 isolated node(s):** `TestStrategy`
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `FileCache` connect `Community 0` to `Community 1`, `Community 3`, `Community 4`, `Community 6`?**
  _High betweenness centrality (0.149) - this node is a cross-community bridge._
- **Why does `CitationValidator` connect `Community 5` to `Community 1`, `Community 2`, `Community 3`, `Community 6`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **Why does `JactCli` connect `Community 7` to `Community 1`, `Community 3`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **What connects `TestStrategy` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._