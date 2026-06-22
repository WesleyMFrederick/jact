/**
 * JactCli.fix() safety tests — TDD for issue #31
 *
 * Tests backup creation, dry-run behavior, and scope boundary check
 * at the orchestrator level. Uses the _fs injection parameter on fix()
 * for test isolation without touching the real filesystem.
 *
 * CitationFixer unit tests are in test/unit/core/CitationFixer.test.ts.
 */

import { describe, expect, it, vi } from "vitest";
import { JactCli } from "../../dist/jact.js";

// ---------------------------------------------------------------------------
// Shared fixture helpers
// ---------------------------------------------------------------------------

/** Minimal markdown content with one path citation that has a pathConversion */
const FIXTURE_CONTENT =
	"See [Design](path/to/design.md#heading) for details.\n";

/** Stub link with a path correction */
const pathFixableLink = {
	fullMatch: "[Design](path/to/design.md#heading)",
	line: 1,
	validation: {
		status: "warning" as const,
		pathConversion: {
			original: "path/to/design.md",
			recommended: "corrected/design.md",
		},
		error: "",
		suggestion: "",
	},
};

/** Stub link with an anchor correction only (no pathConversion) */
const anchorFixableLink = {
	fullMatch: "[Design](file.md#old-anchor)",
	line: 1,
	validation: {
		status: "error" as const,
		error: "Anchor not found: #old-anchor",
		suggestion: 'Available headers: "New Heading" → #New Heading',
		pathConversion: undefined,
	},
};

/** Build a JactCli with validateFile stubbed to return the given links */
function buildCli(links: unknown[]): JactCli {
	const cli = new JactCli();
	const validator = (
		cli as unknown as { validator: { validateFile: () => unknown } }
	).validator;
	vi.spyOn(validator, "validateFile").mockResolvedValue({ links });
	return cli;
}

/** Inject fs helpers: readFileSync returns content, writeFileSync is tracked */
function makeFs(content: string) {
	const writes: Array<{ path: string; data: string }> = [];
	return {
		reads: { content },
		writes,
		fsOverride: {
			readFileSync: (_p: string, _enc: BufferEncoding) => content,
			writeFileSync: (p: string, data: string, _enc: BufferEncoding) => {
				writes.push({ path: p, data });
			},
		},
	};
}

// ---------------------------------------------------------------------------
// Backup creation tests
// ---------------------------------------------------------------------------

describe("JactCli.fix() — backup creation", () => {
	it("writes a .bak file before writing the fixed file", async () => {
		const { writes, fsOverride } = makeFs(FIXTURE_CONTENT);
		const cli = buildCli([pathFixableLink]);

		await cli.fix("/fake/file.md", { scope: "/fake" }, fsOverride);

		// Two writes: backup first, then fixed file
		expect(writes).toHaveLength(2);
		expect(writes[0]?.path).toMatch(/\/fake\/file\.md\.\d+\.bak$/);
		expect(writes[0]?.data).toBe(FIXTURE_CONTENT);
	});

	it("backup filename matches pattern: filePath + '.' + timestamp + '.bak'", async () => {
		const { writes, fsOverride } = makeFs(FIXTURE_CONTENT);
		const cli = buildCli([pathFixableLink]);

		await cli.fix("/fake/file.md", { scope: "/fake" }, fsOverride);

		const bakWrite = writes.find((w) => w.path.endsWith(".bak"));
		expect(bakWrite).toBeDefined();
		expect(bakWrite?.path).toMatch(/\.md\.\d+\.bak$/);
	});

	it("does NOT write a .bak file when no fixes are applied", async () => {
		const { writes, fsOverride } = makeFs(FIXTURE_CONTENT);
		const cli = buildCli([]); // no fixable links

		await cli.fix("/fake/file.md", { scope: "/fake" }, fsOverride);

		expect(writes).toHaveLength(0);
	});

	it("backup data is the original file content before any modification", async () => {
		const { writes, fsOverride } = makeFs(FIXTURE_CONTENT);
		const cli = buildCli([pathFixableLink]);

		await cli.fix("/fake/file.md", { scope: "/fake" }, fsOverride);

		const bakWrite = writes.find((w) => w.path.endsWith(".bak"));
		// Backup must contain original content, not the fixed version
		expect(bakWrite?.data).toBe(FIXTURE_CONTENT);
	});
});

