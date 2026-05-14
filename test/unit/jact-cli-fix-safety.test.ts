/**
 * JactCli.fix() safety tests — TDD RED phase for issue #31
 *
 * Tests backup creation, dry-run behavior, and scope boundary check
 * at the orchestrator level. CitationFixer unit tests are in
 * test/unit/core/CitationFixer.test.ts.
 *
 * Uses vi.mock("node:fs") to intercept file I/O without touching the
 * real filesystem.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Dynamic import used so vi.mock hoisting applies before module load
const getJactCli = async () => {
	const { JactCli } = await import("../../dist/jact.js");
	return JactCli;
};

// ---------------------------------------------------------------------------
// Shared fixture helpers
// ---------------------------------------------------------------------------

/** Minimal markdown content with one path citation that has a pathConversion */
const FIXTURE_CONTENT =
	"See [Design](path/to/design.md#heading) for details.\n";

/** A FixRecord representing a path correction */
const PATH_FIX = {
	line: 1,
	old: "[Design](path/to/design.md#heading)",
	new: "[Design](corrected/design.md#heading)",
	type: "path" as const,
};

// ---------------------------------------------------------------------------
// Backup creation tests
// ---------------------------------------------------------------------------

describe("JactCli.fix() — backup creation", () => {
	it("writes a .bak file before writing the fixed file", async () => {
		const { default: fs } = await import("node:fs");
		const writeSpy = vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});
		const readSpy = vi
			.spyOn(fs, "readFileSync")
			.mockReturnValue(FIXTURE_CONTENT);

		const JactCli = await getJactCli();
		const cli = new JactCli();

		// Stub validateFile to return one path-fixable link
		const validator = (
			cli as unknown as { validator: { validateFile: () => unknown } }
		).validator;
		vi.spyOn(validator, "validateFile").mockResolvedValue({
			links: [
				{
					fullMatch: "[Design](path/to/design.md#heading)",
					line: 1,
					validation: {
						status: "warning",
						pathConversion: {
							original: "path/to/design.md",
							recommended: "corrected/design.md",
						},
						error: "",
						suggestion: "",
					},
				},
			],
		});

		await cli.fix("/fake/file.md", { scope: "/fake" });

		// First writeFileSync call must be the .bak file
		expect(writeSpy).toHaveBeenCalledTimes(2);
		const firstCall = writeSpy.mock.calls[0];
		expect(firstCall?.[0]).toMatch(/\/fake\/file\.md\.\d+\.bak$/);
		expect(firstCall?.[1]).toBe(FIXTURE_CONTENT);

		writeSpy.mockRestore();
		readSpy.mockRestore();
	});

	it("backup filename matches pattern: filePath + '.' + timestamp + '.bak'", async () => {
		const { default: fs } = await import("node:fs");
		const writeSpy = vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});
		vi.spyOn(fs, "readFileSync").mockReturnValue(FIXTURE_CONTENT);

		const JactCli = await getJactCli();
		const cli = new JactCli();

		const validator = (
			cli as unknown as { validator: { validateFile: () => unknown } }
		).validator;
		vi.spyOn(validator, "validateFile").mockResolvedValue({
			links: [
				{
					fullMatch: "[Design](path/to/design.md#heading)",
					line: 1,
					validation: {
						status: "warning",
						pathConversion: {
							original: "path/to/design.md",
							recommended: "corrected/design.md",
						},
						error: "",
						suggestion: "",
					},
				},
			],
		});

		await cli.fix("/fake/file.md", { scope: "/fake" });

		const bakCall = writeSpy.mock.calls.find((c) =>
			String(c[0]).endsWith(".bak"),
		);
		expect(bakCall).toBeDefined();
		expect(bakCall?.[0]).toMatch(/\.md\.\d+\.bak$/);

		writeSpy.mockRestore();
	});

	it("does NOT write a .bak file when no fixes are applied", async () => {
		const { default: fs } = await import("node:fs");
		const writeSpy = vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});
		vi.spyOn(fs, "readFileSync").mockReturnValue(FIXTURE_CONTENT);

		const JactCli = await getJactCli();
		const cli = new JactCli();

		const validator = (
			cli as unknown as { validator: { validateFile: () => unknown } }
		).validator;
		vi.spyOn(validator, "validateFile").mockResolvedValue({ links: [] });

		await cli.fix("/fake/file.md", { scope: "/fake" });

		expect(writeSpy).not.toHaveBeenCalled();

		writeSpy.mockRestore();
	});
});

// ---------------------------------------------------------------------------
// Dry-run tests
// ---------------------------------------------------------------------------

