# test/regressions/

%% *Last Modified: 05/13/26 19:31:40* %%

Bug-fix regression tests that prevent known bugs from returning silently.

## Naming Convention

%% *Last Modified: 05/13/26 19:31:40* %%

```
<issue-number>-<short-slug>.test.ts
```

Examples:
- `37-enrichLinkObject-immutability.test.ts` — issue #37, `enrichLinkObject` mutated the original `LinkObject` in-place.
- `99-some-other-bug.test.ts` — issue #99, short description of the bug.

## Purpose

%% *Last Modified: 05/13/26 19:31:40* %%

When a bug is fixed, the reproducer becomes a permanent test here. The issue number in the filename traces back to the original GitHub issue without opening the file. Future bisects find this test before the fix; the bug cannot silently return.

## Rules

%% *Last Modified: 05/13/26 19:31:40* %%

- Every file in this directory corresponds to exactly one GitHub issue.
- The test must reproduce the original failure mode (it would have failed BEFORE the fix).
- Tests here run as part of the normal `npm test` suite — they are not skipped.
- Do NOT add tests here for new features. Only proven past bugs belong here.

## Source

%% *Last Modified: 05/13/26 19:31:40* %%

Testing Principles §Test Organization and Sprawl Prevention — `^test-regression-filename-convention`
Testing Principles §Test Scope and Targets — `^test-regressions-promoted`
