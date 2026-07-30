# 007. Testing

**Status:** done

## Test Framework

**Vitest**. `npm test` runs the full suite once; `npm run test:watch` runs in watch mode. Tests import from **compiled `dist/`**, not `src/` TypeScript directly — `dist/` must be up to date (`npm run build` / `npx tsc --build`) before running tests, since the test runner executes plain JS. This means a source change with no rebuild will test stale behavior silently; there is no build-on-test-run step.

## Directory Layout (`test/`)

| Directory | Purpose |
|---|---|
| `test/unit/` | Component-level unit tests, including `core/`, `factories/`, `utils/` subdirs and dedicated type-contract tests (e.g. `jact-cli-class-types.test.ts`) |
| `test/integration/` | End-to-end workflow tests across multiple components (parser → validator → extractor), including an `integration/ContentExtractor/` subdir |
| `test/core/` | Mirrors `src/core/` structure directly (`ContentExtractor/`, `MarkdownParser/`) |
| `test/validate/` | Batch-validate feature: `batch-runner.test.ts`, `renderers.test.ts`, `resolve-changed-files.test.ts`, `resolve-files.test.ts`, `validate-integration.test.ts`, plus `git-fixture-test-utils.ts` |
| `test/cli-integration/` | Full CLI invocations (extract command, extract-header variants, base-paths npm script) |
| `test/hardening-pipeline/` | Architectural/characterization constraint tests — e.g. `c1-d1-injectable-bans.test.ts` (bans certain hard imports), `c4-portability.test.ts` |
| `test/cache/`, `test/fixtures/`, `test/helpers/`, `test/regressions/`, `test/scratch/` | Supporting fixtures, test doubles, and regression-specific cases |

Mixed `.js`/`.ts` test files coexist: older tests are still plain `.js`, newer ones are `.ts` with explicit type-contract assertions.

## Conventions

- **TDD-first for new features.** Feature work under `design-docs/features/<slug>/` typically ships its own `spec/006-testing.md` mapping each requirement scenario to a test suite before implementation — see the batch-validate feature's testing spec for the pattern (WHEN/THEN scenarios become test cases directly).
- **Characterization/snapshot tests guard migrations.** The WMF-35 regex-to-mdast-token migration added characterization snapshots of `cleanMarkdownForComparison` output *before* swapping its internals to a tokenizer-backed implementation, so behavior parity is provable rather than assumed. See ADR-0002 in the ADRs section.
- **Injectable seams over module mocking.** Git access (`RunGit` type in `resolve-changed-files.ts`) and filesystem access (`FileSystemInterface` in `MarkdownParser`) are injected interfaces, not `vi.mock()` targets — tests supply a stub function/object directly rather than mocking `node:child_process` or `node:fs`.
- **DI factories accept overrides for testing.** Every `create*` function in `componentFactory.ts` accepts optional dependency parameters (falling back to production defaults), so tests can inject fakes without importing concrete production classes — see the componentFactory entry in the Architecture section.
- **Type-contract tests are a first-class suite**, not just `tsc` — e.g. `jact-cli-class-types.test.ts` asserts on the shape of `JactCli`'s public API directly, catching accidental signature drift that a behavioral test might miss.

## Running Tests

```bash
npm test                 # full suite once
npm run test:watch       # watch mode
npx tsc --build          # rebuild dist/ before testing source changes
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0-draft | 2026-07-01 | Initial testing doc, grounded in `test/` directory layout and `test/README.md` |
