# Content Aggregation Architecture Whiteboard

## How the Strategy Pattern Applies to Validation

We'll create different "anchor validation" strategies for each markdown flavor. A factory will then choose the correct strategy to inject into the `CitationValidator` at runtime.

### 1\. Define the `AnchorValidationStrategy` Interface

We start with a clear contract for what any anchor validation strategy must do.

```javascript
/**
 * @interface
 * Defines the contract for an anchor validation rule.
 */
export class AnchorValidationStrategy {
 /**
  * Checks if a given anchor exists within a list of available anchors from a target file.
  * @param {string} searchAnchor - The anchor from the link (e.g., "#my-header").
  * @param {object[]} availableAnchors - The full list of AnchorObjects from the parser.
  * @returns {{ isValid: boolean, suggestion?: string }} - The validation result.
  */
 validate(searchAnchor, availableAnchors) {
  throw new Error("Strategy must implement validate method.");
 }
}
```

---

### 2\. Implement Flavor-Specific Strategies

Next, we create a concrete class for each flavor, implementing its unique anchor logic.

**Obsidian Strategy (URL-Escaped)**:

This strategy checks for raw, URL-escaped header text.

```javascript
// File: tools/citation-manager/src/strategies/ObsidianAnchorStrategy.js
import { AnchorValidationStrategy } from "./AnchorValidationStrategy.js";

export class ObsidianAnchorStrategy extends AnchorValidationStrategy {
 validate(searchAnchor, availableAnchors) {
  // The parser already provides URL-encoded IDs for Obsidian compatibility
  const found = availableAnchors.some(anchor => `#${anchor.id}` === searchAnchor);

  if (found) {
   return { isValid: true };
  }
  // ...logic to generate suggestions if not found
  return { isValid: false, suggestion: "Anchor not found in target document." };
 }
}
```

**GitHub Strategy (Kebab-Case)**:

This strategy would generate kebab-case versions of the headers and check against them.

```javascript
// File: tools/citation-manager/src/strategies/GitHubAnchorStrategy.js
import { AnchorValidationStrategy } from "./AnchorValidationStrategy.js";

export class GitHubAnchorStrategy extends AnchorValidationStrategy {
 validate(searchAnchor, availableAnchors) {
  const found = availableAnchors.some(anchor => {
   if (anchor.anchorType !== 'header') return false;
   // Convert the header's raw text to kebab-case for comparison
   const kebabCaseId = this.#toKebabCase(anchor.rawText);
   return `#${kebabCaseId}` === searchAnchor;
  });

  if (found) {
   return { isValid: true };
  }
  return { isValid: false, suggestion: "Anchor not found." };
 }

 #toKebabCase(text) {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
 }
}
```

---

### 3\. Update `CitationValidator` to Use the Strategy

We refactor the `CitationValidator` to accept the strategy via its constructor. The complex anchor-checking logic inside `validateAnchorExists` is now replaced by a single call to the injected strategy.

```javascript
// File: tools/citation-manager/src/CitationValidator.js

export class CitationValidator {
 constructor(parsedFileCache, fileCache, anchorValidationStrategy) {
  this.parsedFileCache = parsedFileCache;
  this.fileCache = fileCache;
  // The validator holds a reference to the injected strategy.
  this.anchorValidationStrategy = anchorValidationStrategy;
 }

 async validateAnchorExists(anchor, targetFile) {
  try {
   const parsed = await this.parsedFileCache.resolveParsedFile(targetFile);
   
   // Delegate the validation logic to the injected strategy object.
   const result = this.anchorValidationStrategy.validate(anchor, parsed.anchors);
   
   return { valid: result.isValid, suggestion: result.suggestion };
  } catch (error) {
   // ... error handling
  }
 }
 // ... other validator methods
}
```

---

### 4\. Update the Factory

Finally, our `componentFactory` becomes responsible for creating and injecting the correct strategy based on configuration.

```javascript
// File: tools/citation-manager/src/factories/componentFactory.js
import { ObsidianAnchorStrategy } from '../strategies/ObsidianAnchorStrategy.js';
import { GitHubAnchorStrategy } from '../strategies/GitHubAnchorStrategy.js';
// ... other imports

