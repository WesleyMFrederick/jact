<!-- markdownlint-disable MD025 -->
# CLI Integration Guide

## Problem

The citation-manager CLI currently provides validation, fixing, and AST inspection commands, but lacks the ability to extract and aggregate content from citations. The `extract` command must integrate the ContentExtractor component into the CLI orchestrator, handle validation errors appropriately, format extraction results as JSON output, and provide proper exit codes for CI/CD integration.

Without a dedicated CLI command, users cannot leverage the content extraction workflow from US2.2, forcing them to manually gather context from distributed documentation files - the exact manual process this feature was designed to eliminate.

## Solution

Implement an `extract` command in the citation-manager CLI that orchestrates the complete content extraction workflow: validation → eligibility analysis → content retrieval → aggregation. The command follows the existing CLI patterns established by the `validate` command, using factory-based component instantiation, option parsing for scope and flags, and structured output formatting.

The command returns raw OutgoingLinksExtractedContent arrays as JSON to stdout (per US2.3 AC7), with validation errors reported to stderr. Exit codes follow CI/CD conventions: 0 for any successful extraction, non-zero only when all extractions fail.

---

## Current MVP Implementation

### Extract Command Handler

The `extract` command follows the same orchestration pattern as the existing `validate` command, but with a focus on content aggregation rather than validation reporting.

**Pseudocode (Implementation-Ready Pattern)**:

```typescript
/**
 * CLI Command: extract
 * Extracts and aggregates content from citations in a markdown file
 */
program
  .command("extract")
  .description("Extract content from citations in a markdown file")
  .argument("<file>", "path to markdown file containing citations")
  .option("--format <type>", "output format (json)", "json")
  .option("--scope <folder>", "limit file resolution to specific folder")
  .option("--full-files", "enable extraction of full-file links without markers")
  .action(async (file, options) => {
    // --- 1. Component Instantiation ---
    // Use factory pattern (mirrors validate command)
    const manager = new CitationManager()
    // manager.contentExtractor created via createContentExtractor() in constructor

    // --- 2. Build File Cache (if scope provided) ---
    if (options.scope) {
      const cacheStats = manager.fileCache.buildCache(options.scope)
      // Output cache stats to stderr to keep stdout clean for JSON
      console.error(`Scanned ${cacheStats.totalFiles} files in ${cacheStats.scopeFolder}`)
      if (cacheStats.duplicates > 0) {
        console.error(`WARNING: Found ${cacheStats.duplicates} duplicate filenames`)
      }
    }

    // --- 3. Execute Extraction Workflow ---
    try {
      // Call ContentExtractor.extractLinksContent() (US2.2 AC2)
      // This internally calls citationValidator.validateFile() (US2.2 AC3)
      const OutgoingLinksExtractedContents = await manager.contentExtractor.extractLinksContent(
        file,
        { fullFiles: options.fullFiles } // CLI flags object
      )

      // --- 4. Report Validation Errors to stderr (US2.3 AC5) ---
      const validationErrors = OutgoingLinksExtractedContents.filter(result =>
        result.status === 'skipped' &&
        result.failureDetails?.reason?.startsWith('Link failed validation')
      )

      if (validationErrors.length > 0) {
        console.error("\nVALIDATION ERRORS:")
        for (const error of validationErrors) {
          console.error(`  Line ${error.sourceLink.line}: ${error.failureDetails.reason}`)
        }
        console.error("") // Blank line for readability
      }

      // --- 5. Output OutgoingLinksExtractedContent Array to stdout (US2.3 AC7) ---
      // Raw JSON output for programmatic consumption
      console.log(JSON.stringify(OutgoingLinksExtractedContents, null, 2))

      // --- 6. Exit Code Logic (US2.3 AC7, AC8) ---
      const hasSuccessfulExtraction = OutgoingLinksExtractedContents.some(result => result.status === 'success')

      if (hasSuccessfulExtraction) {
        process.exit(0) // At least one link extracted successfully
      } else {
        process.exit(1) // All links failed or were skipped
      }

    } catch (error) {
      // --- 7. Error Handling for Catastrophic Failures ---
      console.error(`ERROR: ${error.message}`)
      console.log(JSON.stringify({
        error: error.message,
        file: file,
        success: false
      }, null, 2))
      process.exit(2) // Source file not found or un-parsable
    }
  })
```

