# Clean Plan Fixture

%% *Last Modified: 05/03/26 12:39:17* %%

Used by C2 (plan-eval clean baseline) + C3 (defer-language scan).

## Goal

%% *Last Modified: 05/03/26 12:39:17* %%

Ship the X feature in current PR. All work in scope.

## Hard Gates

%% *Last Modified: 05/03/26 12:39:17* %%

- D1: AST-selector ban on optional injectable deps; escape-hatch via inline comment.
- D2: Dead-field scan via ts-morph `findReferences` ≥ 1 prod consumer.
- D3: Callgraph trace from `src/jact.ts` reaches every new public fn.

## Acceptance

%% *Last Modified: 05/03/26 12:39:17* %%

All gates green at commit. Reviewer verdict = SHIP.

## Notes

%% *Last Modified: 05/03/26 12:39:17* %%

Pre-existing bug surfaced by this diff: fixed in this PR per project policy.
