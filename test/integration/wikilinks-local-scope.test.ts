import { describe, expect, it } from "vitest";
import { resolveWikiPath } from "../../src/core/MarkdownParser/resolveWikiPath.js";
import type { ResolveResult } from "../../src/types/fileCacheTypes.js";

// Mock FileCache that supports local-first resolution
// Simulates a structure like:
// project/
//   .git/
//   llm-wiki/
//     wiki/
//       concepts/
//         polyas-four-step-method.md
//         heuristic-reasoning-concept.md
//       syntheses/
//         hardening-principle-open-questions.md
//         domain-vocabulary-synthesis.md

function makeLocalScopeFileCache(
	entries: Array<{
		basename: string;
		relativePath: string;
		absolutePath: string;
	}>,
): {
	resolveFile(filename: string): ResolveResult;
	getEntries(): Array<{ basename: string; relativePath: string }>;
	resolveFileLocalFirst?(
		filename: string,
		sourceFile: string,
	): {
		found: boolean;
		path?: string;
		relativePath?: string;
		source: "local" | "global" | "none";
	};
} {
	const map = new Map<string, string>();
	const pathMap = new Map<string, string>();

	for (const e of entries) {
		map.set(e.basename, e.absolutePath);
		pathMap.set(e.absolutePath, e.relativePath);
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
		// Placeholder: actual implementation in FileCache.resolveFileLocalFirst
		resolveFileLocalFirst(filename: string, sourceFile: string) {
			const sourceDir = sourceFile.substring(0, sourceFile.lastIndexOf("/"));

			// Try same directory
			const sameDir = `${sourceDir}/${filename}`;
			for (const [basename, absPath] of map) {
				if (basename === filename && absPath === sameDir) {
					return {
						found: true,
						path: absPath,
						relativePath: filename,
						source: "local",
					};
				}
			}

			// Try parent directory
			const parentDir = sourceDir.substring(0, sourceDir.lastIndexOf("/"));
			for (const [basename, absPath] of map) {
				if (basename === filename && absPath.startsWith(parentDir)) {
					const relPath = absPath.substring(parentDir.length + 1);
					return {
						found: true,
						path: absPath,
						relativePath: `../${relPath}`,
						source: "local",
					};
				}
			}

			// Fallback to global
			const globalResult = this.resolveFile(filename);
			if (globalResult.found) {
				return {
					found: true,
					path: globalResult.path,
					source: "global",
				};
			}
			return { found: false, source: "none" };
		},
	};
}

describe("resolveWikiPath — local-scope resolution (wiki-links-local-scope)", () => {
	const VAULT_BASE = "/project/llm-wiki/wiki";
	const cache = makeLocalScopeFileCache([
		{
			basename: "polyas-four-step-method.md",
			relativePath: "concepts/polyas-four-step-method.md",
			absolutePath: `${VAULT_BASE}/concepts/polyas-four-step-method.md`,
		},
		{
			basename: "heuristic-reasoning-concept.md",
			relativePath: "concepts/heuristic-reasoning-concept.md",
			absolutePath: `${VAULT_BASE}/concepts/heuristic-reasoning-concept.md`,
		},
		{
			basename: "hardening-principle-open-questions.md",
			relativePath: "syntheses/hardening-principle-open-questions.md",
			absolutePath: `${VAULT_BASE}/syntheses/hardening-principle-open-questions.md`,
		},
		{
			basename: "domain-vocabulary-synthesis.md",
			relativePath: "syntheses/domain-vocabulary-synthesis.md",
			absolutePath: `${VAULT_BASE}/syntheses/domain-vocabulary-synthesis.md`,
		},
	]);

	const SOURCE_FILE = `${VAULT_BASE}/concepts/polyas-four-step-method.md`;

	it("TEST 1: Wiki link to file in sibling directory suggests relative path", () => {
		// Bare wiki link: [[Hardening Principle — Open Questions Research]]
		// Current: fails with global suggestion
		// Expected: should suggest ../syntheses/hardening-principle-open-questions.md
		const result = resolveWikiPath(
			"Hardening Principle — Open Questions Research",
			SOURCE_FILE,
			cache,
		);

		// Currently will fail; after implementation, should resolve locally
		expect(result.resolved).toBe(true); // WILL FAIL — currently resolves=false
		if (result.resolved) {
			expect(result.absolutePath).toBe(
				`${VAULT_BASE}/syntheses/hardening-principle-open-questions.md`,
			);
			// After implementation, should include relative path for suggestion
			if ("relativePath" in result) {
				expect(result.relativePath).toBe(
					"../syntheses/hardening-principle-open-questions.md",
				);
			}
		}
	});

	it("TEST 2: Explicit relative path validates as VALID (not warning)", () => {
		// [[../syntheses/hardening-principle-open-questions]]
		// Current: warns "found via file cache in different directory"
		// Expected: should validate as VALID
		const result = resolveWikiPath(
			"../syntheses/hardening-principle-open-questions",
			SOURCE_FILE,
			cache,
		);

		expect(result.resolved).toBe(true); // WILL FAIL — currently warns
		if (result.resolved) {
			expect(result.absolutePath).toBe(
				`${VAULT_BASE}/syntheses/hardening-principle-open-questions.md`,
			);
		}
	});

	it("TEST 3: Link to sibling in same directory suggests relative path without parent", () => {
		// [[Heuristic Reasoning]]
		// Should suggest ./heuristic-reasoning-concept.md (same directory)
		const result = resolveWikiPath("Heuristic Reasoning", SOURCE_FILE, cache);

		expect(result.resolved).toBe(true); // WILL FAIL
		if (result.resolved) {
			expect(result.absolutePath).toBe(
				`${VAULT_BASE}/concepts/heuristic-reasoning-concept.md`,
			);
			if ("relativePath" in result) {
				expect(result.relativePath).toBe("./heuristic-reasoning-concept.md");
			}
		}
	});

	it("TEST 4: Link with no local match falls back to global scope search", () => {
		// [[Nonexistent Local Page]]
		// Should fallback to global Levenshtein
		const result = resolveWikiPath(
			"Nonexistent Local Page",
			SOURCE_FILE,
			cache,
		);

		// No local match, so will fall back to global (which returns not found in this case)
		expect(result.resolved).toBe(false);
		if (!result.resolved) {
			expect(result.attempted).toContain("Nonexistent Local Page");
			expect(result.attempted).toContain("nonexistent-local-page.md");
		}
	});
});
