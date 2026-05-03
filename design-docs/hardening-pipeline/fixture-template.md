# Hardening Pipeline — Fixture Template

%% *Last Modified: 05/03/26 13:04:22* %%

Reusable pattern for any plan needing service-level smoke tests + adversarial input coverage. Reference this doc from your plan; do not re-derive.

## Service-Level Smoke Format

%% *Last Modified: 05/03/26 13:04:22* %%

Canonical shape for D4 service-level fixtures:

```
test/fixtures/<feature-name>/<scenario>.md
```

Each fixture pairs with an **expected-output JSON** asserting:

- Counts: `byClassification.<type>.valid >= N`, `.invalid <= M`
- Loud-fail format: error messages include `Tried: <attempt-1>, <attempt-2>` (no silent drops)
- Cross-cutting: source location (`file:line`) preserved in every emitted record

Reference fixture (live): `test/fixtures/wikilink-baseline/probabilistic-vs-deterministic-systems.md`.

## Adversarial CommonMark Set

%% *Last Modified: 05/03/26 13:04:22* %%

Every markdown-lexer change MUST pass the following adversarial cases before any prod callsite changes land:

| ID | CommonMark Section | Edge Case |
|----|--------------------|-----------|
| AC1 | §4.5 (Fenced code blocks) | Triple-backtick on same line as inline single-backtick span |
| AC2 | §4.5 | Fenced block opened with N backticks, closed with M > N |
| AC3 | §4.5 | Indented code block adjacent to fenced block |
| AC4 | §6.1 (Backslash escapes) | Escaped backtick inside potential code span |
| AC5 | §6.1 | Backslash before whitespace at end-of-line |
| AC6 | §6.5 (Code spans) | Multi-backtick span spanning a wiki link |

Place these under `test/fixtures/adversarial-commonmark/<AC-id>.md` with paired expected JSON.

## How Future Plans Adopt

%% *Last Modified: 05/03/26 13:04:22* %%

In your plan file, reference this template instead of re-deriving:

```
## Test Fixtures
Format: see `design-docs/hardening-pipeline/fixture-template.md`.
- Service-level smoke: `test/fixtures/<my-feature>/baseline.md`
- Adversarial CommonMark: cases AC1–AC6 from template apply; add feature-specific AC7+ below.
```

Future plans add domain-specific AC entries; they do NOT re-state AC1–AC6.

## Lint Compliance

%% *Last Modified: 05/03/26 13:04:22* %%

This template MUST pass `bash scripts/defer-language-scan.sh`. Verify before commit.
