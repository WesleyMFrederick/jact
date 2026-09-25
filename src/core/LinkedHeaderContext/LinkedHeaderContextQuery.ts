import { extname, relative, resolve, sep } from "node:path";
import type ParsedDocument from "../../ParsedDocument.js";
import type { LinkObject } from "../../types/citationTypes.js";
import type { CliFlags } from "../../types/cli-types.js";
import type {
	EligibilityDecision,
	LinkedContentSource,
	LinkedExtractedContentBlock,
	LinkedContextSourcePosition,
	LinkedContextTarget,
	LinkedHeaderContextInput,
	LinkedHeaderContextResult,
	OutgoingLinksExtractedContent,
} from "../../types/extraction-types.js";
import type {
	CitationTargetResolution,
	EnrichedLinkObject,
	ResolvedCitationTarget,
} from "../../types/validationTypes.js";
import { enrichLinkObject } from "../CitationValidator/CitationValidator.js";
import { generateContentId } from "../ContentExtractor/generateContentId.js";
import type { BacklinkCandidateFilterLike } from "./BacklinkCandidateFilter.js";

interface ParsedDocumentLifecycleLike {
	resolveDocument(source: {
		kind: "file";
		filePath: string;
	}): Promise<ParsedDocument>;
}

interface CitationValidatorLike {
	resolveCitationTarget(
		citation: LinkObject,
		sourceFile: string,
	): Promise<CitationTargetResolution>;
}

interface ContentExtractorLike {
	analyzeEligibility(link: LinkObject, cliFlags: CliFlags): EligibilityDecision;
	extractContent(
		links: EnrichedLinkObject[],
		cliFlags: CliFlags,
		options?: { includeInternal?: boolean },
	): Promise<OutgoingLinksExtractedContent>;
}

export interface LinkedHeaderContextQueryLike {
	execute(input: LinkedHeaderContextInput): Promise<LinkedHeaderContextResult>;
}

/** Links found in one source (root section or a followed file) awaiting a depth level. */
interface PendingLinks {
	file: string;
	links: readonly LinkObject[];
}

export class LinkedHeaderContextQuery implements LinkedHeaderContextQueryLike {
	private parsedDocuments: ParsedDocumentLifecycleLike;
	private validator: CitationValidatorLike;
	private contentExtractor: ContentExtractorLike;
	private candidateFilter: BacklinkCandidateFilterLike;

	constructor(
		parsedDocuments: ParsedDocumentLifecycleLike,
		validator: CitationValidatorLike,
		contentExtractor: ContentExtractorLike,
		candidateFilter: BacklinkCandidateFilterLike,
	) {
		this.parsedDocuments = parsedDocuments;
		this.validator = validator;
		this.contentExtractor = contentExtractor;
		this.candidateFilter = candidateFilter;
	}

