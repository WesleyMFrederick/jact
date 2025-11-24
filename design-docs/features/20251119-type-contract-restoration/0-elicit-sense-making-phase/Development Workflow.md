---
excalidraw-plugin: parsed
tags:
  - excalidraw
---

# Development Workflow - Quick Reference

## Progressive Disclosure: Four Levels

```
┌─────────────────────────────────────────────────────────────────┐
│ LEVEL 1: HIGH-LEVEL, GENERIC                                    │
├─────────────────────────────────────────────────────────────────┤
│ Phase 1: DISCOVERY & IDEATION                                   │
│ Brainstorm → Elicit → Sense Making → Problem Framing           │
│                         ↓                                        │
│                   [Whiteboard]                                  │
│                         ↓                                        │
│              [Requirements Document]                            │
│                                                                 │
│ Output: Generic, high-level understanding                       │
│ Question: WHAT needs to be solved?                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ LEVEL 2: MEDIUM DETAIL, SYSTEM-SPECIFIC (THE BRIDGE)            │
├─────────────────────────────────────────────────────────────────┤
│ Phase 2: RESEARCH & DESIGN                                      │
│ Requirements triggers research loop:                            │
│ Gather Context → Identify Gaps → Solutions Hypothesis          │
│                         ↓              ↑                        │
│              Research Patterns ────────┘                        │
│                         ↓                                        │
│              [Phase 2 Whiteboard]                               │
│                         ↓                                        │
│                [Design Document]                                │
│                                                                 │
│ Output: System-adapted design                                   │
│ Question: HOW does this fit OUR system context?                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ LEVEL 3: HIGHER DETAIL, WORK DECOMPOSITION                      │
├─────────────────────────────────────────────────────────────────┤
│ Phase 3: SEQUENCING                                            │
│                                                                 │
│ [Requirements] ───────┐                                        │
│ [Design] ─────────────┼──→ [Sequencing Document]              │
│ [Whiteboards] ─ ─ ─ ─ ┘    (weak/optional)                    │
│                                                                 │
│ Output: Ordered work breakdown                                  │
│ Question: In what ORDER and how DECOMPOSED?                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ LEVEL 4: MAXIMUM DETAIL, EXECUTABLE                             │
├─────────────────────────────────────────────────────────────────┤
│ Phase 4: IMPLEMENTATION PLAN                                    │
│                                                                 │
│ [Sequencing] ──→ [Task Implementation Plan]                    │
│                                                                 │
│ Output: 2-5 min tasks with exact code                          │
│ Question: EXACTLY what actions to take?                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ EXECUTION OPTIONS                                               │
├─────────────────────────────────────────────────────────────────┤
│ Option A: subagent-driven-development (same session)           │
│ Option B: executing-plans (parallel session)                   │
└─────────────────────────────────────────────────────────────────┘
```

## The Bridge Concept

**Phase 2 (Research & Design) is THE BRIDGE:**

- Requirements are generic (WHAT to solve)
- Design is system-specific (HOW in YOUR context)
- The bridge adapts generic to specific through research

## Iterative Loop

Within Phase 2 Research & Design:

- Gather → Gaps → Hypothesis ⟷ Research Patterns (iterative)
- Continues until system-specific design is solid

## Key Decision Points

|Question|Answer|
|---|---|
|When to loop within Research & Design?|Until system-specific approach is validated|
|When to skip Discovery?|Requirements already exist and are clear|
|Can I skip Research & Design (the bridge)?|**NO** - Can't go from generic requirements to code|
|Can I skip Sequencing?|**NO** - Need work decomposition before tasks|
|What if requirements are already system-specific?|Then you've done the bridge - proceed to Sequencing|

## Required Skills by Phase

|Phase|Required Skill|Purpose|
|---|---|---|
|Phase 1|`writing-requirements-documents`|Transform whiteboard to formal requirements|
|Phase 2|`evaluate-against-architecture-principles`|Validate design choices|
|Phase 3|None|Work sequencing and decomposition|
|Phase 4|`writing-plans`|Bite-sized implementation tasks|
|Execution|`subagent-driven-development` OR `executing-plans`|Task execution|

## Artifacts at Each Stage (Progressive Disclosure)

1. **Whiteboard** - Informal exploration (Phase 1)
2. **Requirements Document** - High-level, generic (Level 1)
3. **Design Document** - Medium detail, system-specific (Level 2) ← THE BRIDGE
4. **Sequencing Document** - Higher detail, work decomposition (Level 3)
5. **Task Implementation Plan** - Maximum detail, 2-5 min tasks (Level 4)

## Common Mistakes

❌ Jump from Requirements directly to code (missing 2 disclosure levels) ❌ Write system-specific Requirements (they should be generic) ❌ Write generic Design (it should be system-adapted) ❌ Skip the bridge (Research & Design phase) ❌ Create Implementation Plan without Sequencing

✅ Follow progressive disclosure levels sequentially ✅ Keep Requirements generic, Design system-specific ✅ Use Research & Design to create the bridge ✅ Sequence before detailed planning ✅ Use required skills at each phase

# Development Workflow Diagram

This diagram visualizes the complete development workflow using **progressive disclosure** - from high-level generic understanding to maximum detail executable instructions.

## The Flow (Progressive Disclosure)

