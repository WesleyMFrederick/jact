import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAX_MARKDOWN_FILE_BYTES } from "../../src/core/MarkdownParser/MarkdownParser.js";
import { createMarkdownParser } from "../../src/factories/componentFactory.js";
import { FileCache } from "../../src/FileCache.js";
import ParsedDocument, {
	MAX_FUZZY_ANCHOR_CANDIDATES,
	MAX_FUZZY_ANCHOR_LENGTH,
	MAX_FUZZY_ANCHOR_WORK,
} from "../../src/ParsedDocument.js";

let tmpDir: string;

beforeEach(() => {
	tmpDir = fs.realpathSync(
		fs.mkdtempSync(path.join(os.tmpdir(), "jact-limits-")),
	);
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

function documentWithHeadings(headings: string[]): ParsedDocument {
	const content = headings.map((h) => `## ${h}\n`).join("\n");
	return new ParsedDocument(createMarkdownParser().parseContent(content));
}

describe("Markdown file size limit", () => {
	function writeSized(bytes: number): string {
		const filePath = path.join(tmpDir, "sized.md");
		const heading = "# Sized\n\n";
		fs.writeFileSync(filePath, heading + "a".repeat(bytes - heading.length));
		return filePath;
	}

	it("parses a file at the limit", async () => {
		const parsed = await createMarkdownParser().parseFile(
			writeSized(MAX_MARKDOWN_FILE_BYTES),
		);
		expect(parsed.headings[0]?.text).toBe("Sized");
	});

	it("skips a file one byte over the limit with a clear error", async () => {
		const filePath = writeSized(MAX_MARKDOWN_FILE_BYTES + 1);
		await expect(createMarkdownParser().parseFile(filePath)).rejects.toThrow(
			`Skipped ${filePath}: file is larger than 8 MiB.`,
		);
	});
});

describe("Fuzzy anchor suggestion limits", () => {
	it("suggests anchors when the requested anchor is at the length limit", () => {
		const heading = "a".repeat(MAX_FUZZY_ANCHOR_LENGTH);
		const doc = documentWithHeadings([heading]);
		const target = `${"a".repeat(MAX_FUZZY_ANCHOR_LENGTH - 1)}b`;
		expect(doc.findSimilarAnchors(target)).toEqual([heading]);
	});

	it("skips suggestions when the requested anchor is over the length limit", () => {
		const heading = "a".repeat(MAX_FUZZY_ANCHOR_LENGTH);
		const doc = documentWithHeadings([heading]);
		const target = `${"a".repeat(MAX_FUZZY_ANCHOR_LENGTH)}b`;
		expect(doc.findSimilarAnchors(target)).toEqual([]);
	});

	it("skips candidate anchors over the length limit", () => {
		const atLimit = "a".repeat(MAX_FUZZY_ANCHOR_LENGTH);
		const overLimit = "a".repeat(MAX_FUZZY_ANCHOR_LENGTH + 1);
		const doc = documentWithHeadings([atLimit, overLimit]);
		expect(doc.findSimilarAnchors("a".repeat(250))).toEqual([atLimit]);
	});

	function fillers(count: number): string[] {
		return Array.from({ length: count }, (_, i) => `x${i}`);
	}

	it("compares the last anchor inside the candidate limit", () => {
		const doc = documentWithHeadings([
			...fillers(MAX_FUZZY_ANCHOR_CANDIDATES - 1),
			"qqqqqqqqqqqz",
		]);
		expect(doc.findSimilarAnchors("qqqqqqqqqqqq")).toEqual(["qqqqqqqqqqqz"]);
	});

	it("does not compare anchors past the candidate limit", () => {
		const doc = documentWithHeadings([
			...fillers(MAX_FUZZY_ANCHOR_CANDIDATES),
			"qqqqqqqqqqqz",
		]);
		expect(doc.findSimilarAnchors("qqqqqqqqqqqq")).toEqual([]);
	});

	it("stops suggestions after the document work budget is spent", () => {
		const heading = "a".repeat(MAX_FUZZY_ANCHOR_LENGTH);
		const doc = documentWithHeadings([heading]);
		const target = `${"a".repeat(MAX_FUZZY_ANCHOR_LENGTH - 1)}b`;
		const affordable = Math.floor(
			MAX_FUZZY_ANCHOR_WORK / (target.length * heading.length),
		);
		for (let i = 0; i < affordable; i++) {
			expect(doc.findSimilarAnchors(target)).toEqual([heading]);
		}
		expect(doc.findSimilarAnchors(target)).toEqual([]);
	});
});

describe("FileCache directory scan", () => {
	it("finishes a scan that contains directory symlink loops", () => {
		const nested = path.join(tmpDir, "d");
		fs.mkdirSync(nested);
		fs.symlinkSync("..", path.join(nested, "loop1"));
		fs.symlinkSync("..", path.join(nested, "loop2"));
		fs.writeFileSync(path.join(nested, "note.md"), "# Note\n");
		fs.writeFileSync(path.join(tmpDir, "index.md"), "# Index\n");

		const stats = new FileCache(fs, path).buildCache(tmpDir);

		expect(stats.totalFiles).toBe(2);
		expect(stats.duplicates).toBe(0);
	});
});
