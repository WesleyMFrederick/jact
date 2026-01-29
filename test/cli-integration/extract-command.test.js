import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = join(__dirname, "..", "fixtures");

describe("Extract Command - Infrastructure", () => {
	it("should register extract links command with Commander", () => {
		// Given: citation-manager CLI

		// When: Request help for extract links command
		const output = execSync(
			"node dist/citation-manager.js extract links --help",
			{ encoding: "utf8" },
		);

		// Then: Extract links command help displays
		// Verification: Commander registered extract links command
		expect(output).toContain("Usage: citation-manager extract links");
		expect(output).toContain("<source-file>");
		expect(output).toContain(
			"Extract content from all links in source document",
		);
	});
});

describe("Extract Links Subcommand - Registration", () => {
	it("should register extract links subcommand with required arguments", () => {
		// Given: citation-manager CLI with extract command

		// When: Request help for extract links
		const output = execSync(
			"node dist/citation-manager.js extract links --help",
			{ encoding: "utf8" },
		);

		// Then: Subcommand help displays with arguments and options
		expect(output).toContain("citation-manager extract links");
		expect(output).toContain("<source-file>");
		expect(output).toContain("--scope <folder>");
		expect(output).toContain("--format <type>");
		expect(output).toContain("--full-files");
	});
});

describe("Extract Links - CLI Orchestration", () => {
	it("should call CitationManager.extractLinks() from CLI action", () => {
		// Given: Test fixture with valid links
		const fixtureFile = join(FIXTURES_DIR, "section-extraction", "links.md");

		// When: Execute extract links command
		const output = execSync(
			`node dist/citation-manager.js extract links ${fixtureFile}`,
			{ encoding: "utf8" },
		);

		// Then: JSON output returned
		// Verification: CLI wired to CitationManager method
		const result = JSON.parse(output);
		expect(result.extractedContentBlocks).toBeDefined();
		expect(result.outgoingLinksReport).toBeDefined();
		expect(result.stats).toBeDefined();
	});
});

describe("Extract Links - Validation Error Reporting", () => {
	it("should report validation errors to stderr before extraction", () => {
		// Given: Test fixture with broken citations
		const fixtureFile = join(FIXTURES_DIR, "us2.2", "error-links-source.md");

		// When: Execute extract links command
		// Note: 2>&1 redirects stderr to stdout so we can capture it
		// Note: Command exits with code 1 (no content extracted), so we catch the error
		let output;
		try {
			output = execSync(
				`node dist/citation-manager.js extract links "${fixtureFile}" 2>&1`,
				{ encoding: "utf8" },
			);
		} catch (error) {
			// execSync throws when exit code is non-zero
			output = error.stdout;
		}

		// Then: Stderr contains validation error messages
		// Verification: Phase 1 errors reported before Phase 2
		expect(output).toContain("Validation errors found");
		expect(output).toContain("Line 5: File not found");
		expect(output).toContain("Line 7: Anchor not found");
	});
});

describe("Extract Links - Full Files Flag", () => {
	it("should extract full-file links when --full-files flag provided", () => {
		// Given: Test fixture with full-file link (no anchor)
		const fixtureFile = join(FIXTURES_DIR, "full-file-links.md");

		// When: Execute with --full-files flag
		const output = execSync(
			`node dist/citation-manager.js extract links "${fixtureFile}" --full-files`,
			{ encoding: "utf8" },
		);

		// Then: Full-file content extracted
		// Verification: CliFlagStrategy enabled by --full-files
		const result = JSON.parse(output);
		expect(result.stats.uniqueContent).toBeGreaterThan(0);
		expect(result.outgoingLinksReport.processedLinks[0].status).toBe(
			"extracted",
		);
	});

	it("should skip full-file links when --full-files flag NOT provided", () => {
		// Given: Test fixture with full-file link
		const fixtureFile = join(FIXTURES_DIR, "full-file-links.md");

		// When: Execute WITHOUT --full-files flag
		let output;
		try {
			output = execSync(
				`node dist/citation-manager.js extract links "${fixtureFile}"`,
				{ encoding: "utf8" },
			);
		} catch (error) {
			// execSync throws when exit code is non-zero (no content extracted)
			output = error.stdout;
		}

		// Then: Full-file link skipped (ineligible)
		const result = JSON.parse(output);
		expect(result.outgoingLinksReport.processedLinks[0].status).toBe("skipped");
	});
});

describe("Extract Links - Exit Codes", () => {
	it("should exit with code 0 when at least one link extracted successfully", () => {
		// Given: Test fixture with valid extractable links
		const fixtureFile = join(FIXTURES_DIR, "section-extraction", "links.md");

		// When: Execute extract links command and check exit code
		const result = execSync(
			`node dist/citation-manager.js extract links "${fixtureFile}" > /dev/null 2>&1; echo $?`,
			{ encoding: "utf8" },
		);

		// Then: Exit code is 0
		// Verification: Success signaled when stats.uniqueContent > 0
		expect(result.trim()).toBe("0");
	});

	it("should exit with code 1 when no eligible links extracted", () => {
		// Given: Test fixture with only full-file links (no --full-files flag)
		const fixtureFile = join(FIXTURES_DIR, "full-file-links.md");

		// When: Execute extract links command without --full-files flag
		const result = execSync(
			`node dist/citation-manager.js extract links "${fixtureFile}" > /dev/null 2>&1; echo $?`,
			{ encoding: "utf8" },
		);

		// Then: Exit code is 1
		// Verification: Failure signaled when stats.uniqueContent === 0
		expect(result.trim()).toBe("1");
	});
});

describe("Extract Command - Help Documentation", () => {
	it("should display comprehensive help for extract command", () => {
		// Given: citation-manager CLI

		// When: Request help for extract command
		const output = execSync(
			"node dist/citation-manager.js extract --help",
			{ encoding: "utf8" },
		);

		// Then: Help text includes description and subcommand list
		expect(output).toContain("Extract content from citations");
		expect(output).toContain("Commands:");
		expect(output).toContain("links");
		expect(output).toContain("Extract content from all links in source");
	});
});

describe("Extract Links - Help Documentation", () => {
	it("should display detailed help for extract links subcommand", () => {
		// Given: citation-manager CLI

		// When: Request help for extract links
		const output = execSync(
			"node dist/citation-manager.js extract links --help",
			{ encoding: "utf8" },
		);

		// Then: Help includes usage, options, examples, and exit codes
		expect(output).toContain("Usage: citation-manager extract links");
		expect(output).toContain("Options:");
		expect(output).toContain("--scope");
		expect(output).toContain("--full-files");
		expect(output).toContain("Examples:");
		expect(output).toContain("Exit Codes:");
	});
});
