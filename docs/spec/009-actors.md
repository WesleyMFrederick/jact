# 009. Actors

**Status:** done

Who (and what) interacts with jact, and how their needs differ.

| Actor | Interaction | What they need |
|---|---|---|
| **Human developer** | Direct CLI (`jact validate`, `jact ast`) in a vault or code repo | Readable CLI output, actionable fix suggestions, exit codes for scripting |
| **LLM agent (Claude Code session)** | `jact ast` to orient on a markdown file, `jact extract header` for narrow context slices, `jact validate --stdin` | JSON output (`--format json`), deterministic exit codes, token-lean extraction (orient-before-extract workflow) |
| **PostToolUse hook** | Auto-runs `jact validate` after every Write/Edit on `.md` files | Fast single-file validation, stdin mode, exit code 1 with parseable error list to block bad writes |
| **Batch/CI scripts** | Batch validation over changed or selected files | File-selection flags, aggregate reporting, exit-code contract (0/1/2 — see [Exit Codes](005-interfaces.md#Exit Codes)) |

Actor-driven constraints: output must stay dual-mode (human text + `--format json`); exit codes are API surface (hooks depend on them); single-file validation latency matters more than batch throughput (hook on every save).
