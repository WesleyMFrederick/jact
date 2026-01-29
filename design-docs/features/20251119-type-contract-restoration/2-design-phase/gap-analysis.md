# Gap Analysis: TypeScript Migration Phase 2

**Created**: 2025-01-21
**Purpose**: Identify what's missing between current state and TypeScript migration requirements
**Scope**: Design phase gaps only (not sequencing, not solutions)

---

## Gap Analysis Matrix

| Requirement | Current State | Gap Identified | Priority | Notes |
|-------------|---------------|----------------|----------|-------|
| **FR1: Convert all .js to .ts** | 6 major components in JS (2,436 LOC) | ✅ Component inventory complete | N/A | Sequencing concern (Phase 3) |
| **FR2: Maintain data contracts** | Component Guides exist with JSON schemas | ⚠️ LinkScope terminology conflict: types say 'external', code uses 'cross-document' | **BLOCKER** | Must resolve before typing |
| **FR2: Maintain data contracts** | Enrichment pattern documented | ✅ Pattern clear (in-place mutation) | N/A | Well documented |
| **FR2: Maintain data contracts** | ValidationResult structure documented | ✅ Structure clear: `{ summary, links }` | N/A | Component Guide validates |
| **FR3: Shared types** | 3 type libraries exist (citationTypes, validationTypes, contentExtractorTypes) | ⚠️ MarkdownParser has internal LinkObject definition (Epic 4.3 failure) | **BLOCKER** | Need enforcement mechanism |
| **FR3: Shared types** | Types exist but not imported in JS | ⚠️ No pattern for migrating JS to use shared types | Important | How to enforce imports? |
| **FR3: Shared types** | Strategy interface duck-typed | ❌ Missing formal Strategy interface definition | Important | Needed for ContentExtractor |
| **FR3: Shared types** | CLI flags untyped | ❌ Missing CliFlags interface | Important | Used across multiple components |
| **FR3: Shared types** | Parser tokens untyped | ❌ Missing marked.js token types | Nice-to-have | Could import from @types/marked |
| **FR4: Zero compile errors** | Strict mode enabled | ✅ tsconfig ready (all 7 strict flags) | N/A | Infrastructure complete |
| **FR4: Zero compile errors** | Conditional property patterns | ⚠️ `if (error) result.error = error` needs discriminated unions | Important | Pattern needed for conversions |
| **FR5: 100% test pass rate** | 314/314 tests passing (baseline) | ✅ Baseline validated | N/A | Success metric clear |
| **FR5: 100% test pass rate** | Vitest handles .ts files natively | ✅ Test infrastructure ready | N/A | No gap |
| **FR6: Preserve patterns** | Enrichment pattern documented | ✅ Pattern preservation validated in Epic 3 POC | N/A | Prevention checklist exists |
| **FR6: Preserve patterns** | Promise caching pattern (ParsedFileCache) | ⚠️ Complex pattern - typing approach unclear | Important | Needs example/pattern |
| **FR6: Preserve patterns** | Facade pattern (ParsedDocument) | ✅ Straightforward to type | N/A | Standard class typing |
| **NFR1: No breaking changes** | Component Guides define all contracts | ✅ Contracts documented | N/A | Validation mechanism exists |
| **NFR2: Types match runtime** | Epic 4.2-4.5 failures documented | ✅ Failure patterns identified | N/A | Prevention checklist created |
| **NFR3: Eliminate type bugs** | Strict null checking enabled | ✅ Compiler config ready | N/A | No gap |
| **NFR4: Single source of truth** | 3 shared type libraries | ⚠️ Duplicate prevention not enforced | Important | Need validation step |
| **NFR5: Descriptive names** | Naming conventions documented | ✅ Standards clear (camelCase, TitleCase) | N/A | No gap |
| **NFR6: Organized by domain** | Types in `types/` directory | ✅ Organization clear | N/A | No gap |
| **NFR7: Incremental with checkpoints** | 7-checkpoint framework from Epic 3 | ✅ Validation approach proven | N/A | Framework reusable |
| **NFR8: 100% per component** | Test-first pattern from Epic 3 | ✅ Pattern proven (test file → source file) | N/A | No gap |
| **NFR9: Validate contracts** | citation-manager extract tool exists | ✅ Automated validation available | N/A | No gap |

---

## Identified Gaps Summary

### BLOCKER Gaps (Must Resolve)

1. **LinkScope Terminology Conflict**
   - **Gap**: Type definition says `'external'`, code uses `'cross-document'`
   - **Impact**: Cannot type LinkObject without resolving terminology
   - **Location**: citationTypes.ts vs MarkdownParser.js, CitationValidator.js
   - **→** Solutions Hypothesis needed

2. **Duplicate Type Definition Risk**
   - **Gap**: No enforcement preventing internal type definitions (happened in Epic 4.3)
   - **Impact**: MarkdownParser could define own LinkObject again
   - **Evidence**: Epic 4.3 created internal LinkObject conflicting with shared type
   - **→** Solutions Hypothesis needed

### Important Gaps (Should Resolve)

1. **Missing Type Definitions**
   - Strategy interface (duck-typed in analyzeEligibility)
   - CliFlags interface (used in ContentExtractor)
   - Conditional property pattern guidance (discriminated unions)

