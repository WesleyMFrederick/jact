# jact Phase 2 — Architectural Reworks: Issue Summary

%% *Last Modified: 05/13/26 09:04:41* %%

Created: 2026-05-13

| # | Title | URL | Depends On | Effort |
|---|-------|-----|------------|--------|
| #28 | refactor(citation-validator): extract PathResolver and AnchorMatcher from CitationValidator | https://github.com/WesleyMFrederick/jact/issues/28 | none (independent) | 3–4 hrs |
| #29 | refactor(jact-cli): extract CliFormatter, CitationFixer, and CLI wiring from JactCli | https://github.com/WesleyMFrederick/jact/issues/29 | Phase 1 items 12+13 | 2–3 hrs |
| #31 | refactor(citation-fixer): add backup and dry-run to fix path before public release | https://github.com/WesleyMFrederick/jact/issues/31 | #29 | 1–2 hrs |
| #33 | refactor(citation-validator): move CitationValidator to src/core/ subfolder | https://github.com/WesleyMFrederick/jact/issues/33 | #28 (same PR) | 30 min |
| #35 | refactor(component-factory): replace concrete-class coupling with shared component interfaces | https://github.com/WesleyMFrederick/jact/issues/35 | #28, #33 | 1 hr |
| #37 | refactor(citation-validator): eliminate in-place LinkObject mutation with enrichLinkObject factory | https://github.com/WesleyMFrederick/jact/issues/37 | #28 + ≥80% coverage gate | 2 hrs |

## Sequencing Graph

%% *Last Modified: 05/13/26 09:04:41* %%

```
Phase 1 items 12+13
       ↓
      #29 (JactCli split)
       ↓
      #31 (backup + dry-run)   [release blocker for --fix]

#28 (CitationValidator split)  [independent, highest impact]
 ├──→ #33 (folder move, same PR)
 │     └──→ #35 (factory interfaces)
 └──→ #37 (LinkObject mutation) [deferred: needs ≥80% coverage]
```

## Labels Applied Per Issue

%% *Last Modified: 05/13/26 09:04:41* %%

| Issue | Labels |
|-------|--------|
| #28 | phase-2, type:architecture, tech-debt, component:CitationValidator, priority:high |
| #29 | phase-2, type:architecture, tech-debt, component:JactCli, priority:high |
| #31 | phase-2, type:architecture, tech-debt, component:JactCli, priority:high |
| #33 | phase-2, type:architecture, tech-debt, component:CitationValidator, priority:medium |
| #35 | phase-2, type:architecture, tech-debt, component:componentFactory, component:CitationValidator, priority:medium |
| #37 | phase-2, type:architecture, tech-debt, component:CitationValidator, priority:low |

## Notes

%% *Last Modified: 05/13/26 09:04:41* %%

- Issue numbers #30, #32, #34, #36 were not created by this task (other repo activity between commands)
- All "blocked by #TBD" placeholders in Related sections use actual issue numbers above
- Epic cross-linking (Task 3) should update Related sections with real #numbers
