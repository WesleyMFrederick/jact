/**
 * PathResolver unit tests — RED phase for issue #28
 *
 * Verifies PathResolver can be instantiated and called without CitationValidator.
 * These tests use a minimal file-system stub so no real FS access is needed.
 */
import { describe, expect, it, vi } from "vitest";

// Dynamic import so the test fails gracefully with "module not found" in RED phase
describe("PathResolver — isolated unit", () => {
	it("resolveTargetPath returns standard path when file exists at standard location", async () => {
		const { PathResolver } = await import(
			"../../../src/core/CitationValidator/PathResolver.js"
		);

		// Stub isFile to return true only for the standard resolved path
		const resolver = new PathResolver({
			isFile: (p: string) => p.endsWith("target.md"),
			isDirectory: (_p: string) => false,
			resolveFile: (_: string) => ({ found: false }),
		});

		const result = resolver.resolveTargetPath("target.md", "/base/source.md");
		// Should return the resolved path (ends with target.md)
		expect(result).toMatch(/target\.md$/);
	});

	it("resolveTargetPath expands tilde paths", async () => {
		const { PathResolver } = await import(
			"../../../src/core/CitationValidator/PathResolver.js"
		);

		const resolver = new PathResolver({
			isFile: (p: string) => p.includes("home") || p.includes("Users"),
			isDirectory: (_p: string) => false,
			resolveFile: (_: string) => ({ found: false }),
		});

		const result = resolver.resolveTargetPath(
			"~/somefile.md",
			"/any/source.md",
		);
		// Should expand ~ to home dir (not start with ~)
		expect(result).not.toMatch(/^~/);
	});

	it("isObsidianAbsolutePath detects vault-relative paths", async () => {
		const { PathResolver } = await import(
			"../../../src/core/CitationValidator/PathResolver.js"
		);

		const resolver = new PathResolver({
			isFile: () => false,
			isDirectory: () => false,
			resolveFile: () => ({ found: false }),
		});

		expect(
			resolver.isObsidianAbsolutePath("0_SoftwareDevelopment/file.md"),
		).toBe(true);
		expect(resolver.isObsidianAbsolutePath("/absolute/path.md")).toBe(false);
		expect(resolver.isObsidianAbsolutePath("relative/file.md")).toBe(true);
		expect(resolver.isObsidianAbsolutePath("/starts/with/slash.md")).toBe(
			false,
		);
	});

	it("generatePathResolutionDebugInfo returns non-empty string", async () => {
		const { PathResolver } = await import(
			"../../../src/core/CitationValidator/PathResolver.js"
		);

		const resolver = new PathResolver({
			isFile: () => false,
			isDirectory: () => false,
			resolveFile: () => ({ found: false }),
		});

		const info = resolver.generatePathResolutionDebugInfo(
			"relative/target.md",
			"/base/source.md",
		);
		expect(typeof info).toBe("string");
		expect(info.length).toBeGreaterThan(0);
	});
});
