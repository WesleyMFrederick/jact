# US2.3: Implement `extract links` Subcommand - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement `extract links <source-file> [options]` CLI subcommand that orchestrates two-phase workflow: (1) discover and validate links in source document, (2) extract content from validated links using ContentExtractor component

**Architecture:** CLI Orchestrator creates new `extract` command with `links` subcommand. CitationManager class extended with extractLinks() method implementing three-phase orchestration: Phase 1 calls validator.validateFile() to discover/enrich links, Phase 2 passes enriched links to contentExtractor.extractContent(), Phase 3 outputs OutgoingLinksExtractedContent JSON to stdout. LinkObjectFactory created as Level 4 helper for future extract header/file subcommands. Separation of concerns: validator validates, extractor extracts, CLI coordinates.

**Tech Stack:** Node.js ESM, Commander.js for CLI, existing citation-manager components (CitationValidator, ContentExtractor, ParsedFileCache), Vitest

**Commit Strategy:** Git commit after each task (Tasks 0-21) for granular progress tracking with full attribution. Single comprehensive commit created after Task 21 representing complete US2.3 implementation.

---

## Task 0: Development Environment Setup

Use `using-git-worktrees` skill to create clean development environment

### Step 1: Commit current work

Ensure cli-extract-feature branch is clean before creating worktree

Run: `git status`
Run: `git add .`
Run: `git commit -m "wip: save current work before us2.3 worktree"`

### Step 2: Create worktree for US2.3

Use `using-git-worktrees` skill to create isolated development environment

Branch: `us2.3-extract-links-subcommand`
Worktree: `../cc-workflows-us2.3/`

---

## Task 1: LinkObjectFactory - createHeaderLink() Basic Structure

### Files
- `tools/citation-manager/src/factories/LinkObjectFactory.js` (CREATE)
- `tools/citation-manager/test/unit/factories/link-object-factory.test.js` (CREATE)

### Purpose
Create Level 4 helper factory for synthetic LinkObject construction (US2.4/US2.5 prerequisite). Validates createHeaderLink() produces valid LinkObject structure.

### Step 1: Write failing test for basic header link structure

Create `tools/citation-manager/test/unit/factories/link-object-factory.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { /* LinkObjectFactory */ } from '../../../src/factories/LinkObjectFactory.js';

describe('LinkObjectFactory - Header Link Creation', () => {
  it('should create header link with required LinkObject properties', () => {
    // Given: Target file path and header name from CLI input
    const targetPath = '/absolute/path/to/target.md';
    const headerName = 'Section Header';

    // When: Create synthetic header link
    const factory = /* new LinkObjectFactory() */;
    const link = /* factory.createHeaderLink(targetPath, headerName) */;

    // Then: Link has required LinkObject structure
    // Verification: Matches parser output contract for header links
    expect(link.linkType).toBe('markdown');
    expect(link.scope).toBe('cross-document');
    expect(link.anchorType).toBe('header');
    expect(link.target.anchor).toBe(headerName);
    expect(link.validation).toBeNull(); // Pre-validation state
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- link-object-factory.test.js`

Expected: FAIL - Cannot find module 'LinkObjectFactory.js'

### Step 3: Implement LinkObjectFactory with createHeaderLink()

Create `tools/citation-manager/src/factories/LinkObjectFactory.js`:

```tsx
/**
 * LinkObjectFactory - Level 4 helper for CLI Orchestrator
 *
 * Pattern: Adapts CLI string inputs to LinkObject data contract
 * Boundary: Creates unvalidated LinkObjects for synthetic extraction workflows
 */
export class LinkObjectFactory is

  /**
   * Create synthetic LinkObject for header extraction
   *
   * Integration: Produces LinkObject matching MarkdownParser output contract
   * Pattern: CLI calls this before validator.validateSingleCitation()
   *
   * @param targetPath - Absolute or relative path to target file
   * @param headerName - Exact header text to extract
   * @returns Unvalidated LinkObject with anchorType: "header"
   */
  public method createHeaderLink(targetPath: string, headerName: string): LinkObject is
    // Pattern: Create LinkObject structure matching parser contract
    return {
      linkType: 'markdown',
      scope: 'cross-document',
      anchorType: 'header',
      source: {
        path: {
          absolute: /* process.cwd() - CLI invocation directory */
        }
      },
      target: {
        path: {
          raw: targetPath,
          absolute: null,  // Task 2 will add path resolution
          relative: null
        },
        anchor: headerName
      },
      text: headerName,
      fullMatch: `[${headerName}](${targetPath}#${headerName})`,
      line: 0,  // Synthetic links have no source line
      column: 0,
      extractionMarker: null,
      validation: null  // Will be enriched by validator
    };
```

### Step 4: Run test to verify it passes

Run: `npm test -- link-object-factory.test.js`

Expected: PASS (1/1 test)

### Step 5: Create commit

Use `create-git-commit` skill to create commit

---

## Task 2: LinkObjectFactory - createHeaderLink() Path Normalization

### Files
- `tools/citation-manager/test/unit/factories/link-object-factory.test.js` (MODIFY)
- `tools/citation-manager/src/factories/LinkObjectFactory.js` (MODIFY)

### Purpose
Validate createHeaderLink() resolves absolute path for target file. Enables validator to locate file for validation.

### Step 1: Write failing test for path normalization

Add to `link-object-factory.test.js`:

```javascript
import { join } from 'node:path';

