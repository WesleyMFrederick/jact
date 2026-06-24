import { fromMarkdown } from "mdast-util-from-markdown";
import { visit } from "unist-util-visit";
import { describe, expect, it } from "vitest";
import {
	obsidianLinkFromMarkdown,
	obsidianLinkSyntax,
} from "../../../../src/core/MarkdownParser/extensions/obsidianLink.js";

function parse(md: string) {
	return fromMarkdown(md, {
		extensions: [obsidianLinkSyntax],
		mdastExtensions: [obsidianLinkFromMarkdown],
	});
}

function collect(md: string) {
	const found: { value: string; span: [number, number] }[] = [];
	visit(parse(md), "obsidianLink", (node) => {
		// biome-ignore lint/suspicious/noExplicitAny: custom node
		const n = node as any;
		found.push({
			value: n.value,
			span: [n.position.start.offset, n.position.end.offset],
		});
	});
	return found;
}

describe("obsidianLink extension — permissive markdown links [label](dest#anchor)", () => {
	// Forms the old extractMarkdownLinksRegex uniquely caught: a `#` anchor with a
	// raw space that CommonMark rejects (the destination terminates at the space).
	const forms: string[] = [
		"[t](file.md#a b c)", // cross-doc .md
		"[t](#a b c)", // internal
		"[t](docs/x#a b)", // relative, no .md
		"[hasAnchor](#hasAnchor(anchorId: string): boolean)", // nested parens + colon + spaces
		"[Link using raw format](anchor-matching.md#Story 1.5: Implement Cache)", // colon + spaces
	];

	for (const input of forms) {
		it(`tokenizes ${input}`, () => {
			const hits = collect(`See ${input} here.`);
			expect(hits).toHaveLength(1);
			expect(hits[0]?.value).toBe(input);
		});
	}

	it("spans the full [label](dest) including brackets", () => {
		const hits = collect("[t](#a b)");
		expect(hits[0]?.span).toEqual([0, 9]);
	});

	it("captures balanced nested parens (2 levels) inside the anchor", () => {
		const input = "[t](#`transform(input: T, fn: (item: T) => U): U[]`)";
		const hits = collect(input);
		expect(hits).toHaveLength(1);
		expect(hits[0]?.value).toBe(input);
	});

	// nok cases — these fall through to the core link / wikilink construct.
	it("does not match a plain CommonMark link (no permissive char)", () => {
		expect(collect("[t](file.md#anchor)")).toHaveLength(0);
	});

	it("does not match a link with no anchor", () => {
		expect(collect("[t](file.md)")).toHaveLength(0);
	});

	it("does not match a CommonMark titled link (no # fragment)", () => {
		expect(collect('[t](page "my title")')).toHaveLength(0);
	});

	it("does not match a wikilink", () => {
		expect(collect("[[Page#section|Display]]")).toHaveLength(0);
	});

	it("does not match a single-bracket reference", () => {
		expect(collect("[ref]")).toHaveLength(0);
	});

	// D4: micromark handles code context natively, so the hand-rolled
	// code-guard layer can retire.
	it("does not tokenize a permissive link inside an inline code span", () => {
		expect(collect("`[t](file.md#a b)`")).toHaveLength(0);
	});

	it("does not tokenize a permissive link inside a fenced code block", () => {
		expect(collect("```\n[t](file.md#a b)\n```\n")).toHaveLength(0);
	});

	it("captures multiple permissive links on one line", () => {
		const hits = collect("[a](#x y) and [b](#p q)");
		expect(hits.map((h) => h.value)).toEqual(["[a](#x y)", "[b](#p q)"]);
	});
});
