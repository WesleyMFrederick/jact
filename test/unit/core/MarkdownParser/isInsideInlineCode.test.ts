import { describe, expect, it } from "vitest";
import { isInsideInlineCode } from "../../../../src/core/MarkdownParser/isInsideInlineCode.js";

// CommonMark §6.1: an opener of N backticks closes only on a run of N backticks.
// Earlier toggle-on-every-backtick implementation broke parity when a non-matching
// run (e.g. literal triple-backticks rendered between single-backtick code spans)
// appeared on the same line. This file pins the run-length-matched semantics.

describe("isInsideInlineCode — CommonMark §6.1 backtick-run matching", () => {
	it("treats a literal ``` run as content inside a single-backtick span (parity unaffected)", () => {
		// Mirror plan-01:604 — three `[[wikilinks]]` and a literal ` ``` ` span on one line.
		// All three wikilinks must report `inside inline code` despite the 3-run between them.
		const line =
			"see `[[real-link]]` and `[[fake-in-backtick-block]]` and ` ``` ` and `[[fake-in-tilde-block]]` end";
		const targets = [
			"[[real-link]]",
			"[[fake-in-backtick-block]]",
			"[[fake-in-tilde-block]]",
		];
		for (const t of targets) {
			const idx = line.indexOf(t);
			expect(isInsideInlineCode(line, idx)).toBe(true);
		}
	});

	it("treats a triple-backtick opener as a span only when matched by another 3-run", () => {
		const line = "before ```triple [[x]] triple``` after";
		// `[[x]]` is between matched ``` openers/closers → inside
		expect(isInsideInlineCode(line, line.indexOf("[[x]]"))).toBe(true);
		// `before` and `after` are outside
		expect(isInsideInlineCode(line, line.indexOf("before"))).toBe(false);
		expect(isInsideInlineCode(line, line.indexOf("after"))).toBe(false);
	});

	it("an unmatched single backtick run does not open a span (literal text)", () => {
		const line = "alone ` and [[x]] follow";
		expect(isInsideInlineCode(line, line.indexOf("[[x]]"))).toBe(false);
	});

	it("plain single-backtick code span still works", () => {
		const line = "before `inside [[x]]` after";
		expect(isInsideInlineCode(line, line.indexOf("[[x]]"))).toBe(true);
		expect(isInsideInlineCode(line, line.indexOf("after"))).toBe(false);
	});

	it("two adjacent single-backtick spans on one line", () => {
		const line = "`a [[x]]` middle `b [[y]]` end";
		expect(isInsideInlineCode(line, line.indexOf("[[x]]"))).toBe(true);
		expect(isInsideInlineCode(line, line.indexOf("middle"))).toBe(false);
		expect(isInsideInlineCode(line, line.indexOf("[[y]]"))).toBe(true);
		expect(isInsideInlineCode(line, line.indexOf("end"))).toBe(false);
	});
});
