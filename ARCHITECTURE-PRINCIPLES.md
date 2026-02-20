
# Core Architecture Principles

---
## Modular Design Principles

**Build systems from flexible, replaceable, and understandable parts**. Each part must do one thing well, interact only through well-defined boundaries, and be simple enough to swap or extend without ripple effects. ^modular-design-principles-definition

- **Loose Coupling, Tight Cohesion**: Maximize internal relatedness (cohesion) and minimize external dependencies (coupling). This localizes changes, reduces ripple effects, and simplifies reasoning. ^loose-coupling-tight-cohesion
- **Black Box Interfaces**: Expose clean, documented APIs; hide implementation details. ^black-box-interfaces
- **Single Responsibility**: Give each class, module, or file one clear concern. ^single-responsibility
- **Replaceable Parts**: Design components so they can be swapped out using only their interfaces. ^replaceable-parts
- **Extension Over Modification**: Add functionality by extending, not altering, existing code. ^extension-over-modification
- **Dependency Abstraction**: Depend on abstractions, not concrete implementations. ^dependency-abstraction
- **Composition Over Inheritance**: Combine parts to adapt behavior; avoid fragile hierarchies. ^composition-over-inheritance
- **Avoid Duplication**: Centralize shared functionality to reduce maintenance. ^avoid-duplication

---

## Data-First Design Principles

**Data models are the foundation of reliability**. Clean data makes code simple and resilient. Define strong primitives, capture relationships explicitly, and enforce invariants in the data itself to reduce logic overhead and prevent entire classes of errors. ^data-first-principles-definition

### Core Data Principles
- **Primitive-First Design**: Define simple, consistent primitives and compose complexity from them. ^primitive-first-design
- **Data Model First**: Clean data structures and relationships lead to clean code. ^data-model-first
- **Illegal States Unrepresentable**: Use types, schemas, and constraints to make invalid states impossible to represent. ^illegal-states-unrepresentable
- **Explicit Relationships**: Encode links directly (e.g., enums, keys) instead of using scattered checks. ^explicit-relationships

### Data Fit & Stability
- **Access-Pattern Fit**: Choose data structures aligned with expected read/write patterns. ^access-pattern-fit
- **Shift Complexity to Data**: Precompute or index data so runtime logic stays simple. ^shift-complexity-to-data
- **Stable Schemas**: Version and migrate schemas carefully; prioritize backward compatibility. ^stable-schemas
- **Behavior as Data**: Represent rules or configs declaratively instead of in branching logic. ^behavior-as-data
- **One Source of Truth**: Maintain one authoritative dataset; use projections, not duplicates. ^one-source-of-truth
- **One Invariant, One Place**: Enforce each constraint in the schema or type system, not in scattered code paths. ^one-invariant-one-place

### Applied Data Rules
**When logic is complex, fix the data representation first**. Clean data simplifies logic, streamlines the common case, and lets measurement—not guesswork—guide the design. ^applied-data-rules

- **Refactor Representation First**: If logic is tangled, reshape the data before rewriting the code. ^refactor-representation-first
- **Straight-Line Happy Path**: Choose representations that make the common case simple and linear. ^straight-line-happy-path
- **Measure, Then Model**: Base data structures on observed patterns and error modes, not assumptions. ^measure-then-model

---

## Action-Based File Organization

**Organize files around the operations that transform data**. Name files by their primary action (e.g., `calculateMetrics`). This separates data contracts ("what it is") from operations ("what it does"). ^action-based-file-organization-definition

### File Naming & Organization
- **Transformation Naming**: Name files by their primary operation (e.g., `fileSearch`, `outputGenerate`). Data types show _what_ flows; file names show _how_ it transforms. ^transformation-naming
- **Primary Export Pattern**: Each file should export one main function that matches the file name and operates on clear data contracts. ^primary-export-pattern
- **Data Contracts Separate**: Define shared types in `*Types.ts` files (the WHAT). Sibling files define the operations (the HOW). ^data-contracts-separate
- **Co-located Helpers**: Keep local helper functions and types in the same file as the operation they support. ^co-located-helpers

### Composition Strategy
- **Data Defines Interface**: Data types (e.g., `RawFile`, `ProcessedFile`) are defined first and drive the operation signatures. ^data-defines-interface
- **Files Transform States**: Each file moves data through a pipeline state (e.g., `collectFiles()` creates `RawFile[]`, `processFiles()` creates `ProcessedFile[]`). ^files-transform-states
- **Orchestrators Compose Pipeline**: Orchestrator modules sequence these operations, following the data flow. ^orchestrators-compose-pipeline
- **Lightweight Dependency Injection**: Accept optional `deps` objects for testability; avoid heavyweight DI frameworks. ^lightweight-dependency-injection

### Structural Organization
- **Component-Level Folders**: Group related operations by domain (e.g., `file/`, `output/`, `metrics/`). ^component-level-folders
- **Strategy Subfolders**: Extract implementation variants into subfolders (e.g., `outputStyles/`, `parseStrategies/`). ^strategy-subfolders
- **Utility Extraction**: Create dedicated files for focused, reusable utilities that serve multiple operations. ^utility-extraction

---

## Format/Interface Design

**Interfaces are touchpoints for systems and users**. Good interfaces reduce errors, lower cognitive load, and simplify extension. Keep them simple, focused, and role-specific. ^format-interface-design-definition

