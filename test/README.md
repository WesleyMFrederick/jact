---
last_verified: 2026-11-19
verified_by: agent
---
# JACT — Test Guide

## Import Strategy

Vitest runs TypeScript directly, so most tests import from `src/` (TypeScript source) using the `.js` suffix that NodeNext resolution requires. No build is needed for these imports.

**Example**:

```typescript
// Typical — import TypeScript source with the NodeNext .js suffix
import { createMarkdownParser } from "../../src/factories/componentFactory.js";
```

**Build before CLI tests**: CLI integration tests run the compiled `dist/cli.js` in a child process, and a few older unit tests still import from `dist/`. Run `npm run build` first when `dist/` is stale, or those tests exercise old code.

## Path Resolution

All test paths must use relative resolution. Never hardcode absolute paths.

```javascript
// Correct
const fixturePath = join(__dirname, "fixtures", "sample.md");

// Wrong — breaks in worktrees, CI, and other environments
const fixturePath = "/Users/someone/project/test/fixtures/sample.md";
```

**Rules**:

- Use `__dirname` or `import.meta.url` for file-relative paths
- Use `process.cwd()` only when testing CLI behavior from project root
- Shared Markdown fixtures live in `test/fixtures/`; a suite may keep its own `fixtures/` folder beside it (for example `test/hardening-pipeline/fixtures/`), and many tests build small trees under the OS temp directory

## Worktree Constraints

Tests may run from git worktrees, so they must be **self-contained** within the checkout.

**Constraints**:

- Tests must not read from or write to paths outside the checkout, except the OS temp directory
- Temporary files should go under `os.tmpdir()`
- Test cleanup (`afterEach`/`afterAll`) must remove any temp files created

## Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage

# Vitest UI
npm run test:ui

# One file or folder
npx vitest run test/cli-integration/rename-command.test.ts
```

## Test Organization

```text
test/
├── fixtures/          # Shared self-contained Markdown test files
├── helpers/           # Shared test utilities (CLI runner, in-memory file cache)
├── unit/              # Unit tests (types, factories, modules)
├── core/              # Component tests for src/core modules
├── integration/       # Integration tests
├── cli-integration/   # CLI end-to-end tests against dist/cli.js
├── cache/             # Cache-check tests
├── outline/           # Outline rendering tests
├── validate/          # Validate batch runner and renderers
├── hardening-pipeline/ # Injectable-ban and portability checks
├── regressions/       # One test per fixed GitHub issue (see its README)
├── scratch/           # Proofs of concept and benchmarks
└── *.test.{js,ts}     # Older top-level suites
```

Regression test files follow the [Naming Convention](regressions/README.md#Naming%20Convention).
