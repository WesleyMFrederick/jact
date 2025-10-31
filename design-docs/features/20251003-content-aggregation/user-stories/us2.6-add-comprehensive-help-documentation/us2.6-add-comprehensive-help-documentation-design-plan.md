# US2.6: CLI Help Enhancement Design Plan

**Date**: 2025-10-31
**Author**: Application Tech Lead (Claude Sonnet 4.5)
**Status**: Design Complete - Ready for Implementation
**User Story**: [Story 2.6 Add Comprehensive Help Documentation to CLI Commands](../../content-aggregation-prd.md#Story%202.6%20Add%20Comprehensive%20Help%20Documentation%20to%20CLI%20Commands)

---

## Overview

Enhance citation-manager CLI help documentation to match the clarity and organization of popular CLI tools like jq, using a structured layout: title → usage → description → examples → options.

---

## Design Decisions

### Layout Structure (jq-style)

All commands will follow this information hierarchy:

1. **Title/Version** - Tool name and version (Commander default)
2. **Usage** - Command syntax (Commander default)
3. **Description** - What the command does (added before options)
4. **Examples** - Real-world usage patterns (added before options)
5. **Command Options** - Flags and arguments (Commander default)
6. **Exit Codes** - Return codes for automation (added after options, where relevant)

**Rationale**: Examples before options (jq pattern) lets users see real usage before diving into flags. This matches how developers actually learn CLI tools.

### Implementation Approach

**Use Commander.js native features only:**
- `.description()` - Brief command summary
- `.addHelpText('before', ...)` - Insert description paragraph + examples before options
- `.addHelpText('after', ...)` - Add exit codes after options (for complex commands)
- `.option()` - Define flags with clear descriptions
- `.optionsGroup()` - Group related options (for commands with 5+ options)

**No custom abstractions**: No template helpers, no structured objects, no external help files. Pure Commander.js patterns proven by repomix/markdownlint.

---

## Command-Specific Designs

### 1. `validate` Command (Complex - Full Enhancement)

**Current State**: Basic options, no examples or exit codes
**Enhancement**: Add description paragraph, examples before options, exit codes after options, option grouping

**Target Output**:

```text
Usage: citation-manager validate [options] <file>

citation-manager validate validates all citation links in a markdown file,
checking that target files exist and anchors resolve correctly. It can
output results in CLI-friendly format or JSON for CI/CD integration.

Examples:

    $ citation-manager validate docs/design.md
    $ citation-manager validate file.md --format json
    $ citation-manager validate file.md --lines 100-200
    $ citation-manager validate file.md --fix --scope ./docs

Arguments:
  file                      path to markdown file to validate

Output Options:
  --format <type>           output format (cli, json) (default: "cli")

Validation Options:
  --lines <range>           validate specific line range (e.g., "150-160" or "157")
  --fix                     automatically fix citation anchors

Resolution Options:
  --scope <folder>          limit file resolution to specific folder
  -h, --help                display help for command

Exit Codes:
  0  All citations valid
  1  Validation errors found
  2  System error (file not found, permission denied)
```

**Implementation**:

```javascript
program
  .command('validate')
  .description('Validate citations in a markdown file')
  .argument('<file>', 'path to markdown file to validate')
  .addHelpText('before', `
citation-manager validate validates all citation links in a markdown file,
checking that target files exist and anchors resolve correctly. It can
output results in CLI-friendly format or JSON for CI/CD integration.

Examples:

    $ citation-manager validate docs/design.md
    $ citation-manager validate file.md --format json
    $ citation-manager validate file.md --lines 100-200
    $ citation-manager validate file.md --fix --scope ./docs
`)
  .optionsGroup('Output Options')
  .option('--format <type>', 'output format (cli, json)', 'cli')
  .optionsGroup('Validation Options')
  .option('--lines <range>', 'validate specific line range (e.g., "150-160" or "157")')
  .option('--fix', 'automatically fix citation anchors')
  .optionsGroup('Resolution Options')
  .option('--scope <folder>', 'limit file resolution to specific folder')
  .addHelpText('after', `
Exit Codes:
  0  All citations valid
  1  Validation errors found
  2  System error (file not found, permission denied)
`);
```

---

### 2. `ast` Command (Simple - Minimal Enhancement)

**Current State**: Minimal help (just arguments)
**Enhancement**: Add description paragraph, examples before options, explain output structure

**Target Output**:

```text
Usage: citation-manager ast [options] <file>

citation-manager ast displays the internal Abstract Syntax Tree (AST) and
parsed citation metadata from a markdown file. This is useful for debugging
why citations aren't being detected or for inspecting available anchors.

Output includes:
  - tokens: Markdown AST from marked.js parser
  - links: Detected citation links with anchor metadata
  - headings: Parsed heading structure
  - anchors: Available anchor points (headers and blocks)

Examples:

    $ citation-manager ast docs/design.md
    $ citation-manager ast file.md | jq '.links'
    $ citation-manager ast file.md | jq '.anchors | length'

Arguments:
  file                      path to markdown file to analyze

Options:
  -h, --help                display help for command
```

**Implementation**:

```javascript
program
  .command('ast')
  .description('Display markdown AST and citation metadata')
  .argument('<file>', 'path to markdown file to analyze')
  .addHelpText('before', `
citation-manager ast displays the internal Abstract Syntax Tree (AST) and
parsed citation metadata from a markdown file. This is useful for debugging
why citations aren't being detected or for inspecting available anchors.

Output includes:
  - tokens: Markdown AST from marked.js parser
  - links: Detected citation links with anchor metadata
  - headings: Parsed heading structure
  - anchors: Available anchor points (headers and blocks)

Examples:

    $ citation-manager ast docs/design.md
    $ citation-manager ast file.md | jq '.links'
    $ citation-manager ast file.md | jq '.anchors | length'
`);
```

---

### 3. `extract` Commands (Already Comprehensive)

**Current State**: Extract commands (`extract links`, `extract header`, `extract file`) already have comprehensive help with examples, exit codes, and notes.

**Action**: **No changes required**. Current implementation already exceeds popular tool standards.

**Verification**: Existing help follows this pattern:
- ✅ Description
- ✅ Workflow explanation (where relevant)
- ✅ Examples with multiple usage patterns
- ✅ Exit codes
- ✅ Notes section for advanced usage

---

## Semantic Suggestion Map (High-Value Addition)

### Implementation

Add semantic suggestion map for common user mistakes (pattern from repomix):

```javascript
// Add to citation-manager.js before program definition
const semanticSuggestionMap = {
  // Command synonyms
  check: ['validate'],
  verify: ['validate'],
  lint: ['validate'],
  parse: ['ast'],
  tree: ['ast'],
  debug: ['ast'],
  show: ['ast'],

  // Option synonyms
  fix: ['--fix'],
  repair: ['--fix'],
  correct: ['--fix'],
  output: ['--format'],
  json: ['--format json'],
  range: ['--lines'],
  folder: ['--scope'],
  directory: ['--scope'],
  path: ['--scope'],
  dir: ['--scope']
};

// Configure custom error output
program.configureOutput({
  outputError: (str, write) => {
    const match = str.match(/unknown (?:command|option) '([^']+)'/);
    if (match) {
      const input = match[1].replace(/^--?/, '');
      const suggestions = semanticSuggestionMap[input];

      if (suggestions) {
        write(`Unknown ${match[0].includes('command') ? 'command' : 'option'} '${match[1]}'\n`);
        write(`Did you mean: ${suggestions.join(', ')}?\n`);
        return;
      }
    }
    write(str);
  }
});
```

**Benefits**:
- Catches conceptual errors (user thinking in synonyms)
- High ROI: ~20 lines of code, significant UX improvement
- Aligns with "fail fast" principle by providing immediate correction

---

## Architecture Alignment

### Principles Honored

✅ **Simplicity First** (MVP): Uses only Commander.js native features, zero custom abstractions
✅ **Foundation Reuse** (MVP): Leverages Commander.js help system as-is
✅ **Follow Conventions** (Naming): Matches jq's proven layout pattern
✅ **Tool-First Design** (Deterministic): Framework generates help, not manual string building
✅ **Tight Cohesion** (Modular): Help content colocated with command definitions
✅ **Progressive Defaults** (Format): Option grouping for complex commands, flat for simple ones

### Principles Explicitly NOT Applied

❌ **Data Model First** - Deliberately rejected structured help objects as over-engineering
❌ **Behavior as Data** - Static strings appropriate for static help content

---

## Implementation Checklist

- [ ] Update `validate` command:
  - [ ] Add `.addHelpText('before', ...)` with description + examples
  - [ ] Add `.optionsGroup()` for option organization
  - [ ] Add `.addHelpText('after', ...)` with exit codes

- [ ] Update `ast` command:
  - [ ] Add `.addHelpText('before', ...)` with description + examples + output structure

- [ ] Add semantic suggestion map:
  - [ ] Create `semanticSuggestionMap` constant
  - [ ] Configure `program.configureOutput()` with custom error handler

- [ ] Verify existing extract commands:
  - [ ] Confirm `extract links --help` output is acceptable
  - [ ] Confirm `extract header --help` output is acceptable
  - [ ] Confirm `extract file --help` output is acceptable
  - [ ] Confirm top-level `extract --help` lists subcommands clearly

- [ ] Testing:
  - [ ] Manual: Run `citation-manager validate --help` and verify output
  - [ ] Manual: Run `citation-manager ast --help` and verify output
  - [ ] Manual: Test suggestion map with invalid commands/options
  - [ ] No automated tests required (help text is presentational)

---

## Success Criteria (US2.6 Acceptance Criteria)

**AC1**: validate command help includes description, options, examples, exit codes ✅
**AC2**: ast command help includes description, output structure, use cases ✅
**AC3**: extract command top-level help lists subcommands (already complete) ✅
**AC4**: extract subcommands have detailed help (already complete) ✅
**AC5**: Standard help flags work for all commands (Commander.js default) ✅

---

## Non-Goals

- ❌ Restructuring existing extract command help (already comprehensive)
- ❌ Creating template helpers or structured objects (YAGNI)
- ❌ External help files (violates cohesion principle)
- ❌ Man page generation (not in scope)

---

## Related Documentation

- [Content Aggregation PRD - US2.6](../../content-aggregation-prd.md#Story%202.6%20Add%20Comprehensive%20Help%20Documentation%20to%20CLI%20Commands)
- [Commander.js Documentation](https://github.com/tj/commander.js)
- [jq Manual](https://jqlang.org/manual/) - Reference for help layout style

---

## Future Enhancements (Out of Scope)

- Interactive help mode (`citation-manager help`)
- Shell completion scripts
- Web-based documentation generation from help text
- Localization/internationalization
