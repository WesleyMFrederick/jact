// test/types/validationTypes.test.ts
import { describe, expect, it } from "vitest";
import type {
	CitationValidationResult,
	FileValidationSummary,
	ResolutionResult,
} from "../../src/types/validationTypes";

describe("validationTypes", () => {
	it("should export ResolutionResult discriminated union", () => {
		// Given: Type definitions imported
		// When: Create found result
		const found: ResolutionResult = {
			found: true,
			path: "/abs/path/file.md",
			reason: "direct",
		};

		// Then: TypeScript validates discriminated union
		// Verification: Found result has path, notFound result has null path
		if (found.found) {
			expect(found.path).toBe("/abs/path/file.md");
		}

		// When: Create not found result
		const notFound: ResolutionResult = {
			found: false,
			path: null,
			reason: "not_found",
		};

		// Then: TypeScript enforces path is null when found is false
		expect(notFound.found).toBe(false);
		expect(notFound.path).toBeNull();
	});
});
