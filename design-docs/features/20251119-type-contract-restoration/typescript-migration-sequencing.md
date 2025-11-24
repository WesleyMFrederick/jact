# TypeScript Migration - Sequencing

**Feature**: Citation Manager TypeScript Migration
**Created**: 2025-01-24
**Phase**: Phase 3 (Sequencing)

---
<critical-instructions>
1. **CRITICAL REQUIREMENT**: ALWAYS Create a ToDo List for the steps below:
 2. ALWAYS make sure `load-architecture-context` skill has been run and is in conversation context window
 3. ALWAYS make sure `enforcing-development-workflow` skill has been run and is in conversation context window
4. In each chat response, append:
 ```text
 load-architecture-context: {{n/a | loaded}}
 enforcing-development-workflow: {{n/a | loaded}}
 phase: {{current development phase}}
 ```
</critical-instructions>

---

## Overview

Converts 7 components (~2,436 lines) from JavaScript to TypeScript in dependency order. Each epic validates via 8-checkpoint framework before proceeding.

**Strategy**: Leaf components first (no dependencies) → foundation → facades → integration layers → orchestrator

---

## Epic Sequence

### Epic 1: Foundation Setup

**Purpose**: Create validation infrastructure and fix type terminology blocker

**Components**:
- Validation script (`validate-typescript-migration.sh`)
- LinkScope type fix (`'external'` → `'cross-document'`)
- Shared interfaces (Strategy, CliFlags)

**Deliverables**:
- ✅ 8-checkpoint validation script executable
- ✅ LinkScope terminology corrected
- ✅ Minimal shared interfaces added

**Dependencies**: None

**Validation**: Script runs successfully, grep confirms no `'external'` usage

**Size**: Small (~50 lines total)

---

### Epic 2: Leaf Components

**Purpose**: Convert components with zero dependencies

**Components**:
- FileCache (~293 lines) - filename → absolute path mapping

**Deliverables**:
- ✅ FileCache.ts with explicit return types
- ✅ Map<string, string> typed cache
- ✅ 8 checkpoints pass
- ✅ 314/314 tests maintained

**Dependencies**: Epic 1 (validation script)

**Validation**: `./scripts/validate-typescript-migration.sh` passes

**Size**: Small (single component, simple types)

---

### Epic 3: Parser Foundation

**Purpose**: Convert markdown parser (foundation component)

**Components**:
- MarkdownParser (~640 lines) - lexer + custom extraction

**Deliverables**:
- ✅ MarkdownParser.ts with Token types from @types/marked
- ✅ ParserOutput interface typed
- ✅ LinkObject, HeadingObject, AnchorObject contracts preserved
- ✅ 8 checkpoints pass

**Dependencies**: Epic 1 (LinkScope type), Epic 2 (FileCache for path resolution)

**Validation**: Component Guide contracts validated via citation-manager

**Size**: Large (640 lines, complex regex patterns, external types)

---

### Epic 4: Parser Facade & Cache

**Purpose**: Convert facade and Promise caching layer

**Components**:
- ParsedDocument (~321 lines) - query methods over parser output
- ParsedFileCache (~74 lines) - single-parse guarantee

**Deliverables**:
- ✅ ParsedDocument.ts with facade methods typed
- ✅ ParsedFileCache.ts with `Map<string, Promise<ParsedDocument>>`
- ✅ Promise caching pattern preserved
- ✅ 8 checkpoints pass

**Dependencies**: Epic 3 (MarkdownParser)

**Validation**: Non-null assertions safe after `has()` checks

**Size**: Medium (395 lines, Promise generics)

---

### Epic 5: Validation Layer

**Purpose**: Convert validator with enrichment pattern

**Components**:
- CitationValidator (~883 lines) - enriches links with validation metadata

**Deliverables**:
- ✅ CitationValidator.ts with discriminated unions
- ✅ ValidationMetadata typed (`{ status: 'valid' } | { status: 'error'; error: string; ... }`)
- ✅ EnrichedLinkObject interface (LinkObject + validation property)
- ✅ ValidationResult interface (`{ summary, links }`)
- ✅ Enrichment pattern preserved (in-place property addition)
- ✅ 8 checkpoints pass

