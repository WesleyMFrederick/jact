# 010. Integrations

**Status:** done

Contracts between jact and the systems that embed it.

## Claude Code hook (primary integration)

A PostToolUse/PreToolUse hook runs `jact validate` on markdown writes. Contract:

- Input: file path (or `--stdin` content) + auto-inferred scope (`.git`/`package.json` walk-up from cwd)
- Output: exit 0 = allow; exit 1 = block with error list (line, broken link, suggestion) on stdout/stderr
- Stability requirement: error-message *shape* is parsed by humans-in-the-loop, but fix decisions must come from structured fields (`PathConversion`, `AnchorConversion`) — never from re-parsing suggestion strings (ADR: see [003 · ADRs](../adrs/003-adrs.md#003. ADRs))

## Agent workflows (orient-before-extract)

LLM sessions use jact as a context tool: `jact outline <file>` (heading shape) → `jact extract header <file> "Section"` (narrow slice). Contract: markdown files only — non-`.md` input is out of contract (returns empty/garbage rather than erroring; documented ground rule in repo CLAUDE.md).

## npm global link

The global `jact` on `$PATH` is an `npm link` symlink (package `@wesleymfrederick/jact`) into the canonical `main` checkout's `bin/jact.js`, which loads that checkout's `dist/cli.js`. Contract:

- The tracked `.githooks/post-merge` hook handles merges and fast-forward pulls. The tracked `.githooks/post-commit` hook handles commits, including completed conflict merges. Both call `scripts/refresh-global-cli.sh --hook`, so changes landing on canonical `main` synchronize dependencies, rebuild `dist/`, and refresh the link with no user action.
- `scripts/refresh-global-cli.sh` is the only operation that builds-and-links. It derives the canonical root from the absolute git common dir and proceeds only when the invoking worktree *is* that root and its `HEAD` is `main`. Hook-mode invocation elsewhere prints a skip and exits 0; direct invocation (`npm run global:link`) elsewhere is refused with a nonzero exit.
- Before linking, the script removes a legacy `jact` global entry when it is a symlink (left by the pre-rename package name), so `bin/jact` does not collide with `EEXIST`. A registry-installed `jact` is left alone. It links with `--ignore-scripts` because `dist/` is already built.
- Paseo worktree setup only points `core.hooksPath` at the canonical `.githooks` directory; it never links.
- Branch-specific CLI checks run `node ./dist/cli.js` in the feature worktree; the global command always reflects canonical `main`.

## AppMap (runtime traces, dev-time)

`npx appmap-node npx vitest run <test>` captures call traces to `tmp/appmap/` (gitignored); read with `appmap-read --zoom L0|L1|L2`. Config: `appmap.yml`.
