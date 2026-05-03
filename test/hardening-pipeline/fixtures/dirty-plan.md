# Dirty Plan Fixture

%% *Last Modified: 05/03/26 12:39:22* %%

Used by C2 (plan-eval dirty trigger) + C3 (defer-language scan FAIL) + C5 (residual replay).

## Goal

%% *Last Modified: 05/03/26 12:39:22* %%

Ship X feature minimal scope.

## Phase 5 Follow-up

%% *Last Modified: 05/03/26 12:39:22* %%

- Bug Y is out of scope this phase, deferred to plan-03.
- Z refactor is non-blocking, will address as tech debt later.
- Cleanup of duplicate utility module — follow-up after this lands.

## Hypothesis

%% *Last Modified: 05/03/26 12:39:22* %%

If parser correctly handles wiki links, then validator output will match.

(No falsification condition specified — Type 1 hypothesis unfalsified.)

## Acceptance

%% *Last Modified: 05/03/26 12:39:22* %%

Reviewer can ship with caveats noted in §"Known Issues".
