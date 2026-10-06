/**
 * Hostile-repository tests for the extraction read boundary.
 * Link-derived targets outside the project must not be read unless the user
 * grants a directory with --allow-read.
 * CLI invocations use node dist/cli.js (requires prior build).
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const CLI_PATH = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"../../dist/cli.js",
);

const OUTSIDE_SECRET = "OUTSIDE_SECRET_VALUE";
const SIBLING_SECRET = "SIBLING_SECRET_VALUE";
const HOME_SECRET = "HOME_SECRET_VALUE";
const INSIDE_TEXT = "INSIDE_OK_VALUE";

let base: string;
let project: string;
let outside: string;
let home: string;

function secretDoc(title: string, secret: string): string {
	return `# ${title}\n\n## Key\n\n${secret}\n`;
}

beforeAll(() => {
	base = fs.realpathSync(
		fs.mkdtempSync(path.join(os.tmpdir(), "jact-read-boundary-")),
	);
	project = path.join(base, "proj");
	outside = path.join(base, "outside");
	home = path.join(base, "home");
	const sibling = path.join(base, "proj-evil");
	for (const dir of [project, outside, home, sibling]) fs.mkdirSync(dir);
	fs.writeFileSync(path.join(project, "package.json"), "{}\n");
	fs.writeFileSync(
		path.join(project, "inside.md"),
		`# Inside\n\n## Part\n\n${INSIDE_TEXT}\n`,
	);
	fs.writeFileSync(
		path.join(outside, "secret.md"),
		secretDoc("Secret", OUTSIDE_SECRET),
	);
	fs.writeFileSync(
		path.join(sibling, "secret.md"),
		secretDoc("Sibling", SIBLING_SECRET),
	);
	fs.writeFileSync(path.join(home, "creds.md"), secretDoc("Creds", HOME_SECRET));
	fs.symlinkSync(
		path.join(outside, "secret.md"),
		path.join(project, "link-file.md"),
	);
	fs.symlinkSync(outside, path.join(project, "linkdir"), "dir");
});

afterAll(() => {
	fs.rmSync(base, { recursive: true, force: true });
});

interface RunResult {
	status: number | null;
	output: string;
	stdout: string;
}

/** Write `doc.md` under the project, then run the CLI from the project root. */
function run(
	docPath: string,
	doc: string,
	args: readonly string[],
): RunResult {
	const file = path.join(project, docPath);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, doc);
	const result = spawnSync(
		process.execPath,
		[CLI_PATH, ...args.map((arg) => (arg === "{doc}" ? file : arg))],
		{ cwd: project, env: { ...process.env, HOME: home }, encoding: "utf8" },
	);
	return {
		status: result.status,
		output: `${result.stdout}\n${result.stderr}`,
		stdout: result.stdout,
	};
}

const hostileLinks: ReadonlyArray<[string, string, string]> = [
	["absolute path", "[a](ABS/secret.md#Key)", OUTSIDE_SECRET],
	["home path", "[h](~/creds.md#Key)", HOME_SECRET],
	["../.. traversal", "[t](../../outside/secret.md#Key)", OUTSIDE_SECRET],
	["symlinked file", "[l](../link-file.md#Key)", OUTSIDE_SECRET],
	["symlinked parent dir", "[d](../linkdir/secret.md#Key)", OUTSIDE_SECRET],
	["sibling-prefix dir", "[e](../../proj-evil/secret.md#Key)", SIBLING_SECRET],
];

function hostileDoc(link: string): string {
	return `# Root\n\n${link.replace("ABS", outside)}\n\n[i](../inside.md#Part)\n`;
}

