# Epic 4: TypeScript Migration Learnings

## Import Extensions in TypeScript ESM Projects

### Context

During Epic 4 (Parser Facade & Cache migration), we discovered confusion about proper import extensions when migrating `.js` files to `.ts`.

### The Problem

When renaming `ParsedDocument.js` → `ParsedDocument.ts`, the question arose: Should imports reference `.js` or `.ts`?

Initial incorrect assumption: Change `import ParsedDocument from "./ParsedDocument.js"` to `"./ParsedDocument.ts"`

### The Correct Answer (2025 Best Practices)

**For Node.js ESM with `moduleResolution: NodeNext`:**

✅ **CORRECT:** Import statements should use `.js` extensions, even when importing from `.ts` files

```typescript
// In ParsedFileCache.js or ParsedFileCache.ts
import ParsedDocument from "./ParsedDocument.js"; // ✅ Correct
```

❌ **INCORRECT:**

```typescript
import ParsedDocument from "./ParsedDocument.ts";  // ❌ Wrong
import ParsedDocument from "./ParsedDocument";     // ❌ Wrong (missing extension)
```

### Why `.js` Extensions?

1. **Node.js ESM Requirement:** Node.js ESM module resolution requires explicit file extensions and does not perform extension searching

2. **Output-Based Imports:** Import paths reference the **compiled output** files (`.js`), not the source files (`.ts`)

3. **TypeScript Design:** TypeScript intentionally does NOT rewrite import paths during compilation. What you write is what gets emitted.

4. **Runtime Reality:** At runtime, Node.js loads `.js` files from the `dist/` folder, not `.ts` files from `src/`

### Module Resolution Modes

#### NodeNext (Node16, Node18)
- **Use case:** Publishing packages for Node.js (no bundler)
- **Rule:** MUST use `.js` extensions in imports
- **Our project:** ✅ Uses this mode (`moduleResolution: NodeNext`)

#### Bundler
- **Use case:** Frontend code processed by Webpack/Vite/etc.
- **Rule:** Can omit extensions or use `.ts` extensions
- **Our project:** ❌ Not applicable (we're a CLI tool)

### Verification in Our Codebase

```bash
# Check our module resolution mode
cat tsconfig.base.json | grep moduleResolution
# Output: "moduleResolution": "NodeNext"

# This means: Use .js extensions in all imports
```

### Implementation Impact

**During Epic 4 migration:**

1. When renaming `.js` → `.ts`: Keep imports pointing to `.js`
2. When creating new `.ts` files: Use `.js` in imports
3. When `.ts` files import other `.ts` files: Still use `.js` extensions

**Example:**

```typescript
// src/ParsedDocument.ts imports from types
import type { ParserOutput } from "./types/citationTypes.js"; // .js extension

// src/ParsedFileCache.ts imports ParsedDocument
import ParsedDocument from "./ParsedDocument.js"; // .js extension
```

### References

- [TypeScript ESM Node.js Handbook](https://www.typescriptlang.org/docs/handbook/esm-node.html)
- [TypeScript Module Resolution](https://www.typescriptlang.org/tsconfig/moduleResolution.html)
- [TypeScript Modules Theory](https://www.typescriptlang.org/docs/handbook/modules/theory.html)
- [Node.js, TypeScript and ESM Guide](https://dev.to/a0viedo/nodejs-typescript-and-esm-it-doesnt-have-to-be-painful-438e)

### Action Items

- [x] Document this learning in epic4-learnings.md
- [ ] Update epic4-parser-facade-cache-implementation-plan.md to include import best practices
- [ ] Review and fix any incorrect `.ts` extensions in imports
- [ ] Add this to architecture principles for future reference

---

## ComponentFactory Creates Test Blocker Until Epic 7

### Context

Epic 4 converts ParsedDocument and ParsedFileCache from JavaScript to TypeScript. After conversion, 50 out of 313 tests fail (16%) while 263 tests pass (84%).

### The Problem

**Test Failure Pattern:**

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../ParsedFileCache.js'
imported from '.../componentFactory.js'
```

**Root Cause:**
- `componentFactory.js` is still JavaScript (not converted in Epic 4)
- JavaScript files use Node.js ESM which requires literal file extensions
- `componentFactory.js` imports: `import { ParsedFileCache } from "../ParsedFileCache.js"`
- Node.js looks for literal `.js` file, but file is now `ParsedFileCache.ts`
- Source TypeScript files compiled to `dist/` but tests run from `src/`

### Why This Happens

**Import Resolution Difference:**

**TypeScript files** (`componentFactory.ts`):
- TypeScript compiler resolves `.js` imports to `.ts` source files
- Works correctly: `import from "./ParsedFileCache.js"` → finds `ParsedFileCache.ts`

**JavaScript files** (`componentFactory.js`):
- Node.js ESM requires literal file extensions
- Fails: `import from "./ParsedFileCache.js"` → looks for literal `.js` file (doesn't exist)

### Test Impact

**50 failing tests (16%)** - All CLI-dependent:
- 17 Extract command tests
- 12 Validation tests
- 4 Warning display tests
- 3 CLI execution tests
- 3 Enhanced citation tests
- 3 Warning validation tests
- 2 Base paths tests
- And others...

**263 passing tests (84%)** - Unit/integration tests:
- Parser tests
- Strategy tests
- Component tests
- Non-CLI integration tests

### Why componentFactory Not in Epic 4 Scope

**Epic Sequencing (typescript-migration-sequencing.md):**

- Epic 4: ParsedDocument + ParsedFileCache (leaf facades)
- Epic 5: CitationValidator (depends on Epic 4)
- Epic 6: ContentExtractor (depends on Epic 5)
- **Epic 7: CLI Integration + componentFactory** ← Converts here

**Dependency Reasoning:**
- componentFactory creates ALL components (FileCache, MarkdownParser, ParsedFileCache, CitationValidator, ContentExtractor)
- Must wait for all component conversions (Epic 2-6) before componentFactory can be typed
- Factory belongs in integration layer, not component layer

### Resolution Strategy

**Accept partial test failures until Epic 7:**
- Continue Epic 4-6 with 84% test coverage (263/313 tests)
- Use passing tests for validation during component conversions
- All 50 tests automatically fix when componentFactory converts in Epic 7

**Alternative (NOT recommended):**
- Convert componentFactory early (breaks Epic sequencing)
- Creates dependency on unconverted components
- Violates leaf-to-root conversion order

### Workaround Verification

**Test coverage during Epic 4-6:**
- Unit tests: ✅ All passing (don't need componentFactory)
- Component tests: ✅ All passing (test components directly)
- Integration tests: ✅ Most passing (non-CLI workflows)
- CLI tests: ❌ Blocked until Epic 7

**Validation approach:**
- Use 263 passing tests to validate Epic 4-6 conversions
- Defer CLI validation to Epic 7
- Final validation: All 313 tests pass after Epic 7 complete

### Action Items

- [x] Document componentFactory blocker in epic4-learnings.md
- [x] Update test reporter from "verbose" to "default" (reduce noise)
- [ ] Review design/sequencing docs to ensure Epic 7 scope covers componentFactory
- [ ] Add note to Epic 4 completion: "50 CLI tests deferred to Epic 7"
- [ ] Verify Epic 5-6 can proceed with partial test suite
