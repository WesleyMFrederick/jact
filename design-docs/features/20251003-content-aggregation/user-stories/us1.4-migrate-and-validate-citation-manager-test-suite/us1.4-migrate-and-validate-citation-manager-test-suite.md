# Story 1.4: Migrate and Validate `citation-manager` Test Suite - DONE

> [!attention] **AI Story Shell Template Instructions**
> **CRITICAL**: This template is for Phase 1 - Story creation without task information
> **CRITICAL**: Instructions for the AI are in callouts using this format: > [!attention] **AI {{task instruction title}}**
> **CRITICAL**: Goals for a document section are in callouts using this format: > [!done] **AI {{section}} Goal**
> **CRITICAL**: Content the AI must populate are in [single brackets]. [Further instructions on how to populate, style, and length of the content are in between the brackets]
> **CRTICAL**: Examples of content are in callouts using this format: > [!example] **AI {{section}} Example**
> **CRTICAL**: All other callouts and text outside of [brackets] are content that should be populated in the final document
>
> **Prime Directive #1: Architectural Context First.** Gather complete C4 architectural context before creating story content. Every technical detail must be supported by citations to architecture documents.
>
> **Prime Directive #2: Citation Integrity.** All architectural references must be validated using citation manager before story completion. Use natural language integration for citations wherever possible.
>
> **Prime Directive #3: Story Focus.** Focus on user value and acceptance criteria derived from epic requirements. Avoid implementation details in this phase.
>
> **Prime Directive #4: Agent Preparation.** Structure Dev Notes to provide complete context for subsequent task generation phases.

**Critical LLM Initialization Instructions**: When first reading this file, you MUST IMMEDIATELY run citation manager to extract base paths: `npm run citation:base-paths <this-file-path> -- --format json`. Read ALL discovered base path files to gather complete architectural context before proceeding.

## Phase 1 Progress Tracking

> [!attention] **AI Phase 1 Progress Instructions:**
> Update this section as you complete each step of Phase 1 story creation.

- [x] **Step 1**: **CRITICAL** Gather all required files
 	- [x] Requirements document that contains epics and user stories (cc-workflows-workspace-prd.md)
 	- [x] Requirements architecture document (cc-workflows-workspace-architecture.md)
 	- [x] Citation guidelines document (from claude-code-knowledgebase)
- [x] **Step 2**: Extract story definition and acceptance criteria from PRD
- [ ] **Step 3**: Populate architectural context (Dev Notes)
 	- [ ] Architectural Context (C4)
 	- [ ] Technical Details
 	- [ ] Design Principles Adherence
 	- [ ] Previous Story Insights
- [ ] **Step 4**: Define testing requirements
 	- [ ] Test Framework and Strategy
 	- [ ] Required Test Implementation
- [ ] **Step 5**: Validate all citations using citation manager

## Status
Draft

> [!done] **AI Story Definition Goal**
> **Extract Story from Epic Requirements**
> Copy the story definition and acceptance criteria EXACTLY from the epic source document. Focus on user value and business outcomes.
> > [!attention] **AI Story Definition Instructions:**
> > - GIVEN a story from an epic/PRD, WHEN creating the story THEN copy the epic's story statement and acceptance criteria EXACTLY
> > - Use the standard "As a... I want... so that..." format
> > - Preserve original acceptance criteria with anchor references
> > - Include epic source citation for traceability

## Story

**As a** developer,
**I want** to migrate by refactoring the existing `citation-manager` test suite into the workspace and run it successfully using the shared test framework,
**so that** I can prove that no functionality has regressed during the migration.

