# 009. Actors

**Status:** done

Four actors use jact: people, AI agents, editor hooks, and batch scripts. Their needs make text output, JSON output, and exit codes stable contracts.

| Actor | Interaction | What they need |
|---|---|---|
| **Human developer** | Runs `jact validate`, `jact outline`, and `jact rename` in a note vault or code repository | Readable output, fix suggestions, and exit codes for scripts |
| **AI agent (large language model, LLM, session)** | Runs `jact outline` to see a file's headings, `jact extract header` for one section, and `jact validate --stdin` for unsaved text | JSON output (`--format json`), stable exit codes, and small extracts |
| **Editor hook** | Runs `jact validate` after each write or edit of a `.md` file | Fast single-file checks, standard-input mode, and exit code 1 with an error list that blocks a bad write |
| **Batch and continuous integration (CI) scripts** | Run `jact validate` over selected or git-changed files | File selection flags, one summary, one JSON Lines (JSONL) object per file (`--json`), and the exit code contract in [Exit Codes](005-interfaces.md#Exit%20Codes) |

These needs set three constraints:

- Output has two modes: human text and JSON.
- Exit codes are part of the public interface, because hooks act on them.
- Single-file speed matters more than batch throughput, because a hook runs on every save.
