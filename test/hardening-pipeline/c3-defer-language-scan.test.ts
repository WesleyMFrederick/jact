// C3 — zero deferral-language tokens across design-docs/features/**/*.md.
// State ref: design-docs/hardening-pipeline/state.md §T4 C3.
// HC ref: HC1 (no deferral language; banned tokens listed).
//
// EXPECTED: RED on first run.
//   scripts/defer-language-scan.sh does not exist; existing plan files
//   under design-docs/features may contain banned tokens.

import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts/defer-language-scan.sh");
const FEATURES_DIR = join(REPO_ROOT, "design-docs/features");
const CLEAN_FIXTURE = join(
	REPO_ROOT,
	"test/hardening-pipeline/fixtures/clean-design-doc.md",
);
const DIRTY_FIXTURE = join(
	REPO_ROOT,
	"test/hardening-pipeline/fixtures/dirty-plan.md",
);

function walkMd(dir: string): string[] {
	const out: string[] = [];
	if (!existsSync(dir)) return out;
	for (const name of readdirSync(dir)) {
		if (name === ".archive") continue;
		const full = join(dir, name);
		if (statSync(full).isDirectory()) out.push(...walkMd(full));
		else if (name.endsWith(".md")) out.push(full);
	}
	return out;
}

function runScan(file: string): number {
	try {
		execSync(`bash ${SCRIPT} ${file}`, { cwd: REPO_ROOT, stdio: "pipe" });
		return 0;
	} catch (err) {
		return (err as { status?: number }).status ?? 1;
	}
}

describe("C3 — defer-language scan", () => {
	it("script exists at scripts/defer-language-scan.sh", () => {
		expect(existsSync(SCRIPT)).toBe(true);
	});

	it("exits 0 on clean design-doc fixture", () => {
		expect(runScan(CLEAN_FIXTURE)).toBe(0);
	});

	it("exits 1 on dirty plan fixture (banned tokens present)", () => {
		expect(runScan(DIRTY_FIXTURE)).toBe(1);
	});

	it("scans all design-docs/features/**/*.md and reports any violators", () => {
		const files = walkMd(FEATURES_DIR);
		expect(files.length).toBeGreaterThan(0);
		const failures = files.filter((f) => runScan(f) !== 0);
		expect(
			failures,
			`Files with banned tokens: ${failures.join(", ")}`,
		).toEqual([]);
	});
});
