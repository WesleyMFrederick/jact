<!-- markdownlint-disable MD024 -->
# US2.1: Extraction Eligibility Strategy Pattern Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Implement extraction eligibility logic using Strategy Pattern to determine which links should have their content extracted based on markers, anchors, and CLI flags.

**Architecture:** Strategy Pattern with precedence chain - each eligibility rule (StopMarker, ForceMarkerSectionLink, CliFlag) is encapsulated in its own strategy class. The analyzeEligibility orchestrator loops through strategies in precedence order, returning the first non-null decision. MarkdownParser enhanced to detect extraction markers on link lines.

**Tech Stack:** Node.js ESM modules, Strategy Pattern, Factory Pattern, Vitest for testing

**Testing Strategy:** Follows workspace "Real Systems, Fake Fixtures" approach:
- ✅ **Real Systems**: Use actual component instances via factory or constructor injection
- ✅ **Fake Fixtures**: Static test files checked into repo at `test/fixtures/us2.1/`
- ✅ **BDD Structure**: All tests use `// Given:`, `// When:`, `// Then:` comments
- ✅ **Natural Language**: Test descriptions use spaces: `it('should return eligible when...')`
- ✅ **Zero Mocking**: No mocks/stubs for application components
- ✅ **Component Integration**: Validate component collaboration with real dependencies
- ✅ **MVP-Focused**: Target 0.3:1 to 0.5:1 test-to-code ratio, prove functionality works

---

## Task 1: Create Base Strategy Interface

**Files:**
- Create: `tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/ExtractionStrategy.js`
- Create: `tools/citation-manager/test/extraction-strategy-interface.test.js`

### Step 1: Write the failing test

```javascript
// tools/citation-manager/test/extraction-strategy-interface.test.js
import { describe, it, expect } from 'vitest';
import { ExtractionStrategy } from '../src/core/ContentExtractor/eligibilityStrategies/ExtractionStrategy.js';

describe('ExtractionStrategy Interface', () => {
  it('should return null when base strategy is called', () => {
    // Given: ExtractionStrategy instance
    const strategy = new ExtractionStrategy();

    // When: getDecision() called with empty link and flags
    const result = strategy.getDecision({}, {});

    // Then: Returns null (base implementation passes to next strategy)
    expect(result).toBeNull();
  });

  it('should return null when subclass does not override getDecision', () => {
    // Given: Strategy subclass without override
    class TestStrategy extends ExtractionStrategy {}
    const strategy = new TestStrategy();

    // When: getDecision() called
    const result = strategy.getDecision({}, {});

    // Then: Returns null (inherited base behavior)
    expect(result).toBeNull();
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- extraction-strategy-interface.test.js`
Expected: FAIL with "Cannot find module"

### Step 3: Create directory structure

```bash
mkdir -p tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies
```

### Step 4: Write minimal implementation

```javascript
// tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/ExtractionStrategy.js

/**
 * Base interface for extraction eligibility strategies.
 * Strategy Pattern: Each rule encapsulated in its own class.
 */
export class ExtractionStrategy {
  /**
   * Evaluate link eligibility based on strategy-specific criteria.
   * @param {LinkObject} link - Link to evaluate
   * @param {Object} cliFlags - CLI flags
   * @returns {{ eligible: boolean, reason: string }|null}
   *          Decision if strategy applies, null to pass to next strategy
   */
  getDecision(link, cliFlags) {
    // Base implementation: No decision (pass to next strategy)
    return null;
  }
}
```

### Step 5: Run test to verify it passes

Run: `npm test -- extraction-strategy-interface.test.js`
Expected: PASS (2 tests)

### Step 6: Commit

```bash
git add tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/ExtractionStrategy.js
git add tools/citation-manager/test/extraction-strategy-interface.test.js
git commit -m "feat(us2.1): add ExtractionStrategy base interface

- Create Strategy Pattern base class with getDecision() contract
- Return null enables strategy chain pass-through
- Establishes foundation for eligibility rule strategies"
```

---

## Task 2: Implement StopMarkerStrategy (Highest Precedence)

**Files:**
- Create: `tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/StopMarkerStrategy.js`
- Create: `tools/citation-manager/test/stop-marker-strategy.test.js`

### Step 1: Write the failing test

```javascript
// tools/citation-manager/test/stop-marker-strategy.test.js
import { describe, it, expect } from 'vitest';
import { StopMarkerStrategy } from '../src/core/ContentExtractor/eligibilityStrategies/StopMarkerStrategy.js';

describe('StopMarkerStrategy', () => {
  it('should return ineligible when stop-extract-link marker is present', () => {
    // Given: Strategy instance and link with stop marker
    const strategy = new StopMarkerStrategy();
    const link = {
      extractionMarker: { innerText: 'stop-extract-link' },
      anchorType: 'header'
    };

    // When: getDecision called
    const result = strategy.getDecision(link, {});

    // Then: Returns ineligible decision
    expect(result).toEqual({
      eligible: false,
      reason: 'Stop marker prevents extraction'
    });
  });

  it('should return null when no marker is present', () => {
    // Given: Link without extraction marker
    const strategy = new StopMarkerStrategy();
    const link = { extractionMarker: null, anchorType: 'header' };

    // When: getDecision called
    const result = strategy.getDecision(link, {});

    // Then: Returns null (pass to next strategy)
    expect(result).toBeNull();
  });

  it('should return null when different marker is present', () => {
    // Given: Link with force-extract marker
    const strategy = new StopMarkerStrategy();
    const link = {
      extractionMarker: { innerText: 'force-extract' },
      anchorType: null
    };

    // When: getDecision called
    const result = strategy.getDecision(link, {});

    // Then: Returns null (not this strategy's marker)
    expect(result).toBeNull();
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- stop-marker-strategy.test.js`
Expected: FAIL with "Cannot find module"

### Step 3: Write minimal implementation

```javascript
// tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/StopMarkerStrategy.js
import { ExtractionStrategy } from './ExtractionStrategy.js';

/**
 * Strategy checking for %%stop-extract-link%% marker.
 * Highest precedence rule - prevents extraction regardless of other rules.
 */
export class StopMarkerStrategy extends ExtractionStrategy {
  getDecision(link, cliFlags) {
    // Check for stop-extract-link marker
    if (link.extractionMarker?.innerText === 'stop-extract-link') {
      return {
        eligible: false,
        reason: 'Stop marker prevents extraction'
      };
    }

    // Not this strategy's concern - pass to next
    return null;
  }
}
```

### Step 4: Run test to verify it passes

Run: `npm test -- stop-marker-strategy.test.js`
Expected: PASS (3 tests)

### Step 5: Commit

```bash
git add tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/StopMarkerStrategy.js
git add tools/citation-manager/test/stop-marker-strategy.test.js
git commit -m "feat(us2.1): implement StopMarkerStrategy (highest precedence)

- Check for %%stop-extract-link%% marker on links
- Return ineligible when marker present
- Return null when marker absent (pass to next strategy)
- Satisfies AC4 and AC5 (highest precedence rule)"
```

