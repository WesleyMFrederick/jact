# 010. Integrations

**Status:** done

jact connects to four outside systems: editor hooks, AI agent sessions, the npm global link, and the npm release workflow. Each section states the contract that system relies on.

## Claude Code hook (primary integration)

An editor hook runs `jact validate` on each Markdown write. Contract:

- Input: a file path, or `--stdin` content with its intended path. jact infers the scope by walking up from the working folder to `.git` or `package.json`.
- Output: exit 0 allows the write; exit 1 blocks it. The error list (line, link, error, suggestion) goes to standard output.
- Machine data: a caller that acts on a fix reads the `pathConversion` and `anchorConversion` fields of `--format json` output. It never parses the human `suggestion` text, which can change.

## Agent workflows (orient-before-extract)

AI agent sessions use jact as a context tool: `jact outline <file>` shows the heading tree, then `jact extract header <file> "Section"` returns one section. Contract:

- Input is Markdown only. A non-`.md` file returns an empty result with exit 0, not an error.
- `jact outline` prints its next-step reminders once per session, file, and file content when `JACT_SESSION_ID` or `CLAUDE_SESSION_ID` is set. `--cache-reset` shows them again.
- `jact extract links --session <id>` skips extraction when that session already extracted the same file content.
- Both session caches live in `.jact/claude-cache` under the working folder.

## npm global link

The global `jact` on `$PATH` is an `npm link` symlink (package `@wesleymfrederick/jact`) into the canonical `main` checkout's `bin/jact.js`, which loads that checkout's `dist/cli.js`. Contract:

- The tracked `.githooks/post-merge` hook handles merges and fast-forward pulls. The tracked `.githooks/post-commit` hook handles commits, including completed conflict merges. Both call `scripts/refresh-global-cli.sh --hook`, so changes landing on canonical `main` synchronize dependencies, rebuild `dist/`, and refresh the link with no user action.
- `scripts/refresh-global-cli.sh` is the only operation that builds-and-links. It derives the canonical root from the absolute git common dir and proceeds only when the invoking worktree *is* that root and its `HEAD` is `main`. Hook-mode invocation elsewhere prints a skip and exits 0; direct invocation (`npm run global:link`) elsewhere is refused with a nonzero exit.
- The script installs with `npm ci --ignore-scripts`, so dependency install scripts never run. `npm run build` deletes `dist/` and `tsconfig.tsbuildinfo` before it compiles, so an edited or deleted output file cannot survive a refresh. The script moves the old `node_modules/` and `dist/` to a backup first. If the install or build fails, it restores only the paths that it moved.
- Before linking, the script removes a legacy `jact` global entry when it is a symlink (left by the pre-rename package name), so `bin/jact` does not collide with `EEXIST`. A registry-installed `jact` is left alone. It links with `--ignore-scripts` because `dist/` is already built.
- Paseo worktree setup points `core.hooksPath` at the source checkout's `.githooks` directory, then installs and builds inside the worktree. It never runs `npm link`.
- Branch-specific CLI checks run `node ./dist/cli.js` in the feature worktree; the global command always reflects canonical `main`.

## npm release

Only the `.github/workflows/release.yml` workflow publishes the package. Contract:

- A published GitHub release starts the workflow. The job runs in the `npm-publish` environment, so a required reviewer can hold the publish.
- The job fails unless the release tag equals `v` plus the `package.json` version. It then uses a fresh checkout, `npm ci --ignore-scripts`, a clean build, a type check, the tests, full and production audits, a signature audit, and `scripts/smoke-pack.sh`.
- The job publishes through npm trusted publishing (OpenID Connect). No npm token is stored in the repository. The package carries npm provenance.
- `scripts/smoke-pack.sh` packs the built package, allows only `bin/`, `dist/`, `package.json`, `README*`, and `LICENSE*`, rejects source maps with embedded source and `/Users/` paths, installs the tarball with scripts off, and runs `--version`, `--help`, `validate`, and `outline`.

## AppMap (runtime traces, dev-time)

`npx appmap-node npx vitest run <test>` captures call traces to `tmp/appmap/` (gitignored); read with `appmap-read --zoom L0|L1|L2`. Config: `appmap.yml`.
