import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRuleSetResolver } from "../../dist/core/ValidationRules/loadConfig.js";
import { JactCli } from "../../dist/jact-cli.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(testDir, "../../dist/cli.js");
/** The dropped-character anchor check is an obsidian-preset rule. */
const configHome = path.resolve(testDir, "../fixtures/config-home-obsidian");
const env = { ...process.env, XDG_CONFIG_HOME: configHome };

/** Obsidian-style anchors that `--fix` rewrites by dropping the colon. */
const brokenCitation = (token: string) =>
	`[A](target.md#Cost%20${token}%20Q1:%20fit)`;
const fixedCitation = (token: string) =>
	`[A](target.md#Cost%20${token}%20Q1%20fit)`;
const targetDoc = (token: string) =>
	`# Target\n\n## Cost ${token} Q1: fit\n\nText.\n`;
const sourceDoc = (token: string) =>
	`Before $& text\n${brokenCitation(token)}\nAfter line\n`;

let root: string;
let project: string;
let external: string;

function fix(file: string) {
	return spawnSync(
		process.execPath,
		[cliPath, "validate", file, "--fix", "--scope", project],
		{ cwd: project, encoding: "utf8", env },
	);
}

const backupsIn = (dir: string): string[] =>
	readdirSync(dir).filter((name) => name.endsWith(".bak"));

beforeEach(() => {
	root = realpathSync(mkdtempSync(path.join(tmpdir(), "jact-fix-safety-")));
	project = path.join(root, "project");
	external = path.join(root, "external");
	mkdirSync(project);
	mkdirSync(external);
});

afterEach(() => {
	vi.restoreAllMocks();
	rmSync(root, { recursive: true, force: true });
});

describe("jact validate --fix — literal replacement", () => {
	it.each(["$'", "$&", "$`", "$$", "$1"])(
		"keeps the %s token literal and leaves the rest of the file unchanged",
		(token) => {
			const sourcePath = path.join(project, "source.md");
			writeFileSync(path.join(project, "target.md"), targetDoc(token));
			writeFileSync(sourcePath, sourceDoc(token));

			const result = fix(sourcePath);

			const expected = `Before $& text\n${fixedCitation(token)}\nAfter line\n`;
			expect(readFileSync(sourcePath, "utf8")).toBe(expected);
			expect(result.stdout).toContain(`+ ${fixedCitation(token)}`);
		},
	);
});

describe("jact validate --fix — write boundary", () => {
	it("refuses a symbolic link to a file outside the project", () => {
		const externalFile = path.join(external, "outside.md");
		writeFileSync(path.join(project, "target.md"), targetDoc("x"));
		writeFileSync(path.join(external, "target.md"), targetDoc("x"));
		writeFileSync(externalFile, sourceDoc("x"));
		const linkPath = path.join(project, "linked.md");
		symlinkSync(externalFile, linkPath);

		const result = fix(linkPath);

		expect(result.stdout).toContain(
			`Refused: ${linkPath} is a symbolic link. jact --fix does not write through links.`,
		);
		expect(readFileSync(externalFile, "utf8")).toBe(sourceDoc("x"));
		expect(backupsIn(project)).toEqual([]);
		expect(backupsIn(external)).toEqual([]);
	});

	it("refuses a file that resolves outside the scope through a linked folder", () => {
		const externalFile = path.join(external, "outside.md");
		writeFileSync(path.join(external, "target.md"), targetDoc("x"));
		writeFileSync(externalFile, sourceDoc("x"));
		symlinkSync(external, path.join(project, "linked-dir"));

		const result = fix(path.join(project, "linked-dir", "outside.md"));

		expect(result.stdout).toContain("Refused:");
		expect(result.stdout).toContain("is outside the scope");
		expect(readFileSync(externalFile, "utf8")).toBe(sourceDoc("x"));
		expect(backupsIn(external)).toEqual([]);
	});

	it("refuses to write a backup through an existing symbolic link", async () => {
		const sourcePath = path.join(project, "source.md");
		const victim = path.join(external, "victim.md");
		writeFileSync(path.join(project, "target.md"), targetDoc("x"));
		writeFileSync(sourcePath, sourceDoc("x"));
		writeFileSync(victim, "victim\n");
		vi.spyOn(Date, "now").mockReturnValue(1234);
		symlinkSync(victim, `${sourcePath}.1234.bak`);

		const result = await new JactCli(
			createRuleSetResolver({
				userConfigPath: path.join(configHome, "jact", "config.json"),
			}),
		).fix(sourcePath, { scope: project });

		expect(result).toContain("Refused:");
		expect(readFileSync(victim, "utf8")).toBe("victim\n");
		expect(readFileSync(sourcePath, "utf8")).toBe(sourceDoc("x"));
	});

	it("fixes a regular file in scope and writes a backup of the original", () => {
		const sourcePath = path.join(project, "source.md");
		writeFileSync(path.join(project, "target.md"), targetDoc("x"));
		writeFileSync(sourcePath, sourceDoc("x"));

		const result = fix(sourcePath);

		expect(result.stdout).toContain("Fixed 1 citation");
		expect(readFileSync(sourcePath, "utf8")).toBe(
			`Before $& text\n${fixedCitation("x")}\nAfter line\n`,
		);
		const backups = backupsIn(project);
		expect(backups).toHaveLength(1);
		expect(
			readFileSync(path.join(project, backups[0] as string), "utf8"),
		).toBe(sourceDoc("x"));
		expect(readdirSync(project).sort()).toEqual(
			[backups[0], "source.md", "target.md"].sort(),
		);
	});
});
