# TypeScript Rollback Plan - Preserve Good Work

**Created**: 2025-11-20
**Status**: Ready to Execute
**Recommended Baseline**: `1c571e0` (Epic 4.1 complete)

---

## Optimal Rollback Point Found

### Commit `1c571e0` - Epic 4.1 Complete
**Message**: `feat(typescript): [Epic 4.1] [Task 4.1.6] validate automation script against Epic 3 POC files`
**Test Status**: ✅ **314/314 tests passing (100%)**
**Date**: Between Epic 3 POC and Epic 4.2 component conversions

---

## What We Save (Preserve This Good Work)

### ✅ Epic 1: TypeScript Infrastructure (commit 191015b)
- Root `tsconfig.json` and `tsconfig.base.json` with strict type checking
- Citation-manager TypeScript configuration
- Workspace-level build scripts for coordinated compilation
- TypeScript 5.3+ added as explicit dev dependency
- Vitest configuration for TypeScript test discovery
- **Status**: 304/304 tests passing

### ✅ Epic 3: POC Validation (commit 3946e5d)
- Successfully migrated `normalizeAnchor.js` to TypeScript
- Validated type inference and test compatibility
- Proof-of-concept for incremental migration strategy
- Fixed sandbox test timeouts
- **Status**: 304/304 tests passing

### ✅ Epic 4.1: Shared Type Libraries (commit 1c571e0)
- `types/citationTypes.ts` - LinkObject, Anchor, Heading types
- `types/validationTypes.ts` - Validation result types
- `types/contentExtractorTypes.ts` - Content extraction types
- Validation checkpoint script with 7 automated checks
- Type organization patterns documentation
- **Status**: 314/314 tests passing ✅

### ✅ Conditional-Claude Changes (commit 3946e5d)
- Sandbox test timeout fixes
- Test infrastructure improvements
- These are preserved in the baseline

---

## What We Rollback (Broken Contract Violations)

### ❌ Epic 4.2: ContentExtractor Component Conversions (321ccac onwards)
- Broke tests: 314 → 261 passing (53 failures introduced)
- Component conversions with type mismatches
- **Issue**: Components didn't use shared types correctly

### ❌ Epic 4.3: Core Component Conversions (959b138 onwards)
- MarkdownParser, FileCache, ParsedDocument conversions
- Broke tests further: 261 → 278 passing (21 more failures)
- **Issue**: Duplicate type definitions, contract violations

### ❌ Epic 4.4: CitationValidator Conversion (53b9ead onwards)
- CitationValidator conversion with hallucinated wrappers
- Broke tests: 278 → ~295 passing (still broken)
- **Issue**: Created wrapper types violating enrichment pattern

### ❌ Epic 4.5: Attempted Fixes (multiple commits)
- Attempts to fix broken contracts
- Never achieved >95% test pass rate
- **Issue**: Band-aid fixes without addressing root cause

---

## Rollback Execution Plan

### Step 0: Pre-Flight Check (Verify Current State)

**Purpose**: Understand where we are now and what state everything is in before making changes.

```bash
# Verify current location and branch
pwd
git branch --show-current
git log --oneline -5

# Check worktree structure
git worktree list

# Verify current test status
npm test

# Expected Output:
# - Main repo: feature/epic4-typescript-systematic-conversion (clean baseline)
# - Worktree: feature/epic4-typescript-systematic-conversion-worktree (broken, at commit dc57ee7)
# - Tests in main repo: Should be passing
# - Tests in worktree: Broken (317/337 or similar)
```

### Step 1: Verify Baseline is Good

```bash
# Checkout baseline commit
git checkout 1c571e0

# Verify tests pass
npm test
# Expected: 314/314 tests passing (100%)

# Verify file structure
ls -la tools/citation-manager/src/
# Expected: All .js files (no .ts except normalizeAnchor.ts)

# Verify type libraries exist
ls -la tools/citation-manager/src/types/
# Expected: citationTypes.ts, validationTypes.ts, contentExtractorTypes.ts
```

### Step 2: Create Rollback Branch

**Corrected (works with worktree setup):**

```bash
# Create new branch directly from baseline commit (no need to checkout worktree branch)
git checkout -b feature/epic4-typescript-fresh-start 1c571e0

# Verify we're on the new branch at correct commit
git branch --show-current  # Should show: feature/epic4-typescript-fresh-start
git log --oneline -1       # Should show: 1c571e0

# Push new branch
git push -u origin feature/epic4-typescript-fresh-start
```

### Step 3: Update Feature Branch (Destructive - Optional)

#### Original Instructions
**Only do this if you want to reset the feature branch itself:**

```bash
# Hard reset feature branch to baseline
git checkout feature/epic4-typescript-systematic-conversion-worktree
git reset --hard 1c571e0

# Force push (WARNING: destructive)
git push --force origin feature/epic4-typescript-systematic-conversion-worktree
```

**Safer Alternative**: Keep broken branch for reference, work on new branch:

```bash
# Rename broken branch for reference
git branch -m feature/epic4-typescript-systematic-conversion-worktree feature/epic4-typescript-broken-reference

# Use new fresh-start branch as primary
git checkout feature/epic4-typescript-fresh-start
```

#### Corrected Instructions

##### Step 3a: Verify Fresh-Start Branch Works

