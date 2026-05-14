/**
 * D4 integration tests: --verbose flag on extract file/header/links.
 * Phase 3 — §8e assertions (10 total).
 *
 * CLI invocations use node dist/cli.js (requires prior build).
 */

import { exec } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = join(__dirname, "../../dist/cli.js");
const JACT_ROOT = join(__dirname, "../..");
const JACT_CLAUDE_MD = join(JACT_ROOT, "CLAUDE.md");
// Stable fixture (not a transient feature doc) — file under test/fixtures/ is
// guaranteed to persist beyond any single feature's lifecycle.
const PLAN_MD = join(JACT_ROOT, "test/fixtures/extract-verbose-fixture.md");

describe("extract file — output mode default", () => {
	it("given no --verbose flag, when extract file runs, then output has only extractedContentBlocks key", async () => {
		const { stdout } = await execAsync(
			`node "${CLI_PATH}" extract file "${JACT_CLAUDE_MD}"`,
			{ cwd: JACT_ROOT },
		);
		const result = JSON.parse(stdout) as Record<string, unknown>;
		expect(Object.keys(result)).toEqual(["extractedContentBlocks"]);
	});

	it("given no --verbose flag, then output omits outgoingLinksReport", async () => {
		const { stdout } = await execAsync(
			`node "${CLI_PATH}" extract file "${JACT_CLAUDE_MD}"`,
			{ cwd: JACT_ROOT },
		);
		const result = JSON.parse(stdout) as Record<string, unknown>;
		expect(result["outgoingLinksReport"]).toBeUndefined();
	});

	it("given no --verbose flag, then output omits stats", async () => {
		const { stdout } = await execAsync(
			`node "${CLI_PATH}" extract file "${JACT_CLAUDE_MD}"`,
			{ cwd: JACT_ROOT },
		);
		const result = JSON.parse(stdout) as Record<string, unknown>;
		expect(result["stats"]).toBeUndefined();
	});
});

describe("extract file — --verbose mode", () => {
	it("given --verbose flag, when extract file runs, then output includes extractedContentBlocks, outgoingLinksReport, and stats", async () => {
		const { stdout } = await execAsync(
			`node "${CLI_PATH}" extract file "${JACT_CLAUDE_MD}" --verbose`,
			{ cwd: JACT_ROOT },
		);
		const result = JSON.parse(stdout) as Record<string, unknown>;
		expect(result).toHaveProperty("extractedContentBlocks");
		expect(result).toHaveProperty("outgoingLinksReport");
		expect(result).toHaveProperty("stats");
	});

	it("given --verbose flag, verbose output contains all keys that minimal output contains", async () => {
		const [minimalOut, verboseOut] = await Promise.all([
			execAsync(`node "${CLI_PATH}" extract file "${JACT_CLAUDE_MD}"`, {
				cwd: JACT_ROOT,
			}),
			execAsync(
				`node "${CLI_PATH}" extract file "${JACT_CLAUDE_MD}" --verbose`,
				{ cwd: JACT_ROOT },
			),
		]);
		const minimal = JSON.parse(minimalOut.stdout) as Record<string, unknown>;
		const verbose = JSON.parse(verboseOut.stdout) as Record<string, unknown>;
		for (const key of Object.keys(minimal)) {
			expect(verbose).toHaveProperty(key);
		}
	});
});

describe("extract header — output mode default", () => {
	it("given no --verbose flag, when extract header runs with default markdown format, then output is plain markdown", async () => {
		const { stdout } = await execAsync(
			`node "${CLI_PATH}" extract header "${PLAN_MD}" "Context"`,
			{ cwd: JACT_ROOT },
		);
		// Plain markdown — not valid JSON
		expect(() => JSON.parse(stdout)).toThrow();
		expect(stdout.trim()).toBeTruthy();
	});

	it("given --verbose flag with markdown format, then output appends Outgoing Links Report and Stats sections", async () => {
		const { stdout } = await execAsync(
			`node "${CLI_PATH}" extract header "${PLAN_MD}" "Context" --verbose`,
			{ cwd: JACT_ROOT },
		);
		expect(stdout).toContain("## Outgoing Links Report");
		expect(stdout).toContain("## Stats");
	});
});

describe("extract links — output mode default", () => {
	// extract links exits 1 when no eligible links; execAsync throws — capture stdout from error
	async function runExtractLinks(extraArgs = ""): Promise<string> {
		try {
			const { stdout } = await execAsync(
				`node "${CLI_PATH}" extract links "${JACT_CLAUDE_MD}"${extraArgs ? " " + extraArgs : ""}`,
				{ cwd: JACT_ROOT },
			);
			return stdout;
		} catch (err) {
			const e = err as { stdout?: string; code?: number };
			if (e.code === 1 && e.stdout) return e.stdout;
			throw err;
		}
	}

	it("given no --verbose flag, when extract links runs, then output has only extractedContentBlocks key", async () => {
		const stdout = await runExtractLinks();
		const result = JSON.parse(stdout) as Record<string, unknown>;
		expect(Object.keys(result)).toEqual(["extractedContentBlocks"]);
	});

	it("given --verbose flag, when extract links runs, then output includes full payload", async () => {
		const stdout = await runExtractLinks("--verbose");
		const result = JSON.parse(stdout) as Record<string, unknown>;
		expect(result).toHaveProperty("extractedContentBlocks");
		expect(result).toHaveProperty("outgoingLinksReport");
		expect(result).toHaveProperty("stats");
	});
});

describe("extract — convention parity with validate", () => {
	it("extract file --help includes -v, --verbose option mirroring validate convention", async () => {
		const { stdout } = await execAsync(
			`node "${CLI_PATH}" extract file --help`,
			{ cwd: JACT_ROOT },
		);
		expect(stdout).toContain("--verbose");
	});
});
