import { describe, it, expect } from "vitest";
import { runCLI } from "../helpers/cli-runner.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("CLI - extract header command", () => {
	it("should extract specified header from target file", async () => {
		// Fixture: US2.3 implementation plan from test fixtures
		const targetFile = path.resolve(
			__dirname,
			"..",
			"fixtures",
			"us2.3-implement-extract-links-subcommand-implement-plan.md",
		);
		const headerName =
			"Task 10: CitationManager - extractLinks() Phase 1 Validation";

		// When: Run extract header command
		const output = runCLI(
			`node tools/citation-manager/src/citation-manager.js extract header "${targetFile}" "${headerName}"`,
			{ captureStderr: true },
		);

		// Then: Output contains OutgoingLinksExtractedContent JSON
		// Verification: Valid JSON with expected structure
		const result = JSON.parse(output);
		expect(result).toHaveProperty("extractedContentBlocks");
		expect(result).toHaveProperty("outgoingLinksReport");

		// Verification: Content extracted for specified header
		expect(result.stats.uniqueContent).toBe(1);
	});

	it("should exit with code 1 when header not found", async () => {
		// Fixture: US2.3 plan
		const targetFile = path.resolve(
			__dirname,
			"..",
			"..",
			"design-docs",
			"features",
			"20251003-content-aggregation",
			"user-stories",
			"us2.3-implement-extract-links-subcommand",
			"us2.3-implement-extract-links-subcommand-implement-plan.md",
		);
		const invalidHeader = "Nonexistent Header Name";

		// When: Extract non-existent header
		let exitCode;
		try {
			runCLI(
				`node tools/citation-manager/src/citation-manager.js extract header "${targetFile}" "${invalidHeader}"`,
			);
		} catch (error) {
			// Pattern: Capture exit code from error
			exitCode = error.status;
		}

		// Then: Exit code 1 (validation failure)
		// Verification: US2.4 AC7 exit code behavior
		expect(exitCode).toBe(1);
	});

	it("should display validation error with suggestion", async () => {
		// Given: Target file with headers
		const targetFile = path.resolve(
			__dirname,
			"..",
			"..",
			"design-docs",
			"features",
			"20251003-content-aggregation",
			"user-stories",
			"us2.3-implement-extract-links-subcommand",
			"us2.3-implement-extract-links-subcommand-implement-plan.md",
		);
		const similarHeader = "Task 1: LinkObjectFactory"; // Partial match

		// When: Extract header with typo
		let stdout;
		try {
			runCLI(
				`node tools/citation-manager/src/citation-manager.js extract header "${targetFile}" "${similarHeader}"`,
			);
		} catch (error) {
			stdout = error.stdout;
		}

		// Then: Error message with suggestion shown
		// Verification: US2.4 AC5 diagnostic information
		expect(stdout).toContain("Validation failed");
		expect(stdout).toContain("Suggestion");
	});
});

describe("CLI Help Documentation", () => {
	it("should show extract header in top-level help", async () => {
		// When: Request top-level extract help
		const output = runCLI(
			"node tools/citation-manager/src/citation-manager.js extract --help",
		);

		// Then: Help lists header subcommand
		// Verification: US2.4 AC10 top-level help
		expect(output).toContain("header");
		expect(output).toContain("Extract specific header section content");
	});

	it("should show detailed help for extract header subcommand", async () => {
		// When: Request subcommand help
		const output = runCLI(
			"node tools/citation-manager/src/citation-manager.js extract header --help",
		);

		// Then: Detailed usage and examples shown
		// Verification: US2.4 AC10 subcommand help
		expect(output).toContain("Usage:");
		expect(output).toContain("<target-file>");
		expect(output).toContain("<header-name>");
		expect(output).toContain("--scope");

		// Then: Examples section included
		expect(output).toContain("Examples:");
		expect(output).toContain("citation-manager extract header");

		// Then: Exit codes documented
		expect(output).toContain("Exit Codes:");
		expect(output).toContain("0  Header extracted successfully");
		expect(output).toContain("1  Header not found or validation failed");
		expect(output).toContain("2  System error");
	});
});
