# MarkdownParser Tech Debt Implementation Plan

%%stop-extract-link%%

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 8 MarkdownParser issues (3 bugs, 4 refactors, 1 structural split) using TDD red-green-refactor.

**Architecture:** Line-by-line regex extraction is replaced with token-first extraction from `marked.lexer()`. Regex retained ONLY for Obsidian-specific syntax not in CommonMark. Monolith is split into action-based files following ContentExtractor reference pattern.

**Tech Stack:** TypeScript, marked.js (lexer/tokens), Vitest, Node.js path module

**Working Directory:** `tools/citation-manager/`

**Build & Test Commands:**
- Build: `npm run build -w tools/citation-manager`
- All tests: `npm run test:citation`
- Single test: `npx vitest run test/<test-file>.test.js --reporter=verbose`
- Integration: `npm run test:integration`

---

## Task 1 — Fix Parentheses in Anchor Fragments (#59)

**GitHub Issue:** #59
**Risk:** Medium (regex side effects)

### Files
- `src/MarkdownParser.ts:118` (MODIFY — `linkPattern` regex)
- `src/MarkdownParser.ts:211` (MODIFY — `relativeDocRegex` regex)
- `src/MarkdownParser.ts:354` (MODIFY — `internalAnchorRegex` regex)
- `test/parser-parens-in-anchors.test.js` (CREATE & TEST)

### Step 1: Write the failing test

Create `test/parser-parens-in-anchors.test.js`:

```javascript
import { describe, expect, it } from "vitest";
import { MarkdownParser } from "../src/MarkdownParser.js";

// Minimal fs mock that returns content directly
const mockFs = (content) => ({
  readFileSync: () => content,
});

describe("MarkdownParser — Parentheses in Anchor Fragments (#59)", () => {
  it("should capture full anchor including parentheses in cross-document link", async () => {
    const content = '[Guide](CitationValidator%20Implementation%20Guide.md#ValidationMetadata%20Type%20(Discriminated%20Union))';
    const parser = new MarkdownParser(mockFs(content));
    const result = await parser.parseFile("/test/source.md");

    const link = result.links.find(l => l.scope === "cross-document");
    expect(link).toBeDefined();
    expect(link.target.anchor).toBe("ValidationMetadata%20Type%20(Discriminated%20Union)");
    expect(link.target.path.raw).toBe("CitationValidator%20Implementation%20Guide.md");
  });

  it("should capture full anchor including parentheses in internal anchor link", async () => {
    const content = '[Jump](#Heading%20(With%20Parens))';
    const parser = new MarkdownParser(mockFs(content));
    const result = await parser.parseFile("/test/source.md");

    const link = result.links.find(l => l.scope === "internal");
    expect(link).toBeDefined();
    expect(link.target.anchor).toBe("Heading%20(With%20Parens)");
  });

  it("should not break standard links without parentheses in anchors", async () => {
    const content = '[Normal](file.md#simple-anchor)';
    const parser = new MarkdownParser(mockFs(content));
    const result = await parser.parseFile("/test/source.md");

    const link = result.links[0];
    expect(link.target.anchor).toBe("simple-anchor");
    expect(link.target.path.raw).toBe("file.md");
  });

  it("should handle multiple links on same line, one with parens anchor", async () => {
    const content = '[A](a.md#simple) and [B](b.md#Complex%20(Thing))';
    const parser = new MarkdownParser(mockFs(content));
    const result = await parser.parseFile("/test/source.md");

    expect(result.links.length).toBeGreaterThanOrEqual(2);
    const linkA = result.links.find(l => l.text === "A");
    const linkB = result.links.find(l => l.text === "B");
    expect(linkA.target.anchor).toBe("simple");
    expect(linkB.target.anchor).toBe("Complex%20(Thing)");
  });
});
```

### Step 2: Run test to verify it fails

Run: `npx vitest run test/parser-parens-in-anchors.test.js --reporter=verbose`
Expected: FAIL — anchor truncated at first `)`, capturing `"ValidationMetadata%20Type%20(Discriminated%20Union"` instead of full string.

### Step 3: Write minimal implementation

In `src/MarkdownParser.ts`, replace the three regex patterns that use `[^)]+`:

**Line 118 — `linkPattern`:**

```typescript
// OLD: const linkPattern = /\[([^\]]+)\]\(([^)#]+\.md)(#([^)]+))?\)/g;
// NEW: Use balanced parentheses pattern
const linkPattern = /\[([^\]]+)\]\(([^)#]+\.md)(#([^)]*(?:\([^)]*\)[^)]*)*))\)/g;
```

The key insight: anchor fragment after `#` can contain balanced `(...)` groups. Pattern `([^)]*(?:\([^)]*\)[^)]*)*)` matches:
- `[^)]*` — chars before any paren
- `(?:\([^)]*\)[^)]*)*` — zero or more balanced `(...)` groups followed by non-paren chars

Apply same pattern to:

**Line 211 — `relativeDocRegex`:**

```typescript
// OLD: /\[([^\]]+)\]\(([^)]*\/[^)#]+)(#[^)]+)?\)/g
// NEW:
const relativeDocRegex = /\[([^\]]+)\]\(([^)#]*\/[^)#]+)(#[^)]*(?:\([^)]*\)[^)]*)*)\)/g;
```

**Line 354 — `internalAnchorRegex`:**

```typescript
// OLD: /\[([^\]]+)\]\(#([^)]+)\)/g
// NEW:
const internalAnchorRegex = /\[([^\]]+)\]\(#([^)]*(?:\([^)]*\)[^)]*)*)\)/g;
```

### Step 4: Run test to verify it passes

Run: `npx vitest run test/parser-parens-in-anchors.test.js --reporter=verbose`
Expected: PASS

### Step 5: Run full regression suite

Run: `npm run test:citation`
Expected: All 22+ existing tests pass.

### Step 6: Commit

Use `create-git-commit` skill. Message: `fix(parser): handle parentheses in anchor fragments (#59)`

---

## Task 2 — Filter Version Numbers from Caret Citations (#37)

**GitHub Issue:** #37
**Risk:** Low (additive filtering)

### Files
- `src/MarkdownParser.ts:395` (MODIFY — caret regex post-filter)
- `test/parser-version-caret-filter.test.js` (CREATE & TEST)

### Step 1: Write the failing test

Create `test/parser-version-caret-filter.test.js`:

