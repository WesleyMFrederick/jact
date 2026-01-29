import { describe, it, expect } from "vitest";
import { generateContentId } from "../src/core/ContentExtractor/generateContentId.ts";

describe("Content ID Generation - Determinism", () => {
	it("should generate identical hashes for identical content", () => {
		// Given: Two identical content strings
		const content1 = "This is test content for hashing.";
		const content2 = "This is test content for hashing.";

		// When: Generate content IDs for both
		const id1 = generateContentId(content1);
		const id2 = generateContentId(content2);

		// Then: Content IDs are identical (deterministic hashing)
		// Verification: SHA-256 determinism validated
		expect(id1).toBe(id2);
	});
});

describe("Content ID Generation - Collision Avoidance", () => {
	it("should generate different hashes for different content", () => {
		// Given: Two different content strings
		const content1 = "First piece of content";
		const content2 = "Second piece of content";

		// When: Generate content IDs for both
		const id1 = generateContentId(content1);
		const id2 = generateContentId(content2);

		// Then: Content IDs are different (collision avoidance)
		// Verification: SHA-256 uniqueness validated
		expect(id1).not.toBe(id2);
	});
});

describe("Content ID Generation - Format", () => {
	it("should truncate hash to exactly 16 hexadecimal characters", () => {
		// Given: Any content string
		const content = "Test content for format validation";

		// When: Generate content ID
		const contentId = generateContentId(content);

		// Then: Content ID is exactly 16 characters
		// Verification: Truncation to 16 chars per AC2
		expect(contentId).toHaveLength(16);

		// Then: Content ID contains only hexadecimal characters
		// Pattern: Validate hex format [0-9a-f]{16}
		expect(contentId).toMatch(/^[0-9a-f]{16}$/);
	});
});
