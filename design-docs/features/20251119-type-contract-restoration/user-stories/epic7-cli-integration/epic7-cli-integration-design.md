# Epic 7: CLI Integration - Design Document

**Feature**: CLI Orchestrator & Factory TypeScript Migration
**Created**: 2026-01-28
**Status**: Draft
**Phase**: Phase 2 (Research & Design) - Design Document
**Epic**: 7 of 7 (Final)

---

## Overview

This design adapts the TypeScript migration requirements to the CLI integration layer: the orchestrator class (`CitationManager`), factory functions (`componentFactory`, `LinkObjectFactory`), and Commander.js command wiring. Epic 7 is the final migration step - all downstream components (Epics 1-6) are already converted to TypeScript.

### Design Goals

1. **Convert 3 remaining JS files** - `citation-manager.js`, `componentFactory.js`, `LinkObjectFactory.js`
2. **Restore 314/314 tests** - Fix the 50 CLI-dependent test failures caused by `componentFactory.js` importing from `dist/`
3. **Preserve orchestration patterns** - Type existing CLI workflows, don't refactor
4. **Complete migration** - Pass final 8-checkpoint validation

---

## System Context

### Current State (Post-Epic 6, Commit c5bc2af)

**Converted Components** (Epics 1-6):
- `FileCache.ts` - Leaf component
- `MarkdownParser.ts` - Parser with @types/marked
- `ParsedDocument.ts` - Query facade
- `ParsedFileCache.ts` - Promise caching layer
- `CitationValidator.ts` - Validation with discriminated unions
- `ContentExtractor.ts` + 5 strategy files - Strategy pattern

**Remaining JavaScript** (3 files, ~1,269 lines total):
- `src/citation-manager.js` (1,060 lines) - CLI orchestrator + Commander.js
- `src/factories/componentFactory.js` (118 lines) - DI factory functions
- `src/factories/LinkObjectFactory.js` (91 lines) - Synthetic link creation

**Test Status**: 263/314 passing (84%)
- 50 CLI-dependent tests fail because `componentFactory.js` imports from `../../dist/` (compiled output)
- Converting componentFactory to import from TS source resolves this automatically

**Shared Type Libraries**: All types needed by CLI layer already exist:
- `citationTypes.ts` - `LinkObject`, `ParserOutput`, `LinkScope`
- `validationTypes.ts` - `ValidationMetadata`, `EnrichedLinkObject`, `ValidationResult`, `ValidationSummary`
- `contentExtractorTypes.ts` - `ExtractionEligibilityStrategy`, `CliFlags`, `OutgoingLinksExtractedContent`

---

## Core Design Decisions

### Decision 1: Conversion Order (Leaf-First)

**Order**: LinkObjectFactory → componentFactory → citation-manager.js

**Rationale**:
- **LinkObjectFactory** (91 lines) has zero downstream consumers except CLI. Returns `LinkObject` (type exists). Trivial.
- **componentFactory** (118 lines) imports all TS components. Converting switches imports from `dist/` to source. **Unblocks 50 failing tests.**
- **citation-manager.js** (1,060 lines) depends on both factories. Converts last.

**Risk mitigation**: Each conversion runs 8-checkpoint validation before proceeding.

---

### Decision 2: New Types Required for CLI Layer

Three new types needed (not yet in shared libraries):

#### 2a. CLI Options Interface

```typescript
// Add to contentExtractorTypes.ts (extends existing CliFlags)
export interface CliValidateOptions {
  format?: "cli" | "json";
  lines?: string;
  scope?: string;
  fix?: boolean;
}

export interface CliExtractOptions {
  scope?: string;
  format?: string;
  fullFiles?: boolean;
}
```

**Used by**: CitationManager methods (`validate`, `fix`, `extractLinks`, etc.)

#### 2b. ValidationReportResult (Formatted Output)

The `validate()` method adds `validationTime` and optional `lineRange` to `ValidationResult`. Rather than creating a new type, use intersection:

```typescript
interface FormattedValidationResult extends ValidationResult {
  validationTime: string;
  lineRange?: string;
}
```

**Rationale**: Minimal type addition. `formatForCLI()` and `formatAsJSON()` receive this enriched result.

#### 2c. FixReport Type

```typescript
interface FixDetail {
  line: number;
  old: string;
  new: string;
  type: "path" | "anchor" | "path+anchor";
}
```

**Used by**: `fix()` method to track applied changes.

---

### Decision 3: componentFactory Import Path Change

**Current** (JavaScript):

```javascript
import { CitationValidator } from "../../dist/CitationValidator.js";
```

**After** (TypeScript):

