import { describe, expect, it } from "vitest";
import { resolveWikiPath } from "../../../src/core/MarkdownParser/resolveWikiPath.js";
import type { ResolveResult } from "../../../src/types/fileCacheTypes.js";

const SRC_PATH = "/vault/source.md";

// Minimal FileCache stub — exact key match only; no extension normalization
function makeTestFileCache(entries: Record<string, string>): {
	resolveFile(filename: string): ResolveResult;
	getEntries(): Array<{ basename: string; relativePath: string }>;
} {
	return {
		resolveFile(filename: string): ResolveResult {
			const path = entries[filename];
			if (path !== undefined) {
				return { found: true, path };
			}
			return {
				found: false,
				reason: "not_found",
				message: `not found: ${filename}`,
			};
		},
		// Existing tests don't exercise Levenshtein scan; return empty so suggestions=[].
		getEntries() {
			return [];
		},
	};
}

// Stub that supports D4 Levenshtein scan via getEntries() returning {basename, relativePath}.
function makeLevTestFileCache(
	entries: Array<{
		basename: string;
		relativePath: string;
		absolutePath?: string;
	}>,
): {
	resolveFile(filename: string): ResolveResult;
	getEntries(): Array<{ basename: string; relativePath: string }>;
} {
	const map = new Map<string, string>();
	for (const e of entries) {
		if (e.absolutePath !== undefined) map.set(e.basename, e.absolutePath);
	}
	return {
		resolveFile(filename: string): ResolveResult {
			const path = map.get(filename);
			if (path !== undefined) return { found: true, path };
			return {
				found: false,
				reason: "not_found",
				message: `not found: ${filename}`,
			};
		},
		getEntries() {
			return entries.map(({ basename, relativePath }) => ({
				basename,
				relativePath,
			}));
		},
	};
}

describe("resolveWikiPath — unit assertions", () => {
	const cache = makeTestFileCache({
		"the-hardening-principle.md":
			"/vault/wiki/concepts/the-hardening-principle.md",
		"silent-failure.md": "/vault/wiki/concepts/silent-failure.md",
	});

	it("resolves exact filename hit (slug form, no .md)", () => {
		const result = resolveWikiPath("the-hardening-principle", SRC_PATH, cache);
		expect(result.resolved).toBe(true);
		if (result.resolved) {
			expect(result.absolutePath).toBe(
				"/vault/wiki/concepts/the-hardening-principle.md",
			);
		}
	});

	it("resolves exact filename hit (with .md extension)", () => {
		const result = resolveWikiPath(
			"the-hardening-principle.md",
			SRC_PATH,
			cache,
		);
		expect(result.resolved).toBe(true);
		if (result.resolved) {
			expect(result.absolutePath).toBe(
				"/vault/wiki/concepts/the-hardening-principle.md",
			);
		}
	});

	it("resolves via slug normalization (Title Case input)", () => {
		const result = resolveWikiPath("The Hardening Principle", SRC_PATH, cache);
		expect(result.resolved).toBe(true);
		if (result.resolved) {
			expect(result.absolutePath).toBe(
				"/vault/wiki/concepts/the-hardening-principle.md",
			);
		}
	});

	it("returns resolved=false with attempted[] when both steps miss", () => {
		const result = resolveWikiPath("Nonexistent Page", SRC_PATH, cache);
		expect(result.resolved).toBe(false);
		if (!result.resolved) {
			expect(result.attempted[0]).toBe("Nonexistent Page");
			expect(result.attempted[1]).toBe("nonexistent-page.md");
		}
	});

	it("attempted[] order: first=rawPath, second=slug+.md", () => {
		const result = resolveWikiPath("Some Missing Page", SRC_PATH, cache);
		expect(result.resolved).toBe(false);
		if (!result.resolved) {
			expect(result.attempted[0]).toBe("Some Missing Page");
			expect(result.attempted[1]).toBe("some-missing-page.md");
		}
	});
});