	async execute(
		input: LinkedHeaderContextInput,
	): Promise<LinkedHeaderContextResult> {
		const rootSection = input.rootDocument.getResolvedSection(
			input.rootHeading,
		);
		if (rootSection === null) {
			throw new Error("Resolved root section is no longer present");
		}

		const rootFile = input.rootDocument.data.filePath;
		const rootNodeId = `header:${input.rootHeading.index}`;
		const rootSource: LinkedContentSource = {
			file: this.scopeRelativePath(input.scopePath, rootFile),
			kind: "header",
			heading: input.rootHeading.heading.text,
			startLine: rootSection.startLine,
			endLine: rootSection.endLine,
		};
		const rootContentId = generateContentId(rootSection.content);
		const extractedContentBlocks: LinkedHeaderContextResult["extractedContentBlocks"] =
			{
				_totalContentCharacterLength: 0,
				[rootContentId]: {
					content: rootSection.content,
					contentLength: rootSection.content.length,
					sourceLinks: [],
					source: rootSource,
				},
			};
		const outgoingLinks: LinkedHeaderContextResult["outgoingLinks"] = [];
		const failures: LinkedHeaderContextResult["failures"] = [];
		const seenContentIds = new Set<string>([rootContentId]);
		const expandedFiles = new Set<string>();
		const recordContent = (
			contentId: string,
			block: LinkedExtractedContentBlock,
		): "extracted" | "deduplicated" => {
			if (seenContentIds.has(contentId)) return "deduplicated";
			seenContentIds.add(contentId);
			extractedContentBlocks[contentId] = block;
			return "extracted";
		};

		let pending: PendingLinks[] = [{ file: rootFile, links: rootSection.links }];
		for (let level = 1; level <= input.depth && pending.length > 0; level++) {
			const next: PendingLinks[] = [];
			for (const { file, links } of pending) {
				for (const link of links) {
					const source = this.sourcePosition(input.scopePath, file, link);
					const eligibility = this.contentExtractor.analyzeEligibility(
						link,
						{ fullFiles: true },
					);
					if (!eligibility.eligible) {
						outgoingLinks.push({
							source,
							status: "not-followed",
							reason: eligibility.reason,
						});
						continue;
					}

					if (link.anchorType === null) {
						const targetFile = followableMarkdownFile(link);
						if (targetFile === undefined) {
							outgoingLinks.push({
								source,
								status: "not-followed",
								reason: "Remote, unresolved, or non-markdown targets are not followed",
							});
							continue;
						}
						let document: ParsedDocument;
						try {
							document = await this.parsedDocuments.resolveDocument({
								kind: "file",
								filePath: targetFile,
							});
						} catch (error) {
							const reason =
								error instanceof Error ? error.message : String(error);
							outgoingLinks.push({ source, status: "failed", reason });
							failures.push({ source, reason });
							continue;
						}
						const content = document.extractFullContent();
						const contentId = generateContentId(content);
						const lineCount =
							content.split("\n").length - (content.endsWith("\n") ? 1 : 0);
						const target: LinkedContextTarget = {
							file: this.scopeRelativePath(input.scopePath, targetFile),
							kind: "file",
						};
						const status = recordContent(contentId, {
							content,
							contentLength: content.length,
							startLine: 1,
							sourceLinks: [],
							source: {
								...target,
								startLine: 1,
								endLine: Math.max(lineCount, 1),
							},
						});
						outgoingLinks.push({ source, target, status, contentId });
						if (!expandedFiles.has(targetFile)) {
							expandedFiles.add(targetFile);
							next.push({ file: targetFile, links: document.getLinks() });
						}
						continue;
					}

					const resolution = await this.validator.resolveCitationTarget(
						link,
						file,
					);
					if (resolution.status !== "resolved") {
						const reason = resolution.reason;
						outgoingLinks.push({ source, status: "failed", reason });
						failures.push({ source, reason });
						continue;
					}
					const enriched = enrichLinkObject(link, { status: "valid" });
					const extraction = await this.contentExtractor.extractContent(
						[
							{
								...enriched,
								target: {
									...enriched.target,
									path: {
										...enriched.target.path,
										absolute: resolution.target.filePath,
									},
								},
								validation: { status: "valid" },
							},
						],
						{},
						{ includeInternal: true },
					);
					const target = this.publicTarget(input.scopePath, resolution.target);
					const processed = extraction.outgoingLinksReport.processedLinks[0];
					const extractedBlock =
						processed?.contentId == null
							? undefined
							: extraction.extractedContentBlocks[processed.contentId];
					if (
						processed?.status !== "extracted" ||
						processed.contentId === null ||
						typeof extractedBlock !== "object"
					) {
						const reason =
							processed?.failureDetails?.reason ??
							"Linked content extraction failed";
						outgoingLinks.push({ source, target, status: "failed", reason });
						failures.push({ source, reason });
						continue;
					}
					const status = recordContent(processed.contentId, {
						...extractedBlock,
						source: await this.contentSource(
							input.scopePath,
							resolution.target,
						),
					});
					outgoingLinks.push({
						source,
						target,
						status,
						contentId: processed.contentId,
					});
				}
			}
			pending = next;
		}

		// Files left at the depth boundary whose links would still add content.
		const unfollowedDeeperFiles = pending.filter(({ links }) =>
			links.some((link) => {
				if (
					!this.contentExtractor.analyzeEligibility(link, { fullFiles: true })
						.eligible
				) {
					return false;
				}
				if (link.anchorType !== null) return link.scope === "cross-document";
				const targetFile = followableMarkdownFile(link);
				return targetFile !== undefined && !expandedFiles.has(targetFile);
			}),
		).length;

		const backlinks: LinkedHeaderContextResult["backlinks"] = [];
		const sortedScopeFiles = [...input.scopeFiles].sort((a, b) =>
			a.localeCompare(b),
		);
		let backlinkCandidates: readonly string[];
		try {
			backlinkCandidates = await this.candidateFilter.selectCandidates(
				sortedScopeFiles,
				rootFile,
			);
		} catch {
			backlinkCandidates = sortedScopeFiles;
		}
		const sortedBacklinkCandidates = [...backlinkCandidates].sort((a, b) =>
			a.localeCompare(b),
		);
		for (const scopeFile of sortedBacklinkCandidates) {
			const document = await this.parsedDocuments.resolveDocument({
				kind: "file",
				filePath: scopeFile,
			});
			for (const link of document.getLinks()) {
				if (link.anchorType === null) continue;
				const resolution = await this.validator.resolveCitationTarget(
					link,
					document.data.filePath,
				);
				if (resolution.status === "resolved") {
					if (
						resolution.target.filePath === rootFile &&
						resolution.target.nodeId === rootNodeId
					) {
						backlinks.push({
							source: this.sourcePosition(
								input.scopePath,
								document.data.filePath,
								link,
							),
							target: this.publicTarget(input.scopePath, resolution.target),
						});
					}
					continue;
				}
				if (
					resolution.status === "ambiguous" &&
					resolution.candidates.some(
						(candidate) =>
							candidate.filePath === rootFile &&
							candidate.nodeId === rootNodeId,
					)
				) {
					const source = this.sourcePosition(
						input.scopePath,
						document.data.filePath,
						link,
					);
					failures.push({ source, reason: resolution.reason });
				}
			}
		}

		backlinks.sort(
			(a, b) =>
				a.source.file.localeCompare(b.source.file) ||
				a.source.line - b.source.line ||
				a.source.column - b.source.column,
		);
		const contentBlocks = Object.values(extractedContentBlocks).filter(
			(value) => typeof value !== "number",
		);
		extractedContentBlocks._totalContentCharacterLength = contentBlocks.reduce(
			(total, block) => total + block.contentLength,
			0,
		);

		return {
			mode: "linked-context",
			complete: failures.length === 0,
			depth: input.depth,
			unfollowedDeeperFiles,
			scope: {
				path: input.scopePath,
				filesScanned: sortedScopeFiles.length,
				respectGitignore: input.respectGitignore,
			},
			root: { contentId: rootContentId, source: rootSource },
			extractedContentBlocks,
			outgoingLinks,
			backlinks,
			failures,
			stats: {
				directLinks: rootSection.links.length,
				uniqueLinkedContent: Math.max(contentBlocks.length - 1, 0),
				backlinks: backlinks.length,
			},
		};
	}