---

## Task 3: Implement ForceMarkerStrategy (Second Precedence)

**Files:**
- Create: `tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/ForceMarkerStrategy.js`
- Create: `tools/citation-manager/test/force-marker-strategy.test.js`

### Step 1: Write the failing test

```javascript
// tools/citation-manager/test/force-marker-strategy.test.js
import { describe, it, expect } from 'vitest';
import { ForceMarkerStrategy } from '../src/core/ContentExtractor/eligibilityStrategies/ForceMarkerStrategy.js';

describe('ForceMarkerStrategy', () => {
  it('should return eligible when force-extract marker is present', () => {
    // Given: Full-file link with force marker
    const strategy = new ForceMarkerStrategy();
    const link = {
      extractionMarker: { innerText: 'force-extract' },
      anchorType: null
    };

    // When: getDecision called without --full-files flag
    const result = strategy.getDecision(link, { fullFiles: false });

    // Then: Returns eligible (overrides default full-file behavior)
    expect(result).toEqual({
      eligible: true,
      reason: 'Force marker overrides defaults'
    });
  });

  it('should return null when no marker is present', () => {
    // Given: Link without extraction marker
    const strategy = new ForceMarkerStrategy();
    const link = { extractionMarker: null, anchorType: null };

    // When: getDecision called
    const result = strategy.getDecision(link, {});

    // Then: Returns null (pass to next strategy)
    expect(result).toBeNull();
  });

  it('should return null when stop marker is present', () => {
    // Given: Link with stop-extract-link marker
    const strategy = new ForceMarkerStrategy();
    const link = {
      extractionMarker: { innerText: 'stop-extract-link' },
      anchorType: 'header'
    };

    // When: getDecision called
    const result = strategy.getDecision(link, {});

    // Then: Returns null (not this strategy's marker)
    expect(result).toBeNull();
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- force-marker-strategy.test.js`
Expected: FAIL with "Cannot find module"

### Step 3: Write minimal implementation

```javascript
// tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/ForceMarkerStrategy.js
import { ExtractionStrategy } from './ExtractionStrategy.js';

/**
 * Strategy checking for %%force-extract%% marker.
 * Forces extraction of full-file links without --full-files flag.
 */
export class ForceMarkerStrategy extends ExtractionStrategy {
  getDecision(link, cliFlags) {
    // Check for force-extract marker
    if (link.extractionMarker?.innerText === 'force-extract') {
      return {
        eligible: true,
        reason: 'Force marker overrides defaults'
      };
    }

    return null;
  }
}
```

### Step 4: Run test to verify it passes

Run: `npm test -- force-marker-strategy.test.js`
Expected: PASS (3 tests)

### Step 5: Commit

```bash
git add tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/ForceMarkerStrategy.js
git add tools/citation-manager/test/force-marker-strategy.test.js
git commit -m "feat(us2.1): implement ForceMarkerStrategy (second precedence)

- Check for %%force-extract%% marker on links
- Return eligible when marker present (overrides full-file default)
- Return null when marker absent
- Satisfies AC3 and AC5 (second-highest precedence rule)"
```

---

## Task 4: Implement SectionLinkStrategy (Default Behavior)

**Files:**
- Create: `tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/SectionLinkStrategy.js`
- Create: `tools/citation-manager/test/section-link-strategy.test.js`

### Step 1: Write the failing test

```javascript
// tools/citation-manager/test/section-link-strategy.test.js
import { describe, it, expect } from 'vitest';
import { SectionLinkStrategy } from '../src/core/ContentExtractor/eligibilityStrategies/SectionLinkStrategy.js';

describe('SectionLinkStrategy', () => {
  it('should return eligible when link has header anchor', () => {
    // Given: Link with header anchor
    const strategy = new SectionLinkStrategy();
    const link = {
      anchorType: 'header',
      target: { anchor: 'Section Heading' }
    };

    // When: getDecision called
    const result = strategy.getDecision(link, {});

    // Then: Returns eligible (section links eligible by default)
    expect(result).toEqual({
      eligible: true,
      reason: 'Section links eligible by default'
    });
  });

  it('should return eligible when link has block anchor', () => {
    // Given: Link with block anchor
    const strategy = new SectionLinkStrategy();
    const link = {
      anchorType: 'block',
      target: { anchor: 'FR1' }
    };

    // When: getDecision called
    const result = strategy.getDecision(link, {});

    // Then: Returns eligible (block links eligible by default)
    expect(result).toEqual({
      eligible: true,
      reason: 'Section links eligible by default'
    });
  });

  it('should return null when link has no anchor', () => {
    // Given: Full-file link (anchorType: null)
    const strategy = new SectionLinkStrategy();
    const link = {
      anchorType: null,
      target: { anchor: null }
    };

    // When: getDecision called
    const result = strategy.getDecision(link, {});

    // Then: Returns null (pass to next strategy)
    expect(result).toBeNull();
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- section-link-strategy.test.js`
Expected: FAIL with "Cannot find module"

### Step 3: Write minimal implementation

```javascript
// tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/SectionLinkStrategy.js
import { ExtractionStrategy } from './ExtractionStrategy.js';

/**
 * Strategy for default section/block link behavior.
 * Links with anchors are eligible by default.
 */
export class SectionLinkStrategy extends ExtractionStrategy {
  getDecision(link, cliFlags) {
    // Check if link has anchor (header or block)
    if (link.anchorType !== null) {
      return {
        eligible: true,
        reason: 'Section links eligible by default'
      };
    }

    // Full-file link - pass to next strategy
    return null;
  }
}
```

### Step 4: Run test to verify it passes

Run: `npm test -- section-link-strategy.test.js`
Expected: PASS (3 tests)

### Step 5: Commit

```bash
git add tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/SectionLinkStrategy.js
git add tools/citation-manager/test/section-link-strategy.test.js
git commit -m "feat(us2.1): implement SectionLinkStrategy (default behavior)

- Return eligible when link.anchorType is not null
- Return null for full-file links (no anchor)
- Implements default section extraction behavior
- Satisfies AC2 (section links eligible by default)"
```

---

## Task 5: Implement CliFlagStrategy (Lowest Precedence)

**Files:**
- Create: `tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/CliFlagStrategy.js`
- Create: `tools/citation-manager/test/cli-flag-strategy.test.js`

### Step 1: Write the failing test