describe("JactCli.fix() — dry-run mode", () => {
	it("does not write any files when dryRun: true", async () => {
		const { default: fs } = await import("node:fs");
		const writeSpy = vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});
		vi.spyOn(fs, "readFileSync").mockReturnValue(FIXTURE_CONTENT);

		const JactCli = await getJactCli();
		const cli = new JactCli();

		const validator = (
			cli as unknown as { validator: { validateFile: () => unknown } }
		).validator;
		vi.spyOn(validator, "validateFile").mockResolvedValue({
			links: [
				{
					fullMatch: "[Design](path/to/design.md#heading)",
					line: 1,
					validation: {
						status: "warning",
						pathConversion: {
							original: "path/to/design.md",
							recommended: "corrected/design.md",
						},
						error: "",
						suggestion: "",
					},
				},
			],
		});

		await cli.fix("/fake/file.md", { scope: "/fake", dryRun: true });

		expect(writeSpy).not.toHaveBeenCalled();

		writeSpy.mockRestore();
	});

	it("returns output containing '- ' and '+ ' diff lines when dryRun: true", async () => {
		const { default: fs } = await import("node:fs");
		vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});
		vi.spyOn(fs, "readFileSync").mockReturnValue(FIXTURE_CONTENT);

		const JactCli = await getJactCli();
		const cli = new JactCli();

		const validator = (
			cli as unknown as { validator: { validateFile: () => unknown } }
		).validator;
		vi.spyOn(validator, "validateFile").mockResolvedValue({
			links: [
				{
					fullMatch: "[Design](path/to/design.md#heading)",
					line: 1,
					validation: {
						status: "warning",
						pathConversion: {
							original: "path/to/design.md",
							recommended: "corrected/design.md",
						},
						error: "",
						suggestion: "",
					},
				},
			],
		});

		const result = await cli.fix("/fake/file.md", {
			scope: "/fake",
			dryRun: true,
		});

		expect(result).toContain("- ");
		expect(result).toContain("+ ");
		expect(result).toMatch(/dry.?run/i);
	});

	it("does not create a .bak file when dryRun: true", async () => {
		const { default: fs } = await import("node:fs");
		const writeSpy = vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});
		vi.spyOn(fs, "readFileSync").mockReturnValue(FIXTURE_CONTENT);

		const JactCli = await getJactCli();
		const cli = new JactCli();

		const validator = (
			cli as unknown as { validator: { validateFile: () => unknown } }
		).validator;
		vi.spyOn(validator, "validateFile").mockResolvedValue({
			links: [
				{
					fullMatch: "[Design](path/to/design.md#heading)",
					line: 1,
					validation: {
						status: "warning",
						pathConversion: {
							original: "path/to/design.md",
							recommended: "corrected/design.md",
						},
						error: "",
						suggestion: "",
					},
				},
			],
		});

		await cli.fix("/fake/file.md", { scope: "/fake", dryRun: true });

		const bakCall = writeSpy.mock.calls.find((c) =>
			String(c[0]).endsWith(".bak"),
		);
		expect(bakCall).toBeUndefined();

		writeSpy.mockRestore();
	});
});

// ---------------------------------------------------------------------------
// Scope boundary check tests
// ---------------------------------------------------------------------------

describe("JactCli.fix() — scope boundary check", () => {
	it("throws with a clear error message when path corrections needed but options.scope is absent", async () => {
		const { default: fs } = await import("node:fs");
		vi.spyOn(fs, "readFileSync").mockReturnValue(FIXTURE_CONTENT);

		const JactCli = await getJactCli();
		const cli = new JactCli();

		const validator = (
			cli as unknown as { validator: { validateFile: () => unknown } }
		).validator;
		vi.spyOn(validator, "validateFile").mockResolvedValue({
			links: [
				{
					fullMatch: "[Design](path/to/design.md#heading)",
					line: 1,
					validation: {
						status: "warning",
						pathConversion: {
							original: "path/to/design.md",
							recommended: "corrected/design.md",
						},
						error: "",
						suggestion: "",
					},
				},
			],
		});

		// fix() catches errors and returns them as strings — check for error text
		const result = await cli.fix("/fake/file.md", {}); // no scope
		expect(result).toMatch(/scope/i);
		expect(result).toMatch(/error/i);
	});

	it("does NOT throw when only anchor corrections are present and scope is absent", async () => {
		const { default: fs } = await import("node:fs");
		vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});
		vi.spyOn(fs, "readFileSync").mockReturnValue(
			"See [Design](file.md#old-anchor) for details.\n",
		);

		const JactCli = await getJactCli();
		const cli = new JactCli();

		const validator = (
			cli as unknown as { validator: { validateFile: () => unknown } }
		).validator;
		vi.spyOn(validator, "validateFile").mockResolvedValue({
			links: [
				{
					fullMatch: "[Design](file.md#old-anchor)",
					line: 1,
					validation: {
						status: "error",
						error: "Anchor not found: #old-anchor",
						suggestion: 'Available headers: "New Heading" → #New Heading',
						pathConversion: undefined,
					},
				},
			],
		});

		const result = await cli.fix("/fake/file.md", {}); // no scope — should be fine
		// Should NOT contain scope error
		expect(result).not.toMatch(/scope.*required/i);
	});
});
