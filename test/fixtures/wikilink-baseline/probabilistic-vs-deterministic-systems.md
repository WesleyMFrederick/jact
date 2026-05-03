---
title: Probabilistic vs Deterministic Systems
created: 2026-05-02T00:00:00Z
updated: 2026-05-02T00:00:00Z
type: concept
tags: [llm-engineering, agentic-workflows, determinism, reliability, hardening]
---

# Probabilistic vs Deterministic Systems

%% *Last Modified: 05/02/26 14:25:22* %%

A classification distinguishing two computational paradigms whose reliability profiles differ **categorically**, not marginally [^S-1]. The distinction is the foundation of [[the-hardening-principle|The Hardening Principle]] [[The Hardening Principle (concept)]] — a workflow's correctness depends on routing each step to the paradigm that handles it reliably.

> [!Important]
> - **Probabilistic system** — produces output by sampling from a learned distribution. Same input can produce *different* outputs across runs because output depends on the entire context window, not just the local input [^S-2]. LLMs are the canonical example.
> - **Deterministic system** — produces *byte-identical* output for identical input on every execution. Behavior is defined by code, not inferred from patterns [^S-3]. `ffmpeg`, file I/O, lookup-table generation are canonical examples.

The reliability gap between the two paradigms is **measurable** at the model layer, not just anecdotal. State-of-the-art LLMs score ~76 % on tool-call accuracy benchmarks [^S-4] and drop ~60 % on multi-trial reliability when the same task is re-run [^S-5]. Deterministic implementations of the same mechanical steps are 100 % reliable by construction [^S-3].

## Definition

%% *Last Modified: 05/02/26 14:25:22* %%

A system is **deterministic** if and only if: ∀ inputs `x`, ∀ executions `e₁, e₂` of the system on `x`, the outputs `f(x, e₁) = f(x, e₂)` byte-identically [^S-3].

A system is **probabilistic** if its output distribution over executions on the same input has variance > 0 [^S-2]. Even at temperature zero, LLMs remain probabilistic because the "single most probable next token" depends on the entire context, and minor context shifts (tokenization differences, ordering, KV-cache state) can change selection [^S-2].

## Why the distinction matters

%% *Last Modified: 05/02/26 14:25:22* %%

Production workflows mix steps that demand identical-behavior-every-time (file I/O, format conversion, lookup-based generation) with steps that benefit from creative synthesis (summarization, intent classification, novel reasoning) [^S-6]. Routing the first kind through a probabilistic system produces **silent failures** — outputs that look plausible but are wrong, drop steps, or differ subtly across runs [^S-7]. Routing the second kind through a brittle deterministic algorithm fails on every case the algorithm did not anticipate [^S-8].

The engineering discipline is **separation of concerns applied to the probabilistic-deterministic boundary** [^S-9]: fuzzy reasoning gets the LLM, mechanical execution gets deterministic code. This is the architecture-level statement of [[The Hardening Principle]].

## Failure modes

%% *Last Modified: 05/02/26 14:25:22* %%

Two categorically different failure profiles [^S-7]:

| | Probabilistic | Deterministic |
|---|---|---|
| **Failure shape** | Plausible-but-wrong output, dropped steps, subtly different results | Stack trace, exit code, missing output |
| **Detectability** | Low — looks like success | High — fails loudly |
| **Recovery** | Manual verification of every output | Read the error, fix the cause |
| **Trust dynamics** | Erodes — "check just to be sure" rituals proliferate | Builds — verified once, trusted thereafter |

Forsythe calls the trust deficit "the invisible tax of never fully trusting your own tools" [^S-10] — a real but diffuse cost spread across hundreds of small moments of friction.

## When each is the right tool

%% *Last Modified: 05/02/26 14:25:22* %%

**Probabilistic (LLM) when:**

- Two equally-valid outputs could differ for the same input, and that's acceptable [^S-8].
- The task is summarization, classification, intent extraction, creative synthesis, novel reasoning [^S-6].
- The input space is too large or unstructured to enumerate cases for a brittle algorithm [^S-8].

**Deterministic (code) when:**

- A correct implementation produces byte-identical output for byte-identical input [^S-3].
- The step is mechanical: file I/O, format conversion, lookup-based generation, network calls with structured payloads [^S-6].
- The cost of silent failure is high (data loss, incorrect side effects) [^S-7].

The four-condition hardening test — currently LLM-executed, identical-output property holds, failures are silent, workflow is stable — operationalizes the choice [^S-11].

## Examples

%% *Last Modified: 05/02/26 14:25:22* %%

- **`ffmpeg` audio conversion** — deterministic. Same input WAV → same output every time [^S-12].
- **Wikilink resolution against a known vault index** — deterministic. Same vault state + same target page set → same links [^S-13].
- **Summarization of a transcript** — probabilistic. Two reasonable summaries can differ [^S-14].
- **Intent classification ("transcribe? summarize? both?")** — probabilistic. Fuzzy reasoning over user phrasing [^S-14].

## Related Concepts

%% *Last Modified: 05/02/26 14:25:22* %%

