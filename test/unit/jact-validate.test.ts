// Phase 3B.8 — manager.validate() Type-I shape + exit-code matrix + verbose trailer
// branch order assertions (per §7g.6 / §7a D3 (f) + GAP-4/5/6).

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JactCli } from "../../dist/jact.js";

const CLI = join(__dirname, "..", "..", "dist", "jact.js");

function writeTmp(name: string, content: string): string {
	const p = join(tmpdir(), `jact-test-${Date.now()}-${name}`);
	writeFileSync(p, content, "utf8");
	return p;
}

function runCLI(
	file: string,
	extraArgs: string[] = [],
): {
	stdout: string;
	exitCode: number;
} {
	try {
		const stdout = execFileSync("node", [CLI, "validate", file, ...extraArgs], {
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		return { stdout, exitCode: 0 };
	} catch (e) {
		const err = e as { stdout?: string; status?: number };
		return { stdout: err.stdout ?? "", exitCode: err.status ?? -1 };
	}
}

describe("manager.validate() — Type-I return shape (D3 GAP-6)", () => {
	it("returns { output, result } — no longer Promise<string>", async () => {
		const file = writeTmp("clean.md", "# Title\n\nNo links here.\n");
		const manager = new JactCli();
		const ret = await manager.validate(file);
		expect(ret).toHaveProperty("output");
		expect(ret).toHaveProperty("result");
		expect(typeof ret.output).toBe("string");
		expect(ret.result.summary).toBeDefined();
	});

	it("JSON branch — output is parseable JSON; result is structured (no JSON.parse needed)", async () => {
		const file = writeTmp("clean-json.md", "# Title\n");
		const manager = new JactCli();
		const { output, result } = await manager.validate(file, {
			format: "json",
		});
		// Caller can read structured directly (GAP-6 closure)
		expect(result.summary.byLinkClass).toBeDefined();
		expect(result.summary.unrecognizedCount).toBe(0);
		// output is still a parseable JSON string for display
		expect(() => JSON.parse(output)).not.toThrow();
	});
});

describe("manager.validate() — exit-code matrix (§7g.6 + D3 (f))", () => {
	it("errors=0, unrecognized=0 → exit 0", () => {
		const file = writeTmp("matrix-clean.md", "# Clean\n\nNo links.\n");
		const { exitCode } = runCLI(file);
		expect(exitCode).toBe(0);
	});

	it("errors>0, unrecognized=0 → exit 1", () => {
		const file = writeTmp(
			"matrix-broken.md",
			"# Broken\n\n[gone](does-not-exist.md#x)\n",
		);
		const { exitCode } = runCLI(file);
		expect(exitCode).toBe(1);
	});

	it("errors=0, unrecognized>0 → exit 1 (belt-and-suspenders disjunct, GAP-5)", () => {
		// Residual bracket OUTSIDE any code block triggers UnrecognizedSyntaxRecord.
		// `[[malformed[[` is the canonical residual scanner input.
		const file = writeTmp(
			"matrix-unrec.md",
			"# Doc\n\nText with [[malformed[[ residual.\n",
		);
		const { exitCode } = runCLI(file);
		expect(exitCode).toBe(1);
	});

	it("errors>0 AND unrecognized>0 → exit 1", () => {
		const file = writeTmp(
			"matrix-both.md",
			"# Both\n\n[gone](nowhere.md#x)\n\n[[malformed[[\n",
		);
		const { exitCode } = runCLI(file);
		expect(exitCode).toBe(1);
	});
});

describe("verbose trailer branch order (§7g.6 + GAP-4)", () => {
	it("errors > 0 → 'VALIDATION FAILED' (highest precedence)", () => {
		const file = writeTmp("trail-err.md", "# X\n\n[broken](nowhere.md#z)\n");
		const { stdout } = runCLI(file, ["--verbose"]);
		expect(stdout).toContain("VALIDATION FAILED");
		expect(stdout).not.toContain("ALL CITATIONS VALID");
	});

	it("errors === 0 AND unrecognized > 0 → 'VALIDATION FAILED - K unrecognized syntax records'", () => {
		const file = writeTmp("trail-unrec.md", "# X\n\n[[malformed[[\n");
		const { stdout } = runCLI(file, ["--verbose"]);
		expect(stdout).toContain("unrecognized syntax records");
		// GAP-4: never prints ALL CITATIONS VALID while exit=1
		expect(stdout).not.toContain("ALL CITATIONS VALID");
	});

	it("errors === 0 AND unrecognized === 0 AND warnings === 0 → 'ALL CITATIONS VALID'", () => {
		const file = writeTmp("trail-clean.md", "# Doc\n");
		const { stdout } = runCLI(file, ["--verbose"]);
		expect(stdout).toContain("ALL CITATIONS VALID");
	});
});

describe("JSON mode end-to-end (§7g.5 schema deltas)", () => {
	it("output JSON contains summary.byLinkClass + summary.unrecognizedCount + top-level unrecognized[]", () => {
		const file = writeTmp("json-e2e.md", "# Doc\n\n[[malformed[[\n");
		const { stdout } = runCLI(file, ["--format", "json"]);
		const parsed = JSON.parse(stdout);
		expect(parsed.summary.byLinkClass).toBeDefined();
		expect(parsed.summary.byLinkClass).toEqual({
			markdown: 0,
			wiki: 0,
			caret: 0,
		});
		// Residual scanner emits a record per residual `[[...` sequence; `[[malformed[[`
		// produces two records (the leading run + trailing `[[`). Test asserts wiring,
		// not exact count semantics — both records flow end-to-end.
		expect(parsed.summary.unrecognizedCount).toBeGreaterThanOrEqual(1);
		expect(Array.isArray(parsed.unrecognized)).toBe(true);
		expect(parsed.unrecognized.length).toBe(parsed.summary.unrecognizedCount);
		expect(parsed.unrecognized[0]).toHaveProperty("rawText");
		expect(parsed.unrecognized[0]).toHaveProperty("line");
		expect(parsed.unrecognized[0].syntaxFamily).toBe("wiki");
	});
});
