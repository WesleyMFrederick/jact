---
last_verified: 2026-11-19
verified_by: agent
---
# test/regressions/

Bug-fix regression tests that prevent known bugs from returning silently.

## Naming Convention

```
<issue-number>-<short-slug>.test.ts
```

Examples:
- `37-enrichLinkObject-immutability.test.ts` — issue #37, `enrichLinkObject` mutated the original `LinkObject` in-place.
- `99-some-other-bug.test.ts` — hypothetical issue #99, short description of the bug.

## Purpose

When a bug is fixed, the reproducer becomes a permanent test here. The issue number in the filename traces back to the original GitHub issue without opening the file. Future bisects find this test before the fix; the bug cannot silently return.

## Rules

- Every file in this directory corresponds to exactly one GitHub issue.
- The test must reproduce the original failure mode (it would have failed BEFORE the fix).
- Tests here run as part of the normal `npm test` suite — they are not skipped.
- Do NOT add tests here for new features. Only proven past bugs belong here.

## Source

- Naming convention: [007 · Directory Layout (`test/`)](../../docs/spec/007-testing.md#Directory%20Layout%20%28%60test/%60%29) records the `<issue-number>-<short-slug>.test.ts` rule for this folder.
- The other rules (one issue per file, fails before the fix) come from the maintainer's Testing Principles (§Test Organization and Sprawl Prevention `^test-regression-filename-convention`; §Test Scope and Targets `^test-regressions-promoted`). That document lives in a private principles repository, so it cannot be followed from a clone. Tracked example of the rules in practice: `test/regressions/37-enrichLinkObject-immutability.test.ts`, which covers [issue #37](https://github.com/WesleyMFrederick/jact/issues/37).
