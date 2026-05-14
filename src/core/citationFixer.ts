/**
 * citationFixer — domain logic for applying citation fixes
 *
 * Extracted from JactCli: these five helpers operate on citation strings and
 * validation metadata only — no JactCli instance state required.
 *
 * @module citationFixer
 */

import type {
	EnrichedLinkObject,
	HeaderObject,
	PathConversion,
} from "../types/validationTypes.js";

/**
 * Apply path conversion to citation
 * @param citation - Citation text to modify
 * @param pathConversion - Path conversion object
 * @returns Citation with converted path
 */
export function applyPathConversion(
	citation: string,
	pathConversion: PathConversion,
): string {
	return citation.replace(pathConversion.original, pathConversion.recommended);
}

/**
 * Parse available headers from suggestion message
 *
 * Extracts header mappings from validator suggestion string.
 * Format: "Available headers: \"Vision Statement\" → #Vision Statement, ..."
 *
 * @param suggestion - Suggestion message from validator
 * @returns Array of header objects with text and anchor
 */
export function parseAvailableHeaders(suggestion: string): HeaderObject[] {
	const headerRegex = /"([^"]+)"\s*→\s*#([^,]+)/g;
	return [...suggestion.matchAll(headerRegex)].map((match) => ({
		text: (match[1] || "").trim(),
		anchor: `#${(match[2] || "").trim()}`,
	}));
}

/**
 * Normalize anchor for fuzzy matching (removes # and hyphens)
 * @param anchor - Anchor text to normalize
 * @returns Normalized anchor
 */
function normalizeAnchorForMatching(anchor: string): string {
	return anchor.replace("#", "").replace(/-/g, " ").toLowerCase();
}

/**
 * Find best header match using fuzzy logic
 *
 * Matches normalized broken anchor against available headers using exact
 * or punctuation-stripped comparison.
 *
 * @param brokenAnchor - Anchor that wasn't found
 * @param availableHeaders - Available headers
 * @returns Best matching header or undefined
 */
export function findBestHeaderMatch(
	brokenAnchor: string,
	availableHeaders: HeaderObject[],
): HeaderObject | undefined {
	const searchText = normalizeAnchorForMatching(brokenAnchor);
	return availableHeaders.find(
		(header) =>
			header.text.toLowerCase() === searchText ||
			header.text.toLowerCase().replace(/[.\s]/g, "") ===
				searchText.replace(/\s/g, ""),
	);
}

/**
 * URL-encode anchor text (spaces to %20, periods to %2E)
 * @param headerText - Header text to encode
 * @returns URL-encoded anchor
 */
export function urlEncodeAnchor(headerText: string): string {
	return headerText.replace(/ /g, "%20").replace(/\./g, "%2E");
}

/**
 * Apply anchor fix to citation
 *
 * Handles two fix types:
 * - Obsidian compatibility: kebab-case to raw header format
 * - Missing anchors: fuzzy match to available headers
 *
 * @param citation - Original citation text
 * @param link - Link object with validation metadata
 * @returns Citation with corrected anchor or original
 */
export function applyAnchorFix(
	citation: string,
	link: EnrichedLinkObject,
): string {
	if (
		link.validation.status !== "error" &&
		link.validation.status !== "warning"
	) {
		return citation;
	}

	const { suggestion } = link.validation;
	const errorText =
		link.validation.status === "error" ? link.validation.error : undefined;

	const suggestionMatch = suggestion?.match(
		/Use raw header format for better Obsidian compatibility: #(.+)$/,
	);
	if (suggestionMatch) {
		const newAnchor = suggestionMatch[1];
		const citationMatch = citation.match(/\[([^\]]+)\]\(([^)]+)#([^)]+)\)/);
		if (citationMatch) {
			const [, linkText, filePath] = citationMatch;
			return `[${linkText}](${filePath}#${newAnchor})`;
		}
	}

	// Handle anchor not found errors
	if (
		errorText?.startsWith("Anchor not found") &&
		suggestion?.includes("Available headers:")
	) {
		const availableHeaders = parseAvailableHeaders(suggestion ?? "");
		const citationMatch = citation.match(/\[([^\]]+)\]\(([^)]+)#([^)]+)\)/);

		if (citationMatch && availableHeaders.length > 0) {
			const [, linkText, filePath, brokenAnchor] = citationMatch;
			const bestMatch = findBestHeaderMatch(
				`#${brokenAnchor}`,
				availableHeaders,
			);

			if (bestMatch) {
				const encodedAnchor = urlEncodeAnchor(bestMatch.text);
				return `[${linkText}](${filePath}#${encodedAnchor})`;
			}
		}
	}

	return citation;
}
