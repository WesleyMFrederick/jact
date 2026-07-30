# 010. Integrations

**Status:** done

Contracts between jact and the systems that embed it.

## Claude Code hook (primary integration)

A PostToolUse/PreToolUse hook runs `jact validate` on markdown writes. Contract:

- Input: file path (or `--stdin` content) + auto-inferred scope (`.git`/`package.json` walk-up from cwd)
- Output: exit 0 = allow; exit 1 = block with error list (line, broken link, suggestion) on stdout/stderr
- Stability requirement: error-message *shape* is parsed by humans-in-the-loop, but fix decisions must come from structured fields (`PathConversion`, `AnchorConversion`) — never from re-parsing suggestion strings (ADR: see [003 · ADRs](../adrs/003-adrs.md#003. ADRs))

## Agent workflows (orient-before-extract)

LLM sessions use jact as a context tool: `jact ast <file>` (heading shape) → `jact extract header <file> "Section"` (narrow slice). Contract: markdown files only — non-`.md` input is out of contract (returns empty/garbage rather than erroring; documented ground rule in repo CLAUDE.md).

## npm global link

`npm link` exposes `jact` on `$PATH`; `package.json` `main` points at `dist/jact-cli.js`. After source changes the binary runs stale `dist/` until `npm run build` — e2e checks must rebuild first.

## AppMap (runtime traces, dev-time)

`npx appmap-node npx vitest run <test>` captures call traces to `tmp/appmap/` (gitignored); read with `appmap-read --zoom L0|L1|L2`. Config: `appmap.yml`.