describe("resolveWikiPath — BDD: [H-D4-slug] spike acceptance gate", () => {
	const VAULT_BASE = "/vault/wiki/concepts";
	const spikeCache = makeTestFileCache({
		"the-hardening-principle.md": `${VAULT_BASE}/the-hardening-principle.md`,
		"silent-failure.md": `${VAULT_BASE}/silent-failure.md`,
		"separation-of-concerns.md": `${VAULT_BASE}/separation-of-concerns.md`,
		"determinism.md": `${VAULT_BASE}/determinism.md`,
		"building-effective-agents.md": `${VAULT_BASE}/building-effective-agents.md`,
		"hardening-principle-open-questions-research.md": `${VAULT_BASE}/hardening-principle-open-questions-research.md`,
		// intentionally no "the-hardening-principle-concept.md" — known MVP miss
	});

	// 8 unique page names from baseline file
	const baselinePageNames = [
		"the-hardening-principle",
		"The Hardening Principle (concept)",
		"The Hardening Principle",
		"Silent Failure",
		"Separation of Concerns",
		"Determinism",
		"Building Effective Agents",
		"Hardening Principle — Open Questions Research",
	];

	it("resolves ≥7 of 8 unique baseline page names (≥80% threshold)", () => {
		const results = baselinePageNames.map((name) =>
			resolveWikiPath(name, SRC_PATH, spikeCache),
		);
		const resolved = results.filter((r) => r.resolved).length;
		expect(resolved).toBeGreaterThanOrEqual(7);
	});

	it("known MVP miss: 'The Hardening Principle (concept)' → loud-fail with attempted[]", () => {
		const result = resolveWikiPath(
			"The Hardening Principle (concept)",
			SRC_PATH,
			spikeCache,
		);
		expect(result.resolved).toBe(false);
		if (!result.resolved) {
			expect(result.attempted[0]).toBe("The Hardening Principle (concept)");
			expect(result.attempted[1]).toBe("the-hardening-principle-concept.md");
		}
	});

	it("[H-D4-slug] two-step path: step-1 miss then step-2 slug hit for 'The Hardening Principle'", () => {
		// Verify step-1 misses (raw form not in cache), step-2 hits (slug form is in cache)
		const missCache = makeTestFileCache({
			"the-hardening-principle.md": `${VAULT_BASE}/the-hardening-principle.md`,
		});
		const result = resolveWikiPath(
			"The Hardening Principle",
			SRC_PATH,
			missCache,
		);
		expect(result.resolved).toBe(true);
		if (result.resolved) {
			expect(result.absolutePath).toBe(
				`${VAULT_BASE}/the-hardening-principle.md`,
			);
		}
	});

	it("em dash round-trip: 'Hardening Principle — Open Questions Research' resolves via slug", () => {
		const result = resolveWikiPath(
			"Hardening Principle — Open Questions Research",
			SRC_PATH,
			spikeCache,
		);
		expect(result.resolved).toBe(true);
		if (result.resolved) {
			expect(result.absolutePath).toBe(
				`${VAULT_BASE}/hardening-principle-open-questions-research.md`,
			);
		}
	});
});

