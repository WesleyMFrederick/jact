# Domain Docs

How engineering skills should consume this repository's domain documentation.

## Before exploring, read these

- `CONTEXT.md`, if present
- ADRs relevant to the work under `docs/adrs/`
- The [jact Living Specification](../spec/SPEC.md#jact Living Specification)

If `CONTEXT.md` does not exist, proceed silently. Create it only when domain terminology is resolved.

## File structure

```text
/
├── CONTEXT.md
├── docs/
│   ├── adrs/
│   ├── agents/
│   └── spec/
└── src/
```

## Use the glossary's vocabulary

When `CONTEXT.md` defines a domain term, use it consistently. If a needed concept is missing, reconsider the terminology or note the gap for domain modeling.

## Flag ADR conflicts

Surface any conflict with an existing ADR rather than silently overriding it.
