/**
 * Purpose: Obsidian comment syntax `%%text%%` as a micromark extension.
 * Responsibilities: Tokenize `%%...%%` and emit an `obsidianComment` mdast node
 *   whose `value` is the raw inner text.
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

const COMMENT_CONFIG: WrappedInlineConfig = {
	markerCode: codes.percentSign,
	runLength: 2,
	nodeType: "obsidianComment",
	tokenName: "obsidianComment",
	dataTokenName: "obsidianCommentData",
};

export const obsidianCommentSyntax: Extension =
	wrappedInlineSyntax(COMMENT_CONFIG);
export const obsidianCommentFromMarkdown: MdastExtension =
	wrappedInlineFromMarkdown(COMMENT_CONFIG);
