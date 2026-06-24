import type { Root } from "mdast";
import { visit } from "unist-util-visit";
import type { AnchorObject } from "../../types/citationTypes.js";
import { headingRaw, headingText } from "./extractHeadings.js";

/**
 * Extract all anchor definitions from markdown content.
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
 * Header anchors are derived from the parsed mdast tree (D3 — heading line
 * numbers come from node.position, not a regex re-find). Block/caret/emphasis
 * anchors still scan raw lines pending their own node migration (Phase 3).
 *
 * @param ast - mdast Root produced by fromMarkdown over `content`
 * @param content - Full markdown file content
 * @returns Array of AnchorObject (block + header anchors)
 */
export function extractAnchors(ast: Root, content: string): AnchorObject[] {
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

	// Header anchors from the mdast tree. Only ATX headings (`# …`) produce a
	// header anchor — matching the prior contract, where setext headings were
	// skipped by the `^#+\s` line probe.
	visit(ast, "heading", (node) => {
		const raw = headingRaw(node, content);
		if (!/^#{1,6}[ \t]/.test(raw)) return;

		const text = headingText(node, content);
		const lineNum = node.position?.start.line ?? 0;
		const fullMatch = lines[lineNum - 1] ?? "";

		// Check for explicit anchor ID: `Heading {#custom-id}`
		const explicitMatch = text.match(/^(.+?)\s*\{#([^}]+)\}$/);
		if (explicitMatch) {
			const explicitId = explicitMatch[2] ?? "";
			anchors.push({
				anchorType: "header",
				id: explicitId,
				urlEncodedId: explicitId,
				rawText: (explicitMatch[1] ?? "").trim(),
				fullMatch,
				line: lineNum,
				column: 0,
			});
		} else {
			const urlEncodedId = text.replace(/:/g, "").replace(/\s+/g, "%20");
			anchors.push({
				anchorType: "header",
				id: text,
				urlEncodedId,
				rawText: text,
				fullMatch,
				line: lineNum,
				column: 0,
			});
		}
	});

	return anchors;
}
