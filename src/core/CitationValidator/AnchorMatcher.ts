/**
 * AnchorMatcher — owns all anchor matching logic extracted from CitationValidator.
 *
 * Responsibilities:
 *   - Flexible anchor matching (exact, raw-text, backtick, markdown-cleaned)
 *   - Markdown cleanup for comparison
 *   - Obsidian "better format" suggestion (prefer raw header over kebab-case)
 *   - Block-ref-without-caret detection
 *   - Full validateAnchorExists logic (requires ParsedFileCacheLike)
 *
 * Extracted from CitationValidator (issue #28).
 */

import type {
	AnchorObject,
	LinkObject,
	ParserOutput,
} from "../../types/citationTypes.js";

/**
 * Minimal interface over ParsedDocument to avoid circular imports.
 * `data` is the full ParserOutput (not just `anchors`) so callers like
 * CitationValidator.validateFile can hand it straight to validateParsed.
 */
export interface ParsedDocumentLike {
	hasAnchor(anchor: string): boolean;
	findSimilarAnchors(anchor: string): string[];
	getLinks(): LinkObject[];
	data: ParserOutput;
}

/**
 * Minimal interface over ParsedFileCache to avoid circular imports.
 */
export interface ParsedFileCacheLike {
	resolveParsedFile(filePath: string): Promise<ParsedDocumentLike>;
}

export class AnchorMatcher {
	private parsedFileCache: ParsedFileCacheLike | null;

	/**
	 * @param parsedFileCache - Optional. Required only for validateAnchorExists().
	 *   Pass null when using only the pure matching helpers.
	 */
	constructor(parsedFileCache: ParsedFileCacheLike | null = null) {
		this.parsedFileCache = parsedFileCache;
	}

	// ── Pure matching helpers (no I/O) ────────────────────────────────────────

	cleanMarkdownForComparison(text: string): string {
		if (!text) return "";
		return text
			.replace(/`/g, "")
			.replace(/\*\*/g, "")
			.replace(/\*/g, "")
			.replace(/==([^=]+)==/g, "$1")
			.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
			.replace(/:/g, " ")
			.replace(/\\/g, "")
			.replace(/[[\]]/g, "")
			.replace(/ {2,}/g, " ")
			.trim();
	}

	findFlexibleAnchorMatch(
		searchAnchor: string,
		availableAnchors: AnchorObject[],
	): { found: boolean; matchType?: string } {
		const cleanSearchAnchor = decodeURIComponent(searchAnchor);

		for (const anchorObj of availableAnchors) {
			const anchorText = anchorObj.id;
			const rawText = anchorObj.rawText;

			// 1. Exact match
			if (anchorText === cleanSearchAnchor) {
				return { found: true, matchType: "exact" };
			}

			// 2. Raw text match
			if (rawText === cleanSearchAnchor) {
				return { found: true, matchType: "raw-text" };
			}

			// 3. Backtick-wrapped search unwrapped
			if (
				cleanSearchAnchor.startsWith("`") &&
				cleanSearchAnchor.endsWith("`")
			) {
				const withoutBackticks = cleanSearchAnchor.slice(1, -1);
				if (rawText === withoutBackticks || anchorText === withoutBackticks) {
					return { found: true, matchType: "backtick-unwrapped" };
				}
			}

			// 4. Wrap search in backticks to match header that has them
			if (rawText?.includes("`")) {
				const wrappedSearch = `\`${cleanSearchAnchor}\``;
				if (rawText === wrappedSearch) {
					return { found: true, matchType: "backtick-wrapped" };
				}
			}

			// 5. Markdown-cleaned comparison
			const cleanedHeader = this.cleanMarkdownForComparison(
				rawText || anchorText,
			);
			const cleanedSearch = this.cleanMarkdownForComparison(cleanSearchAnchor);

			if (cleanedHeader === cleanedSearch) {
				return { found: true, matchType: "markdown-cleaned" };
			}
		}