```javascript
// tools/citation-manager/test/cli-flag-strategy.test.js
import { describe, it, expect } from 'vitest';
import { CliFlagStrategy } from '../src/core/ContentExtractor/eligibilityStrategies/CliFlagStrategy.js';

describe('CliFlagStrategy', () => {
  it('should return eligible when --full-files flag is present', () => {
    // Given: Full-file link with --full-files flag
    const strategy = new CliFlagStrategy();
    const link = { anchorType: null };
    const cliFlags = { fullFiles: true };

    // When: getDecision called
    const result = strategy.getDecision(link, cliFlags);

    // Then: Returns eligible (CLI flag enables extraction)
    expect(result).toEqual({
      eligible: true,
      reason: 'CLI flag --full-files forces extraction'
    });
  });

  it('should return ineligible when --full-files flag is absent', () => {
    // Given: Full-file link without flag
    const strategy = new CliFlagStrategy();
    const link = { anchorType: null };
    const cliFlags = { fullFiles: false };

    // When: getDecision called
    const result = strategy.getDecision(link, cliFlags);

    // Then: Returns ineligible (default full-file behavior)
    expect(result).toEqual({
      eligible: false,
      reason: 'Full-file link without --full-files flag'
    });
  });

  it('should return ineligible when flag is undefined', () => {
    // Given: Full-file link with empty flags
    const strategy = new CliFlagStrategy();
    const link = { anchorType: null };
    const cliFlags = {};

    // When: getDecision called
    const result = strategy.getDecision(link, cliFlags);

    // Then: Returns ineligible (treats undefined as false)
    expect(result).toEqual({
      eligible: false,
      reason: 'Full-file link without --full-files flag'
    });
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- cli-flag-strategy.test.js`
Expected: FAIL with "Cannot find module"

### Step 3: Write minimal implementation

```javascript
// tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/CliFlagStrategy.js
import { ExtractionStrategy } from './ExtractionStrategy.js';

/**
 * Strategy evaluating --full-files CLI flag.
 * Terminal strategy - always returns decision (never null).
 */
export class CliFlagStrategy extends ExtractionStrategy {
  getDecision(link, cliFlags) {
    // Check if --full-files flag enables extraction
    if (cliFlags.fullFiles === true) {
      return {
        eligible: true,
        reason: 'CLI flag --full-files forces extraction'
      };
    }

    // Default: full-file links ineligible without flag
    return {
      eligible: false,
      reason: 'Full-file link without --full-files flag'
    };
  }
}
```

### Step 4: Run test to verify it passes

Run: `npm test -- cli-flag-strategy.test.js`
Expected: PASS (3 tests)

### Step 5: Commit

```bash
git add tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/CliFlagStrategy.js
git add tools/citation-manager/test/cli-flag-strategy.test.js
git commit -m "feat(us2.1): implement CliFlagStrategy (lowest precedence)

- Return eligible when cliFlags.fullFiles === true
- Return ineligible when flag absent or false
- Terminal strategy (always returns decision, never null)
- Satisfies AC1 (full-file links ineligible without flag)"
```

---

## Task 6: Implement analyzeEligibility Orchestrator

**Files:**
- Create: `tools/citation-manager/src/core/ContentExtractor/analyzeEligibility.js`
- Create: `tools/citation-manager/test/analyze-eligibility.test.js`

### Step 1: Write the failing test

```javascript
// tools/citation-manager/test/analyze-eligibility.test.js
import { describe, it, expect } from 'vitest';
import { analyzeEligibility, createEligibilityAnalyzer } from '../src/core/ContentExtractor/analyzeEligibility.js';
import { StopMarkerStrategy } from '../src/core/ContentExtractor/eligibilityStrategies/StopMarkerStrategy.js';
import { ForceMarkerStrategy } from '../src/core/ContentExtractor/eligibilityStrategies/ForceMarkerStrategy.js';
import { SectionLinkStrategy } from '../src/core/ContentExtractor/eligibilityStrategies/SectionLinkStrategy.js';
import { CliFlagStrategy } from '../src/core/ContentExtractor/eligibilityStrategies/CliFlagStrategy.js';

describe('analyzeEligibility', () => {
  it('should return first non-null decision from strategy chain', () => {
    // Given: Strategies in precedence order and section link
    const strategies = [
      new StopMarkerStrategy(),
      new ForceMarkerStrategy(),
      new SectionLinkStrategy(),
      new CliFlagStrategy()
    ];
    const link = { anchorType: 'header', extractionMarker: null };

    // When: analyzeEligibility called
    const result = analyzeEligibility(link, {}, strategies);

    // Then: Returns SectionLinkStrategy decision (first non-null)
    expect(result).toEqual({
      eligible: true,
      reason: 'Section links eligible by default'
    });
  });

  it('should respect precedence order with stop marker winning', () => {
    // Given: Link with stop marker AND section anchor
    const strategies = [
      new StopMarkerStrategy(),
      new SectionLinkStrategy()
    ];
    const link = {
      anchorType: 'header',
      extractionMarker: { innerText: 'stop-extract-link' }
    };

    // When: analyzeEligibility called
    const result = analyzeEligibility(link, {}, strategies);

    // Then: Returns StopMarkerStrategy decision (highest precedence)
    expect(result).toEqual({
      eligible: false,
      reason: 'Stop marker prevents extraction'
    });
  });

  it('should fall through to terminal strategy when others return null', () => {
    // Given: Full-file link without markers or flags
    const strategies = [
      new StopMarkerStrategy(),
      new ForceMarkerStrategy(),
      new SectionLinkStrategy(),
      new CliFlagStrategy()
    ];
    const link = { anchorType: null, extractionMarker: null };

    // When: analyzeEligibility called without --full-files
    const result = analyzeEligibility(link, { fullFiles: false }, strategies);

    // Then: Returns CliFlagStrategy default decision
    expect(result).toEqual({
      eligible: false,
      reason: 'Full-file link without --full-files flag'
    });
  });
});

describe('createEligibilityAnalyzer', () => {
  it('should create configured analyzer function', () => {
    // Given: Strategies in precedence order
    const strategies = [new SectionLinkStrategy()];

    // When: createEligibilityAnalyzer called
    const analyzer = createEligibilityAnalyzer(strategies);

    // Then: Returns function accepting (link, cliFlags)
    expect(typeof analyzer).toBe('function');

    const link = { anchorType: 'header' };
    const result = analyzer(link, {});
    expect(result.eligible).toBe(true);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- analyze-eligibility.test.js`
Expected: FAIL with "Cannot find module"

### Step 3: Write minimal implementation

```javascript
// tools/citation-manager/src/core/ContentExtractor/analyzeEligibility.js

/**
 * Analyze link eligibility using strategy chain.
 * Returns first non-null decision from precedence-ordered strategies.
 *
 * @param {LinkObject} link - Link to analyze
 * @param {Object} cliFlags - CLI flags
 * @param {ExtractionStrategy[]} strategies - Strategy chain in precedence order
 * @returns {{ eligible: boolean, reason: string }} Eligibility decision
 */
export function analyzeEligibility(link, cliFlags, strategies) {
  // Loop through strategies in precedence order
  for (const strategy of strategies) {
    const decision = strategy.getDecision(link, cliFlags);

    // Return first non-null decision (highest priority wins)
    if (decision !== null) {
      return decision;
    }
  }

  // Fallback if all strategies return null
  return { eligible: false, reason: 'No strategy matched' };
}

/**
 * Factory function creating configured analyzer.
 * Encapsulates strategy array for reuse.
 *
 * @param {ExtractionStrategy[]} strategies - Ordered strategy chain
 * @returns {Function} Configured analyzer: (link, cliFlags) => decision
 */
export function createEligibilityAnalyzer(strategies) {
  return (link, cliFlags) => analyzeEligibility(link, cliFlags, strategies);
}
```

