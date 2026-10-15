# 002. Architecture

**Status:** done

This section maps the four files of the CLI layer, the one job each owns, and the boundaries between them. The repository architecture describes the layer from outside; this section adds file ownership and the paths that skip the orchestrator.

## System Overview

The command registry routes most commands through the orchestrator, which builds its components through the factory. Batch validation and `vault-link` skip the orchestrator. Repository view: [Layer Boundaries](../../../../docs/spec/002-architecture.md#Layer%20Boundaries).

```
jact <command> [args]
  │
  ▼
src/cli.ts ── command registry: usage checks, help pages, exit codes, extract output
  │
  ├─ validate (one file), rename, outline, ast, extract ──► src/jact-cli.ts ── orchestrator
  │                                                           │
  │                                                           ├─► componentFactory.ts ──► core components, caches
  │                                                           └─► LinkObjectFactory.ts (extract header, extract file)
  │
  ├─ validate (batch), validate --fix recheck ─► componentFactory.ts ─► src/validate/ workflow
  │                                             src/validate/ batch runner and renderers
  │
  └─ vault-link ─► src/core/ vault link fixer; componentFactory.ts parser for --all
```

---

## Components

Each file owns one job and states the guarantees callers rely on.

### `src/cli.ts` — command registry

The command registry declares each command with Commander, checks usage, calls the orchestrator or a workflow, and sets the exit code. Repository view: [CLI Orchestrator: `src/cli.ts` + `src/jact-cli.ts`](../../../../docs/spec/002-architecture.md#CLI%20Orchestrator%20%60src/cli.ts%60%20+%20%60src/jact-cli.ts%60).

- **Synonym hints.** An unknown command or flag that is a known synonym, such as `check` or `json`, prints the real name.
- **Configuration before checks.** `validate` loads rule configuration for every selected file before it checks any file.
- **Shared flag text.** Every `--scope` flag uses one description; the three `extract` commands share one `-v, --verbose` description.
- **Extract output.** The registry formats `extract` results, prints the content map above `--max-chars`, and owns the `extract links --session` cache.

Boundary: the registry holds no parse, check, or move logic. It builds components only through the factory; the vault link fixer has no factory method, so `vault-link` creates it directly and, on `--all`, hands the plan back to the fixer under the [note recovery contract](../../../../docs/spec/005-interfaces.md#Writing%20the%20note). The registry reports the retained recovery path before the per-link output and summary.

### `src/jact-cli.ts` — orchestrator

The orchestrator runs one command against components that its constructor builds, and returns text or an outcome object.

- **One shared graph.** The constructor builds one file index and one parsed-document cache. The checker, extractor, linked-context query, and validate workflow share them.
- **Scope before lookup.** The orchestrator prepares scope before it resolves a target file by name. Order: [Scope Resolution Order](../../../../docs/spec/006-behavior.md#Scope%20Resolution%20Order).
- **Extract exit codes.** The three `extract` runs set exit `1` or `2` themselves for content and system failures.
- **No Commander.** The file imports no command parser. Its default rule set is empty, so a programmatic `validate` applies no preset rules.

Boundary: the orchestrator prints scope notices and extraction errors, but never registers a command or reads command-line arguments.

### `src/factories/componentFactory.ts` — component factory

The component factory builds each production component and accepts a replacement for every dependency. Repository view: [Component Factory (`src/factories/`)](../../../../docs/spec/002-architecture.md#Component%20Factory%20%28%60src/factories/%60%29).

- **Optional inputs.** Every argument has a production default, so a caller with no arguments gets a working component.
- **Interface inputs.** The checker accepts cache interfaces, so tests pass fakes; the other builders take the concrete cache classes.
- **Default backlink filter.** The linked-context query gets the production backlink filter unless the caller passes one.

Boundary: the factory wires components; it holds no parse, check, or extraction logic and keeps no state between calls.

### `src/factories/LinkObjectFactory.ts` — synthetic link factory

The synthetic link factory builds one link object from the `extract header` or `extract file` arguments, so the checker treats it like a parsed link.

- **Header link.** An empty target path or heading text is refused; the link anchors to the heading.
- **File link.** The link has no anchor, so extraction takes the whole file.
- **Command-line origin.** The link's source is the working folder at line 0, column 0, with no extraction marker.

Boundary: the factory only builds the object. The checker validates it, and only the orchestrator calls the factory.

---

## Version History

| Version | Changes |
|---|---|
| 1.0.0 | 2026-10-11: Initial architecture for the CLI layer |
| 1.1.0 | 2026-10-14: Replaced the unchanged-note claim with core-owned recoverable application and CLI-owned recovery reporting |
