/**
 * Anchor normalization utilities
 * Per ADR-CE02: Normalization in ContentExtractor, not ParsedDocument
 */

/**
 * Normalize block anchor by removing '^' prefix
 */
export function normalizeBlockId(anchor) {
	// IF anchor is not null AND starts with '^'
	if (anchor && anchor.startsWith('^')) {
		//   RETURN anchor.substring(1)
		return anchor.substring(1);
	}
	// ELSE
	//   RETURN anchor unchanged
	return anchor;
}

/**
 * Decode URL-encoded characters in anchor strings
 */
export function decodeUrlAnchor(anchor) {
	// IF anchor is null
	if (anchor === null) {
		//   RETURN null
		return null;
	}

	// TRY
	try {
		//   RETURN decodeURIComponent(anchor)
		return decodeURIComponent(anchor);
	} catch (error) {
		// CATCH error
		//   RETURN anchor unchanged // Graceful fallback
		return anchor;
	}
}