		return { found: false };
	}

	suggestObsidianBetterFormat(
		usedAnchor: string,
		availableAnchors: AnchorObject[],
	): string | null {
		for (const anchorObj of availableAnchors) {
			if (anchorObj.anchorType === "header") {
				const kebabCase = anchorObj.rawText.toLowerCase().replace(/\s+/g, "-");
				if (kebabCase === usedAnchor) {
					const suggestion = encodeURIComponent(anchorObj.id).replace(
						/'/g,
						"%27",
					);
					if (suggestion !== usedAnchor) {
						return suggestion;
					}
				}
			}
		}
		return null;
	}

	// ── Async anchor validation (requires parsedFileCache) ────────────────────

	async validateAnchorExists(
		anchor: string,
		targetFile: string,
		options?: { isBlockRef?: boolean },
	): Promise<{ valid: boolean; suggestion?: string; matchedAs?: string }> {
		if (!this.parsedFileCache) {
			throw new Error(
				"AnchorMatcher.validateAnchorExists requires a parsedFileCache. Pass one to the constructor.",
			);
		}

		try {
			const targetParsedDoc =
				await this.parsedFileCache.resolveParsedFile(targetFile);

			// Direct match via facade
			if (targetParsedDoc.hasAnchor(anchor)) {
				// Check block anchor matched without caret prefix (Issue #81)
				if (!anchor.startsWith("^") && !options?.isBlockRef) {
					const matchedBlockAnchor = targetParsedDoc.data.anchors.find(
						(a) => a.anchorType === "block" && a.id === anchor,
					);
					if (matchedBlockAnchor) {
						const hasHeaderMatch = targetParsedDoc.data.anchors.some(
							(a) => a.anchorType === "header" && a.id === anchor,
						);
						if (!hasHeaderMatch) {
							return {
								valid: true,
								matchedAs: "block-ref-missing-caret",
								suggestion: `Use #^${anchor} for block anchor references`,
							};
						}
					}
				}

				// Check for Obsidian better format suggestion
				const obsidianBetterSuggestion = this.suggestObsidianBetterFormat(
					anchor,
					targetParsedDoc.data.anchors,
				);
				if (obsidianBetterSuggestion) {
					return {
						valid: false,
						suggestion: `Use raw header format for better Obsidian compatibility: #${obsidianBetterSuggestion}`,
					};
				}
				return { valid: true };
			}

			// URL-decoded match for emphasis-marked anchors
			if (anchor.includes("%20")) {
				const decoded = decodeURIComponent(anchor);
				if (targetParsedDoc.hasAnchor(decoded)) {
					return { valid: true };
				}
			}

			// Obsidian block reference matching (^ prefix)
			if (anchor.startsWith("^")) {
				const blockRefName = anchor.substring(1);
				if (targetParsedDoc.hasAnchor(blockRefName)) {
					return { valid: true, matchedAs: "block-ref" };
				}
			}

			// Flexible markdown matching
			const flexibleMatch = this.findFlexibleAnchorMatch(
				anchor,
				targetParsedDoc.data.anchors,
			);
			if (flexibleMatch.found) {
				return {
					valid: true,
					...(flexibleMatch.matchType && {
						matchedAs: flexibleMatch.matchType,
					}),
				};
			}

			// Obsidian better format suggestion for not-found case
			const obsidianBetterSuggestion = this.suggestObsidianBetterFormat(
				anchor,
				targetParsedDoc.data.anchors,
			);
			if (obsidianBetterSuggestion) {
				return {
					valid: false,
					suggestion: `Use raw header format for better Obsidian compatibility: #${obsidianBetterSuggestion}`,
				};
			}

			// Build suggestions from similar anchors
			const suggestions = targetParsedDoc.findSimilarAnchors(anchor);

			const availableHeaders = targetParsedDoc.data.anchors
				.filter((a) => a.anchorType === "header")
				.map((a) => `"${a.rawText}" → #${a.id}`)
				.slice(0, 5);

			const availableBlockRefs = targetParsedDoc.data.anchors
				.filter((a) => a.anchorType === "block")
				.map((a) => `^${a.id}`)
				.slice(0, 5);

			const allSuggestions: string[] = [];
			if (suggestions.length > 0) {
				allSuggestions.push(
					`Available anchors: ${suggestions.slice(0, 3).join(", ")}`,
				);
			}
			if (availableHeaders.length > 0) {
				allSuggestions.push(
					`Available headers: ${availableHeaders.join(", ")}`,
				);
			}
			if (availableBlockRefs.length > 0) {
				allSuggestions.push(
					`Available block refs: ${availableBlockRefs.join(", ")}`,
				);
			}

			return {
				valid: false,
				suggestion:
					allSuggestions.length > 0
						? allSuggestions.join("; ")
						: "No similar anchors found",
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			return {
				valid: false,
				suggestion: `Error reading target file: ${errorMessage}`,
			};
		}
	}
}
