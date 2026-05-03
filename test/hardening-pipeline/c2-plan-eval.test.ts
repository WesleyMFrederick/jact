// C2 — plan-eval.sh trigger.
// State ref: design-docs/hardening-pipeline/state.md §T4 C2.
// HC ref: HC15 (plan-eval pre-flight required for all future plans).
//
// EXPECTED: RED on first run.
//   scripts/plan-eval.sh does not exist → execSync fails with ENOENT/127.

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts/plan-eval.sh");
const CLEAN_PLAN = join(
	REPO_ROOT,
	"test/hardening-pipeline/fixtures/clean-plan.md",
);
const DIRTY_PLAN = join(
	REPO_ROOT,
	"test/hardening-pipeline/fixtures/dirty-plan.md",
);

function runEval(planPath: string): { exitCode: number; stdout: string } {
	let exitCode = 0;
	let stdout = "";
	try {
		stdout = execSync(`bash ${SCRIPT} ${planPath}`, {
			cwd: REPO_ROOT,
			encoding: "utf8",
		});
	} catch (err) {
		const e = err as { status?: number; stdout?: Buffer };
		exitCode = e.status ?? 1;
		stdout = e.stdout?.toString() ?? "";
	}
	return { exitCode, stdout };
}

describe("C2 — plan-eval.sh trigger", () => {
	it("script exists at scripts/plan-eval.sh", () => {
		expect(existsSync(SCRIPT)).toBe(true);
	});

	it("exits 0 on clean plan fixture", () => {
		const { exitCode, stdout } = runEval(CLEAN_PLAN);
		expect(exitCode, `clean plan should pass; got: ${stdout}`).toBe(0);
	});

	it("exits 1 on dirty plan fixture (defer language + unfalsified hypothesis)", () => {
		const { exitCode } = runEval(DIRTY_PLAN);
		expect(exitCode, "dirty plan must fail eval").toBe(1);
	});

	it("emits structured JSON {rules: [{id, status}]} per rule", () => {
		const { stdout } = runEval(DIRTY_PLAN);
		const parsed = JSON.parse(stdout) as {
			rules: Array<{ id: string; status: string }>;
		};
		expect(Array.isArray(parsed.rules)).toBe(true);
		expect(parsed.rules.length).toBeGreaterThanOrEqual(2); // D5 + D6 minimum
		for (const rule of parsed.rules) {
			expect(typeof rule.id).toBe("string");
			expect(["pass", "fail"]).toContain(rule.status);
		}
		const ids = parsed.rules.map((r) => r.id);
		expect(ids).toContain("D5"); // defer-language
		expect(ids).toContain("D6"); // plan-residual scan
	});
});