// ---------------------------------------------------------------------------
// Dry-run tests
// ---------------------------------------------------------------------------

describe("JactCli.fix() — dry-run mode", () => {
	it("does not write any files when dryRun: true", async () => {
		const { writes, fsOverride } = makeFs(FIXTURE_CONTENT);
		const cli = buildCli([pathFixableLink]);

		await cli.fix(
			"/fake/file.md",
			{ scope: "/fake", dryRun: true },
			fsOverride,
		);

		expect(writes).toHaveLength(0);
	});

	it("does not create a .bak file when dryRun: true", async () => {
		const { writes, fsOverride } = makeFs(FIXTURE_CONTENT);
		const cli = buildCli([pathFixableLink]);

		await cli.fix(
			"/fake/file.md",
			{ scope: "/fake", dryRun: true },
			fsOverride,
		);

		const bakWrite = writes.find((w) => w.path.endsWith(".bak"));
		expect(bakWrite).toBeUndefined();
	});

	it("returns output containing '- ' and '+ ' diff lines when dryRun: true", async () => {
		const { fsOverride } = makeFs(FIXTURE_CONTENT);
		const cli = buildCli([pathFixableLink]);

		const result = await cli.fix(
			"/fake/file.md",
			{ scope: "/fake", dryRun: true },
			fsOverride,
		);

		expect(result).toContain("    - ");
		expect(result).toContain("    + ");
		expect(result).toMatch(/dry.?run/i);
	});

	it("diff output contains old and new citation text", async () => {
		const { fsOverride } = makeFs(FIXTURE_CONTENT);
		const cli = buildCli([pathFixableLink]);

		const result = await cli.fix(
			"/fake/file.md",
			{ scope: "/fake", dryRun: true },
			fsOverride,
		);

		expect(result).toContain(pathFixableLink.fullMatch);
	});

	it("reports fix count in dry-run output", async () => {
		const { fsOverride } = makeFs(FIXTURE_CONTENT);
		const cli = buildCli([pathFixableLink]);

		const result = await cli.fix(
			"/fake/file.md",
			{ scope: "/fake", dryRun: true },
			fsOverride,
		);

		expect(result).toContain("1 fix");
	});
});

// ---------------------------------------------------------------------------
// Scope boundary check tests
// ---------------------------------------------------------------------------

describe("JactCli.fix() — scope boundary check", () => {
	it("returns scope error when path corrections needed but options.scope is absent", async () => {
		const { fsOverride } = makeFs(FIXTURE_CONTENT);
		const cli = buildCli([pathFixableLink]);

		// No scope provided — should fail fast
		const result = await cli.fix("/fake/file.md", {}, fsOverride);

		expect(result).toMatch(/scope/i);
		expect(result).toMatch(/error/i);
	});

	it("does not write any files when scope boundary check triggers", async () => {
		const { writes, fsOverride } = makeFs(FIXTURE_CONTENT);
		const cli = buildCli([pathFixableLink]);

		await cli.fix("/fake/file.md", {}, fsOverride);

		expect(writes).toHaveLength(0);
	});

	it("does NOT return scope error when only anchor corrections present and scope absent", async () => {
		const { fsOverride } = makeFs(
			"See [Design](file.md#old-anchor) for details.\n",
		);
		const cli = buildCli([anchorFixableLink]);

		const result = await cli.fix("/fake/file.md", {}, fsOverride);

		// Anchor-only fixes are allowed without scope
		expect(result).not.toMatch(/scope.*required/i);
		expect(result).not.toContain("ERROR: Path corrections require");
	});
});
