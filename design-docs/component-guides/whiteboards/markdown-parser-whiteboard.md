
---
<!-- markdownlint-disable -->
# Whiteboard

## MarkdownParser.ParserOutput: How Tokens, Links, and Anchors Are Populated

**Key Question**: How does the MarkdownParser.ParserOutput get its data? Which code is responsible for each array?

**Answer**: MarkdownParser uses a **two-layer parsing approach** - standard markdown parsing via marked.js, plus custom regex extraction for Obsidian-specific syntax.

### Layer 1: Standard Markdown Parsing (marked.js)

**Code Location**: `MarkdownParser.parseFile()` lines 23-36

```javascript
async parseFile(filePath) {
  this.currentSourcePath = filePath;
  const content = this.fs.readFileSync(filePath, "utf8");
  const tokens = marked.lexer(content);  // ← marked.js creates tokens array

  return {
    filePath,
    content,
    tokens,        // ← From marked.js (standard markdown AST)
    links: this.extractLinks(content),     // ← Custom extraction (see Layer 2)
    headings: this.extractHeadings(tokens), // ← Walks tokens array
    anchors: this.extractAnchors(content)  // ← Custom extraction (see Layer 2)
  };
}
```

**What `marked.lexer(content)` creates**:
- Hierarchical token tree for standard markdown elements
- Token types: `heading`, `paragraph`, `list`, `list_item`, `blockquote`, `code`, etc.
- Each token has: `type`, `raw`, `text`, and often nested `tokens` array
- **Does NOT parse** Obsidian-specific syntax like `^anchor-id` or `[[wikilinks]]`

**Tokens used by**:
- `extractHeadings()` - Walks tokens recursively to extract heading metadata
- Epic 2 Section Extraction POC - Walks tokens to find section boundaries
- Future ContentExtractor component

### Layer 2: Custom Regex Parsing (Obsidian Extensions)

#### Links Array Population

**Code Location**: `extractLinks(content)` lines 38-291

**Method**: Line-by-line regex parsing on raw content string

**Link patterns extracted**:
1. **Cross-document markdown links**: `[text](file.md#anchor)` (line 45)
2. **Citation format**: `[cite: path]` (line 87)
3. **Relative path links**: `[text](path/to/file#anchor)` (line 128)
4. **Wiki-style cross-document**: `[[file.md#anchor|text]]` (line 177)
5. **Wiki-style internal**: `[[#anchor|text]]` (line 219)
6. **Caret syntax references**: `^anchor-id` (line 255)

**Output**: LinkObject schema with:

```javascript
{
  linkType: "markdown" | "wiki",
  scope: "cross-document" | "internal",
  anchorType: "header" | "block" | null,
  source: { path: { absolute } },
  target: {
    path: { raw, absolute, relative },
    anchor: string | null
  },
  text: string,
  fullMatch: string,
  line: number,
  column: number
}
```

#### Anchors Array Population

**Code Location**: `extractAnchors(content)` lines 345-450

**Method**: Line-by-line regex parsing on raw content string

**Anchor patterns extracted**:

1. **Obsidian block references** (lines 350-363):
   - Pattern: `^anchor-id` at END of line
   - Example: `Some content ^my-anchor`
   - Regex: `/\^([a-zA-Z0-9\-_]+)$/`

2. **Caret syntax** (lines 365-382):
   - Pattern: `^anchor-id` anywhere in line (legacy)
   - Regex: `/\^([A-Za-z0-9-]+)/g`

3. **Emphasis-marked anchors** (lines 384-397):
   - Pattern: `==**text**==`
   - Creates anchor with ID `==**text**==`
   - Regex: `/==\*\*([^*]+)\*\*==/g`

4. **Header anchors** (lines 399-446):
   - Pattern: `# Heading` or `# Heading {#custom-id}`
   - Uses raw heading text as anchor ID
   - Also creates Obsidian-compatible anchor (removes colons, URL-encodes spaces)
   - Regex: `/^(#+)\s+(.+)$/`

**Output**: AnchorObject schema with:

```javascript
{
  anchorType: "block" | "header",
  id: string,           // Raw text format (e.g., "Story 1.5: Implement Cache")
  urlEncodedId: string, // Obsidian-compatible format (e.g., "Story%201.5%20Implement%20Cache")
                        // Always populated for headers, omitted for blocks (US1.6)
  rawText: string | null, // Text content (for headers/emphasis)
  fullMatch: string,    // Full matched pattern
  line: number,         // 1-based line number
  column: number        // 0-based column position
}
```