- [[The Hardening Principle (concept)]] — the engineering principle that operationalizes the distinction
- [[Silent Failure]] — the most expensive failure mode of probabilistic systems
- [[Separation of Concerns]] — the foundational discipline behind the principle
- [[Determinism]] — the property required of mechanical steps
- [[Building Effective Agents]] — Anthropic's workflow-vs-agent distinction is this same boundary at the architecture layer

## Mentions

%% *Last Modified: 05/02/26 14:25:22* %%

- [[The Hardening Principle]] — source summary that introduced this distinction to the wiki
- [[The Hardening Principle (concept)]] — concept page that bullet-references this page
- [[Hardening Principle — Open Questions Research]] — synthesis that surfaced this as a missing concept page

## Questions

%% *Last Modified: 05/02/26 14:25:22* %%

**Q1: Are LLMs at temperature zero truly probabilistic, or just hard-to-predict deterministic functions?** **STRENGTHENED.**
> A: Probabilistic in the operational sense relevant to workflow reliability. Even at temp 0, the "single most probable next token" depends on the entire context, and KV-cache state, tokenization differences, and floating-point non-associativity in attention can change selection across runs on identical input strings [^S-2]. The reproducibility gap is measurable: τ-bench's `pass^k` metric shows agents (built on temp-0 LLMs in many cases) failing to consistently solve the same task on re-runs [^S-5].

**Q2: Is there a middle ground (e.g., constrained decoding, tool-use schemas) that recovers determinism for some LLM steps?** **OPEN.**
> A: Constrained decoding (JSON-mode, regex-constrained generation, tool-call schemas) reduces *output-shape* variance but does not eliminate *output-content* variance. The same prompt with the same tool schema can still call the tool with different arguments. This is a [Q] worth its own research pass.

---

## Source Footnotes

%% *Last Modified: 05/02/26 14:25:22* %%

[^S-1]: #OBS `raw-sources/claude-code-principles/the-hardening-principle.md:52` — "The reliability gap between these two paradigms is not marginal. It is categorical."

[^S-2]: #OBS `raw-sources/claude-code-principles/the-hardening-principle.md:48` — "LLMs are probabilistic systems. Every output is sampled from a distribution of possible next tokens, weighted by the model's learned parameters and the current context. Even at temperature zero, the model is selecting the single most probable token at each step — which means the output is a function of the entire context window."

[^S-3]: #OBS `raw-sources/claude-code-principles/the-hardening-principle.md:50` — "Deterministic systems, by contrast, produce the same output for the same input every time. An ffmpeg command that converts audio to WAV will produce byte-identical output on every execution."

[^S-4]: #OBS `https://gorilla.cs.berkeley.edu/leaderboard.html` and `https://pricepertoken.com/leaderboards/benchmark/bfcl-v3` — Berkeley Function-Calling Leaderboard V4; leading model GLM 4.5 scores 76.7 on BFCL v3 as of 2026-04-21.

[^S-5]: #OBS `https://sierra.ai/blog/benchmarking-ai-agents` — τ-bench `pass^k` metric: GPT-4o on τ-retail drops to ~25 % on `pass^8`, a 60 % drop from `pass^1`.

[^S-6]: #OBS `raw-sources/claude-code-principles/the-hardening-principle.md:36` — "Converting audio to WAV is not a creative act. Writing a file to disk is not a judgment call. Generating wikilinks from a known set of page titles is not a task that benefits from probabilistic reasoning."

[^S-7]: #OBS `raw-sources/claude-code-principles/the-hardening-principle.md:52,170` — "A deterministic tool either works or fails loudly with a stack trace you can debug. A probabilistic system can fail in ways that look like success... Silent failures are the most expensive failures — hardened tools fail loudly or succeed completely."

[^S-8]: #OBS `raw-sources/claude-code-principles/the-hardening-principle.md:140` — "If you try to replace 'summarize this transcript' with a deterministic algorithm, you will build something brittle that handles only the cases you anticipated and fails on everything else."

[^S-9]: #OBS `raw-sources/claude-code-principles/the-hardening-principle.md:56` — "The engineering discipline is separation of concerns applied to the probabilistic-deterministic boundary."

[^S-10]: #OBS `raw-sources/claude-code-principles/the-hardening-principle.md:38` — "the invisible tax of never fully trusting your own tools."

[^S-11]: #OBS `wiki/concepts/the-hardening-principle.md` — four-condition hardening test (`## Definition` section).

[^S-12]: #OBS `raw-sources/claude-code-principles/the-hardening-principle.md:50` — "An ffmpeg command that converts audio to WAV will produce byte-identical output on every execution."

[^S-13]: #OBS `raw-sources/claude-code-principles/the-hardening-principle.md:82` — "The wikilinks are correct because they resolve against the actual vault index, not the LLM's guess at what pages might exist."

[^S-14]: #OBS `raw-sources/claude-code-principles/the-hardening-principle.md:54` — "The meeting pipeline had genuinely fuzzy steps (summarize this transcript, extract action items, determine which projects are relevant) mixed with purely mechanical steps."
