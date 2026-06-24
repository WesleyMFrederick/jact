// Per D1/D3. Permissive Obsidian markdown links now come from the `obsidianLink`
// micromark token, not a line-by-line regex fallback. "What counts as a
// permissive link" lives in the extension's tokenizer; this module only parses
// the already-tokenized raw match `[label](dest#anchor)`.

import type { Root } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import type { Position } from "unist";
import { visit } from "unist-util-visit";
import type { FileCache } from "../../FileCache.js";
import type { LinkObject } from "../../types/citationTypes.js";
import { createLinkObject } from "./createLinkObject.js";
import { detectExtractionMarker } from "./detectExtractionMarker.js";
import {
	jactMdastExtensions,
	jactSyntaxExtension,
} from "./extensions/assemble.js";

/** Shape of the custom `obsidianLink` node (value = raw match `[label](dest)`). */
interface ObsidianLinkNode {
	type: "obsidianLink";
	value: string;
	position?: Position;
}

/**
 * Extract Obsidian permissive markdown links from the parsed mdast tree.
 *
 * Permissive links are produced by the `obsidianLink` micromark extension, a
 * `text` construct — so `[label](dest#anchor)` inside fenced code or inline code
 * is never tokenized and the prior hand-rolled fence/backtick guards are no
 * longer needed (D4). Covers all 3 sub-forms the regex fallback handled:
 *   - cross-doc `.md`: `[t](file.md#a b c)`
 *   - internal:        `[t](#a b c)`
 *   - relative no-`.md`: `[t](docs/x#a b)`
 *
 * Only the CommonMark-impossible subset (anchor with raw spaces) reaches here;
 * `%20`-encoded / paren-only links remain valid CommonMark and are extracted on
 * the core mdast path (D5).
 *
 * @param source - Full markdown file content (line text for marker detection)
 * @param sourceAbsolutePath - Absolute path to source file (for LinkObject construction)
 * @param fileCache - FileCache instance for path resolution
 * @param ast - Optional pre-parsed mdast Root for the same content. When omitted
 *   (standalone callers/tests) the content is parsed with the default jact
 *   extension set; production callers pass the shared tree to avoid re-parsing.
 * @returns Array of LinkObject instances with linkType="markdown"
 */
export function extractObsidianLinks(
	source: string,
	sourceAbsolutePath: string,
	fileCache: FileCache,
	ast?: Root,
): LinkObject[] {
	const lines = source.split("\n");
	const links: LinkObject[] = [];

	const tree =
		ast ??
		fromMarkdown(source, {
			extensions: [jactSyntaxExtension()],
			mdastExtensions: jactMdastExtensions(),
		});

	visit(tree, "obsidianLink", (node) => {
		const link = node as unknown as ObsidianLinkNode;

		// Parse the tokenized raw match `[label](dest)` by slicing — a string
		// transform on an extracted value, not a source re-scan.
		const raw = link.value;
		const labelEnd = raw.indexOf("](");
		if (labelEnd === -1) return;
		const text = raw.slice(1, labelEnd);
		// Strip the leading `](` and trailing `)`.
		const dest = raw.slice(labelEnd + 2, raw.length - 1);

		let rawPath: string | null;
		let anchor: string | null;
		const hashIndex = dest.indexOf("#");
		if (hashIndex !== -1) {
			const pathPart = dest.slice(0, hashIndex);
			rawPath = pathPart === "" ? null : pathPart;
			const anchorPart = dest.slice(hashIndex + 1);
			anchor = anchorPart === "" ? null : anchorPart;
		} else {
			rawPath = dest === "" ? null : dest;
			anchor = null;
		}
		const scope: "cross-document" | "internal" =
			rawPath !== null ? "cross-document" : "internal";

		const startColumn = (link.position?.start.column ?? 1) - 1;
		const lineNum = link.position?.start.line ?? 0;
		const lineText = lines[lineNum - 1] ?? "";

		links.push(
			createLinkObject({
				linkType: "markdown",
				scope,
				anchor,
				rawPath,
				sourceAbsolutePath,
				text: text === "" ? null : text,
				fullMatch: raw,
				line: lineNum,
				column: startColumn,
				extractionMarker: detectExtractionMarker(
					lineText,
					startColumn + raw.length,
				),
				fileCache,
			}),
		);
	});

	return links;
}
