---
date: 2026-05-13
branch: feat/testing-principles-evaluation
---

# jact Testing Principles Evaluation Analysis

%% *Last Modified: 05/13/26 12:41:50* %%

## Problem Understanding (Polya)

%% *Last Modified: 05/13/26 12:41:50* %%

**[a: identify the unknown]**
Determine which testing principle gaps exist in jact's current test suite, and produce a concrete phase assignment + TDD sequencing for each gap so they can be integrated into the master refactor plan.

**[b: identify the data]**
- Testing principles: 7 sections (Scope/Targets, Anti-Targets, Organization, Authoring Style, Infrastructure/Doubles, Vitest Conventions, Quality Gates)
- Current test suite: ~40 .js + mixed .ts files; flat layout with partial unit/integration separation; no `regressions/` dir; no mirrored `src/` structure; `helpers/` exists but not `*-test-utils.ts` pattern; some E2E but coupled to real filesystem
- Refactor plan: Phase 1 (≤30 min quick wins), Phase 2 (≥30 min reworks), Phase 3 (deferred); Rework 6 already gates on ≥80% coverage; no testing-specific items yet; Open Q4 asks about coverage baseline

**[c: identify the condition]**
- TDD preference: tests written before implementation
- Phase semantics must be preserved (Phase 1 = quick wins, Phase 2 = named reworks)
- No behavioral risk — layout moves must keep suite green before each group
- ≥80% coverage gate for Rework 6 must be measured before that rework begins

**[d: assess the condition]**
Condition is sufficient. The principle file is complete and the test survey is specific enough to assign every gap. One open item: `vitest.config.ts` contents were not fully read — vitest config audit is therefore Phase 1 (read + decide) rather than a confirmed fix.

---

## Gap Analysis by Section

%% *Last Modified: 05/13/26 12:41:50* %%

### Test Scope and Targets

%% *Last Modified: 05/13/26 12:41:50* %%

**Principle requires:** Tests for behavioral contracts (TSDoc `Contract:` blocks), non-trivial algorithms, every documented error path, E2E flows via first-party fakes, regressions promoted to a `regressions/` dir, generic-preservation tests.

**jact today:** Heavy coverage of happy paths and AST extraction. No systematic `Contract:` block coverage. Some error-path tests exist but not systematized. No `regressions/` dir. Some E2E but coupled to real filesystem rather than an injectable `FileSystemInterface` faux.

**Gaps:**
1. No `Contract:` test convention
2. No `regressions/` directory
3. Error-path tests uneven
4. E2E couples to real filesystem

**Phase assignment:** Phase 2 — new Rework "Contract Test Convention + Regressions Directory"

**TDD sequence:** Write `FileSystemInterface` faux + one test using it first → then refactor production callers. Write failing `Contract:` test first whenever a TSDoc `Contract:` block is added.

---

### Anti-Test Targets

%% *Last Modified: 05/13/26 12:41:50* %%

**Principle requires:** No type-level re-asserts, no trivial-accessor tests, no third-party-library tests, no snapshots, no cosmetic-output tests, no default live network.

**jact today:** Some `.test.ts` files may double up on what `tsc --noEmit` already proves. No snapshots or live network (good).

**Gaps:** Audit needed — likely minor.

**Phase assignment:** Phase 1 — "Anti-test audit pass" (review ~5 type-shape test files, delete or justify each)

**TDD sequence:** N/A (deletion work)

---

### Test Organization and Sprawl Prevention

%% *Last Modified: 05/13/26 12:41:50* %%

**Principle requires:** Tests mirror `src/` structure; one file per source module; kebab-case `*.test.ts` only; regressions in `regressions/<issue>-<slug>.test.ts`; helpers in `*-test-utils.ts`; fixtures in `test/fixtures/` or `test/data/`; `scratch/` for disposable smoke scripts.

**jact today:** Largest gap area. ~40 `.js` test files. No mirrored `src/` structure. `helpers/` uses `.js` not `*-test-utils.ts`. `poc-block-extraction.test.js` is scratch content in runner. `auto-fix.test.js.archive` is ad-hoc disposal.

**Gaps:**
- (a) `.js` → `.ts` migration (~40 files)
- (b) Flat → mirrored layout
- (c) `helpers/` → `*-test-utils.ts`
- (d) Create `regressions/` dir
- (e) Create `scratch/` dir
- (f) Delete `.archive` file

**Phase assignment:** Phase 2 — new Rework "Test Suite Reorganization" (one commit per component group, suite green before next). `.js` → `.ts` migration: opportunistic Phase 1 policy (migrate files as touched, not a bulk batch).

**TDD sequence:** N/A for layout moves; for `.js` → `.ts`, run test before and after to confirm parity.

---

### Test Authoring Style (BDD / AAA)

%% *Last Modified: 05/13/26 12:41:50* %%

**Principle requires:** `describe` names subject, `it` names behavior; max 3 nesting; AAA inline; factories not `beforeEach` for input construction; explicit vitest imports.

