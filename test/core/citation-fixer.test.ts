/**
 * CitationFixer class unit tests (TDD — RED phase for issue #29)
 *
 * Tests CitationFixer.applyFixes() in isolation — no CLI process, no JactCli.
 */

import { describe, expect, it } from "vitest";
import { CitationFixer } from "../../dist/core/citationFixer.js";
import type { FixRecord } from "../../dist/types/validationTypes.js";

describe("CitationFixer", () => {
	it("is importable as a class without activating Commander", () => {
		expect(CitationFixer).toBeDefined();
		expect(typeof CitationFixer).toBe("function");
	});

	it("can be instantiated", () => {
		const fixer = new CitationFixer();
		expect(fixer).toBeInstanceOf(CitationFixer);
	});

	it("applyFixes returns modified content string", () => {
		const fixer = new CitationFixer();
		const content = "Some text with [old link](old.md#old-anchor) inline.";
		const fixes: FixRecord[] = [
			{
				line: 1,
				old: "[old link](old.md#old-anchor)",
				new: "[old link](old.md#new-anchor)",
				type: "anchor",
			},
		];
		const result = fixer.applyFixes(content, fixes, { dryRun: false });
		expect(result.content).toBe(
			"Some text with [old link](old.md#new-anchor) inline.",
		);
	});

	it("applyFixes dryRun returns original content unchanged", () => {
		const fixer = new CitationFixer();
		const content = "Some text with [old link](old.md#old-anchor) inline.";
		const fixes: FixRecord[] = [
			{
				line: 1,
				old: "[old link](old.md#old-anchor)",
				new: "[old link](old.md#new-anchor)",
				type: "anchor",
			},
		];
		const result = fixer.applyFixes(content, fixes, { dryRun: true });
		expect(result.content).toBe(content);
		expect(result.dryRun).toBe(true);
	});

	it("applyFixes returns count of applied fixes", () => {
		const fixer = new CitationFixer();
		const content = "[a](a.md#x) and [b](b.md#y)";
		const fixes: FixRecord[] = [
			{ line: 1, old: "[a](a.md#x)", new: "[a](a.md#x-fixed)", type: "anchor" },
			{ line: 1, old: "[b](b.md#y)", new: "[b](b.md#y-fixed)", type: "anchor" },
		];
		const result = fixer.applyFixes(content, fixes, { dryRun: false });
		expect(result.fixesApplied).toBe(2);
	});

	it("applyFixes with empty fixes list returns unchanged content", () => {
		const fixer = new CitationFixer();
		const content = "No citations here.";
		const result = fixer.applyFixes(content, [], { dryRun: false });
		expect(result.content).toBe(content);
		expect(result.fixesApplied).toBe(0);
	});

	it("applyFixes replaces all occurrences matching old string", () => {
		const fixer = new CitationFixer();
		const content = "[dup](x.md#old) and [dup](x.md#old)";
		const fixes: FixRecord[] = [
			{
				line: 1,
				old: "[dup](x.md#old)",
				new: "[dup](x.md#new)",
				type: "anchor",
			},
		];
		const result = fixer.applyFixes(content, fixes, { dryRun: false });
		// First occurrence replaced; second may also be replaced since string.replace replaces first match
		expect(result.content).toContain("[dup](x.md#new)");
	});

	it("dryRun reports fixes without modifying content", () => {
		const fixer = new CitationFixer();
		const content = "Text [a](a.md#old) here.";
		const fixes: FixRecord[] = [
			{ line: 1, old: "[a](a.md#old)", new: "[a](a.md#new)", type: "anchor" },
		];
		const result = fixer.applyFixes(content, fixes, { dryRun: true });
		expect(result.fixesApplied).toBe(1);
		expect(result.content).toBe(content); // unchanged in dry run
		expect(result.dryRun).toBe(true);
	});
});

describe("applyAnchorFix (structured anchorConversion, not regex-parsed suggestion)", () => {
	/** Minimal EnrichedLinkObject stub covering only fields applyAnchorFix reads. */
	function stubLink(
		validation: Record<string, unknown>,
		linkParts: Record<string, unknown> = {},
	) {
		return {
			linkType: "markdown",
			text: "Design",
			target: { path: { raw: "design.md" }, anchor: "old-anchor" },
			validation,
			...linkParts,
		} as unknown as import("../../src/types/validationTypes.js").EnrichedLinkObject;
	}

	it("rebuilds the citation from anchorConversion.recommended on an error result", async () => {
		const { applyAnchorFix } = await import("../../dist/core/citationFixer.js");
		const link = stubLink({
			status: "error",
			error: "Anchor not found: #old-anchor",
			anchorConversion: {
				type: "anchor-conversion",
				original: "old-anchor",
				recommended: "New%20Heading",
			},
		});

		const result = applyAnchorFix("[Design](design.md#old-anchor)", link);

		expect(result).toBe("[Design](design.md#New%20Heading)");
	});

	it("rebuilds the citation from anchorConversion.recommended on a warning result", async () => {
		const { applyAnchorFix } = await import("../../dist/core/citationFixer.js");
		const link = stubLink({
			status: "warning",
			message: "Use raw header format for better Obsidian compatibility",
			anchorConversion: {
				type: "anchor-conversion",
				original: "old-anchor",
				recommended: "Raw%20Header",
			},
		});

		const result = applyAnchorFix("[Design](design.md#old-anchor)", link);

		expect(result).toBe("[Design](design.md#Raw%20Header)");
	});

	it("returns the citation unchanged when no anchorConversion is present", async () => {
		const { applyAnchorFix } = await import("../../dist/core/citationFixer.js");
		const link = stubLink({
			status: "error",
			error: "Anchor not found: #old-anchor",
			suggestion: "No similar anchors found",
		});

		const result = applyAnchorFix("[Design](design.md#old-anchor)", link);

		expect(result).toBe("[Design](design.md#old-anchor)");
	});

	it("returns the citation unchanged when link parts are not markdown-shaped", async () => {
		const { applyAnchorFix } = await import("../../dist/core/citationFixer.js");
		const link = stubLink(
			{
				status: "error",
				error: "Anchor not found: #old-anchor",
				anchorConversion: {
					type: "anchor-conversion",
					original: "old-anchor",
					recommended: "New%20Heading",
				},
			},
			{ linkType: "wiki" },
		);

		const result = applyAnchorFix("[[Design#old-anchor]]", link);

		expect(result).toBe("[[Design#old-anchor]]");
	});
});
