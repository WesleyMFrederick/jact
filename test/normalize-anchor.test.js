import { describe, expect, it } from "vitest";
import {
	normalizeBlockId,
	decodeUrlAnchor,
} from "../src/core/ContentExtractor/normalizeAnchor.js";

describe("Anchor Normalization Utilities", () => {
	it("should remove caret prefix from block anchor", () => {
		// Given: Block anchor with caret '^block-id'
		// When: normalizeBlockId called
		const result = normalizeBlockId("^block-id");

		// Then: Caret prefix removed
		expect(result).toBe("block-id");
	});

	it("should return null for null block anchor", () => {
		// Given: null anchor
		// When: normalizeBlockId called
		// Then: Returns null unchanged
		expect(normalizeBlockId(null)).toBe(null);
	});

	it("should return unchanged anchor without caret", () => {
		// Given: Anchor without caret 'no-caret'
		// When: normalizeBlockId called
		// Then: Returns unchanged
		expect(normalizeBlockId("no-caret")).toBe("no-caret");
	});
});

describe("URL Decoding", () => {
	it("should decode URL-encoded anchor with spaces", () => {
		// Given: URL-encoded anchor 'Story%201.7%20Implementation'
		// When: decodeUrlAnchor called
		// Then: Decoded to spaces
		expect(decodeUrlAnchor("Story%201.7%20Implementation")).toBe(
			"Story 1.7 Implementation",
		);
	});

	it("should return original anchor if decoding fails", () => {
		// Given: Invalid encoding 'invalid%'
		// When: decodeUrlAnchor called with invalid encoding
		// Then: Returns original (graceful fallback)
		expect(decodeUrlAnchor("invalid%")).toBe("invalid%");
	});

	it("should handle null anchor", () => {
		// Given: null anchor
		// When: decodeUrlAnchor called
		// Then: Returns null
		expect(decodeUrlAnchor(null)).toBe(null);
	});
});
