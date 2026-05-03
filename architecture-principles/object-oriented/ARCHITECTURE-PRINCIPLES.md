# Object-Oriented Implementation Principles

%% *Last Modified: 04/29/26 22:35:49* %%

> **Scope: Code-implementation phase. OO-specific delta only.**
>
> This document holds *only* the principles that are unique to object-oriented / class-based / imperative code. All paradigm-agnostic design-phase principles (Modular Design, Data-First, Action-Based File Organization, Format/Interface, MVP, Deterministic Offloading, Self-Contained Naming, Safety-First, Anti-Patterns) live in **[../core/DESIGN-PRINCIPLES.md](../core/DESIGN-PRINCIPLES.md)** and are NOT duplicated here.
>
> **At code-implementation time, load both files together.** This file specializes the core principles to OO idioms (classes, inheritance, dependency injection, mutable-state hygiene) and adds OO-only operational concerns (backups, dry-run, JSDoc/TSDoc).

---

## OO Modularity Principles

%% *Last Modified: 04/29/26 22:35:49* %%

**OO-specific specializations of [Modular Design Principles](../core/DESIGN-PRINCIPLES.md#Modular%20Design%20Principles).** These restate the same boundary discipline using class/interface vocabulary. ^oo-modularity-principles-definition

- **Black Box Interfaces**: Expose clean, documented APIs (TypeScript `interface`, abstract class, public method surface); hide implementation details behind `private`/`protected`. The OO instantiation of [Stable Public Boundaries](../core/DESIGN-PRINCIPLES.md#^stable-public-boundaries). ^black-box-interfaces
- **Composition Over Inheritance**: Combine objects via fields and delegation rather than extending classes. Inheritance creates fragile hierarchies; composition creates flexibility. ^composition-over-inheritance
- **Dependency Injection**: Pass dependencies through constructor parameters or method arguments — never instantiate concrete dependencies inside the consumer. The OO instantiation of [Dependency Abstraction](../core/DESIGN-PRINCIPLES.md#^dependency-abstraction). ^dependency-injection
- **Lightweight Dependency Injection**: Accept optional `deps` objects for testability; avoid heavyweight DI frameworks (Inversify, Nest DI) until project scale demands them. ^lightweight-dependency-injection
- **Replaceable Parts via Interfaces**: Design components so they can be swapped using only their interface contract. The OO instantiation of [Replaceable Parts](../core/DESIGN-PRINCIPLES.md#^replaceable-parts). ^replaceable-parts-via-interfaces
- **Extension Over Modification (Open/Closed)**: Add functionality by extending classes or implementing interfaces, not by altering existing code. The OO instantiation of [Extension Over Modification](../core/DESIGN-PRINCIPLES.md#^extension-over-modification). ^extension-over-modification-open-closed

---

## OO Architectural Patterns

%% *Last Modified: 04/29/26 22:35:49* %%

**Standard application-level patterns for OO codebases.** These are scope-conscious — apply them when project complexity warrants the structure, not by default. ^oo-architectural-patterns-definition

- **Service Layer Separation**: Separate data access (repositories), business logic (services), and presentation (controllers/views/CLI). Three named layers, clear directionality of dependencies (presentation → services → repositories). ^service-layer-separation
- **Repository Pattern**: Wrap data sources behind a domain-shaped interface (`UserRepository`, not `MongoUserDao`). Lets you swap storage without touching callers. Skip when the data access surface is trivial — over-applying repository creates ceremony with no payoff. ^repository-pattern
- **MVC/MVP for UI Layers**: When building a UI, separate Model (state + invariants), View (rendering), and Controller/Presenter (user-input → state-changes). Don't apply to non-UI code. ^mvc-mvp-for-ui

---

## OO Operational Safety

%% *Last Modified: 04/29/26 22:35:49* %%

**Mutable-systems safety on top of the [Safety-First Design Patterns](../core/DESIGN-PRINCIPLES.md#Safety-First%20Design%20Patterns) core.** In OO/imperative code where state changes in place, these mechanisms protect against data loss that immutability would otherwise prevent. ^oo-operational-safety-definition

- **Backup Creation**: Create automatic timestamped backups before destructive modifications (file overwrites, schema mutations, bulk deletes). The OO equivalent of immutable snapshots in functional code. ^backup-creation
- **Dry-Run Capability**: Allow previewing changes without modifying state. Implement as a `dryRun: boolean` flag or a separate `preview()` method. ^dry-run-capability
- **Idempotent Operations**: Design state-mutating operations so re-running them yields the same end state. Critical for retry-on-failure patterns and recovery. ^idempotent-operations

---

## OO Documentation Strategy

%% *Last Modified: 04/29/26 22:35:49* %%

**Documentation conventions for OO/TypeScript/JavaScript code.** *(Specializes [Self-Documenting Code First](../core/DESIGN-PRINCIPLES.md#^self-documenting-code-first) from the core doc.)* ^oo-documentation-strategy-definition

- **JSDoc/TSDoc on Public APIs**: Document all `public` exported classes, methods, and interfaces with JSDoc/TSDoc. Focus on contract: purpose, parameters, return value, thrown exceptions, side effects. ^jsdoc-tsdoc-on-public-apis
- **Class-Level Architecture Docs**: A class-level docblock explains the role of the class, its lifecycle, and any invariants it maintains. Required for any class with non-obvious responsibilities. ^class-level-architecture-docs
- **Selective Documentation**: Document all public APIs and class-level architecture. Document complex private methods. Use inline comments for simple utilities or non-obvious local rationale. ^selective-documentation
- **Contextual Comments**: Use docstrings and comments to provide context for AI/agents to understand file purpose and usage patterns — especially for files that an agent might need to modify without reading the entire codebase. ^contextual-comments

---

## OO-Specific Anti-Patterns

%% *Last Modified: 04/29/26 22:35:49* %%

**These failure modes are unique to OO/imperative code.** They compose with — but do not duplicate — the [core Anti-Patterns to Avoid](../core/DESIGN-PRINCIPLES.md#Anti-Patterns%20to%20Avoid). ^oo-anti-patterns-definition

- **God Class**: A single class accumulating multiple unrelated responsibilities. Symptom: the class name is vague (`Manager`, `Helper`, `Util`) or the file exceeds ~500 lines. Fix: split by responsibility. ^god-class
- **Inheritance Hierarchy Sprawl**: Deep `extends` chains (>2 levels) coupling subclasses to superclass internals. Symptom: changing a base class breaks unrelated subclasses. Fix: replace inheritance with composition or strategy pattern. ^inheritance-hierarchy-sprawl
- **Shared Mutable State**: Module-level variables, singleton state, or static fields that callers can mutate from anywhere. Symptom: tests fail in unexpected order; debugging requires whole-program reasoning. Fix: pass state through constructor/parameters; encapsulate behind methods. ^shared-mutable-state
- **Service Locator Anti-Pattern**: Pulling dependencies from a global registry inside the consumer (`ServiceRegistry.get('logger')`) instead of receiving them via constructor. Symptom: cannot test a class without booting the entire registry. Fix: constructor-inject the dependency. ^service-locator-anti-pattern
- **Anemic Domain Model**: Domain classes that hold data but no behavior, with all logic in separate "service" classes. Symptom: invariants live in services and can be bypassed by direct field access. Fix: move invariants and operations onto the domain class itself, or enforce them in the constructor/setters. ^anemic-domain-model

---
