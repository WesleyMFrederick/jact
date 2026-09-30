# Domain Docs

How engineering skills should consume this repository's domain documentation.

## Before exploring, read these

- ADRs relevant to the work under `docs/adrs/`
- The [jact Living Specification](../spec/SPEC.md#jact Living Specification)
- The [Domain Model core entities](../spec/004-domain-model.md#Core Entities)

## File structure

```text
/
├── docs/
│   ├── adrs/
│   ├── agents/
│   └── spec/
└── src/
```

## Use the domain model's vocabulary

When the [Domain Model core entities](../spec/004-domain-model.md#Core Entities) define a term, use it consistently. If a needed concept is missing, reconsider the terminology or note the gap for domain modeling.

## Flag ADR conflicts

Surface any conflict with an existing ADR rather than silently overriding it.
