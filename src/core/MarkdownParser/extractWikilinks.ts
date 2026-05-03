// Per D1. Single grammar function replaces extractWikiCrossDocLinks + extractWikiInternalLinks.
// One-invariant-one-place: "what counts as a wikilink" lives only here.
import type { FileCache } from "../../FileCache.js";
import type { LinkObject } from "../../types/citationTypes.js";
import { createLinkObject } from "./createLinkObject.js";
import { detectExtractionMarker } from "./detectExtractionMarker.js";
import { getFencedCodeBlockLineSet } from "./isInsideCodeBlock.js";
import { isInsideInlineCode } from "./isInsideInlineCode.js";

// Regex per [H-D1-regex] resolution — covers all 10 Obsidian wikilink forms:
//   [[Page]], [[Page|Display]], [[Page.md]], [[Page.md|Display]],
//   [[Page#section]], [[Page#section|Display]], [[Page.md#section]], [[Page.md#section|Display]],
//   [[#anchor]], [[#anchor|Display]]
// Group 1 (optional): page name — absent for [[#anchor]] internal forms
// Group 2 (optional): anchor/section after #
// Group 3 (optional): display text after | — defaults to raw page name when absent
const WIKI_REGEX = /\[\[([^|\]#]+)?(?:#([^|\]]+))?(?:\|([^\]]+))?\]\]/g;

/**
 * Extract all Obsidian wikilinks from a markdown source string.
 * Emission only — resolution requires FileCache via createLinkObject.
 *
 * @param source - Full markdown file content
 * @param sourceAbsolutePath - Absolute path of the source file (for LinkObject construction)
 * @param fileCache - FileCache instance required for wiki page name resolution
 * @returns Array of LinkObject instances with linkType="wiki"
 */
export function extractWikilinks(
	source: string,
	sourceAbsolutePath: string,
	fileCache: FileCache,
): LinkObject[] {
	const lines = source.split("\n");
	const links: LinkObject[] = [];
	const fencedLines = getFencedCodeBlockLineSet(source);

	lines.forEach((line, index) => {
		if (fencedLines.has(index)) return;
		WIKI_REGEX.lastIndex = 0;
		let match = WIKI_REGEX.exec(line);
		while (match !== null) {
			if (isInsideInlineCode(line, match.index)) {
				match = WIKI_REGEX.exec(line);
				continue;
			}

			const rawPageName = match[1] ?? null;
			const anchor = match[2] ?? null;
			const displayGroup = match[3] ?? null;
			const text = displayGroup ?? rawPageName;
			const scope: "cross-document" | "internal" =
				rawPageName !== null ? "cross-document" : "internal";

			links.push(
				createLinkObject({
					linkType: "wiki",
					scope,
					anchor,
					rawPath: rawPageName,
					sourceAbsolutePath,
					text,
					fullMatch: match[0],
					line: index + 1,
					column: match.index,
					extractionMarker: detectExtractionMarker(
						line,
						match.index + match[0].length,
					),
					fileCache,
				}),
			);
			match = WIKI_REGEX.exec(line);
		}
	});

	return links;
}