### Factory Instantiation Pattern

The `CitationManager` constructor instantiates the ContentExtractor using the factory pattern, mirroring the existing component initialization approach:

```typescript
/**
 * CitationManager constructor enhancement for ContentExtractor
 */
class CitationManager {
  constructor() {
    // Existing components (unchanged)
    this.parser = createMarkdownParser()
    this.parsedFileCache = createParsedFileCache(this.parser)
    this.fileCache = createFileCache()
    this.validator = createCitationValidator(this.parsedFileCache, this.fileCache)

    // New component: ContentExtractor (US2.3 AC3)
    this.contentExtractor = createContentExtractor(
      this.parsedFileCache,
      this.validator,
      null // Use default eligibility strategies
    )
  }
}
```

**Factory Implementation** (from Content Extractor Implementation Guide):

```javascript
/**
 * Create content extractor with full dependencies
 *
 * @param {ParsedFileCache|null} parsedFileCache - Optional cache override
 * @param {CitationValidator|null} validator - Optional validator override
 * @param {ExtractionStrategy[]|null} strategies - Optional strategy override
 * @returns {ContentExtractor} Fully configured ContentExtractor instance
 */
export function createContentExtractor(
  parsedFileCache = null,
  validator = null,
  strategies = null
) {
  const _parsedFileCache = parsedFileCache || createParsedFileCache()
  const _validator = validator || createCitationValidator()
  const _strategies = strategies || [
    new StopMarkerStrategy(),
    new ForceMarkerStrategy(),
    new SectionLinkStrategy(),
    new CliFlagStrategy(),
  ]

  return new ContentExtractor(_parsedFileCache, _validator, _strategies)
}
```

### Argument Parsing

The command accepts CLI flags that map directly to the `cliFlags` object passed to ContentExtractor:

**CLI Flag → ContentExtractor Mapping**:

| CLI Option | Default | ContentExtractor Field | Used By |
|------------|---------|------------------------|---------|
| `--full-files` | false | `cliFlags.fullFiles` | CliFlagStrategy |
| `--scope <dir>` | undefined | (File cache only) | Smart filename resolution |
| `--format <type>` | "json" | (CLI output only) | Format control (future) |

**Option Parsing Example**:

```javascript
// CLI parses: extract file.md --scope ./docs --full-files
// Results in:
options = {
  scope: './docs',
  fullFiles: true,
  format: 'json'
}

// Passed to ContentExtractor as:
cliFlags = {
  fullFiles: options.fullFiles // CliFlagStrategy checks this
}
```

### Error Reporting Workflow

The CLI separates validation errors (stderr) from extraction results (stdout) to maintain clean JSON output for programmatic consumption:

**Error Reporting Pattern**:

```typescript
// --- Validation Error Reporting (stderr) ---
// US2.3 AC5: Report validation errors clearly
const validationErrors = OutgoingLinksExtractedContents.filter(result =>
  result.status === 'skipped' &&
  result.failureDetails?.reason?.startsWith('Link failed validation')
)

if (validationErrors.length > 0) {
  console.error("\nVALIDATION ERRORS:") // Human-readable header
  for (const error of validationErrors) {
    // Extract line number and reason from OutgoingLinksExtractedContent
    console.error(`  Line ${error.sourceLink.line}: ${error.failureDetails.reason}`)
    // Example output: "Line 42: Link failed validation: Target file does not exist"
  }
  console.error("") // Blank line separator
}

// --- Extraction Results (stdout) ---
// US2.3 AC7: Output raw OutgoingLinksExtractedContent array as JSON
console.log(JSON.stringify(OutgoingLinksExtractedContents, null, 2))
```