**jact today:** Largely aligned. `describe`/`it` structure clean. AAA-inline with Given/When/Then comments consistent. Explicit vitest imports observed. Factories used.

**Gaps:** Minor — verify no file exceeds 3 nesting levels; verify no `beforeEach` for input construction.

**Phase assignment:** Phase 1 — "BDD/AAA style audit" (grep-based, fast)

**TDD sequence:** N/A (style audit)

---

### Test Infrastructure and Doubles

%% *Last Modified: 05/13/26 12:41:50* %%

**Principle requires:** In-memory adapters at I/O boundaries; first-party fakes not `vi.mock`; hand-rolled mock subclasses for type seams; real `tmpdir()` not virtual FS; `vi.mock` as last resort.

**jact today:** `FileCache` and `ParsedFileCache` are the primary I/O boundary. No interface seam exists — production class imported directly. No in-memory adapter.

**Gaps:**
1. No interface seam for file-system I/O
2. No `InMemoryFileCache` adapter
3. `vi.mock` usage unknown — needs grep audit

**Phase assignment:** Extend existing Phase 2 Rework 2 — add "ship `InMemoryFileCache` adapter as test-default" to its scope.

**TDD sequence:** Write `InMemoryFileCache` adapter + one passing test first → then refactor `CitationValidator`/`ContentExtractor` to accept the interface.

---

### Vitest-Specific Conventions

%% *Last Modified: 05/13/26 12:41:50* %%

**Principle requires:** Minimal `vitest.config.ts`; `testTimeout: 30000`; `environment: "node"`; `globals: true` + explicit imports; `describe.skipIf` for env-gated tests; per-`it` retry only on live calls.

**jact today:** Standard Vitest scripts in `package.json`. No workspace setup needed. `setup.js` at test root — purpose unclear.

**Gaps:**
- (a) Audit `vitest.config.ts` for unnecessary blocks
- (b) Audit `setup.js`
- (c) Confirm `testTimeout: 30000`

**Phase assignment:** Phase 1 — "Vitest config audit" (read two files, decide)

**TDD sequence:** N/A (config hygiene)

---

### Test Quality Gates and Maintenance

%% *Last Modified: 05/13/26 12:41:50* %%

**Principle requires:** Tests run after type-check; no enforced coverage threshold; no global retry; tests-as-documentation; centralized cleanup helpers.

**jact today:** `type-check` and `test` scripts exist separately (no combined script). No coverage threshold (aligned). Cleanup patterns per-file.

**Gaps:**
- (a) No combined `check` script
- (b) No coverage baseline measured
- (c) Cleanup patterns may be duplicated

**Phase assignment:**
- Phase 1: Add combined `check` script (`package.json` edit, ≤5 min)
- Phase 1: Coverage baseline measurement (answers Open Q4, unblocks Rework 6)
- Phase 3 (deferred): Centralize cleanup helpers — trigger when ≥3 files duplicate same `afterEach`

**TDD sequence:** N/A for scripts/measurement.

---

## Recommendation

%% *Last Modified: 05/13/26 12:41:50* %%

**Integrate into existing phases. Do NOT create Phase T.**

Adding a separate testing phase creates a false seam — testing work is not independent of the structural reworks it gates or accompanies. Every gap maps cleanly onto existing phase semantics.

---

## Net Additions Summary

%% *Last Modified: 05/13/26 12:41:50* %%

### Phase 1 (Quick Wins — ≤30 min each)

%% *Last Modified: 05/13/26 12:41:50* %%

1. Anti-test audit pass (review ~5 type-shape test files, delete or justify)
2. BDD/AAA style audit (grep-based nesting and `beforeEach` check)
3. Vitest config audit (read `vitest.config.ts` + `setup.js`, decide on `testTimeout`)
4. Add combined `check` script to `package.json` (`tsc --noEmit && vitest run`)
5. Coverage baseline measurement (run `vitest --coverage`, record output, answers Open Q4)
6. Standing policy: opportunistic `.js` → `.ts` migration (migrate any test file touched during other work)

### Phase 2 (Named Reworks — ≥30 min)

%% *Last Modified: 05/13/26 12:41:50* %%

1. New Rework — "Contract Test Convention + Regressions Directory": establish `regressions/` dir, write `FileSystemInterface` faux, add first `Contract:` test, document convention
2. New Rework — "Test Suite Reorganization": migrate flat layout to mirrored `src/` structure, rename `helpers/` to `*-test-utils.ts`, create `scratch/` dir, delete `.archive` file (one commit per component group, suite green before next)
3. Extend existing Rework 2 scope: ship `InMemoryFileCache` adapter as test-default; refactor `CitationValidator`/`ContentExtractor` to accept interface

### Phase 3 (Deferred)

%% *Last Modified: 05/13/26 12:41:50* %%

1. Centralize cleanup helpers — trigger condition: ≥3 test files duplicate the same `afterEach` pattern

### Open Questions Resolved

%% *Last Modified: 05/13/26 12:41:50* %%

- **Open Q4** (coverage baseline before Rework 6): answered by Phase 1 coverage baseline measurement item.
