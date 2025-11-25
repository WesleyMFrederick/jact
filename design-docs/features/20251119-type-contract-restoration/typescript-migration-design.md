# TypeScript Migration - Design Document

**Feature**: Citation Manager TypeScript Migration
**Created**: 2025-01-24
**Status**: Draft
**Phase**: Phase 2 (Research & Design) - Design Document

---

## Overview

This design adapts the generic requirements from the [PRD](typescript-migration-prd.md) to citation-manager's specific system context. It defines HOW TypeScript migration will work for our codebase using our proven patterns, validation framework, and architecture.

### Design Goals

1. **Preserve proven architecture** - Type existing patterns, don't refactor them
2. **Validate incrementally** - 8-checkpoint framework catches issues early
3. **Prevent Epic 4.2-4.5 failures** - Automated duplicate detection, contract validation
4. **Enable smooth conversion** - Clear patterns, minimal type definitions, reusable validation

---

## System Context

### Baseline State (Commit `1c571e0`)

**TypeScript Infrastructure** ✅
- Strict TypeScript configuration (all 7 strict flags)
- Shared type libraries in `src/types/`
- Vitest with native TypeScript support
- Build scripts with incremental compilation

**Component Architecture** ✅
- 7 components (~2,436 lines JavaScript)
- Proven data contracts documented in Component Guides
- Enrichment pattern (in-place property addition)
- Promise caching for single-parse guarantee

**Validation Approach** ✅
- Epic 3 POC: 7-checkpoint framework validated on `normalizeAnchor.ts`
- 314/314 tests passing
- Component Guides specify exact contracts

---

## Core Design Decisions

### Decision 1: Type Existing Architecture, Don't Refactor

**Rationale**: Epic 4.2-4.5 failed by changing architecture during conversion

**Implementation**:
- Read Component Guide contracts BEFORE converting
- Match TypeScript types to actual JavaScript structure
- Preserve enrichment pattern (in-place `validation` property)
- No wrapper objects, no "improvements"

**Example - Validation Enrichment Pattern**:

```typescript
// ❌ WRONG - Epic 4.4 failure pattern (wrapper objects)
interface CitationValidationResult {
  link: LinkObject;
  status: 'valid' | 'error';
  message?: string;
}

// ✅ CORRECT - Preserve enrichment pattern
type ValidationMetadata =
  | { status: 'valid' }
  | { status: 'error'; error: string; suggestion?: string };

interface EnrichedLinkObject extends LinkObject {
  validation: ValidationMetadata;  // Added in-place by CitationValidator
}
```

**Validation**: Component Guide contracts extracted via `citation-manager extract links <guide-file>` before conversion

---

### Decision 2: 8-Checkpoint Validation Framework

**Expansion**: Epic 3's 7-checkpoint framework + new Checkpoint 8 (Type Organization)

**Purpose**: Automated validation catches issues before moving to next component

| Checkpoint | Command | Success Criteria |
|------------|---------|------------------|
| 1-4. Type Safety | `npx tsc --noEmit` | Zero errors, no `any`, explicit returns, strict nulls |
| 5. Tests Pass | `npm test` | 314/314 (100%) |
| 6. JS Consumers | `npm test` | Backward compatibility |
| 7. Build Output | `npx tsc --build` | `.js` + `.d.ts` + maps |
| **8. Type Organization** | Duplicate detection + import validation | Single source of truth |

**Checkpoint 8 Details** (NEW):

```bash
# 8a. No duplicate type definitions
grep -r "^interface LinkObject\|^type LinkObject" src/ --exclude-dir=types
# Expected: Zero matches (types only in types/ directory)

# 8b. Type imports verified
grep -n "import.*from.*types/" ComponentName.ts
# Expected: At least one import from shared types
```

**Automation**: Single validation script (`tools/citation-manager/scripts/validate-typescript-migration.sh`) runs all 8 checkpoints

**Rationale**:
- Catches Epic 4.3 pattern (MarkdownParser internal LinkObject)
- Fast feedback for coding agents during implementation
- Reusable across tasks, manual checks, future CI

