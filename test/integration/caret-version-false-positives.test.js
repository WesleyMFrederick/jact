import fs from "node:fs";
import { describe, expect, it } from "vitest";
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

	it("should extract uppercase hyphenated evidence tags as valid caret citations", () => {
		const content = `## Evidence Tags

^F-LK-003 - Finding link evidence
^A-004 - Analysis evidence
^H-002 - Hypothesis evidence
^Q-001 - Question evidence`;

		const parser = new MarkdownParser(fs);
		const links = parser.extractLinks(content, "/test/file.md");

		expect(links).toHaveLength(4);
		expect(links[0].target.anchor).toBe("F-LK-003");
		expect(links[1].target.anchor).toBe("A-004");
		expect(links[2].target.anchor).toBe("H-002");
		expect(links[3].target.anchor).toBe("Q-001");
	});

	it("should validate evidence tags in href context without errors (Issue #12)", () => {
		const content = `## Whiteboard

[F-LK-003](#^F-LK-003) - Finding link evidence
[A-004](#^A-004) - Analysis evidence
[H-002](#^H-002) - Hypothesis evidence`;

		const parser = new MarkdownParser(fs);
		const links = parser.extractLinks(content, "/test/file.md");

		// Filter to href-based block links (the ones that triggered Issue #12)
		const hrefBlockLinks = links.filter(
			(l) => l.linkType === "markdown" && l.anchorType === "block",
		);
		expect(hrefBlockLinks).toHaveLength(3);
		expect(hrefBlockLinks[0].target.anchor).toBe("^F-LK-003");
		expect(hrefBlockLinks[1].target.anchor).toBe("^A-004");
		expect(hrefBlockLinks[2].target.anchor).toBe("^H-002");
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
