import { describe, expect, it } from "vitest";
import { extractLinks } from "../../src/core/MarkdownParser/extractLinks.js";

/**
 * Bug: backtick-wrapped footnote paths with line-reference suffixes like
 * `:L57`, `:L57,L61`, `:L57-L61` are parsed with the suffix as part of
 * the filename. The `:L...` suffix should be stripped just like `:17-36`.
 *
 * Examples of suffixes that should be stripped:
 *   :L57          — single line with L prefix
 *   :L57,L61      — comma-separated lines
 *   :L57,L61,L65  — multiple comma-separated lines
 *   :L57-L61      — line range with L prefix
 */
describe("extractLinks — line-reference suffix stripping", () => {
	it("strips :L57 suffix from footnote path", () => {
		const content = [
			"See [^S-001] for reference.",
			"",
			"[^S-001]: `/Users/wes/project/file.md:L57`",
		].join("\n");

		const links = extractLinks(content, "/some/source.md");
		const crossDocLinks = links.filter((l) => l.scope === "cross-document");

		expect(crossDocLinks.length).toBeGreaterThan(0);
		const link = crossDocLinks[0];
		expect(link?.target.path.raw).toBe("/Users/wes/project/file.md");
	});

	it("strips :L57,L61 comma-separated suffix from footnote path", () => {
		const content = [
			"See [^S-002] for reference.",
			"",
			"[^S-002]: `/Users/wes/project/file.md:L57,L61`",
		].join("\n");

		const links = extractLinks(content, "/some/source.md");
		const crossDocLinks = links.filter((l) => l.scope === "cross-document");

		expect(crossDocLinks.length).toBeGreaterThan(0);
		const link = crossDocLinks[0];
		expect(link?.target.path.raw).toBe("/Users/wes/project/file.md");
	});

	it("strips :L57,L61,L65 multiple comma-separated suffix", () => {
		const content = [
			"See [^S-003] for reference.",
			"",
			"[^S-003]: `/Users/wes/project/file.md:L57,L61,L65`",
		].join("\n");

		const links = extractLinks(content, "/some/source.md");
		const crossDocLinks = links.filter((l) => l.scope === "cross-document");

		expect(crossDocLinks.length).toBeGreaterThan(0);
		const link = crossDocLinks[0];
		expect(link?.target.path.raw).toBe("/Users/wes/project/file.md");
	});

	it("strips :L57-L61 range suffix from footnote path", () => {
		const content = [
			"See [^S-004] for reference.",
			"",
			"[^S-004]: `/Users/wes/project/file.md:L57-L61`",
		].join("\n");

		const links = extractLinks(content, "/some/source.md");
		const crossDocLinks = links.filter((l) => l.scope === "cross-document");

		expect(crossDocLinks.length).toBeGreaterThan(0);
		const link = crossDocLinks[0];
		expect(link?.target.path.raw).toBe("/Users/wes/project/file.md");
	});

	it("still strips plain numeric suffix :57", () => {
		const content = [
			"See [^S-005] for reference.",
			"",
			"[^S-005]: `/Users/wes/project/file.md:57`",
		].join("\n");

		const links = extractLinks(content, "/some/source.md");
		const crossDocLinks = links.filter((l) => l.scope === "cross-document");

		expect(crossDocLinks.length).toBeGreaterThan(0);
		const link = crossDocLinks[0];
		expect(link?.target.path.raw).toBe("/Users/wes/project/file.md");
	});

	it("does not strip suffix from paths with anchors", () => {
		// Paths with # anchors go through a different code path — anchor parsing
		// should not be affected by this fix.
		const content = "See [link](file.md#heading) for details.";

		const links = extractLinks(content, "/some/source.md");
		const crossDocLinks = links.filter((l) => l.scope === "cross-document");

		expect(crossDocLinks.length).toBeGreaterThan(0);
		expect(crossDocLinks[0]?.target.path.raw).toBe("file.md");
		expect(crossDocLinks[0]?.target.anchor).toBe("heading");
	});
});
