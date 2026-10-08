# 007. Testing

**Status:** done

jact tests run on Vitest. Unit tests import the TypeScript source; command-line tests run the built CLI, so they need a fresh build.

## Test Framework

**Vitest** runs every test. Vitest compiles TypeScript itself, so a test that imports from `src/` sees source changes without a build. A test that spawns `dist/cli.js` or imports from `dist/` runs the last build. Rebuild with `npm run build` before you run those tests, or they check stale behavior. No test run builds the project for you.

## Directory Layout (`test/`)

Each folder holds one kind of test.

| Directory | Purpose |
|---|---|
| `test/unit/` | Unit tests for one component, plus type-contract tests for public shapes |
| `test/core/` | Tests that mirror the `src/core/` folders, one subfolder per component |
| `test/validate/` | Batch-validate tests: file selection, the batch run, reports, and the end-to-end batch path |
| `test/integration/` | Workflows that span several components (parser to checker to extractor) |
| `test/cli-integration/` | Full runs of the built CLI, one command or flag behavior per file |
| `test/regressions/` | One test per fixed bug, named `<issue-number>-<short-slug>.test.ts` |
| `test/hardening-pipeline/` | Architecture constraint tests, such as bans on hard-coded dependencies |
| `test/fixtures/`, `test/helpers/` | Shared Markdown fixtures, CLI runners, and test doubles |
| `test/scratch/` | Exploratory proofs and benchmarks, not product guarantees |

Plain `.js` and `.ts` test files coexist. Newer tests use `.ts`.

## Conventions

Five conventions decide how a new test is written.

- **Test first for features.** A feature folder under `design-docs/features/` maps each requirement scenario to a test before the code exists.
- **Characterization snapshots guard migrations.** Before an internal rewrite, a snapshot pins the old output, so the rewrite proves the same behavior. Example: [ADR-0002 — Regex → mdast-token migration (WMF-35)](../adrs/003-adrs.md#ADR-0002%20—%20Regex%20→%20mdast-token%20migration%20(WMF-35)).
- **Injected seams, not module mocks.** Git calls and file-system reads come in as injected functions or objects. Tests pass a stub; no test mocks `node:child_process` or `node:fs`.
- **Factory overrides for fakes.** The component factory accepts dependency overrides, so a test injects a fake without a production class. Why: [ADR-0001 — DI-via-factory pattern](../adrs/003-adrs.md#ADR-0001%20—%20DI-via-factory%20pattern).
- **Type-contract tests are a suite.** Type tests assert public shapes directly and catch a signature change that a behavior test misses.

## Running Tests

These commands run the suite.

```bash
npm run build            # rebuild dist/ before CLI tests
npm test                 # full suite once
npm run test:watch       # watch mode
```

## Version History

Each row records one version of this section.

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0-draft | 2026-07-01 | Initial testing doc, grounded in `test/` directory layout and `test/README.md` |
| 1.1.0 | 2026-10-07 | Aligned to code; removed internal code names to reduce drift |
