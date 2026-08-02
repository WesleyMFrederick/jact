# jact — Agent Operating Rules

Canonical operating doc for agents working in the jact repo. Referenced by the squid `/plan` workflow and by any agent authoring plans, ADRs, or task files here.

## Tracker mode

- `TRACKER_MODE: file` — issues are local Markdown files, one per atomic task.
- **ADR location:** `docs/adrs/`. See [Before exploring, read these](docs/agents/domain.md#Before exploring, read these).

## Issue tracking and case logs

- Issues: local Markdown under `.scratch/{YYYYMMDDTHHMMSS}-{module}-{slug}/` (see [Issue tracker: Local Markdown](docs/agents/issue-tracker.md#Issue tracker: Local Markdown)), not Linear. `design-docs/features/<feature>/` holds the plan/spec/PRD; `/to-issues` slices it into many small tracer-bullet issues — never a 1:1 mapping.
- `CASE-TRACKER.md` rows use the [ten-column session-log format](docs/agents/issue-tracker.md#CASE-TRACKER session log); outcome cells stay 25–40 words.

## Spec and issue separation

- **WHEN** running `/to-spec`, **ALWAYS** create and publish only the canonical spec plus its required Pointer or symlink, **NEVER** create implementation issue files, **BECAUSE** `/to-issues` exclusively owns one-to-many tracer-bullet decomposition and issue creation.

## Canonical-source discipline for `.scratch/`

- `.scratch/{YYYYMMDDTHHMMSS}-{module}-{slug}/` is the issue-tracker workspace (naming per [Issue tracker: Local Markdown](docs/agents/issue-tracker.md#Issue tracker: Local Markdown)). Files meant to persist (PRDs, specs) have their **canonical version in `design-docs/features/<feature>/`** and are **symlinked into `.scratch/`** — never copied.
- **WHEN** a file needs to exist in both `.scratch/` and `design-docs/features/`, **ALWAYS** write the canonical version to `design-docs/features/<feature>/` and `ln -s` into `.scratch/`, **NEVER** `cp`, **BECAUSE** copying creates two files with one truth — they inevitably diverge, and downstream consumers silently read the stale copy while the canonical version moves ahead.
- `.scratch/`-only files (ad-hoc issues, captured ideas not yet promoted to a feature) live directly in `.scratch/` — no symlink needed until they graduate to `design-docs/features/`.

## Markdown links — surgical, to canonical source (like imports)
- **WHEN** writing any markdown document (plans, ADRs, specs, task files, design docs) that references another document, **ALWAYS** use a surgical markdown link to the exact header/anchor of the canonical source — treat it like an `import` statement in code — **NEVER** a prose mention, a bare filename, or a paraphrase, **BECAUSE** linking to the exact section of the canonical source prevents document drift: the reader (human or LLM) resolves current truth on click instead of trusting a copy that silently goes stale.
- **Example:** a plan referencing an ADR links to the ADR file **and** its exact header — `[ADR-0001 · Decision](spec/003-adrs.md#Decision)`, never "see ADR-0001".
- **WHEN** linking to a section, **ALWAYS** use the header's **exact text** as the anchor (run `jact outline <file> H6` first to copy it verbatim), **BECAUSE** jact validates anchors and matches verbatim, not kebab-case.
- **WHEN** a fact already lives in a canonical doc, **ALWAYS** link to it rather than restating it, **BECAUSE** one source of truth + surgical links = no divergent copies to reconcile.
- **WHEN** the link target is a NON-markdown file (`.ts`, `.js`, `.json`, config, any non-`.md`), **NEVER** use a markdown link — write it as a bare backtick path, optionally `path:line` (e.g. `` `src/cli.ts:105` ``), **BECAUSE** jact extracts only markdown: a link to code can't be surgically extracted. Markdown links are for `.md` targets only.

## Chromium rendering and capture

- **WHEN** browser rendering, DOM inspection, screengrabs, or other headless browser work is required, **ALWAYS** use `ws-chromium` as the [Pointer](CONTEXT.md#Pointer) to Chromium under `~/Applications`; **NEVER** infer Chromium is unavailable from a failed `open`, PATH lookup, or system Chrome launch, **BECAUSE** the Pointer resolves the canonical browser source without copying launch details that drift or become stale.

## Delta design research

- **WHEN** proposing a delta or delta hypothesis, **ALWAYS** research how established expert repositories, tools, or domain authorities already solve the same problem before choosing names or interfaces, and cite the evidence that affects the proposal, **BECAUSE** observed conventions prevent local invention and make the change predictable.

## Design-doc hygiene

- Strip Obsidian `%% *Last Modified: ...* %%` timestamps from any markdown committed to this repo — they are fork-local vault artifacts that leak into PRs.

## Artifact drafting

- **WHEN** drafting artifacts, **NEVER** present the artifact in the chat window, **BECAUSE** you waste tokens duplicating the artifact when you **WRITE** it to a persistent location.

## Abstraction translation

- **WHEN** reporting a technical warning in chat, **ALWAYS** explain in plain language what happened, whether it affected the work, and what the user should do; **NEVER** present unexplained technical jargon, **BECAUSE** the user cannot act on information without understanding its practical consequence.