**Rationale**: Separation ensures `extract file.md > output.json` captures only OutgoingLinksExtractedContent data, while users still see validation warnings in the terminal.

### JSON Output Formatting

The command outputs the complete OutgoingLinksExtractedContent array as valid JSON to stdout, enabling programmatic consumption and future pipeline integration:

**Output Structure**:

```json
[
  {
    "sourceLink": {
      "linkType": "markdown",
      "line": 42,
      "column": 5,
      "fullMatch": "[Architecture](./architecture.md#component-diagram)",
      "target": {
        "path": { "absolute": "/path/to/architecture.md" },
        "anchor": "component-diagram"
      },
      "anchorType": "header",
      "validation": {
        "status": "valid"
      }
    },
    "status": "success",
    "successDetails": {
      "decisionReason": "Section links eligible by default",
      "extractedContent": "## Component Diagram\n\nThe system consists of..."
    }
  },
  {
    "sourceLink": {
      "linkType": "markdown",
      "line": 58,
      "fullMatch": "[README](./README.md)",
      "validation": {
        "status": "valid"
      }
    },
    "status": "skipped",
    "failureDetails": {
      "reason": "Link not eligible for extraction: Full-file links require --full-files flag"
    }
  },
  {
    "sourceLink": {
      "linkType": "markdown",
      "line": 73,
      "validation": {
        "status": "error",
        "error": "Target file does not exist"
      }
    },
    "status": "skipped",
    "failureDetails": {
      "reason": "Link failed validation: Target file does not exist"
    }
  }
]
```

**Output Characteristics**:
- Each array element is a complete OutgoingLinksExtractedContent (sourceLink + status + details)
- sourceLink preserves complete LinkObject for debugging and context
- status discriminates between 'success', 'skipped', 'error'
- successDetails present only when status === 'success'
- failureDetails present when status === 'skipped' or 'error'

### Exit Code Logic

Exit codes follow CI/CD conventions for pipeline integration:

**Exit Code Strategy**:

```typescript
// US2.3 AC7: Exit 0 if any successful extraction
// US2.3 AC8: Exit non-zero if all fail
const hasSuccessfulExtraction = OutgoingLinksExtractedContents.some(result =>
  result.status === 'success'
)

if (hasSuccessfulExtraction) {
  process.exit(0) // Success: at least one link extracted
} else {
  process.exit(1) // Failure: no successful extractions
}

// Catastrophic errors (file not found, parser crash) exit with code 2
catch (error) {
  console.error(`ERROR: ${error.message}`)
  process.exit(2)
}
```

**Exit Code Semantics**:

| Code | Condition | Meaning |
|------|-----------|---------|
| 0 | At least one `status: 'success'` | Extraction succeeded (even if some links skipped/failed) |
| 1 | All results are `skipped` or `error` | No content extracted (eligibility or validation failures) |
| 2 | Exception thrown before extraction | Catastrophic failure (file not found, parser crash) |

**Rationale**: Exit code 0 with partial success enables "best effort" workflows where some broken links don't block context generation.

---

## Planned Refactoring

### Command Pattern Extraction

**Current State**: Extract command logic embedded in CLI action handler (inline function).

**Future Enhancement**: Extract command logic into dedicated Command class for testability and reusability.