	private sourcePosition(
		scopePath: string,
		filePath: string,
		link: LinkObject,
	): LinkedContextSourcePosition {
		return {
			file: this.scopeRelativePath(scopePath, filePath),
			line: link.line,
			column: link.column,
			raw: link.fullMatch,
		};
	}

	private publicTarget(
		scopePath: string,
		target: ResolvedCitationTarget,
	): LinkedContextTarget {
		return {
			file: this.scopeRelativePath(scopePath, target.filePath),
			kind: target.kind,
			...(target.heading !== undefined && { heading: target.heading }),
			...(target.blockId !== undefined && { blockId: target.blockId }),
		};
	}

	private async contentSource(
		scopePath: string,
		target: ResolvedCitationTarget,
	): Promise<LinkedContentSource> {
		if (target.kind === "block") {
			if (target.blockId === undefined) {
				throw new Error("Resolved block target has no block id");
			}
			return {
				file: this.scopeRelativePath(scopePath, target.filePath),
				kind: "block",
				blockId: target.blockId,
				startLine: target.line,
				endLine: target.line,
			};
		}

		const document = await this.parsedDocuments.resolveDocument({
			kind: "file",
			filePath: target.filePath,
		});
		const headingIndex = Number(target.nodeId.slice("header:".length));
		const heading = document.data.headings[headingIndex];
		if (heading === undefined) {
			throw new Error(`Resolved heading disappeared: ${target.heading}`);
		}
		const section = document.getResolvedSection({
			index: headingIndex,
			heading,
			ancestors: [],
		});
		if (section === null) {
			throw new Error(`Resolved section disappeared: ${target.heading}`);
		}
		return {
			file: this.scopeRelativePath(scopePath, target.filePath),
			kind: "header",
			heading: heading.text,
			startLine: section.startLine,
			endLine: section.endLine,
		};
	}

	private scopeRelativePath(scopePath: string, filePath: string): string {
		return relative(scopePath, filePath).split(sep).join("/");
	}
}

/** Absolute markdown file a valid, unstopped whole-file link points to; otherwise undefined. */
export function followableMarkdownFile(link: LinkObject): string | undefined {
	const absolute = link.target.path.absolute;
	if (
		link.validation?.status === "error" ||
		link.anchorType !== null ||
		link.extractionMarker?.innerText === "stop-extract-link" ||
		!absolute ||
		extname(absolute).toLowerCase() !== ".md"
	) {
		return undefined;
	}
	return resolve(decodeURIComponent(absolute));
}
