# Task 5 Review Results

**Reviewer Model:** Claude Sonnet 4.5
**Task:** Link Factory Function (#30)
**Verdict:** FIX REQUIRED

## Summary

Factory method created and tested, but incomplete integration. Used in only 1 of 6 extraction methods, leaving 83% of link construction with duplicate logic.

## Issues

### BLOCKING

#### Incomplete Integration (#30 contract violation)
- Plan requires: "update all callers in extractLinks() and private _extract*Links() methods"
- Actual: Factory used in `_extractLinksFromTokens` only (line 208)
- Remaining methods still use inline construction:
  - `_extractCiteLinks` (lines ~253-276)
  - `_extractWikiCrossDocLinks` (lines ~292-320)
  - `_extractWikiInternalLinks` (lines ~335-357)
  - `_extractCaretLinks` (lines ~373-397)
  - `_extractMarkdownLinksRegex` (if exists)

**Code smell:** Path resolution duplicated BEFORE factory call

```typescript
// Lines 200-202 (before factory)
const absolutePath = this.resolvePath(rawPath, sourceAbsolutePath);
const relativePath = absolutePath && sourceAbsolutePath
  ? relative(dirname(sourceAbsolutePath), absolutePath)
  : null;

// Then passed to factory which does it AGAIN (lines 860-865)
```

Factory designed to handle path resolution internally, but caller pre-resolves paths, defeating the purpose.

### Important

**Test gap:** No test verifies factory usage across all extraction paths. Characterization test would catch integration gaps.

## Files Affected

- `/tools/citation-manager/src/MarkdownParser.ts` - factory exists (846-886), partial integration (208)
- `/tools/citation-manager/test/parser-link-factory.test.js` - 3/3 tests pass

## Required Fixes

1. Refactor 5 extraction methods to use `_createLinkObject()`
2. Remove duplicate path resolution from `_extractLinksFromTokens` caller (lines 200-202)
3. Pass raw values to factory, let it handle resolution
4. Run regression: `npm test` (390/392 must pass, 2 pre-existing failures OK)

**Estimated effort:** 30 min