```typescript
/**
 * Command pattern for extract workflow
 * Enables direct testing without subprocess overhead
 */
class ExtractCommand {
  constructor(contentExtractor, fileCache) {
    this.contentExtractor = contentExtractor
    this.fileCache = fileCache
  }

  async execute(sourceFilePath, options) {
    // Build file cache if scope provided
    if (options.scope) {
      this.fileCache.buildCache(options.scope)
    }

    // Execute extraction workflow
    const results = await this.contentExtractor.extractLinksContent(
      sourceFilePath,
      { fullFiles: options.fullFiles }
    )

    // Return structured output (command pattern)
    return {
      OutgoingLinksExtractedContents: results,
      validationErrors: this.extractValidationErrors(results),
      exitCode: this.determineExitCode(results)
    }
  }

  extractValidationErrors(results) {
    return results.filter(result =>
      result.status === 'skipped' &&
      result.failureDetails?.reason?.startsWith('Link failed validation')
    )
  }

  determineExitCode(results) {
    const hasSuccess = results.some(r => r.status === 'success')
    return hasSuccess ? 0 : 1
  }
}

// CLI action handler becomes thin wrapper
.action(async (file, options) => {
  const command = new ExtractCommand(manager.contentExtractor, manager.fileCache)
  const { OutgoingLinksExtractedContents, validationErrors, exitCode } = await command.execute(file, options)

  // Handle output and exit
  formatAndOutput(OutgoingLinksExtractedContents, validationErrors)
  process.exit(exitCode)
})
```

**Benefits**:
- Direct import testing (bypass subprocess buffer limits)
- Unit test command logic in isolation
- Reuse command in programmatic APIs
- Align with workspace testing principles

**Priority**: Medium (enables better testing per workspace architecture principles, but subprocess workaround is acceptable for MVP)

### Output Formatter Separation

**Current State**: JSON formatting hardcoded in action handler.

**Future Enhancement**: Separate formatter for multiple output formats (JSON, markdown, inline replacement).

```typescript
/**
 * Output formatter interface for extensibility
 */
class OutgoingLinksExtractedContentFormatter {
  format(OutgoingLinksExtractedContents, options) {
    // Override in subclasses
  }
}

class JSONFormatter extends OutgoingLinksExtractedContentFormatter {
  format(OutgoingLinksExtractedContents, options) {
    return JSON.stringify(OutgoingLinksExtractedContents, null, 2)
  }
}

class MarkdownFormatter extends OutgoingLinksExtractedContentFormatter {
  format(OutgoingLinksExtractedContents, options) {
    // Future: Format as structured markdown document
    // with headers identifying source files/sections
    const lines = []
    for (const result of OutgoingLinksExtractedContents) {
      if (result.status === 'success') {
        lines.push(`## ${result.sourceLink.fullMatch}`)
        lines.push(result.successDetails.extractedContent)
        lines.push("")
      }
    }
    return lines.join("\n")
  }
}

// Usage in CLI
const formatter = options.format === 'json'
  ? new JSONFormatter()
  : new MarkdownFormatter()

console.log(formatter.format(OutgoingLinksExtractedContents, options))
```

**Deferred Scope Note**: Output formatting beyond raw JSON (markdown headers, file writing, `--output` option) has been explicitly deferred. See [Content Extractor Implementation Guide - Future Work](Content%20Extractor%20Implementation%20Guide.md#Future%20Work) for details.

**Priority**: Low (MVP uses JSON only; markdown formatting deferred pending user feedback on raw output utility)

### Configuration Layer Integration

**Current State**: CLI options passed directly to components.

**Future Enhancement**: Configuration service for persistent settings (default scope, format preferences, custom strategies).

```typescript
/**
 * Configuration service for CLI preferences
 */
class ConfigurationService {
  constructor(configFilePath = '.citation-manager.json') {
    this.config = this.loadConfig(configFilePath)
  }

  loadConfig(filePath) {
    // Load JSON config from disk or return defaults
    return {
      defaultScope: null,
      defaultFormat: 'json',
      customStrategies: [],
      outputOptions: {}
    }
  }

  merge(cliOptions) {
    // Merge CLI options with config file (CLI takes precedence)
    return { ...this.config, ...cliOptions }
  }
}