_Source: [Epic 1: Workspace Scaffolding & citation-manager Migration](../../cc-workflows-workspace-prd.md#Story%201.4%20Migrate%20and%20Validate%20%60citation-manager%60%20Test%20Suite)_

## Acceptance Criteria

> [!attention] **AI Acceptance Criteria Instructions:**
> - Copy the epic's acceptance criteria EXACTLY with original anchor references
> - Each criterion should be independently verifiable
> - Use EARS based language (WHEN..., THEN ... SHALL; IF ..., THEN ..., SHALL; etc.)
> - Maintain original numbering from epic source

1. GIVEN the new workspace structure, WHEN the `citation-manager`'s test files and fixtures are moved, THEN they SHALL reside within the tool's directory. ^US1-4AC1
2. WHEN the root test command (e.g., `npm test`) is executed, THEN the shared test runner (Vitest) SHALL discover and run all migrated `citation-manager` tests. ^US1-4AC2
3. GIVEN the migrated test suite, WHEN the tests are run, THEN all tests MUST pass, confirming zero regressions. ^US1-4AC3
4. WHEN test migration and validation complete successfully, THEN the original location (`src/tools/utility-scripts/citation-links/`) SHALL be empty or removed. ^US1-4AC4

> **Note**: AC4 was moved from Story 1.2 following Safety-First Design principles - we preserve the legacy location until all migration, executability (US1.3), and test validation (US1.4) confirms success.

_Source: [Epic 1: Story 1.4 Acceptance Criteria](../../cc-workflows-workspace-prd.md#Story%201.4%20Migrate%20and%20Validate%20%60citation-manager%60%20Test%20Suite)_

## Tasks / Subtasks

> [!attention] **AI Tasks Section Instructions:**
> **CRITICAL**: This section should remain EMPTY in Phase 1. Tasks will be populated in Phase 2.
> Leave placeholder text indicating Phase 2 dependency.

_Tasks will be generated in Phase 2 using the task generation prompt._

## Dev Notes

> [!done] **AI Dev Notes Goal**
> **Package Complete Architectural Context**
> Gather and organize all architectural information needed for task generation in subsequent phases. Every technical detail must include proper citations.

### Architectural Context (C4)

> [!attention] **AI Architectural Context Instructions:**
> - Use C4 methodology
> - Reference specific, specific impacted system context, containers, and components architecture documents
> - Link to implementation guides
> - Use proper C4 component notation (Container.Component)

_To be populated in Phase 1 completion._

### Technical Details

> [!attention] **AI Technical Details Instructions:**
> - Extract ONLY information directly relevant to implementing the current story
> - Specify exact file paths for implementation (mark as PROPOSED for new files)
> - Reference technology stack from architecture document with links
> - Include all dependencies and technical constraints
> - Note any integration requirements

_To be populated in Phase 1 completion._

### Design Principles Adherence

> [!attention] **AI Design Principles Instructions:**
> - Reference specific design principles from the project's Design Principles document
> - Organize into Critical Principles and Anti-Patterns to Avoid
> - Include implementation guidance for each principle
> - Focus on principles most relevant to this story's implementation

_To be populated in Phase 1 completion._

### Previous Story Insights

> [!attention] **AI Previous Story Insights Instructions:**
> - Reference learnings from previous stories in the same epic
> - Note any dependencies or prerequisites from earlier stories
> - Include any course corrections or lessons learned
> - If no previous stories exist, state clearly

_To be populated in Phase 1 completion._

### Testing

> [!attention] **AI Testing Instructions:**
> - Reference testing strategy from architecture document with links
> - Specify exact test framework and approach from architecture
> - Include detailed test implementation requirements based on story acceptance criteria
> - Provide testing guidance for the specific components being implemented

_To be populated in Phase 1 completion._

### Agent Workflow Sequence

> [!attention] **AI Agent Workflow Instructions:**
> - Define the recommended sequence of agent usage for task implementation
> - Specify what each agent should focus on based on their capabilities
> - Include validation and quality gates between agent handoffs
> - Reference the agents available in the system

_To be populated in Phase 1 completion._

## Change Log

> [!attention] **AI Change Log Instructions:**
> Always include the initial creation entry. Additional entries will be added as the story evolves through phases.

| Date | Version | Description | Author |
|------|---------|-------------|---------|
| 2025-10-01 | 1.0 | Initial story creation (Phase 1 - Partial: through Acceptance Criteria) | Application Tech Lead Agent |
| | | | |

## Development Agent Record

> [!attention] **AI Development Agent Record Instructions:**
> This section is intentionally left blank in Phase 1 and will be populated by agents during implementation phases to track their work.

### Agent Model Used
[Record the specific AI agent model and version used for development. To be filled by development agent]

### Debug Log References
[Reference any debug logs or traces generated during development. To be filled by development agent]

### Completion Notes List
[Notes about the completion of tasks and any issues encountered. To be filled by development agent]

### File List
[List all files created, modified, or affected during story implementation. To be filled by development agent]

## QA Results

> [!attention] **AI QA Results Instructions:**
> This section is intentionally left blank in Phase 1 and will be populated by the QA validation agent after implementation to document test results and validation outcomes.

[Results from QA Agent review will be populated here after implementation]

## Phase 1 Completion Checklist

> [!attention] **AI Phase 1 Completion Instructions:**
> Before proceeding to Phase 2, verify all items are complete:

- [x] **Story Definition**: Copied exactly from epic with proper citation
- [x] **Acceptance Criteria**: Copied exactly from epic with anchor references
- [ ] **Architectural Context**: All affected components identified with citations
- [ ] **Technical Details**: File paths, dependencies, and constraints documented
- [ ] **Design Principles**: Relevant principles identified and application guidance provided
- [ ] **Testing Requirements**: Framework and test specifications defined
- [ ] **Agent Workflow**: Recommended agent sequence documented
- [ ] **Citation Validation**: All architectural references validated using citation manager
- [ ] **Phase 1 Progress**: All progress tracking items marked complete

**Phase 1 Ready for Phase 2**: [ ] (Check when all above items complete)

## Next Phase

When Phase 1 is complete, proceed to Phase 2 using the task generation prompt to create high-level tasks based on the architectural context gathered in this phase.
