import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractObsidianLinks } from "../../../src/core/MarkdownParser/extractObsidianLinks.js";
import { FileCache } from "../../../src/FileCache.js";

const SRC_PATH = "/vault/source.md";
// Empty FileCache (no buildCache call) — resolveFile always returns "not found".
// Tests here assert shape/parsing only, not path resolution.
const emptyFileCache = new FileCache(fs, path);

describe("extractObsidianLinks — 3 permissive sub-forms (table-driven)", () => {
	const cases: Array<{
		input: string;
		raw: string | null;
		anchor: string | null;
		text: string | null;
		scope: "cross-document" | "internal";
	}> = [
		{
			input: "[t](file.md#a b c)",
			raw: "file.md",
			anchor: "a b c",
			text: "t",
			scope: "cross-document",
		},
		{
			input: "[t](#a b c)",
			raw: null,
			anchor: "a b c",
			text: "t",
			scope: "internal",
		},
		{
			input: "[t](docs/x#a b)",
			raw: "docs/x",
			anchor: "a b",
			text: "t",
			scope: "cross-document",
		},
		{
			input:
				"[Link using raw format](anchor-matching.md#Story 1.5: Implement Cache)",
			raw: "anchor-matching.md",
			anchor: "Story 1.5: Implement Cache",
			text: "Link using raw format",
			scope: "cross-document",
		},
		{
			input: "[hasAnchor](#hasAnchor(anchorId: string): boolean)",
			raw: null,
			anchor: "hasAnchor(anchorId: string): boolean",
			text: "hasAnchor",
			scope: "internal",
		},
	];

	for (const { input, raw, anchor, text, scope } of cases) {
		it(`parses ${input}`, () => {
			const results = extractObsidianLinks(input, SRC_PATH, emptyFileCache);
			expect(results).toHaveLength(1);
			expect(results[0]?.target.path.raw).toBe(raw);
			expect(results[0]?.target.anchor).toBe(anchor);
			expect(results[0]?.text).toBe(text);
			expect(results[0]?.scope).toBe(scope);
		});
	}
});

describe("extractObsidianLinks — linkType discriminator", () => {
	it("sets linkType='markdown' on every result", () => {
		const source = "[a](#x y) and [b](docs/p#q r)";
		const results = extractObsidianLinks(source, SRC_PATH, emptyFileCache);
		expect(results).toHaveLength(2);
		for (const link of results) {
			expect(link.linkType).toBe("markdown");
		}
	});
});

describe("extractObsidianLinks — no false positives", () => {
	it("returns 0 results for a plain CommonMark link (handled on the core path)", () => {
		const results = extractObsidianLinks(
			"[t](file.md#anchor)",
			SRC_PATH,
			emptyFileCache,
		);
		expect(results).toHaveLength(0);
	});

	it("returns 0 results for a CommonMark titled link", () => {
		const results = extractObsidianLinks(
			'[t](page "my title")',
			SRC_PATH,
			emptyFileCache,
		);
		expect(results).toHaveLength(0);
	});
});

describe("extractObsidianLinks — fenced code block exclusion (CommonMark fences)", () => {
	it("ignores permissive links inside ``` (backtick) and ~~~ (tilde) fences", () => {
		const source = [
			"[real](#a b)",
			"```",
			"[fake](#c d)",
			"```",
			"~~~",
			"[fake2](#e f)",
			"~~~",
		].join("\n");
		const results = extractObsidianLinks(source, SRC_PATH, emptyFileCache);
		expect(results).toHaveLength(1);
		expect(results[0]?.target.anchor).toBe("a b");
	});
});
