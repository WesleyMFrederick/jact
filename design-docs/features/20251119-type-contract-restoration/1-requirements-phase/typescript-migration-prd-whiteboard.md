# TypeScript Migration PRD - Whiteboard

**Created**: 2025-01-21
**Purpose**: Capture context, discussions, and decisions that inform the PRD but don't belong in the formal requirements document.

---

## Context: Why This PRD?

### The Rollback Situation
- **Starting Point**: Commit `1c571e0` (Epic 4.1 complete, 314/314 tests passing)
- **What Failed**: Epic 4.2-4.5 component conversions broke contracts, reduced tests to ~295/337
- **What We Preserved**: TypeScript infrastructure, shared type libraries, normalizeAnchor POC
- **Decision**: Rollback to `1c571e0`, create fresh migration with proper process

### What We Learned (from lessons-learned.md)

**Root Causes of Failure:**
1. Created types from imagination, not reality (didn't read actual JS code)
2. Changed tests to match wrong types instead of fixing type definitions
3. Ignored downstream consumer expectations
4. Didn't read Component Guides before converting

**Architecture Violations:**
- Violated Data-First Design (changed representation instead of typing existing structure)
- Violated Single Responsibility (CitationValidator created wrapper objects)

---

## Key Decisions During PRD Creation

### Decision 1: Scope - Entire Migration vs Phase 1
**User Answer**: "PRD is high level, so it should cover the entire migration. However, progressive disclosure. We are in phase 1 where our output will be requirements."

**Implication**:
- PRD covers all 7 components (FileCache → CLI) at high level
- Design phase will break down into specific approach for our system
- Implementation phase will create detailed component-by-component tasks

### Decision 2: Process as Requirement?
**User Answer**: "No - process is design"

**Implication**:
- PRD specifies WHAT (preserve contracts, maintain type safety, validate incrementally)
- Design specifies HOW (component guides, citation-manager, git show commands)
- NFRs focus on **outcomes** (contract preservation) not **methods** (read guides first)

### Decision 3: Test Coverage Requirements
**User Answer**: "100% pass rate, but we will have some broken tests as we migrate, particularly if we can't build the whole tool. right?"

**Implication**:
- Final success criteria: 100% test pass rate
- Acknowledge intermediate breakage during migration (TypeScript compilation errors)
- Requirement: Tests must validate contracts at completion, incremental validation approach
- NOT: "Never break a test during work"

### Decision 4: Architecture Preservation
**User Answer**: Selected all three: No data structure changes, No architecture pattern changes, No new features

**Implication**:
- Explicit non-goals in PRD
- Type conversion is ONLY goal
- Preserve enrichment patterns, data shapes, return types
- No "improvements" or refactoring beyond typing

### Decision 5: Checkpoint Validation Execution (Design Phase)
**Context**: Solutions hypothesis proposed 8-checkpoint validation framework. Needed to clarify WHO runs checkpoints and HOW.

**User Answer**: "You are the tech lead. Recommendation?"

**Tech Lead Recommendation**: Single validation script coding agents run after each component conversion

**Rationale**:
- CEO doesn't run commands manually—coding agents execute implementation
- Single script (`validate-typescript-migration.sh`) provides fast feedback
- Reusable across tasks, manual verification, future CI
- Fail fast—catches issues before next component

**Implication**:
- Solution 2 updated with validation script approach
- ADR callout documents this decision in solutions-hypothesis.md
- Implementation tasks include script execution as validation step

---

## Progressive Disclosure Strategy

### Phase 1: Requirements (This PRD)
**Output**: Generic, high-level requirements
**Question**: WHAT needs to be solved?
**Characteristics**:
- Generic (not citation-manager specific)
- High-level (not tactical)
- Evaluable (can measure project against these)

**Example**:
- ✅ "System SHALL preserve all existing data contracts"
- ❌ "Must read CitationValidator Component Guide before converting"

### Phase 2: Design (Next Step)
**Output**: System-specific technical approach
**Question**: HOW does this fit OUR system (citation-manager)?
**Will Include**:
- Component migration sequence (FileCache → CLI)
- Use of component guides, citation-manager extract
- Validation checkpoints and commands
- TypeScript-specific patterns for our architecture

### Phase 3: Sequencing
**Output**: Ordered work breakdown
**Question**: In what ORDER and how DECOMPOSED?

### Phase 4: Implementation
**Output**: Bite-sized tasks (2-5 min each)
**Question**: EXACTLY what actions to take?

---

## Components to Migrate (Reference)

From ROLLBACK-PLAN.md, suggested order (smallest to largest):
1. FileCache (~200 lines) - Simple, no complex types
2. ParsedFileCache (~100 lines) - Uses FileCache
3. MarkdownParser (~500 lines) - Complex but isolated
4. ParsedDocument (~300 lines) - Facade over parser
5. CitationValidator (~600 lines) - Complex validation logic
6. ContentExtractor (~400 lines) - Uses validator
7. citation-manager CLI (~800 lines) - Orchestrator

**Note**: This sequence belongs in Design/Sequencing docs, NOT in PRD.

---

## What's Already Preserved (Baseline `1c571e0`)

### TypeScript Infrastructure ✅
- Root `tsconfig.json` and `tsconfig.base.json` with strict type checking
- Citation-manager TypeScript configuration
- Workspace-level build scripts
- TypeScript 5.3+ as explicit dev dependency
- Vitest configuration for TypeScript test discovery

### Shared Type Libraries ✅
**Location**: `tools/citation-manager/src/types/`

**citationTypes.ts**:
- LinkObject interface
- Anchor interface
- Heading interface
- LinkScope type
- anchorType enums

**validationTypes.ts**:
- ValidationMetadata interface
- ValidationResult interface
- ResolutionResult type
- SingleCitationValidationResult type

**contentExtractorTypes.ts**:
- OutgoingLinksExtractedContent interface
- ExtractionStrategy interface
- Content deduplication types

### Successfully Migrated Components ✅
- `normalizeAnchor.ts` (Epic 3 POC)
- All supporting test infrastructure

---

## References

- **Rollback Plan**: [Next Steps After Rollback](../0-elicit-sense-making-phase/ROLLBACK-PLAN.md#Next%20Steps%20After%20Rollback)- Complete rollback context and next steps
- **Lessons Learned**: [lessons-learned.md](../0-elicit-sense-making-phase/lessons-learned.md) %% force-extract %% - Documented failures and prevention checklist
- **Research Whiteboard**: [typescript-restoration-whiteboard.md](../0-elicit-sense-making-phase/typescript-restoration-whiteboard.md) - Original analysis and audit
- **Component Guides**: [component-guides](../../../component-guides/component-guides.md) %% force-extract %% - Contract specifications
- **Development Workflow**: [Progressive Disclosure](Development%20Workflow.md#Progressive%20Disclosure:%20Four%20Levels)  [Development Workflow Quick Reference](../../../../../.claude/skills/enforcing-development-workflow/Development%20Workflow%20Quick%20Reference.md) %% force-extract %% - Four-level disclosure process
- **Architecture Principles**: [Data-First Design](../../../../../../ARCHITECTURE-PRINCIPLES.md#Data-First%20Design%20Principles) - Contract preservation foundation

---

## Questions Raised / Clarifications Needed

### Q1: Test Pass Rate During Migration
**Question**: If TypeScript compilation fails, tests can't run. How do we maintain "100% pass rate"?

**Answer**: Requirement is about validation approach and final state:
- Each component migration must restore to 100% before moving to next component
- Acknowledge that during active conversion, compilation may break temporarily
- Success criteria: End state is 100% pass rate with all components migrated

### Q2: What if Component Guide is missing or incomplete?
**Answer**: (TBD in Design phase - not a PRD concern)

### Q3: Can we add JSDoc comments during migration?
**Answer**: Adding documentation is not "changing architecture" - but this is a Design decision, not PRD requirement

---

## Notes for Design Phase

When writing Design doc, include:
1. **Specific tools**: citation-manager extract, git show commands, Component Guides
2. **Validation commands**: npm test, tsc --noEmit, citation-manager validate
3. **Checkpoint criteria**: When to proceed to next component
4. **Rollback strategy**: What to do if a component conversion fails

---

## Success Metrics (for Validation)

After migration complete, verify:
- [ ] 314+ tests passing (100%)
- [ ] All source files are `.ts` (except existing .js if kept intentionally)
- [ ] All types imported from shared `types/` directory
- [ ] Zero duplicate type definitions
- [ ] Component Guide contracts validated via citation-manager
- [ ] No wrapper types or architecture pattern changes
- [ ] Integration tests pass (CLI → validator → extractor flow)

**Note**: These are implementation validation criteria, not PRD requirements. PRD states high-level goals, not specific metrics.
