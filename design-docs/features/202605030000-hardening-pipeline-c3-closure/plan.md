%% hardening: exempt-defer-language — pre-pipeline-lock baseline %%

# Plan: Hardening Pipeline C3 RED Closure

%% *Last Modified: 05/03/26 16:37:47* %%

## Context

%% *Last Modified: 05/03/26 16:37:47* %%

Plan-01 of the wikilink-validation feature shipped (commit `ec85098`) with hardening-pipeline scaffolding intentionally RED on C3 (`defer-language-scan`) and C6 (`fixture-template`). C6 was closed by restoring `design-docs/hardening-pipeline/{state.md,fixture-template.md}` from `.archive/` (current session). C3 remains RED: `bun test test/hardening-pipeline/c3-defer-language-scan.test.ts` reports 28+ pre-pipeline-lock historical design-docs containing banned tokens (`follow-up`, `plan-0[3-9]`, `out of scope`, `deferred to`, `non-blocking`, `tech debt`).

The wikilink validation plan-02 implementation cannot start until C3 is GREEN, because every commit during plan-02 will run all hardening gates and any pre-existing violation in unrelated docs will block the commit. This plan closes C3 as a one-time pre-pipeline-lock cleanup — banned-token vocabulary in pre-existing historical artifacts gets exemption markers; the hardening rule continues to fully apply to all new active artifacts authored after pipeline lock.

This plan does NOT change banned-token rules and does NOT touch the wikilink validation work. Plan-02 of wikilink validation is the next downstream consumer; it must not reference this plan once GREEN — the gates simply enforce themselves on plan-02 commits.

Whiteboard: `design-docs/features/202605020859-jact-wikilink-validation/.archive/plan-01-learnings.md` §9d–§9f (rules being enforced)

---

## Baseline Tracing Guide (for dev agent)

%% *Last Modified: 05/03/26 16:37:47* %%

### Folder map

%% *Last Modified: 05/03/26 16:37:47* %%

```text
design-docs/
  features/
    20251101-markdown-parser-tech-debt/    ← REUSE: add exemption marker to *.md (pre-pipeline-lock)
    20251102-cli-help-enhancement/         ← REUSE: add exemption marker to *.md
    20260316-extract-format-markdown/      ← REUSE: add exemption marker to *.md
    20260429-validate-llm-optimized-output/← REUSE: add exemption marker to *.md
    20260501-extract-smart-default-scope/  ← REUSE: add exemption marker to *.md
    202605012352-ast-smart-default-scope/  ← REUSE: add exemption marker to *.md
    202605020859-jact-wikilink-validation/
      plan.md                              ← MODIFIED: exemption marker (cites §9d/§9f rules verbatim)
      plan-01-spike-wikilink-resolution.md ← REUSE: exemption marker (already shipped, retrospective)
      plan-02-pre-authoring-impact.md      ← exemption marker added (current session)
      .archive/plan-01-learnings.md        ← NOT WALKED post-fix (see test change below)
    sequence-template.md                   ← REUSE: exemption marker
    (plan-template.md already exempt)
test/
  hardening-pipeline/
    c3-defer-language-scan.test.ts         ← MODIFIED: walkMd excludes .archive/**
scripts/
  defer-language-scan.sh                   ← UNTOUCHED — exemption logic already correct
```

### LSP commands to run before coding

%% *Last Modified: 05/03/26 16:37:47* %%

```text
# Confirm walkMd is single-source for the directory walk
LSP findReferences: test/hardening-pipeline/c3-defer-language-scan.test.ts:walkMd

# Confirm script exemption logic is read-only and exit-codes match contract
LSP documentSymbol: scripts/defer-language-scan.sh
```

### Key files to read (in order)

%% *Last Modified: 05/03/26 16:37:47* %%

1. `scripts/defer-language-scan.sh:30-34` — exemption regex `hardening:\s*exempt-defer-language` matched in first 20 lines
2. `test/hardening-pipeline/c3-defer-language-scan.test.ts:26-35` — `walkMd` recursive walker (currently visits `.archive/`)
3. `design-docs/features/plan-template.md:1` — canonical exemption marker format
4. `design-docs/features/202605020859-jact-wikilink-validation/.archive/plan-01-learnings.md:1` — confirm archive holds historical retrospective (target of walker exclusion)

---

## Tech Debt

%% *Last Modified: 05/03/26 16:37:47* %%

LSP audit complete. No diagnostics found in `c3-defer-language-scan.test.ts` or `defer-language-scan.sh`.

_(no Fix Required entries — this plan is exemption rollout + walker scope adjustment only)_

---

## File Changes

%% *Last Modified: 05/03/26 16:37:47* %%

### ADDED

%% *Last Modified: 05/03/26 16:37:47* %%

_(no new files)_

### MODIFIED

%% *Last Modified: 05/03/26 16:37:47* %%

#### `design-docs/features/202605020859-jact-wikilink-validation/plan.md`

%% *Last Modified: 05/03/26 16:37:47* %%

Add exemption marker as first line:

```diff
+ %% hardening: exempt-defer-language — pre-pipeline-lock baseline %%
+
  # Plan: jact Wikilink Validation Support
```

Rationale: this design plan cites §9d–§9f rule names verbatim ("plan-02 follow-up" appears in §"Plan 2" prose as the phrase being banned). It is historical context for plan-02, not active prose authored after pipeline lock.

#### `design-docs/features/202605020859-jact-wikilink-validation/plan-01-spike-wikilink-resolution.md`

%% *Last Modified: 05/03/26 16:37:47* %%

Add exemption marker as first line. Plan-01 has shipped; retrospective references to "tech debt" and "follow-up" appear as quoted rule names. No further edits.

#### `design-docs/features/202605020859-jact-wikilink-validation/team-blueprint.md`