```javascript
import { describe, expect, it } from "vitest";
import { MarkdownParser } from "../src/MarkdownParser.js";

const mockFs = (content) => ({
  readFileSync: () => content,
});

describe("MarkdownParser — Version Numbers as False Caret Citations (#37)", () => {
  it("should NOT extract version string ^14.0.1 as caret link", async () => {
    const content = '| Commander.js | ^14.0.1 |';
    const parser = new MarkdownParser(mockFs(content));
    const result = await parser.parseFile("/test/source.md");

    const caretLinks = result.links.filter(l => l.anchorType === "block" && l.fullMatch.startsWith("^"));
    expect(caretLinks.length).toBe(0);
  });

  it("should NOT extract ^2.0 as caret link", async () => {
    const content = '| marked | ^2.0 |';
    const parser = new MarkdownParser(mockFs(content));
    const result = await parser.parseFile("/test/source.md");

    const caretLinks = result.links.filter(l => l.anchorType === "block" && l.fullMatch.startsWith("^"));
    expect(caretLinks.length).toBe(0);
  });

  it("should still extract valid caret reference ^FR1", async () => {
    const content = 'See ^FR1 for details';
    const parser = new MarkdownParser(mockFs(content));
    const result = await parser.parseFile("/test/source.md");

    const caretLinks = result.links.filter(l => l.anchorType === "block" && l.fullMatch === "^FR1");
    expect(caretLinks.length).toBe(1);
    expect(caretLinks[0].target.anchor).toBe("FR1");
  });

  it("should still extract valid caret reference ^US1-1AC1", async () => {
    const content = 'Matches ^US1-1AC1 acceptance criteria';
    const parser = new MarkdownParser(mockFs(content));
    const result = await parser.parseFile("/test/source.md");

    const caretLinks = result.links.filter(l => l.fullMatch === "^US1-1AC1");
    expect(caretLinks.length).toBe(1);
  });

  it("should NOT extract purely numeric caret ^14 from version context", async () => {
    const content = '| lib | ^14.0.1 |';
    const parser = new MarkdownParser(mockFs(content));
    const result = await parser.parseFile("/test/source.md");

    // ^14 should not be extracted because next char in content is '.'
    const caret14 = result.links.filter(l => l.fullMatch === "^14");
    expect(caret14.length).toBe(0);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npx vitest run test/parser-version-caret-filter.test.js --reporter=verbose`
Expected: FAIL — `^14` extracted as caret link from version string.

### Step 3: Write minimal implementation

In `src/MarkdownParser.ts`, modify the caret regex block (line 394-432). After the match, add a post-filter check:

```typescript
// Caret syntax references (internal references)
const caretRegex = /\^([A-Za-z0-9-]+)/g;
match = caretRegex.exec(line);
while (match !== null) {
  const anchor = match[1] ?? "";

  // Filter: skip version numbers (next char is '.' → npm caret range like ^14.0.1)
  const charAfterMatch = line[match.index + match[0].length];
  const isVersionNumber = charAfterMatch === ".";

  // Filter: skip purely numeric matches (^14, ^2) — valid caret refs require letters
  const isPurelyNumeric = /^\d+$/.test(anchor);

  if (!isVersionNumber && !isPurelyNumeric) {
    const linkType = "markdown" as const;
    const scope = "internal" as const;
    const anchorType = "block" as const;

    const caretLinkObject = {
      linkType: linkType,
      scope: scope,
      anchorType: anchorType,
      source: {
        path: {
          absolute: sourceAbsolutePath ?? "",
        },
      },
      target: {
        path: {
          raw: null,
          absolute: null,
          relative: null,
        },
        anchor: anchor,
      },
      text: null,
      fullMatch: match[0],
      line: index + 1,
      column: match.index,
      extractionMarker: this._detectExtractionMarker(
        line,
        match.index + match[0].length,
      ),
    };
    links.push(caretLinkObject);
  }
  match = caretRegex.exec(line);
}
```

### Step 4: Run test to verify it passes

Run: `npx vitest run test/parser-version-caret-filter.test.js --reporter=verbose`
Expected: PASS

### Step 5: Run full regression suite

Run: `npm run test:citation`
Expected: All existing tests pass.

### Step 6: Commit

Use `create-git-commit` skill. Message: `fix(parser): filter version numbers from caret citations (#37)`

---

## Task 3 — Obsidian Invalid Chars (Colons) in Anchors (#1)

