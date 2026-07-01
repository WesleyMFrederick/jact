# jact — Agent Operating Rules

Canonical operating doc for agents working in the jact repo. Referenced by the squid `/plan` workflow and by any agent authoring plans, ADRs, or task files here.

## Tracker mode

- `TRACKER_MODE: file` — tasks are local markdown files, one per atomic task.
- **Task location:** per-feature design folder `design-docs/features/<timestamp>-<slug>/tasks/`, one file per atomic task. NOT the repo root.
- **ADR location:** `design-docs/features/<timestamp>-<slug>/spec/003-adrs.md`. NOT `docs/adr/`.

## Markdown links — surgical, to canonical source (like imports)
%% *Last Modified: 07/01/26 06:50:36* %%

- **WHEN** writing any markdown document (plans, ADRs, specs, task files, design docs) that references another document, **ALWAYS** use a surgical markdown link to the exact header/anchor of the canonical source — treat it like an `import` statement in code — **NEVER** a prose mention, a bare filename, or a paraphrase, **BECAUSE** linking to the exact section of the canonical source prevents document drift: the reader (human or LLM) resolves current truth on click instead of trusting a copy that silently goes stale.
- **Example:** a plan referencing an ADR links to the ADR file **and** its exact header — `[ADR-0001 · Decision](spec/003-adrs.md#Decision)`, never "see ADR-0001".
- **WHEN** linking to a section, **ALWAYS** use the header's **exact text** as the anchor (run `jact ast <file>` first to copy it verbatim), **BECAUSE** jact validates anchors and matches verbatim, not kebab-case.
- **WHEN** a fact already lives in a canonical doc, **ALWAYS** link to it rather than restating it, **BECAUSE** one source of truth + surgical links = no divergent copies to reconcile.
- **WHEN** the link target is a NON-markdown file (`.ts`, `.js`, `.json`, config, any non-`.md`), **NEVER** use a markdown link — write it as a bare backtick path, optionally `path:line` (e.g. `` `src/cli.ts:105` ``), **BECAUSE** jact extracts only markdown: a link to code can't be surgically extracted. Markdown links are for `.md` targets only.

## Design-doc hygiene

- Strip Obsidian `%% *Last Modified: ...* %%` timestamps from any markdown committed to this repo — they are fork-local vault artifacts that leak into PRs.
