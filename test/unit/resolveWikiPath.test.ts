import { describe, expect, it } from "vitest";
import type { WikiPathFileCache } from "../../src/core/MarkdownParser/resolveWikiPath.js";
import { resolveWikiPath } from "../../src/core/MarkdownParser/resolveWikiPath.js";
import type { ResolveResult } from "../../src/types/fileCacheTypes.js";

/**
 * Stub FileCache that always misses, returning the provided attemptedPaths
 * per call. Calls are returned in order: first call → results[0], second → results[1].
 */
function makeStubCache(
	results: ResolveResult[],
	entries: Array<{ basename: string; relativePath: string }> = [],
): WikiPathFileCache {
	let callIdx = 0;
	return {
		resolveFile(): ResolveResult {
			const r = results[callIdx++] ?? {
				found: false as const,
				reason: "not_found" as const,
				message: "stub exhausted",
			};
			return r;
		},
		getEntries() {
			return entries;
		},
	};
}

describe("resolveWikiPath — attemptedPaths threading", () => {
	it("miss result carries attemptedPaths from both FileCache.resolveFile() calls", () => {
		const cache = makeStubCache([
			{
				found: false,
				reason: "not_found",
				message: "step1 miss",
				attemptedPaths: ["/scope/wiki/Heuristic Reasoning.md"],
			},
			{
				found: false,
				reason: "not_found",
				message: "step2 miss",
				attemptedPaths: ["/scope/wiki/heuristic-reasoning.md"],
			},
		]);

		const result = resolveWikiPath(
			"Heuristic Reasoning",
			"/scope/source.md",
			cache,
		);

		expect(result.resolved).toBe(false);
		if (result.resolved) return;

		// RED: resolveWikiPath does not yet propagate attemptedPaths from FileCache results.
		expect(result.attemptedPaths).toBeDefined();
		expect(result.attemptedPaths).toContain(
			"/scope/wiki/Heuristic Reasoning.md",
		);
		expect(result.attemptedPaths).toContain(
			"/scope/wiki/heuristic-reasoning.md",
		);
	});

	it("hit on step1 still returns resolved:true (regression guard)", () => {
		const cache = makeStubCache([
			{ found: true, path: "/scope/wiki/Heuristic Reasoning.md" },
		]);

		const result = resolveWikiPath(
			"Heuristic Reasoning",
			"/scope/source.md",
			cache,
		);

		expect(result.resolved).toBe(true);
		if (!result.resolved) return;
		expect(result.absolutePath).toBe("/scope/wiki/Heuristic Reasoning.md");
	});
});
