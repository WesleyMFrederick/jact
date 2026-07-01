// Validate markdown content supplied as a string (not yet on disk) via
// JactCli.validateContent — the in-memory analogue of validate() (R6 plan, M1-M5).
// Exercises: self-anchor resolution against the in-memory cache seed (M1/M3),
// validateParsed/validateFile parity (M2), and the --stdin CLI surface (M5).
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	createCitationValidator,
	createFileCache,
	createMarkdownParser,
	createParsedFileCache,
} from "../../src/factories/componentFactory.js";
import { JactCli } from "../../src/jact.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..", "..");

/** A fresh tmp dir with a `.git` marker so resolveScope's walk-up succeeds without an explicit --scope. */
function makeScopedTmpDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "jact-stdin-"));
	mkdirSync(join(dir, ".git"));
	return dir;
}

describe("JactCli.validateContent — self-anchor resolves against the in-memory seed (M1/M3)", () => {
	it("given content with a valid self-anchor, when validateContent runs with an unwritten filePath, then status is valid", async () => {
		// Given an intended path that is never written to disk
		const scopeDir = makeScopedTmpDir();
		const intendedPath = join(scopeDir, "unwritten.md");
		const content =
			"# Draft\n\nSome fact worth citing. ^my-anchor\n\n[Link](#my-anchor)\n";
		expect(existsSync(intendedPath)).toBe(false);

		// When
		const cli = new JactCli();
		const result = await cli.validateContent(content, {
			filePath: intendedPath,
			format: "json",
		});

		// Then
		const parsed = JSON.parse(result);
		expect(parsed.summary.errors).toBe(0);
		expect(existsSync(intendedPath)).toBe(false);
	});

	it("given content with a broken cross-doc link, when validateContent runs, then summary.errors > 0", async () => {
		// Given
		const scopeDir = makeScopedTmpDir();
		const intendedPath = join(scopeDir, "unwritten.md");
		const content = "# Draft\n\n[Missing](./does-not-exist.md)\n";

		// When
		const cli = new JactCli();
		const result = await cli.validateContent(content, {
			filePath: intendedPath,
			format: "json",
		});

		// Then
		const parsed = JSON.parse(result);
		expect(parsed.summary.errors).toBeGreaterThan(0);
	});
});

describe("CitationValidator.validateParsed vs validateFile — parity (M2)", () => {
	it("given the same content, when validateParsed vs validateFile run, then results are identical", async () => {
		// Given the same content, once on disk and once parsed+seeded in-memory under the same key
		const scopeDir = makeScopedTmpDir();
		const diskFile = join(scopeDir, "twin.md");
		const content =
			"# Heading\n\nSelf-referencing [Link](#heading) and plain text.\n";
		writeFileSync(diskFile, content);

		// validateFile path: real disk read
		const fileValidator = createCitationValidator(
			createParsedFileCache(createMarkdownParser()),
			createFileCache(),
		);
		const fileResult = await fileValidator.validateFile(diskFile);

		// validateParsed path: in-memory only, independent cache instance seeded with the same content/key
		const parser = createMarkdownParser();
		const parsedFileCache = createParsedFileCache(parser);
		const parsedValidator = createCitationValidator(
			parsedFileCache,
			createFileCache(),
		);
		const parsedDoc = parser.parseContent(content, diskFile);
		parsedFileCache.seedParsedFile(diskFile, parsedDoc);
		const parsedResult = await parsedValidator.validateParsed(
			parsedDoc,
			diskFile,
		);

		// Then
		expect(parsedResult).toEqual(fileResult);
	});
});

describe("jact validate --stdin — CLI exit codes (subprocess e2e, built binary)", () => {
	it("given --stdin and no <file-path>, when the CLI runs, then it exits 2 with a required-file message", () => {
		// Given / When
		let stdout = "";
		let stderr = "";
		let status = 0;
		try {
			stdout = execSync("node dist/cli.js validate --stdin", {
				cwd: REPO_ROOT,
				input: "x",
				encoding: "utf8",
			});
		} catch (err) {
			const e = err as { status?: number; stdout?: string; stderr?: string };
			status = e.status ?? 0;
			stdout = e.stdout ?? "";
			stderr = e.stderr ?? "";
		}

		// Then
		expect(status).toBe(2);
		expect(`${stdout}${stderr}`).toContain(
			"--stdin requires exactly one <path>",
		);
	});
});