### Why Two Layers?

**marked.js handles**:
- ✅ Standard markdown syntax (CommonMark spec)
- ✅ Hierarchical token tree structure
- ✅ Performance-optimized parsing

**Custom regex handles**:
- ✅ Obsidian-specific extensions (`^anchor-id`, `[[wikilinks]]`)
- ✅ Citation manager custom syntax (`[cite: path]`)
- ✅ Line/column position metadata for error reporting
- ✅ Path resolution (absolute/relative) via filesystem

### Epic 2 Content Extraction: Which Layer?

**Section Extraction** (headings):
- Uses **Layer 1** (tokens array)
- Algorithm: Walk tokens to find heading, collect tokens until next same-or-higher level
- POC: `tools/citation-manager/test/poc-section-extraction.test.js`

**Block Extraction** (`^anchor-id`):
- Uses **Layer 2** (anchors array)
- Algorithm: Find anchor by ID, use `line` number to extract content from raw string
- POC: `tools/citation-manager/test/poc-block-extraction.test.js`

**Full File Extraction**:
- Uses **both layers** (content string + metadata from tokens/anchors)
- Algorithm: Return entire `content` field with metadata from parser output

### Viewing MarkdownParser.ParserOutput

To see the complete JSON structure for any file:

```bash
npm run citation:ast <file-path> 2>/dev/null | npx @biomejs/biome format --stdin-file-path=output.json
```

Example output saved at: `tools/citation-manager/design-docs/features/20251003-content-aggregation/prd-parser-output-contract.json`

**Structure**:

```json
{
  "filePath": "/absolute/path/to/file.md",
  "content": "# Full markdown content as string...",
  "tokens": [
    {
      "type": "heading",
      "depth": 1,
      "text": "Citation Manager",
      "raw": "# Citation Manager\n\n",
      "tokens": [...]
    },
    // ... more tokens
  ],
  "links": [
    {
      "linkType": "markdown",
      "scope": "cross-document",
      "anchorType": "header",
      "source": { "path": { "absolute": "..." } },
      "target": {
        "path": { "raw": "guide.md", "absolute": "...", "relative": "..." },
        "anchor": "Installation"
      },
      // ... more fields
    }
    // ... more links
  ],
  "headings": [
    { "level": 1, "text": "Citation Manager", "raw": "# Citation Manager\n\n" }
    // ... more headings
  ],
  "anchors": [
    {
      "anchorType": "block",
      "id": "FR2",
      "rawText": null,
      "fullMatch": "^FR2",
      "line": 64,
      "column": 103
    },
    {
      "anchorType": "header",
      "id": "Requirements",
      "rawText": "Requirements",
      "fullMatch": "## Requirements",
      "line": 61,
      "column": 0
    }
    // ... more anchors
  ]
}
```

**Research Date**: 2025-10-07
**POC Validation**: Section extraction (7/7 tests) + Block extraction (9/9 tests) = 100% success rate
**Epic 2 Readiness**: ContentExtractor implementation can proceed with validated data contracts

---

# Markdownlint Approach

Markdownlint does not primarily rely on whole-file regex or naive line-by-line scans; it parses Markdown once into a structured token stream and a lines array, then runs rules over those structures. Regex is used selectively for small, local checks, while most logic is token-based and linear-time over the parsed representation.

## Parsing model
- The core parse is done once per file/string and produces a micromark token stream plus an array of raw lines, which are then shared with every rule.
- Built-in rules operate on micromark tokens; custom rules can choose micromark, markdown-it, or a text-only mode if they really want to work directly on lines.
- Front matter is stripped via a start-of-file match and HTML comments are interpreted for inline enable/disable, reducing the effective content that rules must consider.

## How rules match
- A rule’s function receives both tokens and the original lines and typically iterates tokens to identify semantic structures like headings, lists, links, and code fences.
- For formatting checks that are inherently textual (for example trailing spaces or line length), rules iterate the lines array and may apply small, targeted regex on a single line or substring.
- Violations are reported via a callback with precise line/column and optional fix info, so rules avoid global regex sweeps and focus only on the minimal spans they need.

## Regex vs tokens
- Token-driven checks dominate because they’re resilient to Markdown edge cases and avoid brittle, backtracking-heavy regex across the whole document.
- Regex is used as a tactical tool for localized patterns (e.g., trimming whitespace, counting spaces, or validating a fragment) rather than as the primary parsing mechanism.
- This hybrid keeps rules simple and fast: structure from tokens, micro-patterns from small regex where appropriate.

