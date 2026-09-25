import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(testDirectory, "../..");
const cliPath = join(repositoryRoot, "dist/cli.js");
const fixtureScope = join(
	repositoryRoot,
	"test/fixtures/linked-header-context",
);
const rootFile = join(fixtureScope, "root.md");

function runHeader(...extraArguments: string[]) {
	return spawnSync(
		process.execPath,
		[
			cliPath,
			"extract",
			"header",
			rootFile,
			"Root",
			"--scope",
			fixtureScope,
			...extraArguments,
		],
		{ cwd: repositoryRoot, encoding: "utf8" },
	);
}

describe("extract header --extract-linked-content", () => {
	it("returns depth-1 content, semantic backlinks, policy decisions, and stable ordering", () => {
		const execution = runHeader("--extract-linked-content", "--format", "json");

		expect(execution.status).toBe(0);
		const result = JSON.parse(execution.stdout);
		expect(result).toMatchObject({
			mode: "linked-context",
			complete: true,
			scope: {
				filesScanned: 5,
				respectGitignore: true,
			},
			stats: {
				directLinks: 6,
				uniqueLinkedContent: 4,
				backlinks: 2,
			},
		});
		const blocks = Object.entries(result.extractedContentBlocks).filter(
			([key]) => key !== "_totalContentCharacterLength",
		);
		expect(blocks).toHaveLength(5);
		expect(result.depth).toBe(1);
		expect(
			result.outgoingLinks.map(({ status }: { status: string }) => status),
		).toEqual([
			"extracted",
			"extracted",
			"deduplicated",
			"extracted",
			"not-followed",
			"extracted",
		]);
		expect(
			result.backlinks.map(
				({ source }: { source: { file: string; line: number } }) =>
					`${source.file}:${source.line}`,
			),
		).toEqual(["backlinks.md:3", "root.md:26"]);
		const extractedText = blocks
			.map(([, block]) => {
				if (
					typeof block !== "object" ||
					block === null ||
					!("content" in block) ||
					typeof block.content !== "string"
				) {
					throw new Error("Expected every extracted block to contain text");
				}
				return block.content;
			})
			.join("\n");
		expect(extractedText).toContain("Local content.");
		expect(extractedText).toContain("Target content.");
		expect(extractedText).toContain("Block content. ^linked-block");
		expect(extractedText).toContain("This content must not be followed.");
		expect(result.failures).toEqual([]);
	});

	it("returns byte-identical JSON ordering for unchanged files", () => {
		const first = runHeader("--extract-linked-content", "--format", "json");
		const second = runHeader("--extract-linked-content", "--format", "json");

		expect(first.status).toBe(0);
		expect(second.status).toBe(0);
		expect(second.stdout).toBe(first.stdout);
	});

	it("renders the complete context contract as numbered Markdown", () => {
		const execution = runHeader("--extract-linked-content");

		expect(execution.status).toBe(0);
		expect(execution.stdout).toContain("# Header context");
		expect(execution.stdout).toContain("Complete: yes");
		expect(execution.stdout).toContain("## Root");
		expect(execution.stdout).toContain("## Linked content (depth 1)");
		expect(execution.stdout).toContain("## Backlinks to root");
		expect(execution.stdout).toContain("     3\t## Root");
		expect(execution.stdout).toContain("- backlinks.md:3 —");
	});

	it("prints a cwd-runnable content map, keeping backlinks, above --max-chars", () => {
		const execution = runHeader("--extract-linked-content", "--max-chars", "100");

		expect(execution.status).toBe(0);
		expect(execution.stdout).toContain("# Content map");
		expect(execution.stdout).not.toContain("     3\t## Root");
		expect(execution.stdout).toContain(
			'`jact extract header test/fixtures/linked-header-context/root.md "Root"`',
		);
		expect(execution.stdout).toContain("- backlinks.md:3 —");
	});

	it("emits partial JSON and exits 1 when an eligible direct link fails", () => {
		const execution = spawnSync(
			process.execPath,
			[
				cliPath,
				"extract",
				"header",
				rootFile,
				"Invalid Root",
				"--scope",
				fixtureScope,
				"--extract-linked-content",
				"--format",
				"json",
			],
			{ cwd: repositoryRoot, encoding: "utf8" },
		);

		expect(execution.status).toBe(1);
		const result = JSON.parse(execution.stdout);
		expect(result.complete).toBe(false);
		expect(result.failures).toHaveLength(1);
		expect(result.outgoingLinks[0]).toMatchObject({ status: "failed" });
	});

	it("rejects a selected file outside the explicit backlink scope", () => {
		const outsideTarget = join(
			repositoryRoot,
			"test/fixtures/us2.1/e2e-mixed-markers.md",
		);
		const execution = spawnSync(
			process.execPath,
			[
				cliPath,
				"extract",
				"header",
				outsideTarget,
				"header",
				"--scope",
				fixtureScope,
				"--extract-linked-content",
			],
			{ cwd: repositoryRoot, encoding: "utf8" },
		);

		expect(execution.status).toBe(1);
		expect(execution.stderr).toContain("outside the resolved scope");
		expect(execution.stderr).toContain("--scope");
	});

	it("preserves the shallow JSON result when linked context is absent", () => {
		const execution = runHeader("--format", "json", "--verbose");

		expect(execution.status).toBe(0);
		const result = JSON.parse(execution.stdout);
		expect(result.mode).toBeUndefined();
		expect(result).toHaveProperty("outgoingLinksReport");
		expect(result.stats.uniqueContent).toBe(1);
	});
});
