import { fromMarkdown } from "mdast-util-from-markdown";
import { describe, expect, it } from "vitest";
import {
	jactMdastExtensions,
	jactSyntaxExtension,
} from "../../../src/core/MarkdownParser/extensions/assemble.js";
import { adaptMdastToParserOutput } from "../../../src/core/MarkdownParser/mdastAdapter.js";
import { createFileCache } from "../../../src/factories/componentFactory.js";

function adapt(content: string) {
	const ast = fromMarkdown(content, {
		extensions: [jactSyntaxExtension()],
		mdastExtensions: jactMdastExtensions(),
	});
	return adaptMdastToParserOutput(
		ast,
		content,
		"/src/doc.md",
		createFileCache(),
	);
}

describe("adaptMdastToParserOutput — mdast → ParserOutput decode", () => {
	it("decodes headings, links, and anchors in one pass", () => {
		const result = adapt(
			"# Title\n\n## Section\n\nSee [docs](other.md#Intro).\n\nA line. ^block-1",
		);

		expect(result.headings.map((h) => h.text)).toEqual(["Title", "Section"]);
		expect(result.links.some((l) => l.target.path?.raw === "other.md")).toBe(
			true,
		);
		expect(result.anchors.some((a) => a.id === "block-1")).toBe(true);
	});

	it("returns the three domain arrays even for empty content", () => {
		const result = adapt("");
		expect(result.links).toEqual([]);
		expect(result.headings).toEqual([]);
		expect(result.anchors).toEqual([]);
	});

	it("derives header anchors from headings", () => {
		const result = adapt("## My Heading\n");
		expect(result.anchors.some((a) => a.anchorType === "header")).toBe(true);
	});
});
