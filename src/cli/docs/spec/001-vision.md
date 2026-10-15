# 001. Vision

**Status:** done

This section states why the CLI layer exists, the principles it follows, and the guarantees callers rely on. Repository-wide principles live in [001. Vision](../../../../docs/spec/001-vision.md#001.%20Vision).

## Purpose

The CLI layer keeps every command-line concern in one place, so domain components stay free of arguments, printing, and exit codes. Scripts, hooks, and agents call `jact`; they depend on stable flags, help pages, and exit codes. The domain components in `src/core/` depend on none of these.

## Principles

Four principles decide where new CLI code goes.

| Principle | Meaning |
|---|---|
| **Register once** | `src/cli.ts` registers every command and flag; no other file creates a command |
| **Orchestrate apart** | `src/jact-cli.ts` runs commands without Commander, so tests and scripts import it alone |
| **Build in one place** | Production components come from `src/factories/componentFactory.ts`, with a replacement allowed for each dependency |
| **Help is a contract** | Each help page states the same flags, defaults, and exit codes as the repository interfaces section |

## What the CLI Layer Is Not

- Not domain logic: it never parses Markdown, checks a link, or plans a move
- Not a renderer of batch reports: `src/validate/` formats batch output
- Not a second contract: command meaning lives in [005. Interfaces](../../../../docs/spec/005-interfaces.md#005.%20Interfaces)

## CLI Guarantees

Callers rely on these six guarantees.

1. **Three exit codes.** Each command action ends with `0`, `1`, or `2`, as in [Exit Codes](../../../../docs/spec/005-interfaces.md#Exit%20Codes).
2. **Exit code, not exit.** Actions set the process exit code and return, so piped standard output drains before the process ends.
3. **Usage checks first.** Flag-conflict and argument checks in `validate` and `vault-link` run before any read or write.
4. **One component graph per run.** One orchestrator shares one file index and one parsed-document cache across its components.
5. **Help matches contract.** Each command help page ends with an `Exit Codes` block that matches the repository contract for that command.
6. **Safe printed commands.** Retry commands and hints quote document text, as in [Terminal Output Safety](../../../../docs/spec/005-interfaces.md#Terminal%20Output%20Safety).