2. **Complex Pattern Typing Unclear**
   - **Pattern**: Promise caching in ParsedFileCache
   - **Gap**: No example of typing `Map<string, Promise<ParsedDocument>>`
   - **Impact**: Might need explicit type for cache property
   - **→** Research or example needed

3. **Type Import Enforcement**
   - **Gap**: No validation that JS files import from `types/` when converted
   - **Impact**: Components might create own types instead of importing
   - **→** Validation checkpoint needed

### Nice-to-Have Gaps

1. **Parser Token Types**
   - **Option A**: Import from `@types/marked`
   - **Option B**: Define minimal interface
   - **Impact**: Low - tokens mostly opaque in our code
   - **→** Design decision (defer to Solutions Hypothesis)

---

## Gaps NOT in Scope (Other Phases)

### Phase 3: Sequencing Concerns
- ❌ Component migration order (small → large suggested by rollback plan)
- ❌ Dependency graph analysis for conversion sequence
- ❌ Parallel vs sequential conversion strategy

### Phase 4: Implementation Details
- ❌ Exact type syntax for each component
- ❌ File-by-file conversion steps
- ❌ Test modification approach (should be zero, but tactics)

---

## Gap Implications for Design Phase

### What We Can Design Now

With identified gaps, we can design:
- ✅ Overall typing approach (match existing structures)
- ✅ Validation checkpoints (7-checkpoint framework)
- ✅ Contract preservation strategy (Component Guide validation)
- ✅ Test-first conversion pattern (proven in Epic 3)

### What Needs Resolution First

Before completing design:
- ⚠️ **LinkScope terminology** - Must decide: 'external' or 'cross-document'?
- ⚠️ **Type definition enforcement** - How prevent duplicates?
- ⚠️ **Missing interfaces** - Create Strategy, CliFlags, or defer?

### What Goes to Solutions Hypothesis (Activity 3)

Solutions needed for:
1. LinkScope terminology resolution approach
2. Duplicate type prevention mechanism
3. Missing type definition strategy
4. Promise caching typing pattern
5. Type import validation approach

---

## Design-Phase Questions Raised

### Q1: LinkScope Terminology Resolution
**Question**: Should we change types to match code ('cross-document') or change code to match types ('external')?

**Context**:
- Type says: `LinkScope = 'internal' | 'external'`
- Code uses: `scope: 'cross-document'` (MarkdownParser line 245, CitationValidator line 128)
- Impact: Every component that processes links

**Decision Needed**: Before design can specify which type to use

**→** Move to Solutions Hypothesis

---

### Q2: Duplicate Type Prevention
**Question**: How do we enforce shared type usage during conversion?

**Context**:
- Epic 4.3: MarkdownParser created internal `LinkObject`
- No build-time check prevents this
- Manual code review is error-prone

**Options to Explore**:
- Build-time lint rule?
- Manual validation checklist?
- Type import audit step?

**→** Move to Solutions Hypothesis

---

### Q3: Missing Type Definitions - Create Now or Later?
**Question**: Should we create Strategy/CliFlags interfaces before design, or as part of implementation?

**Context**:
- Strategy interface: Used by ContentExtractor
- CliFlags interface: Used by analyzeEligibility, extractLinksContent
- Both currently duck-typed

**Trade-off**:
- Create now: Design can reference them
- Create later: Don't over-design before seeing usage patterns

**→** Move to Solutions Hypothesis

---

### Q4: Promise Caching Typing Pattern
**Question**: What's the type annotation pattern for ParsedFileCache's Promise-based cache?

**Context**:
- Current: `this.cache = new Map();` (untyped)
- Should be: `Map<string, Promise<ParsedDocument>>`
- Need example for design documentation

**Options**:
- Provide explicit example in design
- Reference TypeScript Map generics docs
- Create POC before design finalization

**→** Move to Solutions Hypothesis or defer to implementation

---

## Next Steps

### Immediate (Before Solutions Hypothesis)
- [ ] No actions required - gaps identified and documented

### Activity 3: Solutions Hypothesis
- [ ] Propose LinkScope terminology resolution
- [ ] Design duplicate type prevention approach
- [ ] Decide on missing type definitions (create now vs later)
- [ ] Provide Promise caching typing example
- [ ] Design type import enforcement mechanism

### After Solutions Validated
- [ ] Create Design Document using solutions
- [ ] Validate design against architecture principles
- [ ] Proceed to Phase 3 (Sequencing)

---

## Summary

**Total Gaps Identified**: 6 (2 blockers, 3 important, 1 nice-to-have)

**Blockers Preventing Design**:
1. LinkScope terminology conflict
2. Duplicate type definition risk

**Can Proceed With Design After**:
- Solutions hypothesis addresses blockers
- Decisions made on terminology and enforcement

**No Show-Stoppers**: All gaps have potential solutions (to be explored in Activity 3)

---

## References

- **PRD**: [typescript-migration-prd.md](../typescript-migration-prd.md) - Requirements FR1-FR6, NFR1-NFR9
- **Research Documents**: Component Guides, Baseline Code, POC Validation, TypeScript Infrastructure, Failure Patterns
- **Failure Patterns**: [research-failure-patterns.md](research/research-failure-patterns.md) - Epic 4.2-4.5 failures
- **Baseline Code**: [research-baseline-code.md](research/research-baseline-code.md) - Current JavaScript structures
