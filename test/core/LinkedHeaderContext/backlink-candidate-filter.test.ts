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

	it("continues when it cannot load one linked file", async () => {
		const root = join(testDirectory, "root.md");
		const bad = join(testDirectory, "bad.md");
		const good = join(testDirectory, "good.md");
		writeFileSync(root, "# Root\n\n[bad](./bad.md)\n\n[good](./good.md)\n");
		writeFileSync(good, "# Good\n\nGood content.\n");
		const parser = createParsedFileCache();
		const rootDocument = await parser.resolveDocument({
			kind: "file",
			filePath: root,
		});
		const goodDocument = await parser.resolveDocument({
			kind: "file",
			filePath: good,
		});
		const headingResolution = rootDocument.resolveHeading("Root");
		if (headingResolution.status !== "unique") {
			throw new Error("Root fixture heading must resolve uniquely");
		}
		const query = new LinkedHeaderContextQuery(
			{
				resolveDocument: async ({ filePath }) => {
					if (filePath === bad) throw new Error("bad document unavailable");
					if (filePath === root) return rootDocument;
					if (filePath === good) return goodDocument;
					throw new Error(`Missing fixture: ${filePath}`);
				},
			},
			{
				resolveCitationTarget: async () => {
					throw new Error("No anchored links expected");
				},
			},
			{
				analyzeEligibility: () => ({ eligible: true as const }),
				extractContent: async () => {
					throw new Error("No anchored links expected");
				},
			},
			{ selectCandidates: async () => [] },
		);

		const result = await query.execute({
			rootDocument,
			rootHeading: headingResolution.match,
			scopePath: testDirectory,
			scopeFiles: [root, good],
			respectGitignore: true,
			depth: 1,
		});

		expect(result.outgoingLinks).toHaveLength(2);
		expect(result.outgoingLinks[0]).toEqual({
			source: {
				file: "root.md",
				line: 3,
				column: 0,
				raw: "[bad](./bad.md)",
			},
			status: "failed",
			reason: "bad document unavailable",
		});
		expect(result.outgoingLinks[1]).toMatchObject({
			source: { raw: "[good](./good.md)" },
			status: "extracted",
			target: { file: "good.md", kind: "file" },
			contentId: expect.any(String),
		});
		expect(result.failures).toEqual([
			{
				source: {
					file: "root.md",
					line: 3,
					column: 0,
					raw: "[bad](./bad.md)",
				},
				reason: "bad document unavailable",
			},
		]);
		expect(result.complete).toBe(false);
		expect(
			Object.values(result.extractedContentBlocks).some(
				(block) =>
					typeof block !== "number" &&
					block.content === "# Good\n\nGood content.\n",
			),
		).toBe(true);
	});

	it("does not catch an error while reading links after loading a linked file", async () => {
		const root = join(testDirectory, "root.md");
		const linked = join(testDirectory, "linked.md");
		writeFileSync(root, "# Root\n\n[linked](./linked.md)\n");
		writeFileSync(linked, "# Linked\n");
		const parser = createParsedFileCache();
		const rootDocument = await parser.resolveDocument({
			kind: "file",
			filePath: root,
		});
		const linkedDocument = await parser.resolveDocument({
			kind: "file",
			filePath: linked,
		});
		const headingResolution = rootDocument.resolveHeading("Root");
		if (headingResolution.status !== "unique") {
			throw new Error("Root fixture heading must resolve uniquely");
		}
		const getLinks = vi
			.spyOn(linkedDocument, "getLinks")
			.mockImplementation(() => {
				throw new Error("link processing failed");
			});
		const query = new LinkedHeaderContextQuery(
			{
				resolveDocument: async ({ filePath }) => {
					if (filePath === root) return rootDocument;
					if (filePath === linked) return linkedDocument;
					throw new Error(`Missing fixture: ${filePath}`);
				},
			},
			{
				resolveCitationTarget: async () => {
					throw new Error("No anchored links expected");
				},
			},
			{
				analyzeEligibility: () => ({ eligible: true as const }),
				extractContent: async () => {
					throw new Error("No anchored links expected");
				},
			},
			{ selectCandidates: async () => [] },
		);

		await expect(
			query.execute({
				rootDocument,
				rootHeading: headingResolution.match,
				scopePath: testDirectory,
				scopeFiles: [root],
				respectGitignore: true,
				depth: 1,
			}),
		).rejects.toThrow("link processing failed");
		getLinks.mockRestore();
	});
});