describe("extract links — read boundary", () => {
	it.each(hostileLinks)(
		"given a %s section link, when extract links runs, then the secret is not read and the block names --allow-read",
		(_name, link, secret) => {
			const result = run("docs/doc.md", hostileDoc(link), [
				"extract",
				"links",
				"{doc}",
			]);

			expect(result.output).not.toContain(secret);
			expect(result.output).toContain("--allow-read");
			expect(result.stdout).toContain(INSIDE_TEXT);
			expect(result.status).toBe(0);
		},
	);

	it.each([
		["<!-- force-extract -->", []],
		["%%force-extract%%", []],
		["", ["--full-files"]],
	] as const)(
		"given a full-file link with marker %j and flags %j, when extract links runs, then the secret is not read",
		(marker, flags) => {
			const result = run(
				"docs/doc.md",
				`# Root\n\n[f](../../outside/secret.md)${marker}\n`,
				["extract", "links", "{doc}", ...flags],
			);

			expect(result.output).not.toContain(OUTSIDE_SECRET);
			expect(result.output).toContain("--allow-read");
			expect(result.status).not.toBe(2);
		},
	);

	it("given --allow-read for the outside dir, when extract links runs, then the outside section is extracted", () => {
		const result = run(
			"docs/doc.md",
			hostileDoc("[t](../../outside/secret.md#Key)"),
			["extract", "links", "{doc}", "--allow-read", outside],
		);

		expect(result.stdout).toContain(OUTSIDE_SECRET);
		expect(result.stdout).toContain(INSIDE_TEXT);
	});

	it("given --allow-read repeated, when extract links runs, then every granted dir is readable", () => {
		const result = run(
			"docs/doc.md",
			hostileDoc("[h](~/creds.md#Key)\n\n[t](../../outside/secret.md#Key)"),
			["extract", "links", "{doc}", "--allow-read", home, "--allow-read", outside],
		);

		expect(result.stdout).toContain(HOME_SECRET);
		expect(result.stdout).toContain(OUTSIDE_SECRET);
	});
});

describe("extract file --extract-linked-content — read boundary", () => {
	it("given a link to an outside file, when linked content is extracted, then the secret is not read", () => {
		const result = run(
			"doc.md",
			"# Root\n\n[f](../outside/secret.md)\n\n[i](inside.md#Part)\n",
			["extract", "file", "{doc}", "--extract-linked-content"],
		);

		expect(result.output).not.toContain(OUTSIDE_SECRET);
		expect(result.output).toContain("--allow-read");
		expect(result.stdout).toContain(INSIDE_TEXT);
		expect(result.status).toBe(0);
	});

	it("given --allow-read for the outside dir, when linked content is extracted, then the outside file is included", () => {
		const result = run("doc.md", "# Root\n\n[f](../outside/secret.md)\n", [
			"extract",
			"file",
			"{doc}",
			"--extract-linked-content",
			"--allow-read",
			outside,
		]);

		expect(result.stdout).toContain(OUTSIDE_SECRET);
	});

	it("given the user names an outside file directly, when extract file runs, then it is extracted", () => {
		const result = spawnSync(
			process.execPath,
			[CLI_PATH, "extract", "file", path.join(outside, "secret.md")],
			{ cwd: project, env: { ...process.env, HOME: home }, encoding: "utf8" },
		);

		expect(result.stdout).toContain(OUTSIDE_SECRET);
		expect(result.status).toBe(0);
	});
});

describe("extract header --extract-linked-content — read boundary", () => {
	it.each([
		["file", "[f](../outside/secret.md)"],
		["section", "[s](../outside/secret.md#Key)"],
	])(
		"given a %s link to an outside file, when linked content is extracted, then the secret is not read",
		(_kind, link) => {
			const result = run(
				"doc.md",
				`# Root\n\n${link}\n\n[i](inside.md#Part)\n`,
				["extract", "header", "{doc}", "Root", "--extract-linked-content"],
			);

			expect(result.output).not.toContain(OUTSIDE_SECRET);
			expect(result.output).toContain("--allow-read");
			expect(result.stdout).toContain(INSIDE_TEXT);
			expect(result.status).toBe(0);
		},
	);

	it("given --allow-read for the outside dir, when linked content is extracted, then the outside section is included", () => {
		const result = run("doc.md", "# Root\n\n[s](../outside/secret.md#Key)\n", [
			"extract",
			"header",
			"{doc}",
			"Root",
			"--extract-linked-content",
			"--allow-read",
			outside,
		]);

		expect(result.stdout).toContain(OUTSIDE_SECRET);
	});
});

describe("malformed percent-encoding in link paths", () => {
	it.each([
		["validate", ["validate", "{doc}"]],
		["extract links", ["extract", "links", "{doc}", "--full-files"]],
	])(
		"given a %s run on a link with %%E0%%A4%%A, then jact reports it without crashing",
		(_name, args) => {
			const result = run(
				"bad.md",
				"# Bad\n\n[m](bad%E0%A4%A.md)\n\n[m2](bad%E0%A4%A.md#Part)\n",
				args,
			);

			expect(result.status).toBe(1);
			expect(result.output).not.toContain("URIError");
		},
	);
});
