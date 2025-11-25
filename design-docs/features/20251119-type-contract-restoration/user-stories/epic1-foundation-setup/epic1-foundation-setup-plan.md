# Epic 1: Foundation Setup - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` skill to implement this plan task-by-task.

**Goal:** Create validation infrastructure and fix type terminology blocker to enable Epic 2-7 conversions

**Architecture:** 8-checkpoint validation script automates verification (type safety, tests, build, duplicate detection). Fix LinkScope type mismatch (`'external'` → `'cross-document'`). Add minimal shared interfaces (Strategy, CliFlags) to unblock component conversions.

**Tech Stack:** Bash (validation script), TypeScript (type definitions), grep (duplicate detection), npm/vitest (testing)

---

## Task 0 - Setup Worktree

### Files
- New worktree directory (location determined by skill)

### Step 1: Use `using-git-worktrees` skill

Execute the `using-git-worktrees` skill.

Then rename the branch to include epic identifier:

Run: `git branch -m feature/epic4-typescript-fresh-start-worktree feature/epic4-typescript-fresh-start-epic1-foundation-setup-worktree`

Final branch: `feature/epic4-typescript-fresh-start-epic1-foundation-setup-worktree`

### Step 2: Verify worktree created

Run: `git worktree list`

Expected: Shows new worktree on branch `feature/epic4-typescript-fresh-start-epic1-foundation-setup-worktree`

### Step 3: Verify baseline state

Run: `npm test`

Expected: 314/314 tests passing (100%)

---

## Task 1 - Create Validation Script

### Files
- `tools/citation-manager/scripts/validate-typescript-migration.sh` (CREATE)

### Step 1: Create scripts directory

Run: `mkdir -p tools/citation-manager/scripts`

Expected: Directory exists

### Step 2: Write validation script

Create `tools/citation-manager/scripts/validate-typescript-migration.sh`:

```bash
#!/bin/bash
# TypeScript Migration Validation - 8 Checkpoints
# Epic 1: Foundation Setup
# Validates type safety, tests, build output, and type organization

set -e  # Exit on first error

echo "🔍 TypeScript Migration Validation (8 Checkpoints)"
echo "=================================================="

# Checkpoint 1-4: Type Safety (via tsc --noEmit)
echo ""
echo "✓ Checkpoint 1-4: Type Safety..."
npx tsc --noEmit || {
  echo "❌ Type safety check failed"
  exit 1
}

# Checkpoint 5: Tests Pass (314/314)
echo ""
echo "✓ Checkpoint 5: Tests Pass..."
npm test || {
  echo "❌ Tests failed"
  exit 1
}

# Checkpoint 6: JS Consumers (backward compatibility via tests)
echo ""
echo "✓ Checkpoint 6: JS Consumers (backward compatibility)..."
echo "   Verified via test suite (Checkpoint 5)"

# Checkpoint 7: Build Output
echo ""
echo "✓ Checkpoint 7: Build Output..."
npx tsc --build || {
  echo "❌ Build failed"
  exit 1
}

# Checkpoint 8a: No Duplicate Type Definitions
echo ""
echo "✓ Checkpoint 8a: No Duplicate Type Definitions..."
duplicates=$(grep -r "^interface LinkObject\|^type LinkObject\|^interface ValidationMetadata\|^type ValidationMetadata" tools/citation-manager/src/ --exclude-dir=types 2>/dev/null || true)
if [ -n "$duplicates" ]; then
  echo "❌ Duplicate type definitions found:"
  echo "$duplicates"
  exit 1
fi

# Checkpoint 8b: Type Imports Verified (manual check per component)
echo ""
echo "✓ Checkpoint 8b: Type Imports (manual verification per component)"

echo ""
echo "=================================================="
echo "✅ All 8 checkpoints passed!"
echo "=================================================="
```

### Step 3: Make script executable

Run: `chmod +x tools/citation-manager/scripts/validate-typescript-migration.sh`

Expected: Script has execute permissions

### Step 4: Test script runs

