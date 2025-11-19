# TypeScript Type Organization Patterns

**Purpose:** Document type patterns and organization strategy for citation-manager TypeScript migration.

**Audience:** Developers converting JavaScript files to TypeScript during Epic 4.

---

## Table of Contents

1. [Type Organization Decision Criteria](#type-organization-decision-criteria)
2. [Type Pattern Examples](#type-pattern-examples)
3. [Circular Dependency Prevention](#circular-dependency-prevention)

---

## Type Pattern Examples

### Pattern 1: Discriminated Union with Null

**Use for:** Functions that may return null based on input validation.

**Example:**

```typescript
export function normalizeBlockId(anchor: string | null): string | null {
  if (anchor && anchor.startsWith("^")) {
    return anchor.substring(1);
  }
  return anchor;
}
```

**Rationale:** Explicit null handling prevents undefined behavior. TypeScript strict null checking catches missing null guards.

---

### Pattern 2: Discriminated Union for State

**Use for:** Results that have multiple distinct states (success/failure, found/notFound).

**Example:**

```typescript
export type ResolutionResult =
  | { found: true; path: string; reason: 'direct' | 'cache' }
  | { found: false; path: null; reason: 'not_found' | 'duplicate'; candidates?: string[] };
```

**Rationale:** Discriminated unions make illegal states unrepresentable. TypeScript narrows types in conditional blocks.

---

### Pattern 3: Graceful Error Handling with Type Contract

**Use for:** Operations that may fail but should maintain type safety.

**Example:**

```typescript
export function decodeUrlAnchor(anchor: string | null): string | null {
  if (anchor === null) return null;

  try {
    return decodeURIComponent(anchor);
  } catch (error) {
    return anchor; // Graceful fallback preserves contract
  }
}
```

**Rationale:** Type contract guarantees return type even with errors. Fallback prevents exception propagation.

---

### Pattern 4: Explicit Optional Parameters

**Use for:** Dependency injection with optional overrides.

**Example:**

```typescript
export function createValidator(
  parser: MarkdownParser,
  cache?: FileCache
): CitationValidator {
  // Implementation uses cache if provided, otherwise validates without it
}
```

**Rationale:** Optional parameters document flexibility. TypeScript enforces null checks when accessing optional params.

---

## Type Organization Decision Criteria

### Extract to `*Types.ts` vs Co-locate in Operation File

| Criteria | Extract to `*Types.ts` | Co-locate in operation file |
|----------|------------------------|----------------------------|
| **Used by 2+ modules?** | ✅ YES | ❌ NO |
| **Domain entity?** | ✅ YES (LinkObject, ValidationResult) | ❌ NO |
| **Public API contract?** | ✅ YES | ❌ NO |
| **Prevents circular deps?** | ✅ YES | ❌ NO |
| **Operation-internal helper?** | ❌ NO | ✅ YES (EligibilityAnalysis) |
| **Discriminated union for single operation?** | ❌ NO | ✅ YES |

### Examples

**Extract to citationTypes.ts (shared domain type):**

```typescript
// types/citationTypes.ts - SHARED across multiple modules
export interface LinkObject {
  rawSourceLink: string;
  target: { path: string; anchor: string | null };
  validation?: ValidationMetadata;
}
```

**Co-locate in analyzeEligibility.ts (operation-specific type):**

```typescript
// core/ContentExtractor/analyzeEligibility.ts
import type { LinkObject } from '../../types/citationTypes';

// ✅ Co-located: Only used by analyzeEligibility operation
export interface EligibilityAnalysis {
  eligible: boolean;
  reason: string;
  strategy: string;
}

export function analyzeEligibility(link: LinkObject): EligibilityAnalysis {
  // Uses shared LinkObject + local EligibilityAnalysis
}
```

---

## Circular Dependency Prevention

### Three-Layer Dependency Hierarchy

```text
Layer 1: types/ directory (ZERO dependencies)
         ↓ (types depend on nothing)
Layer 2: operations (depend ONLY on types/)
         ↓ (operations depend on types)
Layer 3: orchestrators (depend on types + operations)
```

### Rules

1. **Contracts depend on nothing** - types/ directory has zero imports from operations
2. **Operations depend on contracts** - import from types/
3. **Never the reverse** - types never import from operations

**Example:**

```typescript
// ✅ CORRECT: Operation imports contract
// core/ContentExtractor/analyzeEligibility.ts
import type { LinkObject } from '../../types/citationTypes';

// ❌ WRONG: Contract imports operation
// types/citationTypes.ts
import type { EligibilityAnalysis } from '../core/ContentExtractor/analyzeEligibility';
```

---
