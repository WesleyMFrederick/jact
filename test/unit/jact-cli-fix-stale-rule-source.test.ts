import {
	mkdtempSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CitationValidator } from "../../src/core/CitationValidator/CitationValidator.js";
import {
	NO_REFERENCE_NOTE_LINK_RULE,
	noReferenceNoteLink,
} from "../../src/core/ValidationRules/rules/noReferenceNoteLink.js";
import { JactCli } from "../../src/jact-cli.js";

const SPLIT_SOURCE = "See [the target][t] here.\n\n[t]: target.md\n";

let workDir: string;
let notePath: string;

function buildCli(): JactCli {
	return new JactCli(async () => ({
		enabled: new Set([NO_REFERENCE_NOTE_LINK_RULE]),
		rules: [noReferenceNoteLink],
	}));
}

function backups(): string[] {
	return readdirSync(workDir).filter((name) => name.endsWith(".bak"));
}

describe("JactCli.fix() rule edits against a changed source", () => {
	beforeEach(() => {
		workDir = realpathSync(
			mkdtempSync(path.join(tmpdir(), "jact-stale-rule-")),
		);
		writeFileSync(path.join(workDir, "package.json"), "{}");
		writeFileSync(path.join(workDir, "target.md"), "# Intro\n");
		notePath = path.join(workDir, "note.md");
		writeFileSync(notePath, SPLIT_SOURCE);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		rmSync(workDir, { recursive: true, force: true });
	});

	it("Given a rule-only fix, When the note is edited after parsing, Then refuses and leaves the note and backups untouched", async () => {
		const cli = buildCli();
		const internal = cli as unknown as { validator: CitationValidator };
		const validateDocument = internal.validator.validateDocument.bind(
			internal.validator,
		);
		const editedSource = `# Added heading\n\n${SPLIT_SOURCE}`;
		vi.spyOn(internal.validator, "validateDocument").mockImplementation(
			async (document, filePath, options) => {
				const result = await validateDocument(document, filePath, options);
				writeFileSync(notePath, editedSource); // an editor saves mid-run
				return result;
			},
		);

		const result = await cli.fix(notePath, { scope: workDir });

		expect(result).toMatch(/^ERROR: .*changed.*no files were written/);
		expect(readFileSync(notePath, "utf8")).toBe(editedSource);
		expect(backups()).toEqual([]);
	});

	it("Given a rule-only fix, When the note is unchanged, Then still inlines the link", async () => {
		const result = await buildCli().fix(notePath, { scope: workDir });

		expect(result).toContain("Fixed 1 citation");
		expect(readFileSync(notePath, "utf8")).toBe(
			"See [the target](target.md) here.\n\n",
		);
	});
});