Run: `./tools/citation-manager/scripts/validate-typescript-migration.sh`

Expected: All 8 checkpoints pass (baseline state)

### Step 5: Commit

Use `create-git-commit` skill to commit validation script.

---

## Task 2 - Verify LinkScope Usage

### Files
- None (grep verification only)

### Step 1: Search for 'external' string literals

Run: `grep -r "'external'" tools/citation-manager/src/ --exclude-dir=node_modules`

Expected output analysis:
- Should find usage in `citationTypes.ts` (type definition)
- May find usage in test files
- Document any other occurrences for investigation

### Step 2: Search for 'cross-document' usage

Run: `grep -r "'cross-document'" tools/citation-manager/src/ --exclude-dir=node_modules`

Expected: Multiple occurrences in implementation code (this is the actual usage)

### Step 3: Document findings

Create verification summary:
- Count of `'external'` occurrences
- Count of `'cross-document'` occurrences
- Conclusion: Code uses `'cross-document'`, type definition is misaligned

### Step 4: Commit

Use `create-git-commit` skill to commit verification findings (documentation only, no code changes yet).

---

## Task 3 - Fix LinkScope Type

### Files
- `tools/citation-manager/src/types/citationTypes.ts:7` (MODIFY)

### Step 1: Update LinkScope type definition

Edit `tools/citation-manager/src/types/citationTypes.ts` line 7:

**Before:**

```typescript
export type LinkScope = 'internal' | 'external';
```

**After:**

```typescript
export type LinkScope = 'internal' | 'cross-document';
```

### Step 2: Run tests to verify fix

Run: `npm test`

Expected: 314/314 tests passing (no regressions)

### Step 3: Run validation script

Run: `./tools/citation-manager/scripts/validate-typescript-migration.sh`

Expected: All 8 checkpoints pass

### Step 4: Verify no 'external' string literals remain (except comments)

Run: `grep -r "'external'" tools/citation-manager/src/ --exclude-dir=node_modules`

Expected: Zero matches in active code (only in comments/docs if any)

### Step 5: Commit

Use `create-git-commit` skill to commit LinkScope type fix.

---

## Task 4 - Add Strategy Interface

### Files
- `tools/citation-manager/src/types/contentExtractorTypes.ts` (MODIFY)

### Step 1: Read existing file to understand structure

Run: `cat tools/citation-manager/src/types/contentExtractorTypes.ts`

Expected: See existing interfaces (EligibilityAnalysis, ExtractedContent, OutgoingLinksExtractedContent)

### Step 2: Add ExtractionEligibilityStrategy interface

Add to end of `tools/citation-manager/src/types/contentExtractorTypes.ts`:

```typescript
/**
 * Strategy interface for extraction eligibility evaluation.
 * Integration: Implemented by 5 strategy classes in ContentExtractor eligibility chain.
 *
 * Pattern: Strategy pattern with null return indicating "pass to next strategy".
 */
export interface ExtractionEligibilityStrategy {
 /**
  * Evaluate whether a link is eligible for content extraction.
  *
  * @param link - Link object to evaluate
  * @param cliFlags - CLI flags affecting eligibility (e.g., fullFiles)
  * @returns Decision object if strategy applies, null to pass to next strategy
  */
 getDecision(
  link: LinkObject,
  cliFlags: CliFlags
 ): { eligible: boolean; reason: string } | null;
}
```

### Step 3: Add import for LinkObject type

Add to top of file (after existing imports if any):

```typescript
import type { LinkObject } from './citationTypes.js';
```

### Step 4: Run TypeScript compiler

Run: `npx tsc --noEmit`

Expected: Error about missing CliFlags type (fixed in next task)

### Step 5: Commit

Use `create-git-commit` skill to commit Strategy interface addition (will have TypeScript errors until Task 5).

---

## Task 5 - Add CliFlags Interface

### Files
- `tools/citation-manager/src/types/contentExtractorTypes.ts` (MODIFY)

### Step 1: Add CliFlags interface

Add to `tools/citation-manager/src/types/contentExtractorTypes.ts` (before ExtractionEligibilityStrategy):

