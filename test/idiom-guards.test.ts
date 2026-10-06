// Runtime idiom-guard layer (lbnl 3-layer pattern, runtime tier).
// Checks repository-wide exceptions alongside ESLint's optional dependency selectors.
// One test per cheat pattern from §9f threat model.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ESLint } from "eslint";
import { afterAll, describe, expect, it, vi } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "..");

vi.stubEnv("HARDENING_INJECTABLE_TYPES", "FileCache,CitationValidator");
afterAll(() => vi.unstubAllEnvs());

const ESLINT = new ESLint({
	cwd: REPO_ROOT,
	overrideConfigFile: join(REPO_ROOT, "eslint.config.js"),
});

async function lint(source: string) {
	const [result] = await ESLINT.lintText(source, {
		filePath: join(REPO_ROOT, "src/lint-regression.ts"),
	});
	return result.messages;
}

const INJECTABLE_TYPES = [
	"FileCache",
	"FileSystemInterface",
	"LinkObjectFactory",
	"MarkdownParser",
	"CitationValidator",
	"ContentExtractor",
	"ParsedFileCache",
	"ParsedDocument",
];

function walkTs(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		if (name === "node_modules" || name === "dist" || name.startsWith("."))
			continue;
		const full = join(dir, name);
		const st = statSync(full);
		if (st.isDirectory()) out.push(...walkTs(full));
		else if (name.endsWith(".ts")) out.push(full);
	}
	return out;
}

interface Violation {
	file: string;
	line: number;
	match: string;
}

function findInjectableOptionalViolations(files: string[]): Violation[] {
	// Match: `paramName?: <Type>` where Type is in INJECTABLE_TYPES.
	// Allow if previous non-blank line contains `// @inject-optional:`.
	const typeRe = INJECTABLE_TYPES.join("|");
	const rowRe = new RegExp(
		`(\\w+)\\?\\s*:\\s*(?:import\\([^)]*\\)\\.)?(?:${typeRe})\\b`,
	);

	const out: Violation[] = [];
	for (const file of files) {
		const lines = readFileSync(file, "utf8").split("\n");
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (!line) continue;
			if (!rowRe.test(line)) continue;

			// Look upward past blank lines for escape-hatch comment.
			let prev = i - 1;
			while (prev >= 0 && lines[prev]?.trim() === "") prev--;
			const prevLine = prev >= 0 ? (lines[prev] ?? "") : "";
			if (/@inject-optional:/.test(prevLine)) continue;

			out.push({ file, line: i + 1, match: line.trim() });
		}
	}
	return out;
}

describe("Idiom-guards — runtime layer for hardening pipeline", () => {
	it("D1: optional injectable deps require @inject-optional escape-hatch", () => {
		// Scope: src/ + factories/ + test/ (excluding the deliberate cheat fixture).
		const allFiles = [
			...walkTs(join(REPO_ROOT, "src")),
			...walkTs(join(REPO_ROOT, "test")),
		].filter(
			(f) =>
				// Exempt: the cheat fixture is the deliberate violation under test.
				!f.endsWith(
					"test/hardening-pipeline/fixtures/cheat-injectable-optional.ts",
				) &&
				// Exempt: this guard file itself contains the type-list literals.
				!f.endsWith("test/idiom-guards.test.ts"),
		);

		const violations = findInjectableOptionalViolations(allFiles);
		expect(
			violations,
			`D1 violations (use required injection or add // @inject-optional: <reason>):\n${violations
				.map((v) => `  ${v.file}:${v.line}  ${v.match}`)
				.join("\n")}`,
		).toEqual([]);
	});

	it("D1: cheat fixture IS detected by guard (sanity check)", () => {
		const fixture = join(
			REPO_ROOT,
			"test/hardening-pipeline/fixtures/cheat-injectable-optional.ts",
		);
		const violations = findInjectableOptionalViolations([fixture]);
		// violatingFn (no escape-hatch) → 1 violation. allowedFn (has escape-hatch) → 0.
		expect(violations.length, "guard must catch violatingFn").toBe(1);
		expect(violations[0]?.match).toMatch(/violatingFn|fileCache\?/);
	});
});
describe("injectable dependency lint", () => {
	it.each([
		["parameter", "function use(cache: FileCache) {}"],
		["return value", "function make(): FileCache { return cache; }"],
		["required property", "interface Dependencies { validator: CitationValidator }"],
		["constructor property", "class Service { constructor(private cache: FileCache) {} }"],
	])("Given a required %s, When linting, Then the dependency is accepted", async (_kind, source) => {
		// Given
		// When
		const messages = await lint(source);
		// Then
		expect(messages).toEqual([]);
	});

	it.each([
		["parameter", "function use(cache?: FileCache) {}"],
		["interface property", "interface Dependencies { validator?: CitationValidator }"],
		["class property", "class Service { cache?: FileCache; }"],
		["constructor property", "class Service { constructor(private cache?: FileCache) {} }"],
	])("Given an optional %s, When linting, Then the missing dependency risk is reported", async (_kind, source) => {
		// Given
		// When
		const messages = await lint(source);
		// Then
		expect(messages).toEqual([
			expect.objectContaining({
				ruleId: "no-restricted-syntax",
				severity: 2,
			}),
		]);
	});

	it("Given an optional nondependency, When linting, Then it is accepted", async () => {
		// Given
		const source = "function use(label?: string) {}";
		// When
		const messages = await lint(source);
		// Then
		expect(messages).toEqual([]);
	});
});
