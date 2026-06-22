import { fromMarkdown } from "mdast-util-from-markdown";
import { visit } from "unist-util-visit";
import { describe, expect, it } from "vitest";
import {
	caretAnchorFromMarkdown,
	caretAnchorSyntax,
} from "../../../../src/core/MarkdownParser/extensions/caretAnchor.js";

function collectAnchors(md: string) {
	const tree = fromMarkdown(md, {
		extensions: [caretAnchorSyntax],
		mdastExtensions: [caretAnchorFromMarkdown],
	});
	const found: { value: string; span: [number, number] }[] = [];
	visit(tree, "caretAnchor", (node) => {
		// biome-ignore lint/suspicious/noExplicitAny: custom node
		const n = node as any;
		found.push({
			value: n.value,
			span: [n.position.start.offset, n.position.end.offset],
		});
	});
	return found;
}

describe("caretAnchor extension (^id)", () => {
	it("captures the block-reference id without the caret", () => {
		const hits = collectAnchors("Important point. ^block-ref-1");
		expect(hits).toHaveLength(1);
		expect(hits[0]?.value).toBe("block-ref-1");
	});

	it("supports alphanumerics, dashes and underscores in the id", () => {
		const hits = collectAnchors("^US2_1AC3");
		expect(hits[0]?.value).toBe("US2_1AC3");
	});

	it("does not emit an anchor for a bare caret", () => {
		expect(collectAnchors("a ^ b")).toHaveLength(0);
	});
});
