import { describe, expect, it } from "vitest";
import {
	normalizeBlockId,
	decodeUrlAnchor,
} from "../src/core/ContentExtractor/normalizeAnchor.js";

describe("Anchor Normalization Utilities", () => {
	it("should remove caret prefix from block anchor", () => {
		// Given: Block anchor with caret '^block-id'
		const input: string = "^block-id";

		// When: normalizeBlockId called
		const result: string | null = normalizeBlockId(input);

		// Then: Caret prefix removed
		expect(result).toBe("block-id");
	});

	it("should return null for null block anchor", () => {
		// Given: null anchor
		const input: null = null;

		// When: normalizeBlockId called
		const result: string | null = normalizeBlockId(input);

		// Then: Returns null unchanged
		expect(result).toBe(null);
	});

	it("should return unchanged anchor without caret", () => {
		// Given: Anchor without caret 'no-caret'
		const input: string = "no-caret";

		// When: normalizeBlockId called
		const result: string | null = normalizeBlockId(input);

		// Then: Returns unchanged
		expect(result).toBe("no-caret");
	});
});

describe("URL Decoding", () => {
	it("should decode URL-encoded anchor with spaces", () => {
		// Given: URL-encoded anchor 'Story%201.7%20Implementation'
		const input: string = "Story%201.7%20Implementation";

		// When: decodeUrlAnchor called
		const result: string | null = decodeUrlAnchor(input);

		// Then: Decoded to spaces
		expect(result).toBe("Story 1.7 Implementation");
	});

	it("should return original anchor if decoding fails", () => {
		// Given: Invalid encoding 'invalid%'
		const input: string = "invalid%";

		// When: decodeUrlAnchor called with invalid encoding
		const result: string | null = decodeUrlAnchor(input);

		// Then: Returns original (graceful fallback)
		expect(result).toBe("invalid%");
	});

	it("should handle null anchor", () => {
		// Given: null anchor
		const input: null = null;

		// When: decodeUrlAnchor called
		const result: string | null = decodeUrlAnchor(input);

		// Then: Returns null
		expect(result).toBe(null);
	});
});