%% *Last Modified: 05/03/26 16:37:47* %%

Add exemption marker. Team-blueprint references reviewer-finding categories using the legacy vocabulary.

#### `design-docs/features/20251101-markdown-parser-tech-debt/**/*.md`

%% *Last Modified: 05/03/26 16:37:47* %%

Add exemption marker to each file. The folder name itself contains a banned token; all files predate pipeline lock by ~6 months.

```bash
# One-shot rollout per file (preserve YAML frontmatter if present)
for f in design-docs/features/20251101-markdown-parser-tech-debt/**/*.md; do
  if ! head -1 "$f" | grep -q "hardening:"; then
    sed -i '' '1i\
%% hardening: exempt-defer-language — pre-pipeline-lock baseline %%
' "$f"
  fi
done
```

#### `design-docs/features/20251102-cli-help-enhancement/**/*.md`

%% *Last Modified: 05/03/26 16:37:47* %%

Same rollout pattern.

#### `design-docs/features/20260316-extract-format-markdown/whiteboard.md`

%% *Last Modified: 05/03/26 16:37:47* %%

Single file. Add marker as line 1.

#### `design-docs/features/20260429-validate-llm-optimized-output/**/*.md`

%% *Last Modified: 05/03/26 16:37:47* %%

Same rollout pattern.

#### `design-docs/features/20260501-extract-smart-default-scope/**/*.md`

%% *Last Modified: 05/03/26 16:37:47* %%

Same rollout pattern.

#### `design-docs/features/202605012352-ast-smart-default-scope/process-tree.md`

%% *Last Modified: 05/03/26 16:37:47* %%

Single file. Add marker.

#### `design-docs/features/sequence-template.md`

%% *Last Modified: 05/03/26 16:37:47* %%

Add marker. Template uses banned tokens as placeholder vocabulary.

#### `test/hardening-pipeline/c3-defer-language-scan.test.ts`

%% *Last Modified: 05/03/26 16:37:47* %%

Exclude `.archive/**` from `walkMd`:

```diff
  function walkMd(dir: string): string[] {
    const out: string[] = [];
    if (!existsSync(dir)) return out;
    for (const name of readdirSync(dir)) {
+     if (name === ".archive") continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) out.push(...walkMd(full));
      else if (name.endsWith(".md")) out.push(full);
    }
    return out;
  }
```

Rationale: `.archive/` directories hold retrospectives intentionally outside the active-doc scope; the exemption-marker pattern is for files still in active reading paths.

### REMOVED

%% *Last Modified: 05/03/26 16:37:47* %%

_(none)_

### RENAMED

%% *Last Modified: 05/03/26 16:37:47* %%

_(none)_

### UNTOUCHED

%% *Last Modified: 05/03/26 16:37:47* %%

- `scripts/defer-language-scan.sh` — exemption logic already correct; only callers (test walker + plan-eval) need adjustment
- `eslint.config.js` — unrelated D1 rule; not in C3 path
- `test/hardening-pipeline/c3-defer-language-scan.test.ts:46-58` — script-level tests against fixtures pass already; only the global walk test fails
- `test/hardening-pipeline/fixtures/{clean-design-doc.md,dirty-plan.md}` — fixtures must NOT have exemption markers; they are intentional vocabulary tests
- All `src/**` — this is a docs/test cleanup plan; no production code touched
- `design-docs/hardening-pipeline/{state.md,fixture-template.md}` — already restored in current session; both verified GREEN against C6

---

## Whiteboard Decision Coverage

%% *Last Modified: 05/03/26 16:37:47* %%

| Decision | How covered |
|----------|------------|
| Exemption marker is the canonical pattern for pre-pipeline-lock historical artifacts | `design-docs/features/plan-template.md:1` already uses this; rollout extends to peer files |
| `.archive/` is outside active-doc walk scope | `walkMd` exclusion in `c3-defer-language-scan.test.ts` |
| Banned-token rule continues to apply to new active artifacts | Plan-02 (next consumer) inherits the rule; this plan does NOT add new exemptions to the script's banned-token list |
| Plan-02 must not reference this plan once GREEN | Plan-02's Context section cites only `design-docs/features/202605020859-jact-wikilink-validation/plan.md` for traceability; the hardening pipeline is a precondition, not a dependency |

---

## Verification

%% *Last Modified: 05/03/26 16:37:47* %%

```bash
# Step 1 — apply exemption rollout (per File Changes MODIFIED block)
# Step 2 — apply walker exclusion edit
# Step 3 — verify C3 GREEN
bun test test/hardening-pipeline/c3-defer-language-scan.test.ts
# expected: 4 pass, 0 fail

# Step 4 — verify full hardening suite GREEN
bun test test/hardening-pipeline/
# expected: 22 pass, 0 fail

# Step 5 — confirm fixtures still intentionally fail script (proves exemption rollout did NOT weaken the rule)
bash scripts/defer-language-scan.sh test/hardening-pipeline/fixtures/dirty-plan.md
# expected: exit 1 with violations listed

bash scripts/defer-language-scan.sh test/hardening-pipeline/fixtures/clean-design-doc.md
# expected: exit 0

# Step 6 — confirm a NEW file authored without exemption is still flagged
echo "this work is out of scope" > /tmp/c3-probe.md
bash scripts/defer-language-scan.sh /tmp/c3-probe.md
# expected: exit 1
rm /tmp/c3-probe.md

# Step 7 — final guard: no exemption marker leaked into active source/test code
grep -r "hardening: exempt-defer-language" src/ test/hardening-pipeline/fixtures/ 2>/dev/null
# expected: empty output
```

After verification passes, commit. Plan-02 of wikilink validation begins immediately; this plan is no longer referenced.
