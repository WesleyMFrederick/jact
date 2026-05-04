/**
 * extractLinks — D2 residual-bracket scanner emission tests.
 *
 * Per plan-02 §"MODIFIED → test/unit/core/MarkdownParser/extractLinks.test.ts"
 * (lines 419–426). Closes CI-03 (Critical) + GAP-1.
 *
 * Verifies:
 *   1. Residual `[[…` outside code → emitted as UnrecognizedSyntaxRecord.
 *   2. `[[…]]` inside fenced code block → suppressed.
 *   3. `[[…]]` inside inline code span → suppressed.
 *   4. Residual adjacent to valid wikilink → no double-counting.
 *   5. Performance: <5ms on 10KB input ([H: <5ms benchmark] per §7b D2).
 */
import fs from "node:fs";
import nodePath from "node:path";
import { describe, expect, it } from "vitest";
import {
	extractLinks,
	scanResidualBrackets,
} from "../../../../src/core/MarkdownParser/extractLinks.js";
import { getFencedCodeBlockLineSet } from "../../../../src/core/MarkdownParser/isInsideCodeBlock.js";
import { FileCache } from "../../../../src/FileCache.js";

const SOURCE_PATH = "/test/extractLinks-residual.md";

function newFileCache(): FileCache {
	return new FileCache(fs, nodePath);
}

describe("extractLinks — residual-bracket scanner (D2)", () => {
	it("emits 1 UnrecognizedSyntaxRecord for unmatched [[ outside code blocks", () => {
		const content = "Some prose [[unclosed wiki fragment\n";
		const result = extractLinks(content, SOURCE_PATH, newFileCache());

		expect(result.unrecognized).toHaveLength(1);
		const record = result.unrecognized[0];
		expect(record).toBeDefined();
		expect(record?.line).toBe(1);
		expect(record?.column).toBe(11);
		expect(record?.rawText).toBe("[[unclosed wiki fragment");
		expect(record?.syntaxFamily).toBe("wiki");
	});

	it("emits NO record for [[…]] inside a fenced code block", () => {
		const content = [
			"Before fence",
			"```",
			"[[InsideFenceFragment]]",
			"```",
			"After fence",
			"",
		].join("\n");

		const result = extractLinks(content, SOURCE_PATH, newFileCache());

		expect(result.unrecognized).toHaveLength(0);
		expect(result.links.filter((l) => l.linkType === "wiki")).toHaveLength(0);
	});

	it("emits NO record for [[…]] inside an inline code span", () => {
		const content = "Prose with `[[InsideInlineSpan]]` text only.\n";

		const result = extractLinks(content, SOURCE_PATH, newFileCache());

		expect(result.unrecognized).toHaveLength(0);
		expect(result.links.filter((l) => l.linkType === "wiki")).toHaveLength(0);
	});

	it("emits residual for [[broken adjacent to valid [[wiki]] without double-counting", () => {
		const content = "[[ValidPage]] then [[brokenfragment\n";

		const result = extractLinks(content, SOURCE_PATH, newFileCache());

		const wikiLinks = result.links.filter((l) => l.linkType === "wiki");
		expect(wikiLinks).toHaveLength(1);
		expect(wikiLinks[0]?.target.rawPath).toBe("ValidPage");

		expect(result.unrecognized).toHaveLength(1);
		const residual = result.unrecognized[0];
		expect(residual?.column).toBe(19);
		expect(residual?.rawText).toBe("[[brokenfragment");
		expect(residual?.syntaxFamily).toBe("wiki");
	});

	it("scans a 10KB adversarial input in <5ms ([H: <5ms benchmark])", () => {
		// Build ~10KB content with code blocks, valid wikilinks, and residuals.
		const block = [
			"## Heading line",
			"Valid: [[ConceptPage]] and [[Concept#section]]",
			"Residual: [[unclosed_fragment_here",
			"```",
			"[[InsideFenceSuppressed]]",
			"```",
			"Inline `[[InsideInlineSuppressed]]` text.",
			"Plain prose with no brackets.",
			"",
		].join("\n");
		let content = "";
		while (content.length < 10_000) content += block;
		content = content.slice(0, 10_000);

		// Build inputs the scanner expects.
		const fencedLines = getFencedCodeBlockLineSet(content);
		// Simulate consumed ranges from a prior valid-wikilink pass.
		const consumedRanges: Array<{
			line: number;
			column: number;
			length: number;
		}> = [];

		// Warmup to avoid JIT noise on first call.
		scanResidualBrackets(content, consumedRanges, fencedLines);

		const start = performance.now();
		const records = scanResidualBrackets(content, consumedRanges, fencedLines);
		const elapsed = performance.now() - start;

		expect(elapsed).toBeLessThan(5);
		// Sanity — residual scanner should produce records for the unclosed fragments.
		expect(records.length).toBeGreaterThan(0);
	});
});
