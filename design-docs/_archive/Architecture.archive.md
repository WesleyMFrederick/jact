# Citation Management Script Architecture Plan

## Value Proposition
**Goal**: Help AI/LLM maintain citation quality by enforcing Obsidian-friendly cross-document links that enable preview modals and proper navigation, reducing manual citation maintenance overhead from minutes to seconds.

## Requirements

### Functional Requirements
- **FR1**: System SHALL validate markdown files for broken citations and missing anchors ^FR1
- **FR2**: System SHALL parse markdown AST to extract links, headings, and anchor patterns ^FR2
- **FR3**: System SHALL create proper citation links following established guidelines ^FR3
- **FR4**: System SHALL generate missing anchors in target documents using correct patterns: caret syntax (^FR1, ^US1-1AC1), markdown-in-header preservation (==**Component**==), and kebab-case for standard headers ^FR4
- **FR5**: System SHALL recognize caret syntax anchors (^FR1, ^US1-1AC1, ^NFR2) ^FR5
- **FR6**: System SHALL preserve markdown-in-header formatting with URL encoding ^FR6
- **FR7**: System SHALL support cross-document and wiki-style link formats ^FR7
- **FR8**: System SHALL provide CLI interface with validate, fix, generate-anchors, and ast commands ^FR8

### Non-Functional Requirements
- **NFR1**: System SHALL use ES modules following agentic-workflows project standards ^NFR1
- **NFR2**: System SHALL complete validation of typical story files in <5 seconds ^NFR2
- **NFR3**: System SHALL provide dry-run mode without modifying files ^NFR3
- **NFR4**: System SHALL create backups before making changes to files ^NFR4
- **NFR5**: System SHALL gracefully degrade on errors and continue processing other citations ^NFR5
- **NFR6**: System SHALL provide detailed error messages with actionable fix suggestions ^NFR6
- **NFR7**: System SHALL integrate with existing agentic-workflows package.json scripts ^NFR7

## Core Architecture

**File**: `src/scripts/citation-manager.js`
**Module System**: ES modules (following agentic-workflows standards)
**Dependencies**: `marked`, `yaml`, `fs`, `path` (existing + project deps)

## Component Design

### 1. CitationManager (Main Orchestrator)
**Responsibility**: CLI interface and workflow coordination

```javascript
class CitationManager {
  constructor() {
    this.parser = new MarkdownParser();
    this.validator = new CitationValidator();
    this.generator = new CitationGenerator();
    this.anchorManager = new AnchorManager();
  }

  async run(command, filePath, options) // Main entry point
}
```

### 2. MarkdownParser (AST Generation)
**Responsibility**: Parse markdown and extract structured data

```javascript
class MarkdownParser {
  parseFile(filePath) // Returns structured AST
  extractLinks(tokens) // All link types
  extractHeadings(tokens) // Header analysis
  extractAnchors(content) // Caret, emphasis, standard patterns
}
```

### 3. CitationValidator (Validation Engine)
**Responsibility**: Validate citations against patterns and file existence

```javascript
class CitationValidator {
  validateFile(filePath) // Full file validation
  validateLink(link, context) // Individual link validation
  checkAnchorExists(anchor, targetFile) // Cross-reference validation
  validatePattern(link, type) // Pattern compliance checking
}
```

### 4. CitationGenerator (Link Creation)
**Responsibility**: Generate proper citation links following guidelines

```javascript
class CitationGenerator {
  createCrossDocumentLink(text, targetFile, anchor) // Standard format
  createWikiStyleLink(anchor, displayText) // Internal references
  fixBrokenLink(brokenLink, context) // Auto-repair logic
  generateSourceCitation(targetFile, anchor) // Source format
}
```

### 5. AnchorManager (Anchor Generation)
**Responsibility**: Create and manage anchors in target documents

```javascript
class AnchorManager {
  generateCaretAnchor(type, identifier) // FR1, US1-1AC1 patterns
  generateHeaderAnchor(headingText) // Kebab-case conversion
  preserveMarkdownAnchor(headingWithMarkdown) // Exact preservation
  addMissingAnchors(filePath, anchorList) // Batch anchor insertion
}
```

## Pattern Recognition System

### Anchor Type Detection

