/**
 * Adversarial CommonMark fixtures (AC1-AC6).
 *
 * Verifies the shipped D1 grammar (`extractWikilinks` WIKI_REGEX +
 * `getFencedCodeBlockLineSet` + `isInsideInlineCode`) against CommonMark
 * §4.5/§6.1/§6.5 edge cases per `design-docs/hardening-pipeline/fixture-template.md`.
 *
 * AC1-AC5: PASS today against shipped D1 grammar — verifies [H-D1-regex].
 * AC6:     RED until P2 ships the residual-bracket scanner (D2). The wiki
 *          count assertion already passes; the unrecognizedCount assertion
 *          is the lone RED step that flips GREEN once `extractLinks` returns
 *          `{ links, unrecognized }`.
 *
 * If AC1-AC5 fail on this run, [H-D1-regex] is FALSIFIED and the residual-
 * scanner-only delta plan must be re-scoped to also patch D1.
 */
import fs from "node:fs";
import path, { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractLinks } from "../../../src/core/MarkdownParser/extractLinks.js";
import { FileCache } from "../../../src/FileCache.js";

interface Expected {
	id: string;
	commonMarkSection: string;
	edgeCase: string;
	wikilinks: number;
	unrecognizedCount: number;
	notes: string;
}

interface ExtractLinksResult {
	links: ReturnType<typeof extractLinks>;
	unrecognized: unknown[];
}

/**
 * Adapter: shipped `extractLinks` returns `LinkObject[]`. After P2 it returns
 * `{ links, unrecognized }`. This adapter normalizes both shapes so the test
 * can assert on `unrecognized` without breaking when the return type evolves.
 */
function callExtractLinks(
	content: string,
	sourcePath: string,
	fileCache: FileCache,
): ExtractLinksResult {
	const raw = extractLinks(content, sourcePath, fileCache) as unknown;
	if (Array.isArray(raw)) {
		return { links: raw, unrecognized: [] };
	}
	const obj = raw as {
		links: ReturnType<typeof extractLinks>;
		unrecognized?: unknown[];
	};
	return { links: obj.links, unrecognized: obj.unrecognized ?? [] };
}

const FIXTURE_DIR = import.meta.dirname ?? resolve(__dirname);

function loadFixture(id: string): {
	mdPath: string;
	content: string;
	expected: Expected;
} {
	const mdPath = resolve(FIXTURE_DIR, `${id}.md`);
	const expectedPath = resolve(FIXTURE_DIR, `${id}.expected.json`);
	const content = fs.readFileSync(mdPath, "utf-8");
	const expected = JSON.parse(
		fs.readFileSync(expectedPath, "utf-8"),
	) as Expected;
	return { mdPath, content, expected };
}

const ADVERSARIAL_IDS = ["AC1", "AC2", "AC3", "AC4", "AC5", "AC6"] as const;

describe("Adversarial CommonMark — D1 grammar verification", () => {
	const fileCache = new FileCache(fs, path);

	for (const id of ADVERSARIAL_IDS) {
		describe(id, () => {
			const { mdPath, content, expected } = loadFixture(id);

			it(`extracts ${expected.wikilinks} wikilink(s) per ${expected.commonMarkSection}`, () => {
				const { links } = callExtractLinks(content, mdPath, fileCache);
				const wikiCount = links.filter((l) => l.linkType === "wiki").length;
				expect(wikiCount).toBe(expected.wikilinks);
			});

			it(`emits ${expected.unrecognizedCount} unrecognized record(s)`, () => {
				const { unrecognized } = callExtractLinks(content, mdPath, fileCache);
				expect(unrecognized.length).toBe(expected.unrecognizedCount);
			});
		});
	}
});
