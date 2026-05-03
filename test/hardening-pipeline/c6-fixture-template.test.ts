// C6 — reusable fixture template doc exists + lints clean.
// State ref: design-docs/hardening-pipeline/state.md §T4 C6.
//
// EXPECTED: RED on first run. design-docs/hardening-pipeline/fixture-template.md
// does not exist; defer-language scan script does not exist.

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const TEMPLATE = join(
	REPO_ROOT,
	"design-docs/hardening-pipeline/fixture-template.md",
);
const DEFER_SCAN = join(REPO_ROOT, "scripts/defer-language-scan.sh");

const REQUIRED_SECTIONS = [
	/service[- ]level smoke/i,
	/adversarial.*commonmark|commonmark.*adversarial/i,
	/(future plan|adopt|how to use)/i,
];

describe("C6 — reusable fixture template doc", () => {
	it("template file exists at design-docs/hardening-pipeline/fixture-template.md", () => {
		expect(existsSync(TEMPLATE)).toBe(true);
	});

	it("contains canonical fixture format, adversarial CommonMark set, adoption instructions", () => {
		const text = readFileSync(TEMPLATE, "utf8");
		for (const re of REQUIRED_SECTIONS) {
			expect(re.test(text), `template missing section matching ${re}`).toBe(
				true,
			);
		}
	});

	it("template lints clean against C3 defer-language scan", () => {
		expect(existsSync(DEFER_SCAN), "defer-language-scan.sh missing").toBe(true);
		let exitCode = 0;
		try {
			execSync(`bash ${DEFER_SCAN} ${TEMPLATE}`, {
				cwd: REPO_ROOT,
				stdio: "pipe",
			});
		} catch (err) {
			exitCode = (err as { status?: number }).status ?? 1;
		}
		expect(exitCode, "template must contain zero banned tokens").toBe(0);
	});
});
