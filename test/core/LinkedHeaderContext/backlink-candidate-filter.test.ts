import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	BacklinkCandidateFilter,
	type BacklinkCandidateFilterLike,
} from "../../../src/core/LinkedHeaderContext/BacklinkCandidateFilter.js";
import { LinkedHeaderContextQuery } from "../../../src/core/LinkedHeaderContext/LinkedHeaderContextQuery.js";
import { createParsedFileCache } from "../../../src/factories/componentFactory.js";
import type ParsedDocument from "../../../src/ParsedDocument.js";

let testDirectory: string;

beforeEach(() => {
	testDirectory = join(
		tmpdir(),
		`jact-backlink-filter-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	mkdirSync(testDirectory, { recursive: true });
});

afterEach(() => {
	rmSync(testDirectory, { recursive: true, force: true });
});

describe("BacklinkCandidateFilter", () => {
	it("keeps possible backlinks and drops files without the decoded or encoded stem", async () => {
		const root = join(testDirectory, "Target File.md");
		const decoded = join(testDirectory, "decoded.md");
		const encoded = join(testDirectory, "encoded.md");
		const differentCase = join(testDirectory, "different-case.md");
		const unrelated = join(testDirectory, "unrelated.md");
		const unreadable = join(testDirectory, "missing.md");
		writeFileSync(root, "# Target\n");
		writeFileSync(decoded, "[target](./Target File.md#Target)\n");
		writeFileSync(encoded, "[target](./TARGET%20FILE.md#Target)\n");
		writeFileSync(differentCase, "[[tArGeT fIlE#Target]]\n");
		writeFileSync(unrelated, "No matching filename here.\n");

		const candidates = await new BacklinkCandidateFilter().selectCandidates(
			[root, decoded, encoded, differentCase, unrelated, unreadable],
			root,
		);

		expect(candidates).toEqual([
			root,
			decoded,
			encoded,
			differentCase,
			unreadable,
		]);
	});

	it("keeps the full scope when no filename stem can be built", async () => {
		const scopeFiles = [
			join(testDirectory, "first.md"),
			join(testDirectory, "second.md"),
		];

		const candidates = await new BacklinkCandidateFilter().selectCandidates(
			scopeFiles,
			"",
		);

		expect(candidates).toBe(scopeFiles);
	});
});

describe("LinkedHeaderContextQuery backlink filtering", () => {
	it("parses only candidates while returning the exhaustive result", async () => {
		const root = join(testDirectory, "root.md");
		const backlink = join(testDirectory, "backlink.md");
		const noMention = join(testDirectory, "no-mention.md");
		writeFileSync(root, "# Root\n\nRoot content.\n");
		writeFileSync(backlink, "# Source\n\n[Root](./root.md#Root)\n");
		writeFileSync(noMention, "# Other\n\nNo backlink here.\n");
		const scopeFiles = [root, backlink, noMention];
		const documents = new Map<string, ParsedDocument>();
		const parser = createParsedFileCache();
		for (const filePath of scopeFiles) {
			documents.set(
				filePath,
				await parser.resolveDocument({ kind: "file", filePath }),
			);
		}
		const rootDocument = documents.get(root);
		if (rootDocument === undefined)
			throw new Error("Missing parsed root fixture");
		const headingResolution = rootDocument.resolveHeading("Root");
		if (headingResolution.status !== "unique") {
			throw new Error("Root fixture heading must resolve uniquely");
		}

		const execute = async (candidateFilter: BacklinkCandidateFilterLike) => {
			const parsedFiles: string[] = [];
			const query = new LinkedHeaderContextQuery(
				{
					resolveDocument: async ({ filePath }) => {
						parsedFiles.push(filePath);
						const document = documents.get(filePath);
						if (document === undefined)
							throw new Error(`Missing fixture: ${filePath}`);
						return document;
					},
				},
				{
					resolveCitationTarget: async () => ({
						status: "resolved" as const,
						target: {
							filePath: root,
							kind: "header" as const,
							nodeId: `header:${headingResolution.match.index}`,
							line: 1,
							column: 1,
							heading: "Root",
						},
					}),
				},
				{
					analyzeEligibility: () => ({
						eligible: false as const,
						reason: "unused",
					}),
					extractContent: async () => {
						throw new Error("No outgoing links expected");
					},
				},
				candidateFilter,
			);
			const result = await query.execute({
				rootDocument,
				rootHeading: headingResolution.match,
				scopePath: testDirectory,
				scopeFiles,
				respectGitignore: true,
			});
			return { parsedFiles, result };
		};

		const filtered = await execute(new BacklinkCandidateFilter());
		const exhaustive = await execute({
			selectCandidates: async (files) => files,
		});

		expect(filtered.result).toEqual(exhaustive.result);
		expect(filtered.parsedFiles).toEqual([backlink, root]);
		expect(exhaustive.parsedFiles).toEqual([backlink, noMention, root]);
		expect(filtered.result.scope.filesScanned).toBe(3);
	});

	it("falls back to the exhaustive scan when candidate selection fails", async () => {
		const root = join(testDirectory, "root.md");
		writeFileSync(root, "# Root\n\nRoot content.\n");
		const parser = createParsedFileCache();
		const rootDocument = await parser.resolveDocument({
			kind: "file",
			filePath: root,
		});
		const headingResolution = rootDocument.resolveHeading("Root");
		if (headingResolution.status !== "unique") {
			throw new Error("Root fixture heading must resolve uniquely");
		}
		const resolveDocument = vi.fn(async () => rootDocument);
		const query = new LinkedHeaderContextQuery(
			{ resolveDocument },
			{ resolveCitationTarget: vi.fn() },
			{
				analyzeEligibility: vi.fn(),
				extractContent: vi.fn(),
			},
			{
				selectCandidates: async () => {
					throw new Error("filter unavailable");
				},
			},
		);

		await query.execute({
			rootDocument,
			rootHeading: headingResolution.match,
			scopePath: testDirectory,
			scopeFiles: [root],
			respectGitignore: true,
		});

		expect(resolveDocument).toHaveBeenCalledOnce();
	});
});