describe("resolveWikiPath — D4 Levenshtein suggestion layer (P4 — [H-D4-suggestion-threshold])", () => {
	it("single-typo within threshold: returns single full relative path", () => {
		// slug+".md" = "filename.md" (11), basename "filenames.md" (12), distance = 1.
		// relativePath length = 24 → floor(0.2*24)=4 → clamp(3,10,4)=4. 1 ≤ 4 ✓
		const cache = makeLevTestFileCache([
			{
				basename: "filenames.md",
				relativePath: "wiki/files/filenames.md",
				absolutePath: "/v/wiki/files/filenames.md",
			},
		]);
		const result = resolveWikiPath("filename", SRC_PATH, cache);
		expect(result.resolved).toBe(false);
		if (!result.resolved) {
			expect(result.suggestions).toEqual(["wiki/files/filenames.md"]);
		}
	});

	it("multi-match disambiguation: returns all candidates within threshold (folder context preserved)", () => {
		// slug+".md" = "the-hardening-principle-concept.md" (33).
		// All basenames "the-hardening-principle.md" (26), distance 8 (insertion of "-concept").
		// Thresholds:
		//  wiki/concepts/.../...md    len 40 → floor(8.0)=8  → clamp 8.  8 ≤ 8 ✓
		//  wiki/summaries/...md        len 41 → floor(8.2)=8  → clamp 8.  8 ≤ 8 ✓
		//  raw-sources/.../...md       len 60 → floor(12)=12 → clamp 10. 8 ≤ 10 ✓
		const cache = makeLevTestFileCache([
			{
				basename: "the-hardening-principle.md",
				relativePath: "wiki/concepts/the-hardening-principle.md",
				absolutePath: "/v/wiki/concepts/the-hardening-principle.md",
			},
			{
				basename: "the-hardening-principle.md",
				relativePath: "wiki/summaries/the-hardening-principle.md",
			},
			{
				basename: "the-hardening-principle.md",
				relativePath:
					"raw-sources/claude-code-principles/the-hardening-principle.md",
			},
		]);
		const result = resolveWikiPath(
			"The Hardening Principle (concept)",
			SRC_PATH,
			cache,
		);
		expect(result.resolved).toBe(false);
		if (!result.resolved) {
			expect(result.suggestions).toHaveLength(3);
			expect(result.suggestions).toContain(
				"wiki/concepts/the-hardening-principle.md",
			);
			expect(result.suggestions).toContain(
				"wiki/summaries/the-hardening-principle.md",
			);
			expect(result.suggestions).toContain(
				"raw-sources/claude-code-principles/the-hardening-principle.md",
			);
		}
	});

	it("ceiling clamp (≥10): long candidate path doesn't blow up threshold", () => {
		// relativePath length = 56 → floor(0.2*56)=11 → clamp(3,10,11)=10 (ceiling fires).
		// slug+".md" = "abcdefghijklmn.md" (17), basename "abc.md" (6), distance = 11.
		// 11 > 10 (ceiling) → no match. Without ceiling clamp (threshold 11) it WOULD match.
		const cache = makeLevTestFileCache([
			{
				basename: "abc.md",
				relativePath: "raw-sources/claude-code-principles/research-data/abc.md",
				absolutePath: "/v/abc.md",
			},
		]);
		const result = resolveWikiPath("abcdefghijklmn", SRC_PATH, cache);
		expect(result.resolved).toBe(false);
		if (!result.resolved) {
			expect(result.suggestions).toEqual([]);
		}
	});

	it("floor clamp (≤3): short candidate path doesn't shrink threshold below 3", () => {
		// relativePath length = 4 → floor(0.2*4)=0 → clamp(3,10,0)=3 (floor fires).
		// slug+".md" = "abcd.md" (7), basename "a.md" (4), distance = 3.
		// 3 ≤ 3 → match. Without floor clamp (threshold 0), 3 > 0 → no match.
		const cache = makeLevTestFileCache([
			{ basename: "a.md", relativePath: "a.md", absolutePath: "/v/a.md" },
		]);
		const result = resolveWikiPath("abcd", SRC_PATH, cache);
		expect(result.resolved).toBe(false);
		if (!result.resolved) {
			expect(result.suggestions).toEqual(["a.md"]);
		}
	});

	it("no-match: returns empty suggestions array (no false-positive)", () => {
		// Distance way exceeds threshold for any candidate.
		const cache = makeLevTestFileCache([
			{
				basename: "completely-different-name.md",
				relativePath: "wiki/x/completely-different-name.md",
				absolutePath: "/v/cdn.md",
			},
		]);
		const result = resolveWikiPath("xyz", SRC_PATH, cache);
		expect(result.resolved).toBe(false);
		if (!result.resolved) {
			expect(result.suggestions).toEqual([]);
		}
	});

	it("hit-path: Levenshtein scan NOT invoked (cost optimization — fires only on miss)", () => {
		let getEntriesCalls = 0;
		const cache = {
			resolveFile(filename: string): ResolveResult {
				if (filename === "the-hardening-principle.md") {
					return {
						found: true,
						path: "/v/the-hardening-principle.md",
					};
				}
				return {
					found: false,
					reason: "not_found" as const,
					message: "x",
				};
			},
			getEntries() {
				getEntriesCalls++;
				return [];
			},
		};
		// Step-1 raw="the-hardening-principle" misses; Step-2 slug "the-hardening-principle.md" hits.
		const result = resolveWikiPath("the-hardening-principle", SRC_PATH, cache);
		expect(result.resolved).toBe(true);
		expect(getEntriesCalls).toBe(0);
	});
});
