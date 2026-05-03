# Core Architecture Design Principles

%% *Last Modified: 04/29/26 22:33:32* %%

> **Scope: Architecture-design phase. Paradigm-agnostic.**
>
> These principles govern *what to build* and *how to structure it* — independent of object-oriented, functional, or any specific language idiom. Apply during PRD authoring, system framing, module decomposition, and interface design.
>
> For code-implementation guidance in a specific paradigm, **compose with**:
> - `../object-oriented/ARCHITECTURE-PRINCIPLES.md` — OO-specific implementation delta
> - `../effect-js/ARCHITECTURE-PRINCIPLES.md` — Effect-specific implementation delta
> - `../ai-coding/AGENTIC-WORKFLOW-PRINCIPLES.md` — AI-harness-specific delta

---

## Modular Design Principles

%% *Last Modified: 04/29/26 22:33:32* %%

**Build systems from flexible, replaceable, and understandable parts.** Each part must do one thing well, interact only through well-defined boundaries, and be simple enough to swap or extend without ripple effects. ^modular-design-principles-definition

- **Loose Coupling, Tight Cohesion**: Maximize internal relatedness (cohesion) and minimize external dependencies (coupling). This localizes changes, reduces ripple effects, and simplifies reasoning. ^loose-coupling-tight-cohesion
- **Stable Public Boundaries**: Expose clean, documented, paradigm-neutral contracts at the boundary; hide implementation details. The contract is a function signature, an interface, a schema, or an API — whatever shape the paradigm chooses, the principle is the same: the consumer depends on the boundary, never the internals. ^stable-public-boundaries
- **Single Responsibility**: Give each unit of code (function, class, module, file) one clear concern. ^single-responsibility
- **Replaceable Parts**: Design components so they can be swapped using only their boundary contract. ^replaceable-parts
- **Extension Over Modification**: Add functionality by extending or composing, not by altering existing code. ^extension-over-modification
- **Dependency Abstraction**: Depend on abstractions, not concrete implementations. The abstraction shape varies by paradigm (interface, function signature, type alias) — the principle does not. ^dependency-abstraction
- **Avoid Duplication**: Centralize shared functionality to reduce maintenance burden. ^avoid-duplication

---

## Data-First Design Principles

%% *Last Modified: 04/29/26 22:33:32* %%

**Data models are the foundation of reliability.** Clean data makes code simple and resilient. Define strong primitives, capture relationships explicitly, and enforce invariants in the data itself to reduce logic overhead and prevent entire classes of errors. ^data-first-principles-definition

### Core Data Principles

%% *Last Modified: 04/29/26 22:33:32* %%

- **Primitive-First Design**: Define simple, consistent primitives and compose complexity from them. ^primitive-first-design
- **Data Model First**: Clean data structures and relationships lead to clean code. Design the data before writing the operations. ^data-model-first
- **Illegal States Unrepresentable**: Use types, schemas, and constraints to make invalid states impossible to represent. If the type compiles, the data is valid. ^illegal-states-unrepresentable
- **Explicit Relationships**: Encode links directly (enums, keys, discriminated unions, typed identifiers) instead of using scattered runtime checks. ^explicit-relationships

### Data Fit & Stability

%% *Last Modified: 04/29/26 22:33:32* %%

- **Access-Pattern Fit**: Choose data structures aligned with expected read/write patterns. ^access-pattern-fit
- **Shift Complexity to Data**: Precompute or index data so runtime logic stays simple. Complex transformations happen once at data creation, not repeatedly at access. ^shift-complexity-to-data
- **Stable Schemas**: Version and migrate schemas carefully; prioritize backward compatibility. ^stable-schemas
- **Behavior as Data**: Represent rules or configs declaratively instead of in branching logic. Data-driven dispatch replaces switch statements. ^behavior-as-data
- **One Source of Truth**: Maintain one authoritative dataset; derive views and projections, never duplicate. ^one-source-of-truth
- **One Invariant, One Place**: Enforce each constraint in the schema or type system, not in scattered code paths. ^one-invariant-one-place

### Applied Data Rules

%% *Last Modified: 04/29/26 22:33:32* %%

**When logic is complex, fix the data representation first.** Clean data simplifies logic, streamlines the common case, and lets measurement — not guesswork — guide the design. ^applied-data-rules

