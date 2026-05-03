import fs, { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path, { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractLinks } from "../../src/core/MarkdownParser/extractLinks.js";
import { FileCache } from "../../src/FileCache.js";

// Empty file cache; tests assert extraction shape only, not cache hits.
const emptyFileCache = new FileCache(fs, path);

function tmpSourcePath(content: string): string {
	const dir = mkdtempSync(join(tmpdir(), "jact-fenced-"));
	const p = join(dir, "src.md");
	writeFileSync(p, content);
	return p;
}

describe("extractLinks — regex extractors skip fenced code blocks (one-invariant consolidation)", () => {
	it("excludes [cite: ...], ^FR1, and regex-fallback markdown links inside ``` fences", () => {
		const content = [
			"Outside [cite: real.md] and ^FR1.",
			"```",
			"[cite: fake-in-block.md]",
			"^FR99",
			"[text](inside-block.md#section)",
			"```",
			"After [cite: real2.md].",
		].join("\n");
		const src = tmpSourcePath(content);
		const links = extractLinks(content, src, emptyFileCache);

		const citeRaws = links
			.filter((l) => l.fullMatch.startsWith("[cite:"))
			.map((l) => l.target.path.raw);
		expect(citeRaws).toContain("real.md");
		expect(citeRaws).toContain("real2.md");
		expect(citeRaws).not.toContain("fake-in-block.md");

		const caretAnchors = links
			.filter((l) => l.fullMatch.startsWith("^"))
			.map((l) => l.target.anchor);
		expect(caretAnchors).toContain("FR1");
		expect(caretAnchors).not.toContain("FR99");
	});

	it("excludes patterns inside ~~~ (tilde) fences", () => {
		const content = [
			"Outside [cite: outside.md].",
			"~~~",
			"[cite: tilde-fake.md]",
			"~~~",
		].join("\n");
		const src = tmpSourcePath(content);
		const links = extractLinks(content, src, emptyFileCache);
		const citeRaws = links
			.filter((l) => l.fullMatch.startsWith("[cite:"))
			.map((l) => l.target.path.raw);
		expect(citeRaws).toContain("outside.md");
		expect(citeRaws).not.toContain("tilde-fake.md");
	});
});
