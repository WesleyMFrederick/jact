import { relative, sep } from "node:path";
import type ParsedDocument from "../../ParsedDocument.js";
import type { LinkObject } from "../../types/citationTypes.js";
import type { CliFlags } from "../../types/cli-types.js";
import type {
	EligibilityDecision,
	LinkedContentSource,
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

interface ResolvedOutgoingLink {
	link: LinkObject;
	target: ResolvedCitationTarget;
	enriched: EnrichedLinkObject;
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
		const resolvedOutgoing: ResolvedOutgoingLink[] = [];
		const resolvedOutgoingIndexes: number[] = [];

		for (const link of rootSection.links) {
			const source = this.sourcePosition(input.scopePath, rootFile, link);
			if (link.anchorType === null) {
				outgoingLinks.push({
					source,
					status: "not-followed",
					reason:
						"Whole-file and remote targets are outside linked-context scope",
				});
				continue;
			}

			const eligibility = this.contentExtractor.analyzeEligibility(link, {});
			if (!eligibility.eligible) {
				outgoingLinks.push({
					source,
					status: "not-followed",
					reason: eligibility.reason,
				});
				continue;
			}

			const resolution = await this.validator.resolveCitationTarget(
				link,
				rootFile,
			);
			if (resolution.status !== "resolved") {
				const reason = resolution.reason;
				outgoingLinks.push({ source, status: "failed", reason });
				failures.push({ source, reason });
				continue;
			}

			const enriched = enrichLinkObject(link, { status: "valid" });
			const extractionLink: EnrichedLinkObject = {
				...enriched,
				target: {
					...enriched.target,
					path: {
						...enriched.target.path,
						absolute: resolution.target.filePath,
					},
				},
				validation: { status: "valid" },
			};
			resolvedOutgoingIndexes.push(outgoingLinks.length);
			outgoingLinks.push({
				source,
				target: this.publicTarget(input.scopePath, resolution.target),
				status: "failed",
				reason: "Extraction did not return a result",
			});
			resolvedOutgoing.push({
				link,
				target: resolution.target,
				enriched: extractionLink,
			});
		}

		if (resolvedOutgoing.length > 0) {
			const extraction = await this.contentExtractor.extractContent(
				resolvedOutgoing.map(({ enriched }) => enriched),
				{},
				{ includeInternal: true },
			);
			const seenContentIds = new Set<string>([rootContentId]);
			for (let index = 0; index < resolvedOutgoing.length; index++) {
				const resolved = resolvedOutgoing[index];
				const processed = extraction.outgoingLinksReport.processedLinks[index];
				const outputIndex = resolvedOutgoingIndexes[index];
				if (
					resolved === undefined ||
					processed === undefined ||
					outputIndex === undefined
				) {
					throw new Error("Content extractor returned misaligned link results");
				}
				const outgoing = outgoingLinks[outputIndex];
				if (outgoing === undefined) {
					throw new Error("Missing outgoing link result slot");
				}

				if (processed.status !== "extracted" || processed.contentId === null) {
					const reason =
						processed.failureDetails?.reason ??
						"Direct linked content extraction failed";
					outgoing.status = "failed";
					outgoing.reason = reason;
					failures.push({ source: outgoing.source, reason });
					continue;
				}

				const contentId = processed.contentId;
				outgoing.contentId = contentId;
				outgoing.status = seenContentIds.has(contentId)
					? "deduplicated"
					: "extracted";
				delete outgoing.reason;
				if (seenContentIds.has(contentId)) continue;
				seenContentIds.add(contentId);

				const extractedBlock = extraction.extractedContentBlocks[contentId];
				if (
					typeof extractedBlock === "number" ||
					extractedBlock === undefined
				) {
					throw new Error(`Missing extracted content block: ${contentId}`);
				}
				extractedContentBlocks[contentId] = {
					...extractedBlock,
					source: await this.contentSource(input.scopePath, resolved.target),
				};
			}
		}

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