---

### Decision 3: Minimal Type Definitions, Expand During Implementation

**Rationale**: Start minimal to unblock conversion, expand as patterns emerge

**Type Additions**:

#### 1. Fix LinkScope Terminology (Blocker)

```typescript
// citationTypes.ts - UPDATE
export type LinkScope = 'internal' | 'cross-document';  // Was 'external'
```

**Why**: Code uses `'cross-document'` consistently (314 tests prove it). Future-proof for `'url'` | `'code'` expansion.

#### 2. Strategy Interface (Important)

```typescript
// contentExtractorTypes.ts - ADD
export interface ExtractionEligibilityStrategy {
  getDecision(
    link: LinkObject,
    cliFlags: CliFlags
  ): { eligible: boolean; reason: string } | null;
}
```

**Used by**: ContentExtractor strategy chain (5 implementations)

#### 3. CliFlags Interface (Important)

```typescript
// contentExtractorTypes.ts - ADD
export interface CliFlags {
  fullFiles?: boolean;
  // Expand during implementation as flags discovered
}
```

**Used by**: Multiple components (Validator, Extractor, CLI)

---

## TypeScript Conversion Patterns

### Pattern 1: Discriminated Unions (Validation Enrichment)

**Use Case**: Type the validation enrichment pattern where status determines available properties

**JavaScript Pattern** (CitationValidator.js:196):

```javascript
// Add validation property in-place based on status
if (valid) {
  link.validation = { status: 'valid' };
} else if (hasError) {
  link.validation = {
    status: 'error',
    error: 'Anchor not found',
    suggestion: 'Did you mean #similar-anchor?'
  };
}
```

**TypeScript Pattern**:

```typescript
// Discriminated union for validation property value
type ValidationMetadata =
  | { status: 'valid' }
  | { status: 'error'; error: string; suggestion?: string }
  | { status: 'warning'; error: string; pathConversion?: object };

// EnrichedLinkObject = LinkObject + validation property
interface EnrichedLinkObject extends LinkObject {
  validation: ValidationMetadata;
}

// Enrichment preserves in-place pattern
async enrichLinkWithValidation(link: LinkObject): Promise<EnrichedLinkObject> {
  if (valid) {
    link.validation = { status: 'valid' };
  } else if (hasError) {
    link.validation = {
      status: 'error',
      error: 'Anchor not found',
      suggestion: 'Did you mean #similar-anchor?'
    };
  }
  return link as EnrichedLinkObject;  // Same object, now enriched
}
```