export function createCitationValidator(options = {}) {
 const flavor = options.flavor || 'obsidian'; // Default to obsidian
 let anchorStrategy;

 // The factory selects the correct strategy based on the flavor.
 if (flavor === 'github') {
  anchorStrategy = new GitHubAnchorStrategy();
 } else {
  anchorStrategy = new ObsidianAnchorStrategy();
 }

 const parsedFileCache = createParsedFileCache();
 const fileCache = createFileCache();

 // Inject the selected strategy into the validator.
 return new CitationValidator(parsedFileCache, fileCache, anchorStrategy);
}
```

This approach creates a consistent, flexible, and maintainable architecture. The `CitationValidator` remains clean, and adding support for a new markdown flavor is as simple as creating a new strategy class and updating the factory.

---

This is an important and well-defined data model refactoring. We'll sequence this work to happen **before** we introduce the flavor-specific Strategy patterns.

By following our **Data Model First** principle, we'll ensure the business logic (the strategies) is built on a stable and correct data foundation, which prevents rework.

Here is the recommended implementation sequence.

---

## Phase 1: Implement US 1.6 (Refactor the Anchor Schema)

We'll use a Test-Driven Development (TDD) approach to safely refactor the anchor representation.

### Step 1 (RED): Update Tests to Expect the New Schema

First, we'll modify our tests to reflect the desired state. These tests will fail, confirming our current implementation is out of date.

- **Action**: In `parser-output-contract.test.js`, update the anchor schema validation test to expect a single `AnchorObject` with both `id` (raw text) and `urlEncodedId` properties, per `US1-6AC1` and `US1-6AC2`.
- **Action**: Update the `citation-validator.test.js` and `integration/citation-validator-cache.test.js` tests to assert that validation succeeds when a link's anchor matches _either_ the `id` or `urlEncodedId` of an anchor in the target file.

### Step 2 (GREEN): Refactor `MarkdownParser`

Next, we'll modify the parser to produce the new schema, making the updated parser tests pass.

- **Action**: In `MarkdownParser.extractAnchors()`, change the logic to create only one `AnchorObject` per header. This object will contain both the `id` (raw text) and `urlEncodedId` (Obsidian-compatible format) properties.
- **Validation**: The `parser-output-contract.test.js` suite should now pass.

### Step 3 (GREEN): Refactor `CitationValidator`

Finally, we'll update the validator to consume the new schema, making the validator tests pass.

- **Action**: In `CitationValidator.validateAnchorExists()`, modify the anchor matching logic to check against both the `id` and `urlEncodedId` properties of each `AnchorObject` from the parsed file.
- **Validation**: The `citation-validator.test.js` and integration tests should now pass. After this step, the full test suite should be passing with zero regressions, satisfying `US1-6AC5`.

---

## Phase 2: Implement the Strategy & Factory Patterns (After US 1.6)

With the data model now stable and correct, we can cleanly implement the Strategy pattern for handling different markdown flavors.

### Step 4: Implement the `AnchorValidationStrategy` Pattern

Now we introduce the new architectural pattern, building it on top of our newly refactored data model.

- **Action**: Create the `AnchorValidationStrategy` interface and the concrete `ObsidianAnchorStrategy` as detailed previously. The `ObsidianAnchorStrategy`'s `validate()` method will be written from the start to check against the `id` and `urlEncodedId` fields of the new `AnchorObject` schema.

### Step 5: Refactor `CitationValidator` to Use the Strategy

This is now a very simple and clean refactoring.

- **Action**: Replace the internal anchor-matching logic inside `CitationValidator.validateAnchorExists()` with a single, clean delegation to the injected strategy object: `return this.anchorValidationStrategy.validate(searchAnchor, parsed.anchors);`.

### Step 6: Update the Factory

We'll wire everything together in the factory.

- **Action**: Update `createCitationValidator` in `componentFactory.js` to instantiate the default `ObsidianAnchorStrategy` and inject it into the `CitationValidator`'s constructor.

By sequencing the work this way, we refactor our data model first and then build the more abstract business-logic patterns on that stable foundation. This is the most efficient path and minimizes the risk of rework.

---

Yes, exactly. We'll create a new user story to properly manage this architectural improvement.

We'll treat the work as two distinct, sequential stories:

1. **US 1.6: Refactor Anchor Schema**: This story will focus _only_ on the data model. Its goal is to refactor the `MarkdownParser` to stop creating duplicate anchor entries and for the `CitationValidator` to correctly consume this new, normalized `AnchorObject` schema. This is a prerequisite.

2. **US 1.7: Refactor Anchor Validation to Use Strategy Pattern**: Once the data model is stable, this new story will introduce the Strategy pattern. Its goal will be to decouple the `CitationValidator` from flavor-specific logic by creating and injecting the appropriate `AnchorValidationStrategy`.

This sequence ensures we're building the new behavioral pattern on a solid data foundation, which is a cleaner, more manageable approach that aligns with our **Data Model First** principle.

---

Yes, we'll implement the extraction eligibility strategies as the core work for **User Story 2.1**.

The acceptance criteria for US 2.1 are now entirely focused on implementing the complex precedence rules from FR4, and the Strategy Pattern is our chosen architectural approach for that task.

---

## Implementation Sequence

To ensure we build on a stable foundation and minimize rework, we'll execute these stories in the following order:

1. **First, US 1.6: Refactor Anchor Schema**
    - **Goal**: Stabilize the `AnchorObject` data model before anything else.
    - **Rationale**: This aligns with our **Data Model First** principle. We must have a clean, correct data structure before we build logic that consumes it.

2. **Next, US 1.7: Refactor Anchor Validation to Use Strategy Pattern**
    - **Goal**: Make our core `CitationValidator` component extensible and ready for new "flavors."
    - **Rationale**: The new `extract` command is required to run validation _before_ extraction. By completing this refactoring now, we ensure that the new extraction logic in US 2.1 is calling a stable, well-architected validation component, which reduces integration risk.

3. **Then, US 2.1: Implement Extraction Eligibility using the Strategy Pattern**
    - **Goal**: Build the new extraction eligibility logic.
    - **Rationale**: With the data model stable (from US 1.6) and the validation dependency refactored (from US 1.7), we can cleanly build the new `ExtractionStrategy` classes and the `ExtractionEligibility` analyzer to satisfy the acceptance criteria of US 2.1.

This sequence ensures we address data, then refactor existing components, and finally build new features.

---

Yes, that's exactly the pattern I recommended. The "Priority Chain" or "Ordered Strategy Pattern" is a more precise name for the specific implementation of the Strategy pattern that fits our needs perfectly.

---

## How Your Description Maps to Our Plan

The characteristics you outlined are precisely what our design achieves:

- **Priority-Ordered Execution**: Our `createEligibilityAnalyzer` factory will assemble the strategies into an array in a specific, prioritized order (Stop Marker first, etc.). This ensures `%%stop-extract-link%%` is always evaluated before any other rule.
- **Early Exit on Success**: The `getDecision` method in our `ExtractionEligibility` component will loop through the strategies and return immediately once a strategy provides a non-null decision. This is the "first match wins" logic that mirrors our precedence rules.
- **Independent Strategies**: Each of our strategy classes (e.g., `StopMarkerStrategy`, `SectionLinkStrategy`) is completely decoupled. They don't know about each other, which makes them simple, reusable, and easy to test.

This pattern gives us the clean separation of the **Strategy pattern** combined with the prioritized, short-circuiting behavior of a **Chain of Responsibility**, without the ceremony of linking handlers together manually.

We will proceed with implementing this **Priority Chain** pattern for our extraction eligibility logic in User Story 2.1.

---

Excellent questions. You've correctly identified that the new requirements necessitate a more sophisticated data flow and refined data contracts. The existing `Parser Output Contract` is a general-purpose AST; for the extraction workflow, we'll derive a more focused data structure from it.

Here is the sequence of component interactions, including the proposed data model refinements to address your concerns.

---

## Step-by-Step Component Workflow for `citation:extract`

The process is a clear pipeline where data is generated, analyzed, and then acted upon. We'll skip the caching layer as requested to focus on the core logic.

### 1. CLI Orchestrator (`citation-manager.js`)

The user runs `npm run citation:extract <file> [--full-files]`. The orchestrator is the entry point and manages the entire workflow.

- **Internal Call 1 (Validation)**: First, it instantiates and calls the `CitationValidator` to validate all links in the source file. This is a new requirement from **FR7** and acts as a quality gate before any content is extracted.
- **Internal Call 2 (Parsing)**: It requests the parsed data for the source file from the `MarkdownParser`.

### 2. MarkdownParser (`MarkdownParser.js`)

The parser's role is to analyze the raw markdown and produce a structured object. To support the new requirements, its responsibilities are now enhanced.

- **Action (Schema Enhancement)**: As it extracts each `LinkObject`, it will now also scan the immediate context of the link for extraction markers (`%%...%%` or \`\`). It adds this information to the `LinkObject`.
- **Action (Anchor Enhancement)**: For block anchors (`^...`), the parser will now capture the **entire line of raw text** where the anchor is found and store it in the `AnchorObject`.
- **Output**: It returns the refined `Parser Output Contract`.

### 3. ExtractionEligibility Analyzer (`ExtractionEligibility.js`)

This is the "brain" of the operation. It's a new, stateless component that implements the **Priority Chain (Strategy)** pattern we discussed.

- **Input**: It receives the list of refined `LinkObject`s from the parser's output, along with the state of the `--full-files` CLI flag.
- **Internal Call**: It iterates through its prioritized list of strategies (e.g., `StopMarkerStrategy`, `SectionLinkStrategy`). For each link, it finds the first strategy that applies and gets a decision.
- **Output**: It produces a list of **Extraction Jobs**. Each job contains the original link, a decision (`eligible: true/false`), and the **reason** for that decision, fulfilling **FR5**.

### 4. ContentExtractor (`ContentExtractor.js`)

This component is the "worker" that performs the mechanical task of extraction.

- **Input**: It receives a single, approved `ExtractionJob` from the orchestrator.
- **Internal Call**: It uses the `ParsedFileCache` to get the parsed data for the target file specified in the job.
- **Action**: It uses the logic from our validated POCs to extract the content—either the entire file or a specific section/block.
- **Output**: It returns a `ContentBlock` object containing the extracted text and the necessary metadata for attribution, satisfying `US2-2AC5`.

### 5. Aggregator (within `citation-manager.js`)

The final step is performed by the orchestrator.

- **Action**: It loops through the `ContentBlock`s returned by the `ContentExtractor`. For each block, it uses the metadata to write a formatted header (`## File: path/to/source.md#Section`) and then appends the extracted content to the output file, fulfilling **FR6**.

