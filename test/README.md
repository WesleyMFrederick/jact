# Citation Manager — Test Guide

## Import Strategy

Tests import from `dist/` (compiled output), not `src/` (TypeScript source).

**Why**: TypeScript source must be compiled to JavaScript before test execution. Tests run against the transpiled code in `dist/`.

**Example**:

```javascript
// Correct — import compiled output
import { CitationManager } from "../dist/citation-manager.js";

// Wrong — TypeScript source not directly executable by test runner
import { CitationManager } from "../src/citation-manager.ts";
```

**Build before testing**: Run `npx tsc --build` if `dist/` is stale.

See commit `51a60a3` for the migration that established this pattern.

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
- All test fixtures live in `test/fixtures/`

## Worktree Constraints

This project uses git worktrees with macOS Seatbelt sandboxing. Tests must be **self-contained** within the worktree.

**Constraints**:

- Sandbox is **deny-by-default** — writes outside the worktree are blocked
- Tests must not read from or write to paths outside the worktree directory
- Temporary files should use OS temp directories (`/tmp/`) which are whitelisted
- Test cleanup (`afterEach`/`afterAll`) must remove any temp files created

**Full sandbox documentation**: See `packages/sandbox/SEATBELT-GUIDE.md` and `packages/sandbox/AUTOMATED-WORKTREE-SETUP.md`.

## Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Citation-specific tests
npm run test:citation
```

## Test Organization

```text
test/
├── fixtures/          # Self-contained markdown test files
├── helpers/           # Shared test utilities
├── unit/              # Unit tests (types, factories, modules)
├── integration/       # Integration tests
├── cli-integration/   # CLI end-to-end tests
└── setup.js           # Test environment setup (process cleanup, NODE_ENV)
```
