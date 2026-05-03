# Clean Design Doc Fixture

%% *Last Modified: 05/03/26 12:39:25* %%

Used by C3 baseline assertion (defer-language scan exits 0).

## Architecture

%% *Last Modified: 05/03/26 12:39:25* %%

Component A talks to Component B via injected dep. All wiring required, no optional dep without escape-hatch.

## Risks

%% *Last Modified: 05/03/26 12:39:25* %%

- Risk R1: parser fails on edge case Q. Mitigation: adversarial fixture covering CommonMark §4.5.
- Risk R2: callgraph drift. Mitigation: D3 gate runs at pre-commit.

## Done When

%% *Last Modified: 05/03/26 12:39:25* %%

All gates green; reviewer verdict SHIP.
