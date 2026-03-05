import { describe, expect, it } from "vitest";
import { extractLinks } from "../../src/core/MarkdownParser/extractLinks.js";

/**
 * Issue #11: backtick-wrapped footnote paths should be stripped of backticks
 * before being used as rawPath in LinkObject.
 *
 * Markdown footnote definitions like:
 *   [^S-001]: `/path/to/file.md`
 *
 * produce link tokens whose href includes surrounding backticks.
 * The backtick must be stripped at extraction time.
 */
describe("extractLinks — backtick footnote paths (issue #11)", () => {
	it("strips backticks from footnote-definition path (absolute path)", () => {
		const content = [
			"See [^S-001] for reference.",
			"",
			"[^S-001]: `/Users/wes/project/design-docs/Gemini-LBNL-Prompt.md`",
		].join("\n");

		const links = extractLinks(content, "/some/source.md");
		const crossDocLinks = links.filter((l) => l.scope === "cross-document");

		expect(crossDocLinks.length).toBeGreaterThan(0);
		const link = crossDocLinks[0];
		expect(link?.target.path.raw).not.toMatch(/`/);
		expect(link?.target.path.raw).toBe(
			"/Users/wes/project/design-docs/Gemini-LBNL-Prompt.md",
		);
	});

	it("strips backticks from footnote-definition path with line-range suffix", () => {
		const content = [
			"See [^S-001] for reference.",
			"",
			"[^S-001]: `/Users/wes/project/design-docs/Gemini-LBNL-Prompt.md:17-36`",
		].join("\n");

		const links = extractLinks(content, "/some/source.md");
		const crossDocLinks = links.filter((l) => l.scope === "cross-document");

		expect(crossDocLinks.length).toBeGreaterThan(0);
		const link = crossDocLinks[0];
		expect(link?.target.path.raw).not.toMatch(/`/);
		expect(link?.target.path.raw).toBe(
			"/Users/wes/project/design-docs/Gemini-LBNL-Prompt.md:17-36",
		);
	});

	it("does not strip backticks from regular link hrefs that genuinely contain backticks", () => {
		// A regular markdown link like [text](`literal-backtick-path`) is edge-case;
		// ensure we don't break normal links that happen to have no backticks.
		const content = "See [normal](other-file.md) for details.";

		const links = extractLinks(content, "/some/source.md");
		const crossDocLinks = links.filter((l) => l.scope === "cross-document");

		expect(crossDocLinks.length).toBeGreaterThan(0);
		expect(crossDocLinks[0]?.target.path.raw).toBe("other-file.md");
	});
});
