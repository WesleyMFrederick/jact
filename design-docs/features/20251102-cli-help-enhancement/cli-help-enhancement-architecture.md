# CLI Help Enhancement - Feature Architecture

**Feature ID:** 20251102-cli-help-enhancement
**Version:** 1.0
**Status:** Design Phase
**Last Updated:** 2025-11-02

---

## Architecture Overview

This feature enhances CLI help output using a Strategy Pattern + Factory Pattern approach, following Data-First Design principles. The architecture separates help content (data) from formatting logic (strategies), enabling testability, maintainability, and extensibility.

### Core Principles Applied

- **Data-First Design:** Help content defined as declarative data structures
- **Strategy Pattern:** Swappable formatting strategies (ANSI color, plain text, future formats)
- **Factory Pattern:** Dependency injection for testability
- **Action-Based Organization:** Files named by transformation operations
- **Loose Coupling, Tight Cohesion:** Components interact through well-defined interfaces

---

## Component Architecture

```plaintext
┌─────────────────────────────────────────────────────────────┐
│                     citation-manager.js                     │
│                   (CLI Entry Point / Orchestrator)          │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ├─> Commander.js
                          │   (.configureHelp() or .addHelpText())
                          │
                          v
                ┌─────────────────────┐
                │   HelpFormatter     │
                │   (Orchestrator)    │
                └──────────┬──────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              v            v            v
      ┌──────────┐  ┌──────────┐  ┌──────────┐
      │ Content  │  │ Format   │  │ Format   │
      │ Loader   │  │ Strategy │  │ Strategy │
      │          │  │ (ANSI)   │  │ (Plain)  │
      └────┬─────┘  └──────────┘  └──────────┘
           │
           v
    ┌─────────────┐
    │ helpContent │
    │   (Data)    │
    └─────────────┘
```

### Component Responsibilities

#### 1. **helpContent.js** (Data Layer)
**Type:** Data Module
**Responsibility:** Define help content as declarative data structures

**Exports:**
- `mainHelpContent` - Root command help
- `validateHelpContent` - Validate subcommand help
- `astHelpContent` - AST subcommand help
- `extractHelpContent` - Extract command help
- `extractLinksHelpContent` - Extract links subcommand help
- `extractHeaderHelpContent` - Extract header subcommand help
- `extractFileHelpContent` - Extract file subcommand help

**Data Contract:**

```javascript
{
  title: {
    text: string,
    subtitle: string
  },
  sections: [
    {
      header: string,        // "USAGE", "OPTIONS", etc.
      type: string,          // "usage" | "list" | "examples" | "exitCodes"
      items: [
        {
          label: string,
          description: string
        }
      ]
    }
  ]
}
```

---

#### 2. **FormatStrategy.js** (Strategy Interface)
**Type:** Abstract Base Class
**Responsibility:** Define formatting contract

**Interface:**

```javascript
class FormatStrategy {
  formatTitle(titleData) → string
  formatSection(sectionData) → string
  formatHelp(helpContent) → string
}
```

**Pattern:** Abstract interface enforces contract for concrete strategies

---

#### 3. **AnsiColorStrategy.js** (Concrete Strategy)
**Type:** Strategy Implementation
**Responsibility:** Transform help data into ANSI-colored output

**Transformation:**

```text
helpContent (data) → ANSI-formatted string (output)
```

**Color Mapping:**
- Blue (`\x1b[0;34m`) - Tool name, titles
- Yellow (`\x1b[1;33m`) - Section headers (ALL CAPS)
- Green (`\x1b[0;32m`) - Subsection labels
- Reset (`\x1b[0m`) - After each colored segment

**Key Methods:**
- `formatTitle()` - Apply blue color to title
- `formatSection()` - Apply yellow to headers, format items
- `formatHelp()` - Orchestrate full help output with blank line prefix

---

#### 4. **PlainTextStrategy.js** (Concrete Strategy)
**Type:** Strategy Implementation
**Responsibility:** Transform help data into plain text (no colors)

**Use Cases:**
- Testing (deterministic snapshot testing)
- Non-ANSI terminals
- Piped output
- CI/CD environments

**Transformation:**

```text
helpContent (data) → Plain text string (output)
```

