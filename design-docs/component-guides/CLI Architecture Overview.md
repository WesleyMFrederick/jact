# CLI Architecture Overview

## Problem

The Citation Manager tool requires a command-line interface that can orchestrate multiple operations (validation, content extraction, AST inspection, path discovery) across a complex system of components (parsers, validators, caches, extractors). Without a clear architectural pattern, CLI commands would duplicate orchestration logic, creating:

1. **Scattered instantiation logic** - Each command reimplementing component factory calls and dependency injection
2. **Inconsistent error handling** - Different commands reporting errors in different formats and exit codes
3. **Duplicated argument parsing** - Each command implementing its own option handling and validation
4. **Unclear command boundaries** - No clear separation between CLI orchestration and business logic

## Solution

The **Citation Manager CLI** (`citation-manager.js`) serves as the thin orchestration layer that wires together core components using a **shared command registry pattern**. Each command follows a consistent structure: argument parsing via Commander.js, component instantiation via factory functions, delegation to business logic, and standardized output formatting.

The CLI maintains strict separation between **command orchestration** (CLI's responsibility) and **business logic** (component responsibility), ensuring the CLI remains focused on application coordination while components encapsulate domain expertise.

---

## Command Registry

The CLI exposes five commands, each accessible via `npm run citation:<command>`:

### 1. `validate` - Citation Validation with Auto-Fix

**Purpose**: Validate all citations in a markdown file, optionally fixing broken citations automatically

**Usage**:

```bash
npm run citation:validate <file-path> [-- --options]
```

**Options**:
- `--format <type>`: Output format (`cli` or `json`, default: `cli`)
- `--lines <range>`: Validate specific line range (e.g., `"150-160"` or `"157"`)
- `--scope <folder>`: Enable smart filename matching within folder
- `--fix`: Automatically fix broken citations (path corrections, anchor fixes)

**Component Dependencies**:
- `CitationValidator` - Validates links and enriches with metadata
- `ParsedFileCache` - Retrieves parsed documents
- `FileCache` - Resolves short filenames (when `--scope` provided)
- `MarkdownParser` - Parses markdown files

**Output**:
- CLI format: Human-readable tree-style validation report
- JSON format: Structured `ValidationResult` object
- Exit codes: 0 (success), 1 (validation errors), 2 (file not found)

**Detailed Guide**: [CitationValidator Implementation Guide](CitationValidator%20Implementation%20Guide.md)

---

### 2. `extract` - Content Aggregation (NEW - US2.3)

**Purpose**: Extract content from files referenced by citations for LLM context gathering

**Usage**:

```bash
npm run citation:extract <file-path> [-- --options]
```

**Options**:
- `--format <type>`: Output format (`json`, default: `json`)
- `--scope <folder>`: Enable smart filename resolution within folder
- `--full-files`: Force extraction of full-file links (without anchors)

**Component Dependencies**:
- `ContentExtractor` - Orchestrates extraction workflow
- `CitationValidator` - Validates and enriches links
- `ParsedFileCache` - Retrieves source and target documents
- `ParsedDocument` - Extracts sections, blocks, and full content

**Output**:
- JSON array of `OutgoingLinksExtractedContent` objects to stdout
- Error messages to stderr (extraction continues despite individual failures)
- Exit code: 0 (success), 1 (error)

**Workflow**:
1. Validates source file to discover enriched LinkObjects
2. Filters eligible links using Strategy Pattern (markers, flags, anchor types)
3. Extracts content from target documents via ParsedDocument facade
4. Returns array of results with status, source link, and content/error details

**Detailed Guide**: [Content Extractor Implementation Guide](Content%20Extractor%20Implementation%20Guide.md)

---

### 3. `ast` - AST Generation

**Purpose**: Display the Abstract Syntax Tree (AST) and extracted metadata from markdown parsing

**Usage**:

```bash
npm run citation:ast <file-path>
```

**Component Dependencies**:
- `MarkdownParser` - Parses markdown and generates AST

**Output**:
- JSON representation of the AST including tokens, links, and anchors
- Always outputs to stdout as formatted JSON

**Use Cases**:
- Debugging parser output
- Understanding markdown structure
- Validating link extraction

**Detailed Guide**: [Markdown Parser Implementation Guide](Markdown%20Parser%20Implementation%20Guide.md)

---

### 4. `base-paths` - Base Path Extraction

**Purpose**: Extract distinct base paths from all citations in a markdown file

**Usage**:

```bash
npm run citation:base-paths <file-path> [-- --options]
```

**Options**:
- `--format <type>`: Output format (`cli` or `json`, default: `cli`)

**Component Dependencies**:
- `CitationValidator` - Validates file and extracts links
- `ParsedFileCache` - Retrieves parsed documents

**Output**:
- CLI format: Numbered list of absolute paths
- JSON format: `{ file, basePaths, count }` object

**Use Cases**:
- Discovering document dependencies
- Building citation graphs
- Identifying missing files across references

---

### 5. `fix` - Auto-Fix Broken Citations

**Purpose**: Automatically fix broken citations in markdown files (in-place modification)

**Usage**:

```bash
npm run citation:fix <file-path> [-- --options]
```

**Options**:
- `--scope <folder>`: Enable smart filename resolution within folder

**Component Dependencies**:
- `CitationValidator` - Identifies fixable issues
- `ParsedFileCache` - Retrieves parsed documents
- `FileCache` - Resolves short filenames (when `--scope` provided)
- Node.js `fs` module - Reads and writes file content

**Fixable Issues**:
- Path corrections (cross-directory warnings with `pathConversion` suggestions)
- Anchor corrections (kebab-case to raw header format, missing anchor fuzzy matching)

**Output**:
- Summary of fixes applied (path corrections, anchor corrections)
- Detailed list of changes (line number, old citation, new citation)

**Safety**: Modifies file in-place - recommend version control or backups

---

## Shared Orchestration Pattern

All commands follow a consistent architectural pattern that separates CLI concerns from business logic:

### 1. Argument Parsing (Commander.js)

**Pattern**: Declarative command definitions with typed options

```javascript
program
  .command('validate')
  .description('Validate citations in a markdown file')
  .argument('<file>', 'path to markdown file to validate')
  .option('--format <type>', 'output format (cli, json)', 'cli')
  .option('--lines <range>', 'validate specific line range')
  .option('--scope <folder>', 'limit file resolution to specific folder')
  .option('--fix', 'automatically fix citation anchors')
  .action(async (file, options) => {
    // Command implementation
  });
```

**Responsibilities**:
- Define command name, arguments, and options
- Provide help text and descriptions
- Parse and validate CLI arguments
- Delegate to business logic

**Convention**: All file path arguments accept absolute or relative paths

---

### 2. Component Factory Instantiation

**Pattern**: Dependency Injection via factory functions

```javascript
const manager = new CitationManager();
// Internally calls createMarkdownParser(), createParsedFileCache(),
// createFileCache(), createCitationValidator()
```

**Factory Pattern Benefits** (from [Architecture Principles](../../../../design-docs/Architecture%20Principles.md#^dependency-abstraction)):
- Encapsulates component wiring and dependency injection
- Enables testing with mock dependencies
- Provides production-ready defaults
- Centralizes instantiation logic

**Component Factories**:
- `createMarkdownParser()` - Creates parser with marked.js configuration
- `createParsedFileCache()` - Wires cache with parser dependency
- `createFileCache()` - Creates empty cache for filename resolution
- `createCitationValidator()` - Wires validator with cache dependencies
- `createContentExtractor()` - Wires extractor with validator, cache, and strategies

**Location**: `tools/citation-manager/src/factories/componentFactory.js`

---

### 3. Error Handling Approach

**Pattern**: Try-catch with formatted error messages and appropriate exit codes

```javascript
try {
  const result = await validator.validateFile(filePath);
  console.log(formatOutput(result));
  process.exit(determineExitCode(result));
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(2);
}
```

**Error Categories**:
- **File not found** (exit 2): Source file doesn't exist or can't be read
- **Validation errors** (exit 1): Citations are broken or invalid
- **Success** (exit 0): All validations passed or operation completed

**Stream Usage**:
- `stdout`: Success output (reports, JSON data)
- `stderr`: Error messages (used by extract command for individual failures)

**Convention**: Commands continue execution despite individual link failures (graceful degradation)

---

### 4. Output Formatting

**Pattern**: Format-specific output methods with consistent structure

```javascript
// Human-readable CLI format
formatForCLI(result) {
  return treeStyleReport(result);  // Sections: errors, warnings, valid, summary
}

// Machine-readable JSON format
formatAsJSON(result) {
  return JSON.stringify(result, null, 2);
}
```

**Output Modes**:
1. **CLI format** (default): Tree-style reports with color coding (errors, warnings, valid sections)
2. **JSON format** (`--format json`): Structured data for programmatic consumption

**CLI Format Characteristics**:
- Tree-style hierarchy with `├─` and `└─` prefixes
- Grouped by status (errors first, then warnings, then valid)
- Summary statistics at end
- Validation time measurement

**JSON Format Characteristics**:
- Complete data structure (no formatting overhead)
- 2-space indentation for readability
- Suitable for piping to other tools or LLM context

---

### 5. Exit Code Standards

**Convention**: Semantic exit codes for CI/CD integration

| Exit Code | Meaning | Use Case |
|-----------|---------|----------|
| 0 | Success | All validations passed, operation completed |
| 1 | Validation errors | Citations are broken (semantic errors) |
| 2 | File not found | Source file doesn't exist (system error) |

**Implementation Pattern**:

```javascript
// For validation command
if (options.format === 'json') {
  const parsed = JSON.parse(result);
  process.exit(parsed.summary?.errors > 0 ? 1 : 0);
} else {
  process.exit(result.includes('VALIDATION FAILED') ? 1 : 0);
}
```

**Rationale**: Enables automated workflows to distinguish between "file missing" (setup issue) and "citations broken" (content issue)

---

## Command-Specific Responsibilities

Each command has distinct behavior beyond the shared orchestration pattern:

### `validate` Command

**Unique Responsibilities**:
- Line range filtering (`--lines` option)
- Optional auto-fix mode (`--fix` flag)
- Conditional FileCache initialization (only when `--scope` provided)
- Exit code determination based on validation result

**Delegation Pattern**:

```javascript
if (options.fix) {
  result = await manager.fix(file, options);  // Modifies file in-place
} else {
  result = await manager.validate(file, options);  // Read-only validation
}
```

**Line Range Filtering**: Applied after validation, before formatting (client-side filter)

---

### `extract` Command (NEW)

**Unique Responsibilities**:
- Content extraction orchestration (US2.3)
- Strategy-based eligibility filtering
- Multi-document content retrieval
- Error reporting to stderr while continuing execution

**Delegation Pattern**:

```javascript
const extractor = createContentExtractor();
const results = await extractor.extractLinksContent(file, options);
console.log(JSON.stringify(results, null, 2));
```

**Error Handling**: Individual link failures produce `OutgoingLinksExtractedContent` objects with `status: 'error'`, allowing batch processing to continue

**Integration Point**: See [CLI Integration in Content Extractor Guide](Content%20Extractor%20Implementation%20Guide.md#ContentExtractor%20Workflow%20Component%20Interaction%20Diagram)

---

### `ast` Command

**Unique Responsibilities**:
- Direct parser access (bypasses validator and cache)
- Always outputs JSON (no format option)
- Debugging-focused output

**Delegation Pattern**:

```javascript
const manager = new CitationManager();
const ast = await manager.parser.parseFile(file);
console.log(JSON.stringify(ast, null, 2));
```

**Use Case**: Parser debugging and AST structure inspection

---

### `base-paths` Command

**Unique Responsibilities**:
- Path extraction and deduplication
- Relative-to-absolute path conversion
- Sorted output

**Delegation Pattern**:

```javascript
const manager = new CitationManager();
const basePaths = await manager.extractBasePaths(file);
// Format and output
```

**Path Normalization**: Converts relative paths to absolute using source file's directory

---

### `fix` Command

**Unique Responsibilities**:
- In-place file modification
- Dual fix types (path corrections + anchor corrections)
- Fix summary reporting (breakdown by fix type)

**Delegation Pattern**:

```javascript
const manager = new CitationManager();
result = await manager.fix(file, options);  // Returns fix summary
```

**Safety Consideration**: No dry-run mode - recommend version control before use

---

## Extract Command Integration (NEW - US2.3)

The `extract` command represents a new capability in the Citation Manager architecture, adding content aggregation to the existing validation-focused toolset.

### Factory Usage

**Pattern**: Factory instantiation with default strategy configuration

```javascript
import { createContentExtractor } from './factories/componentFactory.js';

const extractor = createContentExtractor();
// Internally wires:
// - ParsedFileCache (with MarkdownParser)
// - CitationValidator (with caches)
// - Eligibility strategies (stop, force, section, cli-flag)
```

**Strategy Order** (precedence from highest to lowest):
1. `StopMarkerStrategy` - `%%stop-extract-link%%` prevents extraction
2. `ForceMarkerStrategy` - `%%force-extract%%` forces extraction
3. `SectionLinkStrategy` - Links with anchors eligible by default
4. `CliFlagStrategy` - `--full-files` flag enables full-file extraction

### Delegation to ContentExtractor

**Pattern**: Single high-level call to orchestrate entire extraction workflow

```javascript
// CLI delegates to ContentExtractor
const results = await extractor.extractLinksContent(sourceFilePath, cliFlags);
```

**Encapsulated Workflow** (hidden from CLI):
1. Validate source file via `CitationValidator` (returns enriched LinkObjects)
2. Filter eligible links using strategy chain
3. Extract content from target documents via `ParsedDocument` facade
4. Aggregate `OutgoingLinksExtractedContent` objects with status and details

**CLI Responsibility**: Final I/O only (output JSON to stdout, errors to stderr)

### Command Structure

```javascript
program
  .command('extract')
  .description('Extract content from files referenced by citations')
  .argument('<file>', 'path to markdown file containing citations')
  .option('--format <type>', 'output format (json)', 'json')
  .option('--scope <folder>', 'limit file resolution to specific folder')
  .option('--full-files', 'extract full-file links (without anchors)')
  .action(async (file, options) => {
    try {
      const extractor = createContentExtractor();
      const results = await extractor.extractLinksContent(file, {
        fullFiles: options.fullFiles || false
      });
      console.log(JSON.stringify(results, null, 2));
    } catch (error) {
      console.error(`ERROR: ${error.message}`);
      process.exit(1);
    }
  });
```

**Integration Characteristics**:
- **Thin CLI**: Command orchestration only, no business logic
- **Factory pattern**: Consistent with other commands (`createContentExtractor()`)
- **Delegation pattern**: Single call to `extractLinksContent()` encapsulates workflow
- **Error handling**: Try-catch with stderr output and exit code 1
- **Output format**: JSON only (US2.3 scope, formatted output deferred)

**Link to Implementation**: [Content Extractor Implementation Guide](Content%20Extractor%20Implementation%20Guide.md)

---

## Cross-Cutting Concerns

### Error Reporting Patterns

**Stream Separation**:
- `stdout`: Primary output (reports, JSON data, success messages)
- `stderr`: Error messages and warnings (enables piping workflows)

**Format Awareness**:

```javascript
// Only show cache stats in non-JSON mode
if (options.format !== 'json') {
  console.log(`Scanned ${cacheStats.totalFiles} files`);
}
```

**Rationale**: JSON output should be pure data structure without interspersed messages

---

### Logging Strategy

**Current Implementation**: No formal logging infrastructure

**Logging Approach**:
- Direct console output for user-facing messages
- Validation time measurement in results
- Cache statistics output (when `--scope` provided)

**Future Enhancement**: Structured logging (not currently implemented)

---

### Exit Code Conventions

**Philosophy**: Exit codes communicate semantic meaning for automation

**Standards**:
- **0**: Success (all operations completed, no validation errors)
- **1**: Semantic errors (broken citations, extraction failures)
- **2**: System errors (file not found, parsing failures)

**Implementation Consistency**: All commands follow same exit code semantics

**CI/CD Integration**: Exit codes enable automated quality gates:

```bash
npm run citation:validate README.md && echo "Citations valid"
```

---

### Argument Validation

**Pattern**: Defer to Commander.js for basic validation

**Commander.js Responsibilities**:
- Required arguments enforcement
- Option type checking
- Help text generation

**Component Responsibilities**:
- File existence validation
- Path resolution
- Line range parsing

**Error Handling**:

```javascript
// Commander.js handles missing arguments automatically
.argument('<file>', 'path to markdown file to validate')

// Component handles file not found
if (!existsSync(filePath)) {
  throw new Error(`File not found: ${filePath}`);
}
```

**Rationale**: Leverage Commander.js built-in validation to avoid duplication

---

## Architecture Principles Applied

The CLI architecture embodies several core principles from [Architecture Principles.md](../../../../design-docs/Architecture%20Principles.md):

### Dependency Abstraction
^[cite: ../../../../design-docs/Architecture Principles.md#^dependency-abstraction]

**Application**: Factory pattern encapsulates component instantiation, allowing CLI to depend on abstractions (interfaces) rather than concrete implementations. Tests can inject mocks without changing CLI code.

```javascript
// CLI depends on factory abstraction, not concrete implementations
const manager = new CitationManager();
// Factory handles wiring: parser → cache → validator
```

---

### Single Responsibility
^[cite: ../../../../design-docs/Architecture Principles.md#^single-responsibility]

**Application**: CLI's sole concern is command orchestration (argument parsing, component instantiation, output formatting). Business logic lives in components (parser, validator, extractor).

**Separation**:
- **CLI**: User interaction, argument parsing, component wiring, output formatting
- **Components**: Domain logic (parsing, validation, extraction, caching)

---

### Black Box Interfaces
^[cite: ../../../../design-docs/Architecture Principles.md#^black-box-interfaces]

**Application**: Commands interact with components through clean public APIs (`validateFile()`, `extractLinksContent()`), hiding internal complexity (caching, eligibility strategies, anchor normalization).

**Example**:

```javascript
// CLI calls high-level method, doesn't know about internal strategy pattern
const results = await extractor.extractLinksContent(sourceFilePath, cliFlags);
// ContentExtractor internally manages:
// - Validation enrichment pattern
// - Strategy chain execution
// - ParsedDocument facade delegation
```

---

### Illegal States Unrepresentable
^[cite: ../../../../design-docs/Architecture Principles.md#^illegal-states-unrepresentable]

**Application**: Exit code conventions prevent ambiguous states (success vs error), output format options enforce either `cli` or `json` (not both), and validation results use discriminated unions (`status: 'valid' | 'warning' | 'error'`).

**Example**:

```javascript
// Exit code is semantic, not arbitrary
process.exit(parsed.summary?.errors > 0 ? 1 : 0);
// Either 1 (errors exist) or 0 (no errors) - no ambiguous state
```

---

### MVP-First Approach
^[cite: ../../../../design-docs/Architecture Principles.md#^mvp-first]

**Application**: Extract command (US2.3) outputs raw JSON to stdout, deferring formatted output and file writing to future work. Validates concept (content extraction workflow) without over-engineering output layer.

**Scope Decisions**:
- **Included**: JSON output to stdout (proves extraction works)
- **Deferred**: Formatted markdown output, file writing, custom templates

---

## File Structure

```text
tools/citation-manager/
├── src/
│   ├── citation-manager.js                      // Main CLI entry point (669 lines)
│   │                                             // - Command registry (validate, extract, ast, base-paths)
│   │                                             // - CitationManager orchestrator class
│   │                                             // - Commander.js configuration
│   │
│   ├── core/
│   │   ├── CitationValidator.js                 // Validation component
│   │   ├── MarkdownParser.js                    // Parser component
│   │   ├── ParsedFileCache.js                   // Cache component
│   │   ├── FileCache.js                         // Filename resolution cache
│   │   ├── ParsedDocument.js                    // Query facade
│   │   └── ContentExtractor/                    // Extraction component (NEW)
│   │       ├── ContentExtractor.js
│   │       └── eligibilityStrategies/
│   │
│   └── factories/
│       └── componentFactory.js                  // Factory functions for DI
│
├── package.json
│   └── scripts:
│       ├── "citation:validate"                  // Maps to validate command
│       ├── "citation:extract"                   // Maps to extract command (NEW)
│       ├── "citation:ast"                       // Maps to ast command
│       ├── "citation:base-paths"                // Maps to base-paths command
│       └── "citation:fix"                       // Alias for validate --fix
│
└── design-docs/
    └── component-guides/
        └── CLI Architecture Overview.md         // This document
```

**Main Entry Point**: `citation-manager.js` (line 1: `#!/usr/bin/env node`)

**Script Mapping**: npm scripts in `package.json` delegate to CLI commands via Commander.js

---

## Implementation Notes

### CitationManager Orchestrator Class

**Role**: Encapsulates component wiring and provides high-level operations for CLI commands

**Constructor**:

```javascript
constructor() {
  this.parser = createMarkdownParser();
  this.parsedFileCache = createParsedFileCache(this.parser);
  this.fileCache = createFileCache();
  this.validator = createCitationValidator(this.parsedFileCache, this.fileCache);
}
```

**Public Methods**:
- `validate(filePath, options)` - Validates citations, returns formatted report
- `extractBasePaths(filePath)` - Extracts unique citation target paths
- `fix(filePath, options)` - Automatically fixes broken citations

**Design Rationale**: Centralizes component instantiation for simpler command implementations

---

### Commander.js Integration

**Library**: `commander` npm package

**Pattern**: Fluent API for command definitions

```javascript
program
  .name('citation-manager')
  .description('Citation validation and management tool for markdown files')
  .version('1.0.0');
```

**Benefits**:
- Automatic help generation (`--help`)
- Built-in argument parsing and validation
- Subcommand support
- Option type coercion

---

### Performance Considerations

**Caching Strategy**:
- `ParsedFileCache`: Ensures each file is parsed at most once per command execution
- `FileCache`: Builds once per command (when `--scope` provided)

**Async Operations**: All file I/O and parsing operations use async/await for non-blocking execution

**Memory Management**: Caches are scoped to command execution (garbage collected after command completes)

---

## Testing Strategy

**Component Testing**: Individual components (parser, validator, extractor) have dedicated test suites

**CLI Testing**: Focus on command orchestration, not business logic

**Test Coverage Areas**:
1. Argument parsing (correct option handling)
2. Component instantiation (factory calls)
3. Error handling (exit codes, error messages)
4. Output formatting (CLI vs JSON format)

**Test Location**: `tools/citation-manager/test/integration/`

---

## Future Enhancements

### Extract Command Evolution

**Current State** (US2.3): JSON output to stdout

**Planned Enhancements**:
- Formatted markdown output with section headers
- File writing (`--output` option)
- Custom output templates
- Interactive extraction mode

**Reference**: [Content Extractor Future Work](Content%20Extractor%20Implementation%20Guide.md#Future%20Work)

---

### Logging Infrastructure

**Current State**: Direct console output

**Planned Enhancement**: Structured logging with configurable verbosity

**Use Cases**:
- Debug mode for troubleshooting
- Performance profiling (timing breakdowns)
- Cache hit/miss statistics

---

### Configuration File Support

**Current State**: All options via CLI arguments

**Planned Enhancement**: `.citation-manager.config.js` for defaults

**Use Cases**:
- Project-wide scope directory
- Default output format preference
- Custom extraction strategies

---

## Related Files

- [Content Extractor Implementation Guide](Content%20Extractor%20Implementation%20Guide.md) - Extract command details
- [CitationValidator Implementation Guide](CitationValidator%20Implementation%20Guide.md) - Validate command details
- [ParsedFileCache Implementation Guide](ParsedFileCache%20Implementation%20Guide.md) - Caching strategy
- [ParsedDocument Implementation Guide](ParsedDocument%20Implementation%20Guide.md) - Query facade
- [Markdown Parser Implementation Guide](Markdown%20Parser%20Implementation%20Guide.md) - AST generation
- [Architecture Principles](../../../../design-docs/Architecture%20Principles.md) - Core design principles
- [Architecture - Baseline](../../../../design-docs/Architecture%20-%20Baseline.md) - File naming patterns

---

## Command Quick Reference

```bash
# Validate citations in a file
npm run citation:validate <file-path>

# Validate with JSON output
npm run citation:validate <file-path> -- --format json

# Validate specific line range
npm run citation:validate <file-path> -- --lines 150-160

# Auto-fix broken citations
npm run citation:fix <file-path>

# Extract content from referenced files (NEW)
npm run citation:extract <file-path>

# Extract with full-file links
npm run citation:extract <file-path> -- --full-files

# Display AST structure
npm run citation:ast <file-path>

# List distinct base paths
npm run citation:base-paths <file-path>

# Get base paths as JSON
npm run citation:base-paths <file-path> -- --format json
```

---

## Architectural Boundaries

### CLI Responsibilities (IN SCOPE)

- Command registration and argument parsing
- Component instantiation via factories
- High-level orchestration (calling component methods)
- Output formatting (CLI vs JSON)
- Exit code determination
- Error message presentation

### CLI Non-Responsibilities (OUT OF SCOPE)

- Markdown parsing logic (delegated to MarkdownParser)
- Citation validation logic (delegated to CitationValidator)
- Content extraction logic (delegated to ContentExtractor)
- Caching strategies (delegated to ParsedFileCache)
- Eligibility rules (delegated to Strategy Pattern)
- Anchor normalization (delegated to components)

**Principle**: CLI is a thin orchestration layer, not a business logic container

---
