import type { Root } from "mdast";
import type { Position } from "unist";
import { visit } from "unist-util-visit";
import type { AnchorObject } from "../../types/citationTypes.js";
import { headingRaw, headingText } from "./extractHeadings.js";

/** Minimal shape of the custom value-bearing nodes (caretAnchor, highlight). */
interface PositionedNode {
	type: string;
	value?: string;
	position?: Position;
}

/** Append a node to a per-line bucket map. */
function pushByLine(
	map: Map<number, PositionedNode[]>,
	line: number,
	node: PositionedNode,
): void {
	const bucket = map.get(line);
	if (bucket) bucket.push(node);
	else map.set(line, [node]);
}

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

	// Block/caret/emphasis anchors now come from mdast tokens micromark already
	// produced (`caretAnchor`, `highlight`) instead of re-scanning raw lines.
	// Bucket the relevant nodes by 1-based start line so each line can emit in the
	// same order the prior regex passes did: end-of-line block ref, then the
	// caret run left-to-right, then emphasis-marked highlights.
	const caretByLine = new Map<number, PositionedNode[]>();
	const highlightByLine = new Map<number, PositionedNode[]>();
	visit(ast, (node) => {
		const positioned = node as unknown as PositionedNode;
		const startLine = positioned.position?.start.line;
		if (startLine === undefined) return;
		if (positioned.type === "caretAnchor") {
			pushByLine(caretByLine, startLine, positioned);
		} else if (positioned.type === "highlight") {
			pushByLine(highlightByLine, startLine, positioned);
		}
	});

	const startColumn = (node: PositionedNode): number =>
		(node.position?.start.column ?? 1) - 1;
	const endColumn = (node: PositionedNode): number =>
		(node.position?.end.column ?? 1) - 1;
	const rawOf = (node: PositionedNode): string => {
		const start = node.position?.start.offset;
		const end = node.position?.end.offset;
		return start !== undefined && end !== undefined
			? content.slice(start, end)
			: `^${node.value ?? ""}`;
	};

	lines.forEach((line, index) => {
		const lineNum = index + 1;
		const carets = (caretByLine.get(lineNum) ?? [])
			.slice()
			.sort((a, b) => startColumn(a) - startColumn(b));

		// Obsidian block reference: a caret-id token that runs to the end of the
		// line. Emitted first, mirroring the old end-of-line block pass.
		const eolNode = carets.find((node) => endColumn(node) === line.length);
		if (eolNode) {
			anchors.push({
				anchorType: "block",
				id: eolNode.value ?? "",
				rawText: null,
				fullMatch: rawOf(eolNode),
				line: lineNum,
				column: startColumn(eolNode),
			});
		}

		// Caret run (prior `/\^([A-Za-z0-9-]+)/g`): every other caret token on the
		// line, skipping the end-of-line one (already emitted) and semver suffixes
		// like `^14.0.1` (the token layer never treats `^14` as an anchor in context).
		for (const node of carets) {
			if (node === eolNode) continue;
			// Skip semver suffixes (`^14.0.1`): a `.` immediately followed by a
			// digit after the caret token. Char check, not a source re-scan.
			const after = line.substring(endColumn(node));
			if (
				after.length >= 2 &&
				after[0] === "." &&
				after[1] !== undefined &&
				after[1] >= "0" &&
				after[1] <= "9"
			)
				continue;
			anchors.push({
				anchorType: "block",
				id: node.value ?? "",
				rawText: null,
				fullMatch: rawOf(node),
				line: lineNum,
				column: startColumn(node),
			});
		}

		// Emphasis-marked anchors: only highlight tokens whose inner text is itself
		// a bold run. Classifying the already-tokenized value is a string transform,
		// not source re-tokenization.
		const highlights = (highlightByLine.get(lineNum) ?? [])
			.slice()
			.sort((a, b) => startColumn(a) - startColumn(b));
		for (const node of highlights) {
			const inner = /^\*\*([^*]+)\*\*$/.exec(node.value ?? "");
			if (!inner) continue;
			anchors.push({
				anchorType: "block",
				id: inner[1] ?? "",
				rawText: null,
				fullMatch: rawOf(node),
				line: lineNum,
				column: startColumn(node),
			});
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
			const urlEncodedId = explicitId.replace(/:/g, "").replace(/\s+/g, "%20");
			anchors.push({
				anchorType: "header",
				id: explicitId,
				urlEncodedId,
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
