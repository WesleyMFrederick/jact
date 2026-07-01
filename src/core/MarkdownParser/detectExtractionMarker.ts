/**
 * Detect extraction markers following a link — read from mdast tokens (WMF-35).
 *
 * Extraction markers are the Obsidian `%%text%%` comment and the HTML
 * `<!-- text -->` comment. micromark already tokenizes both: `%%…%%` becomes an
 * `obsidianComment` node (value = raw inner text) and `<!-- … -->` becomes a
 * core `html` node (value = the whole comment). So marker detection is now node
 * adjacency — "the first marker token that starts at/after a link's end column
 * on the same line" — not a raw-line lookahead regex. Parsing an already-
 * tokenized value with string slicing is a transform on extracted data, not a
 * source re-scan.
 *
 * Adjacency is strict: a marker attaches to a link only when nothing but
 * whitespace separates them on the line. Trailing prose between a link and a
 * later comment (`[a](b) note <!-- x -->`) does not bind that comment.
 */

import type { Root } from "mdast";
import type { Position } from "unist";
import { visit } from "unist-util-visit";

export interface ExtractionMarker {
	fullMatch: string;
	innerText: string;
}

/** A marker token resolved to its source span on one line (0-based column). */
interface ExtractionMarkerSpan {
	startColumn: number;
	fullMatch: string;
	innerText: string;
}

/** Minimal shape of a value-bearing node (obsidianComment, html). */
interface ValueNode {
	type: string;
	value?: string;
	position?: Position;
}

/**
 * Collect extraction-marker spans from the parsed tree, bucketed by 1-based
 * start line and sorted left→right. Built once per file; each link then looks
 * up its line and asks for the first marker past its end column.
 */
export function collectExtractionMarkers(
	ast: Root,
	content: string,
): Map<number, ExtractionMarkerSpan[]> {
	const byLine = new Map<number, ExtractionMarkerSpan[]>();

	const rawOf = (node: ValueNode, fallback: string): string => {
		const start = node.position?.start.offset;
		const end = node.position?.end.offset;
		return start !== undefined && end !== undefined
			? content.slice(start, end)
			: fallback;
	};

	visit(ast, (node) => {
		const n = node as unknown as ValueNode;
		const startLine = n.position?.start.line;
		const startCol = n.position?.start.column;
		if (startLine === undefined || startCol === undefined) return;

		let fullMatch: string;
		let innerText: string;

		if (n.type === "obsidianComment") {
			const value = n.value ?? "";
			fullMatch = rawOf(n, `%%${value}%%`);
			innerText = value.trim();
		} else if (n.type === "html") {
			// Only HTML comments are extraction markers — other html (e.g. <br>) is not.
			const value = n.value ?? "";
			if (!value.startsWith("<!--") || !value.endsWith("-->")) return;
			fullMatch = value;
			innerText = value.slice(4, value.length - 3).trim();
		} else {
			return;
		}

		const span: ExtractionMarkerSpan = {
			startColumn: startCol - 1,
			fullMatch,
			innerText,
		};
		const bucket = byLine.get(startLine);
		if (bucket) bucket.push(span);
		else byLine.set(startLine, [span]);
	});

	for (const bucket of byLine.values()) {
		bucket.sort((a, b) => a.startColumn - b.startColumn);
	}
	return byLine;
}

/**
 * Find the extraction marker following a link on its line.
 *
 * A marker is attached only when the gap between the link's end and the
 * marker's start is whitespace-only. Any non-whitespace content in between
 * (e.g. `[a](b) trailing text <!-- note -->`) means the marker belongs to
 * something else later on the line, not this link.
 *
 * @param markersOnLine - Marker spans for the link's line (from collectExtractionMarkers)
 * @param linkEndColumn - 0-based column where the link ends
 * @param lineText - Raw source text of the link's line (to verify a whitespace-only gap)
 * @returns The first marker immediately following the link past a whitespace-only gap, or null
 */
export function detectExtractionMarker(
	markersOnLine: ExtractionMarkerSpan[] | undefined,
	linkEndColumn: number,
	lineText: string,
): ExtractionMarker | null {
	if (!markersOnLine) return null;
	for (const span of markersOnLine) {
		if (span.startColumn >= linkEndColumn) {
			// Only attach when nothing but whitespace separates the link from the
			// marker. Once a candidate fails, every later marker shares the same
			// non-whitespace prefix, so none qualify — return null immediately.
			const gap = lineText.slice(linkEndColumn, span.startColumn);
			return /^\s*$/.test(gap)
				? { fullMatch: span.fullMatch, innerText: span.innerText }
				: null;
		}
	}
	return null;
}