---

#### 5. **HelpFormatter.js** (Orchestrator)
**Type:** Orchestrator Component
**Responsibility:** Coordinate strategy selection and help generation

**Dependencies:**
- `FormatStrategy` (injected via constructor)
- `helpContent` (imported data module)

**Key Methods:**

```javascript
constructor(strategy)
generateHelp(commandName) → string
loadContentFor(commandName) → helpContent object
```

**Data Flow:**
1. Receive command name
2. Load appropriate help content from `helpContent.js`
3. Delegate to strategy for formatting
4. Return formatted string

---

#### 6. **componentFactory.js** (Factory)
**Type:** Factory Module
**Responsibility:** Create HelpFormatter with dependency injection

**New Export:**

```javascript
export function createHelpFormatter(options = {}) {
  const strategy = options.strategy || new AnsiColorStrategy();
  return new HelpFormatter(strategy);
}
```

**Pattern:** Mirrors existing factory functions (`createMarkdownParser`, `createFileCache`)

---

## Directory Structure

```plaintext
tools/citation-manager/src/
├── citation-manager.js              (MODIFY - integrate HelpFormatter)
├── core/
│   └── HelpFormatter/               (NEW component folder)
│       ├── HelpFormatter.js         (orchestrator)
│       ├── helpTypes.js             (data contracts)
│       └── formatStrategies/        (strategy subfolder)
│           ├── FormatStrategy.js    (interface/base)
│           ├── AnsiColorStrategy.js (ANSI implementation)
│           └── PlainTextStrategy.js (plain implementation)
├── cli/
│   └── helpContent.js               (NEW - declarative help data)
└── factories/
    └── componentFactory.js          (MODIFY - add createHelpFormatter)
```

**Rationale:**
- Follows Action-Based File Organization principle
- Component-level folder (`HelpFormatter/`) groups related operations
- Strategy subfolder (`formatStrategies/`) extracts variants
- Data contracts separate from implementation (`helpTypes.js`)
- Mirrors existing `ContentExtractor/eligibilityStrategies/` pattern

---

## Data Flow

### Help Generation Flow

```plaintext
1. User runs: citation-manager validate --help
                    │
                    v
2. Commander.js triggers custom help formatter
                    │
                    v
3. createHelpFormatter() creates instance
   - Default: AnsiColorStrategy
   - Test: PlainTextStrategy (injected)
                    │
                    v
4. HelpFormatter.generateHelp('validate')
   - Loads validateHelpContent from data module
                    │
                    v
5. strategy.formatHelp(helpContent)
   - AnsiColorStrategy applies ANSI codes
   - PlainTextStrategy applies plain formatting
                    │
                    v
6. Returns formatted string to Commander.js
                    │
                    v
7. Commander.js outputs to stdout
```

---

## Integration Points

### Commander.js Integration

**Option A: Global Help Override** (Recommended)

```javascript
program.configureHelp({
  formatHelp: (cmd, helper) => {
    const formatter = createHelpFormatter();
    return formatter.generateHelp(cmd.name());
  }
});
```

**Pros:**
- Single integration point
- Consistent across all commands
- Automatic inheritance for new commands

**Cons:**
- Less granular control per command

---

#### Option B: Per-Command Injection

```javascript
program
  .command('validate')
  .addHelpText('beforeAll', () => {
    const formatter = createHelpFormatter();
    return formatter.generateHelp('validate');
  });
```

**Pros:**
- Granular control per command
- Can customize per command if needed

**Cons:**
- Repetitive setup for each command
- More maintenance overhead

**Decision:** Use Option A (Global Override) for consistency and maintainability

---

## Testing Strategy

### Unit Tests

**Component:** `AnsiColorStrategy`
**Tests:**
- Color codes applied correctly (blue, yellow, green)
- Color reset after each segment
- Section headers converted to ALL CAPS
- Indentation levels correct (2 spaces, 4 spaces)

**Component:** `PlainTextStrategy`
**Tests:**
- No ANSI codes in output
- Structure preserved without colors
- Snapshot testing for deterministic output

**Component:** `HelpFormatter`
**Tests:**
- Correct content loaded for each command name
- Strategy delegation works
- Unknown command names handled gracefully