## Large content handling
- The single-parse-per-file design means the Markdown is parsed once and reused, preventing N× reparsing as the number of rules grows.
- Most built-in rules are O(n) in the size of the token stream or the number of lines, and many short-circuit early within a line or token subtree to minimize work.
- Inline configuration and front matter exclusion reduce the effective scan area, and costly rules (like line-length over code/table regions) can be tuned or disabled to cap worst-case work.

## Practical implications
- For big documents and repos, parsing once and sharing tokens keeps total runtime closer to linear in input size, even with many rules.
- Prefer writing custom rules against tokens to avoid reinventing Markdown parsing and to keep checks robust across edge cases.
- Use line-based or small regex only where semantics aren’t needed, keeping scans local to a line or token’s text to preserve performance.

1. [https://github.com/markdown-it/markdown-it/issues/68](https://github.com/markdown-it/markdown-it/issues/68)
2. [https://markdown-it-py.readthedocs.io/en/latest/api/markdown_it.token.html](https://markdown-it-py.readthedocs.io/en/latest/api/markdown_it.token.html)
3. [https://markdown-it.github.io/markdown-it/](https://markdown-it.github.io/markdown-it/)
4. [https://markdown-it-py.readthedocs.io/en/latest/using.html](https://markdown-it-py.readthedocs.io/en/latest/using.html)
5. [https://stackoverflow.com/questions/68934462/customize-markdown-parsing-in-markdown-it](https://stackoverflow.com/questions/68934462/customize-markdown-parsing-in-markdown-it)
6. [https://dlaa.me/blog/post/markdownlintfixinfo](https://dlaa.me/blog/post/markdownlintfixinfo)
7. [https://classic.yarnpkg.com/en/package/markdownlint-rule-helpers](https://classic.yarnpkg.com/en/package/markdownlint-rule-helpers)
8. [https://stackoverflow.com/questions/63989663/render-tokens-in-markdown-it](https://stackoverflow.com/questions/63989663/render-tokens-in-markdown-it)
9. [https://app.renovatebot.com/package-diff?name=markdownlint&from=0.31.0&to=0.31.1](https://app.renovatebot.com/package-diff?name=markdownlint&from=0.31.0&to=0.31.1)
10. [https://www.varac.net/docs/markup/markdown/linting-formatting.html](https://www.varac.net/docs/markup/markdown/linting-formatting.html)
11. [https://community.openai.com/t/markdown-is-15-more-token-efficient-than-json/841742](https://community.openai.com/t/markdown-is-15-more-token-efficient-than-json/841742)
12. [https://jackdewinter.github.io/2020/05/11/markdown-linter-rules-the-first-three/](https://jackdewinter.github.io/2020/05/11/markdown-linter-rules-the-first-three/)
13. [https://qmacro.org/blog/posts/2021/05/13/notes-on-markdown-linting-part-1/](https://qmacro.org/blog/posts/2021/05/13/notes-on-markdown-linting-part-1/)
14. [https://discourse.joplinapp.org/t/help-with-markdown-it-link-rendering/8143](https://discourse.joplinapp.org/t/help-with-markdown-it-link-rendering/8143)
15. [https://git.theoludwig.fr/theoludwig/markdownlint-rule-relative-links/compare/v2.3.0...v2.3.2?style=unified&whitespace=ignore-all&show-outdated=](https://git.theoludwig.fr/theoludwig/markdownlint-rule-relative-links/compare/v2.3.0...v2.3.2?style=unified&whitespace=ignore-all&show-outdated=)
16. [https://archlinux.org/packages/extra/any/markdownlint-cli2/files/](https://archlinux.org/packages/extra/any/markdownlint-cli2/files/)
17. [https://jackdewinter.github.io/2021/07/26/markdown-linter-getting-back-to-new-rules/](https://jackdewinter.github.io/2021/07/26/markdown-linter-getting-back-to-new-rules/)
18. [https://github.com/DavidAnson/markdownlint/issues/762](https://github.com/DavidAnson/markdownlint/issues/762)
19. [http://xiangxing98.github.io/Markdownlint_Rules.html](http://xiangxing98.github.io/Markdownlint_Rules.html)
20. [https://pypi.org/project/pymarkdownlnt/](https://pypi.org/project/pymarkdownlnt/)

Here is **the exact code in the markdownlint repo** that takes rule definitions and runs logic on them—**no guessing**:

**Location: `lib/markdownlint.mjs` (v0.39.0)**

## 1. Registering and Validating Rules

Custom and built-in rules are merged:

js

`const ruleList = rules.concat(customRuleList); const ruleErr = validateRuleList(ruleList, synchronous);`

(field validation is enforced in `validateRuleList`, requiring `"names"`, `"description"`, `"function"`, etc.)

## 2. Core Linting Flow: `lintContent`

This function is where each rule function is called:

js

`// Function to run for each rule const forRule = (rule) => {   ...   // Prepares the onError handler and params   function onError(errorInfo) { ... }   // Calls the rule's implementation (your callback)   function invokeRuleFunction() {     rule.function(params, onError);   }   if (rule.asynchronous) {     // For async rules: return a Promise-wrapped call     return Promise.resolve().then(invokeRuleFunction)                           .catch(catchCallsOnError);   }   // For sync rules   try {     invokeRuleFunction();   } catch (error) {     if (handleRuleFailures) { catchCallsOnError(error); } else { throw error; }   }   return null; }; const ruleResults = ruleListAsyncFirst.map(forRule);`

- **`params`**: The first argument, with content and parsed tokens.

- **`onError`**: The second argument, to report rule violations.

## 3. How Rules Are Iterated and Called

After preprocessing:

- The relevant rules (including custom) are placed in `ruleList`.

- **Each rule’s `.function` property is invoked with `params` + `onError`.**

- Results/errors are collected for output.

## 4. Direct Code Example – Rule Execution (Sync/Async)

js

`const forRule = (rule) => {   ...   function invokeRuleFunction() {     rule.function(params, onError); // <- rule "runs" here   }   if (rule.asynchronous) {     return Promise.resolve().then(invokeRuleFunction)                           .catch(catchCallsOnError);   }   try {     invokeRuleFunction();   } catch (error) {     if (handleRuleFailures) { catchCallsOnError(error); } else { throw error; }   }   return null; }; // Then: ruleListAsyncFirst.map(forRule);`

**Source: [`lib/markdownlint.mjs`](https://github.com/DavidAnson/markdownlint/blob/v0.39.0/lib/markdownlint.mjs) v0.39.0**[github](https://github.com/DavidAnson/markdownlint/raw/refs/tags/v0.39.0/lib/markdownlint.mjs)​

This is the specific, canonical spot where _every_ rule definition—internal or custom, sync or async—is executed with the parsed file content and can report lint errors. No extra speculation—this is the repo source of rule handling and invocation.

1. [https://github.com/DavidAnson/markdownlint/raw/refs/tags/v0.39.0/lib/markdownlint.mjs](https://github.com/DavidAnson/markdownlint/raw/refs/tags/v0.39.0/lib/markdownlint.mjs)
2. [https://github.com/DavidAnson/markdownlint/blob/v0.39.0/test/rules/node_modules/markdownlint-rule-sample-commonjs/sample-rule.cjs](https://github.com/DavidAnson/markdownlint/blob/v0.39.0/test/rules/node_modules/markdownlint-rule-sample-commonjs/sample-rule.cjs)

---
## Micromark 3rd Party Obsidian Extensions
Yes—micromark has third‑party extensions that implement Obsidian‑flavored Markdown features such as wikilinks, embeds, tags, and callouts, though they are community packages rather than official Obsidian modules. Examples include the @moritzrs “OFM” family (ofm, ofm‑wikilink, ofm‑tag, ofm‑callout) and a general wiki‑link extension that can be adapted for Obsidian‑style links.[npmjs+3](https://www.npmjs.com/package/@moritzrs%2Fmicromark-extension-ofm-wikilink)

### Available extensions

- @moritzrs/micromark-extension-ofm-wikilink adds Obsidian‑style [[wikilinks]] and media embeds, with corresponding HTML serialization helpers.[npmjs](https://www.npmjs.com/package/@moritzrs%2Fmicromark-extension-ofm-wikilink)

- @moritzrs/micromark-extension-ofm-callout implements Obsidian‑style callouts so blocks beginning with [!type] parse as callouts in micromark flows.[packages.ecosyste](https://packages.ecosyste.ms/registries/npmjs.org/keywords/micromark-extension)

- Bundled “OFM” packages and other Obsidian‑focused extension sets exist, such as @moritzrs/micromark-extension-ofm and @goonco/micromark-extension-ofm, to cover broader Obsidian syntax in one place.[libraries+1](https://libraries.io/npm/@goonco%2Fmicromark-extension-ofm)

### What they cover

- Obsidian callouts use a [!type] marker at the start of a blockquote (for example, [!info]) and these extensions aim to parse that syntax so it can be transformed or rendered outside Obsidian.[obsidian+1](https://help.obsidian.md/callouts)

- There is also a general micromark wiki‑link extension for [[Wiki Links]] that can be configured (alias divider, permalink resolution) and used where pure Obsidian semantics aren’t required.[github](https://github.com/landakram/micromark-extension-wiki-link)

- Some remark plugins add Obsidian‑style callouts by registering micromark syntax under the hood, demonstrating the typical integration path in unified/remark ecosystems.[github](https://github.com/rk-terence/gz-remark-callout)

### Integration tips

- These packages expose micromark syntax and HTML extensions that are passed via the micromark options (extensions/htmlExtensions) during parsing and serialization.[github+1](https://github.com/landakram/micromark-extension-wiki-link)

- For AST work, pair micromark syntax with matching mdast utilities like @moritzrs/mdast-util-ofm-wikilink (via mdast‑util‑from‑markdown) or use higher‑level wrappers such as “remark‑ofm” referenced by the OFM packages.[npmjs+1](https://www.npmjs.com/package/@moritzrs%2Fmdast-util-ofm-wikilink)

- When targeting full Obsidian coverage, prefer the curated OFM bundles and selectively enable features needed for wikilinks, tags, callouts, and related behaviors to match Obsidian’s documented syntax.[packages.ecosyste+1](https://packages.ecosyste.ms/registries/npmjs.org/keywords/micromark-extension)

1. [https://www.npmjs.com/package/@moritzrs%2Fmicromark-extension-ofm-wikilink](https://www.npmjs.com/package/@moritzrs%2Fmicromark-extension-ofm-wikilink)
2. [https://packages.ecosyste.ms/registries/npmjs.org/keywords/micromark-extension](https://packages.ecosyste.ms/registries/npmjs.org/keywords/micromark-extension)
3. [https://github.com/landakram/micromark-extension-wiki-link](https://github.com/landakram/micromark-extension-wiki-link)
4. [https://libraries.io/npm/@goonco%2Fmicromark-extension-ofm](https://libraries.io/npm/@goonco%2Fmicromark-extension-ofm)
5. [https://help.obsidian.md/callouts](https://help.obsidian.md/callouts)
6. [https://github.com/rk-terence/gz-remark-callout](https://github.com/rk-terence/gz-remark-callout)
7. [https://www.npmjs.com/package/@moritzrs%2Fmdast-util-ofm-wikilink](https://www.npmjs.com/package/@moritzrs%2Fmdast-util-ofm-wikilink)
8. [https://www.npmjs.com/package/@moritzrs%2Fmicromark-extension-ofm-tag](https://www.npmjs.com/package/@moritzrs%2Fmicromark-extension-ofm-tag)
9. [https://jsr.io/@jooooock/obsidian-markdown-parser](https://jsr.io/@jooooock/obsidian-markdown-parser)
10. [https://libraries.io/npm/@moritzrs%2Fmicromark-extension-ofm-wikilink](https://libraries.io/npm/@moritzrs%2Fmicromark-extension-ofm-wikilink)
11. [https://codesandbox.io/examples/package/micromark-extension-wiki-link](https://codesandbox.io/examples/package/micromark-extension-wiki-link)
12. [https://pdworkman.com/obsidian-callouts/](https://pdworkman.com/obsidian-callouts/)
13. [https://www.moritzjung.dev/obsidian-stats/plugins/qatt/](https://www.moritzjung.dev/obsidian-stats/plugins/qatt/)
14. [https://unifiedjs.com/explore/package/remark-wiki-link/](https://unifiedjs.com/explore/package/remark-wiki-link/)
15. [https://www.youtube.com/watch?v=tSSc42tCVto](https://www.youtube.com/watch?v=tSSc42tCVto)
16. [https://www.moritzjung.dev/obsidian-stats/plugins/md-image-caption/](https://www.moritzjung.dev/obsidian-stats/plugins/md-image-caption/)
17. [https://cdn.jsdelivr.net/npm/micromark-extension-wiki-link@0.0.4/dist/](https://cdn.jsdelivr.net/npm/micromark-extension-wiki-link@0.0.4/dist/)
18. [https://forum.inkdrop.app/t/backlinks-roam-obsidian/1928](https://forum.inkdrop.app/t/backlinks-roam-obsidian/1928)
19. [https://www.youtube.com/watch?v=sdVNiSQcMv0](https://www.youtube.com/watch?v=sdVNiSQcMv0)
20. [https://forum.inkdrop.app/t/different-checkbox-types/3237](https://forum.inkdrop.app/t/different-checkbox-types/3237)
