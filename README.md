# jact - Just Another Context Tool

A citation validation and management tool for markdown files that enforces cross-document links and proper anchor patterns. Features three-tier validation with warning detection and (limited) automated citation correction capabilities.

## Installation

```bash
# Install dependencies
npm install

# Build TypeScript and link CLI globally
npm run build
npm link

# Verify CLI is available
jact --help
```

> **Note:** Source is TypeScript (`src/*.ts`), compiled to `dist/*.js`. After any TS changes, re-run `npm run build` to update the CLI.

## Features

### Three-Tier Validation System

The jact implements a comprehensive validation approach with three distinct status levels:

#### 1. Errors (Critical Issues)
- **File Not Found**: Target file does not exist in filesystem
- **Invalid Path**: Malformed or inaccessible file paths
- **Anchor Not Found**: Referenced header/anchor missing in target file
- **Invalid Caret Syntax**: Malformed requirement/criteria patterns

#### 2. Warnings (Potential Issues)
- **Short Filename Citations**: Citations using only filename without directory context (`@file.md`)
- **Cross-Directory References**: Links spanning multiple directory levels (`@../../other/file.md`)
- **Ambiguous Paths**: Multiple files with same name in different directories
- **Relative Path Usage**: Citations using relative paths without full context (`@./local.md`)

#### 3. Informational (Status Updates)
- **Valid Citations**: Successfully resolved and validated links
- **Path Conversions**: Automatic path transformations applied during fix operations
- **Cache Hits**: Files found via intelligent scope-based resolution
- **Backup Operations**: File backup confirmations during fix operations

### Enhanced Fix Capabilities

- **Automatic Path Conversion**: Transforms short filenames and relative paths to absolute paths
- **Warning Resolution**: Converts warning-level issues to validated citations
- **Backup Creation**: Automatic backup files before making changes
- **Dry Run Mode**: Preview changes without applying modifications
- **JSON Output**: Detailed reporting of all path conversions and fixes applied

## Usage

### Validate Citations

```bash
# Validate citations in a markdown file (CLI output)
npm run jact:validate path/to/file.md

# Get JSON output for programmatic use
npm run jact:validate path/to/file.md -- --format json

# Validate specific line range
npm run jact:validate path/to/file.md -- --lines 150-160

# Validate single line
npm run jact:validate path/to/file.md -- --lines 157

# Combine line filtering with JSON output
npm run jact:validate path/to/file.md -- --lines 157 --format json

# Validate with folder scope (smart filename resolution)
npm run jact:validate path/to/file.md -- --scope /path/to/project/docs

# Combine scope with line filtering
npm run jact:validate path/to/file.md -- --lines 148-160 --scope /path/to/project/docs

# Auto-fix kebab-case anchors to raw header format for better Obsidian compatibility
npm run jact:validate path/to/file.md -- --fix --scope /path/to/project/docs

# Direct CLI usage
# node utility-scripts/citation-links/jact.js validate path/to/file.md --lines 157 --scope /path/to/docs
```

### Enhanced Fix Command

The fix command provides comprehensive citation correction with warning detection and path conversion capabilities:

```bash
# Basic fix with automatic backup creation
npm run jact:validate path/to/file.md -- --fix --scope /path/to/project/docs

# Fix with dry-run mode to preview changes
npm run jact:validate path/to/file.md -- --fix --dry-run --scope /path/to/project/docs

# Fix with JSON output for detailed reporting
npm run jact:validate path/to/file.md -- --fix --format json --scope /path/to/project/docs

# Direct CLI usage with enhanced options
node utility-scripts/citation-links/jact.js validate path/to/file.md --fix --backup --scope /path/to/docs
```

### View AST and Extracted Data

```bash
# Show parsed AST and extracted citation data
npm run jact:ast path/to/file.md

# Direct CLI usage
node utility-scripts/citation-links/jact.js ast path/to/file.md
```

### Extract Base Paths (Facade Pattern)

The base-paths command is implemented as an npm script facade that wraps the validate command.

```bash
# Extract distinct base paths from citations
npm run jact:base-paths path/to/file.md
```

