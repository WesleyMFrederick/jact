import { describe, expect, it } from "vitest";
import { noReferenceNoteLink } from "../../../src/core/ValidationRules/rules/noReferenceNoteLink.js";
import { runRules } from "../../../src/core/ValidationRules/runRules.js";
import { createMarkdownParser } from "../../../src/factories/componentFactory.js";
import type {
	RuleFinding,
	ValidationRule,
} from "../../../src/types/validationRuleTypes.js";
import type { EnrichedLinkObject } from "../../../src/types/validationTypes.js";

async function check(
	content: string,
	overrides: Partial<EnrichedLinkObject["validation"]> = {},
) {
	const document = createMarkdownParser().parseContent(
		content,
		"/vault/note.md",
	);
	const links = document.links.map(
		(link) =>
			({
				...link,
				validation: { status: "valid", ...overrides },
			}) as EnrichedLinkObject,
	);
	const findings = noReferenceNoteLink.check({
		filePath: "/vault/note.md",
		document,
		links,
	});
	const edits = findings
		.flatMap((finding) => finding.edits ?? [])
		.sort((a, b) => b.start - a.start);
	let fixed = content;
	for (const edit of edits) {
		fixed =
			fixed.slice(0, edit.start) + edit.replacement + fixed.slice(edit.end);
	}
	return { findings, fixed };
}

describe("obsidian/no-reference-note-link", () => {
	it("flags all three usage forms of a local-file definition and inlines them (AE1, AE3)", async () => {
		const { findings, fixed } = await check(
			"See [full text][doc], [doc][], and [doc].\n\n[doc]: /abs/My%20Note.md#Some%20Heading\n",
		);
		expect(findings.map((f) => [f.ruleId, f.line, f.source])).toEqual([
			["obsidian/no-reference-note-link", 1, "[full text][doc]"],
			["obsidian/no-reference-note-link", 1, "[doc][]"],
			["obsidian/no-reference-note-link", 1, "[doc]"],
		]);
		expect(fixed).toBe(
			"See [full text](/abs/My%20Note.md#Some%20Heading), [doc](/abs/My%20Note.md#Some%20Heading), and [doc](/abs/My%20Note.md#Some%20Heading).\n\n",
		);
	});

	it("matches labels with escapes or character references to their usages", async () => {
		const { fixed } = await check(
			"[a\\*b] and [x&amp;y].\n\n[a\\*b]: one.md\n[x&amp;y]: two.md\n",
		);
		expect(fixed).toBe("[a\\*b](one.md) and [x&amp;y](two.md).\n\n");
	});

	it("keeps escaped closing brackets in every usage form's text", async () => {
		const { fixed } = await check(
			"[a\\]b][] [a\\]b] [t\\]x][a\\]b]\n\n[a\\]b]: one.md\n",
		);
		expect(fixed).toBe("[a\\]b](one.md) [a\\]b](one.md) [t\\]x](one.md)\n\n");
	});

	it("keeps the definition's title when inlining", async () => {
		const { fixed } = await check('[a][x]\n\n[x]: one.md "Tool tip"\n');
		expect(fixed).toBe('[a](one.md "Tool tip")\n\n');
	});

	it("rewrites two identical usages and deletes the definition once", async () => {
		const { findings, fixed } = await check("[a][x]\n[a][x]\n\n[x]: ./b.md\n");
		expect(findings).toHaveLength(2);
		expect(fixed).toBe("[a](./b.md)\n[a](./b.md)\n\n");
	});

	it.each(["![diagram][ASSET]", "![asset][]", "![asset]"])(
		"preserves the shared definition for image usage %s",
		async (image) => {
			const { fixed } = await check(
				`[diagram][asset]\n${image}\n\n[asset]: assets/plot.png\n`,
			);
			expect(fixed).toBe(
				`[diagram](assets/plot.png)\n${image}\n\n[asset]: assets/plot.png\n`,
			);
		},
	);

	it("matches labels case- and whitespace-insensitively", async () => {
		const { fixed } = await check("[a][My  Label]\n\n[my label]: ./b.md\n");
		expect(fixed).toBe("[a](./b.md)\n\n");
	});

	it("ignores web URLs, footnotes, and same-file anchors (AE2)", async () => {
		const { findings } = await check(
			"[a][web] [b][self] text[^1]\n\n[web]: https://example.com/x.md\n[self]: #heading\n[^1]: ./b.md\n\n# heading\n",
		);
		expect(findings).toEqual([]);
	});

	it("does not flag an unused definition", async () => {
		const { findings } = await check("text\n\n[x]: ./b.md\n");
		expect(findings).toEqual([]);
	});

	it("folds jact's anchor correction into the inlined link", async () => {
		const { fixed } = await check("[a][x]\n\n[x]: ./b.md#Old\n", {
			status: "error",
			error: "Anchor not found",
			anchorConversion: {
				type: "anchor-conversion",
				original: "Old",
				recommended: "New",
			},
		} as Partial<EnrichedLinkObject["validation"]>);
		expect(fixed).toBe("[a](./b.md#New)\n\n");
	});
});

describe("runRules", () => {
	const reporting = (id: string): ValidationRule => ({
		id,
		preset: "test",
		check: () => [
			{ ruleId: id, line: 1, column: 0, message: id } satisfies RuleFinding,
		],
	});

	it("runs every rule in the set and counts findings as errors", async () => {
		const document = createMarkdownParser().parseContent("x\n", "/vault/a.md");
		const result = runRules(
			{
				enabled: new Set(["t/a", "t/b"]),
				rules: [reporting("t/a"), reporting("t/b")],
			},
			"/vault/a.md",
			document,
			{ summary: { total: 0, valid: 0, warnings: 0, errors: 1 }, links: [] },
		);
		expect(result.findings?.map((finding) => finding.ruleId)).toEqual([
			"t/a",
			"t/b",
		]);
		expect(result.summary.errors).toBe(3);
	});
});