```javascript
const ANCHOR_PATTERNS = {
  CARET: /\^([A-Z0-9\-]+)/, // ^FR1, ^US1-1AC1
  EMPHASIS_MARKED: /==\*\*([^*]+)\*\*==/, // ==**Component**==
  STANDARD_HEADER: /^#+\s+(.+)$/, // ## Header Text
  WIKI_STYLE: /\[\[#([^|]+)\|([^\]]+)\]\]/ // [[#anchor|text]]
};
```

### Caret Syntax Business Logic Patterns

#### Pattern Categories Observed

**Functional Requirements:**
- Pattern: `^FR[number]`
- Context: Lines starting with "FR[number]: [requirement text]"
- Examples: `^FR1`, `^FR2`, `^FR11`

**Non-Functional Requirements:**
- Pattern: `^NFR[number]`
- Context: Lines starting with "NFR[number]: [requirement text]"
- Examples: `^NFR1`, `^NFR2`, `^NFR7`

**Acceptance Criteria:**
- Pattern: `^US[story]-[substory]AC[criteria]`
- Context: Numbered lists under "Acceptance Criteria" sections
- Examples: `^US1-1AC1`, `^US1-1AC2`, `^US1-1AC5`

**User Stories:**
- Pattern: `^US[story]-[substory]`
- Context: Story headers and cross-references
- Examples: `^US1-1`, `^US1-2`, `^US2-1`

**Task Identifiers:**
- Pattern: `^US[story]-[substory]T[task]` or `^US[story]-[substory]T[task]-[subtask]`
- Context: Task lists and phase breakdowns
- Examples: `^US1-1T1`, `^US1-1T2-1`, `^US1-1T3-3`

#### Context Detection Logic Required

1. **Document Section Analysis**: Script needs to understand if it's in "Functional Requirements" vs "Acceptance Criteria" vs "Tasks" section
2. **Content Pattern Matching**: Look for "FR1:", "WHEN...THEN", "Task 2.1", etc.
3. **Sequential Numbering**: Detect existing patterns to generate next sequential number
4. **Story/Epic Context**: Extract story numbers (US1-1) from document context or filename

The script will need to analyze document structure and content context to determine which caret pattern to generate, not just rely on regex matching.

### Link Format Validation

```javascript
const LINK_FORMATS = {
  CROSS_DOCUMENT: /\[([^\]]+)\]\(([^)]+\.md)(#[^)]+)?\)/,
  EMPHASIS_COMPONENT: /#==\*\*[^*]+\*\*==/,
  URL_ENCODED: /%20|%5B|%5D/, // Encoded spaces, brackets
};
```

## CLI Interface Design

### Commands

```bash
# Validate citations in file
node citation-manager.js validate <file>

# Fix broken citations automatically
node citation-manager.js fix <file> [--dry-run]

# Generate missing anchors
node citation-manager.js generate-anchors <file>

# Show AST and extracted data
node citation-manager.js ast <file>
```

### Options
- `--dry-run`: Preview changes without modifying files
- `--backup`: Create backup before modifications
- `--format <type>`: Specify output format (json, markdown, summary)

## Data Flow Architecture

1. **Input**: Markdown file with broken/missing citations
2. **AST Parsing**: Extract all links, headings, and anchors
3. **Pattern Analysis**: Classify each element by type
4. **Validation**: Check existence and format compliance
5. **Generation**: Create missing anchors and fix broken links
6. **Output**: Updated file with proper citations

## Integration Points

### With Existing Project
- **Package.json**: Add npm script `"citation:validate": "node src/scripts/citation-manager.js validate"`
- **Workflow Integration**: Can be called by LLMs during document editing
- **File Watching**: Future integration with file system watchers

### Error Handling Strategy
- **Graceful Degradation**: Continue processing other citations if one fails
- **Detailed Reporting**: Specific error messages with fix suggestions
- **Rollback Capability**: Restore original file if generation fails

## Baseline vs Improvement Analysis

### Current Baseline (Manual Process)
- **Manual Link Fixing**: LLMs and users manually identify and fix broken citations
- **Inconsistent Formats**: Citations may not follow Obsidian-friendly cross-document format
- **Missing Anchors**: Target documents lack proper anchors for citation targets
- **No Preview Support**: Incorrectly formatted links don't leverage Obsidian's preview modal capabilities
- **Time-Consuming**: 5-10 minutes per document for citation validation and fixes
- **Pattern Confusion**: Three different anchor types (caret syntax ^FR1, emphasis-marked ==**Component**==, standard headers) with complex business logic