This is equivalent to: `npm run jact:validate path/to/file.md -- --format json | jq -r '.links[] | select(.target.path.absolute) | .target.path.absolute' | sort -u`

**Rationale**: With the Validation Enrichment Pattern (US1.8), LinkObjects include target.path.absolute directly. The facade preserves the convenient interface while eliminating redundant code.

### Extract File Content

Extract entire file content directly without requiring a source document containing links:

```bash
# Extract complete file content
node tools/jact/src/jact.js extract file docs/architecture.md

# Extract with scope restriction for filename resolution
node tools/jact/src/jact.js extract file architecture.md --scope ./docs

# Pipe output to jq for content filtering
node tools/jact/src/jact.js extract file file.md | jq '.extractedContentBlocks'
```

**Output Format**: JSON OutgoingLinksExtractedContent structure with deduplicated content blocks

**Exit Codes**:
- `0`: File extracted successfully
- `1`: File not found or validation failed
- `2`: System error (permission denied, parse error)

**Use Cases**:
- Direct content extraction without creating source documents
- Building LLM context packages from specific files
- Automated content aggregation pipelines
- File content validation and inspection

### Run Tests

```bash
# Run the test suite
npm run test:citation
```

**Test Coverage:**
- ✅ Basic citation validation (happy path)
- ✅ Broken link detection and error reporting
- ✅ JSON output format validation
- ✅ AST generation and parsing
- ✅ Non-existent file error handling
- ✅ **Line range filtering** (new)
- ✅ **Folder scope with smart file resolution** (new)
- ✅ **Combined line range + scope functionality** (new)
- ✅ **Single line filtering** (new)
- ✅ **URL-encoded path handling** (new)
- ✅ **Symlink-aware path resolution** (new)
- ✅ **Obsidian absolute path format support** (new)

**Enhanced Test Features:**
- **Line Filtering Tests**: Validate `--lines 13-14` and `--lines 7` options work correctly
- **Scope Resolution Tests**: Verify `--scope` option builds file cache and resolves broken paths
- **JSON Integration Tests**: Ensure scope messages don't interfere with JSON output format
- **Edge Case Coverage**: Test single line filtering and combined option usage
- **Symlink Resolution Tests**: Verify proper handling of symlinked directories and files
- **URL Encoding Tests**: Validate paths with spaces and special characters (`%20`, etc.)
- **Obsidian Path Tests**: Test Obsidian absolute path format (`0_SoftwareDevelopment/...`)

## Supported Citation Patterns

### Cross-Document Links

```markdown
[Link Text](relative/path/to/file.md#anchor-name)
[Component Details](../architecture/components.md#auth-service)
```

**Markdown Headers Handling:**
- **Headers with markdown formatting** (backticks, bold, italic, highlights, links) use raw text as anchors
- **Plain text headers** generate both kebab-case and raw header anchors
- **URL encoding required** for spaces and special characters in markdown headers
- **Obsidian Compatibility**: Raw header format is preferred for better navigation experience

```markdown
# Plain text header → #plain-text-header (kebab-case) OR #Plain%20text%20header (raw, preferred)
# Header with `backticks` → #Header%20with%20%60backticks%60 (raw only)
# Header with **bold** text → #Header%20with%20**bold**%20text (raw only)
```

## Auto-Fix Functionality

The citation validator can automatically fix kebab-case anchors to use raw header format for better Obsidian compatibility.

### When Auto-Fix Applies

- **Only validated citations**: Auto-fix only converts kebab-case anchors that point to existing headers
- **Safe conversions**: Only converts when a raw header equivalent exists and is validated
- **Obsidian optimization**: Raw header format provides more reliable navigation in Obsidian

### Auto-Fix Examples

```markdown
# Before auto-fix (kebab-case)
[Architecture](design.md#code-and-file-structure)
[Testing Guide](guide.md#test-implementation)

# After auto-fix (raw header format)
[Architecture](design.md#Code%20and%20File%20Structure)
[Testing Guide](guide.md#Test%20Implementation)
```

