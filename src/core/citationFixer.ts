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
 * Apply anchor fix to citation
 *
 * Reads the structured `anchorConversion` the validator already computed
 * (AnchorMatcher — Obsidian-compatibility kebab-case→raw-header conversion,
 * or fuzzy match against available headers for a missing anchor) instead of
 * regex-parsing the human-readable `suggestion` string back into a fix
 * (retired: `parseAvailableHeaders`, `findBestHeaderMatch`,
 * `normalizeAnchorForMatching`, `urlEncodeAnchor`, `suggestionMatch`).
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

	const { anchorConversion } = link.validation;
	if (!anchorConversion) {
		return citation;
	}

	// Structured link parts — the parser already tokenized this citation, so we
	// read fields instead of re-parsing the string with regex (decision rule 3).
	const linkText = link.text;
	const filePath = link.target.path.raw;
	const linkAnchor = link.target.anchor;
	const hasMarkdownLinkParts =
		link.linkType === "markdown" &&
		linkText !== null &&
		filePath !== null &&
		linkAnchor !== null;

	if (!hasMarkdownLinkParts) {
		return citation;
	}

	return `[${linkText}](${filePath}#${anchorConversion.recommended})`;
}
