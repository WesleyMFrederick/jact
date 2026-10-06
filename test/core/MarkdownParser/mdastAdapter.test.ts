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
	return {
		ast,
		...adaptMdastToParserOutput(
			ast,
			content,
			"/src/doc.md",
			createFileCache(),
		),
	};
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

	it("derives header anchors from headings", () => {
		const result = adapt("## My Heading\n");
		expect(result.anchors.some((a) => a.anchorType === "header")).toBe(true);
	});

	it("distinguishes raw embeds from escaped examples and keeps ordinary wiki links", () => {
		const result = adapt(
			[
				"![[img/real.png#section|Diagram]]",
				String.raw`\!\[\[img/prose.png\]\]`,
				String.raw`!\[\[img/brackets.png\]\]`,
				String.raw`\![[notes/escaped.md]]`,
				"[[notes/plain.md]]",
				"&#33;[[notes/entity.md]]",
			].join("\r\n"),
		);

		expect(result.embeds).toEqual([
			{ kind: "wiki", target: "img/real.png", line: 1 },
		]);
		expect(
			result.links.map((link) => ({
				target: link.target.path.raw,
				fullMatch: link.fullMatch,
				line: link.line,
				column: link.column,
			})),
		).toEqual([
			{
				target: "notes/escaped.md",
				fullMatch: "[[notes/escaped.md]]",
				line: 4,
				column: 2,
			},
			{
				target: "notes/plain.md",
				fullMatch: "[[notes/plain.md]]",
				line: 5,
				column: 0,
			},
			{
				target: "notes/entity.md",
				fullMatch: "[[notes/entity.md]]",
				line: 6,
				column: 5,
			},
		]);
	});

	it.each([
		"`![[img/code.png]]`",
		"```markdown\r\n![[img/code.png]]\r\n```",
		"~~~markdown\n![[img/code.png]]\n~~~",
		"    ![[img/code.png]]",
	])("ignores wiki embeds in code: %s", (content) => {
		const result = adapt(content);
		expect(result.embeds).toEqual([]);
		expect(result.links).toEqual([]);
	});

	it("preserves wiki targets without treating aliases or anchor suffixes as paths", () => {
		const result = adapt(
			[
				"![[img/p.png|200]]",
				"![[img/p.png#^block|Alias]]",
				"![[img/p.png^block]]",
				"![[img/p.png?size=2|Alias]]",
				"![[p.png]]",
				"![[#section]]",
			].join("\n"),
		);
		expect(result.embeds).toEqual([
			{ kind: "wiki", target: "img/p.png", line: 1 },
			{ kind: "wiki", target: "img/p.png", line: 2 },
			{ kind: "wiki", target: "img/p.png", line: 3 },
			{ kind: "wiki", target: "img/p.png?size=2", line: 4 },
			{ kind: "wiki", target: "p.png", line: 5 },
			{ kind: "wiki", target: "", line: 6 },
		]);
		expect(result.links).toEqual([]);
	});

	it("leaves inline images to CommonMark and reference image destinations to definitions", () => {
		const result = adapt(
			[
				'![Diagram](<img/a%20b.png?size=2#part> "Title")',
				"![Nested](img/a(b).png)",
				"![Reference][diagram]",
				"",
				'[diagram]: img/reference.png "Reference title"',
			].join("\n"),
		);
		expect(result.embeds).toEqual([
			{ kind: "markdown", target: "img/a%20b.png?size=2#part", line: 1 },
			{ kind: "markdown", target: "img/a(b).png", line: 2 },
		]);
		expect(
			result.links.map((link) => ({
				target: link.target.path.raw,
				fullMatch: link.fullMatch,
				line: link.line,
			})),
		).toEqual([
			{
				target: "img/reference.png",
				fullMatch: '[diagram]: img/reference.png "Reference title"',
				line: 5,
			},
		]);
	});

	it.each([
		{
			content: "![[caption]](notes/p.png)",
			target: "notes/p.png",
			title: null,
		},
		{
			content: '![[caption#part|Alias]](<notes/a%20b.png#part> "Diagram")',
			target: "notes/a%20b.png#part",
			title: "Diagram",
		},
		{
			content: String.raw`\\![[caption]](notes/p.png)`,
			target: "notes/p.png",
			title: null,
		},
	])(
		"preserves the CommonMark image destination in $content",
		({ content, target, title }) => {
			const result = adapt(content);
			expect(result.ast.children[0]).toMatchObject({
				type: "paragraph",
				children: expect.arrayContaining([
					expect.objectContaining({ type: "image", url: target, title }),
				]),
			});
			expect(result.embeds).toEqual([
				{ kind: "markdown", target, line: 1 },
			]);
			expect(result.links).toEqual([]);
		},
	);

	it.each([
		{
			content: "![before ![[img/nested.png]] after](outer.png)",
			alt: "before ![[img/nested.png]] after",
		},
		{
			content: "![![[img/nested.png]]](outer.png)",
			alt: "![[img/nested.png]]",
		},
		{
			content: "![**before** ![[img/nested.png]] *after*](outer.png)",
			alt: "before ![[img/nested.png]] after",
		},
		{
			content: "![![[img/**nested**.png]]](outer.png)",
			alt: "![[img/nested.png]]",
		},
		{
			content: "![![[img/a&amp;b.png]]](outer.png)",
			alt: "![[img/a&b.png]]",
		},
		{
			content: String.raw`![![[img/a\*b.png]]](outer.png)`,
			alt: "![[img/a*b.png]]",
		},
		{
			content: "![before \\*literal\\* &amp; `code` ![[img/nested.png]] after](outer.png)",
			alt: "before *literal* & code ![[img/nested.png]] after",
		},
		{
			content: "![before [inside ![[img/nested.png]]](guide.md) after](outer.png)",
			alt: "before inside ![[img/nested.png]] after",
		},
		{
			content: "![![[img/`nested`.png]]](outer.png)",
			alt: "![[img/nested.png]]",
		},
		...["_", "*", "**"].flatMap((delimiter) =>
			[
				{
					caption: `before ![[img/p.png|${delimiter}Alias]] after${delimiter} &amp; **bold**`,
					alt: "before ![[img/p.png|Alias]] after & bold",
				},
				{
					caption: `${delimiter}before ![[img/p.png|Alias${delimiter}]] after &amp; **bold**`,
					alt: "before ![[img/p.png|Alias]] after & bold",
				},
			].flatMap(({ caption, alt }) => [
				{ content: `![${caption}](outer.png)`, alt },
				{ content: `![[${caption}](guide.md)](outer.png)`, alt },
			]),
		),
	])("preserves CommonMark caption text in $content", ({ content, alt }) => {
		const result = adapt(content);
		expect(result.ast.children[0]).toMatchObject({
			type: "paragraph",
			children: [{ type: "image", url: "outer.png", alt }],
		});
		expect(result.embeds).toEqual([
			{ kind: "markdown", target: "outer.png", line: 1 },
		]);
		expect(result.links).toEqual([]);
	});

	it.each([
		{
			caption: "before ![[img/nested.png]] after",
			alt: "before ![[img/nested.png]] after",
		},
		...["_", "*", "**"].flatMap((delimiter) => [
			{
				caption: `before ![[img/p.png|${delimiter}Alias]] after${delimiter} &amp; **bold**`,
				alt: "before ![[img/p.png|Alias]] after & bold",
			},
			{
				caption: `${delimiter}before ![[img/p.png|Alias${delimiter}]] after &amp; **bold**`,
				alt: "before ![[img/p.png|Alias]] after & bold",
			},
		]),
	])("preserves wiki-like caption text in a reference image: $caption", ({ caption, alt }) => {
		const target = "img/outer%20diagram.png#part";
		const definition = `[picture]: <${target}> "Diagram"`;
		const result = adapt(`![${caption}][picture]\n\n${definition}`);
		expect(result.ast.children).toMatchObject([
			{
				type: "paragraph",
				children: [{
					type: "imageReference",
					identifier: "picture",
					alt,
				}],
			},
			{ type: "definition", identifier: "picture", url: target, title: "Diagram" },
		]);
		expect(result.embeds).toEqual([]);
		expect(result.links.map((link) => ({
			target: link.target.path.raw,
			fullMatch: link.fullMatch,
			line: link.line,
		}))).toEqual([{ target: "img/outer%20diagram.png", fullMatch: definition, line: 3 }]);
	});

	it.each([
		"[before ![[img/nested.png]] after](guide.md)",
		"[**before** ![[img/nested.png]] *after*](guide.md)",
	])("keeps real wiki embeds active inside ordinary link labels: %s", (content) => {
		const result = adapt(content);
		expect(result.ast.children[0]).toMatchObject({
			type: "paragraph",
			children: [{
				type: "link",
				url: "guide.md",
				children: expect.arrayContaining([
					expect.objectContaining({ type: "obsidianEmbed", value: "img/nested.png" }),
				]),
			}],
		});
		expect(result.embeds).toEqual([
			{ kind: "wiki", target: "img/nested.png", line: 1 },
		]);
		expect(result.links.map((link) => link.target.path.raw)).toEqual(["guide.md"]);
	});

	it.each([
		...["_", "*", "**"].flatMap((delimiter) => [
			{
				name: `${delimiter} opens inside the alias`,
				raw: `img/p.png#part|${delimiter}Alias`,
				target: "img/p.png",
				before: "before ",
				after: ` after${delimiter}`,
			},
			{
				name: `${delimiter} closes inside the alias`,
				raw: `img/p.png#part|Alias${delimiter}`,
				target: "img/p.png",
				before: `${delimiter}before `,
				after: " after",
			},
		]),
		{
			name: "underscore opens inside the target",
			raw: "img/_p.png#part|Alias",
			target: "img/_p.png",
			before: "before ",
			after: " after_",
		},
		{
			name: "underscore closes inside the target",
			raw: "img/p_.png#part|Alias",
			target: "img/p_.png",
			before: "_before ",
			after: " after",
		},
	].flatMap((fixture) => [
		{ ...fixture, context: "paragraph", inLink: false },
		{ ...fixture, context: "ordinary link caption", inLink: true },
	]))(
		"keeps raw embed boundaries when $name in a $context",
		({ raw, target, before, after, inLink }) => {
			const caption = `**bold** &amp; ${before}![[${raw}]]${after}`;
			const result = adapt(
				`${inLink ? `[${caption}](guide.md)` : caption} [next](next.md)`,
			);
			const captionChildren = [
				{ type: "strong", children: [{ type: "text", value: "bold" }] },
				{ type: "text", value: ` & ${before}` },
				{ type: "obsidianEmbed", value: raw },
				{ type: "text", value: `${after}${inLink ? "" : " "}` },
			];
			const paragraph = result.ast.children[0];
			expect(paragraph).toMatchObject({
				type: "paragraph",
				children: [
					...(inLink
						? [
								{ type: "link", url: "guide.md", children: captionChildren },
								{ type: "text", value: " " },
							]
						: captionChildren),
					{ type: "link", url: "next.md", children: [{ type: "text", value: "next" }] },
				],
			});
			if (paragraph?.type !== "paragraph") throw new Error("Expected a paragraph");
			const captionNode = paragraph.children[0];
			const embed = inLink && captionNode?.type === "link"
				? captionNode.children[2]
				: paragraph.children[2];
			expect(embed).not.toHaveProperty("children");
			expect(result.embeds).toEqual([{ kind: "wiki", target, line: 1 }]);
			expect(result.links.map((link) => link.target.path.raw)).toEqual(
				inLink ? ["guide.md", "next.md"] : ["next.md"],
			);
		},
	);

	it.each([
		"![[caption]][picture]",
		"![[caption#part|Alias]][PiCtUrE]",
		"![[caption]][ picture ]",
	])("preserves reference image usage and its definition for %s", (usage) => {
		const definition = '[picture]: notes/p.png "Diagram"';
		const result = adapt(`${usage}\n\n${definition}`);
		expect(result.ast.children[0]).toMatchObject({
			type: "paragraph",
			children: [
				{
					type: "imageReference",
					identifier: "picture",
					referenceType: "full",
				},
			],
		});
		expect(result.embeds).toEqual([]);
		expect(
			result.links.map((link) => ({
				target: link.target.path.raw,
				fullMatch: link.fullMatch,
				line: link.line,
			})),
		).toEqual([
			{ target: "notes/p.png", fullMatch: definition, line: 3 },
		]);
	});

	it.each([
		"![[notes/p.png]]",
		"![[notes/p.png#part|Alias]](unclosed",
		"![[notes/p.png]](notes/a b.png)",
		"![[notes/p.png]][missing]",
		"![[notes/p.png]][]",
	])(
		"keeps a genuine wiki embed when no CommonMark image resolves: %s",
		(content) => {
			const result = adapt(content);
			expect(result.embeds).toEqual([
				{ kind: "wiki", target: "notes/p.png", line: 1 },
			]);
			expect(result.ast.children[0]).toMatchObject({
				type: "paragraph",
				children: expect.arrayContaining([
					expect.objectContaining({ type: "obsidianEmbed" }),
				]),
			});
			expect(result.links).toEqual([]);
		},
	);

	it("falls through on malformed embed syntax without claiming a destination", () => {
		const result = adapt(
			"![[img/incomplete.png]\n![[]]\n![[img/unclosed.png\n\n[[notes/ordinary.md]]",
		);
		expect(result.embeds).toEqual([]);
		expect(result.links.map((link) => link.target.path.raw)).toEqual([
			"notes/ordinary.md",
		]);
	});

	it("uses CommonMark escape parity for the embed opener", () => {
		const result = adapt(
			[
				String.raw`\![[notes/odd.md]]`,
				String.raw`\\![[img/even.png]]`,
				String.raw`\\\![[notes/odd-again.md]]`,
			].join("\n"),
		);
		expect(result.embeds).toEqual([
			{ kind: "wiki", target: "img/even.png", line: 2 },
		]);
		expect(result.links.map((link) => link.target.path.raw)).toEqual([
			"notes/odd.md",
			"notes/odd-again.md",
		]);
	});

	it("preserves the ordinary link after an escaped Markdown image opener", () => {
		const result = adapt(String.raw`\![alt](img/escaped.png)`);
		expect(result.embeds).toEqual([]);
		expect(result.links.map((link) => link.target.path.raw)).toEqual([
			"img/escaped.png",
		]);
	});

	it("keeps a raw literal embed without children and preserves trailing text and links", () => {
		const raw = "img/nested.png|**Alias** &amp; \\*label\\* `code`";
		const result = adapt(`![[${raw}]](unclosed tail &amp; [guide](guide.md)`);
		const paragraph = result.ast.children[0];
		expect(paragraph).toMatchObject({
			type: "paragraph",
			children: [
				{ type: "obsidianEmbed", value: raw },
				{ type: "text", value: "(unclosed tail & " },
				{ type: "link", url: "guide.md", children: [{ type: "text", value: "guide" }] },
			],
		});
		if (paragraph?.type !== "paragraph") throw new Error("Expected a paragraph");
		expect(paragraph.children[0]).not.toHaveProperty("children");
		expect(result.embeds).toEqual([
			{ kind: "wiki", target: "img/nested.png", line: 1 },
		]);
		expect(result.links.map((link) => link.target.path.raw)).toEqual(["guide.md"]);
	});
});