### Auto-Fix Usage

```bash
# Auto-fix kebab-case citations in a file
npm run jact:validate path/to/file.md -- --fix --scope /path/to/docs

# Check what would be fixed without making changes
npm run jact:validate path/to/file.md -- --scope /path/to/docs
```

**Benefits of Raw Header Format:**
- ✅ **Reliable Obsidian navigation** - clicking links consistently jumps to the correct header
- ✅ **Future-proof** - works consistently across different markdown renderers
- ✅ **Explicit anchoring** - uses the exact header text as it appears

### Caret Syntax (Requirements/Criteria)

```markdown
- FR1: Functional requirement. ^FR1
- NFR2: Non-functional requirement. ^NFR2
- AC1: Acceptance criteria. ^US1-1AC1
- Task: Implementation task. ^US1-1T1
- MVP Priority 1. ^MVP-P1
```

### Wiki-Style Internal References

```markdown
[[#^FR1|FR1]]
[[#user-authentication|User Authentication]]
```

### Emphasis-Marked Anchors

```markdown
### ==**Component Name**== {#component-name}
[Reference](file.md#==**Component%20Name**==)
```

## Output Formats

### CLI Format with Three-Tier Validation (Human-Readable)

```text
Citation Validation Report
==========================

File: path/to/file.md
Processed: 8 citations found

✅ VALID CITATIONS (3)
├─ Line 5: [Component](file.md#component) ✓
├─ Line 8: ^FR1 ✓
└─ Line 12: [[#anchor|Reference]] ✓

⚠️  WARNINGS (3)
├─ Line 15: @shortname.md
│  └─ Short filename citation without directory context
│  └─ Suggestion: Use full path @/full/path/to/shortname.md
├─ Line 18: @../other/file.md
│  └─ Cross-directory reference spans multiple levels
│  └─ Suggestion: Consider absolute path for clarity
└─ Line 22: @./local.md
│  └─ Relative path without full context
│  └─ Suggestion: Use absolute path @/current/directory/local.md

❌ CRITICAL ERRORS (2)
├─ Line 3: [Missing](nonexistent.md#anchor)
│  └─ File not found: nonexistent.md
│  └─ Suggestion: Check if file exists or fix path
└─ Line 7: ^invalid
│  └─ Invalid caret pattern: ^invalid
│  └─ Suggestion: Use format: ^FR1, ^US1-1AC1, ^NFR2, ^MVP-P1

SUMMARY:
- Total citations: 8
- Valid: 3
- Warnings: 3 (potential issues requiring review)
- Critical errors: 2 (must fix)
- Validation time: 0.1s

⚠️  VALIDATION COMPLETED WITH WARNINGS - Review 3 warnings, fix 2 critical errors
```

### Enhanced Fix Output

```text
Citation Fix Report
===================

File: path/to/file.md
Citations processed: 6

PATH CONVERSIONS (4):
📝 Line 15: @shortname.md → @/full/path/to/shortname.md
📝 Line 18: @../other/file.md → @/full/path/to/other.md
📝 Line 22: @./local.md → @/current/directory/local.md
📝 Line 25: @relative.md → @/resolved/path/to/relative.md

⚠️  WARNINGS RESOLVED (4):
├─ Short filename citations: 2 converted to absolute paths
├─ Cross-directory references: 1 standardized
└─ Relative path citations: 1 converted to absolute

💾 BACKUP CREATED:
└─ path/to/file.md → path/to/file.md.backup.20240919-143022

✅ VALIDATION AFTER FIX:
- Total citations: 6
- Valid: 6
- Warnings: 0
- Errors: 0

✅ FIX COMPLETED SUCCESSFULLY - All warning-level issues resolved
```

### Enhanced JSON Format with Three-Tier Validation

#### Validation Output with Warnings

