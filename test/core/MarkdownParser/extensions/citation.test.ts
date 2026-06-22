import { fromMarkdown } from "mdast-util-from-markdown";
import { visit } from "unist-util-visit";
import { describe, expect, it } from "vitest";
import {
	citationFromMarkdown,
	citationSyntax,
} from "../../../../src/core/MarkdownParser/extensions/citation.js";

function parse(md: string) {
	return fromMarkdown(md, {
		extensions: [citationSyntax],
		mdastExtensions: [citationFromMarkdown],
	});
}

function collectCitations(md: string) {
	const found: { value: string; span: [number, number] }[] = [];
	visit(parse(md), "citation", (node) => {
		// biome-ignore lint/suspicious/noExplicitAny: custom node
		const n = node as any;
		found.push({
			value: n.value,
			span: [n.position.start.offset, n.position.end.offset],
		});
	});
	return found;
}

describe("citation extension ([cite: path])", () => {
	it("captures the trimmed citation path", () => {
		const hits = collectCitations("See [cite: docs/spec.md] for details.");
		expect(hits).toHaveLength(1);
		expect(hits[0]?.value).toBe("docs/spec.md");
	});

	it("spans the full [cite: ...] including brackets", () => {
		const hits = collectCitations("[cite: a.md]");
		expect(hits[0]?.span).toEqual([0, 12]);
	});

	it("does not match a normal markdown link", () => {
		const hits = collectCitations("[text](file.md)");
		expect(hits).toHaveLength(0);
	});

	it("leaves normal links parseable when citation syntax is active", () => {
		let links = 0;
		visit(parse("[text](file.md) and [cite: x.md]"), "link", () => {
			links += 1;
		});
		expect(links).toBe(1);
	});
});
