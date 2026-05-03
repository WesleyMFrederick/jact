import { describe, expect, it } from "vitest";
import { pageNameToSlug } from "../../../src/utils/wikiPageSlug.js";

describe("pageNameToSlug — unit rules", () => {
	it("lowercases and replaces whitespace with hyphens", () => {
		expect(pageNameToSlug("The Hardening Principle")).toBe(
			"the-hardening-principle",
		);
	});

	it("strips em dash (non-[a-z0-9\\-_] after whitespace collapse)", () => {
		expect(pageNameToSlug("Foo — Bar")).toBe("foo-bar");
	});

	it("strips parentheses", () => {
		expect(pageNameToSlug("Page (concept)")).toBe("page-concept");
	});

	it("collapses repeated hyphens", () => {
		expect(pageNameToSlug("A  -  B")).toBe("a-b");
	});

	it("preserves underscores", () => {
		expect(pageNameToSlug("snake_case_page")).toBe("snake_case_page");
	});

	it("strips non-ASCII unicode characters", () => {
		expect(pageNameToSlug("café")).toBe("caf");
	});

	it("strips plus signs", () => {
		expect(pageNameToSlug("A+B")).toBe("ab");
	});
});

describe("pageNameToSlug — BDD baseline page names ([H-D4-slug] verification inputs)", () => {
	it('converts "The Hardening Principle" → "the-hardening-principle"', () => {
		expect(pageNameToSlug("The Hardening Principle")).toBe(
			"the-hardening-principle",
		);
	});

	it('converts "Hardening Principle — Open Questions Research" → "hardening-principle-open-questions-research"', () => {
		expect(
			pageNameToSlug("Hardening Principle — Open Questions Research"),
		).toBe("hardening-principle-open-questions-research");
	});

	it('converts "The Hardening Principle (concept)" → "the-hardening-principle-concept" (known MVP miss)', () => {
		expect(pageNameToSlug("The Hardening Principle (concept)")).toBe(
			"the-hardening-principle-concept",
		);
	});

	it('converts "Silent Failure" → "silent-failure"', () => {
		expect(pageNameToSlug("Silent Failure")).toBe("silent-failure");
	});

	it('converts "Building Effective Agents" → "building-effective-agents"', () => {
		expect(pageNameToSlug("Building Effective Agents")).toBe(
			"building-effective-agents",
		);
	});
});
