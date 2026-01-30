/**
 * Classify anchor as "block" (^prefix) or "header"
 *
 * @param anchorString - The anchor identifier string
 * @returns "block" for caret references, "header" for others, or null if empty
 */
export function determineAnchorType(anchorString: string): 'header' | 'block' | null {
	if (!anchorString) return null;

	// Block references start with ^ or match ^alphanumeric pattern
	if (
		anchorString.startsWith("^") ||
		/^\^[a-zA-Z0-9\-_]+$/.test(anchorString)
	) {
		return "block";
	}

	// Everything else is a header reference
	return "header";
}
