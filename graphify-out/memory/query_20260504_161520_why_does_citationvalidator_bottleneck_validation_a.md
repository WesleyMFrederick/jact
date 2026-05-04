---
type: "query"
date: "2026-05-04T16:15:20.594056+00:00"
question: "Why does CitationValidator bottleneck validation and factory creation?"
contributor: "graphify"
source_nodes: ["CitationValidator", "FileCache", "ContentExtractor"]
---

# Q: Why does CitationValidator bottleneck validation and factory creation?

## Answer

CitationValidator is the required intermediary across ALL commands (validate, extract, fix). The validate command diagram shows only one flow (CLI → Validator → ParsedCache → Parser), but CitationValidator also orchestrates FileCache for cross-document resolution and ContentExtractor for content retrieval. High betweenness centrality (0.239) comes from being a mandated passthrough for every operation, not from performance issues.

## Source Nodes

- CitationValidator
- FileCache
- ContentExtractor