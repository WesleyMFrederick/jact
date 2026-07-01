/**
 * Purpose: Extract heading metadata from an mdast tree.
 * Responsibilities: Walk `heading` nodes via unist-util-visit; produce
 *   { level, text, raw } where raw is sliced from source by node.position and
 *   text is the raw inline text (markdown markers preserved, matching the prior
 *   marked-based contract — backticks/`**` are kept, not stripped).
 * Boundary: No marked dependency. Reads the parsed mdast Root only.
 */
import type { Heading, Root } from "mdast";
import { toString as mdastToString } from "mdast-util-to-string";
import { visit } from "unist-util-visit";
import type { HeadingObject } from "../../types/citationTypes.js";

/** Raw markdown slice for a heading node (falls back to empty string). */
export function headingRaw(node: Heading, content: string): string {
	const start = node.position?.start.offset;
	const end = node.position?.end.offset;
	return start !== undefined && end !== undefined
		? content.slice(start, end)
		: "";
}

/**
 * Heading display text matching the prior marked contract: the raw inline text
 * with ATX markers stripped but inline markdown (backticks, emphasis) preserved.
 * Falls back to mdast's plain-text rendering for setext headings.
 */
export function headingText(node: Heading, content: string): string {
	const raw = headingRaw(node, content);
	const atx = raw.match(/^#{1,6}[ \t]+(.*?)(?:[ \t]+#+[ \t]*)?$/);
	return atx?.[1] !== undefined ? atx[1].trim() : mdastToString(node);
}

/**
 * Extract heading metadata from the mdast tree.
 *
 * @param ast - mdast Root produced by fromMarkdown
 * @param content - Full source content (for raw slicing via node.position)
 * @returns Array of { level, text, raw } heading objects
 */
export function extractHeadings(ast: Root, content: string): HeadingObject[] {
	const headings: HeadingObject[] = [];

	visit(ast, "heading", (node) => {
		headings.push({
			level: node.depth,
			text: headingText(node, content),
			raw: headingRaw(node, content),
			position: node.position,
		});
	});

	return headings;
}
