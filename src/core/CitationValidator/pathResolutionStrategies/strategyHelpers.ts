/**
 * Shared helpers for path resolution strategies.
 * Extracted from CitationValidator (issue #28).
 */

import type { LinkObject } from "../../../types/citationTypes.js";
import type { PathConversion } from "../../../types/validationTypes.js";
import type { AnchorMatcher } from "../AnchorMatcher.js";
import type { PathResolutionResult } from "./PathResolutionStrategy.js";

/**
 * Build a PathResolutionResult from a citation + status fields.
 */
export function buildResult(
	citation: LinkObject,
	status: "valid" | "error" | "warning",
	error: string | null = null,
	message: string | null = null,
	suggestion: PathConversion | null = null,
): PathResolutionResult {
	const result: PathResolutionResult = {
		line: citation.line,
		citation: citation.fullMatch,
		status,
		linkType: citation.linkType,
		scope: citation.scope,
	};
	if (error) result.error = error;
	if (message) result.suggestion = message;
	if (suggestion) result.pathConversion = suggestion;
	return result;
}

/**
 * Validate anchor against a target file.
 * Returns a result if anchor validation produces an error/warning, null if valid.
 */
export async function checkAnchor(
	citation: LinkObject,
	targetPath: string,
	anchorMatcher: AnchorMatcher,
	prefixMessage: string | null = null,
): Promise<PathResolutionResult | null> {
	const anchor = citation.target.anchor;
	if (!anchor) return null;

	const anchorExists = await anchorMatcher.validateAnchorExists(
		anchor,
		targetPath,
	);

	if (!anchorExists.valid) {
		const anchorMessage = `Anchor not found: #${anchor}`;
		const combined = prefixMessage
			? `${prefixMessage}. ${anchorMessage}`
			: anchorMessage;
		return buildResult(citation, "error", combined, anchorExists.suggestion);
	}

	if (anchorExists.matchedAs === "block-ref-missing-caret") {
		return buildResult(citation, "warning", null, anchorExists.suggestion);
	}

	return null;
}