```json
{
  "file": "path/to/file.md",
  "summary": {
    "total": 8,
    "valid": 3,
    "warnings": 3,
    "errors": 2,
    "timestamp": "2024-09-19T21:30:22.123Z"
  },
  "results": [
    {
      "line": 5,
      "citation": "[Component](file.md#component)",
      "status": "valid",
      "type": "cross-document"
    },
    {
      "line": 15,
      "citation": "@shortname.md",
      "status": "warning",
      "type": "short_filename",
      "message": "Citation uses only filename without directory context",
      "targetPath": null,
      "suggestion": "Use full path: @/full/path/to/shortname.md"
    },
    {
      "line": 18,
      "citation": "@../other/file.md",
      "status": "warning",
      "type": "cross_directory",
      "message": "Cross-directory reference spans multiple levels",
      "targetPath": "/resolved/path/to/other/file.md",
      "suggestion": "Consider absolute path for clarity"
    },
    {
      "line": 3,
      "citation": "[Missing](nonexistent.md#anchor)",
      "status": "error",
      "type": "cross-document",
      "error": "File not found: nonexistent.md",
      "suggestion": "Check if file exists or fix path"
    }
  ],
  "warnings": [
    {
      "line": 15,
      "citation": "@shortname.md",
      "type": "short_filename",
      "message": "Citation uses only filename without directory context"
    },
    {
      "line": 18,
      "citation": "@../other/file.md",
      "type": "cross_directory",
      "message": "Cross-directory reference spans multiple levels"
    },
    {
      "line": 22,
      "citation": "@./local.md",
      "type": "relative_path",
      "message": "Relative path without full context"
    }
  ],
  "errors": [
    {
      "line": 3,
      "citation": "[Missing](nonexistent.md#anchor)",
      "type": "file_not_found",
      "message": "Target file does not exist"
    },
    {
      "line": 7,
      "citation": "^invalid",
      "type": "invalid_caret_syntax",
      "message": "Malformed requirement/criteria pattern"
    }
  ],
  "validationTime": "0.1s"
}
```

#### Enhanced Fix Output with Path Conversions

```json
{
  "file": "path/to/file.md",
  "summary": {
    "citationsProcessed": 6,
    "pathConversions": 4,
    "warningsResolved": 4,
    "backupsCreated": 1,
    "validationAfterFix": {
      "total": 6,
      "valid": 6,
      "warnings": 0,
      "errors": 0
    },
    "timestamp": "2024-09-19T21:30:22.123Z"
  },
  "pathConversions": [
    {
      "line": 15,
      "original": "@shortname.md",
      "converted": "@/full/path/to/shortname.md",
      "type": "short_filename_expansion",
      "resolvedPath": "/full/path/to/shortname.md"
    },
    {
      "line": 18,
      "original": "@../other/file.md",
      "converted": "@/full/path/to/other.md",
      "type": "relative_to_absolute",
      "resolvedPath": "/full/path/to/other.md"
    },
    {
      "line": 22,
      "original": "@./local.md",
      "converted": "@/current/directory/local.md",
      "type": "relative_to_absolute",
      "resolvedPath": "/current/directory/local.md"
    },
    {
      "line": 25,
      "original": "@relative.md",
      "converted": "@/resolved/path/to/relative.md",
      "type": "short_filename_expansion",
      "resolvedPath": "/resolved/path/to/relative.md"
    }
  ],
  "warningsResolved": {
    "shortFilename": 2,
    "crossDirectory": 1,
    "relativePaths": 1,
    "total": 4
  },
  "backups": [
    {
      "original": "path/to/file.md",
      "backup": "path/to/file.md.backup.20240919-143022",
      "timestamp": "2024-09-19T21:30:22.123Z"
    }
  ],
  "validationTime": "0.2s"
}
```

## Folder Scope Feature

### Smart Filename Resolution

When using `--scope <folder>`, the tool builds a cache of all markdown files in the specified folder and enables smart filename matching:

```bash
# Enable smart resolution for design-docs folder
npm run jact:validate story.md -- --scope /path/to/design-docs
```

**Benefits:**
- **Resolves short filenames**: `file.md` → finds actual file anywhere in scope folder
- **Handles broken relative paths**: `../missing/path/file.md` → finds `file.md` in scope
- **Detects duplicate filenames**: Warns when multiple files have the same name
- **Performance**: Caches file locations for fast lookup

