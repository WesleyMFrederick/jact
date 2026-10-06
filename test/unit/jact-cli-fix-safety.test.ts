import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JactCli } from "../../dist/jact-cli.js";
import type { CitationValidator } from "../../src/core/CitationValidator/CitationValidator.js";
import type { EnrichedLinkObject } from "../../src/types/validationTypes.js";

const ORIGINAL_CITATION = "[Design](design.md#Heading)";
const FIXED_CITATION = "[Design](../designs/design.md#Heading)";
const FIXTURE_CONTENT = `See ${ORIGINAL_CITATION} for details.\n`;
const FIXED_CONTENT = `See ${FIXED_CITATION} for details.\n`;

let workDir: string;
let notePath: string;

/** Use real parsing and source spans; isolate only the recommended correction. */
function buildCli(
	transform: (links: EnrichedLinkObject[]) => EnrichedLinkObject[] = (links) => links,
): JactCli {
	const cli = new JactCli();
	const internal = cli as unknown as { validator: CitationValidator };
	const validateDocument = internal.validator.validateDocument.bind(internal.validator);
	vi.spyOn(internal.validator, "validateDocument").mockImplementation(
		async (document, filePath) => {
			const result = await validateDocument(document, filePath);
			const links: EnrichedLinkObject[] = result.links.map((link) => ({
				...link,
				validation: {
					status: "warning",
					message: "Use the note-relative path",
					pathConversion: {
						type: "path-conversion",
						original: "design.md",
						recommended: "../designs/design.md",
					},
				},
			}));
			return { ...result, links: transform(links) };
		},
	);
	return cli;
}

function backups(): string[] {
	return readdirSync(path.dirname(notePath))
		.filter((name) => name.endsWith(".bak"))
		.map((name) => path.join(path.dirname(notePath), name));
}

function expectUntouched(content = FIXTURE_CONTENT): void {
	expect(readFileSync(notePath, "utf8")).toBe(content);
	expect(backups()).toEqual([]);
}