- **Refactor Representation First**: If logic is tangled, reshape the data before rewriting the code. ^refactor-representation-first
- **Straight-Line Happy Path**: Choose representations that make the common case simple and linear. ^straight-line-happy-path
- **Measure, Then Model**: Base data structures on observed patterns and error modes, not assumptions. ^measure-then-model

---

## Action-Based File Organization

%% *Last Modified: 04/29/26 22:33:32* %%

**Organize files around the operations that transform data.** Name files by their primary action (e.g., `calculateMetrics`). This separates data contracts ("what it is") from operations ("what it does"). ^action-based-file-organization-definition

### File Naming & Organization

%% *Last Modified: 04/29/26 22:33:32* %%

- **Transformation Naming**: Name files by their primary operation (e.g., `fileSearch`, `outputGenerate`). Data types show *what* flows; file names show *how* it transforms. ^transformation-naming
- **Primary Export Pattern**: Each file should export one main unit (function, class, module) that matches the file name and operates on clear data contracts. ^primary-export-pattern
- **Data Contracts Separate**: Define shared types in `*Types.ts` (or paradigm equivalent) — the WHAT. Sibling files define the operations — the HOW. ^data-contracts-separate
- **Co-located Helpers**: Keep local helper functions and types in the same file as the operation they support. ^co-located-helpers

### Composition Strategy

%% *Last Modified: 04/29/26 22:33:32* %%

- **Data Defines Interface**: Data types (e.g., `RawFile`, `ProcessedFile`) are defined first and drive the operation signatures. ^data-defines-interface
- **Files Transform States**: Each file moves data through a pipeline state (e.g., `collectFiles()` creates `RawFile[]`, `processFiles()` creates `ProcessedFile[]`). ^files-transform-states
- **Orchestrators Compose Pipeline**: Orchestrator modules sequence these operations, following the data flow. ^orchestrators-compose-pipeline

### Structural Organization

%% *Last Modified: 04/29/26 22:33:32* %%

- **Component-Level Folders**: Group related operations by domain (e.g., `file/`, `output/`, `metrics/`). ^component-level-folders
- **Strategy Subfolders**: Extract implementation variants into subfolders (e.g., `outputStyles/`, `parseStrategies/`). ^strategy-subfolders
- **Utility Extraction**: Create dedicated files for focused, reusable utilities that serve multiple operations. ^utility-extraction

---

## Format/Interface Design

%% *Last Modified: 04/29/26 22:33:32* %%

**Interfaces are touchpoints for systems and users.** Good interfaces reduce errors, lower cognitive load, and simplify extension. Keep them simple, focused, and role-specific. ^format-interface-design-definition

- **Simplicity First**: Make interfaces as simple as possible. Favor one good, simple way over multiple complex options. ^simplicity-first
- **Progressive Defaults**: Design with sensible defaults for the 80% use case. Provide clear customization paths for specialists. This reduces initial complexity while retaining flexibility. ^progressive-defaults
- **Progressive Disclosure**: Reveal information, context, or instructions to consumers (humans or LLMs) gradually as needed, rather than loading everything upfront. This optimizes attention, manages cognitive load, and works within limited context windows. ^progressive-disclosure
- **Interface Segregation**: Design small, role-specific interfaces, not broad, catch-all ones. The "interface" may be a TypeScript interface, a function signature taking only what it needs, or a CLI subcommand surface — the principle is paradigm-neutral. ^interface-segregation
- **Boundary Validation**: Validate at system boundaries (user input, external APIs, file I/O); trust typed/checked data throughout the core. Push validation to the edge so the core stays simple. ^boundary-validation

---

## Minimum Viable Product (MVP) Principles

%% *Last Modified: 04/29/26 22:33:32* %%

**MVPs prove concepts.** The goal is rapid validation, minimizing wasted effort. Keep scope tight, solutions simple, and leverage existing foundations to adapt quickly. ^mvp-principles-definition

### Build the Right Thing

%% *Last Modified: 04/29/26 22:33:32* %%

- **MVP-First Approach**: Build functionality that demonstrates the concept works, not a bulletproof system. ^mvp-first
- **Reality Check**: Validate that every solution serves core requirements without unnecessary complexity. ^reality-check

### Stay Within Scope

%% *Last Modified: 04/29/26 22:33:32* %%

- **Scope Adherence**: Respect the PRD's stated scope and non-goals. Never exceed them. ^scope-adherence
- **Implement When Needed**: Avoid implementing features until they are necessary. Prevent over-engineering. ^implement-when-needed

