/**
 * Anchor normalization utilities
 * Per ADR-CE02: Normalization in ContentExtractor, not ParsedDocument
 */

/**
 * Normalize block anchor by removing '^' prefix
 * @param anchor - Block ID that may start with ^, or null
 * @returns Block ID without leading caret, or null if input is null
 */
export function normalizeBlockId(anchor: string | null): string | null {
	// IF anchor is not null AND starts with '^'
	if (anchor && anchor.startsWith("^")) {
		//   RETURN anchor.substring(1)
		return anchor.substring(1);
	}
	// ELSE
	//   RETURN anchor unchanged
	return anchor;
}

/**
 * Decode URL-encoded characters in anchor strings
 * @param anchor - URL-encoded anchor string, or null
 * @returns Decoded anchor string, original if decoding fails, or null if input null
 */
export function decodeUrlAnchor(anchor: string | null): string | null {
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
