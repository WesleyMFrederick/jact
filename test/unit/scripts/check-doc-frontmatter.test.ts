import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("../../../scripts/check-doc-frontmatter.mjs", import.meta.url));

const repos: string[] = [];

function makeRepo(files: Record<string, string>): string {
	const dir = mkdtempSync(join(tmpdir(), "check-doc-frontmatter-"));
	repos.push(dir);
	execFileSync("git", ["init", "-q"], { cwd: dir });
	for (const [path, content] of Object.entries(files)) {
		mkdirSync(dirname(join(dir, path)), { recursive: true });
		writeFileSync(join(dir, path), content);
	}
	execFileSync("git", ["add", "."], { cwd: dir });
	return dir;
}

function runCheck(cwd: string): { status: number | null; stderr: string } {
	const result = spawnSync("node", [SCRIPT], { cwd, encoding: "utf8" });
	return { status: result.status, stderr: result.stderr };
}

afterEach(() => {
	for (const dir of repos.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("check-doc-frontmatter", () => {
	it("given a doc whose header has editor timestamps, when checked, then it fails and names the file and keys", () => {
		const dir = makeRepo({
			"docs/a.md": "---\ncreated: 2026-07-01T10:00:00\nlast_modified: 2026-11-19T09:00:00\n---\n# A\n",
		});
		const { status, stderr } = runCheck(dir);
		expect(status).toBe(1);
		expect(stderr).toContain("docs/a.md: remove created, last_modified");
	});

	it.each([
		["a leading BOM", "\uFEFF---\ncreated: x\n---\n"],
		["a padded opening fence", "--- \t\ncreated: x\n---\n"],
		["a padded closing fence", "---\ncreated: x\n--- \t\n"],
	])("given %s, when checked, then header timestamps are rejected", (_name, content) => {
		const dir = makeRepo({ "a.md": content });
		const { status, stderr } = runCheck(dir);
		expect(status).toBe(1);
		expect(stderr).toContain("a.md: remove created");
	});

	it("given a padded closing fence, when checked, then body keys stay exempt", () => {
		const dir = makeRepo({ "a.md": "---\nverified_by: agent\n--- \t\ncreated: prose\n---\n" });
		expect(runCheck(dir).status).toBe(0);
	});

	it("given only verification keys, when checked, then it passes", () => {
		const dir = makeRepo({ "a.md": "---\nlast_verified: 2026-11-19\nverified_by: agent\n---\n# A\n" });
		expect(runCheck(dir).status).toBe(0);
	});

	it("given 'created:' in the body or in a test fixture, when checked, then it passes", () => {
		const dir = makeRepo({
			"a.md": "# A\n\ncreated: this is prose, not a header\n",
			"test/fixtures/wiki.md": "---\ncreated: 2026-05-02T00:00:00Z\n---\n# W\n",
		});
		expect(runCheck(dir).status).toBe(0);
	});
});