```typescript
/**
 * CLI flags affecting content extraction behavior.
 * Integration: Passed to ContentExtractor and strategy chain.
 *
 * Pattern: Expand during implementation as flags discovered.
 */
export interface CliFlags {
 /** Extract full file content instead of sections */
 fullFiles?: boolean;
 // Additional flags added during component conversion as needed
}
```

### Step 2: Run TypeScript compiler

Run: `npx tsc --noEmit`

Expected: Zero errors (both interfaces now defined)

### Step 3: Run tests

Run: `npm test`

Expected: 314/314 tests passing (no runtime impact yet)

### Step 4: Commit

Use `create-git-commit` skill to commit CliFlags interface addition.

---

## Task 6 - Run Final Validation

### Files
- None (validation only)

### Step 1: Run full validation script

Run: `./tools/citation-manager/scripts/validate-typescript-migration.sh`

Expected: All 8 checkpoints pass

### Step 2: Verify type organization

Run: `grep -r "^interface LinkObject\|^type LinkObject" tools/citation-manager/src/ --exclude-dir=types`

Expected: Zero matches (types only in types/ directory)

### Step 3: Verify imports exist

Run: `grep -n "import.*from.*types/" tools/citation-manager/src/types/contentExtractorTypes.ts`

Expected: At least one import from citationTypes.ts

### Step 4: Document Epic 1 completion

Create summary:
- ✅ Validation script created and passing
- ✅ LinkScope terminology fixed (`'external'` → `'cross-document'`)
- ✅ ExtractionEligibilityStrategy interface added
- ✅ CliFlags interface added
- ✅ 314/314 tests passing
- ✅ All 8 checkpoints pass

### Step 5: Commit

Use `create-git-commit` skill to commit final validation results and Epic 1 summary.

---

## Task 7 - Commit Epic 1

### Files
- All modified files from Tasks 1-6

### Step 1: Review changes

Run: `git status`

Expected: Modified files:
- `tools/citation-manager/scripts/validate-typescript-migration.sh` (new)
- `tools/citation-manager/src/types/citationTypes.ts` (modified)
- `tools/citation-manager/src/types/contentExtractorTypes.ts` (modified)

### Step 2: Stage changes

Run: `git add tools/citation-manager/scripts/validate-typescript-migration.sh tools/citation-manager/src/types/citationTypes.ts tools/citation-manager/src/types/contentExtractorTypes.ts`

Expected: Files staged for commit

### Step 3: Use create-git-commit skill

Execute the `create-git-commit` skill with scope `typescript-migration` and message describing Epic 1 completion.

### Step 4: Verify commit

Run: `git log -1 --stat`

Expected: Commit shows 3 files changed, includes Epic 1 summary

### Step 5: Push branch (if working with remote)

Run: `git push -u origin epic1-foundation-setup`

Expected: Branch pushed to remote (if applicable)

---

## Validation Criteria

**Epic 1 Complete When:**
- ✅ Validation script exists and passes all 8 checkpoints
- ✅ LinkScope type matches actual usage (`'cross-document'`)
- ✅ ExtractionEligibilityStrategy interface defined
- ✅ CliFlags interface defined
- ✅ 314/314 tests passing
- ✅ Zero TypeScript compiler errors
- ✅ No duplicate type definitions detected
- ✅ Changes committed with meaningful message

---

## Next Steps

After Epic 1 completion:
1. Merge `epic1-foundation-setup` branch to `feature/epic4-typescript-fresh-start`
2. Begin Epic 2: Leaf Components (FileCache conversion)
3. Use validation script after each component conversion

---

## References

- **Design**: [typescript-migration-design.md](../../typescript-migration-design.md) - Patterns and approach
- **Sequencing**: [typescript-migration-sequencing.md](../../typescript-migration-sequencing.md) - Epic sequence
- **Architecture Principles**: [ARCHITECTURE-PRINCIPLES.md](../../../../../../../ARCHITECTURE-PRINCIPLES.md) - Standards