### Step 4: Run test to verify it passes

Run: `npm test -- analyze-eligibility.test.js`
Expected: PASS (4 tests)

### Step 5: Commit

```bash
git add tools/citation-manager/src/core/ContentExtractor/analyzeEligibility.js
git add tools/citation-manager/test/analyze-eligibility.test.js
git commit -m "feat(us2.1): implement analyzeEligibility orchestrator

- Loop through strategies in precedence order
- Return first non-null decision
- Factory function creates configured analyzer
- Satisfies AC5 (precedence hierarchy enforcement)"
```

---

## Task 7: Create ContentExtractor Component Entry Point

**Files:**
- Create: `tools/citation-manager/src/core/ContentExtractor/ContentExtractor.js`
- Create: `tools/citation-manager/test/content-extractor.test.js`

### Step 1: Write the failing test

```javascript
// tools/citation-manager/test/content-extractor.test.js
import { describe, it, expect } from 'vitest';
import { ContentExtractor } from '../src/core/ContentExtractor/ContentExtractor.js';
import { StopMarkerStrategy } from '../src/core/ContentExtractor/eligibilityStrategies/StopMarkerStrategy.js';
import { SectionLinkStrategy } from '../src/core/ContentExtractor/eligibilityStrategies/SectionLinkStrategy.js';

describe('ContentExtractor', () => {
  it('should instantiate with strategy array', () => {
    // Given: Strategy array
    const strategies = [
      new StopMarkerStrategy(),
      new SectionLinkStrategy()
    ];

    // When: ContentExtractor created
    const extractor = new ContentExtractor(strategies);

    // Then: Instance created successfully
    expect(extractor).toBeInstanceOf(ContentExtractor);
  });

  it('should analyze eligibility using injected strategies', () => {
    // Given: ContentExtractor with strategies
    const strategies = [new SectionLinkStrategy()];
    const extractor = new ContentExtractor(strategies);
    const link = { anchorType: 'header', extractionMarker: null };

    // When: analyzeEligibility called
    const result = extractor.analyzeEligibility(link, {});

    // Then: Returns decision from strategy chain
    expect(result).toEqual({
      eligible: true,
      reason: 'Section links eligible by default'
    });
  });

  it('should handle empty strategy array gracefully', () => {
    // Given: ContentExtractor with empty strategies
    const extractor = new ContentExtractor([]);
    const link = { anchorType: 'header' };

    // When: analyzeEligibility called
    const result = extractor.analyzeEligibility(link, {});

    // Then: Returns fallback decision
    expect(result).toEqual({
      eligible: false,
      reason: 'No strategy matched'
    });
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- content-extractor.test.js`
Expected: FAIL with "Cannot find module"

### Step 3: Write minimal implementation

```javascript
// tools/citation-manager/src/core/ContentExtractor/ContentExtractor.js
import { analyzeEligibility } from './analyzeEligibility.js';

/**
 * Content Extractor component orchestrating extraction eligibility analysis.
 * Component entry point following TitleCase naming convention.
 *
 * US2.1 Scope: Eligibility analysis only
 * US2.2 Future: Add content retrieval, ParsedFileCache, CitationValidator dependencies
 */
export class ContentExtractor {
  /**
   * Create ContentExtractor with eligibility strategies.
   *
   * @param {ExtractionStrategy[]} eligibilityStrategies - Ordered strategy chain
   */
  constructor(eligibilityStrategies) {
    this.eligibilityStrategies = eligibilityStrategies;
  }

  /**
   * Analyze link eligibility using strategy chain.
   * Public method for determining which links should be extracted.
   *
   * @param {LinkObject} link - Link to analyze
   * @param {Object} cliFlags - CLI flags
   * @returns {{ eligible: boolean, reason: string }} Eligibility decision
   */
  analyzeEligibility(link, cliFlags) {
    return analyzeEligibility(link, cliFlags, this.eligibilityStrategies);
  }
}
```

### Step 4: Run test to verify it passes

Run: `npm test -- content-extractor.test.js`
Expected: PASS (3 tests)

### Step 5: Commit

```bash
git add tools/citation-manager/src/core/ContentExtractor/ContentExtractor.js
git add tools/citation-manager/test/content-extractor.test.js
git commit -m "feat(us2.1): create ContentExtractor component entry point

- Accept eligibilityStrategies via constructor (DI pattern)
- Provide analyzeEligibility public method
- Component entry point following TitleCase naming convention
- Satisfies AC6 (Strategy Pattern implementation)"
```

---

## Task 8: Add createContentExtractor Factory Function

**Files:**
- Modify: `tools/citation-manager/src/factories/componentFactory.js`
- Modify: `tools/citation-manager/test/component-factory.test.js`

### Step 1: Write the failing test

```javascript
// Add to tools/citation-manager/test/component-factory.test.js
import { describe, it, expect } from 'vitest';
import { createContentExtractor } from '../src/factories/componentFactory.js';
import { ContentExtractor } from '../src/core/ContentExtractor/ContentExtractor.js';

describe('createContentExtractor', () => {
  it('should create ContentExtractor with default strategies', () => {
    // When: Factory called without arguments
    const extractor = createContentExtractor();

    // Then: Returns ContentExtractor instance
    expect(extractor).toBeInstanceOf(ContentExtractor);
  });

  it('should inject strategies in correct precedence order', () => {
    // Given: Factory creates extractor
    const extractor = createContentExtractor();

    // When: Analyzing link with stop marker AND section anchor
    const link = {
      anchorType: 'header',
      extractionMarker: { innerText: 'stop-extract-link' }
    };
    const result = extractor.analyzeEligibility(link, {});

    // Then: Stop marker takes precedence (highest priority)
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('Stop marker');
  });

  it('should allow custom strategy override for testing', () => {
    // Given: Custom empty strategy array
    const extractor = createContentExtractor([]);

    // When: analyzeEligibility called
    const result = extractor.analyzeEligibility({}, {});

    // Then: Uses custom strategies
    expect(result.reason).toBe('No strategy matched');
  });

  it('should instantiate all four strategies in precedence order', () => {
    // Given: Factory creates extractor
    const extractor = createContentExtractor();

    // When: Testing each strategy precedence level
    const tests = [
      // Stop marker (highest)
      {
        link: { anchorType: 'header', extractionMarker: { innerText: 'stop-extract-link' } },
        expected: false
      },
      // Force marker (second)
      {
        link: { anchorType: null, extractionMarker: { innerText: 'force-extract' } },
        expected: true
      },
      // Section link (third)
      {
        link: { anchorType: 'header', extractionMarker: null },
        expected: true
      },
      // CLI flag (lowest)
      {
        link: { anchorType: null, extractionMarker: null },
        cliFlags: { fullFiles: true },
        expected: true
      }
    ];

    // Then: All strategies work in correct order
    tests.forEach(({ link, cliFlags = {}, expected }) => {
      const result = extractor.analyzeEligibility(link, cliFlags);
      expect(result.eligible).toBe(expected);
    });
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- component-factory.test.js`
Expected: FAIL with "createContentExtractor is not a function"