describe('LinkObjectFactory - Path Resolution', () => {
  it('should resolve absolute path for target file in header links', () => {
    // Given: Relative target file path
    const relativePath = './docs/target.md';
    const headerName = 'Section';

    // When: Create header link
    const factory = /* new LinkObjectFactory() */;
    const link = /* factory.createHeaderLink(relativePath, headerName) */;

    // Then: Target path resolved to absolute
    // Verification: Path resolution enables validator file lookup
    expect(link.target.path.absolute).toBeTruthy();
    expect(link.target.path.absolute).toContain('docs/target.md');
    expect(link.target.path.raw).toBe(relativePath);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- link-object-factory.test.js`

Expected: FAIL - link.target.path.absolute is null

### Step 3: Add path resolution to createHeaderLink()

Update `LinkObjectFactory.js`:

```tsx
import { /* path.resolve */ } from 'node:path';

  public method createHeaderLink(targetPath: string, headerName: string): LinkObject is
    // Boundary: Normalize path to absolute
    const absolutePath = /* path.resolve(targetPath) */;

    return {
      // ... existing properties
      target: {
        path: {
          raw: targetPath,
          absolute: absolutePath,  // ← Added resolution
          relative: /* path.relative(process.cwd(), absolutePath) */
        },
        anchor: headerName
      },
      // ... rest of structure
    };
```

### Step 4: Run test to verify it passes

Run: `npm test -- link-object-factory.test.js`

Expected: PASS (2/2 tests)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 3: LinkObjectFactory - createFileLink() Basic Structure

### Files
- `tools/citation-manager/test/unit/factories/link-object-factory.test.js` (MODIFY)
- `tools/citation-manager/src/factories/LinkObjectFactory.js` (MODIFY)

### Purpose
Create createFileLink() method for full-file extraction (US2.5 prerequisite). Validates anchorType: null for full-file links.

### Step 1: Write failing test for file link structure

Add to `link-object-factory.test.js`:

```javascript
describe('LinkObjectFactory - File Link Creation', () => {
  it('should create file link with anchorType null for full-file extraction', () => {
    // Given: Target file path (no anchor)
    const targetPath = '/absolute/path/to/file.md';

    // When: Create synthetic file link
    const factory = /* new LinkObjectFactory() */;
    const link = /* factory.createFileLink(targetPath) */;

    // Then: Link has full-file structure (no anchor)
    // Verification: anchorType: null signals full-file extraction
    expect(link.linkType).toBe('markdown');
    expect(link.scope).toBe('cross-document');
    expect(link.anchorType).toBeNull(); // Full-file indicator
    expect(link.target.anchor).toBeNull();
    expect(link.validation).toBeNull();
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- link-object-factory.test.js`

Expected: FAIL - factory.createFileLink is not a function

### Step 3: Implement createFileLink() method

Add to `LinkObjectFactory.js`:

```tsx
  /**
   * Create synthetic LinkObject for full-file extraction
   *
   * Integration: Produces LinkObject for extract file subcommand (US2.5)
   * Pattern: CLI calls this before validator.validateSingleCitation()
   * Decision: anchorType: null signals full-file link
   *
   * @param targetPath - Absolute or relative path to target file
   * @returns Unvalidated LinkObject with anchorType: null
   */
  public method createFileLink(targetPath: string): LinkObject is
    return {
      linkType: 'markdown',
      scope: 'cross-document',
      anchorType: null,  // Decision: null indicates full-file link
      source: {
        path: {
          absolute: /* process.cwd() */
        }
      },
      target: {
        path: {
          raw: targetPath,
          absolute: null,  // Task 4 will add resolution
          relative: null
        },
        anchor: null  // No anchor for full-file links
      },
      text: /* path.basename(targetPath) */,
      fullMatch: `[${/* path.basename(targetPath) */}](${targetPath})`,
      line: 0,
      column: 0,
      extractionMarker: null,
      validation: null
    };
```

### Step 4: Run test to verify it passes

Run: `npm test -- link-object-factory.test.js`

Expected: PASS (3/3 tests)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 4: LinkObjectFactory - createFileLink() Path Normalization

### Files
- `tools/citation-manager/test/unit/factories/link-object-factory.test.js` (MODIFY)
- `tools/citation-manager/src/factories/LinkObjectFactory.js` (MODIFY)

### Purpose
Validate createFileLink() resolves absolute path for target file, matching createHeaderLink() behavior.

### Step 1: Write failing test for file link path resolution

Add to `link-object-factory.test.js`:

```javascript
describe('LinkObjectFactory - File Link Path Resolution', () => {
  it('should resolve absolute path for target file in file links', () => {
    // Given: Relative target file path
    const relativePath = './docs/complete-file.md';

    // When: Create file link
    const factory = /* new LinkObjectFactory() */;
    const link = /* factory.createFileLink(relativePath) */;

    // Then: Target path resolved to absolute
    expect(link.target.path.absolute).toBeTruthy();
    expect(link.target.path.absolute).toContain('docs/complete-file.md');
    expect(link.target.path.raw).toBe(relativePath);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- link-object-factory.test.js`

Expected: FAIL - link.target.path.absolute is null

### Step 3: Add path resolution to createFileLink()

Update `createFileLink()` in `LinkObjectFactory.js`:

```tsx
  public method createFileLink(targetPath: string): LinkObject is
    const absolutePath = /* path.resolve(targetPath) */;

    return {
      // ... existing properties
      target: {
        path: {
          raw: targetPath,
          absolute: absolutePath,  // ← Added resolution
          relative: /* path.relative(process.cwd(), absolutePath) */
        },
        anchor: null
      },
      // ... rest of structure
    };
```

### Step 4: Run test to verify it passes

Run: `npm test -- link-object-factory.test.js`

Expected: PASS (4/4 tests)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 5: ComponentFactory - createContentExtractor() Wiring

### Files
- `tools/citation-manager/src/factories/componentFactory.js` (MODIFY)
- `tools/citation-manager/test/unit/factories/component-factory.test.js` (CREATE)

### Purpose
Add factory function for ContentExtractor instantiation (US2.3 AC4). Validates factory wires ParsedFileCache dependency.

### Step 1: Write failing test for ContentExtractor factory

Create `tools/citation-manager/test/unit/factories/component-factory.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { /* createContentExtractor */ } from '../../../src/factories/componentFactory.js';
import { ContentExtractor } from '../../../src/core/ContentExtractor/ContentExtractor.js';

describe('ComponentFactory - ContentExtractor Creation', () => {
  it('should create ContentExtractor with ParsedFileCache dependency', () => {
    // Given: Factory function available

    // When: Create ContentExtractor
    const extractor = /* createContentExtractor() */;

    // Then: Returns ContentExtractor instance
    // Verification: Factory wires dependencies correctly
    expect(extractor).toBeInstanceOf(ContentExtractor);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- component-factory.test.js`

Expected: FAIL - createContentExtractor is not a function

### Step 3: Implement createContentExtractor() factory

Add to `componentFactory.js`:

```tsx
import { ContentExtractor } from '../core/ContentExtractor/ContentExtractor.js';

/**
 * Create ContentExtractor with dependency injection
 *
 * Pattern: Factory encapsulates component wiring complexity
 * Integration: Creates ParsedFileCache and eligibility strategies
 *
 * @param parsedFileCache - Optional cache override for testing
 * @param strategies - Optional strategy override for testing
 * @returns ContentExtractor instance with wired dependencies
 */
export function createContentExtractor(
  parsedFileCache?: ParsedFileCache,
  strategies?: ExtractionStrategy[]
): ContentExtractor is
  // Decision: Use provided cache or create default
  const cache = parsedFileCache || /* createParsedFileCache() */;

  // Decision: Use provided strategies or create defaults (Task 6)
  const eligibilityStrategies = strategies || /* [] - Task 6 will add defaults */;

  // Pattern: Constructor injection for testability
  return new ContentExtractor(cache, eligibilityStrategies);
```

### Step 4: Run test to verify it passes

Run: `npm test -- component-factory.test.js`

Expected: PASS (1/1 test)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 6: ComponentFactory - createContentExtractor() Default Strategies

### Files
- `tools/citation-manager/test/unit/factories/component-factory.test.js` (MODIFY)
- `tools/citation-manager/src/factories/componentFactory.js` (MODIFY)

### Purpose
Validate factory creates eligibility strategies in correct precedence order (Stop → Force → Section → CliFlag).

### Step 1: Write failing test for strategy precedence

Add to `component-factory.test.js`:

```javascript
import {
  StopMarkerStrategy,
  ForceMarkerStrategy,
  SectionLinkStrategy,
  CliFlagStrategy
} from '../../../src/core/ContentExtractor/eligibilityStrategies/index.js';

describe('ComponentFactory - Strategy Precedence', () => {
  it('should create ContentExtractor with strategies in correct precedence order', () => {
    // Given: Factory creates default strategies

    // When: Create ContentExtractor without strategy override
    const extractor = /* createContentExtractor() */;

    // Then: Strategies array has correct precedence
    // Verification: Stop → Force → Section → CliFlag order
    const strategies = /* extractor.eligibilityStrategies - needs getter or exposure */;
    expect(strategies[0]).toBeInstanceOf(StopMarkerStrategy);
    expect(strategies[1]).toBeInstanceOf(ForceMarkerStrategy);
    expect(strategies[2]).toBeInstanceOf(SectionLinkStrategy);
    expect(strategies[3]).toBeInstanceOf(CliFlagStrategy);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- component-factory.test.js`

Expected: FAIL - eligibilityStrategies is empty array

### Step 3: Add default strategy creation to factory

Update `componentFactory.js`:

```tsx
import {
  StopMarkerStrategy,
  ForceMarkerStrategy,
  SectionLinkStrategy,
  CliFlagStrategy
} from '../core/ContentExtractor/eligibilityStrategies/index.js';

export function createContentExtractor(
  parsedFileCache?: ParsedFileCache,
  strategies?: ExtractionStrategy[]
): ContentExtractor is
  const cache = parsedFileCache || createParsedFileCache();

  // Pattern: Array order defines precedence (highest to lowest)
  const eligibilityStrategies = strategies || [
    new StopMarkerStrategy(),   // Highest: blocks extraction
    new ForceMarkerStrategy(),  // High: forces extraction
    new SectionLinkStrategy(),  // Medium: section/block defaults
    new CliFlagStrategy()       // Lowest: CLI flag behavior
  ];

  return new ContentExtractor(cache, eligibilityStrategies);
```

### Step 4: Run test to verify it passes

Run: `npm test -- component-factory.test.js`

Expected: PASS (2/2 tests)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 7: CLI - Extract Command Infrastructure

### Files
- `tools/citation-manager/src/citation-manager.js` (MODIFY)
- `tools/citation-manager/test/cli-integration/extract-command.test.js` (CREATE)

### Purpose
Create base `extract` command structure for subcommand registration (US2.3 AC1, US2.4, US2.5).

### Step 1: Write failing test for extract command registration

Create `tools/citation-manager/test/cli-integration/extract-command.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

describe('Extract Command - Infrastructure', () => {
  it('should register extract command with Commander', () => {
    // Given: citation-manager CLI

    // When: Request help for extract command
    const output = execSync(
      'node tools/citation-manager/src/citation-manager.js extract --help',
      { encoding: 'utf8' }
    );

    // Then: Extract command help displays
    // Verification: Commander registered extract command
    expect(output).toContain('Usage: citation-manager extract');
    expect(output).toContain('Commands:');
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- extract-command.test.js`

Expected: FAIL - Unknown command 'extract'

### Step 3: Add extract command to CLI

Add to `citation-manager.js` after existing commands:

```tsx
// Pattern: Base extract command for subcommand organization
program
  .command('extract')
  .description('Extract content from citations')
  .action(() => {
    // Decision: No direct action - require subcommand
    console.error('Error: subcommand required (links, header, file)');
    process.exit(1);
  });
```

### Step 4: Run test to verify it passes

Run: `npm test -- extract-command.test.js`

Expected: PASS (1/1 test)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 8: CLI - Extract Links Subcommand Registration

### Files
- `tools/citation-manager/src/citation-manager.js` (MODIFY)
- `tools/citation-manager/test/cli-integration/extract-command.test.js` (MODIFY)

### Purpose
Register `extract links` subcommand with Commander (US2.3 AC1, AC2). Validates argument and option definitions.

### Step 1: Write failing test for extract links subcommand

Add to `extract-command.test.js`:

```javascript
describe('Extract Links Subcommand - Registration', () => {
  it('should register extract links subcommand with required arguments', () => {
    // Given: citation-manager CLI with extract command

    // When: Request help for extract links
    const output = execSync(
      'node tools/citation-manager/src/citation-manager.js extract links --help',
      { encoding: 'utf8' }
    );

    // Then: Subcommand help displays with arguments and options
    expect(output).toContain('extract links <source-file>');
    expect(output).toContain('--scope <folder>');
    expect(output).toContain('--format <type>');
    expect(output).toContain('--full-files');
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- extract-command.test.js`

Expected: FAIL - Unknown command 'links'

### Step 3: Add extract links subcommand

Add to `citation-manager.js`:

```tsx
// Pattern: Subcommand for link-based extraction workflow
program
  .command('extract links <source-file>')
  .description('Extract content from all links in source document')
  .option('--scope <folder>', 'Limit file resolution to folder')
  .option('--format <type>', 'Output format (reserved for future)', 'json')
  .option('--full-files', 'Enable full-file link extraction')
  .action(async (sourceFile, options) => {
    // Task 13 will implement action handler
    console.error('Not yet implemented');
    process.exit(1);
  });
```

### Step 4: Run test to verify it passes

Run: `npm test -- extract-command.test.js`

Expected: PASS (2/2 tests)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 9: CitationManager - ContentExtractor Instantiation

### Files
- `tools/citation-manager/src/citation-manager.js` (MODIFY)
- `tools/citation-manager/test/unit/citation-manager.test.js` (CREATE)

### Purpose
Add ContentExtractor to CitationManager constructor (US2.3 AC4). Validates component wiring via factory.

### Step 1: Write failing test for ContentExtractor instantiation

Create `tools/citation-manager/test/unit/citation-manager.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { CitationManager } from '../../src/citation-manager.js';

describe('CitationManager - Component Instantiation', () => {
  it('should instantiate ContentExtractor via factory', () => {
    // Given: CitationManager constructor

    // When: Create CitationManager instance
    const manager = /* new CitationManager() */;

    // Then: ContentExtractor created and accessible
    // Verification: Factory wiring complete
    expect(manager.contentExtractor).toBeDefined();
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- citation-manager.test.js`

Expected: FAIL - manager.contentExtractor is undefined

### Step 3: Add ContentExtractor to CitationManager constructor

Update `CitationManager` class in `citation-manager.js`:

```tsx
import { createContentExtractor } from './factories/componentFactory.js';

class CitationManager is
  constructor() is
    this.parser = createMarkdownParser();
    this.parsedFileCache = createParsedFileCache(this.parser);
    this.fileCache = createFileCache();
    this.validator = createCitationValidator(
      this.parsedFileCache,
      this.fileCache
    );

    // Integration: Add ContentExtractor via factory
    this.contentExtractor = createContentExtractor(
      this.parsedFileCache  // Share cache with validator
    );
```

### Step 4: Run test to verify it passes

Run: `npm test -- citation-manager.test.js`

Expected: PASS (1/1 test)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 10: CitationManager - extractLinks() Phase 1 Validation

### Files
- `tools/citation-manager/src/citation-manager.js` (MODIFY)
- `tools/citation-manager/test/unit/citation-manager.test.js` (MODIFY)

### Purpose
Implement Phase 1 of extraction workflow: validate source file and discover links (US2.3 AC3).

### Step 1: Write failing test for Phase 1 validation

Add to `citation-manager.test.js`:

```javascript
describe('CitationManager - extractLinks() Phase 1', () => {
  it('should validate source file and extract enriched links', async () => {
    // Given: CitationManager and source file with links
    const manager = /* new CitationManager() */;
    const sourceFile = /* path to test fixture */;

    // When: Call extractLinks Phase 1
    // Note: This test validates validator.validateFile() called
    const result = await /* manager.extractLinks(sourceFile, {}) */;

    // Then: Validation executed and enriched links available
    // Verification: Phase 1 discovers and enriches links
    expect(result).toBeDefined(); // Result structure validated in later tasks
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- citation-manager.test.js`

Expected: FAIL - manager.extractLinks is not a function

### Step 3: Implement extractLinks() with Phase 1

Add to `CitationManager` class:

```tsx
  /**
   * Extract content from links in source document
   *
   * Pattern: Three-phase orchestration workflow
   * Integration: Coordinates validator → extractor → output
   *
   * @param sourceFile - Path to markdown file containing citations
   * @param options - CLI options (scope, fullFiles)
   * @returns OutgoingLinksExtractedContent structure
   */
  async method extractLinks(sourceFile: string, options: object): Promise<void> is
    try
      // Decision: Build file cache if --scope provided
      if (options.scope) then
        this.fileCache.buildCache(options.scope);

      // Phase 1: Link Discovery & Validation
      // Pattern: Delegate to validator for link discovery and enrichment
      const validationResult = await this.validator.validateFile(sourceFile);
      const enrichedLinks = validationResult.links;

      // Task 11 will add Phase 2
      // Task 12 will add Phase 3

      return { /* temporary return */ };

    catch (error) is
      console.error('ERROR:', error.message);
      process.exitCode = 2;
```

### Step 4: Run test to verify it passes

Run: `npm test -- citation-manager.test.js`

Expected: PASS (2/2 tests)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 11: CitationManager - extractLinks() Phase 2 Extraction

### Files
- `tools/citation-manager/src/citation-manager.js` (MODIFY)
- `tools/citation-manager/test/unit/citation-manager.test.js` (MODIFY)

### Purpose
Implement Phase 2: pass enriched links to ContentExtractor (US2.3 AC4, AC6).

### Step 1: Write failing test for Phase 2 extraction

Add to `citation-manager.test.js`:

```javascript
describe('CitationManager - extractLinks() Phase 2', () => {
  it('should pass enriched links to ContentExtractor with CLI flags', async () => {
    // Given: Source file and fullFiles flag
    const manager = /* new CitationManager() */;
    const sourceFile = /* test fixture */;
    const options = { fullFiles: true };

    // When: Call extractLinks with flags
    const result = await /* manager.extractLinks(sourceFile, options) */;

    // Then: ContentExtractor received enriched links and flags
    // Verification: Phase 2 delegates to extractor
    expect(result.stats).toBeDefined(); // OutgoingLinksExtractedContent structure
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- citation-manager.test.js`

Expected: FAIL - result.stats is undefined

### Step 3: Add Phase 2 to extractLinks()

Update `extractLinks()` method:

```tsx
  async method extractLinks(sourceFile: string, options: object): Promise<void> is
    try
      if (options.scope) then
        this.fileCache.buildCache(options.scope);

      // Phase 1: Link Discovery & Validation
      const validationResult = await this.validator.validateFile(sourceFile);
      const enrichedLinks = validationResult.links;

      // Phase 2: Content Extraction
      // Pattern: Pass pre-validated enriched links to extractor
      const extractionResult = await this.contentExtractor.extractContent(
        enrichedLinks,
        { fullFiles: options.fullFiles }  // Pass CLI flags to strategies
      );

      // Task 12 will add Phase 3 output

      return extractionResult;  // Temporary return for testing

    catch (error) is
      console.error('ERROR:', error.message);
      process.exitCode = 2;
```

### Step 4: Run test to verify it passes

Run: `npm test -- citation-manager.test.js`

Expected: PASS (3/3 tests)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 12: CitationManager - extractLinks() Phase 3 Output

### Files
- `tools/citation-manager/src/citation-manager.js` (MODIFY)
- `tools/citation-manager/test/unit/citation-manager.test.js` (MODIFY)

### Purpose
Implement Phase 3: output JSON to stdout and set exit code (US2.3 AC7, AC8).

### Step 1: Write failing test for Phase 3 output

Add to `citation-manager.test.js`:

```javascript
import { vi } from 'vitest';

describe('CitationManager - extractLinks() Phase 3', () => {
  it('should output OutgoingLinksExtractedContent JSON to stdout', async () => {
    // Given: Console.log spy
    const consoleSpy = vi.spyOn(console, 'log');
    const manager = /* new CitationManager() */;
    const sourceFile = /* test fixture */;

    // When: Call extractLinks
    await /* manager.extractLinks(sourceFile, {}) */;

    // Then: JSON output written to stdout
    // Verification: Phase 3 outputs to stdout
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('extractedContentBlocks')
    );
    consoleSpy.mockRestore();
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- citation-manager.test.js`

Expected: FAIL - console.log not called

### Step 3: Add Phase 3 output to extractLinks()

Update `extractLinks()` method:

```tsx
  async method extractLinks(sourceFile: string, options: object): Promise<void> is
    try
      if (options.scope) then
        this.fileCache.buildCache(options.scope);

      // Phase 1: Link Discovery & Validation
      const validationResult = await this.validator.validateFile(sourceFile);
      const enrichedLinks = validationResult.links;

      // Phase 2: Content Extraction
      const extractionResult = await this.contentExtractor.extractContent(
        enrichedLinks,
        { fullFiles: options.fullFiles }
      );

      // Phase 3: Output
      // Boundary: Output JSON to stdout
      console.log(JSON.stringify(extractionResult, null, 2));

      // Decision: Exit code based on extraction success
      if (extractionResult.stats.uniqueContent > 0) then
        process.exitCode = 0;
      else
        process.exitCode = 1;

    catch (error) is
      console.error('ERROR:', error.message);
      process.exitCode = 2;
```

### Step 4: Run test to verify it passes

Run: `npm test -- citation-manager.test.js`

Expected: PASS (4/4 tests)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 13: CLI - Extract Links Orchestration Wiring

### Files
- `tools/citation-manager/src/citation-manager.js` (MODIFY)
- `tools/citation-manager/test/cli-integration/extract-command.test.js` (MODIFY)

### Purpose
Wire extract links action handler to CitationManager.extractLinks() (US2.3 AC3).

### Step 1: Write failing test for CLI orchestration

Add to `extract-command.test.js`:

```javascript
describe('Extract Links - CLI Orchestration', () => {
  it('should call CitationManager.extractLinks() from CLI action', () => {
    // Given: Test fixture with valid links
    const fixtureFile = /* path to test/fixtures/valid-citations.md */;

    // When: Execute extract links command
    const output = execSync(
      `node tools/citation-manager/src/citation-manager.js extract links "${fixtureFile}"`,
      { encoding: 'utf8' }
    );

    // Then: JSON output returned
    // Verification: CLI wired to CitationManager method
    const result = JSON.parse(output);
    expect(result.extractedContentBlocks).toBeDefined();
    expect(result.outgoingLinksReport).toBeDefined();
    expect(result.stats).toBeDefined();
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- extract-command.test.js`

Expected: FAIL - output is "Not yet implemented"

### Step 3: Wire action handler to CitationManager

Update `extract links` action in `citation-manager.js`:

```tsx
program
  .command('extract links <source-file>')
  .description('Extract content from all links in source document')
  .option('--scope <folder>', 'Limit file resolution to folder')
  .option('--format <type>', 'Output format (reserved for future)', 'json')
  .option('--full-files', 'Enable full-file link extraction')
  .action(async (sourceFile, options) => {
    // Pattern: Delegate to CitationManager orchestrator
    const manager = new CitationManager();

    try
      await manager.extractLinks(sourceFile, options);

    catch (error) is
      console.error('ERROR:', error.message);
      process.exitCode = 2;
  });
```

### Step 4: Run test to verify it passes

Run: `npm test -- extract-command.test.js`

Expected: PASS (3/3 tests)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 14: CLI - Extract Links Validation Error Reporting

### Files
- `tools/citation-manager/src/citation-manager.js` (MODIFY)
- `tools/citation-manager/test/cli-integration/extract-command.test.js` (MODIFY)

### Purpose
Report Phase 1 validation errors to stderr before Phase 2 extraction (US2.3 AC5).

### Step 1: Write failing test for validation error reporting

Add to `extract-command.test.js`:

```javascript
describe('Extract Links - Validation Error Reporting', () => {
  it('should report validation errors to stderr before extraction', () => {
    // Given: Test fixture with broken citations
    const fixtureFile = /* path to test/fixtures/broken-citations.md */;

    // When: Execute extract links command
    // Note: Use shell redirection to capture stderr
    try {
      execSync(
        `node tools/citation-manager/src/citation-manager.js extract links "${fixtureFile}" 2>&1`,
        { encoding: 'utf8' }
      );
    } catch (error) {
      // Then: Stderr contains validation error messages
      // Verification: Phase 1 errors reported before Phase 2
      expect(error.stdout).toContain('Validation errors found');
    }
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- extract-command.test.js`

Expected: FAIL - No validation error output to stderr

### Step 3: Add validation error reporting to extractLinks()

Update `extractLinks()` method:

```tsx
  async method extractLinks(sourceFile: string, options: object): Promise<void> is
    try
      if (options.scope) then
        this.fileCache.buildCache(options.scope);

      // Phase 1: Link Discovery & Validation
      const validationResult = await this.validator.validateFile(sourceFile);
      const enrichedLinks = validationResult.links;

      // Decision: Report validation errors to stderr
      if (validationResult.summary.errors > 0) then
        console.error('Validation errors found:');
        const errors = enrichedLinks.filter(l => l.validation.status === 'error');
        for (const link of errors) do
          console.error(`  Line ${link.line}: ${link.validation.error}`);

      // Phase 2: Content Extraction
      const extractionResult = await this.contentExtractor.extractContent(
        enrichedLinks,
        { fullFiles: options.fullFiles }
      );

      // Phase 3: Output
      console.log(JSON.stringify(extractionResult, null, 2));

      if (extractionResult.stats.uniqueContent > 0) then
        process.exitCode = 0;
      else
        process.exitCode = 1;

    catch (error) is
      console.error('ERROR:', error.message);
      process.exitCode = 2;
```

### Step 4: Run test to verify it passes

Run: `npm test -- extract-command.test.js`

Expected: PASS (4/4 tests)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 15: CLI - Extract Links --full-files Flag

### Files
- `tools/citation-manager/test/cli-integration/extract-command.test.js` (MODIFY)

### Purpose
Validate --full-files flag enables CliFlagStrategy for full-file extraction (US2.3 AC12).

### Step 1: Write failing test for --full-files flag behavior

Add to `extract-command.test.js`:

```javascript
describe('Extract Links - Full Files Flag', () => {
  it('should extract full-file links when --full-files flag provided', () => {
    // Given: Test fixture with full-file link (no anchor)
    const fixtureFile = /* path to test/fixtures/full-file-links.md */;

    // When: Execute with --full-files flag
    const output = execSync(
      `node tools/citation-manager/src/citation-manager.js extract links "${fixtureFile}" --full-files`,
      { encoding: 'utf8' }
    );

    // Then: Full-file content extracted
    // Verification: CliFlagStrategy enabled by --full-files
    const result = JSON.parse(output);
    expect(result.stats.uniqueContent).toBeGreaterThan(0);
    expect(result.outgoingLinksReport.processedLinks[0].extractionStatus).toBe('success');
  });

  it('should skip full-file links when --full-files flag NOT provided', () => {
    // Given: Test fixture with full-file link
    const fixtureFile = /* path to test/fixtures/full-file-links.md */;

    // When: Execute WITHOUT --full-files flag
    const output = execSync(
      `node tools/citation-manager/src/citation-manager.js extract links "${fixtureFile}"`,
      { encoding: 'utf8' }
    );

    // Then: Full-file link skipped (ineligible)
    const result = JSON.parse(output);
    expect(result.outgoingLinksReport.processedLinks[0].extractionStatus).toBe('skipped');
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- extract-command.test.js`

Expected: FAIL - Tests not yet added

### Step 3: No implementation needed

Implementation from Task 11 already passes `fullFiles` flag to extractor. CliFlagStrategy from US2.1 handles flag evaluation.

### Step 4: Run test to verify it passes

Run: `npm test -- extract-command.test.js`

Expected: PASS (6/6 tests)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 16: CLI - Extract Links Exit Code Success

### Files
- `tools/citation-manager/test/cli-integration/extract-command.test.js` (MODIFY)

### Purpose
Validate exit code 0 when ≥1 link successfully extracted (US2.3 AC7).

### Step 1: Write failing test for success exit code

Add to `extract-command.test.js`:

```javascript
describe('Extract Links - Exit Codes', () => {
  it('should exit with code 0 when at least one link extracted successfully', () => {
    // Given: Test fixture with valid extractable links
    const fixtureFile = /* path to test/fixtures/valid-citations.md */;

    // When: Execute extract links command
    const result = execSync(
      `node tools/citation-manager/src/citation-manager.js extract links "${fixtureFile}"; echo $?`,
      { encoding: 'utf8' }
    );

    // Then: Exit code is 0
    // Verification: Success signaled when stats.uniqueContent > 0
    expect(result.trim().endsWith('0')).toBe(true);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- extract-command.test.js`

Expected: FAIL - Test not yet added

### Step 3: No implementation needed

Implementation from Task 12 already sets `process.exitCode = 0` when `stats.uniqueContent > 0`.

### Step 4: Run test to verify it passes

Run: `npm test -- extract-command.test.js`

Expected: PASS (7/7 tests)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 17: CLI - Extract Links Exit Code Failure

### Files
- `tools/citation-manager/test/cli-integration/extract-command.test.js` (MODIFY)

### Purpose
Validate exit code 1 when no eligible links or all extractions failed (US2.3 AC8).

### Step 1: Write failing test for failure exit code

Add to `extract-command.test.js`:

```javascript
describe('Extract Links - Exit Code Failure', () => {
  it('should exit with code 1 when no eligible links extracted', () => {
    // Given: Test fixture with only internal links (scope: 'internal')
    const fixtureFile = /* path to test/fixtures/internal-links-only.md */;

    // When: Execute extract links command
    try {
      execSync(
        `node tools/citation-manager/src/citation-manager.js extract links "${fixtureFile}"`,
        { encoding: 'utf8' }
      );
    } catch (error) {
      // Then: Exit code is 1
      // Verification: Failure signaled when stats.uniqueContent === 0
      expect(error.status).toBe(1);
    }
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- extract-command.test.js`

Expected: FAIL - Test not yet added

### Step 3: No implementation needed

Implementation from Task 12 already sets `process.exitCode = 1` when `stats.uniqueContent === 0`.

### Step 4: Run test to verify it passes

Run: `npm test -- extract-command.test.js`

Expected: PASS (8/8 tests)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 18: CLI - Extract Command Help Documentation

### Files
- `tools/citation-manager/src/citation-manager.js` (MODIFY)
- `tools/citation-manager/test/cli-integration/extract-command.test.js` (MODIFY)

### Purpose
Add comprehensive help text for top-level extract command (US2.3 AC11).

### Step 1: Write failing test for extract command help

Add to `extract-command.test.js`:

```javascript
describe('Extract Command - Help Documentation', () => {
  it('should display comprehensive help for extract command', () => {
    // Given: citation-manager CLI

    // When: Request help for extract command
    const output = execSync(
      'node tools/citation-manager/src/citation-manager.js extract --help',
      { encoding: 'utf8' }
    );

    // Then: Help text includes description and subcommand list
    expect(output).toContain('Extract content from citations');
    expect(output).toContain('Commands:');
    expect(output).toContain('links');
    expect(output).toContain('Extract content from all links in source document');
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- extract-command.test.js`

Expected: FAIL - Help text incomplete

### Step 3: Enhance extract command description

Update base extract command in `citation-manager.js`:

```tsx
program
  .command('extract')
  .description('Extract content from citations\n\n' +
    'Subcommands:\n' +
    '  links <source-file>  Extract from all links in source document\n' +
    '  header <file> <name> Extract specific header section (future)\n' +
    '  file <file>          Extract complete file content (future)')
  .action(() => {
    console.error('Error: subcommand required (links, header, file)');
    console.error('Run "citation-manager extract --help" for available subcommands');
    process.exit(1);
  });
```

### Step 4: Run test to verify it passes

Run: `npm test -- extract-command.test.js`

Expected: PASS (9/9 tests)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 19: CLI - Extract Links Help Documentation

### Files
- `tools/citation-manager/src/citation-manager.js` (MODIFY)
- `tools/citation-manager/test/cli-integration/extract-command.test.js` (MODIFY)

### Purpose
Add detailed help text for extract links subcommand with usage examples (US2.3 AC11).

### Step 1: Write failing test for extract links help

Add to `extract-command.test.js`:

```javascript
describe('Extract Links - Help Documentation', () => {
  it('should display detailed help for extract links subcommand', () => {
    // Given: citation-manager CLI

    // When: Request help for extract links
    const output = execSync(
      'node tools/citation-manager/src/citation-manager.js extract links --help',
      { encoding: 'utf8' }
    );

    // Then: Help includes usage, options, examples, and exit codes
    expect(output).toContain('Usage: citation-manager extract links');
    expect(output).toContain('Options:');
    expect(output).toContain('--scope');
    expect(output).toContain('--full-files');
    expect(output).toContain('Examples:');
    expect(output).toContain('Exit Codes:');
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- extract-command.test.js`

Expected: FAIL - Detailed help not present

### Step 3: Add comprehensive help to extract links subcommand

Update `extract links` command in `citation-manager.js`:

```tsx
program
  .command('extract links <source-file>')
  .description('Extract content from all links in source document\n\n' +
    'Workflow:\n' +
    '  Phase 1: Validate and discover all links in source file\n' +
    '  Phase 2: Extract content from eligible links\n' +
    '  Phase 3: Output deduplicated JSON structure\n\n' +
    'Examples:\n' +
    '  $ citation-manager extract links docs/design.md\n' +
    '  $ citation-manager extract links docs/design.md --full-files\n' +
    '  $ citation-manager extract links docs/design.md --scope ./docs\n\n' +
    'Exit Codes:\n' +
    '  0  At least one link extracted successfully\n' +
    '  1  No eligible links or all extractions failed\n' +
    '  2  System error (file not found, permission denied)')
  .option('--scope <folder>', 'Limit file resolution to folder')
  .option('--format <type>', 'Output format (reserved for future)', 'json')
  .option('--full-files', 'Enable full-file link extraction (default: sections only)')
  .action(async (sourceFile, options) => {
    const manager = new CitationManager();
    try
      await manager.extractLinks(sourceFile, options);
    catch (error) is
      console.error('ERROR:', error.message);
      process.exitCode = 2;
  });
```

### Step 4: Run test to verify it passes

Run: `npm test -- extract-command.test.js`

Expected: PASS (10/10 tests)

### Step 5: Create commit

Use `create-git-commit` skill

---

## Task 20: Integration Test - Extract Links E2E Workflow

### Files
- `tools/citation-manager/test/cli-integration/extract-links-e2e.test.js` (CREATE)
- `tools/citation-manager/test/fixtures/extract-test-source.md` (CREATE)
- `tools/citation-manager/test/fixtures/extract-test-target-1.md` (CREATE)
- `tools/citation-manager/test/fixtures/extract-test-target-2.md` (CREATE)

### Purpose
Validate complete end-to-end workflow with real fixtures (US2.3 AC10). Tests validation → extraction → output pipeline.

### Step 1: Create test fixtures

Create `tools/citation-manager/test/fixtures/extract-test-source.md`:

```markdown
# Test Source Document

This document contains test citations for extraction.

## Section Links
- [Valid Section Link](extract-test-target-1.md#Section%20One)
- [Another Section](extract-test-target-2.md#Introduction)

## Full File Links
- [Full File Link](extract-test-target-1.md) %%extract-link%%

## Internal Links
- [Internal Anchor](#Section%20Links)
```

Create `extract-test-target-1.md`:

```markdown
# Target Document One

## Section One
This is the content of section one.

## Section Two
This is section two content.
```

Create `extract-test-target-2.md`:

```markdown
# Target Document Two

## Introduction
Introduction content here.
```

### Step 2: Write E2E integration test

Create `extract-links-e2e.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

describe('Extract Links - End-to-End Integration', () => {
  it('should complete full extraction workflow with real fixtures', () => {
    // Given: Source file with mixed link types
    const sourceFile = join(__dirname, '../fixtures/extract-test-source.md');

    // When: Execute extract links with --full-files flag
    const output = execSync(
      `node tools/citation-manager/src/citation-manager.js extract links "${sourceFile}" --full-files`,
      { encoding: 'utf8' }
    );

    // Then: Complete OutgoingLinksExtractedContent structure returned
    const result = JSON.parse(output);

    // Verification: Three logical groups present
    expect(result.extractedContentBlocks).toBeDefined();
    expect(result.outgoingLinksReport).toBeDefined();
    expect(result.stats).toBeDefined();

    // Verification: Section links extracted
    expect(result.stats.uniqueContent).toBeGreaterThanOrEqual(2);

    // Verification: Full-file link extracted (force marker)
    const fullFileLink = result.outgoingLinksReport.processedLinks.find(
      l => l.linkTargetAnchor === null
    );
    expect(fullFileLink.extractionStatus).toBe('success');

    // Verification: Internal link skipped
    const internalLink = result.outgoingLinksReport.processedLinks.find(
      l => l.linkTargetPathRaw === '#Section%20Links'
    );
    expect(internalLink).toBeUndefined(); // Filtered before processing
  });
});
```

### Step 3: Run test to verify it passes

Run: `npm test -- extract-links-e2e.test.js`

Expected: PASS - Complete workflow validated

### Step 4: Create commit

Use `create-git-commit` skill

---

## Task 21: Regression Validation

### Files
None (test execution only)

### Purpose
Run complete test suite to verify zero regressions across US2.1, US2.2, US2.2a, and US2.3.

### Step 1: Run full test suite

Run: `npm test`

Expected: All tests pass (US2.1: 35+ tests, US2.2: 30+ tests, US2.2a: 20+ tests, US2.3: 25+ tests)

### Step 2: Verify no regressions

Review test output for failures. All existing tests from previous user stories must continue passing.

### Step 3: Create final comprehensive commit

Use `create-git-commit` skill to create single commit representing complete US2.3 implementation:

```bash
git add .
git commit -m "feat(citation-manager): implement extract links subcommand (US2.3)

Implements citation-manager extract links <source-file> CLI subcommand with
two-phase orchestration workflow: (1) validate and discover links in source
document, (2) extract content from validated links using ContentExtractor.

Architecture:
- CLI Orchestrator coordinates validator → extractor → output pipeline
- CitationManager.extractLinks() implements three-phase workflow
- LinkObjectFactory created for future extract header/file support
- Separation of concerns: validator validates, extractor extracts, CLI orchestrates

Components Added:
- LinkObjectFactory: Level 4 helper for synthetic LinkObject creation
- CitationManager.extractLinks(): Orchestration method with three phases
- Commander extract command: Base command with subcommand structure
- Commander extract links subcommand: Full argument/option definitions

Features:
- Phase 1: Validator discovers and enriches links with validation metadata
- Phase 2: ContentExtractor processes eligible links with strategy chain
- Phase 3: Output deduplicated OutgoingLinksExtractedContent to stdout
- --full-files flag: Enables CliFlagStrategy for full-file extraction
- --scope option: Limits file resolution to specified folder
- Validation error reporting: Phase 1 errors reported to stderr before extraction
- Exit codes: 0 (success), 1 (no eligible links), 2 (system error)
- Comprehensive help: Top-level and subcommand help with examples

Testing:
- LinkObjectFactory unit tests (4 tests)
- ComponentFactory integration tests (2 tests)
- CitationManager unit tests (4 tests)
- CLI integration tests (10 tests)
- E2E workflow test (1 test)
- Zero regressions: All US2.1, US2.2, US2.2a tests pass

Acceptance Criteria:
✅ AC1: extract links subcommand implemented
✅ AC2: --scope, --format, --full-files options supported
✅ AC3: Two-phase workflow coordinated by CLI
✅ AC4: Pre-validated enriched links passed to extractor
✅ AC5: Validation errors reported to stderr
✅ AC6: Content extracted only from valid, eligible links
✅ AC7: Exit code 0 when stats.uniqueContent > 0
✅ AC8: Exit code 1 when no eligible links
✅ AC9: Existing validate command functionality preserved
✅ AC10: CLI integration tests validate E2E workflow
✅ AC11: Comprehensive help documentation for extract and extract links
✅ AC12: --full-files flag enables full-file extraction

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 4: Verify commit created successfully

Run: `git log -1 --stat`

Expected: Single commit with all US2.3 changes listed

---

## Post-Implementation: Merge to Main Branch

After Task 21 complete, use `finishing-a-development-branch` skill to present merge options to user.
