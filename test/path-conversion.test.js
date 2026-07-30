import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PathResolver } from "../src/core/CitationValidator/PathResolver.js";
import { createFileCache } from "../src/factories/componentFactory.js";
import { runCLI } from "./helpers/cli-runner.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const citationManagerPath = join(__dirname, "..", "dist", "cli.js");

function createPathResolver() {
	return new PathResolver(createFileCache());
}

describe("Path Conversion Calculation", () => {
	it("should calculate correct relative path for cross-directory resolution", () => {
		const validator = createPathResolver();
		const sourceFile = join(__dirname, "fixtures", "warning-test-source.md");
		const targetFile = join(
			__dirname,
			"fixtures",
			"subdir",
			"warning-test-target.md",
		);

		const relativePath = validator.calculateRelativePath(
			sourceFile,
			targetFile,
		);
		expect(relativePath).toBe("subdir/warning-test-target.md");
	});

	it("should calculate relative path for same directory files", () => {
		const validator = createPathResolver();
		const sourceFile = join(__dirname, "fixtures", "warning-test-source.md");
		const targetFile = join(__dirname, "fixtures", "test-target.md");

		const relativePath = validator.calculateRelativePath(
			sourceFile,
			targetFile,
		);
		expect(relativePath).toBe("test-target.md");
	});

	it("should calculate relative path for parent directory access", () => {
		const validator = createPathResolver();
		const sourceFile = join(
			__dirname,
			"fixtures",
			"subdir",
			"warning-test-target.md",
		);
		const targetFile = join(__dirname, "fixtures", "warning-test-source.md");

		const relativePath = validator.calculateRelativePath(
			sourceFile,
			targetFile,
		);
		expect(relativePath).toBe("../warning-test-source.md");
	});

	it("should calculate relative path for nested subdirectories", () => {
		const validator = createPathResolver();
		const sourceFile = join(__dirname, "fixtures", "warning-test-source.md");
		const targetFile = join(__dirname, "fixtures", "nested", "deep", "file.md");

		const relativePath = validator.calculateRelativePath(
			sourceFile,
			targetFile,
		);
		expect(relativePath).toBe("nested/deep/file.md");
	});

	it("should handle absolute paths by converting to relative paths", () => {
		const validator = createPathResolver();
		const sourceFile = join(__dirname, "fixtures", "warning-test-source.md");
		const targetFile = join(
			__dirname,
			"fixtures",
			"subdir",
			"warning-test-target.md",
		);

		const relativePath = validator.calculateRelativePath(
			sourceFile,
			targetFile,
		);
		expect(relativePath).toBe("subdir/warning-test-target.md");

		// Should not contain absolute path components
		expect(relativePath.includes(__dirname)).toBe(false);
	});
});

describe("Path Conversion Suggestion Integration", () => {
	it("should include path conversion suggestions in warning validation results", () => {
		const testFile = join(__dirname, "fixtures", "warning-test-source.md");
		const scopeFolder = join(__dirname, "fixtures");

		const output = runCLI(
			`node "${citationManagerPath}" validate "${testFile}" --scope "${scopeFolder}" --format json`,
			{
				cwd: __dirname,
				captureStderr: false,
			},
		);
		const result = JSON.parse(output);
		const conversionWarning = result.links.find(
			(link) =>
				link.validation.status === "warning" &&
				link.fullMatch.includes("../wrong-path/warning-test-target.md"),
		);

		expect(conversionWarning).toBeTruthy();
		expect(conversionWarning.validation.pathConversion).toEqual({
			type: "path-conversion",
			original: "../wrong-path/warning-test-target.md#Test%20Anchor",
			recommended: "subdir/warning-test-target.md#Test%20Anchor",
		});
	});

	it("should preserve anchor fragments in conversion suggestions", () => {
		const validator = createPathResolver();

		// Test anchor preservation with URL encoding
		const sourceFile = join(__dirname, "fixtures", "warning-test-source.md");
		const targetFile = join(
			__dirname,
			"fixtures",
			"subdir",
			"warning-test-target.md",
		);
		const originalCitation =
			"../wrong-path/warning-test-target.md#Test%20Anchor";

		const suggestion = validator.generatePathConversionSuggestion(
			originalCitation,
			sourceFile,
			targetFile,
		);

		expect(suggestion.recommended).toBe(
			"subdir/warning-test-target.md#Test%20Anchor",
		);

		expect(suggestion.type).toBe("path-conversion");

		expect(suggestion.original).toBe(originalCitation);
	});

	it("should handle citations without anchors in conversion suggestions", () => {
		const validator = createPathResolver();

		const sourceFile = join(__dirname, "fixtures", "warning-test-source.md");
		const targetFile = join(
			__dirname,
			"fixtures",
			"subdir",
			"warning-test-target.md",
		);
		const originalCitation = "../wrong-path/warning-test-target.md";

		const suggestion = validator.generatePathConversionSuggestion(
			originalCitation,
			sourceFile,
			targetFile,
		);

		expect(suggestion.recommended).toBe("subdir/warning-test-target.md");

		expect(suggestion.recommended.includes("#")).toBe(false);
	});

	it("should generate conversion suggestions for various directory structures", () => {
		const validator = createPathResolver();

		// Test multiple directory scenarios
		const testCases = [
			{
				source: join(__dirname, "fixtures", "warning-test-source.md"),
				target: join(__dirname, "fixtures", "subdir", "warning-test-target.md"),
				original: "../wrong-path/warning-test-target.md#anchor",
				expected: "subdir/warning-test-target.md#anchor",
			},
			{
				source: join(__dirname, "fixtures", "subdir", "warning-test-target.md"),
				target: join(__dirname, "fixtures", "warning-test-source.md"),
				original: "wrong-dir/warning-test-source.md",
				expected: "../warning-test-source.md",
			},
			{
				source: join(__dirname, "fixtures", "warning-test-source.md"),
				target: join(__dirname, "fixtures", "test-target.md"),
				original: "subdir/test-target.md",
				expected: "test-target.md",
			},
		];

		for (const testCase of testCases) {
			const suggestion = validator.generatePathConversionSuggestion(
				testCase.original,
				testCase.source,
				testCase.target,
			);

			expect(suggestion.recommended).toBe(testCase.expected);
		}
	});
});

describe("Path Conversion Validation Result Structure", () => {
	it("preserves the enriched-link contract while adding conversion metadata", () => {
		const testFile = join(__dirname, "fixtures", "warning-test-source.md");
		const scopeFolder = join(__dirname, "fixtures");
		const output = runCLI(
			`node "${citationManagerPath}" validate "${testFile}" --scope "${scopeFolder}" --format json`,
			{ cwd: __dirname },
		);
		const result = JSON.parse(output);
		const warning = result.links.find(
			(link) => link.validation.status === "warning",
		);

		expect(warning).toMatchObject({
			line: expect.any(Number),
			fullMatch: expect.any(String),
			validation: {
				status: "warning",
				pathConversion: {
					type: "path-conversion",
					recommended: expect.any(String),
				},
			},
		});
	});
});
