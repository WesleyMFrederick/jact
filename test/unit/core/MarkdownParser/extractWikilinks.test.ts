import fs, { readFileSync } from "node:fs";
import path, { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractWikilinks } from "../../../../src/core/MarkdownParser/extractWikilinks.js";
import { FileCache } from "../../../../src/FileCache.js";

const SRC_PATH = "/vault/source.md";
// Empty FileCache (no buildCache call) — resolveFile always returns "not found".
// Tests here assert shape/parsing only, not path resolution.
const emptyFileCache = new FileCache(fs, path);
const FIXTURE_PATH = resolve(
	import.meta.dirname ?? "",
	"../../../fixtures/wikilink-baseline/probabilistic-vs-deterministic-systems.md",
);

describe("extractWikilinks — all 10 wikilink forms (table-driven)", () => {
	const cases: Array<{
		input: string;
		raw: string | null;
		anchor: string | null;
		text: string | null;
		scope: "cross-document" | "internal";
	}> = [
		{
			input: "[[Page]]",
			raw: "Page",
			anchor: null,
			text: "Page",
			scope: "cross-document",
		},
		{
			input: "[[Page|Display]]",
			raw: "Page",
			anchor: null,
			text: "Display",
			scope: "cross-document",
		},
		{
			input: "[[Page.md]]",
			raw: "Page.md",
			anchor: null,
			text: "Page.md",
			scope: "cross-document",
		},
		{
			input: "[[Page.md|Display]]",
			raw: "Page.md",
			anchor: null,
			text: "Display",
			scope: "cross-document",
		},
		{
			input: "[[Page#section]]",
			raw: "Page",
			anchor: "section",
			text: "Page",
			scope: "cross-document",
		},
		{
			input: "[[Page#section|Display]]",
			raw: "Page",
			anchor: "section",
			text: "Display",
			scope: "cross-document",
		},
		{
			input: "[[Page.md#section]]",
			raw: "Page.md",
			anchor: "section",
			text: "Page.md",
			scope: "cross-document",
		},
		{
			input: "[[Page.md#section|Display]]",
			raw: "Page.md",
			anchor: "section",
			text: "Display",
			scope: "cross-document",
		},
		{
			input: "[[#anchor]]",
			raw: null,
			anchor: "anchor",
			text: null,
			scope: "internal",
		},
		{
			input: "[[#anchor|Display]]",
			raw: null,
			anchor: "anchor",
			text: "Display",
			scope: "internal",
		},
	];

	for (const { input, raw, anchor, text, scope } of cases) {
		it(`parses ${input}`, () => {
			const results = extractWikilinks(input, SRC_PATH, emptyFileCache);
			expect(results).toHaveLength(1);
			expect(results[0]?.target.path.raw).toBe(raw);
			expect(results[0]?.target.anchor).toBe(anchor);
			expect(results[0]?.text).toBe(text);
			expect(results[0]?.scope).toBe(scope);
		});
	}
});

describe("extractWikilinks — linkType discriminator", () => {
	it("sets linkType='wiki' on every result", () => {
		const source = "[[Page]] and [[#anchor|Foo]] and [[Page#sec|Bar]]";
		const results = extractWikilinks(source, SRC_PATH, emptyFileCache);
		expect(results).toHaveLength(3);
		for (const link of results) {
			expect(link.linkType).toBe("wiki");
		}
	});
});

describe("extractWikilinks — display default", () => {
	it("defaults display to raw target when pipe-display is absent", () => {
		const results = extractWikilinks("[[Page Name]]", SRC_PATH, emptyFileCache);
		expect(results[0]?.text).toBe("Page Name");
	});
});

describe("extractWikilinks — no false positives", () => {
	it("returns 0 results for [[malformed[[ (residual bracket — D2 scope)", () => {
		const results = extractWikilinks("[[malformed[[", SRC_PATH, emptyFileCache);
		expect(results).toHaveLength(0);
	});
});

describe("extractWikilinks — fenced code block exclusion (CommonMark fences)", () => {
	it("ignores wikilinks inside ``` (backtick) and ~~~ (tilde) fences", () => {
		const source = [
			"[[real-link]]",
			"```",
			"[[fake-in-backtick-block]]",
			"```",
			"~~~",
			"[[fake-in-tilde-block]]",
			"~~~",
		].join("\n");
		const results = extractWikilinks(source, SRC_PATH, emptyFileCache);
		expect(results).toHaveLength(1);
		expect(results[0]?.target.path.raw).toBe("real-link");
	});

	it("ignores wikilinks inside ```typescript (lang-tagged backtick) fences", () => {
		const source = [
			"[[outside-fence]]",
			"```typescript",
			"const x = `[[fake-in-typed-block]]`;",
			"```",
		].join("\n");
		const results = extractWikilinks(source, SRC_PATH, emptyFileCache);
		expect(results).toHaveLength(1);
		expect(results[0]?.target.path.raw).toBe("outside-fence");
	});
});

describe("extractWikilinks — baseline fixture integration ([H-D1-regex])", () => {
	it("captures exactly 11 wikilink occurrences in baseline fixture", () => {
		const source = readFileSync(FIXTURE_PATH, "utf-8");
		const results = extractWikilinks(source, FIXTURE_PATH, emptyFileCache);
		expect(results).toHaveLength(11);
	});
});

describe("extractWikilinks — BDD: [H-D1-regex] hypothesis verification", () => {
	it("Given [[The Hardening Principle]] → target=page name, display=page name, linkType=wiki", () => {
		const results = extractWikilinks(
			"See [[The Hardening Principle]] for context.",
			SRC_PATH,
			emptyFileCache,
		);
		expect(results).toHaveLength(1);
		expect(results[0]?.target.path.raw).toBe("The Hardening Principle");
		expect(results[0]?.text).toBe("The Hardening Principle");
		expect(results[0]?.linkType).toBe("wiki");
	});

	it("Given [[Page#section|Display Text]] → target=Page, anchor=section, display=Display Text", () => {
		const results = extractWikilinks(
			"[[Page#section|Display Text]]",
			SRC_PATH,
			emptyFileCache,
		);
		expect(results).toHaveLength(1);
		expect(results[0]?.target.path.raw).toBe("Page");
		expect(results[0]?.target.anchor).toBe("section");
		expect(results[0]?.text).toBe("Display Text");
		expect(results[0]?.linkType).toBe("wiki");
	});

	it("Given [[#anchor|Display]] (internal-anchor, no page prefix) → no raw path, anchor=anchor, display=Display", () => {
		const results = extractWikilinks(
			"[[#anchor|Display]]",
			SRC_PATH,
			emptyFileCache,
		);
		expect(results).toHaveLength(1);
		expect(results[0]?.target.path.raw).toBeNull();
		expect(results[0]?.target.anchor).toBe("anchor");
		expect(results[0]?.text).toBe("Display");
		expect(results[0]?.linkType).toBe("wiki");
	});

	it("Given [[The Hardening Principle (concept)]] → target captures disambiguation suffix", () => {
		const results = extractWikilinks(
			"[[The Hardening Principle (concept)]]",
			SRC_PATH,
			emptyFileCache,
		);
		expect(results).toHaveLength(1);
		expect(results[0]?.target.path.raw).toBe(
			"The Hardening Principle (concept)",
		);
		expect(results[0]?.linkType).toBe("wiki");
	});
});
