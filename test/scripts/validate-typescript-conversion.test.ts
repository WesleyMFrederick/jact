import { describe, it, expect } from "vitest";
import {
	validateConversion,
	type ConversionValidation,
	type ValidationResult,
} from "../../scripts/validate-typescript-conversion.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("validate-typescript-conversion", () => {
	it("should return validation result with 7 checkpoints for normalizeAnchor.ts", () => {
		// Given: Path to Epic 3 POC file
		// Fixture: Use actual normalizeAnchor.ts from src/core/ContentExtractor/
		const filePath = resolve(
			__dirname,
			"../../src/core/ContentExtractor/normalizeAnchor.ts"
		);

		// When: Run validation checkpoints
		// Integration: Spawns tsc, searches file content
		const result: ConversionValidation = validateConversion(filePath);

		// Then: Result structure is correct
		// Verification: Each checkpoint in results array has required fields
		expect(result.file).toBe(filePath);
		expect(result.results).toHaveLength(7);
		expect(typeof result.allPassed).toBe("boolean");

		// Pattern: Validate checkpoint names match Epic 3 spec
		const checkpointNames = result.results.map((r) => r.checkpoint);
		expect(checkpointNames).toContain("TypeScript Compilation");
		expect(checkpointNames).toContain("No `any` Escapes");
		expect(checkpointNames).toContain("Explicit Return Types");
		expect(checkpointNames).toContain("Strict Null Checking");
		expect(checkpointNames).toContain("All Tests Pass");
		expect(checkpointNames).toContain("JavaScript Consumers Work");
		expect(checkpointNames).toContain("Compiled Output Generated");

		// Verification: All checkpoint results have proper structure
		result.results.forEach((checkpoint: ValidationResult) => {
			expect(typeof checkpoint.checkpoint).toBe("string");
			expect(typeof checkpoint.passed).toBe("boolean");
			expect(typeof checkpoint.message).toBe("string");
		});
	});

	it("should return validation result structure even for non-existent files", () => {
		// Given: Non-existent file path
		const filePath = resolve(__dirname, "../../src/non-existent-file.ts");

		// When: Run validation on non-existent file
		const result: ConversionValidation = validateConversion(filePath);

		// Then: Result structure is still valid
		expect(result.file).toBe(filePath);
		expect(result.results).toHaveLength(7);
		expect(typeof result.allPassed).toBe("boolean");
		// Non-existent file will fail compilation checkpoint
		const compilationCheckpoint = result.results.find(
			(r) => r.checkpoint === "TypeScript Compilation"
		);
		expect(compilationCheckpoint).toBeDefined();
	});

	it("should detect missing return types in exports", () => {
		// Given: normalizeAnchor.ts has explicit return types
		const filePath = resolve(
			__dirname,
			"../../src/core/ContentExtractor/normalizeAnchor.ts"
		);

		// When: Run validation
		const result: ConversionValidation = validateConversion(filePath);

		// Then: Explicit Return Types checkpoint should pass
		const returnTypeCheckpoint = result.results.find(
			(r) => r.checkpoint === "Explicit Return Types"
		);
		expect(returnTypeCheckpoint).toBeDefined();
		expect(returnTypeCheckpoint?.passed).toBe(true);
	});

	it("should detect any type usage", () => {
		// Given: normalizeAnchor.ts has no `any` escapes
		const filePath = resolve(
			__dirname,
			"../../src/core/ContentExtractor/normalizeAnchor.ts"
		);

		// When: Run validation
		const result: ConversionValidation = validateConversion(filePath);

		// Then: No `any` Escapes checkpoint should pass
		const anyCheckpoint = result.results.find(
			(r) => r.checkpoint === "No `any` Escapes"
		);
		expect(anyCheckpoint).toBeDefined();
		expect(anyCheckpoint?.passed).toBe(true);
	});
});
