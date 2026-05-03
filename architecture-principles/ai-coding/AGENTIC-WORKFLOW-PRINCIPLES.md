# Agentic Workflow Principles

> Source: [The 10 Claude Code Principles](https://jdforsythe.github.io/10-principles/) by JD Forsythe

---

## Act I — Foundations

---

## The Hardening Principle

**Every fuzzy LLM step that must behave identically every time must eventually be replaced by a deterministic tool.** LLMs prototype excellently but execute poorly for deterministic work. The mismatch between probabilistic systems and mechanical execution is categorical, not marginal — deterministic tools fail loudly with debuggable errors; probabilistic systems produce plausible-but-incorrect output that erodes trust silently. ^hardening-principle-definition

- **Prototype with LLMs, Harden with Code**: Use Claude to build the tool that replaces Claude's involvement. The LLM's role in production is orchestration, reasoning, and fuzzy transformation — not mechanical execution. ^prototype-then-harden
- **Map and Categorize**: Document every LLM step in a workflow. Label each as either *fuzzy-reasoning* (creative, semantic, judgment-based — LLM-appropriate) or *reliable-execution* (identical outputs required — code-appropriate). ^map-and-categorize
- **Harden Into Deterministic Tools**: Replace mechanical LLM steps with CLI scripts, functions, or MCP servers that have well-defined inputs/outputs, loud failures, and identical behavior across runs. ^harden-into-tools
- **Fail Loudly**: Hardened tools either succeed completely or fail with a clear, diagnosable error. Silent failures are the most expensive failures. ^fail-loudly
- **Log Every Invocation**: Record every hardened tool call with arguments, return values, and timing. Observability enables measurement; measurement enables optimization. ^log-invocations
- **Test Independently**: Verify hardened tools produce identical outputs across multiple runs with known inputs and error cases before integrating them into pipelines. ^test-independently

---

## The Context Hygiene Principle

**Context is your scarcest resource. Treat it like memory in an embedded system, not disk space on a server.** Transformer self-attention creates n-squared pairwise relationships between tokens. Doubling context length quadruples relationship quantities. Every irrelevant token actively degrades performance on the tokens that matter. The optimal context utilization zone is 15–40% of the available window — above 60%, noise overwhelms signal. ^context-hygiene-definition

- **Clear Conversations Aggressively**: Execute `/clear` between work units. A work unit is one coherent task: feature implementation, test composition, PR review, or specific debugging. Re-establishing context from externalized plan files costs trivially compared to polluted sessions. ^clear-aggressively
- **Externalize State to Files**: Before clearing, save current state. Plans become plan files; decisions become ADRs; artifacts become target files. The next session retrieves content from disk — fresh, focused, positioned at high-attention context beginning. ^externalize-state
- **Front-Load Critical Information**: The U-shaped attention curve (Liu et al., 2024) demonstrates accuracy drops 30%+ when critical content lands mid-context. Position identity, vocabulary, and hard constraints at the beginning of any prompt or config file. ^front-load-critical
- **Back-Load Instructions and Retrieval Anchors**: Context conclusion receives strong attention weighting. Place step-by-step instructions, checklists, and retrieval anchors at document end. Reserve the middle for supporting reference material. ^back-load-instructions
- **Keep CLAUDE.md Lean**: Core identity, project vocabulary, hard constraints, and pointers to deeper docs — not a 5,000-token encyclopedia. A CLAUDE.md exceeding 500 lines consumes attention budget on every interaction regardless of relevance. ^lean-claude-md
- **Audit Loaded Tools**: Every connected plugin and MCP server injects tool definitions into the system prompt. Disable unused tools — they are not free. They actively dilute attention from the tools that matter. ^audit-tools
- **Design for Single-Session Completeness**: Each conversation is completely isolated. Every directive must be achievable within a single conversation's context. Continuity requirements demand file-based externalization. ^single-session-completeness

---

## The Living Documentation Principle

**Documentation is context. Stale documentation is poisoned context.** Documentation is no longer reference material for humans exercising judgment — it functions as operational instructions for agents that lack institutional context to recognize outdated guidance. Obsolete documentation actively degrades agent output; it does not merely waste tokens, it misdirects attention. ^living-documentation-definition

- **Structure for Machine-Readability**: Use YAML frontmatter, delimited Markdown sections, bulleted lists, and code blocks. Machine-readable formats provide unambiguous parsing boundaries. Prompt structure alone accounts for up to 40% performance variation (He et al., 2025). ^machine-readable-structure
- **Include Canonical Examples**: Three well-chosen examples match nine in effectiveness (LangChain, 2024). Provide 2–3 representative code blocks per convention. Models pattern-match against demonstrated structures more reliably than they follow abstract rules. ^canonical-examples
- **Automate Freshness Checks**: Treat documentation staleness as an engineering problem, not a discipline problem. Weekly CI scans; flag docs older than 30 days. Entropy is proportional to development pace. ^automate-freshness
- **Version Docs With Code**: Include documentation updates in the same PR as related code changes. Documentation that drifts from code becomes a slow-burning reliability failure. ^version-with-code
- **Capture Decisions in ADRs**: Document rationale, not just what was decided. Reasoning enables agents to generalize from the decision to adjacent cases the doc never explicitly addressed. ^capture-decisions-adrs
- **Prioritize CLAUDE.md**: Store critical conventions where Claude Code automatically reads them. Convention conflicts discovered three days and dozens of cascading failures later are documentation failures. ^prioritize-claude-md

---

## Act II — Execution Discipline

---

## The Disposable Blueprint Principle

**Never implement without a saved, versioned plan artifact. And never fall in love with one.** Planning and implementation are distinct cognitive modes that degrade when mixed. Jumping directly to code locks decisions prematurely. When AI agents can regenerate implementations from solid plans in minutes, code becomes disposable — the blueprint describing intent, structure, and constraints is the true intellectual asset. ^disposable-blueprint-definition

- **Separate Planning from Implementation**: Use `/clear` between planning and implementation sessions. This keeps each session at full attention capacity and prevents plan drift from contaminating execution. ^separate-planning-implementation
- **Commit Plans as First-Class Artifacts**: Plans committed to git survive context resets, session boundaries, team handoffs, and forgotten details. Unversioned plans disappear. "I think the plan was…" is a failure signal. ^commit-plans
- **Kill Branches, Refine Blueprints**: When an implementation goes off the rails, kill the branch, update the plan, and restart cleanly. Failed attempts become research improving the blueprint. Patching a flawed direction compounds technical debt. ^kill-and-refine
- **Use Structured Plan Sections**: Plans with labeled sections (Goal, Constraints, Architecture, File Changes, Test Strategy) have singular interpretation. Prose-based plans introduce ambiguity. Teams using documented plans produce approximately 40% fewer errors than teams relying on free-form dialogue (Hong et al., 2023). ^structured-plan-sections
- **Review Plans Before Code**: Maximum human leverage occurs at the plan review stage, not during implementation. Catch structural issues before they are baked into code. ~80% of structural issues surface during plan review. ^review-plans-first
- **Resist Sunk-Cost Attachment**: "We're too far in to start over" is the costliest habit in agentic development. Restart time after a failed approach should be measured in minutes, not hours. ^resist-sunk-cost

---

## The Institutional Memory Principle

**When an agent makes a mistake, don't just correct it — codify it forever.** Session-only corrections guarantee future repeat errors. When developers fix agent mistakes without codifying the fix, that knowledge remains local to the conversation and evaporates when the session ends. Identical errors recur across different sessions and team members because the system cannot access the institutional knowledge generated from prior corrections. ^institutional-memory-definition

- **Create an Always/Never Section in CLAUDE.md**: Maintain a living engineering handbook of project-specific patterns, rules, and past mistakes. Agents must consult and update it on every relevant task. ^always-never-section
- **Format Rules With BECAUSE Clauses**: Write rules as "Always/Never [action] BECAUSE [reason]." The BECAUSE clause activates related knowledge clusters, enabling the model to generalize to adjacent decisions the rule never explicitly mentioned. Bare directives cover only literal matches and cannot generalize. ^because-clauses
- **Use Named Anti-Patterns**: Name failure modes from your domain (e.g., "Array\<T\> anti-pattern", "deprecated-module import"). Named problems activate expert knowledge; unnamed problems receive generic responses. ^named-anti-patterns
- **Codify on Every Correction**: The moment an agent error is fixed, add the rule to the handbook. Do not batch corrections. Session-only fixes are guaranteed to repeat. ^codify-on-correction
- **Quarterly Pruning Reviews**: Obsolete rules accumulate and consume context budget with zero value. Contradictory rules cause oscillation. Review and remove stale entries quarterly. ^quarterly-pruning
- **Share Handbooks Team-Wide**: Version-control the handbook so all team members and all sessions access identical guidance. One person's codified mistake prevents everyone's repetition. ^share-team-wide

---

## The Specialized Review Principle

**A generalist reviewer trends toward the median. Specialists find what generalists can't.** Specific vocabulary activates relevant knowledge clusters in embedding space; expert language like "STRIDE threat model" accesses deeper expertise than casual phrases like "review the security." Self-evaluation fails because generator and reviewer share identical blind spots. Orchestrate a panel of specialist agents rather than a single generalist reviewer. ^specialized-review-definition

- **Identify 2–3 Critical Review Domains**: Per workflow or codebase, determine the most impactful specialist lenses — security, performance, domain logic, type safety, etc. ^identify-review-domains
- **Create Focused Specialists With Real Job Titles**: Use real domain titles (<50 tokens per identity). Flattery degrades accuracy by activating motivational content rather than domain expertise. Short, role-grounded identities outperform lengthy, sycophantic ones. ^focused-specialists
- **Load Domain Vocabulary**: Include 15–30 domain-specific vocabulary terms per specialist. Vocabulary is the primary quality lever — it routes the model into the relevant knowledge region. ^domain-vocabulary
- **Define Named Anti-Patterns With Detection Signals**: Give each specialist 5–10 named anti-patterns and how to detect them. Named anti-patterns produce specific, actionable findings; unnamed problems produce generic recommendations. ^named-anti-patterns-review
- **Run Deterministic Checks Before LLM Review**: Schema validation, linting, and type checks are deterministic. Run them first. Reserve LLM specialists for semantic and domain-specific concerns that tools cannot catch. ^deterministic-checks-first
- **Require Evidence-Backed Justifications**: Never accept bare approvals. Specialists must cite specific evidence or reasoning for clearance decisions. This prevents the rubber-stamp failure mode. ^evidence-backed-justifications
- **Separate Generation from Evaluation**: Never use the same agent to generate and review its own output. Shared blind spots guarantee shared failures. ^separate-generation-evaluation

---

## Act III — Governance & Safety

---

## The Observability Imperative

**If you can't see inside your pipeline, you're trusting it on faith.** Most multi-agent failures produce no error messages or crashes — they silently degrade output quality in ways indistinguishable from normal LLM variation. Without structured logging, systems operate on assumption rather than evidence. Observable pipelines transform debugging from archaeology into diagnosis. ^observability-definition

- **Log Every Tool Call**: Record every tool invocation with name, inputs, outputs, and duration in structured JSON format. Structured artifact chains enable debugging; raw conversation logs require archaeological analysis. ^log-tool-calls
- **Log Model Metadata**: Capture model identifier, temperature, max tokens, and system prompt hash for every LLM interaction. Reproducibility requires knowing exactly what was sent and received. ^log-model-metadata
- **Hash Artifacts at Handoffs**: Hash content at every handoff boundary to detect message loss (MAST FM-1.1) and identify divergence points. Receipt verification confirms the receiving agent got what was sent. ^hash-artifacts
- **Record Review Metrics**: Log approval latency and content for every review action. A 94% approval rate at 2-second average latency is a rubber-stamp signal, not a quality signal. Target: 5–20% rejection rate. ^record-review-metrics
- **Use JSON Structured Logging**: Unstructured printf-style logs scale poorly and resist aggregation. Structured JSON is queryable and supports pipeline diagnostics at scale. ^structured-json-logging
- **Build a Pipeline Viewer**: Create a CLI or web tool displaying artifact chains from structured logs. The ability to trace a specific failure backward through the pipeline converts hours of debugging into minutes. ^pipeline-viewer
- **Log at Boundaries, Not Everywhere**: Focus logging on tool calls, LLM interactions, handoffs, and review decisions. Logging too much buries signal in noise. ^log-at-boundaries

---

## The Strategic Human Gate Principle

**Place explicit, low-friction human approval points at the 2–3 irreversible or high-blast-radius decisions in your workflow.** LLMs exhibit sycophantic behavior by default. Review agents systematically approve work without meaningful critique because agreeable responses receive stronger training signals than critical ones. Rubber-stamp approval is the most common quality failure in multi-agent systems (MAST FM-3.1) — and it is architectural, not solvable through better prompts alone. ^human-gate-definition

- **Gate Irreversible Decisions, Not Every Step**: Identify 2–3 high-blast-radius decision points: plan finalization (before implementation), tool hardening (before infrastructure commitment), pre-deployment (before staging/production). Gate these, not routine steps. ^gate-irreversible-decisions
- **Design Low-Friction Gates**: One-key approval for routine cases. Gates that add significant overhead get bypassed under deadline pressure. The cost of routine approval must be negligible. ^low-friction-gates
- **Require Structured Risk Summaries**: At each gate, the agent presents a structured summary with identified risks, not a recommendation for approval. The human reviews evidence; the human makes the call. ^structured-risk-summaries
- **Measure Gate Rejection Rate**: Target 5–20% rejection rate. Zero rejections indicate rubber-stamping upstream. Above 30% indicates upstream quality issues that need addressing at the source, not the gate. ^measure-rejection-rate
- **Position at Decision Boundaries**: Gates belong between planning and execution, not after completion. Human leverage is highest at the moment of commitment, not after irreversible steps have run. ^position-at-boundaries

---

## The Token Economy Principle

**Tokens are money. Most people are burning it.** A 5-agent team costs 7x the tokens but produces only 3.1x the output (efficiency ratio: 0.44). At 7+ agents, total effective output can degrade while costs reach 12x. Coordination overhead grows superlinearly with team size — past a threshold, teams spend more tokens coordinating than producing. Measure first, optimize second, scale last. ^token-economy-definition

- **Apply the Cascade Pattern**: Level 0 (single well-prompted agent) → Level 1 (single agent with tools) → Level 2 (worker + reviewer) → Level 3 (3–5 adaptive agents) → Level 4 (multi-team). Never escalate until the current level demonstrably fails. "Demonstrably" means measured, not felt. ^cascade-pattern
- **Apply the 45% Threshold**: If a single well-prompted agent achieves >45% of optimal performance on a task, improve the agent — don't add more agents. Most tasks clear this threshold easily. Multi-agent coordination is the exception, not the rule. ^threshold-45-percent
- **Use Adaptive Team Composition**: Select agents based on task requirements, not static team definitions. Adaptive composition outperforms static teams by 15–25% (Captain Agent research, 2024). ^adaptive-composition
- **Cap at 3–5 Agents**: Diminishing returns start at 3 agents. At 5, marginal benefit is near zero. At 7+, total effective output can degrade. Set hard team-size caps enforced as engineering rules. ^cap-team-size
- **Track Token Spend Per Step**: Instrument workflows to log token consumption at each step. You would not ship a web application without knowing which endpoints are slow. Do not run agentic workflows without knowing which step consumes the most tokens. ^track-token-spend
- **Manage Context Loading Costs**: Every loaded plugin and MCP server adds schema and instructions that consume tokens and degrade attention on active tools. Load only the tools needed for the current task. ^manage-loading-costs
- **Measure Cost Per Useful Output**: Total token spend divided by tasks completed to acceptable quality. This number should decrease over time. Token count and agent count are vanity metrics. ^cost-per-output

---

## Act IV — Capstone

---

## The Toolkit Principle

**Knowledge without automation decays. Encode your principles into tools that enforce them automatically.** Manually following nine principles under deadline pressure is a discipline problem with a known failure mode: principles erode. The solution is engineering, not willpower. The Toolkit Principle applies the Hardening Principle recursively to the AI tool-building process itself — codify research-backed practices into reusable skills, agents, MCP servers, and automation scripts that enforce best practices without requiring conscious application. ^toolkit-principle-definition

- **Encode Principles Into Skills**: Build reusable skill packages that apply principles automatically. A skill that enforces vocabulary routing, progressive disclosure, and attention-optimized ordering cannot be forgotten under pressure. ^encode-into-skills
- **Route With Expert Vocabulary**: 15–30 domain-specific terms per skill or agent definition. Vocabulary is the primary quality lever — it routes the model into the correct knowledge region before any instructions are read. ^vocabulary-routing
- **Use Named Anti-Patterns in Skill Definitions**: 5–10 named anti-patterns with detection signals and resolution paths per skill. Named failure modes produce specific findings; unnamed problems produce generic recommendations. ^anti-patterns-in-skills
- **Separate Generation and Evaluation Criteria**: Build evaluation criteria into skills separately from generation instructions. The same agent cannot effectively review its own output — shared generation and evaluation blind spots guarantee shared failures. ^separate-generation-evaluation-skills
- **Apply Progressive Disclosure in Skill Structure**: Vocabulary and retrieval anchors at the beginning (high attention). Behavioral instructions in the middle. Retrieval anchors and checklists at the end (high attention). Never bury critical content in the middle of long documents. ^progressive-disclosure-skills
- **Manage Tool Loading Programmatically**: Use project-level configuration to load only the tools needed for a given session or task type. Checked-in profiles ensure reproducibility across team members. ^programmatic-tool-loading
- **Version Skills and Agents With Code**: Treat skill definitions as first-class code artifacts. Review them. Test them. Version-control them. Skills that drift from the codebase they serve become poisoned context. ^version-skills

---

## Anti-Patterns to Avoid

**These failure modes recur predictably across agentic workflows. Name them so they can be caught.** ^agentic-anti-patterns-definition

- **Silent Failures**: Any step that can fail without producing a detectable error. Silent failures are discovered through archaeology, not debugging. Replace with loud failures. ^silent-failures
- **Context Bloat**: Accumulating conversation history, loading all plugins, pasting full error logs instead of relevant excerpts. Bloat degrades attention quadratically. Clear aggressively; load minimally. ^context-bloat
- **Rubber-Stamp Approval**: Review agents that approve everything within seconds without substantive critique. Detectable by latency and content analysis. Structural, not promptable. Requires gate design and metric tracking. ^rubber-stamp-approval
- **Sunk-Cost Code Attachment**: Refusing to kill a branch and restart because of time invested. Code is disposable; blueprints hold the intellectual asset. Target: restart time under 5 minutes. ^sunk-cost-attachment
- **More Agents = Better**: Adding agents based on impressiveness rather than measured performance. At 7+ agents, output degrades while costs reach 12x. Establish single-agent baselines before designing multi-agent systems. ^more-agents-better
- **Session-Only Corrections**: Fixing agent errors without codifying the fix in CLAUDE.md or an engineering handbook. Session corrections that are not codified are guaranteed to repeat. ^session-only-corrections
- **Stale Documentation as Context**: Outdated conventions, superseded patterns, or resolved workarounds remaining in documentation files. Stale context does not passively waste tokens — it actively misdirects the model. Treat documentation like code: version it, maintain it, prune it. ^stale-documentation
- **Static Review Teams**: Using identical agent composition for all tasks regardless of domain. Static teams pay for idle specialists and miss domain-specific issues. Use adaptive composition. ^static-review-teams
- **Skipping Cascade Levels**: Jumping from a single agent to a 5-agent team based on intuition about complexity. Always measure current-level performance before escalating. ^skipping-cascade-levels
- **Plans Without Version Control**: Plan files that exist only in conversation context or local temp files. Unversioned plans disappear at session boundaries, team handoffs, and machine failures. ^plans-without-version-control
