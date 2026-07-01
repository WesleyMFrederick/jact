/**
 * Purpose: Assemble jact's micromark syntax + mdast extension sets so the parser
 *   (and factory) inject one combined unit.
 * Responsibilities: Combine the custom Obsidian-style syntax extensions via
 *   `combineExtensions`, and collect their fromMarkdown counterparts in matching
 *   order. Adding a new syntax = drop its triple (syntax + fromMarkdown + node
 *   type) and register it in both functions here.
 * Boundary: No tokenization logic here — only composition.
 */

import type { Extension as MdastExtension } from "mdast-util-from-markdown";
import { combineExtensions } from "micromark-util-combine-extensions";
import type { Extension } from "micromark-util-types";
import { caretAnchorFromMarkdown, caretAnchorSyntax } from "./caretAnchor.js";
import { citationFromMarkdown, citationSyntax } from "./citation.js";
import { highlightFromMarkdown, highlightSyntax } from "./highlight.js";
import {
	obsidianCommentFromMarkdown,
	obsidianCommentSyntax,
} from "./obsidianComment.js";
import {
	obsidianLinkFromMarkdown,
	obsidianLinkSyntax,
} from "./obsidianLink.js";
import { wikilinkFromMarkdown, wikilinkSyntax } from "./wikilink.js";

/** Combined micromark syntax extension for all jact Obsidian-style plugins. */
export function jactSyntaxExtension(): Extension {
	return combineExtensions([
		highlightSyntax,
		obsidianCommentSyntax,
		citationSyntax,
		caretAnchorSyntax,
		wikilinkSyntax,
		obsidianLinkSyntax,
	]);
}

/** fromMarkdown extensions for all jact Obsidian-style plugins (order-aligned). */
export function jactMdastExtensions(): MdastExtension[] {
	return [
		highlightFromMarkdown,
		obsidianCommentFromMarkdown,
		citationFromMarkdown,
		caretAnchorFromMarkdown,
		wikilinkFromMarkdown,
		obsidianLinkFromMarkdown,
	];
}