### Step 3: Write minimal implementation

```javascript
// Add to tools/citation-manager/src/factories/componentFactory.js
import { ContentExtractor } from '../core/ContentExtractor/ContentExtractor.js';
import { StopMarkerStrategy } from '../core/ContentExtractor/eligibilityStrategies/StopMarkerStrategy.js';
import { ForceMarkerStrategy } from '../core/ContentExtractor/eligibilityStrategies/ForceMarkerStrategy.js';
import { SectionLinkStrategy } from '../core/ContentExtractor/eligibilityStrategies/SectionLinkStrategy.js';
import { CliFlagStrategy } from '../core/ContentExtractor/eligibilityStrategies/CliFlagStrategy.js';

/**
 * Create ContentExtractor with eligibility strategies.
 * Factory pattern for dependency injection.
 *
 * Precedence order (highest to lowest):
 * 1. StopMarkerStrategy - %%stop-extract-link%%
 * 2. ForceMarkerStrategy - %%force-extract%%
 * 3. SectionLinkStrategy - Anchors eligible by default
 * 4. CliFlagStrategy - --full-files flag (terminal)
 *
 * @param {ExtractionStrategy[]|null} [strategies=null] - Optional strategy override
 * @returns {ContentExtractor} Configured ContentExtractor instance
 */
export function createContentExtractor(strategies = null) {
  const _strategies = strategies || [
    new StopMarkerStrategy(),
    new ForceMarkerStrategy(),
    new SectionLinkStrategy(),
    new CliFlagStrategy()
  ];

  return new ContentExtractor(_strategies);
}
```

### Step 4: Run test to verify it passes

Run: `npm test -- component-factory.test.js`
Expected: PASS (all factory tests including new 4 tests)

### Step 5: Commit

```bash
git add tools/citation-manager/src/factories/componentFactory.js
git add tools/citation-manager/test/component-factory.test.js
git commit -m "feat(us2.1): add createContentExtractor factory function

- Instantiate strategies in precedence order
- Inject strategy array into ContentExtractor
- Support optional strategy override for testing
- Satisfies AC6 (factory pattern for DI)"
```

---

## Task 9: Update MarkdownParser to Detect Extraction Markers

**Files:**
- Modify: `tools/citation-manager/src/MarkdownParser.js`
- Create: `tools/citation-manager/test/fixtures/us2.1/parser-markers-force-extract.md`
- Create: `tools/citation-manager/test/fixtures/us2.1/parser-markers-stop-extract.md`
- Create: `tools/citation-manager/test/fixtures/us2.1/parser-markers-html-comment.md`
- Create: `tools/citation-manager/test/fixtures/us2.1/parser-markers-no-marker.md`
- Create: `tools/citation-manager/test/fixtures/us2.1/parser-markers-whitespace.md`
- Create: `tools/citation-manager/test/parser-extraction-markers.test.js`

### Step 1: Create static test fixtures

```bash
mkdir -p tools/citation-manager/test/fixtures/us2.1
```

```markdown
<!-- tools/citation-manager/test/fixtures/us2.1/parser-markers-force-extract.md -->
# Force Extract Marker Test

[Full file link](target.md)%%force-extract%%
```

```markdown
<!-- tools/citation-manager/test/fixtures/us2.1/parser-markers-stop-extract.md -->
# Stop Extract Marker Test

[Section link](#header)%%stop-extract-link%%
```

```markdown
<!-- tools/citation-manager/test/fixtures/us2.1/parser-markers-html-comment.md -->
# HTML Comment Marker Test

[Link](file.md)<!-- force-extract -->
```

```markdown
<!-- tools/citation-manager/test/fixtures/us2.1/parser-markers-no-marker.md -->
# No Marker Test

[Link without marker](file.md)
```

```markdown
<!-- tools/citation-manager/test/fixtures/us2.1/parser-markers-whitespace.md -->
# Whitespace Tolerance Test

[Link with spaces](file.md)  %%force-extract%%
```

### Step 2: Write the failing test

```javascript
// tools/citation-manager/test/parser-extraction-markers.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { MarkdownParser } from '../src/MarkdownParser.js';
import fs from 'node:fs';
import path from 'node:path';

describe('MarkdownParser - Extraction Markers', () => {
  let parser;

  beforeEach(() => {
    parser = new MarkdownParser(fs, path);
  });

  it('should detect %%force-extract%% marker after link', () => {
    // Given: Static fixture with force-extract marker
    const fixturePath = path.join(__dirname, 'fixtures/us2.1/parser-markers-force-extract.md');

    // When: Parser processes file
    const result = parser.parseFile(fixturePath);

    // Then: LinkObject has extractionMarker property
    expect(result.links).toHaveLength(1);
    expect(result.links[0].extractionMarker).toEqual({
      fullMatch: '%%force-extract%%',
      innerText: 'force-extract'
    });
  });

  it('should detect %%stop-extract-link%% marker', () => {
    // Given: Static fixture with stop marker
    const fixturePath = path.join(__dirname, 'fixtures/us2.1/parser-markers-stop-extract.md');

    // When: Parser processes file
    const result = parser.parseFile(fixturePath);

    // Then: Marker detected with correct innerText
    expect(result.links[0].extractionMarker).toEqual({
      fullMatch: '%%stop-extract-link%%',
      innerText: 'stop-extract-link'
    });
  });

  it('should detect HTML comment marker', () => {
    // Given: Static fixture with HTML comment
    const fixturePath = path.join(__dirname, 'fixtures/us2.1/parser-markers-html-comment.md');

    // When: Parser processes file
    const result = parser.parseFile(fixturePath);

    // Then: HTML comment marker detected
    expect(result.links[0].extractionMarker).toEqual({
      fullMatch: '<!-- force-extract -->',
      innerText: 'force-extract'
    });
  });

  it('should return null when no marker is present', () => {
    // Given: Static fixture without markers
    const fixturePath = path.join(__dirname, 'fixtures/us2.1/parser-markers-no-marker.md');

    // When: Parser processes file
    const result = parser.parseFile(fixturePath);

    // Then: extractionMarker is null
    expect(result.links[0].extractionMarker).toBeNull();
  });

  it('should detect marker with whitespace between link and marker', () => {
    // Given: Static fixture with spaces before marker
    const fixturePath = path.join(__dirname, 'fixtures/us2.1/parser-markers-whitespace.md');

    // When: Parser processes file
    const result = parser.parseFile(fixturePath);

    // Then: Marker detected despite whitespace
    expect(result.links[0].extractionMarker.innerText).toBe('force-extract');
  });
});
```

