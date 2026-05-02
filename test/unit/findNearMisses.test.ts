import { describe, expect, it } from "vitest";
import { findNearMisses } from "../../src/FileCache.js";

function makeEntries(filenames: string[]): Map<string, string[]> {
	return new Map(filenames.map((f) => [f, [`/fake/${f}`]]));
}

describe("findNearMisses — Levenshtein top-3 distance ≤2", () => {
	it("given filename 'foo.md' and entries containing 'fooo.md', when findNearMisses called, then returns ['fooo.md'] (distance 1)", () => {
		const entries = makeEntries(["fooo.md", "bar.md", "baz.md"]);
		expect(findNearMisses("foo.md", entries)).toEqual(["fooo.md"]);
	});

	it("given filename 'foo.md' and entries containing 'bar.md', when findNearMisses called, then returns [] (distance > 2)", () => {
		const entries = makeEntries(["bar.md"]);
		expect(findNearMisses("foo.md", entries)).toEqual([]);
	});

	it("given 5 candidates within distance ≤2, when findNearMisses called, then returns exactly 3 sorted by ascending distance", () => {
		// fo.md (d=1), fooo.md (d=1), foooo.md (d=2), fooooo.md (d=3 — excluded), bar.md (d>2 — excluded)
		const entries = makeEntries([
			"fo.md",
			"fooo.md",
			"foooo.md",
			"fooooo.md",
			"bar.md",
		]);
		const result = findNearMisses("foo.md", entries);
		expect(result).toHaveLength(3);
		expect(result).toContain("fo.md");
		expect(result).toContain("fooo.md");
		expect(result).toContain("foooo.md");
		// foooo.md (d=2) must be last since fo.md and fooo.md are d=1
		expect(result[2]).toBe("foooo.md");
	});

	it("given empty entries map, when findNearMisses called, then returns []", () => {
		expect(findNearMisses("foo.md", new Map())).toEqual([]);
	});

	it("given filename matching no entry exactly, when findNearMisses called, then result excludes exact match (none exist)", () => {
		// 'xyz.md' is NOT in entries; near-miss 'xy.md' (d=2) should be returned
		const entries = makeEntries(["xy.md"]);
		const result = findNearMisses("xyz.md", entries);
		expect(result).toContain("xy.md");
		expect(result).not.toContain("xyz.md");
	});

	it("given identical-distance candidates, when findNearMisses called, then ordering is stable (insertion order from Map.keys())", () => {
		// Both 'xbc.md' and 'axc.md' are distance 1 from 'abc.md'
		const entries = makeEntries(["xbc.md", "axc.md"]);
		const result = findNearMisses("abc.md", entries);
		// Stable sort preserves Map insertion order for ties
		expect(result).toEqual(["xbc.md", "axc.md"]);
	});
});
