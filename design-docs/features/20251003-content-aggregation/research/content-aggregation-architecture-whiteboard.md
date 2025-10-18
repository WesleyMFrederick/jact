# Content Aggregation Architecture Whiteboard

Excellent, that clarification is exactly what I needed. Your vision for supporting multiple markdown flavors and user configurations significantly influences the best pattern choice.

Given these future requirements, I'm revising my recommendation from the Table-Driven Method to the **Strategy Pattern**. It provides the robust extensibility you'll need without much additional upfront complexity.

-----

## Revised Recommendation: The Strategy Pattern

The Strategy pattern is now the clear winner because it's designed for exactly this scenario: a family of algorithms (the extraction rules) that need to be interchangeable and extensible. It directly supports your future goals for markdown flavors and user configuration.

### Why It's a Better Fit Now

  * **Extensibility for Flavors**: We can create different sets of strategy objects for "Obsidian" vs. "GitHub" flavors. A factory can assemble the correct set of rules based on a configuration setting, keeping flavor-specific logic cleanly separated.
  * **Configurability**: A configuration file can easily define which strategy classes to load and in what order, allowing users to customize the extraction precedence without touching the core code.
  * **Flexibility**: Each strategy is a self-contained module. Adding a new rule (like for a new marker type \`\`) is as simple as adding a new strategy class, which aligns perfectly with the **Extension Over Modification** principle.

-----

### Example Implementation in Project Context

Here’s a pragmatic, evidence-based approach to implementing the Strategy pattern for our `ExtractionEligibility` component.

#### 1\. Define the Strategy Interface

First, we define a simple contract that every extraction rule must follow. This aligns with our **"Clear Contracts"** principle.

**Location**: `tools/citation-manager/src/strategies/ExtractionStrategy.js` (new file)

```javascript
/**
 * @interface
 * Defines the contract for an extraction eligibility rule.
 */
export class ExtractionStrategy {
	/**
	 * Determines if the link is eligible for extraction based on this strategy.
	 * @param {object} link - The LinkObject from the parser.
	 * @param {object} cliFlags - CLI flags like { fullFiles: true }.
	 * @returns {{ eligible: boolean, reason: string } | null} - An eligibility decision or null if the strategy doesn't apply.
	 */
	getDecision(link, cliFlags) {
		return null; // Implement in concrete classes
	}
}
```

#### 2\. Implement Concrete Strategies

Next, we implement each rule from FR4 as its own small, testable class. Each class has a **single responsibility**.

**Location**: `tools/citation-manager/src/strategies/` (new files in this directory)

```javascript
// File: tools/citation-manager/src/strategies/StopMarkerStrategy.js
import { ExtractionStrategy } from "./ExtractionStrategy.js";

export class StopMarkerStrategy extends ExtractionStrategy {
	getDecision(link, cliFlags) {
		// This strategy ONLY applies if a stop marker exists.
		if (link.extractionMarker === "stop-extract") {
			return { eligible: false, reason: "Suppressed by %%stop-extract-link%% marker." };
		}
		// If no marker, this strategy doesn't apply, so we return null to pass to the next strategy.
		return null;
	}
}
```

```javascript
// File: tools/citation-manager/src/strategies/SectionLinkStrategy.js
import { ExtractionStrategy } from "./ExtractionStrategy.js";

export class SectionLinkStrategy extends ExtractionStrategy {
	getDecision(link, cliFlags) {
		// This is the default rule for any link with an anchor.
		if (link.anchorType !== null) {
			return { eligible: true, reason: "Default extraction for section link." };
		}
		return null;
	}
}
```

*(...and so on for `ForceMarkerStrategy`, `CliFlagStrategy`, etc.)*

#### 3\. Create the Eligibility Analyzer (The "Context")

Finally, we create the component that uses these strategies. It will hold a prioritized list of strategy objects and execute them in order until one returns a decision. This replaces the brittle `if/else` chain or the simple table processor.

**Location**: `tools/citation-manager/src/ExtractionEligibility.js`

```javascript
import { StopMarkerStrategy } from "./strategies/StopMarkerStrategy.js";
import { ForceMarkerStrategy } from "./strategies/ForceMarkerStrategy.js";
import { SectionLinkStrategy } from "./strategies/SectionLinkStrategy.js";
import { CliFlagStrategy } from "./strategies/CliFlagStrategy.js";

const DEFAULT_ACTION = {
	eligible: false,
	reason: "Default behavior for full-file link is to skip.",
};

export class ExtractionEligibility {
	/**
	 * @param {ExtractionStrategy[]} strategies - A prioritized array of strategies.
	 */
	constructor(strategies) {
		// The order of this array defines the precedence of the rules.
		this.strategies = strategies;
	}

	/**
	 * Determines if a link is eligible for extraction.
	 * @param {object} link - The LinkObject from the parser.
	 * @param {object} cliFlags - CLI flags like { fullFiles: true }.
	 * @returns {{ eligible: boolean, reason: string }}
	 */
	getDecision(link, cliFlags = {}) {
		for (const strategy of this.strategies) {
			const decision = strategy.getDecision(link, cliFlags);
			// The first strategy that returns a non-null decision wins.
			if (decision !== null) {
				return decision;
			}
		}
		return DEFAULT_ACTION;
	}
}

// In the componentFactory, we would assemble the default chain of rules:
export function createEligibilityAnalyzer() {
	const defaultStrategies = [
		new StopMarkerStrategy(),
		new ForceMarkerStrategy(),
		new SectionLinkStrategy(),
		new CliFlagStrategy(),
	];
	return new ExtractionEligibility(defaultStrategies);
}
```

This design provides a clear path to supporting your future requirements:

  * **Markdown Flavors**: We can create a `StrategyFactory` that assembles a different array of `strategies` based on a "flavor" setting.
  * **User Config**: A config file could list the strategies to use, and the factory would instantiate and order them accordingly.

---

We handle different "flavors" of markers by injecting the specific syntax patterns into our Strategy objects. This decouples the rule's logic (e.g., "stop extraction") from the syntax used to express that rule (e.g., `%%...%%` vs \`\`).

This approach keeps our Strategy classes clean and highly reusable. Here's the step-by-step implementation.

-----

#### Step 1: Define Flavors as Data

First, we represent the different syntax flavors as a simple configuration object. This aligns with our **"Behavior as Data"** principle and makes it easy to add new flavors in the future without changing the core logic.

```javascript
// A configuration object for different markdown syntaxes
const MARKER_SYNTAX = {
	obsidian: {
		// Uses %%...%% for markers
		stop: /%%stop-extract-link%%/,
		force: /%%extract-link%%/,
	},
	github: {
		// Uses for markers
		stop: //,
		force: //,
	},
	// We can easily add a 'gitlab' flavor here later...
};
```

-----

#### Step 2: Update the Strategy to Accept the Syntax

Next, we modify our Strategy classes to accept the specific syntax pattern in their constructor. The strategy no longer hard-codes the marker it's looking for; it just uses the one it's given. This is a clean use of **Dependency Injection**.

```javascript
// File: tools/citation-manager/src/strategies/StopMarkerStrategy.js
import { ExtractionStrategy } from "./ExtractionStrategy.js";

export class StopMarkerStrategy extends ExtractionStrategy {
	/**
	 * @param {RegExp} stopMarkerRegex - The regex pattern to detect a stop marker.
	 */
	constructor(stopMarkerRegex) {
		super();
		this.stopMarkerRegex = stopMarkerRegex;
	}

	getDecision(link, cliFlags) {
		// The logic is now generic. It uses the injected regex.
		if (link.rawText.match(this.stopMarkerRegex)) {
			return { eligible: false, reason: "Suppressed by stop marker." };
		}
		return null;
	}
}
```

*Note*: This example assumes the parser provides the raw text surrounding the link in a `link.rawText` property so the strategy can check for adjacent markers.

-----

#### Step 3: Use a Factory to Assemble the Correct Strategies

Finally, a factory becomes responsible for building the correct set of strategies based on a chosen flavor. It looks up the syntax from our configuration object and injects it into the strategy instances.

```javascript
// In a new file, e.g., tools/citation-manager/src/factories/strategyFactory.js

import { StopMarkerStrategy } from "../strategies/StopMarkerStrategy.js";
import { ForceMarkerStrategy } from "../strategies/ForceMarkerStrategy.js";
// ... import other strategies

const MARKER_SYNTAX = { /* from Step 1 */ };

/**
 * Creates a prioritized list of extraction strategies for a given markdown flavor.
 * @param {string} [flavor='obsidian'] - The markdown flavor ('obsidian', 'github', etc.).
 * @returns {ExtractionStrategy[]} An array of configured strategy instances.
 */
export function createExtractionStrategies(flavor = "obsidian") {
	const syntax = MARKER_SYNTAX[flavor] || MARKER_SYNTAX.obsidian;

	// The factory assembles the chain of responsibility, injecting the correct syntax.
	const strategies = [
		new StopMarkerStrategy(syntax.stop),
		new ForceMarkerStrategy(syntax.force),
		// ... other strategies that don't depend on flavor-specific syntax
	];

	return strategies;
}
```

By combining the **Strategy Pattern** with **Dependency Injection** and a **Factory**, we gain a highly flexible and extensible system for managing business rules. Adding support for a new marker syntax is as simple as updating the `MARKER_SYNTAX` configuration object—no changes to the strategy classes themselves are required.

---

We'll leverage the exact same design: use the **Strategy Pattern** to encapsulate the flavor-specific anchor validation logic and inject the correct strategy into the `CitationValidator`.

This keeps our architecture consistent. The `CitationValidator` doesn't need to know *how* to validate an anchor for a specific markdown flavor; it just delegates that task to the strategy it was given.

-----

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

-----

### 2\. Implement Flavor-Specific Strategies

Next, we create a concrete class for each flavor, implementing its unique anchor logic.

**Obsidian Strategy (URL-Escaped)**

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

**GitHub Strategy (Kebab-Case)**

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

-----

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

-----

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

### **Step 1 (RED): Update Tests to Expect the New Schema**

First, we'll modify our tests to reflect the desired state. These tests will fail, confirming our current implementation is out of date.

* **Action**: In `parser-output-contract.test.js`, update the anchor schema validation test to expect a single `AnchorObject` with both `id` (raw text) and `urlEncodedId` properties, per `US1-6AC1` and `US1-6AC2`.
* **Action**: Update the `citation-validator.test.js` and `integration/citation-validator-cache.test.js` tests to assert that validation succeeds when a link's anchor matches *either* the `id` or `urlEncodedId` of an anchor in the target file.

### **Step 2 (GREEN): Refactor `MarkdownParser`**

Next, we'll modify the parser to produce the new schema, making the updated parser tests pass.

* **Action**: In `MarkdownParser.extractAnchors()`, change the logic to create only one `AnchorObject` per header. This object will contain both the `id` (raw text) and `urlEncodedId` (Obsidian-compatible format) properties.
* **Validation**: The `parser-output-contract.test.js` suite should now pass.

### **Step 3 (GREEN): Refactor `CitationValidator`**

Finally, we'll update the validator to consume the new schema, making the validator tests pass.

* **Action**: In `CitationValidator.validateAnchorExists()`, modify the anchor matching logic to check against both the `id` and `urlEncodedId` properties of each `AnchorObject` from the parsed file.
* **Validation**: The `citation-validator.test.js` and integration tests should now pass. After this step, the full test suite should be passing with zero regressions, satisfying `US1-6AC5`.

---

## Phase 2: Implement the Strategy & Factory Patterns (After US 1.6)

With the data model now stable and correct, we can cleanly implement the Strategy pattern for handling different markdown flavors.

### **Step 4: Implement the `AnchorValidationStrategy` Pattern**

Now we introduce the new architectural pattern, building it on top of our newly refactored data model.

* **Action**: Create the `AnchorValidationStrategy` interface and the concrete `ObsidianAnchorStrategy` as detailed previously. The `ObsidianAnchorStrategy`'s `validate()` method will be written from the start to check against the `id` and `urlEncodedId` fields of the new `AnchorObject` schema.

### **Step 5: Refactor `CitationValidator` to Use the Strategy**

This is now a very simple and clean refactoring.

* **Action**: Replace the internal anchor-matching logic inside `CitationValidator.validateAnchorExists()` with a single, clean delegation to the injected strategy object: `return this.anchorValidationStrategy.validate(searchAnchor, parsed.anchors);`.

### **Step 6: Update the Factory**

We'll wire everything together in the factory.

* **Action**: Update `createCitationValidator` in `componentFactory.js` to instantiate the default `ObsidianAnchorStrategy` and inject it into the `CitationValidator`'s constructor.

By sequencing the work this way, we refactor our data model first and then build the more abstract business-logic patterns on that stable foundation. This is the most efficient path and minimizes the risk of rework.


---

Yes, exactly. We'll create a new user story to properly manage this architectural improvement.

We'll treat the work as two distinct, sequential stories:

1.  **US 1.6: Refactor Anchor Schema**: This story will focus *only* on the data model. Its goal is to refactor the `MarkdownParser` to stop creating duplicate anchor entries and for the `CitationValidator` to correctly consume this new, normalized `AnchorObject` schema. This is a prerequisite.

2.  **US 1.7: Refactor Anchor Validation to Use Strategy Pattern**: Once the data model is stable, this new story will introduce the Strategy pattern. Its goal will be to decouple the `CitationValidator` from flavor-specific logic by creating and injecting the appropriate `AnchorValidationStrategy`.

This sequence ensures we're building the new behavioral pattern on a solid data foundation, which is a cleaner, more manageable approach that aligns with our **Data Model First** principle.

---

Yes, we'll implement the extraction eligibility strategies as the core work for **User Story 2.1**.

The acceptance criteria for US 2.1 are now entirely focused on implementing the complex precedence rules from FR4, and the Strategy Pattern is our chosen architectural approach for that task.

---

## Implementation Sequence

To ensure we build on a stable foundation and minimize rework, we'll execute these stories in the following order:

1.  **First, US 1.6: Refactor Anchor Schema**
    * **Goal**: Stabilize the `AnchorObject` data model before anything else.
    * **Rationale**: This aligns with our **Data Model First** principle. We must have a clean, correct data structure before we build logic that consumes it.

2.  **Next, US 1.7: Refactor Anchor Validation to Use Strategy Pattern**
    * **Goal**: Make our core `CitationValidator` component extensible and ready for new "flavors."
    * **Rationale**: The new `extract` command is required to run validation *before* extraction. By completing this refactoring now, we ensure that the new extraction logic in US 2.1 is calling a stable, well-architected validation component, which reduces integration risk.

3.  **Then, US 2.1: Implement Extraction Eligibility using the Strategy Pattern**
    * **Goal**: Build the new extraction eligibility logic.
    * **Rationale**: With the data model stable (from US 1.6) and the validation dependency refactored (from US 1.7), we can cleanly build the new `ExtractionStrategy` classes and the `ExtractionEligibility` analyzer to satisfy the acceptance criteria of US 2.1.

This sequence ensures we address data, then refactor existing components, and finally build new features.

---

Yes, that's exactly the pattern I recommended. The "Priority Chain" or "Ordered Strategy Pattern" is a more precise name for the specific implementation of the Strategy pattern that fits our needs perfectly.

---

## How Your Description Maps to Our Plan

The characteristics you outlined are precisely what our design achieves:

* **Priority-Ordered Execution**: Our `createEligibilityAnalyzer` factory will assemble the strategies into an array in a specific, prioritized order (Stop Marker first, etc.). This ensures `%%stop-extract-link%%` is always evaluated before any other rule.
* **Early Exit on Success**: The `getDecision` method in our `ExtractionEligibility` component will loop through the strategies and return immediately once a strategy provides a non-null decision. This is the "first match wins" logic that mirrors our precedence rules.
* **Independent Strategies**: Each of our strategy classes (e.g., `StopMarkerStrategy`, `SectionLinkStrategy`) is completely decoupled. They don't know about each other, which makes them simple, reusable, and easy to test.

This pattern gives us the clean separation of the **Strategy pattern** combined with the prioritized, short-circuiting behavior of a **Chain of Responsibility**, without the ceremony of linking handlers together manually.

We will proceed with implementing this **Priority Chain** pattern for our extraction eligibility logic in User Story 2.1.

---

Excellent questions. You've correctly identified that the new requirements necessitate a more sophisticated data flow and refined data contracts. The existing `Parser Output Contract` is a general-purpose AST; for the extraction workflow, we'll derive a more focused data structure from it.

Here is the sequence of component interactions, including the proposed data model refinements to address your concerns.

-----

## Step-by-Step Component Workflow for `citation:extract`

The process is a clear pipeline where data is generated, analyzed, and then acted upon. We'll skip the caching layer as requested to focus on the core logic.

### **1. CLI Orchestrator (`citation-manager.js`)**

The user runs `npm run citation:extract <file> [--full-files]`. The orchestrator is the entry point and manages the entire workflow.

  * **Internal Call 1 (Validation)**: First, it instantiates and calls the `CitationValidator` to validate all links in the source file. This is a new requirement from **FR7** and acts as a quality gate before any content is extracted.
  * **Internal Call 2 (Parsing)**: It requests the parsed data for the source file from the `MarkdownParser`.

### **2. MarkdownParser (`MarkdownParser.js`)**

The parser's role is to analyze the raw markdown and produce a structured object. To support the new requirements, its responsibilities are now enhanced.

  * **Action (Schema Enhancement)**: As it extracts each `LinkObject`, it will now also scan the immediate context of the link for extraction markers (`%%...%%` or \`\`). It adds this information to the `LinkObject`.
  * **Action (Anchor Enhancement)**: For block anchors (`^...`), the parser will now capture the **entire line of raw text** where the anchor is found and store it in the `AnchorObject`.
  * **Output**: It returns the refined `Parser Output Contract`.

### **3. ExtractionEligibility Analyzer (`ExtractionEligibility.js`)**

This is the "brain" of the operation. It's a new, stateless component that implements the **Priority Chain (Strategy)** pattern we discussed.

  * **Input**: It receives the list of refined `LinkObject`s from the parser's output, along with the state of the `--full-files` CLI flag.
  * **Internal Call**: It iterates through its prioritized list of strategies (e.g., `StopMarkerStrategy`, `SectionLinkStrategy`). For each link, it finds the first strategy that applies and gets a decision.
  * **Output**: It produces a list of **Extraction Jobs**. Each job contains the original link, a decision (`eligible: true/false`), and the **reason** for that decision, fulfilling **FR5**.

### **4. ContentExtractor (`ContentExtractor.js`)**

This component is the "worker" that performs the mechanical task of extraction.

  * **Input**: It receives a single, approved `ExtractionJob` from the orchestrator.
  * **Internal Call**: It uses the `ParsedFileCache` to get the parsed data for the target file specified in the job.
  * **Action**: It uses the logic from our validated POCs to extract the content—either the entire file or a specific section/block.
  * **Output**: It returns a `ContentBlock` object containing the extracted text and the necessary metadata for attribution, satisfying `US2-2AC5`.

### **5. Aggregator (within `citation-manager.js`)**

The final step is performed by the orchestrator.

  * **Action**: It loops through the `ContentBlock`s returned by the `ContentExtractor`. For each block, it uses the metadata to write a formatted header (`## File: path/to/source.md#Section`) and then appends the extracted content to the output file, fulfilling **FR6**.

-----

## Refining the Data Contracts

Your observations are correct. We need to refine our data models to be more efficient and capture all necessary information.

### **`LinkObject` Enhancement**

To handle the new line-level markers, we'll add a property to the `LinkObject` schema.

  * **BEFORE**: The `LinkObject` only knew about the link itself.
  * **AFTER**: The `LinkObject` will include the extraction marker found near it.

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

### **`AnchorObject` Enhancement**

To address your point about block anchors, we will enrich the `AnchorObject` schema.

  * **BEFORE**: The `AnchorObject` for a block reference had `rawText: null`.
  * **AFTER**: The `rawText` property will now contain the full line of text the block anchor belongs to.

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