**Example Output with Warning Detection:**

```text
📁 Scanned 34 files in /path/to/design-docs
⚠️  Found 2 duplicate filenames: config.md, guide.md

Citation Validation Report
==========================
✅ VALID CITATIONS (2)
├─ Line 146: [Component](version-analysis.md#anchor) ✓  // Found via cache
└─ Line 147: [Guide](implementation-guide.md#section) ✓  // Found via cache

⚠️  WARNINGS (2)
├─ Line 148: @config.md
│  └─ Short filename citation - Multiple files found: /docs/setup/config.md, /docs/api/config.md
│  └─ Suggestion: Specify directory context: @setup/config.md or @api/config.md
└─ Line 152: @../external/guide.md
│  └─ Cross-directory reference with potential ambiguity
│  └─ Suggestion: Use absolute path: @/full/path/to/external/guide.md

SUMMARY:
- Total citations: 4
- Valid: 2
- Warnings: 2 (review for clarity)
- Validation time: 0.2s
```

**Use Cases:**
- **Large documentation projects** with complex folder structures
- **Obsidian vaults** where relative paths may be inconsistent
- **Refactored projects** where files moved but citations weren't updated
- **Symlinked directories** where documentation spans multiple filesystem locations

## Advanced Path Resolution

### Symlink Support

The tool automatically detects and resolves symlinked directories:

```bash
# Works with symlinked documentation folders
npm run jact:validate /path/to/symlinked/docs/story.md
```

**Resolution Strategy:**
1. **Standard Path**: Try relative path from current location
2. **Obsidian Absolute**: Handle `0_SoftwareDevelopment/...` format paths
3. **Symlink Resolution**: Resolve symlinks and try relative path from real location
4. **Cache Fallback**: Use filename matching in scope folder

**Debug Information:**
When validation fails, the tool shows all attempted resolution paths:

```text
Source via symlink: /link/path → /real/path
Tried: /link/path/resolved/file.md
Symlink-resolved: /real/path/resolved/file.md
```

### URL Encoding Support

Handles URL-encoded paths automatically:

```markdown
[Design Principles](../../../Design%20Principles.md)  // Spaces as %20
[Component Details](`setupOrchestrator.js`)          // Backticks preserved
```

**Supported Encodings:**
- `%20` for spaces
- `%60` for backticks
- Other standard URL encodings

**Automatic Decoding:**
- Tries both encoded and decoded versions
- Maintains backward compatibility
- Works with all path resolution strategies

### Obsidian Absolute Paths

Supports Obsidian's absolute path format:

```markdown
[Design Principles](0_SoftwareDevelopment/claude-code-knowledgebase/design-docs/Design%20Principles.md)
```

**Path Resolution:**
- Walks up directory tree from source file
- Finds project root automatically
- Resolves to filesystem absolute path
- Works with symlinked project structures

## Exit Codes

- `0`: All citations valid (success)
- `1`: Broken citations found (validation failure)
- `2`: File not found or permission error

## Architecture

The tool consists of:

- **JactCli**: Main orchestrator with CLI interface
- **MarkdownParser**: AST generation using `marked` library
- **CitationValidator**: Pattern validation and file existence checking

## Realistic Usage Examples

### Example 1: Documentation Project with Warning Detection

**Scenario**: Multi-directory documentation project with ambiguous citation patterns.

```bash
# Validate project documentation
npm run jact:validate ./project-docs/user-guide.md -- --scope ./project-docs
```

**Sample Output:**

```text
📁 Scanned 127 files in ./project-docs
⚠️  Found 3 duplicate filenames: setup.md, api.md, troubleshooting.md

Citation Validation Report
==========================

⚠️  WARNINGS (5)
├─ Line 23: @setup.md
│  └─ Short filename citation - Multiple files: ./admin/setup.md, ./user/setup.md
│  └─ Suggestion: Use @admin/setup.md or @user/setup.md for clarity
├─ Line 45: @../../legacy/api.md
│  └─ Cross-directory reference spans multiple parent levels
│  └─ Suggestion: Use absolute path @/project-docs/legacy/api.md
├─ Line 67: @./local-config.md
│  └─ Relative path citation without full context
│  └─ Suggestion: Use @/project-docs/guides/local-config.md

RECOMMENDATIONS:
- Review 5 warning-level citations for improved clarity
- Consider running --fix to automatically resolve path issues
```

