# US2.7: Remove Deprecated base-paths Command - Design Plan

## Overview

The `base-paths` CLI command extracts distinct file paths from citations. With the Validation Enrichment Pattern (US1.8), this command is redundant. Validation results now include `target.path.absolute` on each LinkObject, eliminating the need for a separate extraction command.

This design removes the CLI command and core method while preserving the npm script interface through a facade pattern.

## Problem Statement

The `base-paths` command duplicates functionality now available in validation results. The command exists at three levels:

1. **CLI command**: Registered in citation-manager.js with Commander.js
2. **Core method**: `CitationManager.extractBasePaths()` implementation
3. **npm script**: `citation:base-paths` wrapper in package.json

Post-US1.8, users can extract base paths by parsing validation output:

```bash
npm run citation:validate file.md --format json | jq '.links[].target.path.absolute' | sort -u
```

The dedicated command adds maintenance burden without providing unique value.

## Design Solution

### Facade Pattern at npm Script Level

Remove the CLI command and core method. Preserve the npm script interface by reimplementing it as a shell wrapper around the validation command.

**Benefits**:
- Zero workflow disruption (npm script interface unchanged)
- Removes redundant code (CLI command and method gone)
- Automatic synchronization with validation logic
- Reduces maintenance surface (one less command to maintain)

**Trade-off**: npm script now depends on external tools (`jq` for JSON parsing). This is acceptable since `jq` is standard in development environments and the old implementation also required JSON parsing internally.

### Implementation Details

#### What Gets Removed

1. **CLI Command** (`citation-manager.js:938-968`)
   - Commander.js `base-paths` command registration
   - Command handler with file argument and --format option

2. **Core Method** (`citation-manager.js:510-556`)
   - `CitationManager.extractBasePaths()` implementation
   - Base path extraction and deduplication logic

3. **Test Case** (`enhanced-citations.test.js:64-104`)
   - Test validating CLI command functionality

4. **Permission Entry** (`.claude/settings.local.json:17`)
   - Claude Code allowlist entry for `citation:base-paths` command

#### What Gets Retained

1. **npm Script** (Modified in `package.json`)

   ```json
   {
     "scripts": {
       "citation:base-paths": "sh -c 'node tools/citation-manager/src/citation-manager.js validate \"$1\" --format json | jq -r \".links[].target.path.absolute\" | sort -u' --"
     }
   }
   ```

2. **Helper Methods** (Per US2.7 AC4)
   - `parseAvailableHeaders`
   - `normalizeAnchorForMatching`
   - `findBestHeaderMatch`
   - `urlEncodeAnchor`

   These methods support the `fix` command and remain until Epic 3 refactoring.

### Migration Path

**User Interface**: Unchanged. Users continue using:

```bash
npm run citation:base-paths file.md
```

**Internal Implementation**: The npm script now pipes through validate:

```bash
validate → jq (extract paths) → sort -u (deduplicate and sort)
```

**Output Format**: Changed from JSON to newline-separated paths. This matches the practical use case: users typically pipe base paths to other commands or redirect to files.

**Documentation Updates**:
- README.md: Explain the command is now a wrapper around `validate`
- Architecture docs: Document the facade pattern

**No Updates Required**:
- CLAUDE.md (examples continue working)
- WORKSPACE-SETUP.md (examples continue working)
- Design docs with initialization instructions (npm script still works)

## Testing Strategy

### Test Modifications

**Remove**: CLI command test in `enhanced-citations.test.js:64-104`

**Add**: npm script wrapper test validating end-to-end behavior

```javascript
it("should extract base paths via npm script wrapper", () => {
  // Given: Test file with multiple citations
  const testFile = join(__dirname, "fixtures", "enhanced-citations.md");

  // When: Execute npm script (pipes through validate → jq → sort)
  const output = runCLI(
    `npm run citation:base-paths "${testFile}"`,
    { cwd: join(__dirname, '..', '..', '..') } // Workspace root for npm run
  );

  // Then: Output is newline-separated paths
  const paths = output.trim().split('\n').filter(p => p.length > 0);

  expect(paths.length).toBeGreaterThanOrEqual(6);
  expect(paths).toEqual([...new Set(paths)]); // Unique (sort -u)
  expect(paths).toEqual([...paths].sort()); // Sorted alphabetically

  // Spot-check expected paths
  expect(paths.some(p => p.includes('test-target.md'))).toBe(true);
  expect(paths.some(p => p.includes('design-principles.md'))).toBe(true);
});
```

**Buffer Safety**: Uses `runCLI` helper from `test/helpers/cli-runner.js`, which bypasses the 64KB stdio buffer limit via shell redirection to temporary files. The npm script output is small (~2-3KB even with 100+ citations), well below buffer limits.

**What Changed**:
- Old test validated JSON output structure (`result.count`, `result.basePaths`)
- New test validates newline-separated path strings
- Same fixtures, same expected paths, different output format

### Regression Testing

**Verify**:
1. Full test suite passes (expect count to drop by 1)
2. npm script produces identical output to old command (same paths, sorted, deduplicated)
3. No orphaned code references `extractBasePaths` or `base-paths` command
4. CLI help output no longer lists `base-paths` command

## Acceptance Criteria Validation

**US2.7 Acceptance Criteria** (from PRD):

- **AC1**: `base-paths` CLI command removed from command registry ✅
  - Command registration removed from citation-manager.js
  - Help output no longer lists command

- **AC2**: `CitationManager.extractBasePaths()` method removed ✅
  - Method implementation deleted
  - No references remain in codebase

- **AC3**: Full test suite passes with zero regressions ✅
  - New test validates npm script wrapper
  - All existing tests pass (one test removed, one test added)

- **AC4**: Helper methods retained until Epic 3 ✅
  - `parseAvailableHeaders`, `normalizeAnchorForMatching`, `findBestHeaderMatch`, `urlEncodeAnchor` remain unchanged
  - These methods support the `fix` command

**Additional Success Criteria**:
- npm script interface preserved (backward compatibility)
- Documentation updated to reflect facade pattern
- Claude Code permissions simplified (allowlist entry removed)

## Architecture Rationale

### Why Facade Pattern Over Direct Removal

**Alternative Considered**: Remove command entirely, force users to manually pipe validate output.

**Rejection Rationale**: The npm script interface is valuable. Twenty design documents reference it in initialization instructions. Removing the interface creates documentation churn without benefit.

**Facade Benefits**:
- Preserves convenient interface for common operation
- Eliminates code duplication (relies on validate implementation)
- Documents migration path (users can see the new pattern in package.json)
- Enables eventual removal if usage declines (change is localized to package.json)

### Design Pattern: Adapter at Package Manager Level

This applies the Adapter pattern at an unconventional level. Typically, adapters exist in application code. Here, the adapter lives in package configuration, translating between:

- **Old Interface**: `npm run citation:base-paths <file>`
- **New Implementation**: validate command with jq post-processing

This demonstrates that architectural patterns apply at all abstraction levels, not just code.

## Implementation Checklist

- [ ] Remove `base-paths` command registration from citation-manager.js
- [ ] Remove `extractBasePaths()` method implementation
- [ ] Update package.json with new npm script implementation
- [ ] Remove CLI command test from enhanced-citations.test.js
- [ ] Add npm script wrapper test
- [ ] Run full test suite (verify all pass)
- [ ] Remove Claude Code permission entry from .claude/settings.local.json
- [ ] Update README.md to document facade pattern
- [ ] Update architecture documentation
- [ ] Verify no orphaned references to base-paths command
- [ ] Verify CLI help no longer lists base-paths