// Usage in CLI
const config = new ConfigurationService()
const mergedOptions = config.merge(options)
```

**Benefits**:
- Project-specific defaults (avoid repeating `--scope ./docs`)
- Custom strategy registration for domain-specific markers
- Team-shared configuration via version control

**Priority**: Low (nice-to-have for power users; not blocking core functionality)

---

## Integration with ContentExtractor

The CLI acts as a thin orchestration layer, delegating all extraction logic to the ContentExtractor component. The integration follows the workflow defined in the [ContentExtractor Workflow: Component Interaction Diagram](Content%20Extractor%20Implementation%20Guide.md#ContentExtractor%20Workflow%20Component%20Interaction%20Diagram).

**Integration Pattern**:

```typescript
// CLI instantiates ContentExtractor via factory (US2.3 AC3)
const contentExtractor = createContentExtractor(parsedFileCache, validator, strategies)

// CLI calls single orchestration method (US2.3 AC4)
const OutgoingLinksExtractedContents = await contentExtractor.extractLinksContent(
  sourceFilePath,
  { fullFiles: options.fullFiles } // CLI flags → cliFlags object
)

// ContentExtractor internally:
// 1. Calls validator.validateFile() to get enriched links (US2.2 AC3)
// 2. Filters by eligibility using strategy chain (US2.2 AC4)
// 3. Retrieves content from target documents via parsedFileCache (US2.2 AC5-7)
// 4. Returns array of OutgoingLinksExtractedContent objects (US2.2 AC9)

// CLI handles final I/O (validation errors to stderr, results to stdout)
```

**Key Abstraction**: The CLI never directly interacts with MarkdownParser, ParsedDocument, or eligibility strategies. All complexity is encapsulated behind the `ContentExtractor.extractLinksContent()` interface.

**Data Flow**:

```text
User Command
    ↓
CLI Option Parser
    ↓
CitationManager (factory instantiation)
    ↓
ContentExtractor.extractLinksContent(sourceFilePath, cliFlags)
    ↓
[ContentExtractor Internal Workflow]
    ├─ CitationValidator.validateFile() → enriched LinkObjects
    ├─ Strategy chain → filter eligible links
    └─ ParsedFileCache → retrieve content from target documents
    ↓
OutgoingLinksExtractedContent[] (returned to CLI)
    ↓
CLI Output Formatting (JSON to stdout, errors to stderr)
    ↓
Exit Code (0 for success, 1 for failure, 2 for catastrophic error)
```

---

## Error Handling Specification

The extract command handles three categories of errors with distinct reporting strategies:

### Validation Errors (Reported to stderr)

**Scenario**: Links that fail validation (broken targets, missing files).

**Detection**: `result.status === 'skipped' && result.failureDetails?.reason?.startsWith('Link failed validation')`

**Reporting**:

```text
VALIDATION ERRORS:
  Line 42: Link failed validation: Target file does not exist
  Line 58: Link failed validation: Anchor not found: #missing-section