### Example 2: Automated Citation Cleanup with Path Conversion

**Scenario**: Legacy documentation requiring standardized citation paths.

```bash
# Fix citations with automatic path conversion and backup
npm run jact:validate ./legacy-docs/migration-guide.md -- --fix --scope ./legacy-docs --format json
```

**Sample JSON Output:**

```json
{
  "summary": {
    "citationsProcessed": 12,
    "pathConversions": 8,
    "warningsResolved": 8,
    "backupsCreated": 1
  },
  "pathConversions": [
    {
      "line": 34,
      "original": "@old-system.md",
      "converted": "@/legacy-docs/architecture/old-system.md",
      "type": "short_filename_expansion"
    },
    {
      "line": 67,
      "original": "@../config/settings.md",
      "converted": "@/legacy-docs/config/settings.md",
      "type": "relative_to_absolute"
    }
  ],
  "warningsResolved": {
    "shortFilename": 5,
    "crossDirectory": 2,
    "relativePaths": 1
  }
}
```

### Example 3: CI/CD Integration with Warning Tolerance

**Scenario**: Automated validation in build pipeline with warning awareness.

```bash
# Validate with structured output for CI processing
npm run jact:validate ./docs --format json > citation-report.json

# Process results programmatically
node -e "
const report = JSON.parse(require('fs').readFileSync('citation-report.json'));
const { errors, warnings } = report.summary;

if (errors > 0) {
  console.log(\`❌ ${errors} critical citation errors found\`);
  process.exit(1);
}

if (warnings > 0) {
  console.log(\`⚠️  ${warnings} citation warnings found (review recommended)\`);
  console.log('Consider running: npm run jact:validate ./docs -- --fix');
}

console.log('✅ Citation validation passed');
"
```

### Example 4: Obsidian Vault Maintenance

**Scenario**: Regular maintenance of large Obsidian knowledge base.

```bash
# Weekly citation health check
npm run jact:validate ./ObsidianVault -- --scope ./ObsidianVault --format json > weekly-report.json

# Auto-fix common issues while preserving backups
npm run jact:validate ./ObsidianVault/daily-notes -- --fix --backup --scope ./ObsidianVault
```

**Expected Benefits:**
- **Standardized Citations**: All short filename citations converted to unambiguous paths
- **Cross-Vault Compatibility**: Citations work consistently across different vault structures
- **Backup Safety**: Original files preserved before any automated changes
- **Warning Resolution**: Proactive identification and correction of potential link issues

## Error Detection

The validator detects:
- ✅ Broken cross-document links (missing files)
- ✅ Missing anchors in target documents
- ✅ Invalid caret syntax patterns
- ✅ Malformed emphasis-marked anchors
- ✅ File path resolution errors
- ✅ **Short filename ambiguity** (new)
- ✅ **Cross-directory path complexity** (new)
- ✅ **Relative path context issues** (new)

**Enhanced Error Reporting:**
- Shows actual available headers when anchors are not found
- Displays both header text and corresponding anchor format
- Provides URL-encoded anchor suggestions for markdown headers
- **Identifies warning-level issues** that may cause future problems
- **Suggests specific path corrections** for ambiguous citations

```text
❌ Anchor not found: #wrong-anchor
└─ Available headers: "Header with `backticks`" → #Header%20with%20%60backticks%60,
   "Plain Header" → #plain-header

⚠️  Short filename detected: @config.md
└─ Multiple matches found: ./admin/config.md, ./user/config.md
└─ Suggestion: Use @admin/config.md or @user/config.md
```

## Performance

- Validates typical story files in <5 seconds
- Efficient pattern matching with regex optimization
- Graceful error handling with detailed reporting
