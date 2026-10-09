/**
 * AnchorMatcher — owns all anchor matching logic extracted from CitationValidator.
 *
 * Responsibilities:
 *   - Flexible anchor matching (exact, raw-text, backtick, markdown-cleaned)
 *   - Markdown cleanup for comparison
 *   - Obsidian "better format" suggestion (prefer raw header over kebab-case)
 *   - Block-ref-without-caret detection
 *   - Full validateAnchorExists logic through the parsed-document lifecycle
 *
 * Extracted from CitationValidator (issue #28).
 */

import type {
	AnchorObject,
	LinkObject,
	ParserOutput,
} from "../../types/citationTypes.js";
import type { AnchorConversion } from "../../types/validationTypes.js";
import { normalizeAnchorText } from "../MarkdownParser/normalizeInlineText.js";
import { ANCHOR_DROPPED_CHARS_RULE } from "../ValidationRules/rules/anchorDroppedChars.js";

/**
 * Minimal semantic-document interface used for anchor matching.
 * `data` remains available for consumers that need parser metadata.
 */
export interface ParsedDocumentLike {
	hasAnchor(anchor: string): boolean;
	findSimilarAnchors(anchor: string): string[];
	getLinks(): LinkObject[];
	data: ParserOutput;
}

/**
 * Minimal parsed-document lifecycle needed for anchor validation.
 */
export interface ParsedDocumentLifecycleLike {
	resolveDocument(source: {
		kind: "file";
		filePath: string;
	}): Promise<ParsedDocumentLike>;
}

/** Error prefix for header anchors that contain characters Obsidian drops. */
export const OBSIDIAN_DROPPED_CHARS_ERROR =
	"Anchor uses characters Obsidian drops";

