import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CitationValidator } from "../../../src/core/CitationValidator/CitationValidator.js";
import {
	createFileCache,
	createMarkdownParser,
	createParsedFileCache,
} from "../../../src/factories/componentFactory.js";

function createHarness(scope: string) {
	const fileCache = createFileCache();
	fileCache.buildCache(scope);
	const parsedDocuments = createParsedFileCache(
		createMarkdownParser(fileCache),
	);
	return {
		parsedDocuments,
		validator: new CitationValidator(parsedDocuments, fileCache),
	};
}

describe("CitationValidator.resolveCitationTarget", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(
			tmpdir(),
			`citation-validator-target-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("resolves same-file, cross-file, and block links to exact node identities", async () => {
		const rootPath = join(testDir, "root.md");
		writeFileSync(
			rootPath,
			"# Root\n\n[Local](#Local)\n[Remote](./target.md#Remote)\n[Block](./target.md#^block-id)\n\n## Local\n\nLocal content.\n",
		);
		writeFileSync(
			join(testDir, "target.md"),
			"# Remote\n\nRemote content.\n\nBlock content. ^block-id\n",
		);
		const { parsedDocuments, validator } = createHarness(testDir);
		const root = await parsedDocuments.resolveDocument({
			kind: "file",
			filePath: rootPath,
		});
		const [localLink, remoteLink, blockLink] = root.getLinks();
		if (
			localLink === undefined ||
			remoteLink === undefined ||
			blockLink === undefined
		) {
			throw new Error("Expected three parser-emitted links");
		}

		const local = await validator.resolveCitationTarget(localLink, rootPath);
		const remote = await validator.resolveCitationTarget(remoteLink, rootPath);
		const block = await validator.resolveCitationTarget(blockLink, rootPath);

		expect(local).toMatchObject({
			status: "resolved",
			target: { kind: "header", heading: "Local", nodeId: "header:1" },
		});
		expect(remote).toMatchObject({
			status: "resolved",
			target: { kind: "header", heading: "Remote", nodeId: "header:0" },
		});
		expect(block).toMatchObject({
			status: "resolved",
			target: { kind: "block", blockId: "block-id" },
		});
	});

	it("reports duplicate heading anchors as ambiguous and missing paths as failed", async () => {
		const rootPath = join(testDir, "root.md");
		writeFileSync(
			rootPath,
			"# Root\n\n[Duplicate](./duplicate.md#Same)\n[Missing](./missing.md#Nope)\n",
		);
		writeFileSync(
			join(testDir, "duplicate.md"),
			"# Same\n\nFirst.\n\n# Same\n\nSecond.\n",
		);
		const { parsedDocuments, validator } = createHarness(testDir);
		const root = await parsedDocuments.resolveDocument({
			kind: "file",
			filePath: rootPath,
		});
		const [duplicateLink, missingLink] = root.getLinks();
		if (duplicateLink === undefined || missingLink === undefined) {
			throw new Error("Expected duplicate and missing links");
		}

		const duplicate = await validator.resolveCitationTarget(
			duplicateLink,
			rootPath,
		);
		const missing = await validator.resolveCitationTarget(
			missingLink,
			rootPath,
		);

		expect(duplicate).toMatchObject({ status: "ambiguous" });
		if (duplicate.status === "ambiguous") {
			expect(duplicate.candidates.map(({ nodeId }) => nodeId)).toEqual([
				"header:0",
				"header:1",
			]);
		}
		expect(missing).toMatchObject({ status: "failed" });
	});
});