**Benefits**:
- Type safety prevents invalid states (can't have `suggestion` without `error`)
- Preserves enrichment pattern exactly as Component Guide specifies
- TypeScript discriminates unions based on `status` property

**Validation**: Matches [CitationValidator Component Guide - Output Contract](../../component-guides/CitationValidator%20Implementation%20Guide.md#Output%20Contract)

---

### Pattern 2: Promise Caching with Generics

**Use Case**: Type Promise caching pattern in ParsedFileCache

**JavaScript Pattern** (ParsedFileCache.js:15-35):

```javascript
class ParsedFileCache {
  constructor(markdownParser) {
    this.cache = new Map();  // Stores promises
    this.parser = markdownParser;
  }

  async resolveParsedFile(filePath) {
    const cacheKey = path.normalize(filePath);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);  // Return cached promise
    }

    const parsedDocPromise = this.parser.parseFile(cacheKey)
      .then(contract => new ParsedDocument(contract));

    this.cache.set(cacheKey, parsedDocPromise);
    return parsedDocPromise;
  }
}
```

**TypeScript Pattern**:

```typescript
export class ParsedFileCache {
  private cache: Map<string, Promise<ParsedDocument>>;  // Generic type
  private parser: MarkdownParser;

  constructor(markdownParser: MarkdownParser) {
    this.cache = new Map<string, Promise<ParsedDocument>>();
    this.parser = markdownParser;
  }

  async resolveParsedFile(filePath: string): Promise<ParsedDocument> {
    const cacheKey = path.normalize(filePath);

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;  // Non-null assertion safe after has()
    }

    const parsedDocPromise = this.parser.parseFile(cacheKey)
      .then((contract) => new ParsedDocument(contract));

    this.cache.set(cacheKey, parsedDocPromise);
    return parsedDocPromise;
  }
}
```

**Key Points**:
- Use `Map<string, Promise<T>>` for Promise caching
- Non-null assertion (`!`) safe when `has()` check confirms existence
- Promise chaining maintains type safety through `.then()`

**Benefits**:
- Type safety for concurrent request deduplication
- Explicit Promise typing prevents await misuse
- Generic `Map<K, V>` documents cache structure

---

### Pattern 3: Class-Based Dependency Injection

**Use Case**: Type constructor injection pattern used throughout codebase

**JavaScript Pattern** (CitationValidator.js:10-15):

```javascript
class CitationValidator {
  constructor(parsedFileCache, fileCache) {
    this.parsedFileCache = parsedFileCache;
    this.fileCache = fileCache;
  }
}
```

**TypeScript Pattern**:

```typescript
export class CitationValidator {
  private parsedFileCache: ParsedFileCacheInterface;
  private fileCache: FileCacheInterface;

  constructor(
    parsedFileCache: ParsedFileCacheInterface,
    fileCache: FileCacheInterface
  ) {
    this.parsedFileCache = parsedFileCache;
    this.fileCache = fileCache;
  }
}
```

**Key Points**:
- Use `private` modifier for dependency fields
- Type parameters with interfaces (not concrete classes)
- Preserve constructor injection pattern exactly

**Benefits**:
- Explicit dependency contracts
- Type-safe method calls on dependencies
- Maintains testability (interface-based injection)

---

### Pattern 4: Conditional Properties → Discriminated Unions

**Use Case**: Type JavaScript conditional property pattern

**JavaScript Pattern** (CitationValidator.js:854):

```javascript
function createValidationResult(link, isValid, errorMessage) {
  const result = { link, status: isValid ? 'valid' : 'error' };
  if (errorMessage) {
    result.error = errorMessage;  // Conditional property
  }
  return result;
}
```

**TypeScript Pattern**:

```typescript
type ValidationResult =
  | { link: LinkObject; status: 'valid' }
  | { link: LinkObject; status: 'error'; error: string };

function createValidationResult(
  link: LinkObject,
  isValid: boolean,
  errorMessage?: string
): ValidationResult {
  if (isValid) {
    return { link, status: 'valid' };
  }
  return { link, status: 'error', error: errorMessage! };
}
```

**Benefits**:
- Type system prevents accessing `error` on valid results
- Explicit return type documents all possible states
- Discriminated union enables type narrowing

---

### Pattern 5: Parser Token Types (External Library)

**Use Case**: Type `marked.js` token structures

**Preferred Approach**: Import from `@types/marked`

```typescript
// MarkdownParser.ts
import type { Token } from 'marked';

export interface ParserOutput {
  filePath: string;
  content: string;
  tokens: Token[];  // Use marked's Token type
  links: LinkObject[];
  headings: HeadingObject[];
  anchors: AnchorObject[];
}
```

**Fallback** (if @types/marked unavailable):

```typescript
interface MarkedToken {
  type: string;
  raw: string;
  [key: string]: any;  // Escape hatch for marked internals
}
```

**Rationale**:
- Zero maintenance with community-maintained types
- Accurate types matching marked.js exactly
- Fallback preserves flexibility if types unavailable

---

## Component Contracts Preservation

### Critical Contracts

#### 1. MarkdownParser.Output.DataContract

**Structure**: `{ filePath, content, tokens, links, headings, anchors }`

**Type Conversion**:

```typescript
export interface ParserOutput {
  filePath: string;
  content: string;
  tokens: Token[];  // From @types/marked
  links: LinkObject[];  // From types/citationTypes.ts
  headings: HeadingObject[];
  anchors: AnchorObject[];
}

// AnchorObject uses discriminated union for conditional properties
export type AnchorObject =
  | {
      anchorType: 'header';
      id: string;
      urlEncodedId: string;  // REQUIRED for headers (Obsidian-compatible)
      rawText: string;
      fullMatch: string;
      line: number;
      column: number;
    }
  | {
      anchorType: 'block';
      id: string;
      rawText: null;  // Always null for blocks
      fullMatch: string;
      line: number;
      column: number;
      // NO urlEncodedId property
    };
```

**Validation**: Extract contract via `citation-manager extract links component-guides/Markdown\ Parser\ Implementation\ Guide.md`

**Critical**: AnchorObject must use discriminated union to match baseline JavaScript behavior:
- Header anchors ALWAYS set `urlEncodedId` (verified in baseline commit 1c571e0, line 462-471)
- Block anchors NEVER have `urlEncodedId` property (verified in baseline, lines 349, 371, 393)

**Reference**: [Markdown Parser Data Contracts](../../component-guides/Markdown%20Parser%20Implementation%20Guide.md#Data%20Contracts)

---

#### 2. CitationValidator.ValidationResult

**Structure**: `{ summary: {...}, links: EnrichedLinkObject[] }`

**Type Conversion**:

```typescript
interface ValidationSummary {
  total: number;
  valid: number;
  warnings: number;
  errors: number;
}

interface ValidationResult {
  summary: ValidationSummary;
  links: EnrichedLinkObject[];  // Links with validation property added
}
```

**⚠️ CRITICAL**: Property names are `summary` and `links` (NOT `results`, NOT flat structure)

**Validation**: Downstream consumers (citation-manager CLI, ContentExtractor) expect `validationResult.links` and `link.validation.status`

**Reference**: [CitationValidator Output Contract](../../component-guides/CitationValidator%20Implementation%20Guide.md#Output%20Contract)

---

#### 3. OutgoingLinksExtractedContent

**Structure**: Indexed format with content deduplication

**Type Conversion** (already defined in `contentExtractorTypes.ts`):

```typescript
interface OutgoingLinksExtractedContent {
  extractedContentBlocks: {
    _totalContentCharacterLength: number;
    [contentId: string]: {  // SHA-256 hash key
      content: string;
      contentLength: number;
      sourceLinks: Array<{ rawSourceLink: string; sourceLine: number }>;
    };
  };
  outgoingLinksReport: { /* link processing status */ };
  stats: { totalLinks: number; uniqueContent: number; /* ... */ };
}
```

**Note**: `rawSourceLink` is a ContentExtractor **output** property (mapped from `link.fullMatch`), NOT a LinkObject input property from MarkdownParser. ContentExtractor reads `link.fullMatch` and outputs it as `rawSourceLink` in the extraction result structure.

**Validation**: Already typed, verify usage matches during conversion

**Reference**: [Content Extractor Data Contracts](../../component-guides/Content%20Extractor%20Implementation%20Guide.md)

---

## Validation Strategy

### Pre-Conversion Validation

**Before converting each component**:
1. Read Component Guide for target component
2. Extract contracts: `citation-manager extract links <guide-file>`
3. Examine JavaScript baseline: `git show 1c571e0:path/to/Component.js`
4. Check downstream consumers: `grep -r "componentName\." src/`
5. Review existing tests: What do passing tests assert?

**Validation Script**: `tools/citation-manager/scripts/validate-typescript-migration.sh`

```bash
#!/bin/bash
echo "Running TypeScript migration validation..."

# Checkpoints 1-4: Type safety
npx tsc --noEmit || exit 1

# Checkpoint 5: Tests at 100%
npm test || exit 1

# Checkpoint 8a: No duplicate type definitions
duplicates=$(grep -r "^interface LinkObject\|^type LinkObject" src/ --exclude-dir=types)
if [ -n "$duplicates" ]; then
  echo "❌ Duplicate type definitions found"
  echo "$duplicates"
  exit 1
fi

echo "✅ All checkpoints passed"
```

**Usage**: Coding agents run script after each component conversion

---

### Post-Conversion Validation

**After converting each component**:
1. Run validation script (8 checkpoints)
2. Verify type imports: `grep "import.*from.*types/" ComponentName.ts`
3. Check for duplicates: `grep "^interface LinkObject" src/ --exclude-dir=types`
4. Validate against Component Guide contracts
5. Commit if all checkpoints pass

**Success Criteria**:
- ✅ 314/314 tests passing (100%)
- ✅ Zero compiler errors
- ✅ No `any` escapes
- ✅ Types imported from `types/` directory
- ✅ No duplicate type definitions
- ✅ Component Guide contracts validated

---

## Migration Safety Mechanisms

### 1. Automated Duplicate Prevention (Checkpoint 8)

**Problem**: Epic 4.3 - MarkdownParser created internal `LinkObject` conflicting with shared type

**Solution**: Checkpoint 8a validates single source of truth

```bash
grep -r "^interface LinkObject\|^type LinkObject" src/ --exclude-dir=types
# Expected: Zero matches
```

**Catches**:
- Internal type definitions that should be imported
- Duplicate interfaces across components
- Shadow types conflicting with shared definitions

---

### 2. Contract Validation via Component Guides

**Problem**: Epic 4.4 - Created types from imagination, not reality

**Solution**: Extract contracts before conversion

```bash
citation-manager extract links component-guides/CitationValidator\ Implementation\ Guide.md
```

**Output**: Extracted contract content showing exact structure

**Validation**: Types match extracted contracts exactly

---

### 3. Test Assertion Freeze

**Problem**: Epic 4.4 - Changed test assertions to match wrong types

**Solution**: Minimize test changes, validate assertions unchanged

**Rule**: Test files may need type annotations, but assertions must remain identical

**Example**:

```typescript
// ✅ ALLOWED - Add type annotation
const result: ValidationResult = await validator.validateFile(filePath);

// ✅ ALLOWED - Assertion unchanged
expect(result).toHaveProperty('links');

// ❌ FORBIDDEN - Changed assertion
expect(result).toHaveProperty('results');  // Was 'links' before
```

**Validation**: `git diff` on test files shows only type additions, not assertion changes

---

### 4. Incremental Conversion with Full Validation

**Problem**: Epic 4.5 - Band-aid fixes without addressing root cause

**Solution**: Each component must reach 100% tests before next component

**Process**:
1. Convert one component to TypeScript
2. Run validation script (all 8 checkpoints)
3. Fix issues until script passes
4. Commit with single component changes
5. **ONLY THEN** move to next component

**Rationale**: Prevents cascading failures, maintains known-good state after each component

---

## Integration Points

### Component Dependencies

**Dependency Flow**:

```plaintext
MarkdownParser (leaf) → ParsedDocument → ParsedFileCache
                                             ↓
                                       CitationValidator ← FileCache (leaf)
                                             ↓
                                       ContentExtractor
                                             ↓
                                        CLI Orchestrator
```

**Conversion Implications**:
- Leaf components (MarkdownParser, FileCache) can convert first (no dependencies)
- Middle components must wait for dependencies to convert first
- CLI Orchestrator converts last (depends on all components)

**Validation**: Each converted component must maintain contracts for downstream consumers

---

### Downstream Consumer Expectations

**CitationValidator consumers expect**:
- `validationResult.summary` (object with total/valid/warnings/errors)
- `validationResult.links` (array of EnrichedLinkObject)
- `link.validation.status` (discriminated union)

**ContentExtractor consumers expect**:
- `extractedContent.extractedContentBlocks` (indexed by SHA-256)
- `extractedContent.stats` (aggregate counts)

**Validation**: Grep codebase for usage patterns before converting:

```bash
grep -r "validationResult\.links" src/
grep -r "link\.validation\.status" src/
```

---

## Type Organization Standards

### Shared Type Libraries

**Location**: `tools/citation-manager/src/types/`

**Organization**:
- `citationTypes.ts` - LinkObject, ValidationMetadata, LinkScope, anchor types
- `validationTypes.ts` - ValidationResult, Summary types
- `contentExtractorTypes.ts` - Extraction types, Strategy interfaces, CliFlags

**Rules**:
1. All shared types MUST be exported from `types/` directory
2. Components MUST import types, never define duplicates
3. Each type library focuses on single domain
4. Use barrel exports for convenience (optional)

**Enforcement**: Checkpoint 8 validates no duplicate definitions

---

### Import Patterns

**✅ CORRECT - Import from shared types**:

```typescript
import { LinkObject, ValidationMetadata } from './types/citationTypes.js';
import type { ParsedFileCacheInterface } from './types/interfaces.js';
```

**❌ WRONG - Internal definitions**:

```typescript
// Don't define types already in shared libraries
interface LinkObject {  // DUPLICATE - should import
  linkType: string;
  // ...
}
```

**Validation**: Checkpoint 8b verifies imports exist

---

## Risk Mitigation

### Risk 1: LinkScope Change Breaks Hidden Dependencies

**Mitigation**: Grep entire codebase before type change

```bash
grep -r "'external'" src/
# Expected: Zero matches (only 'internal' and 'cross-document' used)
```

**Validation**: All tests pass after one-line type change

---

### Risk 2: Checkpoint 8 False Positives from Comments

**Mitigation**: Use `^interface` pattern (start of line only)

```bash
grep -r "^interface LinkObject" src/ --exclude-dir=types
# Ignores: // interface LinkObject (comment)
# Catches: interface LinkObject { (actual definition)
```

---

### Risk 3: Strategy Interface Doesn't Match Implementations

**Mitigation**: Validate against all 5 strategy implementations before conversion

```bash
grep -r "getDecision" src/core/ContentExtractor/eligibilityStrategies/
# Verify: All strategies return { eligible, reason } | null
```

---

### Risk 4: Promise Typing Confuses Team

**Mitigation**: Provide clear example in design (Pattern 2 above) with inline comments

**Documentation**: Include in implementation plan with explanation of `Map<string, Promise<T>>` pattern

---

### Risk 5: Incorrect `rawSourceLink` Property in LinkObject Interface

**Problem**: Epic 4.1 (commit fb1a299) added `rawSourceLink: string` to LinkObject interface, but this property was never part of the MarkdownParser output contract.

**Impact**: TypeScript migration correctly rejects 24 link object constructions in MarkdownParser that don't provide this property.

**Root Cause Analysis**:
- **Component Guide** (authoritative): LinkObject schema does NOT include `rawSourceLink` in required properties or examples
- **Baseline JavaScript** (1c571e0): MarkdownParser never provided this property - matches Component Guide
- **ContentExtractor Usage**: Reads `link.fullMatch` and outputs it as `rawSourceLink` in extraction results
- **Actual Contract**: `rawSourceLink` belongs to ContentExtractor's **output** format, NOT MarkdownParser's LinkObject input

**Evidence**:

```bash
# Component Guide shows NO rawSourceLink in LinkObject
grep "rawSourceLink" "Markdown Parser Implementation Guide.md"
# Returns: No matches in LinkObject schema or examples

# ContentExtractor maps fullMatch → rawSourceLink
grep "rawSourceLink" ContentExtractor.js
# Returns: rawSourceLink: link.fullMatch
```

**Resolution**: Remove `rawSourceLink` from LinkObject interface in `citationTypes.ts` (Epic 3 Task 11).

**Mitigation**: Trust Component Guides as ground truth. When TypeScript rejects code, validate against Component Guide contracts before assuming interface needs additions.

---

## Success Metrics

### Migration Complete When

1. **Code Conversion**: All `.js` source files → `.ts` (except intentional JavaScript)
2. **Type Safety**: `npx tsc --noEmit` succeeds with zero errors
3. **Test Validation**: 314/314 tests passing (100%)
4. **Contract Preservation**: All data contracts match Component Guide specifications
5. **Architecture Preservation**: Enrichment pattern, composition strategies unchanged
6. **Type Organization**: All types imported from `types/`, zero duplicates
7. **Integration Validation**: End-to-end CLI flow works (validate → extract)

**Validation Commands**:

```bash
npm test                    # Must be 314/314
npx tsc --noEmit            # Must be zero errors
npm run build               # Must generate .js + .d.ts
./scripts/validate-typescript-migration.sh  # All 8 checkpoints pass
```

---

## References

### Phase 1 Artifacts

- **PRD**: [typescript-migration-prd.md](typescript-migration-prd.md) - Generic requirements
- **PRD Whiteboard**: [typescript-migration-prd-whiteboard.md](1-requirements-phase/typescript-migration-prd-whiteboard.md) - Phase 1 context

### Phase 2 Artifacts

- **Research Documents**: [research/](research/) - Research outputs from design phase

### Component Contracts

- **Component Guides**: [component-guides](../../component-guides/component-guides.md) - Contract specifications
- **MarkdownParser Guide**: [Markdown Parser Implementation Guide](../../component-guides/Markdown%20Parser%20Implementation%20Guide.md)
- **CitationValidator Guide**: [CitationValidator Implementation Guide](../../component-guides/CitationValidator%20Implementation%20Guide.md)
- **ContentExtractor Guide**: [Content Extractor Implementation Guide](../../component-guides/Content%20Extractor%20Implementation%20Guide.md)

### Architecture Standards

- **Architecture Principles**: [ARCHITECTURE-PRINCIPLES.md](../../../../../ARCHITECTURE-PRINCIPLES.md) - 9 principle categories
- **Development Workflow**: [Development Workflow.md](0-elicit-sense-making-phase/Development%20Workflow.md) - Progressive disclosure process

### Baseline Context

- **Baseline Commit**: `1c571e0` - Last known good state (314/314 tests)
- **Lessons Learned**: [lessons-learned.md](0-elicit-sense-making-phase/lessons-learned.md) - Epic 4.2-4.5 failure patterns
- **Rollback Plan**: [ROLLBACK-PLAN.md](0-elicit-sense-making-phase/ROLLBACK-PLAN.md) - Preservation strategy

---

## Implementation Notes

### Epic 3: MarkdownParser TypeScript Migration (2025-01-25)

**Issue**: GitHub Issue #17 - 29 TypeScript build errors in MarkdownParser.ts

**Root Cause**: Interface definitions were too strict for actual runtime behavior:
- `LinkObject.target.path.raw` was `string` but internal links produce `null`
- `LinkObject.text` was `string` but caret references have no display text
- Missing `source`, `anchorType`, `extractionMarker` fields in interface

**Solution Applied**:

1. **Updated `LinkObject` interface** in `citationTypes.ts`:
   - Added `source.path.absolute: string | null`
   - Added `anchorType: "header" | "block" | null`
   - Changed `target.path.raw` to `string | null` (internal links have no target path)
   - Changed `text` to `string | null` (caret refs have no text)
   - Added `extractionMarker` field

2. **Added type guard** for Token narrowing:

   ```typescript
   function hasNestedTokens(token: Token): token is Token & { tokens: Token[] }
   ```

3. **Applied `?? null` coercion** to regex capture groups (~22 locations)

4. **Fixed type contract violations** in extractAnchors:
   - Explicit header anchors now include `urlEncodedId`
   - Emphasis-marked (block) anchors use `rawText: null` per contract

**Result**: 0 TypeScript errors, 313/313 tests passing

---

## Next Steps

1. **Design Validation**: Run `evaluate-against-architecture-principles` skill
2. **Phase 3**: Sequencing - component order, decomposition strategy
3. **Phase 4**: Implementation Plan - bite-sized tasks with exact code
4. **Execution**: Subagent-driven development or parallel execution
