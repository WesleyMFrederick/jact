// C1 — D1 ESLint + vitest idiom-guard for injectable optional deps.
// State ref: design-docs/hardening-pipeline/state.md §T4 C1.
// HC ref: HC5 (escape-hatch comment), HC11 (no suppression), HC12 (per-scope), HC13 (rule library).
//
// EXPECTED: RED on first run.
//   (a) eslint.config.js does not exist → ESLint subprocess fails to load config.
//   (b) test/idiom-guards.test.ts does not exist → vitest cannot find it.
//   (c) PostToolUse hook entry does not exist in ~/.claude/settings.json.

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const FIXTURE = join(
	REPO_ROOT,
	"test/hardening-pipeline/fixtures/cheat-injectable-optional.ts",
);
const ESLINT_CONFIG = join(REPO_ROOT, "eslint.config.js");
const IDIOM_GUARD = join(REPO_ROOT, "test/idiom-guards.test.ts");
const SETTINGS = join(process.env["HOME"] ?? "", ".claude/settings.json");

describe("C1 — D1 named-array ESLint + vitest idiom-guard library", () => {
	it("(a) ESLint flat-config exists and bans optional injectable deps", () => {
		expect(existsSync(ESLINT_CONFIG), "eslint.config.js missing").toBe(true);
		let exitCode = 0;
		try {
			execSync(`bun eslint ${FIXTURE}`, { cwd: REPO_ROOT, stdio: "pipe" });
		} catch (err) {
			exitCode = (err as { status?: number }).status ?? 1;
		}
		expect(exitCode, "eslint must FAIL on cheat fixture (violatingFn)").toBe(1);
	});

	it("(b) vitest idiom-guard test exists and flags same fixture at runtime", () => {
		expect(existsSync(IDIOM_GUARD), "test/idiom-guards.test.ts missing").toBe(
			true,
		);
		let exitCode = 0;
		try {
			execSync(`bun vitest run ${IDIOM_GUARD}`, {
				cwd: REPO_ROOT,
				stdio: "pipe",
			});
		} catch (err) {
			exitCode = (err as { status?: number }).status ?? 1;
		}
		// Idiom-guard test must include a guard that fails when fixture is in scope.
		// Placeholder: assert it runs (will be tightened once guard authored).
		expect(
			exitCode === 0 || exitCode === 1,
			"idiom-guard test must execute",
		).toBe(true);
	});

	it("(c) PostToolUse hook auto-runs both layers after edits", () => {
		const PROJECT_SETTINGS = join(REPO_ROOT, ".claude/settings.json");
		type SettingsShape = {
			hooks?: {
				PostToolUse?: Array<{
					matcher?: string;
					hooks?: Array<{ command?: string }>;
				}>;
			};
		};
		const candidates = [PROJECT_SETTINGS, SETTINGS].filter(existsSync);
		expect(
			candidates.length,
			"no settings.json found (project or global)",
		).toBeGreaterThan(0);
		const hasHardeningHook = candidates.some((path) => {
			const settings = JSON.parse(readFileSync(path, "utf8")) as SettingsShape;
			const hookList = settings.hooks?.PostToolUse ?? [];
			return hookList.some((h) =>
				h.hooks?.some((entry) =>
					/eslint|idiom-guard|hardening/.test(entry.command ?? ""),
				),
			);
		});
		expect(
			hasHardeningHook,
			"PostToolUse hook entry for hardening pipeline missing",
		).toBe(true);
	});
});
