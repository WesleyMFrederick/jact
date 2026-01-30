import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { MarkdownParser } from "../../src/core/MarkdownParser/index.js";

describe("Caret version false positives (Issue #37)", () => {
	it("should NOT extract semantic version strings as caret citations", () => {
		const content = `## Technology Stack

| Technology | Version |
|------------|---------|
| Commander.js | ^14.0.1 |
| marked | ^15.0.12 |
| React | ^5.3.0 |`;

		const parser = new MarkdownParser(fs);
		const links = parser.extractLinks(content, "/test/file.md");

		// Version strings should NOT be extracted as caret citations
		expect(links).toHaveLength(0);
	});

	it("should extract valid caret citations with alphabetic start", () => {
		const content = `## Valid Citations

^FR1 - Functional requirement
^US1-1AC1 - User story with acceptance criteria
^test-anchor - Valid caret citation`;

		const parser = new MarkdownParser(fs);
		const links = parser.extractLinks(content, "/test/file.md");

		expect(links).toHaveLength(3);
		expect(links[0].target.anchor).toBe("FR1");
		expect(links[1].target.anchor).toBe("US1-1AC1");
		expect(links[2].target.anchor).toBe("test-anchor");
	});

	it("should NOT extract version strings with v-prefix as caret citations", () => {
		const content = `| Package | Version |
|---------|---------|
| Vue | ^v1.2.3 |
| React | ^v2.0.0 |`;

		const parser = new MarkdownParser(fs);
		const links = parser.extractLinks(content, "/test/file.md");

		// v-prefixed versions should NOT be extracted
		expect(links).toHaveLength(0);
	});

	it("should handle mixed valid citations and version strings", () => {
		const content = `## Requirements
^FR1 - Valid citation

## Dependencies
| Package | Version |
|---------|---------|
| marked | ^14.0.1 |

## More Requirements
^US1-1AC1 - Another valid citation`;

		const parser = new MarkdownParser(fs);
		const links = parser.extractLinks(content, "/test/file.md");

		expect(links).toHaveLength(2);
		expect(links[0].target.anchor).toBe("FR1");
		expect(links[1].target.anchor).toBe("US1-1AC1");
	});

	it("should NOT extract anchors from semantic version strings", () => {
		const content = `## Technology Stack

| Technology | Version |
|------------|---------|
| Commander.js | ^14.0.1 |
| marked | ^15.0.12 |`;

		const parser = new MarkdownParser(fs);
		const anchors = parser.extractAnchors(content);

		// Version strings should NOT be extracted as anchors
		const caretAnchors = anchors.filter((a) => a.anchorType === "block");
		expect(caretAnchors).toHaveLength(0);
	});

	it("should extract valid caret anchors", () => {
		const content = `## Section
Some content here ^valid-anchor more text`;

		const parser = new MarkdownParser(fs);
		const anchors = parser.extractAnchors(content);

		const caretAnchors = anchors.filter((a) => a.anchorType === "block");
		expect(caretAnchors).toHaveLength(1);
		expect(caretAnchors[0].id).toBe("valid-anchor");
	});
});
