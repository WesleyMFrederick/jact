/**
 * Purpose: Obsidian highlight syntax `==text==` as a micromark extension.
 * Responsibilities: Tokenize `==...==` and emit a `highlight` mdast node whose
 *   `value` is the raw inner text. Positions come free from micromark.
 * Boundary: Tokenization only — no path resolution or validation.
 */

import type { Extension as MdastExtension } from "mdast-util-from-markdown";
import { codes } from "micromark-util-symbol";
import type { Extension } from "micromark-util-types";
import {
	type WrappedInlineConfig,
	wrappedInlineFromMarkdown,
	wrappedInlineSyntax,
} from "./wrappedInline.js";

const HIGHLIGHT_CONFIG: WrappedInlineConfig = {
	markerCode: codes.equalsTo,
	runLength: 2,
	nodeType: "highlight",
	tokenName: "highlight",
	dataTokenName: "highlightData",
};

export const highlightSyntax: Extension = wrappedInlineSyntax(HIGHLIGHT_CONFIG);
export const highlightFromMarkdown: MdastExtension =
	wrappedInlineFromMarkdown(HIGHLIGHT_CONFIG);
