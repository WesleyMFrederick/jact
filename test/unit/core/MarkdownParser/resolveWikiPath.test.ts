import { describe, expect, it } from "vitest";
import { resolveWikiPath } from "../../../../src/core/MarkdownParser/resolveWikiPath.js";
import type { ResolveResult } from "../../../../src/types/fileCacheTypes.js";

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
