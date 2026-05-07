import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createMarkdownParser } from "../../src/factories/componentFactory.js";

describe("phase 2 line prefilter", () => {
	it("returns no links for lines without caret characters", () => {
		const parser = createMarkdownParser();
		const content = `Plain text line
Another plain sentence with no caret marker
## Heading only`;

		const links = parser.extractLinks(content, "/test/file.md");

		expect(links).toHaveLength(0);
	});

	it("still extracts valid caret links when the guard passes through", () => {
		const parser = createMarkdownParser();
		const content = `No caret on this line
^FR1 - Functional requirement
^US1-1AC1 - Acceptance criterion`;

		const links = parser.extractLinks(content, "/test/file.md");

		expect(links).toHaveLength(2);
		expect(links.map((link) => link.target.anchor)).toEqual(["FR1", "US1-1AC1"]);
	});

	it("still filters semantic version caret ranges", () => {
		const parser = createMarkdownParser();
		const content = `| Package | Version |
|---------|---------|
| commander | ^14.0.1 |`;

		const links = parser.extractLinks(content, "/test/file.md");

		expect(links).toHaveLength(0);
	});

	it("extracts only caret-bearing lines from mixed content", () => {
		const parser = createMarkdownParser();
		const content = `No caret here
^FR1 - Functional requirement
Still no caret here
^test-anchor - Valid caret citation
| commander | ^14.0.1 |`;

		const links = parser.extractLinks(content, "/test/file.md");

		expect(links).toHaveLength(2);
		expect(links.map((link) => link.target.anchor)).toEqual(["FR1", "test-anchor"]);
	});

	it("still extracts cite links when the cite guard passes through", () => {
		const parser = createMarkdownParser();
		const content = `No citation syntax here
[cite: target.md]
^FR1 - Functional requirement`;

		const links = parser.extractLinks(content, "/test/file.md");

		expect(links).toHaveLength(2);
		expect(links[0]?.target.path.raw).toBe("target.md");
		expect(links[1]?.target.anchor).toBe("FR1");
	});

	it("keeps the includes guard before caret regex creation", () => {
		const sourcePath = resolve(
			import.meta.dirname,
			"../../src/core/MarkdownParser/extractLinks.ts",
		);
		const source = readFileSync(sourcePath, "utf8");
		const functionStart = source.indexOf("function extractCaretLinks(");
		const guardIndex = source.indexOf('if (!line.includes("^")) return;', functionStart);
		const regexIndex = source.indexOf("const caretRegex", functionStart);

		expect(functionStart).toBeGreaterThanOrEqual(0);
		expect(guardIndex).toBeGreaterThan(functionStart);
		expect(regexIndex).toBeGreaterThan(guardIndex);
	});

	it("keeps call-site guards before cite and caret extraction", () => {
		const sourcePath = resolve(
			import.meta.dirname,
			"../../src/core/MarkdownParser/extractLinks.ts",
		);
		const source = readFileSync(sourcePath, "utf8");
		const phase2Start = source.indexOf("lines.forEach((line, index) => {");
		const citeGuardIndex = source.indexOf('if (line.includes("[cite:"))', phase2Start);
		const citeCallIndex = source.indexOf("extractCiteLinks(", phase2Start);
		const caretGuardIndex = source.indexOf('if (line.includes("^"))', phase2Start);
		const caretCallIndex = source.indexOf("extractCaretLinks(", phase2Start);

		expect(phase2Start).toBeGreaterThanOrEqual(0);
		expect(citeGuardIndex).toBeGreaterThan(phase2Start);
		expect(citeCallIndex).toBeGreaterThan(citeGuardIndex);
		expect(caretGuardIndex).toBeGreaterThan(phase2Start);
		expect(caretCallIndex).toBeGreaterThan(caretGuardIndex);
	});
});
