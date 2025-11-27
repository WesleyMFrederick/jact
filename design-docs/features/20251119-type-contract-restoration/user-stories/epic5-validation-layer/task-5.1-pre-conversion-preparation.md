# Task 5.1: Pre-conversion Preparation - Results

**Task**: Pre-conversion preparation for CitationValidator TypeScript migration
**Epic**: Epic 5 - Validation Layer
**Model**: Claude 4.5 Sonnet

---

## Objective

Gather context needed to write Epic 5 implementation plan:
1. Extract CitationValidator contracts from Component Guide
2. Review baseline JavaScript implementation (identify enrichment patterns)
3. Verify downstream consumers
4. Document current test baseline

---

## 1. CitationValidator Contracts (from Component Guide)

### Contract: ValidationResult Output Structure

**Source**: [CitationValidator Component Guide](../../../../component-guides/CitationValidator%20Implementation%20Guide.md#`CitationValidator.ValidationResult.Output.DataContract`%20JSON%20Schema) - ValidationResult Output Contract

```typescript
interface ValidationResult {
  summary: ValidationSummary;
  links: EnrichedLinkObject[];
}

interface ValidationSummary {
  total: number;
  valid: number;
  warnings: number;
  errors: number;
}

type ValidationMetadata =
  | { status: "valid" }
  | { status: "error"; error: string; suggestion?: string }
  | { status: "warning"; error: string; suggestion?: string; pathConversion?: object };

interface EnrichedLinkObject extends LinkObject {
  validation: ValidationMetadata;
}
```

**Critical Properties**:
- ✅ Property name is `links` (NOT `results`)
- ✅ Property name is `summary` (NOT `stats`)
- ✅ Enrichment pattern: `validation` property added to LinkObject in-place
- ✅ Discriminated union: `status` determines available fields

### Contract: Public Methods

**Source**: [CitationValidator Component Guide](../../../../component-guides/CitationValidator%20Implementation%20Guide.md#Public%20Contracts) - Public method signatures

1. **`validateFile(filePath: string): Promise<ValidationResult>`**
   - Returns `{ summary, links }` where links are enriched in-place
   - Summary derived from counting `link.validation.status` values

2. **`validateSingleCitation(link: LinkObject, contextFile?: string): Promise<EnrichedLinkObject>`**
   - Returns enriched LinkObject (original object with `validation` property added)
   - Used by CLI for synthetic link validation

---

## 2. Baseline JavaScript Implementation Review

**File**: `tools/citation-manager/src/CitationValidator.js` (883 lines)

### Enrichment Pattern Implementation (Lines 162-214)

```javascript
async validateFile(filePath) {
  // 1. Get parsed document with LinkObjects
  const sourceParsedDoc = await this.parsedFileCache.resolveParsedFile(filePath);
  const links = sourceParsedDoc.getLinks();

  // 2. Enrich each link in-place with validation metadata
  await Promise.all(
    links.map(async (link) => {
      const result = await this.validateSingleCitation(link, filePath);

      // Build validation metadata object
      const validation = { status: result.status };
      if (result.error) validation.error = result.error;
      if (result.suggestion) validation.suggestion = result.suggestion;
      if (result.pathConversion) validation.pathConversion = result.pathConversion;

      // LINE 196: ENRICHMENT - Add validation property to link
      link.validation = validation;
    })
  );

  // 3. Generate summary from enriched links
  const summary = {
    total: links.length,
    valid: links.filter((link) => link.validation.status === "valid").length,
    warnings: links.filter((link) => link.validation.status === "warning").length,
    errors: links.filter((link) => link.validation.status === "error").length,
  };

  // 4. Return { summary, links } - enriched originals
  return { summary, links };
}
```

**Key Observations**:
- ✅ Links enriched in-place (line 196: `link.validation = validation`)
- ✅ No wrapper objects created
- ✅ Summary derived by counting enriched links (lines 203-206)
- ✅ Returns original links array (now enriched)

### Constructor Pattern (Lines 51-86)

```javascript
constructor(parsedFileCache, fileCache) {
  this.parsedFileCache = parsedFileCache;
  this.fileCache = fileCache;

  // Pattern validation rules with precedence order
  this.patterns = { /* ... */ };
}
```

**Type Requirements**:
- Constructor params need TypeScript interfaces: `ParsedFileCacheInterface`, `FileCacheInterface`
- `this.patterns` field needs typing (pattern registry)

### JSDoc Type Definitions (Lines 4-48)

```javascript
/**
 * @typedef {ValidValidation|ErrorValidation|WarningValidation} ValidationMetadata
 */
```

**Already present** - discriminated union defined in JSDoc! This maps directly to TypeScript discriminated union.

---

## 3. Downstream Consumer Verification

### Primary Consumers (grep results)

#### 1. citation-manager.js (CLI orchestrator)

```javascript
// Line 307
const enrichedLinks = validationResult.links;

// Lines 152-157 (filtering by status)
valid: filteredLinks.filter((link) => link.validation.status === "valid").length,
errors: filteredLinks.filter((link) => link.validation.status === "error").length,
warnings: filteredLinks.filter((link) => link.validation.status === "warning").length,
```

#### 2. extractLinksContent.js (ContentExtractor)

```javascript
// Line 25
const enrichedLinks = validationResult.links;

// Line 53 (skip errors)
if (link.validation.status === "error") {
  // skip link
}
```

#### 3. ContentExtractor.js

```javascript
// Line 97
if (link.validation.status === "error") {
  // skip link
}
```

**Usage Summary**:
- ✅ All consumers access `validationResult.links` property
- ✅ All consumers filter using `link.validation.status`
- ✅ No consumers expect `validationResult.results`
- ✅ Enrichment pattern is fundamental to downstream code

---

## 4. Current Test Baseline

**Test Run Results** (2025-01-27):

```text
Test Files  63 passed (63)
     Tests  313 passed (313)
```

**CRITICAL**: Must run `npm test` from **workspace root**, not citation-manager subdirectory.

### All Tests Passing (313 tests across 63 test files)

**CitationValidator-specific tests:**
- `citation-validator.test.js` - Core validation logic
- `citation-validator-enrichment.test.js` - Enrichment pattern validation
- `citation-validator-anchor-matching.test.js` - Anchor validation
- `citation-validator-cache.test.js` - ParsedFileCache integration
- `citation-validator-parsed-document.test.js` - ParsedDocument facade usage

**Test Coverage Confirmation**:
- ✅ Enrichment pattern extensively tested
- ✅ ValidationResult structure validated
- ✅ Discriminated union behavior verified
- ✅ All integration and unit tests passing
- ✅ CLI orchestration tests passing

---

## Key Findings for Implementation Plan

### 1. Enrichment Pattern is Non-Negotiable
- Line 196: `link.validation = validation` - in-place property addition
- Epic 4.4 failure pattern (see [lessons learned](../../0-elicit-sense-making-phase/lessons-learned.md)): Created wrapper objects instead
- TypeScript conversion MUST preserve this exact pattern

### 2. Discriminated Union Already Defined
- JSDoc typedefs (lines 4-27) already define the discriminated union
- Direct translation to TypeScript discriminated union types
- Status field discriminates available properties

### 3. Interface Dependencies Clear
- Constructor needs: `ParsedFileCacheInterface`, `FileCacheInterface`
- Methods need: `LinkObject`, `EnrichedLinkObject`, `ValidationMetadata`
- Return types: `Promise<ValidationResult>`, `Promise<EnrichedLinkObject>`

### 4. Test Baseline Established
- 313 passing tests = validation baseline
- 0 failing tests = all tests passing
- Success criteria: Maintain 313 passing tests after conversion

### 5. Downstream Contract Locked
- citation-manager.js, ContentExtractor.js depend on:
  - `validationResult.links` property name
  - `link.validation.status` enrichment pattern
  - Discriminated union status values
- Breaking these = breaking downstream consumers

---

## Recommendations for Implementation Plan

1. **Type Organization**:
   - `ValidationMetadata`, `EnrichedLinkObject`, `ValidationResult` → `types/validationTypes.ts`
   - Import from shared types, never define internally (Checkpoint 8)

2. **Critical Type Patterns**:
   - Discriminated union for ValidationMetadata (status-based)
   - `EnrichedLinkObject extends LinkObject` with added `validation` property
   - Promise generics for async methods

3. **Conversion Strategy**:
   - Convert line-by-line preserving structure exactly
   - Type constructor params with interfaces
   - Add explicit return types to all methods
   - Apply `?? null` coercion for optional fields

4. **Validation Checkpoints**:
   - Run `./scripts/validate-typescript-migration.sh` (8 checkpoints)
   - Verify 313 passing tests maintained (run from workspace root)
   - Confirm 0 new test failures
   - Check no duplicate type definitions

5. **Architecture Preservation**:
   - Line 196 enrichment pattern MUST remain unchanged
   - No wrapper objects, no intermediate result structures
   - Return `{ summary, links }` exactly as baseline

---

## Contract Extraction Commands

For implementation plan, use these commands to extract contracts:

```bash
# Extract CitationValidator Component Guide
citation-manager extract links "tools/citation-manager/design-docs/component-guides/CitationValidator Implementation Guide.md"

# Extract Epic 5 sequencing context
citation-manager extract header "tools/citation-manager/design-docs/features/20251119-type-contract-restoration/typescript-migration-sequencing.md" "Epic 5: Validation Layer"

# Extract TypeScript design patterns
citation-manager extract header "tools/citation-manager/design-docs/features/20251119-type-contract-restoration/typescript-migration-design.md" "TypeScript Conversion Patterns"
```

**Referenced Documents**:
- [CitationValidator Component Guide](../../../../component-guides/CitationValidator%20Implementation%20Guide.md) %% force-extract %%
- [Epic 5 Sequencing](../../typescript-migration-sequencing.md#Epic%205%20Validation%20Layer)
- [TypeScript Design Patterns](../../typescript-migration-design.md#TypeScript%20Conversion%20Patterns)
- [TypeScript Migration PRD](../../typescript-migration-prd.md) %% force-extract %%

---

## Files to Reference During Implementation

**Baseline JavaScript**:
- `src/CitationValidator.js` (883 lines) - source to convert

**Shared Types** (already exist):
- `src/types/citationTypes.ts` - LinkObject base type
- `src/types/validationTypes.ts` - validation result types (to be updated)

**Downstream Consumers** (must not break):
- `src/citation-manager.js` - CLI orchestrator
- `src/core/ContentExtractor/extractLinksContent.js` - content extraction
- `src/core/ContentExtractor/ContentExtractor.js` - eligibility filtering

**Tests** (validation baseline):
- `test/integration/citation-validator*.test.js` - enrichment pattern tests
- All passing non-CLI tests

---

## Status

✅ **Task 5.1 Complete** - Ready to write Epic 5 implementation plan

**Next Step**: Write detailed implementation plan with exact TypeScript conversions for each method, type definitions, and validation checkpoints.
