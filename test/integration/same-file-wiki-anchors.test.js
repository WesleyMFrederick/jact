import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCitationHarness } from "../helpers/workflow-harness.js";

const SOURCE = [
	"# Same-File Wiki Anchors",
	"",
	"## Known Section",
	"",
	"A requirement line. ^FR1",
	"",
	"- heading: [[#Known Section|Known]]",
	"- bare heading: [[#Known Section]]",
	"- block: [[#^FR1|FR1]]",
	"- missing heading: [[#Unknown Section|Unknown]]",
	"- missing block: [[#^FR99]]",
	"",
].join("\n");

describe("Same-file wiki links", () => {
	let dir;

	afterEach(() => {
		if (dir) rmSync(dir, { recursive: true, force: true });
	});

	async function validate() {
		dir = mkdtempSync(join(tmpdir(), "jact-wiki-anchor-"));
		const file = join(dir, "source.md");
		writeFileSync(file, SOURCE);
		const { validateDocumentFile } = createCitationHarness();
		const result = await validateDocumentFile(file);
		return (fullMatch) => {
			const link = result.links.find((l) => l.fullMatch === fullMatch);
			expect(link, fullMatch).toBeDefined();
			return link.validation;
		};
	}

	it("accepts wiki links to the file's own heading and block anchors", async () => {
		const byMatch = await validate();

		expect(byMatch("[[#Known Section|Known]]").status).toBe("valid");
		expect(byMatch("[[#Known Section]]").status).toBe("valid");
		expect(byMatch("[[#^FR1|FR1]]").status).toBe("valid");
	});

	it("rejects unknown same-file wiki anchors with anchor suggestions", async () => {
		const byMatch = await validate();

		const unknownHeading = byMatch("[[#Unknown Section|Unknown]]");
		expect(unknownHeading.status).toBe("error");
		expect(unknownHeading.error).toBe("Anchor not found: #Unknown Section");
		expect(unknownHeading.suggestion).toContain('"Known Section" → #Known Section');
		expect(unknownHeading.suggestion).toContain("Available block refs: ^FR1");

		expect(byMatch("[[#^FR99]]").status).toBe("error");
	});
});
