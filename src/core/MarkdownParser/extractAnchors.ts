import type { HeadingObject, AnchorObject } from "../../types/citationTypes.js";

/**
 * Extract all anchor definitions from markdown content
 *
 * Detects multiple anchor types:
 * - Obsidian block references: ^anchor-id at end of line
 * - Caret syntax: ^anchor-id (legacy format, for compatibility)
 * - Emphasis-marked: ==**text**==
 * - Header anchors: Auto-generated from headings or explicit {#id}
 *
 * For headers, generates both:
 * - Raw text anchor (exact heading text)
 * - Obsidian-compatible anchor (URL-encoded with spaces as %20, colons removed)
 *
 * This dual anchor approach supports both standard markdown and Obsidian linking.
 *
 * @param content - Full markdown file content
 * @param headings - Optional heading objects from extractHeadings
 * @returns Array of { anchorType, id, rawText, fullMatch, line, column } anchor objects
 */
export function extractAnchors(content: string, headings?: HeadingObject[]): AnchorObject[] {
	const anchors: AnchorObject[] = [];
	const lines = content.split("\n");

	lines.forEach((line, index) => {
		// Obsidian block references: ^anchor-id at end of line
		const obsidianBlockRegex = /\^([a-zA-Z0-9\-_]+)$/;
		const obsidianMatch = line.match(obsidianBlockRegex);
		if (obsidianMatch) {
			anchors.push({
				anchorType: "block",
				id: obsidianMatch[1] ?? "",
				rawText: null,
				fullMatch: obsidianMatch[0],
				line: index + 1,
				column: line.lastIndexOf(obsidianMatch[0]),
			});
		}

		// Caret syntax anchors: ^anchor-id (general pattern, not just at end of line)
		const caretRegex = /\^([A-Za-z0-9-]+)/g;
		let match = caretRegex.exec(line);
		while (match !== null) {
			const caretAnchor = match[1] ?? "";

			// Check if it's an Obsidian block reference (already handled above)
			const isObsidianBlock = line.endsWith(match[0]);

			// Skip semantic version patterns (^14.0.1, etc.)
			const afterMatch = line.substring(match.index + match[0].length);
			const isSemanticVersion = /^\.\d/.test(afterMatch);

			if (!isObsidianBlock && !isSemanticVersion) {
				anchors.push({
					anchorType: "block",
					id: caretAnchor,
					rawText: null,
					fullMatch: match[0],
					line: index + 1,
					column: match.index,
				});
			}
			match = caretRegex.exec(line);
		}

		// Emphasis-marked anchors: ==**text**==
		const emphasisRegex = /==\*\*([^*]+)\*\*==/g;
		match = emphasisRegex.exec(line);
		while (match !== null) {
			anchors.push({
				anchorType: "block",
				id: match[1] ?? "",
				rawText: null,
				fullMatch: match[0],
				line: index + 1,
				column: match.index,
			});
			match = emphasisRegex.exec(line);
		}
	});

	// Derive header anchors from headings array (if provided)
	if (headings) {
		// Find line numbers for each heading in content
		for (const heading of headings) {
			const lineIndex = lines.findIndex(l => {
				const headerRegex = /^(#+)\s+(.+)$/;
				const match = l.match(headerRegex);
				return match && match[2] && (match[2] === heading.text) && match[1] && (match[1].length === heading.level);
			});

			if (lineIndex === -1) continue;
			const line = lines[lineIndex];

			// Check for explicit anchor ID
			const explicitAnchorRegex = /^(.+?)\s*\{#([^}]+)\}$/;
			const explicitMatch = heading.text.match(explicitAnchorRegex);

			if (explicitMatch) {
				const explicitId = explicitMatch[2] ?? "";
				anchors.push({
					anchorType: "header",
					id: explicitId,
					urlEncodedId: explicitId,
					rawText: (explicitMatch[1] ?? "").trim(),
					fullMatch: line ?? "",
					line: lineIndex + 1,
					column: 0,
				});
			} else {
				const urlEncodedId = heading.text
					.replace(/:/g, "")
					.replace(/\s+/g, "%20");

				anchors.push({
					anchorType: "header",
					id: heading.text,
					urlEncodedId,
					rawText: heading.text,
					fullMatch: line ?? "",
					line: lineIndex + 1,
					column: 0,
				});
			}
		}
	}

	return anchors;
}