**GitHub Issue:** #1
**Risk:** Medium (crosses ParsedDocument.ts)
**Depends on:** Task 1 (#59) — parens must parse correctly first

### Files
- `src/ParsedDocument.ts:51-57` (MODIFY — `hasAnchor()` method)
- `test/parser-obsidian-colon-anchors.test.js` (CREATE & TEST)

### Step 1: Write the failing test

Create `test/parser-obsidian-colon-anchors.test.js`:

```javascript
import { describe, expect, it } from "vitest";
import ParsedDocument from "../src/ParsedDocument.js";

// Helper to create minimal ParserOutput for testing
function createParserOutput(headings, anchors) {
  return {
    filePath: "/test/target.md",
    content: headings.map(h => `${"#".repeat(h.level)} ${h.text}`).join("\n"),
    tokens: [],
    links: [],
    headings: headings,
    anchors: anchors,
  };
}

describe("ParsedDocument.hasAnchor — Obsidian Invalid Chars (#1)", () => {
  it("should match heading with colon when anchor has colon stripped", () => {
    // Heading: "### ADR-006: Title"
    // Obsidian anchor: "#ADR-006%20Title" (colon removed, space→%20)
    const headings = [{ level: 3, text: "ADR-006: Title", raw: "### ADR-006: Title\n" }];
    const anchors = [{
      anchorType: "header",
      id: "ADR-006: Title",
      urlEncodedId: "ADR-006%20Title", // colon removed per extractAnchors
      rawText: "ADR-006: Title",
      fullMatch: "### ADR-006: Title",
      line: 1,
      column: 0,
    }];

    const doc = new ParsedDocument(createParserOutput(headings, anchors));

    // URL-decoded version of Obsidian anchor (colon stripped): "ADR-006 Title"
    expect(doc.hasAnchor("ADR-006%20Title")).toBe(true);
    expect(doc.hasAnchor("ADR-006 Title")).toBe(true);
  });

  it("should match heading with colon using exact id match", () => {
    const headings = [{ level: 3, text: "MEDIUM-IMPLEMENTATION: Patterns", raw: "### MEDIUM-IMPLEMENTATION: Patterns\n" }];
    const anchors = [{
      anchorType: "header",
      id: "MEDIUM-IMPLEMENTATION: Patterns",
      urlEncodedId: "MEDIUM-IMPLEMENTATION%20Patterns",
      rawText: "MEDIUM-IMPLEMENTATION: Patterns",
      fullMatch: "### MEDIUM-IMPLEMENTATION: Patterns",
      line: 1,
      column: 0,
    }];

    const doc = new ParsedDocument(createParserOutput(headings, anchors));

    // Obsidian produces this anchor (colon removed, space encoded)
    expect(doc.hasAnchor("MEDIUM-IMPLEMENTATION%20Patterns")).toBe(true);
    // URL-decoded version
    expect(doc.hasAnchor("MEDIUM-IMPLEMENTATION Patterns")).toBe(true);
  });

  it("should still match anchors without colons (no regression)", () => {
    const headings = [{ level: 2, text: "Simple Heading", raw: "## Simple Heading\n" }];
    const anchors = [{
      anchorType: "header",
      id: "Simple Heading",
      urlEncodedId: "Simple%20Heading",
      rawText: "Simple Heading",
      fullMatch: "## Simple Heading",
      line: 1,
      column: 0,
    }];

    const doc = new ParsedDocument(createParserOutput(headings, anchors));

    expect(doc.hasAnchor("Simple Heading")).toBe(true);
    expect(doc.hasAnchor("Simple%20Heading")).toBe(true);
  });

  it("should match URL-decoded anchor against urlEncodedId after decoding", () => {
    const headings = [{ level: 3, text: "Story 1.5: Cache", raw: "### Story 1.5: Cache\n" }];
    const anchors = [{
      anchorType: "header",
      id: "Story 1.5: Cache",
      urlEncodedId: "Story%201.5%20Cache",
      rawText: "Story 1.5: Cache",
      fullMatch: "### Story 1.5: Cache",
      line: 1,
      column: 0,
    }];

    const doc = new ParsedDocument(createParserOutput(headings, anchors));

    // Obsidian link would be: #Story%201.5%20Cache
    expect(doc.hasAnchor("Story%201.5%20Cache")).toBe(true);
    // Decoded form: "Story 1.5 Cache" (colon removed)
    expect(doc.hasAnchor("Story 1.5 Cache")).toBe(true);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npx vitest run test/parser-obsidian-colon-anchors.test.js --reporter=verbose`
Expected: FAIL — `hasAnchor("ADR-006 Title")` returns `false` because URL-decoded comparison doesn't exist yet.

### Step 3: Write minimal implementation

In `src/ParsedDocument.ts`, enhance `hasAnchor()` to also try URL-decoded comparison:

```typescript
hasAnchor(anchorId: string): boolean {
  // Try decoding the input anchor for comparison
  let decodedAnchorId: string;
  try {
    decodedAnchorId = decodeURIComponent(anchorId);
  } catch {
    decodedAnchorId = anchorId;
  }

  return this._data.anchors.some((a) => {
    // Direct match on id
    if (a.id === anchorId) return true;

    // Match on urlEncodedId (header anchors only)
    if (a.anchorType === "header" && a.urlEncodedId === anchorId) return true;

    // Decoded comparison: strip Obsidian-invalid chars from id and compare
    if (a.anchorType === "header") {
      // Decode the urlEncodedId for comparison
      let decodedUrlEncodedId: string;
      try {
        decodedUrlEncodedId = decodeURIComponent(a.urlEncodedId);
      } catch {
        decodedUrlEncodedId = a.urlEncodedId;
      }
      if (decodedUrlEncodedId === decodedAnchorId) return true;

      // Also try: strip colons from id and compare to decoded anchor
      const idWithoutColons = a.id.replace(/:/g, "").replace(/\s+/g, " ").trim();
      const decodedWithoutColons = decodedAnchorId.replace(/:/g, "").replace(/\s+/g, " ").trim();
      if (idWithoutColons === decodedWithoutColons) return true;
    }

    return false;
  });
}
```

### Step 4: Run test to verify it passes

Run: `npx vitest run test/parser-obsidian-colon-anchors.test.js --reporter=verbose`
Expected: PASS

### Step 5: Run full regression suite

Run: `npm run test:citation`
Expected: All existing tests pass.

### Step 6: Commit

Use `create-git-commit` skill. Message: `fix(parser): match Obsidian anchors with colons stripped (#1)`

---

## Task 4 — Token-First Extraction (#28)

**GitHub Issue:** #28
**Risk:** HIGH (core pipeline rewrite)
**Strategy:** Write characterization tests FIRST. Replace ONE regex at a time, verify all tests pass between each.

### Files
- `src/MarkdownParser.ts:111-436` (MODIFY — `extractLinks()` rewrite)
- `test/parser-token-extraction-characterization.test.js` (CREATE & TEST — characterization tests)
- `test/fixtures/valid-citations.md` (READ — existing fixture)
- `test/fixtures/enhanced-citations.md` (READ — existing fixture)
- `test/fixtures/complex-headers.md` (READ — existing fixture)

### Step 1: Write characterization tests (capture current behavior)

Create `test/parser-token-extraction-characterization.test.js`:

```javascript
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, beforeAll } from "vitest";
import { createMarkdownParser } from "../src/factories/componentFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * CHARACTERIZATION TESTS for Token-First Extraction (#28)
 *
 * These tests capture the EXACT current behavior of extractLinks().
 * They must pass before AND after refactoring.
 * DO NOT modify these tests during the refactor — they ARE the safety net.
 */
describe("extractLinks() — Characterization Tests (#28)", () => {
  let parser;

  beforeAll(() => {
    parser = createMarkdownParser();
  });

  it("should produce exact link count for valid-citations.md", async () => {
    const testFile = join(__dirname, "fixtures", "valid-citations.md");
    const result = await parser.parseFile(testFile);

    // Capture actual count — update this to match actual output when first running
    // This is the characterization: document the current count, then lock it
    expect(result.links.length).toBeGreaterThan(0);

    // Store snapshot of link properties for regression detection
    for (const link of result.links) {
      expect(link).toHaveProperty("linkType");
      expect(link).toHaveProperty("scope");
      expect(link).toHaveProperty("target");
      expect(link).toHaveProperty("line");
      expect(link).toHaveProperty("column");
      expect(link).toHaveProperty("fullMatch");
      expect(link).toHaveProperty("extractionMarker");
    }
  });

  it("should produce exact link count for enhanced-citations.md", async () => {
    const testFile = join(__dirname, "fixtures", "enhanced-citations.md");
    const result = await parser.parseFile(testFile);

    expect(result.links.length).toBeGreaterThan(0);

    // Verify all link types present
    const linkTypes = new Set(result.links.map(l => l.linkType));
    // enhanced-citations should have markdown links at minimum
    expect(linkTypes.has("markdown")).toBe(true);
  });

  it("should preserve cross-document link path resolution", async () => {
    const testFile = join(__dirname, "fixtures", "valid-citations.md");
    const result = await parser.parseFile(testFile);

    const crossDocLinks = result.links.filter(l => l.scope === "cross-document");
    for (const link of crossDocLinks) {
      // Raw path must be non-null for cross-document links
      expect(link.target.path.raw).not.toBeNull();
      // Absolute path must be resolved
      expect(link.target.path.absolute).not.toBeNull();
    }
  });

  it("should preserve internal link properties", async () => {
    const testFile = join(__dirname, "fixtures", "valid-citations.md");
    const result = await parser.parseFile(testFile);

    const internalLinks = result.links.filter(l => l.scope === "internal");
    for (const link of internalLinks) {
      // Internal links have null paths
      expect(link.target.path.raw).toBeNull();
      expect(link.target.path.absolute).toBeNull();
      expect(link.target.path.relative).toBeNull();
    }
  });

  it("should preserve line and column positions", async () => {
    const testFile = join(__dirname, "fixtures", "valid-citations.md");
    const result = await parser.parseFile(testFile);

    for (const link of result.links) {
      expect(typeof link.line).toBe("number");
      expect(link.line).toBeGreaterThan(0); // 1-based
      expect(typeof link.column).toBe("number");
      expect(link.column).toBeGreaterThanOrEqual(0); // 0-based
    }
  });

  it("should preserve extraction marker detection", async () => {
    const testFile = join(__dirname, "fixtures", "valid-citations.md");
    const result = await parser.parseFile(testFile);

    // extractionMarker should be present on all links (null or object)
    for (const link of result.links) {
      expect(link).toHaveProperty("extractionMarker");
      if (link.extractionMarker !== null) {
        expect(link.extractionMarker).toHaveProperty("fullMatch");
        expect(link.extractionMarker).toHaveProperty("innerText");
      }
    }
  });
});
```

### Step 2: Run characterization tests to establish baseline

Run: `npx vitest run test/parser-token-extraction-characterization.test.js --reporter=verbose`
Expected: PASS (captures current behavior).

**IMPORTANT:** After first pass, update the exact link counts in the characterization tests to match actual output. These become the regression baseline.

### Step 3: Implement token-first extraction (incremental)

Rewrite `extractLinks()` in `src/MarkdownParser.ts` to:
1. First: Walk `marked.lexer()` tokens for standard markdown links (`type: "link"`)
2. Then: Keep regex ONLY for wiki-links, caret syntax, and cite-format
3. Replace ONE regex at a time, running characterization tests between each

**Phase 3a: Add token walking for standard links:**

```typescript
extractLinks(content: string, sourcePath: string): LinkObject[] {
  const links: LinkObject[] = [];
  const lines = content.split("\n");
  const sourceAbsolutePath = sourcePath;

  // Phase 1: Token-based extraction for standard markdown links
  const tokens = marked.lexer(content);
  this._extractLinksFromTokens(tokens, lines, sourceAbsolutePath, links);

  // Phase 2: Regex extraction for non-CommonMark patterns
  lines.forEach((line, index) => {
    // Citation format: [cite: path] — NOT in CommonMark
    this._extractCiteLinks(line, index, sourceAbsolutePath, links);

    // Wiki-style cross-document links: [[file.md#anchor|text]] — NOT in CommonMark
    this._extractWikiCrossDocLinks(line, index, sourceAbsolutePath, links);

    // Wiki-style internal links: [[#anchor|text]] — NOT in CommonMark
    this._extractWikiInternalLinks(line, index, sourceAbsolutePath, links);

    // Caret syntax references: ^anchor-id — NOT in CommonMark
    this._extractCaretLinks(line, index, sourceAbsolutePath, links);
  });

  return links;
}

/**
 * Walk marked.js tokens recursively to extract standard markdown links.
 * Handles: [text](file.md#anchor), [text](#anchor), [text](path/to/file)
 */
private _extractLinksFromTokens(
  tokens: Token[],
  lines: string[],
  sourceAbsolutePath: string,
  links: LinkObject[]
): void {
  const walkTokens = (tokenList: Token[]) => {
    for (const token of tokenList) {
      if (token.type === "link") {
        const href = (token as any).href || "";
        const text = (token as any).text || "";
        const raw = (token as any).raw || "";

        // Skip external links (http/https)
        if (href.startsWith("http://") || href.startsWith("https://")) continue;

        // Determine scope and parse anchor
        const isInternal = href.startsWith("#");
        const scope = isInternal ? "internal" as const : "cross-document" as const;

        let rawPath: string | null = null;
        let anchor: string | null = null;

        if (isInternal) {
          anchor = href.substring(1); // Remove leading #
        } else {
          const hashIndex = href.indexOf("#");
          if (hashIndex !== -1) {
            rawPath = href.substring(0, hashIndex);
            anchor = href.substring(hashIndex + 1);
          } else {
            rawPath = href;
          }
        }

        // Resolve paths for cross-document links
        const absolutePath = rawPath ? this.resolvePath(rawPath, sourceAbsolutePath) : null;
        const relativePath = absolutePath && sourceAbsolutePath
          ? relative(dirname(sourceAbsolutePath), absolutePath)
          : null;

        const anchorType = anchor ? this.determineAnchorType(anchor) : null;

        // Find line/column from raw match in content
        const { line: lineNum, column } = this._findPosition(raw, lines);

        const linkObject: LinkObject = {
          linkType: "markdown" as const,
          scope,
          anchorType,
          source: { path: { absolute: sourceAbsolutePath } },
          target: {
            path: {
              raw: rawPath,
              absolute: absolutePath,
              relative: relativePath,
            },
            anchor,
          },
          text,
          fullMatch: raw,
          line: lineNum,
          column,
          extractionMarker: lineNum > 0
            ? this._detectExtractionMarker(lines[lineNum - 1] || "", column + raw.length)
            : null,
        };
        links.push(linkObject);
      }

      // Recurse into nested tokens
      if (hasNestedTokens(token)) {
        walkTokens(token.tokens);
      }
      // Also check items (list items have items property)
      if ("items" in token && Array.isArray((token as any).items)) {
        for (const item of (token as any).items) {
          if (hasNestedTokens(item)) {
            walkTokens(item.tokens);
          }
        }
      }
    }
  };
  walkTokens(tokens);
}

/**
 * Find line number and column for a raw match string in content lines.
 * Returns 1-based line, 0-based column.
 */
private _findPosition(raw: string, lines: string[]): { line: number; column: number } {
  for (let i = 0; i < lines.length; i++) {
    const col = lines[i].indexOf(raw);
    if (col !== -1) {
      return { line: i + 1, column: col };
    }
  }
  return { line: 0, column: 0 };
}
```

**Phase 3b: Extract remaining regex patterns into private methods:**

Each of these methods encapsulates one regex pattern that is NOT in CommonMark:

```typescript
private _extractCiteLinks(line: string, index: number, sourceAbsolutePath: string, links: LinkObject[]): void {
  const citePattern = /\[cite:\s*([^\]]+)\]/g;
  let match = citePattern.exec(line);
  while (match !== null) {
    const rawPath = (match[1] ?? "").trim();
    const absolutePath = this.resolvePath(rawPath, sourceAbsolutePath ?? "");
    const relativePath = absolutePath && sourceAbsolutePath
      ? relative(dirname(sourceAbsolutePath), absolutePath)
      : null;
    links.push({
      linkType: "markdown",
      scope: "cross-document",
      anchorType: null,
      source: { path: { absolute: sourceAbsolutePath } },
      target: { path: { raw: rawPath, absolute: absolutePath, relative: relativePath }, anchor: null },
      text: `cite: ${rawPath}`,
      fullMatch: match[0],
      line: index + 1,
      column: match.index,
      extractionMarker: this._detectExtractionMarker(line, match.index + match[0].length),
    });
    match = citePattern.exec(line);
  }
}

private _extractWikiCrossDocLinks(line: string, index: number, sourceAbsolutePath: string, links: LinkObject[]): void {
  const wikiCrossDocRegex = /\[\[([^#\]]+\.md)(#([^\]|]+))?\|([^\]]+)\]\]/g;
  let match = wikiCrossDocRegex.exec(line);
  while (match !== null) {
    const rawPath = match[1] ?? "";
    const anchor = match[3] ?? null;
    const text = match[4] ?? "";
    const absolutePath = this.resolvePath(rawPath, sourceAbsolutePath ?? "");
    const relativePath = absolutePath && sourceAbsolutePath
      ? relative(dirname(sourceAbsolutePath), absolutePath)
      : null;
    links.push({
      linkType: "wiki",
      scope: "cross-document",
      anchorType: anchor ? this.determineAnchorType(anchor) : null,
      source: { path: { absolute: sourceAbsolutePath } },
      target: { path: { raw: rawPath, absolute: absolutePath, relative: relativePath }, anchor },
      text,
      fullMatch: match[0],
      line: index + 1,
      column: match.index,
      extractionMarker: this._detectExtractionMarker(line, match.index + match[0].length),
    });
    match = wikiCrossDocRegex.exec(line);
  }
}

private _extractWikiInternalLinks(line: string, index: number, sourceAbsolutePath: string, links: LinkObject[]): void {
  const wikiRegex = /\[\[#([^|]+)\|([^\]]+)\]\]/g;
  let match = wikiRegex.exec(line);
  while (match !== null) {
    const anchor = match[1] ?? "";
    const text = match[2] ?? "";
    links.push({
      linkType: "wiki",
      scope: "internal",
      anchorType: this.determineAnchorType(anchor),
      source: { path: { absolute: sourceAbsolutePath ?? "" } },
      target: { path: { raw: null, absolute: null, relative: null }, anchor },
      text,
      fullMatch: match[0],
      line: index + 1,
      column: match.index,
      extractionMarker: this._detectExtractionMarker(line, match.index + match[0].length),
    });
    match = wikiRegex.exec(line);
  }
}

private _extractCaretLinks(line: string, index: number, sourceAbsolutePath: string, links: LinkObject[]): void {
  const caretRegex = /\^([A-Za-z0-9-]+)/g;
  let match = caretRegex.exec(line);
  while (match !== null) {
    const anchor = match[1] ?? "";
    // Filter version numbers (from Task 2 / #37)
    const charAfterMatch = line[match.index + match[0].length];
    const isVersionNumber = charAfterMatch === ".";
    const isPurelyNumeric = /^\d+$/.test(anchor);

    if (!isVersionNumber && !isPurelyNumeric) {
      links.push({
        linkType: "markdown",
        scope: "internal",
        anchorType: "block",
        source: { path: { absolute: sourceAbsolutePath ?? "" } },
        target: { path: { raw: null, absolute: null, relative: null }, anchor },
        text: null,
        fullMatch: match[0],
        line: index + 1,
        column: match.index,
        extractionMarker: this._detectExtractionMarker(line, match.index + match[0].length),
      });
    }
    match = caretRegex.exec(line);
  }
}
```

### Step 4: Run characterization tests

Run: `npx vitest run test/parser-token-extraction-characterization.test.js --reporter=verbose`
Expected: PASS — same behavior as before refactor.

### Step 5: Run full regression suite

Run: `npm run test:citation`
Expected: All existing tests pass.

### Step 6: Commit

Use `create-git-commit` skill. Message: `refactor(parser): token-first link extraction replacing regex (#28)`

---

## Task 5 — Link Factory Function (#30)

**GitHub Issue:** #30
**Risk:** Low (pure refactoring)
**Depends on:** Task 4 (#28) — link construction code may have changed

### Files
- `src/MarkdownParser.ts` (MODIFY — extract `_createLinkObject()` factory)
- `test/parser-link-factory.test.js` (CREATE & TEST)

### Step 1: Write the failing test

Create `test/parser-link-factory.test.js`:

```javascript
import { describe, expect, it } from "vitest";
import { MarkdownParser } from "../src/MarkdownParser.js";

const mockFs = { readFileSync: () => "" };

describe("MarkdownParser._createLinkObject() — Factory Function (#30)", () => {
  it("should create cross-document link object with correct shape", () => {
    const parser = new MarkdownParser(mockFs);

    // Access private method for testing (TypeScript allows this in test context)
    const link = parser._createLinkObject({
      linkType: "markdown",
      scope: "cross-document",
      anchor: "test-anchor",
      rawPath: "file.md",
      sourceAbsolutePath: "/source/doc.md",
      text: "Link Text",
      fullMatch: "[Link Text](file.md#test-anchor)",
      line: 5,
      column: 10,
      extractionMarker: null,
    });

    expect(link.linkType).toBe("markdown");
    expect(link.scope).toBe("cross-document");
    expect(link.anchorType).toBe("header");
    expect(link.target.anchor).toBe("test-anchor");
    expect(link.target.path.raw).toBe("file.md");
    expect(link.target.path.absolute).not.toBeNull();
    expect(link.text).toBe("Link Text");
    expect(link.line).toBe(5);
    expect(link.column).toBe(10);
  });

  it("should create internal link object with null paths", () => {
    const parser = new MarkdownParser(mockFs);

    const link = parser._createLinkObject({
      linkType: "wiki",
      scope: "internal",
      anchor: "my-anchor",
      rawPath: null,
      sourceAbsolutePath: "/source/doc.md",
      text: "Internal",
      fullMatch: "[[#my-anchor|Internal]]",
      line: 3,
      column: 0,
      extractionMarker: null,
    });

    expect(link.scope).toBe("internal");
    expect(link.target.path.raw).toBeNull();
    expect(link.target.path.absolute).toBeNull();
    expect(link.target.path.relative).toBeNull();
    expect(link.target.anchor).toBe("my-anchor");
  });

  it("should handle null anchor (link without fragment)", () => {
    const parser = new MarkdownParser(mockFs);

    const link = parser._createLinkObject({
      linkType: "markdown",
      scope: "cross-document",
      anchor: null,
      rawPath: "target.md",
      sourceAbsolutePath: "/source/doc.md",
      text: "No Anchor",
      fullMatch: "[No Anchor](target.md)",
      line: 1,
      column: 0,
      extractionMarker: null,
    });

    expect(link.anchorType).toBeNull();
    expect(link.target.anchor).toBeNull();
  });
});
```

### Step 2: Run test to verify it fails

Run: `npx vitest run test/parser-link-factory.test.js --reporter=verbose`
Expected: FAIL — `_createLinkObject` method doesn't exist yet.

### Step 3: Write minimal implementation

Add to `src/MarkdownParser.ts`:

```typescript
/**
 * Factory function for creating LinkObject instances.
 * Single source of truth for link object construction.
 * Handles path resolution, anchor type classification, and structure.
 */
_createLinkObject(params: {
  linkType: "markdown" | "wiki";
  scope: "internal" | "cross-document";
  anchor: string | null;
  rawPath: string | null;
  sourceAbsolutePath: string;
  text: string | null;
  fullMatch: string;
  line: number;
  column: number;
  extractionMarker: { fullMatch: string; innerText: string } | null;
}): LinkObject {
  const anchorType = params.anchor ? this.determineAnchorType(params.anchor) : null;

  const absolutePath = params.rawPath
    ? this.resolvePath(params.rawPath, params.sourceAbsolutePath)
    : null;
  const relativePath = absolutePath && params.sourceAbsolutePath
    ? relative(dirname(params.sourceAbsolutePath), absolutePath)
    : null;

  return {
    linkType: params.linkType,
    scope: params.scope,
    anchorType,
    source: { path: { absolute: params.sourceAbsolutePath } },
    target: {
      path: {
        raw: params.rawPath,
        absolute: absolutePath,
        relative: relativePath,
      },
      anchor: params.anchor,
    },
    text: params.text,
    fullMatch: params.fullMatch,
    line: params.line,
    column: params.column,
    extractionMarker: params.extractionMarker,
  };
}
```

Then update all callers in `extractLinks()` and the private `_extract*Links()` methods to use `this._createLinkObject(...)` instead of inline construction.

### Step 4: Run test to verify it passes

Run: `npx vitest run test/parser-link-factory.test.js --reporter=verbose`
Expected: PASS

### Step 5: Run full regression suite

Run: `npm run test:citation`
Expected: All existing tests pass (behavior unchanged).

### Step 6: Commit

Use `create-git-commit` skill. Message: `refactor(parser): extract createLinkObject factory function (#30)`

---

## Task 6 — Header Anchor Redundancy (#29)

**GitHub Issue:** #29
**Risk:** Low-Medium
**Depends on:** Task 4 (#28) — token reuse pattern established

### Files
- `src/MarkdownParser.ts:544` (MODIFY — `extractAnchors()` to accept headings param)
- `src/MarkdownParser.ts:78-90` (MODIFY — `parseFile()` to pass headings)
- `test/parser-heading-anchor-derivation.test.js` (CREATE & TEST)

### Step 1: Write the failing characterization test

Create `test/parser-heading-anchor-derivation.test.js`:

```javascript
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, beforeAll } from "vitest";
import { createMarkdownParser } from "../src/factories/componentFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("extractAnchors — Header Anchor Derivation (#29)", () => {
  let parser;

  beforeAll(() => {
    parser = createMarkdownParser();
  });

  it("should produce identical header anchors when derived from headings vs regex", async () => {
    const testFile = join(__dirname, "fixtures", "complex-headers.md");

    // Get current output (baseline)
    const result = await parser.parseFile(testFile);

    // Filter to header anchors only
    const headerAnchors = result.anchors.filter(a => a.anchorType === "header");

    // Each heading should produce exactly one header anchor
    expect(headerAnchors.length).toBe(result.headings.length);

    // Each heading text should appear as anchor id
    for (const heading of result.headings) {
      const matchingAnchor = headerAnchors.find(a => a.id === heading.text);
      expect(matchingAnchor).toBeDefined();
      expect(matchingAnchor.rawText).toBe(heading.text);
    }
  });

  it("should preserve urlEncodedId generation from headings", async () => {
    const testFile = join(__dirname, "fixtures", "complex-headers.md");
    const result = await parser.parseFile(testFile);

    const headerAnchors = result.anchors.filter(a => a.anchorType === "header");

    for (const anchor of headerAnchors) {
      expect(anchor).toHaveProperty("urlEncodedId");
      expect(typeof anchor.urlEncodedId).toBe("string");
      // urlEncodedId should have colons removed and spaces as %20
      expect(anchor.urlEncodedId).not.toContain(":");
    }
  });

  it("should preserve block anchors unchanged (not derived from headings)", async () => {
    const testFile = join(__dirname, "fixtures", "complex-headers.md");
    const result = await parser.parseFile(testFile);

    const blockAnchors = result.anchors.filter(a => a.anchorType === "block");

    for (const anchor of blockAnchors) {
      expect(anchor).not.toHaveProperty("urlEncodedId");
      expect(anchor.rawText).toBeNull();
    }
  });
});
```

### Step 2: Run test to verify baseline passes

Run: `npx vitest run test/parser-heading-anchor-derivation.test.js --reporter=verbose`
Expected: PASS (characterization of current behavior).

### Step 3: Refactor extractAnchors to accept headings

In `src/MarkdownParser.ts`:

**Update `parseFile()` to pass headings:**

```typescript
async parseFile(filePath: string): Promise<ParserOutput> {
  const content = this.fs.readFileSync(filePath, "utf8");
  const tokens = marked.lexer(content);
  const headings = this.extractHeadings(tokens);

  return {
    filePath,
    content,
    tokens,
    links: this.extractLinks(content, filePath),
    headings,
    anchors: this.extractAnchors(content, headings),
  };
}
```

**Update `extractAnchors()` signature and derive header anchors from headings:**

```typescript
extractAnchors(content: string, headings?: HeadingObject[]): AnchorObject[] {
  const anchors: AnchorObject[] = [];
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    // Obsidian block references (unchanged)
    // ... existing block ref code ...

    // Caret syntax anchors (unchanged)
    // ... existing caret code ...

    // Emphasis-marked anchors (unchanged)
    // ... existing emphasis code ...

    // REMOVED: Header regex scanning — now derived from headings parameter below
  });

  // Derive header anchors from headings array (if provided)
  if (headings) {
    // Find line numbers for each heading in content
    for (const heading of headings) {
      const lineIndex = lines.findIndex(l => {
        const headerRegex = /^(#+)\s+(.+)$/;
        const match = l.match(headerRegex);
        return match && match[2] === heading.text && match[1].length === heading.level;
      });

      if (lineIndex === -1) continue;
      const line = lines[lineIndex];

      // Check for explicit anchor ID
      const explicitAnchorRegex = /^(.+?)\s*\{#([^}]+)\}$/;
      const explicitMatch = heading.text.match(explicitAnchorRegex);

      if (explicitMatch) {
        const explicitId = explicitMatch[2] ?? "";
        anchors.push({
          anchorType: "header",
          id: explicitId,
          urlEncodedId: explicitId,
          rawText: (explicitMatch[1] ?? "").trim(),
          fullMatch: line,
          line: lineIndex + 1,
          column: 0,
        });
      } else {
        const urlEncodedId = heading.text
          .replace(/:/g, "")
          .replace(/\s+/g, "%20");

        anchors.push({
          anchorType: "header",
          id: heading.text,
          urlEncodedId,
          rawText: heading.text,
          fullMatch: line,
          line: lineIndex + 1,
          column: 0,
        });
      }
    }
  }

  return anchors;
}
```

### Step 4: Run test to verify it passes

Run: `npx vitest run test/parser-heading-anchor-derivation.test.js --reporter=verbose`
Expected: PASS

### Step 5: Run full regression suite

Run: `npm run test:citation`
Expected: All existing tests pass.

### Step 6: Commit

Use `create-git-commit` skill. Message: `refactor(parser): derive header anchors from headings array (#29)`

---

## Task 7 — Internal Link Extraction (#33)

**GitHub Issue:** #33
**Risk:** Low (primarily verification)
**Depends on:** Task 4 (#28) — token-first integration

### Files
- `src/MarkdownParser.ts` (VERIFY/MODIFY — internal links via tokens)
- `test/parser-internal-links.test.js` (CREATE & TEST)

### Step 1: Write edge case tests

Create `test/parser-internal-links.test.js`:

```javascript
import { describe, expect, it } from "vitest";
import { MarkdownParser } from "../src/MarkdownParser.js";

const mockFs = (content) => ({
  readFileSync: () => content,
});

describe("MarkdownParser — Internal Link Extraction (#33)", () => {
  it("should extract standard markdown internal link [text](#anchor)", async () => {
    const content = 'See [this section](#overview) for details';
    const parser = new MarkdownParser(mockFs(content));
    const result = await parser.parseFile("/test/source.md");

    const internalLinks = result.links.filter(l => l.scope === "internal" && l.linkType === "markdown");
    expect(internalLinks.length).toBe(1);
    expect(internalLinks[0].target.anchor).toBe("overview");
    expect(internalLinks[0].text).toBe("this section");
    expect(internalLinks[0].anchorType).toBe("header");
  });

  it("should extract internal link with special characters in anchor", async () => {
    const content = '[Jump](#ADR-006%20Decision)';
    const parser = new MarkdownParser(mockFs(content));
    const result = await parser.parseFile("/test/source.md");

    const link = result.links.find(l => l.scope === "internal");
    expect(link).toBeDefined();
    expect(link.target.anchor).toBe("ADR-006%20Decision");
  });

  it("should extract internal link with URL-encoded spaces", async () => {
    const content = '[Go](#My%20Section%20Name)';
    const parser = new MarkdownParser(mockFs(content));
    const result = await parser.parseFile("/test/source.md");

    const link = result.links.find(l => l.scope === "internal");
    expect(link).toBeDefined();
    expect(link.target.anchor).toBe("My%20Section%20Name");
  });

  it("should set null paths for internal links", async () => {
    const content = '[Internal](#target)';
    const parser = new MarkdownParser(mockFs(content));
    const result = await parser.parseFile("/test/source.md");

    const link = result.links.find(l => l.scope === "internal");
    expect(link.target.path.raw).toBeNull();
    expect(link.target.path.absolute).toBeNull();
    expect(link.target.path.relative).toBeNull();
  });

  it("should classify block anchors correctly for internal links", async () => {
    const content = '[Block ref](#^block-id)';
    const parser = new MarkdownParser(mockFs(content));
    const result = await parser.parseFile("/test/source.md");

    const link = result.links.find(l => l.scope === "internal");
    expect(link).toBeDefined();
    expect(link.anchorType).toBe("block");
  });

  it("should handle multiple internal links on same line", async () => {
    const content = 'See [A](#first) and [B](#second) sections';
    const parser = new MarkdownParser(mockFs(content));
    const result = await parser.parseFile("/test/source.md");

    const internalLinks = result.links.filter(l => l.scope === "internal");
    expect(internalLinks.length).toBe(2);
    expect(internalLinks.map(l => l.target.anchor).sort()).toEqual(["first", "second"]);
  });

  it("should not extract external http links as internal", async () => {
    const content = '[External](https://example.com#hash)';
    const parser = new MarkdownParser(mockFs(content));
    const result = await parser.parseFile("/test/source.md");

    const internalLinks = result.links.filter(l => l.scope === "internal");
    expect(internalLinks.length).toBe(0);
  });
});
```

### Step 2: Run test to identify gaps

Run: `npx vitest run test/parser-internal-links.test.js --reporter=verbose`
Expected: Some tests may PASS (if token-first extraction from Task 4 handles these), some may FAIL (edge cases).

### Step 3: Fix any failing edge cases

If any tests fail after Task 4's token-first extraction, add handling in `_extractLinksFromTokens()`. The token walker should already handle `[text](#anchor)` since `marked.lexer()` parses these as `type: "link"` with `href: "#anchor"`.

### Step 4: Run test to verify all pass

Run: `npx vitest run test/parser-internal-links.test.js --reporter=verbose`
Expected: PASS

### Step 5: Run full regression suite

Run: `npm run test:citation`
Expected: All tests pass.

### Step 6: Commit

Use `create-git-commit` skill. Message: `feat(parser): verify internal link extraction via tokens (#33)`

---

## Task 8 — Monolith Breakup (#18)

**GitHub Issue:** #18
**Risk:** Medium (import path changes)
**Depends on:** ALL Tasks 1-7

### Files
- `src/core/MarkdownParser/MarkdownParser.ts` (CREATE — thin orchestrator)
- `src/core/MarkdownParser/extractLinks.ts` (CREATE — link extraction)
- `src/core/MarkdownParser/extractHeadings.ts` (CREATE — heading extraction)
- `src/core/MarkdownParser/extractAnchors.ts` (CREATE — anchor extraction)
- `src/core/MarkdownParser/createLinkObject.ts` (CREATE — factory from Task 5)
- `src/core/MarkdownParser/detectExtractionMarker.ts` (CREATE — marker detection)
- `src/core/MarkdownParser/determineAnchorType.ts` (CREATE — anchor classification)
- `src/core/MarkdownParser/resolvePath.ts` (CREATE — path resolution)
- `src/core/MarkdownParser/index.ts` (CREATE — barrel export)
- `src/MarkdownParser.ts` (DELETE after split)
- `src/factories/componentFactory.ts:22` (MODIFY — import path)
- `test/**/*.test.js` (MODIFY — update imports if directly importing MarkdownParser)

### Step 1: No new tests needed — existing 22+ tests ARE the contract

Run: `npm run test:citation`
Expected: PASS (baseline before structural changes).

### Step 2: Create directory structure

```bash
mkdir -p src/core/MarkdownParser
```

### Step 3: Move methods one at a time

**Order:** utilities first, then extraction methods, then orchestrator.

**3a: `resolvePath.ts`**

```typescript
// src/core/MarkdownParser/resolvePath.ts
import { dirname, isAbsolute, resolve } from "node:path";

export function resolvePath(rawPath: string, sourceAbsolutePath: string): string | null {
  if (!rawPath || !sourceAbsolutePath) return null;
  if (isAbsolute(rawPath)) return rawPath;
  const sourceDir = dirname(sourceAbsolutePath);
  return resolve(sourceDir, rawPath);
}
```

**3b: `determineAnchorType.ts`**

```typescript
// src/core/MarkdownParser/determineAnchorType.ts
export function determineAnchorType(anchorString: string): 'header' | 'block' | null {
  if (!anchorString) return null;
  if (anchorString.startsWith("^") || /^\^[a-zA-Z0-9\-_]+$/.test(anchorString)) return "block";
  return "header";
}
```

**3c: `detectExtractionMarker.ts`**

```typescript
// src/core/MarkdownParser/detectExtractionMarker.ts
export function detectExtractionMarker(
  line: string,
  linkEndColumn: number
): { fullMatch: string; innerText: string } | null {
  const remainingLine = line.substring(linkEndColumn);
  const markerPattern = /\s*(%%(.+?)%%|<!--\s*(.+?)\s*-->)/;
  const match = remainingLine.match(markerPattern);
  if (match) {
    return {
      fullMatch: match[1] ?? "",
      innerText: (match[2] ?? match[3] ?? "").trim(),
    };
  }
  return null;
}
```

**3d-3f: `createLinkObject.ts`, `extractLinks.ts`, `extractAnchors.ts`, `extractHeadings.ts`**
Move the corresponding methods, importing shared utilities.

**3g: `MarkdownParser.ts` (orchestrator)**

```typescript
// src/core/MarkdownParser/MarkdownParser.ts
import type { readFileSync } from "node:fs";
import { marked } from "marked";
import type { Token } from "marked";
import type { ParserOutput } from "../../types/citationTypes.js";
import { extractLinks } from "./extractLinks.js";
import { extractHeadings } from "./extractHeadings.js";
import { extractAnchors } from "./extractAnchors.js";

interface FileSystemInterface {
  readFileSync: typeof readFileSync;
}

export class MarkdownParser {
  private fs: FileSystemInterface;

  constructor(fileSystem: FileSystemInterface) {
    this.fs = fileSystem;
  }

  async parseFile(filePath: string): Promise<ParserOutput> {
    const content = this.fs.readFileSync(filePath, "utf8");
    const tokens = marked.lexer(content);
    const headings = extractHeadings(tokens);

    return {
      filePath,
      content,
      tokens,
      links: extractLinks(content, filePath),
      headings,
      anchors: extractAnchors(content, headings),
    };
  }
}
```

**3h: `index.ts` (barrel export)**

```typescript
// src/core/MarkdownParser/index.ts
export { MarkdownParser } from "./MarkdownParser.js";
```

### Step 4: Update import in componentFactory

In `src/factories/componentFactory.ts` line 22:

```typescript
// OLD: import { MarkdownParser } from "../MarkdownParser.js";
// NEW:
import { MarkdownParser } from "../core/MarkdownParser/index.js";
```

### Step 5: Update test imports

Search all test files importing from `../src/MarkdownParser.js` and update to `../src/core/MarkdownParser/index.js`.

### Step 6: Run full test suite

Run: `npm run test:citation`
Expected: All tests pass.

### Step 7: Build and verify CLI

Run: `npm run build -w tools/citation-manager`
Expected: Build succeeds.

### Step 8: Delete old monolith

Remove `src/MarkdownParser.ts` (now empty — all code moved to `src/core/MarkdownParser/`).

### Step 9: Final verification

Run: `npm run test:citation && npm run test:integration`
Expected: All tests pass.

### Step 10: Commit

Use `create-git-commit` skill. Message: `refactor(parser): split monolith into action-based files (#18)`

---

## Verification (after all tasks)

```bash
npm run build -w tools/citation-manager
npm run test:citation
npm run test:integration
citation-manager validate tools/citation-manager/design-docs/component-guides/Markdown\ Parser\ Implementation\ Guide.md
```
