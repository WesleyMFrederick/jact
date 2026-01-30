/**
 * Detect extraction marker following a link
 *
 * Looks for optional markers after links that indicate extraction context:
 * - %% text %% — Obsidian highlight marker
 * - <!-- text --> — HTML comment marker
 *
 * @param line - The full line of markdown
 * @param linkEndColumn - The column where the link ends
 * @returns Object with fullMatch and innerText, or null if no marker found
 */
export function detectExtractionMarker(
	line: string,
	linkEndColumn: number,
): { fullMatch: string; innerText: string } | null {
	const remainingLine = line.substring(linkEndColumn);

	// Pattern: %%text%% or <!-- text -->
	const markerPattern = /\s*(%%(.+?)%%|<!--\s*(.+?)\s*-->)/;
	const match = remainingLine.match(markerPattern);

	if (match) {
		return {
			fullMatch: match[1] ?? "", // Full marker with delimiters
			innerText: (match[2] ?? match[3] ?? "").trim(), // Text between delimiters (trimmed)
		};
	}

	return null;
}