### Step 3: Run test to verify it fails

Run: `npm test -- parser-extraction-markers.test.js`
Expected: FAIL with "extractionMarker is undefined"

### Step 4: Write minimal implementation

```javascript
// Modify tools/citation-manager/src/MarkdownParser.js

class MarkdownParser {
  // Add private helper method for marker detection
  _detectExtractionMarker(line, linkEndColumn) {
    // Get text after link on same line
    const remainingLine = line.substring(linkEndColumn);

    // Pattern: %%text%% or <!-- text -->
    const markerPattern = /\s*(%%(.+?)%%|<!--\s*(.+?)\s*-->)/;
    const match = remainingLine.match(markerPattern);

    if (match) {
      return {
        fullMatch: match[1],           // Full marker with delimiters
        innerText: match[2] || match[3] // Text between delimiters
      };
    }

    return null;
  }

  // Update extractLinks() method
  extractLinks(filePath) {
    // ... existing link extraction logic ...

    // For EACH link pattern match:
    // After creating linkObject, before pushing to array:
    linkObject.extractionMarker = this._detectExtractionMarker(
      line,
      match.index + match[0].length
    );

    links.push(linkObject);
  }
}
```

### Step 5: Run test to verify it passes

Run: `npm test -- parser-extraction-markers.test.js`
Expected: PASS (5 tests)

### Step 6: Update all link patterns in extractLinks

Apply extractionMarker detection to ALL link pattern matches:
- Cross-document markdown links
- Citation format links
- Relative path links
- Wiki-style cross-document
- Wiki-style internal
- Caret syntax references

### Step 7: Run full parser test suite

Run: `npm test -- MarkdownParser`
Expected: All existing tests still pass

### Step 8: Commit

```bash
git add tools/citation-manager/src/MarkdownParser.js
git add tools/citation-manager/test/fixtures/us2.1/
git add tools/citation-manager/test/parser-extraction-markers.test.js
git commit -m "feat(us2.1): add extraction marker detection to MarkdownParser

- Detect %%marker%% and <!-- marker --> after links
- Add extractionMarker property to LinkObject schema
- Support force-extract and stop-extract-link markers
- Use static test fixtures (Real Systems, Fake Fixtures)
- Hardcoded MVP implementation (Issue 5 technical debt)
- Satisfies FR10 and NFR6 (marker detection)"
```

---

## Task 10: Update Markdown Parser Implementation Guide

**Files:**
- Modify: `tools/citation-manager/design-docs/component-guides/Markdown Parser Implementation Guide.md`

### Step 1: Read current LinkObject schema documentation

Run: `grep -A 30 "LinkObject" "tools/citation-manager/design-docs/component-guides/Markdown Parser Implementation Guide.md"`

### Step 2: Update LinkObject schema with extractionMarker property

Add to the LinkObject JSON schema:

```json
{
  "extractionMarker": {
    "fullMatch": "%%force-extract%%",
    "innerText": "force-extract"
  } | null
}
```

### Step 3: Add examples section

```markdown
### Extraction Marker Examples

| Markdown | extractionMarker Value |
|----------|----------------------|
| `[link](file.md)%%force-extract%%` | `{ fullMatch: '%%force-extract%%', innerText: 'force-extract' }` |
| `[link](file.md) %%stop-extract-link%%` | `{ fullMatch: '%%stop-extract-link%%', innerText: 'stop-extract-link' }` |
| `[link](file.md)<!-- force-extract -->` | `{ fullMatch: '<!-- force-extract -->', innerText: 'force-extract' }` |
| `[link](file.md)` | `null` |
```

### Step 4: Document MVP technical debt

```markdown
## Issue 5: Hardcoded Extraction Marker Detection (MVP Tech Debt)

**Current Problem**: MarkdownParser hardcodes detection of `%% %%` and `<!-- -->`
delimiters after links for the content extraction feature.

**MVP Implementation**: Parser scans line remainder using regex pattern.

**Future Enhancement**: Strategy-defined markers via ContentExtractor configuration.
```

### Step 5: Commit

```bash
git add "tools/citation-manager/design-docs/component-guides/Markdown Parser Implementation Guide.md"
git commit -m "docs(us2.1): document extractionMarker in LinkObject schema

- Add extractionMarker property to LinkObject JSON schema
- Provide markdown examples of marker detection
- Document MVP technical debt (Issue 5)
- Update contract documentation for US2.1"
```

---

## Task 11: Integration Test - Strategy Precedence

**Files:**
- Create: `tools/citation-manager/test/integration/extraction-eligibility-precedence.test.js`

### Step 1: Write integration test validating precedence hierarchy

```javascript
// tools/citation-manager/test/integration/extraction-eligibility-precedence.test.js
import { describe, it, expect } from 'vitest';
import { createContentExtractor } from '../../src/factories/componentFactory.js';

describe('Extraction Eligibility Precedence Integration', () => {
  it('should enforce complete precedence hierarchy', () => {
    // Given: Factory-created ContentExtractor
    const extractor = createContentExtractor();

    // When/Then: Each scenario produces expected decision
    const scenarios = [
      {
        name: 'Stop marker prevents extraction (AC4, AC5)',
        link: { anchorType: 'header', extractionMarker: { innerText: 'stop-extract-link' } },
        cliFlags: { fullFiles: true },
        expected: { eligible: false, reason: 'Stop marker prevents extraction' }
      },
      {
        name: 'Force marker overrides full-file default (AC3, AC5)',
        link: { anchorType: null, extractionMarker: { innerText: 'force-extract' } },
        cliFlags: { fullFiles: false },
        expected: { eligible: true, reason: 'Force marker overrides defaults' }
      },
      {
        name: 'Section links eligible by default (AC2)',
        link: { anchorType: 'header', extractionMarker: null },
        cliFlags: {},
        expected: { eligible: true, reason: 'Section links eligible by default' }
      },
      {
        name: 'Full-file ineligible without flag (AC1)',
        link: { anchorType: null, extractionMarker: null },
        cliFlags: { fullFiles: false },
        expected: { eligible: false, reason: 'Full-file link without --full-files flag' }
      },
      {
        name: 'CLI flag enables full-file extraction',
        link: { anchorType: null, extractionMarker: null },
        cliFlags: { fullFiles: true },
        expected: { eligible: true, reason: 'CLI flag --full-files forces extraction' }
      }
    ];

    scenarios.forEach(({ name, link, cliFlags, expected }) => {
      const result = extractor.analyzeEligibility(link, cliFlags);
      expect(result, name).toEqual(expected);
    });
  });

  it('should treat block anchors same as header anchors', () => {
    // Given: Link with block anchor
    const extractor = createContentExtractor();
    const link = {
      anchorType: 'block',
      extractionMarker: null
    };

    // When: analyzeEligibility called
    const result = extractor.analyzeEligibility(link, {});

    // Then: Eligible (block links are section links)
    expect(result.eligible).toBe(true);
  });
});
```

