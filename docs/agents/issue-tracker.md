# Issue tracker: Local Markdown

Issues live as Markdown files in `.scratch/`. Persistent feature specs are canonical under `design-docs/features/` and exposed to the issue tracker through symlinks.

## Conventions

- One issue-tracker workspace per `.scratch/{YYYYMMDDTHHMMSS}-{module}-{slug}/`.
- Persistent PRDs, specs, and plans are canonical under `design-docs/features/<feature>/` and symlinked under `.scratch/{YYYYMMDDTHHMMSS}-{module}-{slug}/spec/` — never copied. Matching directory depth keeps relative Markdown links valid from both paths.
- Implementation issues are individual Markdown files under `.scratch/{YYYYMMDDTHHMMSS}-{module}-{slug}/issues/`.
- Issue filenames use `<NN>-<slug>.md`, numbered from `01`.
- `/to-issues` slices a persistent plan, spec, or PRD into many small tracer-bullet issues; it never creates a 1:1 plan-to-issue mapping.
- `.scratch/`-only issues and captured ideas live directly in `.scratch/` until promoted to a persistent feature artifact.
- Triage state is recorded as a `Status:` line near the top.
- Use the roles defined in [Triage Labels](triage-labels.md#Triage Labels).
- Append conversation history under a `## Comments` heading.

## Publishing to the issue tracker

1. Create the canonical feature directory under `design-docs/features/<feature>/` for persistent PRDs, specs, and plans.
2. Write each persistent artifact only in that canonical directory.
3. Create the matching `.scratch/{YYYYMMDDTHHMMSS}-{module}-{slug}/` workspace.
4. Use `ln -s` to expose the canonical artifact under the workspace's `spec/` directory; never use `cp`.
5. Write ad-hoc issues and unpromoted ideas directly in `.scratch/`.

## CASE-TRACKER session log

`CASE-TRACKER.md` rows use these ten columns: `#`, `Session ID`, `Datetime`, `Kind`, `Phase`, `Sub-Phase`, `Status`, `Session Goal`, `Status Reason`, and `Outcome`.

Outcome cells stay between 25 and 40 words.

## Fetching a ticket

Read the referenced issue file. The user will normally provide its path or number.

## Wayfinding operations

- Map: `.scratch/{YYYYMMDDTHHMMSS}-{module}-{slug}/map.md`
- Child ticket: `.scratch/{YYYYMMDDTHHMMSS}-{module}-{slug}/issues/<NN>-<slug>.md`
- Type: `research`, `prototype`, `grilling`, or `task`
- Status: `claimed` or `resolved`
- Blocking: record issue numbers in a `Blocked by:` line
- Claim: set `Status: claimed` before beginning work
- Resolve: append an `## Answer`, set `Status: resolved`, and update the map