```mermaid
graph TD
    %% Phase 1: Discovery & Ideation
    brainstorm@{ shape: rounded, label: "Brainstorm" }
    elicit@{ shape: rounded, label: "Elicit" }
    sensemaking@{ shape: rounded, label: "Sense Making" }
    framing@{ shape: rounded, label: "Problem Framing" }
    whiteboard@{ shape: doc, label: "Whiteboard\n(Phase 1)" }
    
    %% Phase 2: Research & Design - The Bridge
    requirements@{ shape: doc, label: "Requirements\nDocument" }
    gather@{ shape: rect, label: "Gather Software &\nSystem Context" }
    gaps@{ shape: rect, label: "Identify Gaps" }
    hypothesis@{ shape: rect, label: "Solutions\nHypothesis" }
    patterns@{ shape: rect, label: "Identify Existing Patterns\nAND/OR\nResearch Working Patterns" }
    whiteboard2@{ shape: doc, label: "Whiteboard\n(Phase 2)" }
    design@{ shape: doc, label: "Design\nDocument" }
    
    %% Phase 3 & 4: Progressive Disclosure
    sequencing@{ shape: doc, label: "Sequencing\nDocument" }
    implementation@{ shape: doc, label: "Task\nImplementation Plan" }
    
    %% Phase 1 Flow
    brainstorm --> whiteboard
    elicit --> whiteboard
    sensemaking --> whiteboard
    framing --> whiteboard
    
    %% Phase 1 to Phase 2 transition
    whiteboard --> requirements
    
    %% Phase 2 Flow - The Bridge
    requirements --> gather
    gather --> gaps
    gaps --> hypothesis
    hypothesis --> patterns
    patterns --> hypothesis
    
    %% Phase 2 outputs
    hypothesis --> whiteboard2
    patterns --> whiteboard2
    whiteboard2 --> design
    
    %% Phase 3 Flow
    requirements --> sequencing
    design --> sequencing
    whiteboard -.-> sequencing
    whiteboard2 -.-> sequencing
    
    %% Phase 4 Flow
    sequencing --> implementation
    
    %% Styling
    classDef ideation fill:#fff4cc,stroke:#f4c430,stroke-width:2px
    classDef research fill:#ffe4cc,stroke:#ff9933,stroke-width:2px
    classDef doc1 fill:#e6f3ff,stroke:#4a90e2,stroke-width:2px
    classDef doc2 fill:#d1e7dd,stroke:#0f5132,stroke-width:2px
    classDef doc3 fill:#cfe2ff,stroke:#084298,stroke-width:3px
    classDef doc4 fill:#d4edda,stroke:#28a745,stroke-width:3px
    
    brainstorm:::ideation
    elicit:::ideation
    sensemaking:::ideation
    framing:::ideation
    
    gather:::research
    gaps:::research
    hypothesis:::research
    patterns:::research
    
    whiteboard:::doc1
    whiteboard2:::doc1
    requirements:::doc2
    design:::doc2
    sequencing:::doc3
    implementation:::doc4
```

## Legend

- **Yellow** - Discovery & Ideation activities (Phase 1)
- **Orange** - Research & Design activities (Phase 2 - THE BRIDGE)
- **Light blue** - Whiteboards (informal)
- **Green** - Requirements & Design (Level 1 & 2)
- **Blue** - Sequencing (Level 3)
- **Dark green** - Implementation Plan (Level 4 - maximum detail)
- **Solid arrows** - Primary flow
- **Dotted arrows** - Optional/weak inputs

## Progressive Disclosure Levels

1. **Requirements** (Light green) - Generic, high-level
2. **Design** (Green) - System-specific, medium detail ← THE BRIDGE
3. **Sequencing** (Blue) - Work decomposition, higher detail
4. **Implementation** (Dark green) - Maximum detail, executable

## Key Patterns

### Linear Flow (Progressive Disclosure)

Discovery → Whiteboard → Requirements (Level 1) → Research & Design → Design (Level 2) → Sequencing (Level 3) → Implementation (Level 4)

### Research Loop (Phase 2 - The Bridge)

Requirements triggers: Gather Context → Identify Gaps → Solutions Hypothesis ⟷ Research Patterns

### Optional Inputs

Whiteboards → Sequencing (dotted lines = may or may not be used)

## Usage

Copy the Mermaid code block above into:

- Obsidian (with Mermaid plugin)
- GitHub/GitLab markdown files
- Mermaid Live Editor (https://mermaid.live)
- Any Mermaid-compatible markdown viewer

## Related Documents

- **SKILL-development-workflow.md** - Complete skill documentation with progressive disclosure principles
- **development-workflow-reference.md** - Quick reference card showing 4 disclosure levels
- **development-workflow-corrected.mermaid** - Raw Mermaid code for this diagram

## Key Concept

This workflow implements **progressive disclosure** - the same principle Anthropic uses for Agent Skills. Start generic (Level 1), add system specificity (Level 2 - THE BRIDGE), decompose work (Level 3), specify actions (Level 4).

==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠== You can decompress Drawing data with the command palette: 'Decompress current Excalidraw file'. For more info check in plugin settings under 'Saving'


# Excalidraw Data

## Text Elements
Brainstorm ^2qIZNM66

Requirements
Document ^MmwW4dda

Elicit ^4trJhm7v

Sense Making ^TL1L8AbQ

Problem Framing ^QbERTayJ

Whiteboard ^4Sc3Pcns

Gather Software & System Context ^rrZ1unke

Identify Gaps ^7zxPFp9Q

Identify Existing Patterns AND/OR Research Working Patterns ^8DGrgNZW

Solutions Hypothesis ^sr5qVeAB

Design Document ^8AMWJoM8

Outputs | Documents | Artifacts ^Vw09GJib

Sequencing Document ^rlJz1YNc

Task Implement Plan ^jq0CvFnF

%%
## Drawing
```compressed-json
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=
```
%%