describe("JactCli.fix() safety", () => {
	beforeEach(() => {
		workDir = mkdtempSync(path.join(tmpdir(), "jact-fix-safety-"));
		mkdirSync(path.join(workDir, "notes"));
		mkdirSync(path.join(workDir, "designs"));
		notePath = path.join(workDir, "notes", "note.md");
		writeFileSync(path.join(workDir, "designs", "design.md"), "# Heading\n");
		writeFileSync(notePath, FIXTURE_CONTENT);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		rmSync(workDir, { recursive: true, force: true });
	});

	it("Given a path correction, When fixed, Then saves the original backup before replacing the note", async () => {
		const writes: string[] = [];
		let backupAtMutation: string | undefined;
		const result = await buildCli().fix(notePath, { scope: workDir }, {
			writeFileSync: (filePath, content, encoding) => {
				if (filePath === notePath) {
					const backupPath = backups()[0];
					if (backupPath !== undefined) {
						backupAtMutation = readFileSync(backupPath, "utf8");
					}
				}
				writeFileSync(filePath, content, encoding);
				writes.push(filePath);
			},
		});

		expect(result).toContain("Fixed 1 citation");
		expect(readFileSync(notePath, "utf8")).toBe(FIXED_CONTENT);
		const backupPaths = backups();
		expect(backupPaths).toHaveLength(1);
		expect(backupPaths[0]).toMatch(/note\.md\.\d+\.bak$/);
		expect(writes).toEqual([backupPaths[0], notePath]);
		expect(backupAtMutation).toBe(FIXTURE_CONTENT);
		expect(backupPaths.map((backupPath) => readFileSync(backupPath, "utf8"))).toEqual([FIXTURE_CONTENT]);
	});

	it("Given a path correction, When dry-run is used, Then previews the correction and count without writing", async () => {
		const result = await buildCli().fix(notePath, { scope: workDir, dryRun: true });

		expect(result).toContain("DRY RUN — 1 fix");
		expect(result).toContain(`    - ${ORIGINAL_CITATION}`);
		expect(result).toContain(`    + ${FIXED_CITATION}`);
		expectUntouched();
	});

	it("Given adjacent citation and plain-path fixes after code and Unicode, When fixed, Then changes only their original source spans", async () => {
		const content = `Intro 🌿\r\n\`${ORIGINAL_CITATION}\` then ${ORIGINAL_CITATION} and ../designs/design.md#Heading.\r\n`;
		writeFileSync(notePath, content);

		const result = await buildCli().fix(notePath, { scope: workDir });

		expect(result).toContain("Fixed 2 citations");
		expect(readFileSync(notePath, "utf8")).toBe(
			`Intro 🌿\r\n\`${ORIGINAL_CITATION}\` then ${FIXED_CITATION} and [../designs/design.md#Heading](../designs/design.md#Heading).\r\n`,
		);
		expect(backups().map((backupPath) => readFileSync(backupPath, "utf8"))).toEqual([content]);
	});

	it("Given a path correction, When backups are disabled, Then fixes the note without creating a backup", async () => {
		const result = await buildCli().fix(notePath, { scope: workDir, backup: false });

		expect(result).toContain("Fixed 1 citation");
		expect(readFileSync(notePath, "utf8")).toBe(FIXED_CONTENT);
		expect(backups()).toEqual([]);
	});

	it("Given an already-correct citation, When its recommendation is unchanged, Then writes neither note nor backup", async () => {
		const cli = buildCli((links) => links.map((link) => ({
			...link,
			validation: {
				status: "warning",
				message: "Already note-relative",
				pathConversion: {
					type: "path-conversion",
					original: "design.md",
					recommended: "design.md",
				},
			},
		})));

		const result = await cli.fix(notePath, { scope: workDir });

		expect(result).toContain("No auto-fixable citations");
		expectUntouched();
	});

	it("Given a path correction without scope, When fixed, Then reports the scope requirement and leaves files untouched", async () => {
		const result = await buildCli().fix(notePath);

		expect(result).toContain("ERROR: Path corrections require --scope");
		expectUntouched();
	});

	it("Given an anchor-only correction without scope, When fixed, Then updates the anchor and backs up the original", async () => {
		const content = "See [Design](../designs/design.md#old-anchor) for details.\n";
		writeFileSync(notePath, content);
		const cli = buildCli((links) => links.map((link) => ({
			...link,
			validation: {
				status: "error",
				error: "Anchor not found: #old-anchor",
				suggestion: 'Available headers: "Heading" → #Heading',
				anchorConversion: {
					type: "anchor-conversion",
					original: "old-anchor",
					recommended: "Heading",
				},
			},
		})));

		const result = await cli.fix(notePath);

		expect(result).toContain("Fixed 1 citation");
		expect(readFileSync(notePath, "utf8")).toBe(FIXED_CONTENT);
		expect(backups().map((backupPath) => readFileSync(backupPath, "utf8"))).toEqual([content]);
	});

	it("Given a citation changed after parsing, When fixed, Then refuses to overwrite the changed note or create a backup", async () => {
		const changed = "See [Design](change.md#Heading) for details.\n";
		const cli = buildCli((links) => {
			writeFileSync(notePath, changed);
			return links;
		});

		const result = await cli.fix(notePath, { scope: workDir });

		expect(result).toContain("ERROR: Citation changed at line 1; no files were written.");
		expectUntouched(changed);
	});

	it.each([
		{ line: 0, column: 4 },
		{ line: 1, column: -1 },
		{ line: 1, column: Number.NaN },
		{ line: 2, column: 4 },
	])("Given invalid coordinates $line:$column, When fixed, Then refuses edits without guessing another occurrence", async (position) => {
		const cli = buildCli((links) => links.map((link) => ({ ...link, ...position })));

		const result = await cli.fix(notePath, { scope: workDir });

		expect(result).toContain("ERROR: Citation changed at line");
		expectUntouched();
	});

	it.each([false, true])("Given overlapping correction spans, When dryRun is %s, Then refuses the plan without writing", async (dryRun) => {
		const cli = buildCli((links) => [...links, ...links]);

		const result = await cli.fix(notePath, { scope: workDir, dryRun });

		expect(result).toContain("ERROR: Citation fixes overlap; no files were written.");
		expectUntouched();
	});
});
