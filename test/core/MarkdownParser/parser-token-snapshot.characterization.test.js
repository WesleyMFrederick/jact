import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { createMarkdownParser } from "../../../src/factories/componentFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES = join(__dirname, "../../fixtures");
const REPO_ROOT = join(__dirname, "../../..");

/**
 * PHASE 0 CHARACTERIZATION SNAPSHOT for the regex → mdast token migration (WMF-35).
 *
 * Captures the EXACT current token output (links, headings, anchors) of the
 * parser across a representative fixture set, BEFORE any extractor is touched.
 * Every migration phase must keep this snapshot byte-for-byte identical — it is
 * the parity net (D6). DO NOT hand-edit the committed .snap; re-baseline only
 * with `vitest -u` AFTER confirming the diff is an intended, explained change.
 *
 * Absolute paths are normalized to `<FIXTURES>/…` so the snapshot is machine
 * independent (no repo-root coupling).
 */

/** Recursively replace the machine-specific fixtures dir with a stable token. */
function normalize(value) {
	if (typeof value === "string") {
		return value
			.split(FIXTURES)
			.join("<FIXTURES>")
			.split(REPO_ROOT)
			.join("<REPO>");
	}
	if (Array.isArray(value)) {
		return value.map(normalize);
	}
	if (value && typeof value === "object") {
		const out = {};
		for (const [k, v] of Object.entries(value)) {
			out[k] = normalize(v);
		}
		return out;
	}
	return value;
}

/** Project a ParserOutput to its stable token fields (drops ast/content). */
function project(result) {
	return normalize({
		links: result.links,
		headings: result.headings,
		anchors: result.anchors,
	});
}

const FIXTURE_FILES = [
	"valid-citations.md",
	"enhanced-citations.md",
	"wiki-cross-doc.md",
	"code-blocks-with-links.md",
	"inline-code-with-links.md",
	"complex-headers.md",
	"backtick-anchors.md",
	"issue-81-block-anchor-source.md",
	"parens-in-anchors.md",
];

describe("Token extraction — Phase 0 characterization snapshot (WMF-35)", () => {
	let parser;

	beforeAll(() => {
		parser = createMarkdownParser();
	});

	for (const file of FIXTURE_FILES) {
		it(`captures token output for ${file}`, async () => {
			const result = await parser.parseFile(join(FIXTURES, file));
			expect(project(result)).toMatchSnapshot();
		});
	}
});
