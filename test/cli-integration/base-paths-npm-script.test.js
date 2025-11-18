import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCLI } from "../helpers/cli-runner.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = join(__dirname, "..", "..", "..", "..");

/**
 * US2.7: Base-Paths NPM Script Integration Tests
 *
 * Tests the citation:base-paths npm script which extracts unique absolute paths
 * from citations in markdown files. The script uses `extract links` instead of
 * `validate` to avoid the 64KB buffer limit issue.
 */
describe("citation:base-paths npm script (US2.7)", () => {
	it("should extract base paths from simple test file", () => {
		// Given: Test file with multiple citations
		const testFile = join(__dirname, "..", "fixtures", "enhanced-citations.md");

		// When: Execute npm script (extract links → jq → sort -u)
		const output = runCLI(
			`npm run --silent citation:base-paths "${testFile}"`,
			{ cwd: workspaceRoot },
		);

		// Then: Output is newline-separated unique sorted paths
		const paths = output
			.trim()
			.split("\n")
			.filter((p) => p.length > 0);

		expect(paths.length).toBeGreaterThanOrEqual(6);
		expect(paths).toEqual([...new Set(paths)]); // Unique (sort -u)
		expect(paths).toEqual([...paths].sort()); // Sorted alphabetically
		expect(paths.every((p) => p !== "null")).toBe(true); // No literal "null" strings

		// Spot-check expected paths
		expect(paths.some((p) => p.includes("test-target.md"))).toBe(true);
		expect(paths.some((p) => p.includes("design-principles.md"))).toBe(true);
	});

	it("should handle large files that exceed 64KB buffer limit", () => {
		// Given: Complex PRD file with 100+ citations (triggers >64KB JSON output with validate)
		const testFile = join(
			__dirname,
			"..",
			"fixtures",
			"content-aggregation-prd.md",
		);

		// When: Execute npm script using extract links (bypasses buffer limit)
		const output = runCLI(
			`npm run --silent citation:base-paths "${testFile}"`,
			{ cwd: workspaceRoot },
		);

		// Then: Successfully extracts paths despite large output size
		const paths = output
			.trim()
			.split("\n")
			.filter((p) => p.length > 0);

		// PRD has many citations across multiple files
		expect(paths.length).toBeGreaterThanOrEqual(15);

		// Verify output quality
		expect(paths).toEqual([...new Set(paths)]); // Deduplicated
		// Note: sort -u uses locale-specific sorting which may differ from JS .sort()
		expect(paths.every((p) => p.startsWith("/"))).toBe(true); // All absolute paths
		expect(paths.every((p) => p.endsWith(".md"))).toBe(true); // All markdown files

		// Spot-check expected architectural docs (note: spaces are URL-encoded as %20)
		expect(
			paths.some((p) => p.includes("Architecture") && p.includes("Principles")),
		).toBe(true);
		expect(paths.some((p) => p.includes("component-guides"))).toBe(true);
	});

	it("should output valid absolute paths only", () => {
		// Given: Test file with mix of valid and invalid citations
		const testFile = join(__dirname, "..", "fixtures", "enhanced-citations.md");

		// When: Execute npm script
		const output = runCLI(
			`npm run --silent citation:base-paths "${testFile}"`,
			{ cwd: workspaceRoot },
		);

		// Then: All paths are absolute and well-formed
		const paths = output
			.trim()
			.split("\n")
			.filter((p) => p.length > 0);

		paths.forEach((path) => {
			expect(path).toMatch(/^\//); // Unix absolute path
			expect(path).not.toContain("null"); // No null strings
			expect(path).not.toContain("undefined"); // No undefined strings
			expect(path.length).toBeGreaterThan(10); // Reasonable path length
		});
	});

	it("should filter out citations without absolute paths", () => {
		// Given: Test file with internal citations (no target.path.absolute)
		const testFile = join(__dirname, "..", "fixtures", "enhanced-citations.md");

		// When: Execute npm script with jq filter
		const output = runCLI(
			`npm run --silent citation:base-paths "${testFile}"`,
			{ cwd: workspaceRoot },
		);

		// Then: Only cross-document citations with absolute paths are included
		const paths = output
			.trim()
			.split("\n")
			.filter((p) => p.length > 0);

		// Internal citations (^block-id) should not appear in output
		paths.forEach((path) => {
			expect(path).not.toMatch(/\^[a-z0-9-]+$/); // No block IDs
			expect(path).toMatch(/\.md$/); // Must be file paths
		});
	});
});
