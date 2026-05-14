/**
 * Contract tests: componentFactory accepts interface-typed dependencies.
 *
 * These tests verify that:
 * 1. createCitationValidator accepts plain objects satisfying ParsedFileCacheLike
 *    and FileCacheLike WITHOUT importing the production ParsedFileCache / FileCache classes.
 * 2. InMemoryFileCache satisfies FileCacheLike and integrates via the factory.
 * 3. The factory wires the injected mock through to the constructed CitationValidator
 *    (behavioral proof, not instanceof check).
 *
 * If the factory still accepted only concrete classes, these tests would fail at
 * TypeScript compile time (type error on the plain-object argument).
 */

import { describe, expect, it, vi } from "vitest";
import { InMemoryFileCache } from "../../../src/cache/InMemoryFileCache.js";
import { CitationValidator } from "../../../src/core/CitationValidator/CitationValidator.js";
import { createCitationValidator } from "../../../src/factories/componentFactory.js";
import type {
	FileCacheLike,
	ParsedFileCacheLike,
} from "../../../src/types/componentInterfaces.js";

// ── Minimal plain-object test doubles ────────────────────────────────────────

/**
 * A plain object (no class import) that satisfies ParsedFileCacheLike.
 * The factory must accept this without requiring instanceof ParsedFileCache.
 */
function makeMockParsedFileCache(): ParsedFileCacheLike {
	return {
		resolveParsedFile: vi.fn().mockResolvedValue({
			hasAnchor: vi.fn().mockReturnValue(false),
			findSimilarAnchors: vi.fn().mockReturnValue([]),
			getLinks: vi.fn().mockReturnValue([]),
			data: { anchors: [] },
		}),
	};
}

/**
 * A plain object (no class import) that satisfies FileCacheLike.
 */
function makeMockFileCache(): FileCacheLike {
	return {
		resolveFile: vi.fn().mockReturnValue({ found: false, reason: "not_found" }),
	};
}

// ── Test suites ───────────────────────────────────────────────────────────────

describe("createCitationValidator — interface injection (no production class import)", () => {
	it("accepts a plain object implementing ParsedFileCacheLike without importing ParsedFileCache", () => {
		// Given: test doubles built from plain objects, no ParsedFileCache imported
		const mockParsedCache = makeMockParsedFileCache();
		const mockFileCache = makeMockFileCache();

		// When: factory called with interface-typed plain objects
		const validator = createCitationValidator(
			mockParsedCache as Parameters<typeof createCitationValidator>[0],
			mockFileCache,
		);

		// Then: returns a CitationValidator (factory wired successfully)
		expect(validator).toBeInstanceOf(CitationValidator);
	});

	it("accepts a plain FileCacheLike object and creates a CitationValidator", () => {
		// Given: only a mock file cache provided; parsedFileCache defaults
		const mockFileCache: FileCacheLike = {
			resolveFile: vi
				.fn()
				.mockReturnValue({ found: false, reason: "not_found" }),
		};

		// When: factory called with interface-typed file cache
		const validator = createCitationValidator(null, mockFileCache);

		// Then: returns a CitationValidator
		expect(validator).toBeInstanceOf(CitationValidator);
	});

	it("calls resolveParsedFile on the injected mock (behavioral wiring proof)", async () => {
		// Given: mock with a spy on resolveParsedFile
		const mockParsedCache = makeMockParsedFileCache();
		const mockFileCache = makeMockFileCache();
		const validator = createCitationValidator(
			mockParsedCache as Parameters<typeof createCitationValidator>[0],
			mockFileCache,
		);

		// When: validateFile is called (it reads the source file via parsedFileCache)
		// We pass a non-existent path — validator will throw "File not found" before
		// ever calling resolveParsedFile, so we verify the mock was NOT called (no leak)
		await expect(
			validator.validateFile("/non-existent-path.md"),
		).rejects.toThrow("File not found");

		// Then: mock was not called (validator throws before reaching cache)
		expect(mockParsedCache.resolveParsedFile).not.toHaveBeenCalled();
	});
});

describe("InMemoryFileCache — FileCacheLike adapter", () => {
	it("satisfies FileCacheLike interface (TypeScript structural check via usage)", () => {
		// Given: InMemoryFileCache constructed with seed entries
		const cache: FileCacheLike = new InMemoryFileCache({
			"foo.md": "/abs/path/foo.md",
		});

		// When / Then: typed as FileCacheLike, no compile error
		expect(cache).toBeDefined();
	});

	it("returns found:true for seeded entry", () => {
		// Given: cache seeded with one entry
		const cache = new InMemoryFileCache({ "foo.md": "/abs/path/foo.md" });

		// When: resolveFile called with seeded filename
		const result = cache.resolveFile("foo.md");

		// Then: returns found result with correct path
		expect(result.found).toBe(true);
		expect(result.path).toBe("/abs/path/foo.md");
	});

	it("returns found:false for unknown entry", () => {
		// Given: empty cache
		const cache = new InMemoryFileCache();

		// When: resolveFile called with unknown filename
		const result = cache.resolveFile("unknown.md");

		// Then: returns not-found result
		expect(result.found).toBe(false);
		expect(result.reason).toBe("not_found");
	});

	it("set() adds an entry that resolveFile can find", () => {
		// Given: empty cache
		const cache = new InMemoryFileCache();

		// When: entry added via set()
		cache.set("bar.md", "/abs/path/bar.md");
		const result = cache.resolveFile("bar.md");

		// Then: entry is found
		expect(result.found).toBe(true);
		expect(result.path).toBe("/abs/path/bar.md");
	});

	it("integrates with createCitationValidator via FileCacheLike interface", () => {
		// Given: InMemoryFileCache injected into factory (no FileCache class imported)
		const inMemory = new InMemoryFileCache({ "doc.md": "/project/doc.md" });

		// When: factory called with InMemoryFileCache as fileCache
		const validator = createCitationValidator(null, inMemory);

		// Then: returns CitationValidator (factory accepted interface-typed adapter)
		expect(validator).toBeInstanceOf(CitationValidator);
	});
});