---

## Refining the Data Contracts

Your observations are correct. We need to refine our data models to be more efficient and capture all necessary information.

### `LinkObject` Enhancement

To handle the new line-level markers, we'll add a property to the `LinkObject` schema.

- **BEFORE**: The `LinkObject` only knew about the link itself.
- **AFTER**: The `LinkObject` will include the extraction marker found near it.

<!-- end list -->

```json
// In the Parser Output Contract -> links[]
{
  "linkType": "markdown",
  "scope": "cross-document",
  "anchorType": "header",
  "target": {
    "path": { "raw": "file.md" },
    "anchor": "My%20Header"
  },
  "extractionMarker": "stop-extract" // <-- NEW PROPERTY
}
```

This new `extractionMarker` property (with values like `'stop-extract'`, `'force-extract'`, or `null`) provides the necessary input for the `ExtractionEligibility` analyzer.

### `AnchorObject` Enhancement

To address your point about block anchors, we will enrich the `AnchorObject` schema.

- **BEFORE**: The `AnchorObject` for a block reference had `rawText: null`.
- **AFTER**: The `rawText` property will now contain the full line of text the block anchor belongs to.

<!-- end list -->

```json
// In the Parser Output Contract -> anchors[]
{
  "anchorType": "block",
  "id": "first-section-intro",
  // The full line of content is now captured.
  "rawText": "This is the content of the first section. ^first-section-intro",
  "fullMatch": "^first-section-intro",
  "line": 7,
  "column": 78
}
```

This change makes the `AnchorObject` self-contained and provides the `ContentExtractor` with the exact text to extract for block references without needing to re-read the file content. It's a more efficient and direct data model.