/** Characters Obsidian removes from heading-link anchors. */
const OBSIDIAN_DROPPED_CHARS = /[:#|^[\]]/g;

/**
 * Replace the characters Obsidian drops from heading-link anchors with a
 * space, then collapse whitespace: `Q1: Gap` → `Q1 Gap`, `opsx:continue` →
 * `opsx continue`. Obsidian renders an anchor that keeps these characters as
 * an external link.
 */
const stripObsidianDroppedChars = (text: string): string =>
	text.replace(OBSIDIAN_DROPPED_CHARS, " ").replace(/\s+/g, " ").trim();

/** Anchor text forms that matching compares against a search string. */
interface AnchorComparisonForms {
	cleaned: string;
	normalizedId: string | null;
	decodedUrlEncodedId: string | null;
	kebabCase: string | null;
}

// Parsed anchors do not change after parsing. This cache computes each form one
// time per anchor, so a lookup does not normalize every heading again.
const comparisonFormsCache = new WeakMap<AnchorObject, AnchorComparisonForms>();

/** Anchor positions keyed by each text form that a match compares. */
interface AnchorIndex {
	byMatchKey: Map<string, number[]>;
	byKebabCase: Map<string, number[]>;
}

// One index for each parsed anchor list. A lookup reads only the anchors that
// share a text form with the search, not every anchor in the document.
const anchorIndexCache = new WeakMap<AnchorObject[], AnchorIndex>();

/** Add a position one time. Positions arrive in ascending order. */
const addPosition = (
	map: Map<string, number[]>,
	key: string,
	position: number,
): void => {
	const positions = map.get(key);
	if (positions === undefined) map.set(key, [position]);
	else if (positions.at(-1) !== position) positions.push(position);
};

/** Decode URL escapes. Keep the text as-is when the escapes are malformed. */
const decodeOrKeep = (text: string): string => {
	try {
		return decodeURIComponent(text);
	} catch {
		return text;
	}
};

export class AnchorMatcher {
	private parsedDocumentLifecycle: ParsedDocumentLifecycleLike | null;

	/**
	 * @param parsedDocumentLifecycle - Optional. Required only for
	 *   validateAnchorExists(); pass null when using only pure matching helpers.
	 */
	constructor(
		parsedDocumentLifecycle: ParsedDocumentLifecycleLike | null = null,
	) {
		this.parsedDocumentLifecycle = parsedDocumentLifecycle;
	}

	// ── Pure matching helpers (no I/O) ────────────────────────────────────────

	cleanMarkdownForComparison(text: string): string {
		if (!text) return "";
		// Formatting removal is tokenizer-backed (flavor extension collection);
		// what remains here is domain normalization on plain text, not markdown
		// re-parsing (decision rule 2 — regex as minimal grammar for non-markdown).
		// whitespacePattern narrower than the shared default (only 2+ literal
		// spaces collapse) to preserve this call site's original behavior.
		return normalizeAnchorText(text, {
			colons: "space",
			removeBackslash: true,
			removeBrackets: true,
			whitespacePattern: / {2,}/g,
		});
	}

	private comparisonForms(anchor: AnchorObject): AnchorComparisonForms {
		const cached = comparisonFormsCache.get(anchor);
		if (cached !== undefined) return cached;
		const isHeader = anchor.anchorType === "header";
		const forms: AnchorComparisonForms = {
			cleaned: this.cleanMarkdownForComparison(anchor.rawText || anchor.id),
			normalizedId: isHeader
				? normalizeAnchorText(anchor.id, {
						stripMarkdown: false,
						colons: "strip",
					})
				: null,
			decodedUrlEncodedId: isHeader ? decodeOrKeep(anchor.urlEncodedId) : null,
			kebabCase: isHeader
				? anchor.rawText.toLowerCase().replace(/\s+/g, "-")
				: null,
		};
		comparisonFormsCache.set(anchor, forms);
		return forms;
	}

	private anchorIndex(anchors: AnchorObject[]): AnchorIndex {
		const cached = anchorIndexCache.get(anchors);
		if (cached !== undefined) return cached;
		const index: AnchorIndex = { byMatchKey: new Map(), byKebabCase: new Map() };
		anchors.forEach((anchor, position) => {
			const forms = this.comparisonForms(anchor);
			const keys = [anchor.id, forms.cleaned];
			if (anchor.anchorType === "header") {
				keys.push(anchor.rawText, anchor.urlEncodedId);
			}
			if (forms.normalizedId !== null) keys.push(forms.normalizedId);
			if (forms.decodedUrlEncodedId !== null) {
				keys.push(forms.decodedUrlEncodedId);
			}
			for (const key of keys) addPosition(index.byMatchKey, key, position);
			if (forms.kebabCase !== null) {
				addPosition(index.byKebabCase, forms.kebabCase, position);
			}
		});
		anchorIndexCache.set(anchors, index);
		return index;
	}

	findFlexibleAnchorMatch(
		searchAnchor: string,
		availableAnchors: AnchorObject[],
	): { found: boolean; matchType?: string } {
		const cleanSearchAnchor = decodeOrKeep(searchAnchor);
		// Cleaned once per lookup, not once per candidate anchor — cleaning is
		// the expensive tokenizer-backed path and the search string is constant.
		const cleanedSearch = this.cleanMarkdownForComparison(cleanSearchAnchor);

		for (const anchorObj of availableAnchors) {
			const matchType = this.flexibleMatchType(
				cleanSearchAnchor,
				cleanedSearch,
				anchorObj,
			);
			if (matchType !== null) return { found: true, matchType };
		}

		return { found: false };
	}

	private flexibleMatchType(
		cleanSearchAnchor: string,
		cleanedSearch: string,
		anchorObj: AnchorObject,
	): string | null {
		const anchorText = anchorObj.id;
		const rawText = anchorObj.rawText;

		// 1. Exact match
		if (anchorText === cleanSearchAnchor) return "exact";

		// 2. Raw text match
		if (rawText === cleanSearchAnchor) return "raw-text";

		// 3. Backtick-wrapped search unwrapped
		if (cleanSearchAnchor.startsWith("`") && cleanSearchAnchor.endsWith("`")) {
			const withoutBackticks = cleanSearchAnchor.slice(1, -1);
			if (rawText === withoutBackticks || anchorText === withoutBackticks) {
				return "backtick-unwrapped";
			}
		}

		// 4. Wrap search in backticks to match header that has them
		if (rawText?.includes("`") && rawText === `\`${cleanSearchAnchor}\``) {
			return "backtick-wrapped";
		}

		// 5. Markdown-cleaned comparison
		if (this.comparisonForms(anchorObj).cleaned === cleanedSearch) {
			return "markdown-cleaned";
		}

		return null;
	}

	findMatchingAnchors(
		searchAnchor: string,
		availableAnchors: AnchorObject[],
	): Array<{ anchor: AnchorObject; matchType?: string }> {
		const decodedSearchAnchor = decodeOrKeep(searchAnchor);
		const blockSearchAnchor = decodedSearchAnchor.startsWith("^")
			? decodedSearchAnchor.slice(1)
			: decodedSearchAnchor;
		const normalizedSearch = normalizeAnchorText(decodedSearchAnchor, {
			stripMarkdown: false,
			colons: "strip",
		});
		// The flexible match decodes the search text one more time. Keep that.
		const flexibleSearch = decodeOrKeep(decodedSearchAnchor);
		const flexibleCleanedSearch =
			this.cleanMarkdownForComparison(flexibleSearch);

		// Every match rule compares one anchor text form with one of these keys.
		// The index gives the anchors that can match. The rules below still decide.
		const searchKeys = [
			searchAnchor,
			decodedSearchAnchor,
			blockSearchAnchor,
			normalizedSearch,
			flexibleSearch,
			flexibleCleanedSearch,
			`\`${flexibleSearch}\``,
		];
		if (flexibleSearch.startsWith("`") && flexibleSearch.endsWith("`")) {
			searchKeys.push(flexibleSearch.slice(1, -1));
		}
		const { byMatchKey } = this.anchorIndex(availableAnchors);
		const positions = new Set<number>();
		for (const key of searchKeys) {
			for (const position of byMatchKey.get(key) ?? []) positions.add(position);
		}
		const candidates = [...positions]
			.sort((a, b) => a - b)
			.flatMap((position) => availableAnchors[position] ?? []);

		return candidates.flatMap((anchor) => {
			if (
				anchor.id === searchAnchor ||
				anchor.id === decodedSearchAnchor ||
				(anchor.anchorType === "block" && anchor.id === blockSearchAnchor)
			) {
				return [
					{
						anchor,
						matchType:
							anchor.anchorType === "block" &&
							decodedSearchAnchor.startsWith("^")
								? "block-ref"
								: "exact",
					},
				];
			}

			if (anchor.anchorType === "header") {
				const forms = this.comparisonForms(anchor);
				if (
					anchor.urlEncodedId === searchAnchor ||
					forms.decodedUrlEncodedId === decodedSearchAnchor
				) {
					return [{ anchor, matchType: "url-encoded" }];
				}

				if (forms.normalizedId === normalizedSearch) {
					return [{ anchor, matchType: "normalized" }];
				}
			}

			const matchType = this.flexibleMatchType(
				flexibleSearch,
				flexibleCleanedSearch,
				anchor,
			);
			return matchType === null ? [] : [{ anchor, matchType }];
		});
	}

	suggestObsidianBetterFormat(
		usedAnchor: string,
		availableAnchors: AnchorObject[],
	): string | null {
		const positions =
			this.anchorIndex(availableAnchors).byKebabCase.get(usedAnchor) ?? [];
		// Only header anchors have a kebab-case form in the index.
		for (const position of positions) {
			const anchorObj = availableAnchors[position];
			if (anchorObj === undefined) continue;
			const suggestion = encodeURIComponent(anchorObj.id).replace(/'/g, "%27");
			if (suggestion !== usedAnchor) {
				return suggestion;
			}
		}
		return null;
	}

	/**
	 * Normalize a broken anchor reference for fuzzy matching against header
	 * anchors (removes leading `#` and hyphens, lowercases).
	 */
	private normalizeAnchorForMatching(anchor: string): string {
		return anchor.replace("#", "").replace(/-/g, " ").toLowerCase();
	}

	/**
	 * Find the best header-anchor match for a broken anchor using fuzzy
	 * logic (exact or punctuation-stripped comparison against `rawText`).
	 * Moved from `citationFixer.findBestHeaderMatch` so the fuzzy-match
	 * computation lives alongside the `AnchorObject[]` data it operates on,
	 * instead of re-deriving a `HeaderObject[]` by regex-parsing a display
	 * string.
	 */
	private findBestHeaderMatch(
		brokenAnchor: string,
		headerAnchors: AnchorObject[],
	): AnchorObject | undefined {
		const searchText = this.normalizeAnchorForMatching(brokenAnchor);
		return headerAnchors.find((header) => {
			// header.rawText is only null for block anchors; callers pass an
			// anchorType === "header" filtered list, so this is always a string.
			const rawText = (header.rawText ?? "").toLowerCase();
			return (
				rawText === searchText ||
				rawText.replace(/[.\s]/g, "") === searchText.replace(/\s/g, "")
			);
		});
	}

	/**
	 * URL-encode header text for use as an anchor (spaces to %20, periods to %2E).
	 */
	private urlEncodeAnchor(headerText: string): string {
		return headerText.replace(/ /g, "%20").replace(/\./g, "%2E");
	}

	/**
	 * Detect a header anchor that contains characters Obsidian drops (`: # | ^ [ ]`)
	 * and resolves to a header once those characters are removed. Returns the
	 * dropped characters and the corrected anchor, or null.
	 */
	private findObsidianDroppedChars(
		anchor: string,
		availableAnchors: AnchorObject[],
	): { dropped: string; recommended: string } | null {
		let decodedAnchor: string;
		try {
			decodedAnchor = decodeURIComponent(anchor);
		} catch {
			decodedAnchor = anchor;
		}
		const dropped = [
			...new Set(decodedAnchor.match(OBSIDIAN_DROPPED_CHARS) ?? []),
		].join("");
		if (dropped === "") return null;

		const header = this.findMatchingAnchors(
			stripObsidianDroppedChars(decodedAnchor),
			availableAnchors,
		).find(({ anchor: candidate }) => candidate.anchorType === "header");
		if (header === undefined) return null;

		return {
			dropped,
			recommended: stripObsidianDroppedChars(header.anchor.id).replace(
				/ /g,
				"%20",
			),
		};
	}

	// ── Async anchor validation (requires document lifecycle) ──────────────────

	async validateAnchorExists(
		anchor: string,
		targetFile: string,
		options?: { isBlockRef?: boolean; ruleIds?: ReadonlySet<string> },
	): Promise<{
		valid: boolean;
		error?: string;
		suggestion?: string;
		ruleId?: string;
		matchedAs?: string;
		anchorConversion?: AnchorConversion;
		matchedAnchors?: AnchorObject[];
	}> {
		if (!this.parsedDocumentLifecycle) {
			throw new Error(
				"AnchorMatcher.validateAnchorExists requires a parsed document lifecycle.",
			);
		}

		try {
			const targetParsedDoc =
				await this.parsedDocumentLifecycle.resolveDocument({
					kind: "file",
					filePath: targetFile,
				});

			// Without the rule, suggestions keep heading punctuation intact.
			const dropsChars =
				options?.ruleIds?.has(ANCHOR_DROPPED_CHARS_RULE) ?? false;
			if (!anchor.startsWith("^") && !options?.isBlockRef && dropsChars) {
				const droppedChars = this.findObsidianDroppedChars(
					anchor,
					targetParsedDoc.data.anchors,
				);
				if (droppedChars) {
					return {
						valid: false,
						error: `${OBSIDIAN_DROPPED_CHARS_ERROR} (${droppedChars.dropped}): #${anchor}`,
						suggestion: `#${droppedChars.recommended}`,
						ruleId: ANCHOR_DROPPED_CHARS_RULE,
						anchorConversion: {
							type: "anchor-conversion",
							original: anchor,
							recommended: droppedChars.recommended,
						},
					};
				}
			}

			const matches = this.findMatchingAnchors(
				anchor,
				targetParsedDoc.data.anchors,
			);
			if (matches.length > 0) {
				const matchedAnchors = matches.map((match) => match.anchor);
				if (!anchor.startsWith("^") && !options?.isBlockRef) {
					const matchedBlockAnchor = matchedAnchors.find(
						(candidate) => candidate.anchorType === "block",
					);
					const hasHeaderMatch = matchedAnchors.some(
						(candidate) => candidate.anchorType === "header",
					);
					if (matchedBlockAnchor !== undefined && !hasHeaderMatch) {
						return {
							valid: true,
							matchedAs: "block-ref-missing-caret",
							suggestion: `Use #^${anchor} for block anchor references`,
							matchedAnchors,
						};
					}
				}

				const directSemanticMatch = matches.some(
					({ matchType }) =>
						matchType === "exact" ||
						matchType === "url-encoded" ||
						matchType === "normalized" ||
						matchType === "block-ref",
				);
				const obsidianBetterSuggestion = directSemanticMatch
					? this.suggestObsidianBetterFormat(
							anchor,
							targetParsedDoc.data.anchors,
						)
					: null;
				if (obsidianBetterSuggestion) {
					return {
						valid: false,
						suggestion: `Use raw header format for better Obsidian compatibility: #${obsidianBetterSuggestion}`,
						anchorConversion: {
							type: "anchor-conversion",
							original: anchor,
							recommended: obsidianBetterSuggestion,
						},
						matchedAnchors,
					};
				}

				const matchType = matches[0]?.matchType;
				return {
					valid: true,
					matchedAnchors,
					...(matchType !== undefined &&
						matchType !== "exact" && { matchedAs: matchType }),
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
					anchorConversion: {
						type: "anchor-conversion",
						original: anchor,
						recommended: obsidianBetterSuggestion,
					},
				};
			}

			// Build suggestions from similar anchors
			const suggestions = targetParsedDoc.findSimilarAnchors(anchor);

			const headerAnchors = targetParsedDoc.data.anchors
				.filter((a) => a.anchorType === "header")
				.slice(0, 5);

			const availableHeaders = headerAnchors.map(
				(a) => `"${a.rawText}" → #${dropsChars ? stripObsidianDroppedChars(a.id) : a.id}`,
			);

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

			// Structured fuzzy-match data for citationFixer — mirrors the same
			// `headerAnchors` (top-5) window used in the display string above,
			// so `--fix` behavior stays identical to the retired regex-parse.
			const bestHeaderMatch = this.findBestHeaderMatch(
				`#${anchor}`,
				headerAnchors,
			);

			return {
				valid: false,
				suggestion:
					allSuggestions.length > 0
						? allSuggestions.join("; ")
						: "No similar anchors found",
				...(bestHeaderMatch && {
					anchorConversion: {
						type: "anchor-conversion" as const,
						original: anchor,
						recommended: this.urlEncodeAnchor(
							dropsChars
								? stripObsidianDroppedChars(bestHeaderMatch.rawText ?? "")
								: (bestHeaderMatch.rawText ?? ""),
						),
					},
				}),
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
