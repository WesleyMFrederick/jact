# 002. Architecture

**Status:** done

This section maps the files of `src/types`, the guarantees each holds, and the boundaries between them.

## System Overview

`src/types` holds the type declarations that every other layer imports. All edges into and out of the module are type-only, so the compiler erases them. The diagram shows type edges, not runtime calls.

```
src/cli.ts, src/jact-cli.ts ─┐
src/factories/ ──────────────┤
src/core/ ───────────────────┼── import type ──► src/types/*.ts
src/validate/, src/outline/ ─┤
test/ ───────────────────────┘

src/types/componentInterfaces.ts ── export type ──► *Like interfaces defined in src/core/
src/types/fileCacheTypes.ts,
src/types/extraction-types.ts ───── import type ──► shapes from src/core/ and src/ParsedDocument.ts
src/types/micromarkAugment.d.ts ─── declare module ─► micromark-util-types, mdast
```

---

## Components

Each file owns one group of shapes. The repository [Domain Model](../../../../docs/spec/004-domain-model.md#004.%20Domain%20Model) section documents their fields.

### `citationTypes.ts` and `validationTypes.ts` — parse and check results

These files declare what the parser produces and what the validator adds to each link. Field meanings: [Core Entities](../../../../docs/spec/004-domain-model.md#Core%20Entities).

Boundary: these files declare results; the parser in `src/core/MarkdownParser/` and the validator in `src/core/CitationValidator/` produce them.

### `extraction-types.ts` and `strategy-types.ts` — extraction contracts

These files declare extraction output, linked-context output, and the strategy interface that each eligibility rule implements. Output fields: [Extraction Types](../../../../docs/spec/004-domain-model.md#Extraction%20Types%20%28%60src/types/extraction-types.ts%60%29).

- **Public output shape.** The [`jact extract links`](../../../../docs/spec/005-interfaces.md#%60jact%20extract%20links%20%3Csource-file%3E%60) command prints the extraction output as JavaScript Object Notation (JSON). A field change is a command-line interface (CLI) contract change.

Boundary: the strategy order and each rule live in `src/core/ContentExtractor/`, not here.

### `cli-types.ts` — command options and batch results

This file declares the parsed options of each CLI command and the batch-validate result shapes. Batch fields: [Batch-Validate Types](../../../../docs/spec/004-domain-model.md#Batch-Validate%20Types%20%28%60src/types/cli-types.ts%60%29).

- **Options carry flag values.** Option fields hold parsed flags from the [Interfaces](../../../../docs/spec/005-interfaces.md#005.%20Interfaces) section. One exception: `CliOutlineOptions.sessionId` comes from an integration, not a public flag.

Boundary: argument parsing and exit codes live in `src/cli.ts` and `src/jact-cli.ts`.

### `fileCacheTypes.ts` — file resolution results

This file declares the success and failure results of a file-cache lookup. Fields: [FileCache Types](../../../../docs/spec/004-domain-model.md#FileCache%20Types%20%28%60src/types/fileCacheTypes.ts%60%29).

- **Discriminated result.** The `found` field separates success from failure; only a failure carries a reason and diagnostics.

Boundary: candidate ranking and display limits live in `src/FileCache.ts` and the output formatter.

### `componentInterfaces.ts` — dependency-injection import point

This file re-exports the narrow interfaces that the factory accepts in place of concrete classes. Each interface is defined next to the core component that consumes it.

- **No definitions.** The file holds only `export type` lines; it adds no members.
- **Test doubles fit.** A plain object that satisfies an interface passes into the factory without a production class import. `test/unit/factories/component-factory-interfaces.test.ts` enforces this.

Boundary: a change to an interface happens in its defining core file. Why the factory takes interfaces: [ADR-0001](../../../../docs/adrs/003-adrs.md#ADR-0001%20—%20DI-via-factory%20pattern).

### `micromarkAugment.d.ts` — parser vocabulary

This file uses TypeScript module augmentation to add jact's names to two library type maps. Module augmentation adds members to another package's declared types without changing that package.

- **Token names.** Micromark is the Markdown tokenizer. Each custom micromark token name is a key of its token type map, and the compiler rejects an unregistered name in `effects.enter`.
- **Node types.** Each custom node type joins the phrasing and root content maps of mdast, the Markdown syntax tree. Tree walkers see the nodes without casts.
- **Compile-time only.** The build emits no copy of this file; it changes type checks, not `dist/` output.

Boundary: names here match the extensions under `src/core/MarkdownParser/extensions/`; the extension set itself is the [Flavor Extension Collection](../../../../docs/adrs/003-adrs.md#ADR-0003%20—%20Flavor%20Extension%20Collection).

---

## Boundary

The module declares shapes; components own behavior. No file here holds a function, class, constant, or default value. No importer takes a runtime dependency on this module, and this module takes no runtime dependency on another module.

---

## Version History

Each row records one version of this architecture document.

| Version | Changes |
|---------|---------|
| 1.0.0 | Initial architecture for `src/types` |
