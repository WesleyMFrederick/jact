import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCLI } from "../helpers/cli-runner.js";

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
			`node dist/cli.js extract header "${targetFile}" "${headerName}" --format json --verbose`,
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
			"fixtures",
			"us2.3-implement-extract-links-subcommand-implement-plan.md",
		);
		const invalidHeader = "Nonexistent Header Name";

		// When: Extract non-existent header
		let exitCode;
		try {
			runCLI(
				`node dist/cli.js extract header "${targetFile}" "${invalidHeader}"`,
			);
		} catch (error) {
			// Pattern: Capture exit code from error
			exitCode = error.status;
		}

		// Then: Exit code 1 (validation failure)
		// Verification: US2.4 AC7 exit code behavior
		expect(exitCode).toBe(1);
	});

	it("shows close alternatives when a heading is missing", async () => {
		const targetFile = path.resolve(
			__dirname,
			"..",
			"fixtures",
			"us2.3-implement-extract-links-subcommand-implement-plan.md",
		);
		const similarHeader = "Task 1: LinkObjectFactory";

		let output;
		try {
			runCLI(
				`node dist/cli.js extract header "${targetFile}" "${similarHeader}"`,
			);
		} catch (error) {
			output = error.stdout;
		}

		expect(output).toContain("was not found");
		expect(output).toContain("Close alternatives:");
	});

	it("rejects a duplicate heading without a parent filter", async () => {
		const targetFile = path.resolve(
			__dirname,
			"..",
			"fixtures",
			"outline-command.md",
		);

		let output;
		let exitCode;
		try {
			runCLI(`node dist/cli.js extract header "${targetFile}" "Install"`);
		} catch (error) {
			output = error.stdout;
			exitCode = error.status;
		}

		expect(exitCode).toBe(1);
		expect(output).toContain('"Install" is ambiguous');
		expect(output).toContain('under "Guide"');
		expect(output).toContain('under "Appendix"');
		expect(output).toContain('--within "Guide"');
		expect(output).not.toContain("Install on Linux.");
	});

	it("extracts only the duplicate heading inside the selected parent", async () => {
		const targetFile = path.resolve(
			__dirname,
			"..",
			"fixtures",
			"outline-command.md",
		);

		const output = runCLI(
			`node dist/cli.js extract header "${targetFile}" "Install" --within "Guide"`,
		);

		expect(output).toContain("Install on Linux.");
		expect(output).not.toContain("Alternate install");
	});

	it("rejects missing or ambiguous parent filters", async () => {
		const targetFile = path.resolve(
			__dirname,
			"..",
			"fixtures",
			"outline-command.md",
		);
		let missingOutput;
		let ambiguousOutput;

		try {
			runCLI(
				`node dist/cli.js extract header "${targetFile}" "Install" --within "Gide"`,
			);
		} catch (error) {
			missingOutput = error.stdout;
		}
		try {
			runCLI(
				`node dist/cli.js extract header "${targetFile}" "macOS" --within "Install"`,
			);
		} catch (error) {
			ambiguousOutput = error.stdout;
		}

		expect(missingOutput).toContain('"Gide" was not found');
		expect(missingOutput).toContain('"Guide"');
		expect(ambiguousOutput).toContain('"Install" is ambiguous');
		expect(ambiguousOutput).not.toContain("Homebrew");
	});
});

describe("CLI Help Documentation", () => {
	it("should show extract header in top-level help", async () => {
		// When: Request top-level extract help
		const output = runCLI("node dist/cli.js extract --help");

		// Then: Help lists header subcommand
		// Verification: US2.4 AC10 top-level help
		expect(output).toContain("header");
		expect(output).toContain("Extract specific header section content");
	});

	it("should show detailed help for extract header subcommand", async () => {
		// When: Request subcommand help
		const output = runCLI("node dist/cli.js extract header --help");

		// Then: Detailed usage and examples shown
		// Verification: US2.4 AC10 subcommand help
		expect(output).toContain("Usage:");
		expect(output).toContain("<target-file>");
		expect(output).toContain("<header-name>");
		expect(output).toContain("--scope");
		expect(output).toContain("--within <parent>");

		// Then: Examples section included
		expect(output).toContain("Examples:");
		expect(output).toContain("jact extract header");

		// Then: Exit codes documented
		expect(output).toContain("Exit Codes:");
		expect(output).toContain("0  Header extracted successfully");
		expect(output).toContain("1  Header not found or validation failed");
		expect(output).toContain("2  System error");
	});
});