**Dependencies**: Epic 4 (ParsedFileCache, ParsedDocument)

**Validation**: Downstream consumers (`link.validation.status`) work correctly

**Size**: Large (883 lines, discriminated unions, enrichment pattern)

**Critical**: Epic 4.4 failure point - must preserve architecture, not refactor

---

### Epic 6: Extraction Layer

**Purpose**: Convert content extractor with strategy pattern

**Components**:
- ContentExtractor (~225 lines) - extracts content from enriched links
- Strategy implementations (5 files) - eligibility evaluation chain

**Deliverables**:
- ✅ ContentExtractor.ts with strategy chain typed
- ✅ ExtractionEligibilityStrategy interface usage
- ✅ CliFlags interface usage
- ✅ OutgoingLinksExtractedContent interface preserved
- ✅ 8 checkpoints pass

**Dependencies**: Epic 5 (CitationValidator for EnrichedLinkObject)

**Validation**: Strategy chain evaluates in correct precedence order

**Size**: Medium (225 lines + 5 strategy files, strategy pattern)

---

### Epic 7: CLI Integration

**Purpose**: Convert orchestrator and validate end-to-end flow

**Components**:
- CLI orchestrator - coordinates validator → extractor workflow
- Integration validation

**Deliverables**:
- ✅ CLI orchestrator typed
- ✅ End-to-end flow works (validate → extract)
- ✅ 314/314 tests pass
- ✅ All integration points validated
- ✅ Final 8-checkpoint validation

**Dependencies**: Epic 6 (all components converted)

**Validation**: CLI commands work with TypeScript-compiled code

**Size**: Medium (orchestration layer, integration testing)

---

## Dependency Graph

```plaintext
Epic 1 (Foundation)
  ↓
Epic 2 (FileCache) ────┐
  ↓                    ↓
Epic 3 (MarkdownParser)
  ↓
Epic 4 (ParsedDocument, ParsedFileCache)
  ↓
Epic 5 (CitationValidator) ← Critical (Epic 4.4 failure point)
  ↓
Epic 6 (ContentExtractor)
  ↓
Epic 7 (CLI Integration)
```

---

## Risk Management

### High-Risk Epic

**Epic 5 (CitationValidator)**: Epic 4.4 failed here by creating wrapper objects instead of preserving enrichment pattern.

**Mitigation**:
- Read Component Guide before conversion
- Extract contracts via citation-manager
- Validate `{ summary, links }` structure preserved
- Check downstream consumers expect `link.validation.status`
- No wrapper objects, no architecture changes

---

## Validation Checkpoints

**Per-Epic Validation** (after each epic completes):
- Run `./scripts/validate-typescript-migration.sh`
- All 8 checkpoints must pass
- 314/314 tests maintained
- Commit only when green

**Final Validation** (Epic 7 completion):
- End-to-end CLI flow works
- All integration tests pass
- Component Guide contracts validated
- Migration complete

---

## Size Summary

| Epic | Size | Lines | Complexity |
|------|------|-------|------------|
| Epic 1 | Small | ~50 | Low (script + types) |
| Epic 2 | Small | 293 | Low (simple Map) |
| Epic 3 | Large | 640 | High (regex, external types) |
| Epic 4 | Medium | 395 | Medium (Promise generics) |
| Epic 5 | Large | 883 | High (discriminated unions, enrichment) |
| Epic 6 | Medium | 225+ | Medium (strategy pattern) |
| Epic 7 | Medium | TBD | Medium (integration) |

**Total**: ~2,486 lines across 7 epics

---

## References

- **Design**: [typescript-migration-design.md](typescript-migration-design.md) %%force-extract %% - Patterns and approach
- **PRD**: [typescript-migration-prd.md](typescript-migration-prd.md) %%force-extract %% - Requirements
- **Component Guides**: [component-guides](../../component-guides/component-guides.md) %%force-extract %% - Contract specifications