```

**Exit Code**: 0 if other links succeed, 1 if all fail

**Example OutgoingLinksExtractedContent**:

```json
{
  "sourceLink": { "line": 42, "fullMatch": "[broken](missing.md)" },
  "status": "skipped",
  "failureDetails": {
    "reason": "Link failed validation: Target file does not exist"
  }
}
```

### Eligibility Skips (Included in JSON output, not reported to stderr)

**Scenario**: Valid links that don't meet extraction eligibility criteria.

**Detection**: `result.status === 'skipped' && !result.failureDetails?.reason?.startsWith('Link failed validation')`

**Reporting**: Only visible in JSON output (not stderr warnings)

**Exit Code**: 0 if other links succeed, 1 if all skipped

**Example OutgoingLinksExtractedContent**:

```json
{
  "sourceLink": { "line": 58, "fullMatch": "[README](./README.md)" },
  "status": "skipped",
  "failureDetails": {
    "reason": "Link not eligible for extraction: Full-file links require --full-files flag"
  }
}
```

**Rationale**: Eligibility decisions are intentional filtering, not errors. Users can see them in JSON output but shouldn't be alarmed by stderr warnings.

### Extraction Errors (Included in JSON output)

**Scenario**: Eligible links where content extraction fails at runtime.

**Detection**: `result.status === 'error'`

**Reporting**: Only visible in JSON output

**Exit Code**: 0 if other links succeed, 1 if all fail

**Example OutgoingLinksExtractedContent**:

```json
{
  "sourceLink": { "line": 73, "fullMatch": "[Architecture](./arch.md#component)" },
  "status": "error",
  "failureDetails": {
    "reason": "header anchor not found: component"
  }
}
```

**Common Error Reasons** (from [Content Extractor Error Handling Specification](Content%20Extractor%20Implementation%20Guide.md#Error%20Handling%20Specification)):
- `"header anchor not found: {decodedAnchor}"`
- `"block anchor not found: {blockId}"`
- `"Content extraction returned null"`
- `"Cannot read target file: {targetPath}"`

### Catastrophic Errors (Exit code 2)

**Scenario**: Failures before extraction begins (file not found, parser crash, invalid arguments).

**Detection**: Exception thrown in try/catch block

**Reporting**:

```text
ERROR: Source file not found: /path/to/missing-file.md
```

**JSON Output** (for programmatic consumption):

```json
{
  "error": "Source file not found: /path/to/missing-file.md",
  "file": "/path/to/missing-file.md",
  "success": false
}
```

**Exit Code**: 2 (distinguishes from partial failure exit code 1)

---

## Testing Strategy

The extract command requires CLI integration tests that validate the complete end-to-end workflow from user input to JSON output. Testing follows the workspace "Real Systems, Fake Fixtures" principle.

### CLI Integration Tests (US2.3 AC10)

**Test Approach**: Use subprocess execution with shell redirection to bypass stdio buffer limits (per Technical Lead Feedback on CLI Testing Buffer Limits).

**Test Helper Pattern**:

```javascript
/**
 * Execute CLI command via subprocess with output redirection
 * Workaround for buffer limits when testing large JSON output
 */