### Step 2: Run test to verify it passes

Run: `npm test -- extraction-eligibility-precedence.test.js`
Expected: PASS (2 tests covering 6 scenarios)

### Step 3: Commit

```bash
git add tools/citation-manager/test/integration/extraction-eligibility-precedence.test.js
git commit -m "test(us2.1): add integration tests for precedence hierarchy

- Validate all 5 AC scenarios with real component integration
- Test stop marker > force marker > section > CLI precedence
- Confirm block anchors treated as section links
- Validates AC1-AC5 with factory-created components"
```

---

## Task 12: End-to-End Test with MarkdownParser Integration

**Files:**
- Create: `tools/citation-manager/test/fixtures/us2.1/e2e-mixed-markers.md`
- Create: `tools/citation-manager/test/fixtures/us2.1/e2e-full-file-no-flag.md`
- Create: `tools/citation-manager/test/fixtures/us2.1/e2e-various-formats.md`
- Create: `tools/citation-manager/test/integration/e2e-parser-to-extractor.test.js`

### Step 1: Create static E2E test fixtures

```markdown
<!-- tools/citation-manager/test/fixtures/us2.1/e2e-mixed-markers.md -->
# E2E Test - Mixed Markers

[Full file without flag](target.md)
[Full file with force marker](another.md)%%force-extract%%
[Section link](#header)
[Section with stop marker](#section)%%stop-extract-link%%
```

```markdown
<!-- tools/citation-manager/test/fixtures/us2.1/e2e-full-file-no-flag.md -->
[Document](file.md)
```

```markdown
<!-- tools/citation-manager/test/fixtures/us2.1/e2e-various-formats.md -->
[Standard](file.md)%%force-extract%%
[[Wiki link]]%%stop-extract-link%%
[Relative](./path/file.md)<!-- force-extract -->
```

### Step 2: Write E2E test using static fixtures

```javascript
// tools/citation-manager/test/integration/e2e-parser-to-extractor.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { MarkdownParser } from '../../src/MarkdownParser.js';
import { createContentExtractor } from '../../src/factories/componentFactory.js';
import fs from 'node:fs';
import path from 'node:path';

describe('E2E: MarkdownParser → ContentExtractor', () => {
  let parser;
  let extractor;

  beforeEach(() => {
    parser = new MarkdownParser(fs, path);
    extractor = createContentExtractor();
  });

  it('should parse markers and analyze eligibility correctly', () => {
    // Given: Static fixture with mixed link types
    const fixturePath = path.join(__dirname, '../fixtures/us2.1/e2e-mixed-markers.md');

    // When: Parse file → analyze each link
    const parsed = parser.parseFile(fixturePath);
    const decisions = parsed.links.map(link => ({
      link: link.fullMatch,
      decision: extractor.analyzeEligibility(link, { fullFiles: false })
    }));

    // Then: Each decision matches expected eligibility
    expect(decisions).toEqual([
      {
        link: '[Full file without flag](target.md)',
        decision: { eligible: false, reason: 'Full-file link without --full-files flag' }
      },
      {
        link: '[Full file with force marker](another.md)%%force-extract%%',
        decision: { eligible: true, reason: 'Force marker overrides defaults' }
      },
      {
        link: '[Section link](#header)',
        decision: { eligible: true, reason: 'Section links eligible by default' }
      },
      {
        link: '[Section with stop marker](#section)%%stop-extract-link%%',
        decision: { eligible: false, reason: 'Stop marker prevents extraction' }
      }
    ]);
  });

  it('should change eligibility when CLI flag changes', () => {
    // Given: Static fixture with full-file link
    const fixturePath = path.join(__dirname, '../fixtures/us2.1/e2e-full-file-no-flag.md');

    // When: Parse and analyze with/without --full-files flag
    const parsed = parser.parseFile(fixturePath);
    const link = parsed.links[0];

    const withoutFlag = extractor.analyzeEligibility(link, { fullFiles: false });
    const withFlag = extractor.analyzeEligibility(link, { fullFiles: true });

    // Then: Flag changes eligibility
    expect(withoutFlag.eligible).toBe(false);
    expect(withFlag.eligible).toBe(true);
  });

  it('should detect markers in various markdown link formats', () => {
    // Given: Static fixture with different link syntaxes
    const fixturePath = path.join(__dirname, '../fixtures/us2.1/e2e-various-formats.md');

    // When: Parse file
    const parsed = parser.parseFile(fixturePath);

    // Then: All markers detected
    expect(parsed.links[0].extractionMarker.innerText).toBe('force-extract');
    expect(parsed.links[1].extractionMarker.innerText).toBe('stop-extract-link');
    expect(parsed.links[2].extractionMarker.innerText).toBe('force-extract');
  });
});
```

### Step 3: Run test to verify it passes

Run: `npm test -- e2e-parser-to-extractor.test.js`
Expected: PASS (3 tests)

### Step 4: Commit

```bash
git add tools/citation-manager/test/fixtures/us2.1/e2e-*.md
git add tools/citation-manager/test/integration/e2e-parser-to-extractor.test.js
git commit -m "test(us2.1): add E2E tests for parser-extractor integration

- Test complete workflow: parse markdown → analyze eligibility
- Use static fixtures (Real Systems, Fake Fixtures)
- Validate marker detection across link formats
- Test CLI flag impact on decisions
- Confirms parser-extractor integration"
```

---

## Task 13: Verify All Acceptance Criteria

**Files:**
- Create: `tools/citation-manager/test/integration/us2.1-acceptance-criteria.test.js`

### Step 1: Write acceptance criteria validation tests

