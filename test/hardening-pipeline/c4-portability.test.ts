// C4 — pipeline jact-agnostic + portable.
// State ref: design-docs/hardening-pipeline/state.md §T4 C4.
// HC ref: HC14 (no hardcoded jact paths/types in core; allowlist via env|CLI|config).
//
// EXPECTED: RED on first run. eslint.config.js + scripts/*.sh do not exist.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const ESLINT_CONFIG = join(REPO_ROOT, "eslint.config.js");
const SCRIPTS_DIR = join(REPO_ROOT, "scripts");

// jact-specific identifiers that MUST NOT appear in core pipeline logic.
// (May appear only inside the configurable allowlist source — env|CLI|config|examples.)
const JACT_HARDCODED = [
	"/jact/",
	"CitationValidator",
	"FileSystemInterface",
	"LinkObjectFactory",
	"MarkdownParser",
	"ContentExtractor",
	"ParsedFileCache",
	"ParsedDocument",
];

function violationsIn(file: string): string[] {
	const text = readFileSync(file, "utf8");
	// Strip allowlist sections (marked by `// HARDENING-ALLOWLIST` block comments).
	const stripped = text.replace(
		/\/\*\s*HARDENING-ALLOWLIST[\s\S]*?HARDENING-ALLOWLIST\s*\*\//g,
		"",
	);
	return JACT_HARDCODED.filter((token) => stripped.includes(token));
}

describe("C4 — pipeline portability", () => {
	it("eslint.config.js exists", () => {
		expect(existsSync(ESLINT_CONFIG)).toBe(true);
	});

	it("eslint.config.js core has no hardcoded jact identifiers outside allowlist block", () => {
		const found = violationsIn(ESLINT_CONFIG);
		expect(found, `Hardcoded jact tokens in core: ${found.join(", ")}`).toEqual(
			[],
		);
	});

	it("scripts/*.sh exist", () => {
		expect(existsSync(SCRIPTS_DIR)).toBe(true);
		const shScripts = readdirSync(SCRIPTS_DIR).filter((f) => f.endsWith(".sh"));
		expect(shScripts.length).toBeGreaterThanOrEqual(4); // D2, D3, D4, D5 + plan-eval
	});

	it("scripts/*.sh accept project-root as arg with default (pwd)", () => {
		const shFiles = readdirSync(SCRIPTS_DIR)
			.filter((f) => f.endsWith(".sh"))
			.map((f) => join(SCRIPTS_DIR, f));
		for (const file of shFiles) {
			const text = readFileSync(file, "utf8");
			// Must reference $1 or PROJECT_ROOT, with default fallback to pwd.
			const hasArgPattern = /\$\{?1[:-]?-?\$?\(?pwd|PROJECT_ROOT/.test(text);
			expect(
				hasArgPattern,
				`${file} must accept project-root arg w/ pwd default`,
			).toBe(true);
		}
	});

	it("no hardcoded jact tokens in scripts/*.sh core", () => {
		const shFiles = readdirSync(SCRIPTS_DIR)
			.filter((f) => f.endsWith(".sh"))
			.map((f) => join(SCRIPTS_DIR, f));
		for (const file of shFiles) {
			const found = violationsIn(file);
			expect(
				found,
				`${file} has hardcoded jact tokens: ${found.join(", ")}`,
			).toEqual([]);
		}
	});
});
