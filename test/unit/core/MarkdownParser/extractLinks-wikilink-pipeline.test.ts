/**
 * Integration test: full extractLinks pipeline with real seeded FileCache.
 *
 * Regression guard for the Phase 3 silent-failure bug where fileCache was
 * optional and never injected in production, causing the wiki resolution
 * branch to be silently skipped and all wiki paths to get wrong absolute paths.
 *
 * This test runs the FULL extractLinks() pipeline (not extractWikilinks in
 * isolation) against the baseline fixture with a real seeded FileCache, and
 * asserts that cross-doc wiki links resolve to non-null absolute paths.
 */
import fs from "node:fs";
import path, { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractLinks } from "../../../../src/core/MarkdownParser/extractLinks.js";
import { FileCache } from "../../../../src/FileCache.js";

const FIXTURE_PATH = resolve(
	import.meta.dirname ?? "",
	"../../../fixtures/wikilink-baseline/probabilistic-vs-deterministic-systems.md",
);
const WIKI_DIR = resolve(
	import.meta.dirname ?? "",
	"../../../fixtures/wikilink-baseline/wiki",
);

describe("extractLinks — full pipeline with seeded FileCache", () => {
	it("resolves ≥7 cross-doc wiki links to non-null absolute paths using FileCache", () => {
		const fileCache = new FileCache(fs, path);
		fileCache.buildCache(WIKI_DIR);

		const content = fs.readFileSync(FIXTURE_PATH, "utf-8");
		const links = extractLinks(content, FIXTURE_PATH, fileCache);

		const crossDocWikiLinks = links.filter(
			(l) => l.linkType === "wiki" && l.scope === "cross-document",
		);
		const resolved = crossDocWikiLinks.filter(
			(l) => l.target.path.absolute !== null,
		);

		// 11 cross-doc wiki links total; 8 should resolve (3 "concept" pages don't exist)
		expect(crossDocWikiLinks.length).toBeGreaterThanOrEqual(8);
		expect(resolved.length).toBeGreaterThanOrEqual(7);
		// All resolved paths must end with .md (guards against resolver returning bare slugs)
		for (const l of resolved) {
			expect(l.target.path.absolute).toMatch(/\.md$/);
		}
	});

	it("resolves [[the-hardening-principle]] to the-hardening-principle.md", () => {
		const fileCache = new FileCache(fs, path);
		fileCache.buildCache(WIKI_DIR);

		const content = fs.readFileSync(FIXTURE_PATH, "utf-8");
		const links = extractLinks(content, FIXTURE_PATH, fileCache);

		const hardeningLink = links.find(
			(l) =>
				l.linkType === "wiki" &&
				l.target.path.raw === "the-hardening-principle",
		);
		expect(hardeningLink).toBeDefined();
		expect(hardeningLink?.target.path.absolute).not.toBeNull();
		expect(hardeningLink?.target.path.absolute).toContain(
			"the-hardening-principle.md",
		);
	});
});
