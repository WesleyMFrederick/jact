# 001. Vision

**Status:** done

## What `src/types` Is

`src/types` is a set of TypeScript declaration files that give every jact layer one shared name for each data shape. The parser, validator, extractor, file cache, command-line interface (CLI), and tests import these names. The TypeScript compiler then rejects a shape mismatch between two layers at build time.

### What `src/types` Is Not

The module declares shapes and does nothing else.

- Not runtime code — the build emits each file as an empty JavaScript module (`export {};`)
- Not field documentation — the [Domain Model](../../../../docs/spec/004-domain-model.md#004.%20Domain%20Model) section explains each field
- Not the JavaScript Object Notation (JSON) output contract — the [Interfaces](../../../../docs/spec/005-interfaces.md#005.%20Interfaces) section owns command output
- Not the definer of dependency-injection interfaces — core component files define them

## Design Principles

Three principles keep the module a vocabulary, not a layer.

### 1. Declarations Only

**Principle:** A file in `src/types` holds only `type` aliases, `interface` declarations, and type-only re-exports.

**Implications:**
- No function, class, constant, enum, or default value lives here
- Importers use `import type`, so no runtime import edge points at this module
- A shape that needs a helper function gets the helper in the component that owns the behavior

### 2. One Name per Shape

**Principle:** Each shared shape has one declaration; every other file imports it.

**Implications:**
- A component never redeclares a shared shape locally
- A dependency-injection interface keeps its definition next to the component that consumes it; `componentInterfaces.ts` gives other files one import path to it

### 3. Parser Vocabulary Registered Once

**Principle:** `micromarkAugment.d.ts` registers each custom micromark token name and mdast node type in one place. Micromark is the Markdown tokenizer; mdast is the Markdown syntax tree it builds.

**Implications:**
- Extension code under `src/core/MarkdownParser/extensions/` uses token and node names without type casts
- A new Markdown extension adds its names here in the same change

## Core Guarantees

The module guarantees zero runtime cost and compile-time agreement.

| Guarantee | Description |
|-----------|-------------|
| **No runtime code** | Every emitted file is `export {};`; loading the module runs nothing |
| **Type-only dependencies** | All imports into and out of the module are `import type` or `export type`, so they vanish at build |
| **Registered parser names** | Each token and node name that a parser extension uses appears in `micromarkAugment.d.ts` |
| **Compile-time only augmentation** | The build does not copy `micromarkAugment.d.ts` into `dist/`; it affects type checks, not output |

## Target Users

Contributors and test authors use the module.

| User | Use Case |
|------|----------|
| **Component contributors** | Read and change the shapes a component accepts or returns |
| **Parser extension authors** | Register a new token name or node type |
| **Test authors** | Build typed fixtures and test doubles without importing production classes |

## Version History

Each row records one version of this vision.

| Version | Changes |
|---------|---------|
| 1.0.0 | Initial vision for `src/types` |
| 1.1.0 | 2026-10-07: Aligned to code; removed internal code names to reduce drift |