- **Simplicity First**: Make interfaces as simple as possible. Favor one good, simple way over multiple complex options. ^simplicity-first
- **Progressive Defaults**: Design with sensible defaults for the 80% use case. Provide clear customization paths for specialists. This reduces initial complexity while retaining flexibility. ^progressive-defaults
- **Progressive Disclosure**: Reveal information, context, or instructions to LLMs gradually as needed, rather than loading everything upfront. This optimizes token usage, maintains focus on relevant information, and manages limited context windows effectively. ^progressive-disclosure
- **Interface Segregation**: Design small, role-specific interfaces, not broad, catch-all ones. ^interface-segregation

---

## Minimum Viable Product (MVP) Principles

**MVPs prove concepts**. The goal is rapid validation, minimizing wasted effort. Keep scope tight, solutions simple, and leverage existing foundations to adapt quickly. ^mvp-principles-definition

### Build the Right Thing
- **MVP-First Approach**: Build functionality that demonstrates the concept works, not a bulletproof system. ^mvp-first
- **Reality Check**: Validate that every solution serves core requirements without unnecessary complexity. ^reality-check

### Stay Within Scope
- **Scope Adherence**: Respect the PRD's stated scope and non-goals. Never exceed them. ^scope-adherence
- **Implement When Needed**: Avoid implementing features until they are necessary. Prevent over-engineering. ^implement-when-needed

### Bias Toward Simplicity
- **Simplicity First**: When multiple options meet requirements, favor the most direct, straightforward implementation. ^simplicity-first

### Leverage What Exists
- **Foundation Reuse**: Leverage existing setup and infrastructure; don't recreate them. ^foundation-reuse
- **Service Layer Separation**: Separate data access, business logic, and presentation layers. ^service-layer-separation

---

## Deterministic Offloading Principles

**LLMs are powerful but unreliable for rigid tasks; deterministic tools are fast but brittle**. Offload predictable tasks (tools) and keep LLMs for judgment (semantics) to maximize strengths. ^deterministic-offloading-principles-definition

- **Mechanical Separation**: Route deterministic tasks (I/O, parsing, validation, search) to tools. Reserve LLMs for semantic work (intent, design, context). ^mechanical-separation
- **Focused Context**: Fill the LLM's context with high-value, semantic information. Offloading deterministic details improves clarity and reasoning. ^context-window-preservation
- **Tool-First Design**: Use or build specialized tools for repetitive operations instead of relying on LLM brute force. ^tool-first-design
- **No Surprises**: Identical inputs and instructions must yield consistent, deterministic results. ^prioritize-deterministic-operations

---

## Self-Contained Naming Principles

**A name must stand on its own, clearly signaling purpose, scope, and intent without requiring lookup**. Good names are lightweight contracts that prevent confusion and speed up comprehension. ^self-contained-naming-principles-definition

- **Descriptive Labels**: Names must distinguish system scope, operation, and/or outcome without needing documentation. ^descriptive-labels
- **Immediate Understanding**: Any human or AI must understand the identifier's purpose from the name alone. ^immediate-understanding
- **Confusion Prevention**: Provide enough detail in names to eliminate ambiguity. ^confusion-prevention
- **Contextual Comments**: Use docstrings and comments to provide context for AI to understand file purpose and usage patterns. ^contextual-comments
- **Follow Conventions**: Design systems to behave as users and developers expect. Minimize surprises. ^follow-conventions
- **Selective Documentation**: Document all public APIs and class-level architecture (e.g., JSDoc). Document complex private methods. Use inline comments for simple utilities. ^selective-documentation

---

## Safety-First Design Patterns

**Systems must protect themselves and their users by default**. Build layered defenses to **prevent** data loss, **expose** errors early, and **recover** gracefully. Reliability comes from redundancy, validation, and clear contracts. ^safety-first-principles-definition

- **Backup Creation**: Create automatic timestamped backups before modifications. ^backup-creation
- **Dry-Run Capability**: Allow previewing changes without modifying files. ^dry-run-capability
- **Atomic Operations**: Ensure all changes succeed or fail together as a single unit. ^atomic-operations
- **Input Validation**: Use multi-layer validation before processing any input. ^input-validation
- **Error Recovery**: Provide graceful rollback on failure. ^error-recovery
- **Fail Fast**: Catch errors as early as possible to simplify debugging. ^fail-fast
- **Clear Contracts**: Specify preconditions, postconditions, and invariants for reliable component cooperation. ^clear-contracts

---

## Anti-Patterns to Avoid

**Failures usually come from hidden complexity, not missing features**. Avoid patterns that obscure intent, spread logic, or create fragile dependencies. Keep designs obvious, simple, and easy to reason about. ^anti-patterns-definition

- **Scattered Checks**: Enforce invariants in schemas or types, not in scattered code checks. ^scattered-checks
- **Branch Explosion**: Replace deep `if-else` logic with declarative tables or data-driven dispatch. ^branch-explosion
- **Over-Engineered Structures**: Avoid exotic data models before they are proven necessary. ^over-engineered-structures
- **Leaky Flags**: Avoid ambiguous flags that require out-of-band knowledge to interpret. ^leaky-flags
- **Hidden Global State**: Keep state explicit and localized to preserve clarity and testability. ^hidden-global-state

---
