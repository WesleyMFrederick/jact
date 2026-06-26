// Per D1/D2. Wikilinks now come from the `wikilink` micromark token, not a
// line-by-line WIKI_REGEX. "What counts as a wikilink" lives in the extension's
// tokenizer; this module only parses the already-tokenized inner text.

import type { Root } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import type { Position } from "unist";
import { visit } from "unist-util-visit";
import type { FileCache } from "../../FileCache.js";
import type { LinkObject } from "../../types/citationTypes.js";
import { createLinkObject } from "./createLinkObject.js";
import {
	collectExtractionMarkers,
	detectExtractionMarker,
} from "./detectExtractionMarker.js";
import {
	jactMdastExtensions,
	jactSyntaxExtension,
} from "./extensions/assemble.js";

/** Shape of the custom `wikilink` node (value = raw inner text, no `[[ ]]`). */
interface WikilinkNode {
	type: "wikilink";
	value: string;
	position?: Position;
}

/**
 * Extract all Obsidian wikilinks from the parsed mdast tree.
 *
 * Wikilinks are produced by the `wikilink` micromark extension, a `text`
 * construct — so `[[…]]` inside fenced code or inline code is never tokenized
 * and the prior hand-rolled fence/backtick guards are no longer needed (D4).
 * Emission only; resolution requires FileCache via createLinkObject.
 *
 * @param source - Full markdown file content (line text for marker detection)
 * @param sourceAbsolutePath - Absolute path to source file (for LinkObject construction)
 * @param fileCache - FileCache instance required for wiki page name resolution
 * @param ast - Optional pre-parsed mdast Root for the same content. When omitted
 *   (standalone callers/tests) the content is parsed with the default jact
 *   extension set; production callers pass the shared tree to avoid re-parsing.
 * @param sharedMarkers - Optional precomputed extraction-marker map for the same
 *   tree. When omitted the map is built here; production callers pass the shared
 *   map so the tree is not re-walked for markers.
 * @returns Array of LinkObject instances with linkType="wiki"
 */
export function extractWikilinks(
	source: string,
	sourceAbsolutePath: string,
	fileCache: FileCache,
	ast?: Root,
	sharedMarkers?: ReturnType<typeof collectExtractionMarkers>,
): LinkObject[] {
	const links: LinkObject[] = [];

	const tree =
		ast ??
		fromMarkdown(source, {
			extensions: [jactSyntaxExtension()],
			mdastExtensions: jactMdastExtensions(),
		});

	const markers = sharedMarkers ?? collectExtractionMarkers(tree, source);
	const lines = source.split(/\r?\n/);

	visit(tree, "wikilink", (node) => {
		const wiki = node as unknown as WikilinkNode;

		// Parse the tokenized inner text `page#anchor|alias` (every part optional)
		// by slicing — string transform on an extracted value, not a source re-scan.
		let rest = wiki.value;
		let displayGroup: string | null = null;
		const pipeIndex = rest.indexOf("|");
		if (pipeIndex !== -1) {
			const aliasText = rest.slice(pipeIndex + 1);
			displayGroup = aliasText === "" ? null : aliasText;
			rest = rest.slice(0, pipeIndex);
		}
		let anchor: string | null = null;
		const hashIndex = rest.indexOf("#");
		if (hashIndex !== -1) {
			const anchorText = rest.slice(hashIndex + 1);
			anchor = anchorText === "" ? null : anchorText;
			rest = rest.slice(0, hashIndex);
		}
		const rawPageName = rest === "" ? null : rest;
		const text = displayGroup ?? rawPageName;
		const scope: "cross-document" | "internal" =
			rawPageName !== null ? "cross-document" : "internal";

		const startColumn = (wiki.position?.start.column ?? 1) - 1;
		const lineNum = wiki.position?.start.line ?? 0;
		const startOffset = wiki.position?.start.offset;
		const endOffset = wiki.position?.end.offset;
		const fullMatch =
			startOffset !== undefined && endOffset !== undefined
				? source.slice(startOffset, endOffset)
				: `[[${wiki.value}]]`;

		links.push(
			createLinkObject({
				linkType: "wiki",
				scope,
				anchor,
				rawPath: rawPageName,
				sourceAbsolutePath,
				text,
				fullMatch,
				line: lineNum,
				column: startColumn,
				extractionMarker: detectExtractionMarker(
					markers.get(lineNum),
					startColumn + fullMatch.length,
					lines[lineNum - 1] ?? "",
				),
				fileCache,
			}),
		);
	});

	return links;
}
