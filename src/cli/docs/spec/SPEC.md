# `src/cli` Living Specification

**Version:** 1.1.0
**Status:** done

The command-line interface (CLI) layer turns a `jact` command line into calls on the domain components, then prints the result and sets the exit code. It spans `src/cli.ts`, `src/jact-cli.ts`, and `src/factories/`. Command contracts live in the [jact Living Specification](../../../../docs/spec/SPEC.md#jact%20Living%20Specification).

---

## Constitution

This module spec is the source of truth for what the CLI layer owns, guarantees, and must not do. It serves contributors who add or change a command and reviewers who check a pull request (PR) against it. The repository spec keeps flags, output shapes, and exit-code meanings; this spec links to them.

### Spec Location

The spec lives in `src/cli/docs/spec/` because no single source folder holds the whole layer.

| Option | Verdict | Reason |
|---|---|---|
| `src/cli/docs/spec/` | chosen | Follows the `src/<module>/docs/spec/` pattern; the name matches the entry file `src/cli.ts` |
| `src/factories/docs/spec/` | rejected | Would describe two entry files from a folder that does not hold them |
| `docs/spec/` | rejected | The repository spec holds contracts, not layer ownership |

The module-spec hook maps a source path to its top-level `src/` entry. A read of `src/cli.ts` therefore does not load this spec; the root module-spec table links here instead.

### Spec Governance

Five rules keep this module spec canonical and small.

| Rule | Description |
|---|---|
| **Canonical** | When CLI code and this spec differ, the spec is the target; fix the code or update the spec in the same PR |
| **Living** | A PR that adds a command, flag, help section, or exit path updates this spec in the same PR |
| **Layered** | A fact that the repository spec holds gets one link here, never a copy |
| **Grounded** | Each claim is checked against `src/cli.ts`, `src/jact-cli.ts`, and `src/factories/` |
| **Versioned** | Each change adds a version row; a removed guarantee is a major version change |

### Spec Sections

Three sections hold layer facts; the other topics live in the repository spec.

| # | Section | Status | Description |
|---|---|:---:|---|
| 001 | [Vision](001-vision.md#001.%20Vision) | done | What the layer is, its principles, and its guarantees |
| 002 | [Architecture](002-architecture.md#002.%20Architecture) | done | The four files, their guarantees, and their boundaries |
| 005 | [Interfaces](005-interfaces.md#005.%20Interfaces) | done | Command-to-code map and the help-text contract |
| — | ADRs | N/A | Repository ADRs cover CLI decisions |
| — | Domain model | N/A | `src/types/` owns the option and result types |
| — | Behavior | N/A | Repository behavior section owns workflow order |
| — | Testing | N/A | Repository testing section owns conventions |

---

## Quick Reference

These summaries show what the CLI layer is, is not, and guarantees.

### What the CLI Layer Is

- The **command registry** (`src/cli.ts`): every command, flag, help page, and exit code
- The **orchestrator** (`src/jact-cli.ts`): scope setup and command runs against shared components
- The **component factory** (`src/factories/componentFactory.ts`): the one place that builds production components
- The **synthetic link factory** (`src/factories/LinkObjectFactory.ts`): a link built from `extract header` and `extract file` arguments

### What the CLI Layer Is Not

- Not a parser, checker, or extractor: `src/core/` owns that logic
- Not the batch engine: `src/validate/` selects, runs, and renders batch validation
- Not a type owner: `src/types/` holds the option and result shapes

### CLI Guarantees

The vision section defines the layer guarantees.
See [CLI Guarantees](001-vision.md#CLI%20Guarantees).

---

## Version History

Each row records one version of this module spec.

| Version | Changes |
|---|---|
| 1.0.0 | 2026-10-11: Initial module spec for the CLI layer |
| 1.1.0 | 2026-10-11: `vault-link --all` no longer writes the note itself; the core vault link fixer applies the plan |