async function runExtractCommand(sourceFile, options = {}) {
  const { execSync } = await import('node:child_process')
  const tmpFile = `/tmp/extract-output-${Date.now()}.json`

  // Build command with redirection to temp file
  let cmd = `node tools/citation-manager/src/citation-manager.js extract ${sourceFile}`

  if (options.scope) cmd += ` --scope ${options.scope}`
  if (options.fullFiles) cmd += ' --full-files'
  cmd += ` > ${tmpFile} 2>&1` // Redirect both stdout and stderr

  try {
    execSync(cmd)
    const output = readFileSync(tmpFile, 'utf8')
    return {
      stdout: output,
      exitCode: 0
    }
  } catch (error) {
    const output = readFileSync(tmpFile, 'utf8')
    return {
      stdout: output,
      exitCode: error.status || 1
    }
  } finally {
    if (existsSync(tmpFile)) unlinkSync(tmpFile)
  }
}
```

**Test Scenarios**:

```javascript
describe('extract command - CLI integration', () => {
  test('extracts content from valid section links', async () => {
    // Setup: Create fixture with section links
    const sourceFile = 'test/fixtures/context-package.md'
    // Contains: [Architecture](./architecture.md#component-diagram)

    // Execute: Run extract command
    const result = await runExtractCommand(sourceFile, { scope: 'test/fixtures' })

    // Verify: Parse JSON output
    const OutgoingLinksExtractedContents = JSON.parse(result.stdout)
    expect(OutgoingLinksExtractedContents).toBeInstanceOf(Array)
    expect(OutgoingLinksExtractedContents[0]).toMatchObject({
      sourceLink: expect.objectContaining({
        fullMatch: '[Architecture](./architecture.md#component-diagram)',
        anchorType: 'header'
      }),
      status: 'success',
      successDetails: expect.objectContaining({
        decisionReason: expect.stringContaining('Section links eligible'),
        extractedContent: expect.stringContaining('## Component Diagram')
      })
    })

    // Verify: Exit code 0 for successful extraction
    expect(result.exitCode).toBe(0)
  })

  test('skips full-file links without --full-files flag', async () => {
    // Setup: Fixture with full-file link
    const sourceFile = 'test/fixtures/full-file-links.md'
    // Contains: [README](./README.md)

    // Execute: Without --full-files flag
    const result = await runExtractCommand(sourceFile)

    // Verify: Link skipped with eligibility reason
    const OutgoingLinksExtractedContents = JSON.parse(result.stdout)
    expect(OutgoingLinksExtractedContents[0]).toMatchObject({
      status: 'skipped',
      failureDetails: {
        reason: expect.stringContaining('Full-file links require --full-files flag')
      }
    })

    // Verify: Exit code 1 when all links skipped
    expect(result.exitCode).toBe(1)
  })

  test('extracts full-file links with --full-files flag', async () => {
    // Setup: Same fixture
    const sourceFile = 'test/fixtures/full-file-links.md'

    // Execute: With --full-files flag
    const result = await runExtractCommand(sourceFile, { fullFiles: true })

    // Verify: Link extracted successfully
    const OutgoingLinksExtractedContents = JSON.parse(result.stdout)
    expect(OutgoingLinksExtractedContents[0]).toMatchObject({
      status: 'success',
      successDetails: {
        decisionReason: expect.stringContaining('CLI flag --full-files'),
        extractedContent: expect.stringContaining('# README')
      }
    })

    // Verify: Exit code 0 for successful extraction
    expect(result.exitCode).toBe(0)
  })

  test('reports validation errors to stderr and continues extraction', async () => {
    // Setup: Fixture with mixed valid and broken links
    const sourceFile = 'test/fixtures/mixed-validation.md'
    // Contains:
    // - [Valid](./valid.md#section) ← should extract
    // - [Broken](./missing.md) ← validation error, should skip

    // Execute: Extract command
    const result = await runExtractCommand(sourceFile)

    // Verify: Validation errors mentioned in output
    expect(result.stdout).toContain('VALIDATION ERRORS')
    expect(result.stdout).toContain('Link failed validation: Target file does not exist')

    // Verify: Valid link still extracted
    const OutgoingLinksExtractedContents = JSON.parse(result.stdout.split('\n').filter(line => line.startsWith('[')).join(''))
    const successResults = OutgoingLinksExtractedContents.filter(r => r.status === 'success')
    expect(successResults.length).toBeGreaterThan(0)

    // Verify: Exit code 0 because at least one link succeeded
    expect(result.exitCode).toBe(0)
  })

  test('exits with code 2 for catastrophic errors', async () => {
    // Setup: Non-existent source file
    const sourceFile = 'test/fixtures/does-not-exist.md'

    // Execute: Extract command (should throw before extraction)
    const result = await runExtractCommand(sourceFile)

    // Verify: Error message in output
    expect(result.stdout).toContain('ERROR:')
    expect(result.stdout).toContain('does-not-exist.md')

    // Verify: Exit code 2 for catastrophic failure
    expect(result.exitCode).toBe(2)
  })

  test('respects --scope for smart filename resolution', async () => {
    // Setup: Fixture with short filename link
    const sourceFile = 'test/fixtures/short-filenames.md'
    // Contains: [Architecture](architecture.md) ← short filename

    // Execute: With --scope flag
    const result = await runExtractCommand(sourceFile, {
      scope: 'test/fixtures/nested-docs'
    })

    // Verify: Smart resolution finds file in nested directory
    const OutgoingLinksExtractedContents = JSON.parse(result.stdout)
    expect(OutgoingLinksExtractedContents[0]).toMatchObject({
      status: 'success',
      successDetails: expect.objectContaining({
        extractedContent: expect.any(String)
      })
    })
  })
})
```

**Key Testing Characteristics**:
- Real file system operations (workspace principle: "Real Systems, Fake Fixtures")
- Real ContentExtractor, CitationValidator, ParsedFileCache components
- Subprocess execution with redirection (workaround for buffer limits)
- Validation of JSON structure and content
- Exit code verification for CI/CD integration
- Mixed scenarios (success/failure/partial success)

### Unit Tests for Command Logic (Future)

Once Command Pattern extraction is implemented, unit tests can validate command logic without subprocess overhead:

```javascript
describe('ExtractCommand - unit tests', () => {
  test('determines exit code correctly for partial success', () => {
    const command = new ExtractCommand(mockExtractor, mockCache)

    const mixedResults = [
      { status: 'success', successDetails: { extractedContent: '...' } },
      { status: 'skipped', failureDetails: { reason: '...' } },
      { status: 'error', failureDetails: { reason: '...' } }
    ]

    const exitCode = command.determineExitCode(mixedResults)
    expect(exitCode).toBe(0) // At least one success
  })

  test('filters validation errors correctly', () => {
    const command = new ExtractCommand(mockExtractor, mockCache)

    const results = [
      { status: 'skipped', failureDetails: { reason: 'Link failed validation: Target missing' } },
      { status: 'skipped', failureDetails: { reason: 'Not eligible: requires --full-files' } }
    ]

    const validationErrors = command.extractValidationErrors(results)
    expect(validationErrors.length).toBe(1) // Only validation failure
    expect(validationErrors[0].failureDetails.reason).toContain('Link failed validation')
  })
})
```

---

## Related Documentation

- [Content Extractor Implementation Guide](Content%20Extractor%20Implementation%20Guide.md) - ContentExtractor workflow and architecture
- [content-aggregation-prd.md](../features/20251003-content-aggregation/content-aggregation-prd.md) - US2.3 acceptance criteria
- [us2.3-implement-extract-command](../features/20251003-content-aggregation/user-stories/us2.3-implement-extract-command/us2.3-implement-extract-command.md) - Detailed user story
- [Architecture - Baseline](../../../../../design-docs/Architecture%20-%20Baseline.md#Technical%20Debt%20CLI%20Subprocess%20Testing%20Buffer%20Limits) - CLI testing technical debt

---

## Whiteboard

### Design Decision: Separate Command vs. Validate Flag

**Question**: Should extraction be a flag on the `validate` command or a separate `extract` command?

**Decision**: Separate `extract` command (per Technical Lead Feedback in PRD).

**Rationale**:
- **Different Operations**: Validation reports problems; extraction produces content
- **Different Inputs**: Extract requires `--output` option (future), validate doesn't
- **Different Outputs**: Extract produces aggregated content; validate produces validation report
- **Different Workflows**: Validation is a prerequisite step inside extraction (not a variant)
- **Clear Intent**: `extract` command name clearly signals content aggregation purpose

**Architecture Reference**: [ContentExtractor Workflow Diagram](Content%20Extractor%20Implementation%20Guide.md#ContentExtractor%20Workflow%20Component%20Interaction%20Diagram) shows validation as internal step, not parallel operation.

### Future Enhancement: Streaming Output for Large Extractions

**Context**: Current implementation buffers entire OutgoingLinksExtractedContent array in memory before outputting.

**Future Improvement**: Stream OutgoingLinksExtractedContent objects as newline-delimited JSON (NDJSON) for memory efficiency:

```typescript
// Current: Buffer entire array
const results = await contentExtractor.extractLinksContent(file, cliFlags)
console.log(JSON.stringify(results, null, 2))

// Future: Stream results as generated
for await (const result of contentExtractor.extractLinksContentStream(file, cliFlags)) {
  console.log(JSON.stringify(result)) // NDJSON format
}
```

**Benefits**:
- Process results incrementally (e.g., write to file as extracted)
- Reduce memory footprint for large context packages
- Enable progress indicators for long-running extractions

**Priority**: Low (MVP assumes context packages fit in memory; optimize when use cases demand it)
