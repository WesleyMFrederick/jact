/**
 * citationFixer — domain logic for applying citation fixes
 *
 * Exported from this module:
 * - Functional helpers: applyPathConversion, applyAnchorFix, etc.
 * - CitationFixer class: wraps the string-replacement loop with dry-run support.
 *
 * Extracted from JactCli as part of issue #29.
 *
 * @module citationFixer
 */

import type {
	EnrichedLinkObject,
	FixRecord,
	HeaderObject,
	PathConversion,
} from "../types/validationTypes.js";

// ---------------------------------------------------------------------------
// CitationFixer class
// ---------------------------------------------------------------------------

/**
 * Result returned by CitationFixer.applyFixes().
 */
export interface ApplyFixesResult {
	/** Modified file content (original content when dryRun is true) */
	content: string;
	/** Number of fixes applied (or that would be applied in dry-run mode) */
	fixesApplied: number;
	/** Whether this was a dry-run (no file writes performed) */
	dryRun: boolean;
}

/**
 * CitationFixer applies a list of pre-computed FixRecord entries to file content.
 *
 * Responsibilities:
 * - String replacement loop over FixRecord entries
 * - Dry-run gate (returns original content unchanged when dryRun is true)
 * - Fix count tracking
 *
 * Does NOT perform file I/O — callers are responsible for reading and writing
 * the file. This keeps the class independently unit-testable without spawning
 * a CLI process.
 */
export class CitationFixer {
	/**
	 * Apply a list of fix records to file content.
	 *
	 * Each FixRecord's `old` string is replaced with its `new` string using
	 * String.prototype.replace (replaces first occurrence).
	 *
	 * When `dryRun` is true, the content is NOT modified but fixesApplied
	 * reflects how many replacements would have been made.
	 *
	 * @param content - Full file content as a string
	 * @param fixes - Ordered list of fix records to apply
	 * @param options - Fix options
	 * @param options.dryRun - When true, report fixes but do not modify content
	 * @returns ApplyFixesResult with modified content, fix count, and dryRun flag
	 */
	applyFixes(
		content: string,
		fixes: FixRecord[],
		options: { dryRun: boolean },
	): ApplyFixesResult {
		const { dryRun } = options;

		if (fixes.length === 0) {
			return { content, fixesApplied: 0, dryRun };
		}

		let modified = content;
		let fixesApplied = 0;

		for (const fix of fixes) {
			if (modified.includes(fix.old)) {
				if (!dryRun) {
					modified = modified.replace(fix.old, fix.new);
				}
				fixesApplied++;
			}
		}

		return {
			content: dryRun ? content : modified,
			fixesApplied,
			dryRun,
		};
	}
}

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