```bash
# Ensure we're on the fresh-start branch
git checkout feature/epic4-typescript-fresh-start

# Run full test suite
npm test
# Expected: 314/314 tests passing (100%)

# Verify file structure is correct
ls -la tools/citation-manager/src/*.js | head -5
# Expected: All .js files (except normalizeAnchor.ts)

# Verify type libraries exist
ls -la tools/citation-manager/src/types/
# Expected: citationTypes.ts, validationTypes.ts, contentExtractorTypes.ts
```

##### Step 3b: Document Worktree Status (No Modifications Yet)

```bash
# Just verify worktree is still there (don't touch it)
git worktree list
# Expected: Both main repo and worktree shown

# Note: Worktree branch remains as broken reference for now
# Do NOT attempt to checkout, rename, or reset the worktree branch yet
# We'll clean it up later after fresh-start is proven stable
```

##### Step 3c: Cleanup Worktree (Only After Fresh-Start Proven Good)

Do this step ONLY after working on fresh-start branch for a day and confirming everything works:

```bash
# Option A: Remove worktree entirely (safest)
git worktree remove .worktrees/feature/epic4-typescript-systematic-conversion-worktree
git branch -D feature/epic4-typescript-systematic-conversion-worktree

# Option B: Keep worktree but reset it to baseline (if you want to keep using it)
cd .worktrees/feature/epic4-typescript-systematic-conversion-worktree
git reset --hard 1c571e0
npm test  # Verify 314/314 tests passing
cd ../..  # Return to main repo
```

---

## What's Preserved in Baseline

### TypeScript Infrastructure ✅
- tsconfig.json (root + citation-manager)
- TypeScript dependency (5.3+)
- Build scripts
- Vitest TypeScript support

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

### All JavaScript Components ✅
Still in JavaScript, ready for proper conversion:
- CitationValidator.js
- MarkdownParser.js
- FileCache.js
- ParsedDocument.js
- ParsedFileCache.js
- citation-manager.js
- ContentExtractor.js
- All factories and strategies

---

## Next Steps After Rollback

### 1. Create Lessons Learned Document

***Document***: [lessons-learned](lessons-learned.md) %% force-extract %%

Document what went wrong in Epic 4.2-4.5:
- Created types without reading Component Guides
- Didn't validate types against JavaScript return structures
- Updated tests to match wrong types instead of fixing types
- Didn't check downstream consumers' expectations

### 2. Create Fresh TypeScript Migration Plan

Use proper process this time:
1. **Read [Component Guide](../../component-guides/component-guides.md)%% force-extract %% FIRST** for each component
2. **Extract contracts** via `citation-manager extract links`
3. **Analyze JavaScript structures** via `git show`
4. **Create types matching contracts** (no invention)
5. **Validate incrementally** (one component at a time)
6. **Run tests after each component** (must maintain 100%)

### 3. Start with Smallest Component

Suggested order (smallest to largest):
1. FileCache (~200 lines) - Simple, no complex types
2. ParsedFileCache (~100 lines) - Uses FileCache
3. MarkdownParser (~500 lines) - Complex but isolated
4. ParsedDocument (~300 lines) - Facade over parser
5. CitationValidator (~600 lines) - Complex validation logic
6. ContentExtractor (~400 lines) - Uses validator
7. citation-manager CLI (~800 lines) - Orchestrator

---

## Rollback Success Criteria

After rollback to `1c571e0`:
- [ ] Tests passing: 314/314 (100%)
- [ ] All type libraries exist in `src/types/`
- [ ] `normalizeAnchor.ts` successfully migrated
- [ ] All other source files are `.js` (except normalizeAnchor)
- [ ] TypeScript infrastructure in place (tsconfig, build scripts)
- [ ] No hallucinated wrapper types in codebase
- [ ] Ready for fresh, incremental migration

---

## Preservation Benefits

By rolling back to `1c571e0` instead of earlier commits:

**Time Saved**:
- ✅ Don't need to recreate TypeScript infrastructure (Epic 1)
- ✅ Don't need to recreate shared type libraries (Epic 4.1)
- ✅ Don't need to redo normalizeAnchor POC (Epic 3)
- ✅ Have validation scripts and checkpoints ready

**Work Preserved**:
- ~40 hours of infrastructure setup (Epic 1)
- ~8 hours of type library creation (Epic 4.1)
- ~4 hours of POC validation (Epic 3)
- **Total preserved**: ~52 hours of good work

**Work Lost**:
- Epic 4.2-4.5 component conversions (~30-40 hours)
- **BUT**: This work was fundamentally broken and would need full redo anyway

---

## References

- **Research Whiteboard**: [typescript-restoration-whiteboard](typescript-restoration-whiteboard.md) - Comprehensive analysis
- **Type Audit**: [typescript-type-contract-audit](research/typescript-type-contract-audit.md) - Contract violations documented
- **Architecture Doc Component Overview**: [Level 3: Components](../../ARCHITECTURE-Citation-Manager.md#Level%203%20Components) - Component Overview
- **Component Guides**: [[component-guides]] - Validation contracts

---

## Quick Rollback Command

```bash
# Single command to create fresh-start branch from baseline
git checkout -b feature/epic4-typescript-fresh-start 1c571e0
git push -u origin feature/epic4-typescript-fresh-start
npm test  # Verify 314/314 tests passing
```
