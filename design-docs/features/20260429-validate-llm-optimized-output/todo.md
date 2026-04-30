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

## Phase 3: Test Outcomes

%% *Last Modified: 04/29/26 23:22:49* %%

*Controlled environment: make tests GREEN*

### 3a. Core implementation

%% *Last Modified: 04/29/26 23:22:49* %%

- [ ] Add `verbose?: boolean` to `CliValidateOptions` (`src/jact.ts:64-69`)
- [ ] Refactor `formatForCLI` (`src/jact.ts:312`) — branch on `verbose`; false = minimal; true = current byte-for-byte
- [ ] Thread `verbose` through `validate()` (`src/jact.ts:180-227`) into both `formatForCLI` calls

### 3b. CLI + FileCache wiring

%% *Last Modified: 04/29/26 23:22:49* %%

- [ ] Add `--verbose` option to commander (`src/jact.ts:1075-1107`)
- [ ] Update `addHelpText` block with new default-output docs and `--verbose` example
- [ ] Add `verbose?: boolean` to `FileCache` constructor (`src/FileCache.ts:108-112`)
- [ ] Wrap duplicate WARNING in `if (this.verbose)` 
- [ ] Update `componentFactory.ts` `createFileCache` to accept + forward `verbose`
- [ ] Pass `options.verbose` from `JactCli.validate()` into factory call

### 3c. Build + test pass

%% *Last Modified: 04/29/26 23:22:49* %%

- [ ] `npm run build`
- [ ] `npm test` — all GREEN

---

## Phase 4: Operational Outcomes

%% *Last Modified: 04/29/26 23:22:49* %%

*Real invocations against real files*

- [ ] Clean file → `OK: N citations valid` (one line, no warnings) — asserts SC-1
- [ ] `--verbose` → full banner + VALID CITATIONS tree + SUMMARY — asserts SC-3
- [ ] Broken fixture → ERRORS block only, no VALID CITATIONS — asserts SC-2
- [ ] `--format json` → same JSON shape — asserts SC-4
- [ ] Exit codes: 0 (clean), 1 (errors), 2 (nonexistent file) — asserts SC-5
- [ ] Token count: `jact validate <clean-file> --scope <scope> | wc -c` < 100 bytes — asserts SC-7

---

## Phase 5: Real-World Outcomes

%% *Last Modified: 04/29/26 23:22:49* %%

*Documentation for production use*

- [ ] Update `--help` example block (`src/jact.ts:1095-1106`) to document `--verbose` and new default behavior
- [ ] `npm run build` final