```typescript
import { CitationValidator } from "../CitationValidator.js";
```

**Impact**: This is the root cause of 50 failing CLI tests. The `dist/` directory contains compiled output from previous epics. Converting componentFactory to import from source `.ts` files (resolved via TypeScript's module resolution) fixes the import chain.

**Validation**: Running `npm test` after this change should restore tests from 263 → 314.

---

### Decision 4: Commander.js Typing Strategy

**Approach**: Use `@types/commander` (already available via `commander` package which ships its own types).

**Key typing decisions**:
- Commander action handlers remain `async (file: string, options: CliValidateOptions) => void`
- `program` variable typed as `Command` (imported from `commander`)
- `semanticSuggestionMap` typed as `Record<string, string[]>`
- No changes to Commander API usage - just add type annotations

**Rationale**: Commander.js ships TypeScript declarations. No additional `@types/` package needed.

---

### Decision 5: Shebang Line Handling

**Problem**: `citation-manager.js` starts with `#!/usr/bin/env node`. TypeScript files can't have shebangs.

**Solution**: The compiled `.js` output (in `dist/`) retains the shebang. The `package.json` `bin` field points to `dist/citation-manager.js`. No change needed - TypeScript compilation preserves shebangs when configured.

**Verification**: Check `tsconfig.json` for shebang handling or add post-build step if needed.

---

## TypeScript Conversion Patterns (Epic 7 Specific)

### Pattern 1: Factory Return Types

**JavaScript** (componentFactory.js):

```javascript
export function createMarkdownParser() {
  return new MarkdownParser(fs);
}
```

**TypeScript**:

```typescript
export function createMarkdownParser(): MarkdownParser {
  return new MarkdownParser(fs);
}
```

**Key**: All factory functions get explicit return type annotations. Parameter types use `| null` for optional DI overrides:

```typescript
export function createParsedFileCache(
  parser: MarkdownParser | null = null
): ParsedFileCache {
  const _parser = parser || createMarkdownParser();
  return new ParsedFileCache(_parser);
}
```

---

### Pattern 2: LinkObjectFactory Returns LinkObject

**JavaScript** (LinkObjectFactory.js):

```javascript
createHeaderLink(targetPath, headerName) {
  return { linkType: "markdown", scope: "cross-document", ... };
}
```

**TypeScript**:

```typescript
createHeaderLink(targetPath: string, headerName: string): LinkObject {
  return { linkType: "markdown", scope: "cross-document", ... };
}
```

**Validation**: Return type `LinkObject` from `citationTypes.ts`. The `validation` field is optional on `LinkObject` (uses `?`), which matches the factory pattern where links start unvalidated (`validation: undefined`).

**Note**: The current JS sets `validation: null` on synthetic links. The TypeScript `LinkObject` interface has `validation?: ValidationMetadata` (optional, not nullable). This needs alignment - either:
- Change factory to omit `validation` property (preferred - matches optional semantics)
- Or change interface to `validation?: ValidationMetadata | null`

**Decision**: Omit `validation` from factory output. Optional `?` means "may not exist" which is correct for unvalidated links.

---

### Pattern 3: CitationManager Class Typing

**Key method signatures**:

```typescript
export class CitationManager {
  private parser: MarkdownParser;
  private parsedFileCache: ParsedFileCache;
  private fileCache: FileCache;
  private validator: CitationValidator;
  private contentExtractor: ContentExtractor;

  constructor(): void;

  async validate(filePath: string, options?: CliValidateOptions): Promise<string>;
  async fix(filePath: string, options?: CliValidateOptions): Promise<string>;
  async extractLinks(sourceFile: string, options: CliExtractOptions): Promise<void>;
  async extractHeader(targetFile: string, headerName: string, options: CliExtractOptions): Promise<OutgoingLinksExtractedContent | undefined>;
  async extractFile(targetFile: string, options: CliExtractOptions): Promise<OutgoingLinksExtractedContent | undefined>;

  // Private helpers
  private filterResultsByLineRange(result: FormattedValidationResult, lineRange: string): FormattedValidationResult;
  private parseLineRange(lineRange: string): { startLine: number; endLine: number };
  private formatForCLI(result: FormattedValidationResult): string;
  private formatAsJSON(result: FormattedValidationResult): string;
  // ... fix helpers
}
```

**Note on `extractHeader`/`extractFile` return types**: These methods return `OutgoingLinksExtractedContent | undefined` because error paths use `return;` (implicit undefined) after setting `process.exitCode`.

---

## Integration Points

### componentFactory → All Components

After conversion, componentFactory imports change from `dist/` to source:

| Component | Current Import | After Conversion |
|-----------|---------------|-----------------|
| CitationValidator | `../../dist/CitationValidator.js` | `../CitationValidator.js` |
| FileCache | `../../dist/FileCache.js` | `../FileCache.js` |
| MarkdownParser | `../../dist/MarkdownParser.js` | `../MarkdownParser.js` |
| ParsedFileCache | `../../dist/ParsedFileCache.js` | `../ParsedFileCache.js` |
| ContentExtractor | `../../dist/core/ContentExtractor/ContentExtractor.js` | `../core/ContentExtractor/ContentExtractor.js` |
| Strategies | `../../dist/core/ContentExtractor/eligibilityStrategies/*.js` | `../core/ContentExtractor/eligibilityStrategies/*.js` |

### citation-manager.js → Factories

```typescript
// Current (JS)
import { createCitationValidator, ... } from "./factories/componentFactory.js";
import { LinkObjectFactory } from "./factories/LinkObjectFactory.js";

// After (TS) - same import paths, TypeScript resolves .ts extension
import { createCitationValidator, ... } from "./factories/componentFactory.js";
import { LinkObjectFactory } from "./factories/LinkObjectFactory.js";
```

---

## Risk Assessment

### Risk 1: 50 CLI Tests May Have Other Issues Beyond Import Path

**Likelihood**: Low
**Impact**: Medium
**Mitigation**: Run tests immediately after componentFactory conversion (before touching citation-manager.js). If tests don't restore to 314, investigate before proceeding.

### Risk 2: citation-manager.js Size (1,060 lines)

**Likelihood**: Medium (large file = more potential type errors)
**Impact**: Low (orchestration code, not complex logic)
**Mitigation**: Most code is Commander.js wiring (string-typed) and method delegation. The complex types (ValidationResult, EnrichedLinkObject) are already defined.

### Risk 3: Shebang Compatibility

**Likelihood**: Low
**Impact**: High (CLI won't execute if shebang lost)
**Mitigation**: Verify `dist/citation-manager.js` retains shebang after build. Add build step if needed.

### Risk 4: `validation: null` vs `validation?: ValidationMetadata`

**Likelihood**: High (current JS explicitly sets `null`)
**Impact**: Medium (type mismatch)
**Mitigation**: Decision made above - omit `validation` from factory output OR adjust interface. Verify downstream consumers handle both `undefined` and `null`.

---

## Validation Strategy

### Per-File Validation

After each file conversion:
1. `npx tsc --noEmit` - Zero type errors
2. `npm test` - Track test count progression:
   - After LinkObjectFactory: 263/314 (no change expected)
   - After componentFactory: **314/314** (import fix restores 50 tests)
   - After citation-manager: 314/314 (maintained)
3. Checkpoint 8 - No duplicate types, imports from `types/`

### Final Validation (All 8 Checkpoints)

```bash
./tools/citation-manager/scripts/validate-typescript-migration.sh
```

**Success criteria**:
- 314/314 tests passing (100%)
- Zero compiler errors
- No `any` escapes
- All types from `types/` directory
- Build generates `.js` + `.d.ts` + source maps
- CLI commands work end-to-end

---

## Verification Checklist (for Epic 7 Execution)

To ensure the design mapping holds during implementation, verify these specific points:

- [ ] **FR1 check**: Does `npm run citation:validate` still output the exact same tree structure?
- [ ] **FR5 check**: Do `tools/citation-manager/test/cli-integration/*.test.js` pass without modification?
- [ ] **FR3 check**: Does `citation-manager.ts` import `CliFlags` from `contentExtractorTypes.ts`?

---

## References

### Component Guides
- [CLI Orchestrator Implementation Guide](../../../../component-guides/CLI%20Orchestrator%20Implementation%20Guide.md) - CitationManager contracts
- [CLI Architecture Overview](../../../../component-guides/CLI%20Architecture%20Overview.md) - Command registry, orchestration patterns

### Existing Type Libraries
- `src/types/citationTypes.ts` - LinkObject, ParserOutput, AnchorObject
- `src/types/validationTypes.ts` - ValidationMetadata, EnrichedLinkObject, ValidationResult
- `src/types/contentExtractorTypes.ts` - ExtractionEligibilityStrategy, CliFlags, OutgoingLinksExtractedContent

### Prior Epics
- [TypeScript Migration Design](../../typescript-migration-design.md) - Parent design document
- [TypeScript Migration Sequencing](../../typescript-migration-sequencing.md) - Epic dependency graph
- [Epic 6 Plan](../epic6-extraction-layer/epic6-extraction-layer-plan.md) - Most recent epic pattern

### Architecture
- `ARCHITECTURE-PRINCIPLES.md` (project root)
