# Todo: LLM-Optimized Default Output for `jact validate`

%% *Last Modified: 04/29/26 23:22:49* %%

## Phase 1: Define ✅

%% *Last Modified: 04/29/26 23:22:49* %%

*Intent → measurable criteria*

- [x] Write goal statement (`plan.md ## Goal`)
- [x] Define success criteria (`success-criteria.yaml` — SC-1 through SC-7)
- [x] Define hard constraints (`constraints.yaml` — C-H1 through C-H4)
- [x] Define soft constraints (`constraints.yaml` — C-S1, C-S2)

---

## Phase 2: Tests ✅

%% *Last Modified: 04/29/26 23:35:17* %%

*Encode success criteria as measurement instruments — write BEFORE implementation*

- [x] Add new test: clean file → exact `OK: N citations valid` (asserts SC-1)
- [x] Add new test: broken file → `ERRORS (` + `FAILED:` present, `VALID CITATIONS` + `SUMMARY:` absent (asserts SC-2)
- [x] Update `test/validation.test.js` lines 23, 44, 306 → add `--verbose` OR rewrite for SC-1/SC-2 contract
- [x] Update `test/cli-warning-output.test.js` lines 68, 89, 112-129, 179 → add `--verbose` (keeps SC-3 coverage)
- [x] Update `test/cli-execution-detection.test.js:61-62` → assert `OK:` default OR add `--verbose`
- [x] Run `npm test` — confirm RED (8 failures, 3 files — correct)

---

## Phase 3: Test Outcomes ✅

%% *Last Modified: 04/30/26 00:14:30* %%

*Controlled environment: make tests GREEN*

### 3a. Core implementation

%% *Last Modified: 04/30/26 00:14:30* %%

- [x] Add `verbose?: boolean` to `CliValidateOptions` (`src/jact.ts:64-69`)
- [x] Refactor `formatForCLI` (`src/jact.ts:312`) — branch on `verbose`; false = minimal; true = current byte-for-byte
- [x] Thread `verbose` through `validate()` (`src/jact.ts:180-227`) into both `formatForCLI` calls

### 3b. CLI + FileCache wiring

%% *Last Modified: 04/30/26 00:14:30* %%

- [x] Add `--verbose` option to commander (`src/jact.ts:1075-1107`)
- [x] Update `addHelpText` block with new default-output docs and `--verbose` example
- [x] Add `verbose` param to `FileCache.buildCache()` (`src/FileCache.ts`) — gates WARNING on verbose
- [x] Pass `options.verbose` from `JactCli.validate()` into `buildCache()` call

### 3c. Build + test pass

%% *Last Modified: 04/30/26 00:14:30* %%

- [x] `npm run build`
- [x] `npm test` — 435/435 GREEN

---

## Phase 4: Operational Outcomes ✅

%% *Last Modified: 04/30/26 00:14:30* %%

*Real invocations against real files*

- [x] Clean file → `OK: 69 citations valid` (23 bytes) — asserts SC-1
- [x] `--verbose` → full banner + VALID CITATIONS tree + SUMMARY — asserts SC-3
- [x] Broken fixture → ERRORS block only, no VALID CITATIONS — asserts SC-2
- [x] `--format json` → same JSON shape — asserts SC-4
- [x] Exit codes: 0 (clean), 1 (errors), 2 (nonexistent file) — asserts SC-5
- [x] Token count: 23 bytes (target: <100) — asserts SC-7 ✅

---

## Phase 5: Real-World Outcomes ✅

%% *Last Modified: 04/30/26 00:14:30* %%

*Documentation for production use*

- [x] Update `--help` example block to document `--verbose` and new default behavior
- [x] `npm run build` final