**Component:** `helpContent`
**Tests:**
- Data structure validation
- All required fields present
- No missing content vs current help

---

### Integration Tests

**Test:** Commander.js Integration
**Verification:**
- Help displayed for all command levels
- Colors applied in terminal output
- Content matches expected format

**Test:** Backwards Compatibility
**Verification:**
- `-h` flag works
- `--help` flag works
- `help [command]` works
- Error handling unchanged

---

### Snapshot Tests

**Approach:** Use PlainTextStrategy for deterministic output
**Tests:**
- Capture expected help for each command
- Detect unintended formatting changes
- Verify content completeness

---

## Performance Considerations

### Optimization Strategies

1. **Static Content:** Help content defined at module load time (no runtime generation)
2. **No I/O:** All content in-memory, no file reads
3. **Minimal Dependencies:** ANSI codes are built-in, no external libraries
4. **Lazy Strategy Creation:** Factory creates strategy only when needed

### Performance Targets

- Help generation: <10ms (99th percentile)
- Memory overhead: <100KB for all help content
- No perceptible latency for user

---

## Extensibility

### Adding New Format Strategies

**Steps:**
1. Create new strategy class extending `FormatStrategy`
2. Implement required methods (`formatTitle`, `formatSection`, `formatHelp`)
3. Export from `formatStrategies/` folder
4. Register in factory (if needed)

#### Example: Markdown Strategy

```javascript
class MarkdownStrategy extends FormatStrategy {
  formatTitle(titleData) {
    return `# ${titleData.text}\n${titleData.subtitle}\n`;
  }

  formatSection(sectionData) {
    return `## ${sectionData.header}\n...`;
  }

  formatHelp(helpContent) {
    // Compose markdown output
  }
}
```

---

### Adding New Help Content

**Steps:**
1. Add new content object to `helpContent.js`
2. Follow existing data contract
3. Map command name to content in `HelpFormatter.loadContentFor()`

**Example:**

```javascript
export const newCommandHelpContent = {
  title: { text: 'New Command', subtitle: 'Description' },
  sections: [
    { header: 'USAGE', type: 'usage', items: [...] }
  ]
};
```

---

## Migration Path

### Phase 1: Foundation
- Create data structures
- Implement base strategy interface
- No user-facing changes

### Phase 2: Strategies
- Implement ANSI and plain strategies
- Unit test coverage
- No user-facing changes

### Phase 3: Integration
- Wire into Commander.js
- Replace default help
- User sees enhanced help

### Phase 4: Verification
- Test all command levels
- Verify backwards compatibility
- Performance validation

---

## Dependencies

### Internal Dependencies
- `commander` (existing) - CLI framework
- `componentFactory.js` (existing) - Factory pattern

### External Dependencies
- None (ANSI codes are standard)

### Dependency Graph

```plaintext
citation-manager.js
    ├── commander
    └── componentFactory
            └── HelpFormatter
                    ├── FormatStrategy
                    │   ├── AnsiColorStrategy
                    │   └── PlainTextStrategy
                    └── helpContent
```

---

## Security Considerations

### ANSI Injection Prevention
- All help content is statically defined (no user input)
- ANSI codes are hardcoded in strategy
- No dynamic color code generation

### Terminal Safety
- Colors properly reset after each segment
- No terminal state corruption
- Graceful fallback to plain text if needed

---

## Monitoring & Observability

### Success Metrics
- Help generation time (performance)
- Test coverage (quality)
- Content completeness (correctness)

### Failure Modes
- Strategy throws error → Fall back to Commander.js default help
- Unknown command name → Return empty/default content
- Invalid help content → Validation test catches before deployment

---

## Future Enhancements

### Potential Extensions
1. **HTML Strategy:** Generate HTML help for documentation sites
2. **JSON Strategy:** Machine-readable help for tooling
3. **Interactive Help:** Arrow-key navigation through sections
4. **Search Help:** Filter help by keyword
5. **Localization:** Multi-language help content

### Design Accommodates
- New strategies (via Strategy Pattern)
- New content sections (via extensible data structure)
- Runtime strategy selection (via Factory Pattern)

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-02 | System | Initial architecture document |