### Bias Toward Simplicity

%% *Last Modified: 04/29/26 22:33:32* %%

- **Direct Over Clever**: When multiple options meet requirements, favor the most direct, straightforward implementation. ^direct-over-clever

### Leverage What Exists

%% *Last Modified: 04/29/26 22:33:32* %%

- **Foundation Reuse**: Leverage existing setup and infrastructure; don't recreate them. ^foundation-reuse

---

## Deterministic Offloading Principles

%% *Last Modified: 04/29/26 22:33:32* %%

**LLMs are powerful but unreliable for rigid tasks; deterministic tools are fast but brittle.** Offload predictable tasks (tools) and keep LLMs for judgment (semantics) to maximize strengths. ^deterministic-offloading-principles-definition

- **Mechanical Separation**: Route deterministic tasks (I/O, parsing, validation, search) to tools. Reserve LLMs for semantic work (intent, design, context). ^mechanical-separation
- **Focused Context**: Fill the LLM's context with high-value, semantic information. Offloading deterministic details improves clarity and reasoning. ^context-window-preservation
- **Tool-First Design**: Use or build specialized tools for repetitive operations instead of relying on LLM brute force. ^tool-first-design
- **No Surprises**: Identical inputs and instructions must yield consistent, deterministic results. ^prioritize-deterministic-operations

---

## Self-Contained Naming Principles

%% *Last Modified: 04/29/26 22:33:32* %%

**A name must stand on its own, clearly signaling purpose, scope, and intent without requiring lookup.** Good names are lightweight contracts that prevent confusion and speed up comprehension. ^self-contained-naming-principles-definition

- **Descriptive Labels**: Names must distinguish system scope, operation, and/or outcome without needing documentation. ^descriptive-labels
- **Immediate Understanding**: Any human or AI must understand the identifier's purpose from the name alone. ^immediate-understanding
- **Confusion Prevention**: Provide enough detail in names to eliminate ambiguity. ^confusion-prevention
- **Self-Documenting Code First**: Good names and small, single-purpose units are the primary documentation. Comments exist for what names cannot express: rationale, constraints, non-obvious trade-offs, domain context. If you need a comment to explain *what* a unit does, rename it. ^self-documenting-code-first
- **Follow Conventions**: Design systems to behave as users and developers expect. Minimize surprises. ^follow-conventions

---

## Safety-First Design Patterns

%% *Last Modified: 04/29/26 22:33:32* %%

**Systems must protect themselves and their users by default.** Build layered defenses to **prevent** data loss, **expose** errors early, and **recover** gracefully. Reliability comes from redundancy, validation, and clear contracts. ^safety-first-principles-definition

- **Atomic Operations**: Ensure all changes succeed or fail together as a single unit. Multi-step operations must be transactional or compensable. ^atomic-operations
- **Input Validation**: Use multi-layer validation before processing any input. Validate at the boundary; trust validated data internally. ^input-validation
- **Error Recovery**: Provide graceful rollback or compensation on failure. ^error-recovery
- **Fail Fast**: Catch errors as early as possible to simplify debugging. Errors caught at the boundary cost less than errors caught deep in the call graph. ^fail-fast
- **Clear Contracts**: Specify preconditions, postconditions, and invariants for reliable component cooperation. The contract may live in types, schemas, docstrings, or tests — but it must be explicit. ^clear-contracts

---

## Anti-Patterns to Avoid

%% *Last Modified: 04/29/26 22:33:32* %%

**Failures usually come from hidden complexity, not missing features.** Avoid patterns that obscure intent, spread logic, or create fragile dependencies. Keep designs obvious, simple, and easy to reason about. ^anti-patterns-definition

- **Scattered Checks**: Enforce invariants in schemas or types, not in scattered code checks. ^scattered-checks
- **Branch Explosion**: Replace deep `if-else` logic with declarative tables, pattern matching, or data-driven dispatch. ^branch-explosion
- **Over-Engineered Structures**: Avoid exotic data models before they are proven necessary. ^over-engineered-structures
- **Leaky Flags**: Avoid ambiguous flags that require out-of-band knowledge to interpret. Use discriminated unions or named states instead. ^leaky-flags
- **Hidden Global State**: Keep state explicit and localized to preserve clarity and testability. ^hidden-global-state

---