```javascript
// tools/citation-manager/test/integration/us2.1-acceptance-criteria.test.js
import { describe, it, expect } from 'vitest';
import { createContentExtractor } from '../../src/factories/componentFactory.js';

describe('US2.1 Acceptance Criteria Validation', () => {
  const extractor = createContentExtractor();

  it('AC1: should mark full-file link ineligible without --full-files flag', () => {
    // Given: Link to full file (anchorType: null), no flag
    const link = { anchorType: null, extractionMarker: null };
    const cliFlags = { fullFiles: false };

    // When: Analyze eligibility
    const result = extractor.analyzeEligibility(link, cliFlags);

    // Then: Decision is ineligible
    expect(result.eligible).toBe(false);
  });

  it('AC2: should mark section and block links eligible by default', () => {
    // Given: Links with anchors (header and block)
    const headerLink = { anchorType: 'header', extractionMarker: null };
    const blockLink = { anchorType: 'block', extractionMarker: null };

    // When: Analyze eligibility
    const headerResult = extractor.analyzeEligibility(headerLink, {});
    const blockResult = extractor.analyzeEligibility(blockLink, {});

    // Then: Both eligible by default
    expect(headerResult.eligible).toBe(true);
    expect(blockResult.eligible).toBe(true);
  });

  it('AC3: should force full-file extraction with %%extract-link%% marker', () => {
    // Given: Full-file link with force marker, no flag
    const link = {
      anchorType: null,
      extractionMarker: { innerText: 'force-extract' }
    };
    const cliFlags = { fullFiles: false };

    // When: Analyze eligibility
    const result = extractor.analyzeEligibility(link, cliFlags);

    // Then: Eligible despite no --full-files flag
    expect(result.eligible).toBe(true);
  });

  it('AC4: should prevent section extraction with %%stop-extract-link%% marker', () => {
    // Given: Section link with stop marker
    const link = {
      anchorType: 'header',
      extractionMarker: { innerText: 'stop-extract-link' }
    };

    // When: Analyze eligibility
    const result = extractor.analyzeEligibility(link, {});

    // Then: Ineligible despite having anchor
    expect(result.eligible).toBe(false);
  });

  it('AC5: should give markers highest precedence over CLI flags', () => {
    // Given: Stop marker + --full-files flag
    const link1 = {
      anchorType: 'header',
      extractionMarker: { innerText: 'stop-extract-link' }
    };
    const result1 = extractor.analyzeEligibility(link1, { fullFiles: true });

    // Then: Stop marker wins (ineligible)
    expect(result1.eligible).toBe(false);

    // Given: Force marker + no flag
    const link2 = {
      anchorType: null,
      extractionMarker: { innerText: 'force-extract' }
    };
    const result2 = extractor.analyzeEligibility(link2, { fullFiles: false });

    // Then: Force marker wins (eligible)
    expect(result2.eligible).toBe(true);
  });

  it('AC6: should implement Strategy Pattern correctly', () => {
    // Given: Factory-created ContentExtractor
    const extractor = createContentExtractor();

    // Then: Component has 4 strategies in correct order
    expect(extractor.eligibilityStrategies).toBeDefined();
    expect(extractor.eligibilityStrategies.length).toBe(4);

    // Verify strategies in precedence order
    const strategyNames = extractor.eligibilityStrategies.map(s => s.constructor.name);
    expect(strategyNames).toEqual([
      'StopMarkerStrategy',
      'ForceMarkerStrategy',
      'SectionLinkStrategy',
      'CliFlagStrategy'
    ]);
  });
});
```

### Step 2: Run acceptance tests

Run: `npm test -- us2.1-acceptance-criteria.test.js`
Expected: PASS (6 tests, one per AC)

### Step 3: Commit

```bash
git add tools/citation-manager/test/integration/us2.1-acceptance-criteria.test.js
git commit -m "test(us2.1): add acceptance criteria validation tests

- AC1: Full-file ineligible without flag ✅
- AC2: Section/block links eligible by default ✅
- AC3: Force marker overrides full-file default ✅
- AC4: Stop marker prevents section extraction ✅
- AC5: Markers have highest precedence ✅
- AC6: Strategy Pattern implementation validated ✅"
```

---

## Task 14: Run Full Test Suite and Verify Zero Regressions

### Step 1: Run complete test suite

Run: `npm test`
Expected: All tests pass (existing + new US2.1 tests)

### Step 2: Verify test coverage on new code

Run: `npm run test:coverage`
Check: ContentExtractor/ directory has >80% coverage

### Step 3: Run linter

Run: `npx biome check .`
Expected: No errors

### Step 4: Fix any linting issues

Run: `npx biome check --write .`

### Step 5: Commit

```bash
git add .
git commit -m "chore(us2.1): verify zero regressions and test coverage

- All tests passing (existing + US2.1)
- Code coverage >80% on new components
- Zero regressions confirmed
- Biome linting clean"
```

---

## Task 15: Update User Story Status

**Files:**
- Modify: `tools/citation-manager/design-docs/features/20251003-content-aggregation/user-stories/us2.1-implement-extraction-eligibility-strategy-pattern/us2.1-implement-extraction-eligibility-strategy-pattern.md`

### Step 1: Update frontmatter status

Change:

```yaml
status: Pending
```

To:

```yaml
status: Complete
completion-date: 2025-10-21
```

### Step 2: Add implementation notes section

Add at end of Dev Notes:

```markdown
## Implementation Summary

**Implementation Date**: 2025-10-21

**Components Created**:
- `ContentExtractor.js` - Component entry point
- `analyzeEligibility.js` - Strategy orchestrator
- `ExtractionStrategy.js` - Base interface
- `StopMarkerStrategy.js` - Highest precedence
- `ForceMarkerStrategy.js` - Second precedence
- `SectionLinkStrategy.js` - Default behavior
- `CliFlagStrategy.js` - Terminal strategy

**Components Modified**:
- `MarkdownParser.js` - Extraction marker detection
- `componentFactory.js` - createContentExtractor() factory
- `Markdown Parser Implementation Guide.md` - LinkObject schema docs

**Test Coverage**:
- Unit tests: 24 tests across 7 test files
- Integration tests: 8 tests
- Acceptance tests: 6 tests
- Total: 38 new tests
- Coverage: >85% on new code
- Static fixtures: 8 fixture files in test/fixtures/us2.1/

**Acceptance Criteria Status**: ✅ All 6 AC satisfied
```

### Step 3: Commit

```bash
git add "tools/citation-manager/design-docs/features/20251003-content-aggregation/user-stories/us2.1-implement-extraction-eligibility-strategy-pattern/us2.1-implement-extraction-eligibility-strategy-pattern.md"
git commit -m "docs(us2.1): mark user story as complete

- Update status to Complete
- Add implementation summary
- Document components created/modified
- Record test coverage metrics
- Document static fixtures created"
```

---

## Completion Checklist

Before marking US2.1 complete, verify:

- [ ] All 4 strategy classes implemented and tested
- [ ] analyzeEligibility orchestrator working correctly
- [ ] ContentExtractor component created with DI pattern
- [ ] Factory function creates extractor with correct precedence
- [ ] MarkdownParser detects extraction markers
- [ ] Static test fixtures created and checked into repo (8 files)
- [ ] LinkObject schema documented with extractionMarker property
- [ ] All 6 acceptance criteria have passing tests
- [ ] Integration tests validate parser-extractor workflow
- [ ] E2E tests confirm real markdown processing
- [ ] Zero regressions in existing test suite
- [ ] Code coverage >80% on new components
- [ ] Linting clean (Biome)
- [ ] User story status updated to Complete
- [ ] Technical debt documented (Issue 5 - hardcoded markers)

**Total Tasks**: 15
**Estimated Time**: 3-4 hours (TDD with small steps)
**Commits**: 15 (one per task)

---

## Plan Execution

**Plan complete and saved to `tools/citation-manager/design-docs/features/20251003-content-aggregation/user-stories/us2.1-implement-extraction-eligibility-strategy-pattern/tasks/extraction-eligibility-implement-plan.md`.**

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration with quality gates

**2. Parallel Session (separate)** - Open new session with superpowers:executing-plans, batch execution with checkpoints

**Which approach?**