**Specific Pain Points Identified:**
- Broken links in story files (e.g., version-detection story line 149-150)
- Inconsistent anchor patterns across documents
- Manual effort to maintain cross-document citations
- No automated detection of citation format violations

### Proposed Improvement (Automated Script)
- **Automated Validation**: Script detects broken citations and missing anchors automatically
- **Obsidian-Optimized Format**: Enforces cross-document style links (`[text](file.md#anchor)` and ``[text](file.md#^block-anchor`)
- **Preview Modal Support**: Ensures citations work with Obsidian's hover preview functionality
- **Anchor Generation**: _Helps_ LLM creates missing anchors following established caret syntax patterns, by reporting broken or missing caret patters.
- **LLM-Friendly**: Provides clear validation feedback to help AI assistants maintain citation quality. Allows LLMs to use techniques like passing text or document line-numbers (line numbers allowing for less token usage)
- **Workflow Integration**: CLI commands enable LLMs to validate/fix citations during document editing
- **Time Reduction**: From 5-10 minutes per document to seconds for citation maintenance

## MVP Functionality Prioritization

### 🏆 Phase 1 MVP (High Impact, Low-Medium Effort)

**Priority 1: Citation Validation** - `validate` command ^MVP-P1
- **Impact**: 🔥🔥🔥🔥🔥 (Immediate value - catches 90% of citation issues)
- **Effort**: 🛠️🛠️ (Low - pattern matching against existing files)
- **Scope**: Scan markdown files and report broken cross-document links, missing anchor targets, format violations

#### MVP-P1 Interface Specification ^MVP-P1-INTERFACE

**Input:**

```bash
node citation-manager.js validate <markdown-file-path> [--format <type>]
```

**Output Formats:**

_CLI Format (default):_

```text
Citation Validation Report
==========================

File: /path/to/story.md
Processed: 4 citations found

❌ CRITICAL ERRORS (2)
├─ Line 5: [missing file](nonexistent.md#anchor)
│  └─ File not found: ../nonexistent.md
│  └─ Suggestion: Check if file exists or fix path
│
└─ Line 7: [Bad Emphasis](file.md#==Component==)
   └─ Malformed emphasis anchor - missing ** markers
   └─ Suggestion: Use [Bad Emphasis](file.md#==**Component**==)

✅ VALID CITATIONS (2)
├─ Line 3: [Component Details](../architecture/components.md#auth-service) ✓
└─ Line 6: ^FR1 ✓

SUMMARY:
- Total citations: 4
- Valid: 2
- Critical errors: 2
- Validation time: 0.3s

❌ VALIDATION FAILED - Fix 2 critical errors
```

_JSON Format (--format json):_

```json
{
  "file": "/path/to/story.md",
  "summary": {
    "total": 4,
    "valid": 2,
    "errors": 2,
    "validationTime": "0.3s"
  },
  "results": [
    {
      "line": 3,
      "citation": "[Component Details](../architecture/components.md#auth-service)",
      "status": "valid",
      "type": "cross-document"
    },
    {
      "line": 5,
      "citation": "[missing file](nonexistent.md#anchor)",
      "status": "error",
      "type": "cross-document",
      "error": "File not found: ../nonexistent.md",
      "suggestion": "Check if file exists or fix path"
    }
  ]
}
```

**Return Codes:**
- `0`: All citations valid (success)
- `1`: Broken citations found (failure)
- `2`: File not found or permission error

**What Gets Validated:**
- Cross-document links: File existence + anchor existence
- Caret syntax patterns: ^FR1, ^US1-1AC1, ^NFR2 format compliance
- Emphasis anchors: ==**Component**== format validation
- File path resolution: Relative path correctness

**Priority 2: Citation Link Creation** - `fix` command with `--dry-run` ^MVP-P2
- **Impact**: 🔥🔥🔥🔥 (Automates 80% of manual citation work)
- **Effort**: 🛠️🛠️🛠️ (Medium - format conversion logic)
- **Scope**: Convert malformed links to Obsidian-friendly format, fix file paths, add cross-document syntax

**Priority 3: AST Generation** - `ast` command ^MVP-P3
- **Impact**: 🔥🔥🔥 (Enables debugging and understanding)
- **Effort**: 🛠️🛠️ (Low - leverage existing `marked` library)
- **Scope**: Parse markdown and extract links, headings, anchors for analysis

### 📋 Phase 2 (Defer for V2)

**Citation Anchor Generation** - `generate-anchors` command ^MVP-DEFER
- **Impact**: 🔥🔥 (Helpful but not critical for fixing existing issues)
- **Effort**: 🛠️🛠️🛠️🛠️ (High - complex business logic for context-aware patterns)
- **Complexity**: Requires document structure understanding, section context, sequential numbering

### MVP Rationale
- **Validation** provides immediate value and identifies scope of problems
- **Link Fixing** solves 80% of manual citation work
- **AST Display** enables LLMs to understand document structure for better fixes
- **Anchor Generation** deferred until patterns are better understood through usage

**Estimated Time to Value**: 1-2 days implementation, immediate validation value

## Testing Strategy for MVP-P1 (Citation Validation)

### Test File Location
All tests and fixtures reside in: `/utility-scripts/citation-links/`

### Integration Test
**Happy Path Validation** ^TEST-INTEGRATION
- **Test File**: `test/fixtures/valid-citations.md`
- **Scenario**: Markdown file with mixed citation types:
  - Working cross-document links: `[Component](../file.md#anchor)`
  - Valid caret anchors: `^FR1`, `^US1-1AC1`
  - Valid emphasis-marked: `[Component](file.md#==**Component**==)`
- **Command**: `node citation-manager.js validate test/fixtures/valid-citations.md`
- **Expected Result**: Report showing "All citations valid" with summary statistics

### Edge Case Tests

**Edge Case 1: Broken Cross-Document Links** ^TEST-EDGE1
- **Test File**: `test/fixtures/broken-links.md`
- **Scenario**:
  - `[text](nonexistent-file.md#anchor)` (file doesn't exist)
  - `[text](existing-file.md#missing-anchor)` (anchor doesn't exist)
- **Expected Result**: Clear error messages with file paths and suggested fixes

**Edge Case 2: Malformed Emphasis-Marked Anchors** ^TEST-EDGE2
- **Test File**: `test/fixtures/malformed-emphasis.md`
- **Scenario**:
  - `[Component](file.md#==Component==)` (missing **)
  - `[Component](file.md#==**Component**)` (missing final ==)
- **Expected Result**: Format violation warnings with correct pattern examples

**Edge Case 3: Mixed Valid/Invalid Caret Syntax** ^TEST-EDGE3
- **Test File**: `test/fixtures/mixed-caret-patterns.md`
- **Scenario**:
  - Valid: `^FR1`, `^US1-1AC1`, `^NFR2`
  - Invalid: `^invalidPattern`, `^123`, `^lowercase`
- **Expected Result**: Specific validation errors for invalid patterns while accepting valid ones

### Test Implementation Requirements
- **Test Framework**: Node.js built-in test runner (`node --test`)
- **Test File**: `test/validation.test.js`
- **Fixtures Directory**: `test/fixtures/` with sample markdown files
- **npm Script**: `"test:validation": "node --test test/validation.test.js"`

## Implementation Patterns (Architectural Pseudocode)

### 1. Citation Pattern Validation Logic ^PSEUDO-VALIDATION

```tsx
// Citation validation boundary with pattern precedence strategy
// Handles multiple citation types with clear decision points and error classification
class CitationValidator is
  constructor CitationValidator(patternRegistry: PatternBoundary,
                               fileSystem: FileSystemBoundary,
                               logger: LoggingBoundary) is
    // Research: Pattern matching performance optimization for large files
    // Integration: File system permission validation for cross-document checking
    // Decision: Citation pattern precedence order (caret > emphasis > standard)
    ...

  // Primary validation boundary for markdown file processing
  public method validateFile(filePath: FilePath): ValidationReport is
    // Boundary: File system interaction for content reading
    // Decision: Streaming vs full-file parsing based on file size
    // Integration: AST parser coordination for structured content extraction
    field content = this.readMarkdownContent(filePath)
    field citations = this.extractAllCitations(content)

    // Pattern: Parallel validation with error aggregation strategy
    field validationResults = new ValidationResults()
    foreach (citation in citations) do
      field result = this.validateSingleCitation(citation, filePath)
      validationResults.aggregate(result)

    return this.generateReport(validationResults)

  // Citation pattern classification with validation strategy
  private method validateSingleCitation(citation: Citation, contextFile: FilePath): CitationResult is
    // Decision point: Pattern type identification strategy
    field patternType = this.classifyPattern(citation.anchor)

    switch (patternType) is
      case CARET_SYNTAX:
        // Validation: ^FR1, ^US1-1AC1, ^NFR2 pattern compliance
        return this.validateCaretPattern(citation)
      case EMPHASIS_MARKED:
        // Validation: ==**Component**== format with URL encoding
        return this.validateEmphasisPattern(citation)
      case CROSS_DOCUMENT:
        // Boundary: File system validation for target existence
        return this.validateCrossDocumentLink(citation, contextFile)
      default:
        // Error handling: Unknown pattern classification
        return this.createValidationError(citation, "UNKNOWN_PATTERN")

  // Pattern classification boundary with precedence rules
  private method classifyPattern(anchor: string): PatternType is
    // Research: Regex optimization for pattern matching performance
    // Decision: Pattern precedence to handle ambiguous cases
    if (this.matchesCaretPattern(anchor)) then
      return CARET_SYNTAX
    else if (this.matchesEmphasisPattern(anchor)) then
      return EMPHASIS_MARKED
    else if (this.matchesCrossDocumentPattern(anchor)) then
      return CROSS_DOCUMENT
    else
      return UNKNOWN_PATTERN
```

### 2. Cross-Document Link Validation ^PSEUDO-CROSSDOC

```tsx
// File system boundary interaction for cross-document citation validation
// Handles path resolution, anchor existence checking, and error classification
class CrossDocumentValidator is
  constructor CrossDocumentValidator(fileSystem: FileSystemBoundary,
                                    pathResolver: PathBoundary,
                                    anchorExtractor: AnchorBoundary) is
    // Research: File system permission requirements for document scanning
    // Integration: Path resolution strategy for relative vs absolute paths
    // Security: Path traversal prevention for link validation
    ...

  // Cross-document link validation with path resolution strategy
  public method validateCrossDocumentLink(citation: Citation,
                                         sourceFile: FilePath): ValidationResult is
    // Pattern: Two-phase validation (file existence, then anchor existence)
    field targetPath = this.resolveTargetPath(citation.filePath, sourceFile)

    // Boundary: File system existence validation
    if (!this.fileExists(targetPath)) then
      return this.createFileNotFoundError(citation, targetPath)

    // Decision: Anchor validation strategy based on target file type
    if (citation.hasAnchor()) then
      return this.validateAnchorExists(citation.anchor, targetPath)
    else
      return this.createSuccessResult(citation)

  // Path resolution boundary with security validation
  private method resolveTargetPath(relativePath: string, sourceFile: FilePath): FilePath is
    // Research: Path resolution rules for different operating systems
    // Security: Path traversal attack prevention
    // Validation: Relative path limits and workspace boundaries
    field basePath = this.extractBasePath(sourceFile)
    field resolvedPath = this.pathResolver.resolve(basePath, relativePath)

    // Security boundary: Ensure resolved path is within allowed workspace
    if (!this.isWithinWorkspace(resolvedPath)) then
      throw new SecurityException("Path traversal attempt detected")

    return resolvedPath

  // Anchor existence validation with multiple anchor type support
  private method validateAnchorExists(anchor: string, targetFile: FilePath): ValidationResult is
    // Integration: AST parser for structured anchor extraction
    // Pattern: Multiple anchor format support (caret, emphasis, heading)
    field targetContent = this.fileSystem.readFile(targetFile)
    field availableAnchors = this.anchorExtractor.extractAllAnchors(targetContent)

    // Decision: Anchor matching strategy (exact vs fuzzy matching)
    if (availableAnchors.contains(anchor)) then
      return this.createSuccessResult()
    else
      // Error handling: Suggest similar anchors for better user experience
      field suggestions = this.generateAnchorSuggestions(anchor, availableAnchors)
      return this.createAnchorNotFoundError(anchor, targetFile, suggestions)
```

### 3. Error Reporting Architecture ^PSEUDO-ERRORS

```tsx
// Error aggregation and actionable suggestion generation boundary
// Handles validation result collection, error classification, and user guidance
class ValidationReporter is
  constructor ValidationReporter(suggestionEngine: SuggestionBoundary,
                                formatter: OutputBoundary,
                                logger: LoggingBoundary) is
    // Research: Error message psychology for developer productivity
    // Integration: Multiple output format support (CLI, JSON, markdown)
    // Decision: Error severity classification and prioritization strategy
    ...

  // Primary reporting boundary with error aggregation strategy
  public method generateReport(validationResults: ValidationResults): ValidationReport is
    // Pattern: Error classification and severity assignment
    field categorizedErrors = this.categorizeErrors(validationResults.getAllErrors())
    field suggestions = this.generateActionableSuggestions(categorizedErrors)

    // Decision: Report format based on error severity and count
    field reportFormat = this.determineOptimalFormat(categorizedErrors)

    return this.formatReport(categorizedErrors, suggestions, reportFormat)

  // Error categorization boundary with priority classification
  private method categorizeErrors(errors: array of ValidationError): CategorizedErrors is
    // Decision: Error priority for user attention management
    field categorized = new CategorizedErrors()

    foreach (error in errors) do
      switch (error.type) is
        case FILE_NOT_FOUND:
          // High priority: Breaks functionality completely
          categorized.addCritical(error)
        case ANCHOR_NOT_FOUND:
          // Medium priority: Breaks navigation but file exists
          categorized.addMajor(error)
        case PATTERN_VIOLATION:
          // Low priority: Style issue but functional
          categorized.addMinor(error)
        case PERFORMANCE_WARNING:
          // Info priority: Optimization opportunity
          categorized.addInfo(error)

    return categorized

  // Actionable suggestion generation with context-aware recommendations
  private method generateActionableSuggestions(errors: CategorizedErrors): SuggestionSet is
    // Integration: Suggestion engine for context-aware recommendations
    // Research: Common citation error patterns and effective solutions
    field suggestions = new SuggestionSet()

    // Pattern: Suggestion generation based on error patterns and context
    foreach (error in errors.getCriticalErrors()) do
      switch (error.type) is
        case FILE_NOT_FOUND:
          // Research: File location heuristics and common path patterns
          suggestions.add(this.suggestFileLocations(error))
        case INVALID_CARET_PATTERN:
          // Integration: Pattern validation rules for suggestion generation
          suggestions.add(this.suggestCorrectCaretFormat(error))
        case MALFORMED_EMPHASIS:
          // Validation: Emphasis marker correction with URL encoding
          suggestions.add(this.suggestEmphasisCorrection(error))

    return suggestions

  // Output formatting boundary with multiple format support
  private method formatReport(errors: CategorizedErrors,
                             suggestions: SuggestionSet,
                             format: OutputFormat): ValidationReport is
    // Decision: Output format optimization for different use cases
    // Integration: CLI formatting vs programmatic consumption
    switch (format) is
      case CLI_HUMAN_READABLE:
        // Research: Terminal color and formatting best practices
        return this.formatForCLI(errors, suggestions)
      case JSON_STRUCTURED:
        // Integration: Machine-readable format for automation
        return this.formatAsJSON(errors, suggestions)
      case MARKDOWN_DOCUMENTATION:
        // Pattern: Obsidian-compatible output for documentation workflow
        return this.formatAsMarkdown(errors, suggestions)
```

### Implementation Notes

**Research Integration Points:**
- Pattern matching performance optimization strategies
- File system permission validation requirements
- Path resolution rules across operating systems
- Error message psychology for developer productivity
- Terminal formatting and color best practices

**Boundary Definitions:**
- **PatternBoundary**: Citation pattern recognition and classification
- **FileSystemBoundary**: File existence and content reading operations
- **PathBoundary**: Path resolution and security validation
- **SuggestionBoundary**: Context-aware recommendation generation
- **OutputBoundary**: Multi-format report generation

**Decision Points:**
- Citation pattern precedence order (caret > emphasis > standard)
- Validation strategy (streaming vs full-file parsing)
- Error severity classification and prioritization
- Output format selection based on use case

## Integration Strategy

> **Note**: THIS `Integration Strategy` SECTION IS PROPOSED AND NOT YET APPROVED

### Package.json Integration

```json
{
  "scripts": {
    "citation:validate": "node utility-scripts/citation-links/citation-manager.js validate",
    "citation:fix": "node utility-scripts/citation-links/citation-manager.js fix --backup",
    "citation:generate-anchors": "node utility-scripts/citation-links/citation-manager.js generate-anchors"
  }
}
```

### LLM Workflow Integration
- **During Document Editing**: LLMs can call `citation:validate` to check citation quality
- **Before Commits**: Automated validation prevents broken citations from entering repository
- **Real-time Feedback**: Script provides actionable error messages for LLM citation fixes
- **Obsidian Compatibility**: All generated citations work with Obsidian's preview and navigation features

This architecture provides a comprehensive, pattern-aware citation management system that handles your specific documentation conventions while remaining extensible for future requirements.
