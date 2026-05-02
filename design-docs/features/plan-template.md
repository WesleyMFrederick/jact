# Plan: {{change-name}}

## Context

{{Why this change is needed. What problem it solves. Reference the whiteboard.}}

Whiteboard: `openspec/changes/{{change-id}}/workflows/{{workflow-name}}/whiteboard.md`

---

## Baseline Tracing Guide (for dev agent)

### Folder map
```
src/
  {{domain}}/
    {{file}}.ts     ← REMOVING / REUSE / UNTOUCHED — one-line reason
data-{{output-dir}}/  ← output target
```

### LSP commands to run before coding

```
# Confirm callers of every function being created/deleted/moved
LSP findReferences: {{file}}:{{line}} ({{functionName}})

# CRITICAL: check shared utilities — confirm safe deletion scope
LSP findReferences: {{sharedUtil}}:{{line}} ({{utilName}})

# Confirm domain type shapes for function signatures
LSP documentSymbol: {{domainFile}}
```

### Key files to read (in order)
1. `{{analogousImplementation}}` — copy AppLayer + runXxx shape; key logic to port
2. `{{analogousTest}}` — copy makeTestLayer + ConfigProvider.fromMap pattern
3. `{{testFixtureHelper}}:{{line-range}}` — copy fixture creation helper
4. `{{serviceFile}}:{{line-range}}` — key constants + exported Live layer
5. `package.json:{{line-range}}` — scripts block to modify

---

## Tech Debt

LSP audit of all in-scope files (ADDED + MODIFIED + their callees). Run before writing File Changes.
**Scope rule:** fix tech debt in any file this PR touches — no "out of scope" exceptions.

### Fix Required

#### `{{file}}:{{line}}` — {{description}}

  ```diff
  - {{old}}
  + {{new}}
  ```

_(remove section if no diagnostics found)_

---

## File Changes

### ADDED

<!-- SKETCH RULES — what goes in ADDED code blocks:
  ✅ Function signatures (name, params, return type)
  ✅ Type definitions and interfaces used by signatures
  ✅ Key algorithmic decisions as comments (pagination strategy, merge order, skip-parent logic)
  ✅ Dependency/layer composition (imports, service wiring)
  ✅ Test assertions (what to verify, not how)
  ❌ Function bodies, loops, conditionals, error handling
  ❌ Runnable code — if you can copy-paste and execute, it's too much
  Goal: an implementing agent can evaluate correctness and fill in the body.
-->

#### `{{newFile}}`
```typescript
// Key structure — implementing agent fills in body
export const {{runXxx}} = (inputPath: string, {{optionalParam}}?: {{type}}) =>
  Effect.gen(function* () {
    // pipeline: service1 → service2 → write outputs
  })

const AppLayer = Layer.mergeAll(
  // Service1Live (via dependency),
  // Service2Live (via PiiConfigLive),
  // StoreLive,
  // BunContext.layer,
)
```

#### `{{newTestFile}}`
```typescript
// makeTestLayer: copy from {{analogousTest}}:{{line-range}}
// add/remove services vs. original as needed

// per-test isolation: ts = Date.now(); all paths in /tmp; mkdirSync outputDir
// fixture helper: copy createTestXxx from {{fixtureSource}}:{{line-range}}

// Test assertions:
// 1. {{primaryBehavior}}   — {{keyAssertion}}
// 2. {{constraint1}}       — {{assertionPattern}}
// 3. {{constraint2}}       — {{assertionPattern}}
// 4. {{constraint3}}       — {{assertionPattern}}
```

### MODIFIED

#### `package.json`
```diff
- "{{oldScript}}": "bun {{oldFile}}",
+ "{{newScript}}": "bun {{newFile}}",
```

### REMOVED
- `{{file}}` — reason (replaced by / no longer needed)

### RENAMED
_(none / list from→to)_

### UNTOUCHED
- `{{file}}` — why it must not be touched (e.g., shared by other CLIs)
- All of `{{unrelatedDirs}}/`

---

## Whiteboard Decision Coverage

| Decision | How covered |
|----------|------------|
| {{D-NNN}} {{label}} | {{implementation point}} |
| {{C-NNN}} {{label}} | {{test or code reference}} |
| {{G-NNN}} {{label}} | {{test assertion}} |

---

## Verification

```bash
# TDD: RED → GREEN → refactor
bun vitest run {{newTestFile}}

# Full suite — no regressions
bun test

# Smoke test
{{ENV_VARS}} bun run {{newScript}} {{sampleInput}}

# Confirm constraints
{{assertionCommand}}  # expected: {{expectedResult}}
```
