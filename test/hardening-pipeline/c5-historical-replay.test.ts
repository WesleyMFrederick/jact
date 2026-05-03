// C5 — historical-plan replay flags Plan-01 residuals.
// State ref: design-docs/hardening-pipeline/state.md §T4 C5.
// Hypothesis: replaying plan-eval against shipped Plan-01 + parent plan.md
// surfaces deferral language Items 1, 2 from §9b that escaped Gate 2.
//
// EXPECTED: RED on first run. scripts/plan-eval.sh does not exist.

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts/plan-eval.sh");
const PLAN_PARENT = join(
	REPO_ROOT,
	"design-docs/features/202605020859-jact-wikilink-validation/plan.md",
);
const PLAN_01 = join(
	REPO_ROOT,
	"design-docs/features/202605020859-jact-wikilink-validation/plan-01-spike-wikilink-resolution.md",
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

describe("C5 — historical-plan replay (Plan-01 residual catch)", () => {
	it("plan-eval.sh exists and target plans exist", () => {
		expect(existsSync(SCRIPT), "scripts/plan-eval.sh missing").toBe(true);
		expect(existsSync(PLAN_PARENT), "parent plan.md missing").toBe(true);
		expect(existsSync(PLAN_01), "plan-01 missing").toBe(true);
	});

	it("flags parent plan.md (contains §'plan-02 follow-up' deferral language)", () => {
		const { exitCode, stdout } = runEval(PLAN_PARENT);
		expect(exitCode, `parent plan must be flagged; stdout: ${stdout}`).toBe(1);
		const parsed = JSON.parse(stdout) as {
			rules: Array<{ id: string; status: string }>;
		};
		const d5 = parsed.rules.find((r) => r.id === "D5");
		expect(
			d5?.status,
			"D5 (defer-language) must report fail on parent plan",
		).toBe("fail");
	});

	it("plan-01 replay produces regression baseline matching §9b residuals", () => {
		const { exitCode, stdout } = runEval(PLAN_01);
		// Plan-01 §4.7 documented "follow-up" deferrals; replay must catch them.
		expect(exitCode, `plan-01 must be flagged; stdout: ${stdout}`).toBe(1);
	});
});
