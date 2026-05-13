# jact Phase 1 Quick-Win Issues

%% *Last Modified: 05/13/26 13:04:46* %%

Created: 2026-05-13

| # | Title | URL |
|---|---|---|
| #30 | refactor(citation-validator): move computeValidationSummary out of CitationValidator into its own module | https://github.com/WesleyMFrederick/jact/issues/30 |
| #32 | refactor(types): remove duplicate PathConversion interface from jact.ts | https://github.com/WesleyMFrederick/jact/issues/32 |
| #34 | refactor(types): consolidate CliValidateOptions — jact.ts shadow has diverged from canonical | https://github.com/WesleyMFrederick/jact/issues/34 |
| #36 | refactor(types): move HeaderObject and FixRecord from jact.ts into validationTypes | https://github.com/WesleyMFrederick/jact/issues/36 |
| #38 | refactor(jact-cli): replace link:any in applyAnchorFix with EnrichedLinkObject | https://github.com/WesleyMFrederick/jact/issues/38 |
| #39 | refactor(jact-cli): replace dynamic await import(node:path) with static top-level import | https://github.com/WesleyMFrederick/jact/issues/39 |
| #40 | refactor(parsed-document): mark _tokenIncludesChildrenInRaw as private | https://github.com/WesleyMFrederick/jact/issues/40 |
| #41 | refactor(types): rename ValidationMetadata warning variant field error to message | https://github.com/WesleyMFrederick/jact/issues/41 |
| #42 | refactor(extraction-strategy): eliminate concrete default in ExtractionStrategy base class | https://github.com/WesleyMFrederick/jact/issues/42 |
| #43 | refactor(content-extractor): replace noUncheckedIndexedAccess cast sites with null guards | https://github.com/WesleyMFrederick/jact/issues/43 |
| #44 | refactor(citation-validator): replace forced status cast with narrowing conditionals | https://github.com/WesleyMFrederick/jact/issues/44 |
| #45 | refactor(jact-cli): extract formatting methods out of JactCli into formatValidationResult module | https://github.com/WesleyMFrederick/jact/issues/45 |
| #46 | refactor(jact-cli): extract fix-application helpers from JactCli into citationFixer module | https://github.com/WesleyMFrederick/jact/issues/46 |
| #59 | test(audit): identify and delete anti-test assertions that duplicate tsc type-checking — Source: Testing Principles §Anti-Test Targets | https://github.com/WesleyMFrederick/jact/issues/59 |
| #60 | test(audit): verify BDD/AAA style conformance — nesting depth and beforeEach usage — Source: Testing Principles §Authoring Style | https://github.com/WesleyMFrederick/jact/issues/60 |
| #62 | test(config): audit vitest.config.ts and setup.js for minimal-config conformance — Source: Testing Principles §Vitest Conventions | https://github.com/WesleyMFrederick/jact/issues/62 |
| #63 | test(scripts): add combined check script that runs type-check then test in sequence — Source: Testing Principles §Quality Gates | https://github.com/WesleyMFrederick/jact/issues/63 |
| #64 | test(coverage): measure and record coverage baseline to unblock Phase 2 Rework 6 — Source: Testing Principles §Quality Gates | https://github.com/WesleyMFrederick/jact/issues/64 |

## Standing Policy

%% *Last Modified: 05/13/26 13:04:46* %%

**Opportunistic `.js` → `.ts` test migration:** Each PR that touches a `.js` test file migrates it to `.test.ts`. Do not batch. Confirm suite green before and after each migration.
