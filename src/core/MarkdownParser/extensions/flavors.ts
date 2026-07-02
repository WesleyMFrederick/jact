/**
 * Purpose: Flavor Extension Collection — group jact's micromark/mdast extensions
 *   by markdown flavor so "what does jact parse?" is answered by one registry.
 * Responsibilities: Declare each flavor as a named, self-contained group of
 *   tokenizer triples (syntax + fromMarkdown). `assemble.ts` composes from
 *   `allFlavors`; adding a flavor = add a group here, nothing else.
 * Boundary: No tokenization logic — declaration only.
 *
 * Design: design-docs/features/20260701T161127-markdown-flavor-extension-collection/
 *   markdown-flavor-extension-collection-design.md
 */

import type { Extension as MdastExtension } from "mdast-util-from-markdown";
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

export interface FlavorExtensionGroup {
	flavor: "commonmark" | "obsidian";
	/** What this flavor adds, one line. */
	description: string;
	/** micromark syntax extensions (order-aligned with fromMarkdown). */
	syntax: Extension[];
	/** mdast builders, order-aligned with syntax. */
	fromMarkdown: MdastExtension[];
}

/**
 * CommonMark baseline — inline links `[t](u)`, reference links `[t][id]`,
 * autolinks `<url>`, ATX/setext headings, code spans/fences. Built into
 * micromark itself; this entry documents the baseline explicitly (see
 * design-docs/research/Markdown Link Flavors.md — GFM/GLFM/Extra/MMD/Pandoc
 * link syntax is CommonMark-compatible for jact's purposes).
 */
export const commonmarkFlavor: FlavorExtensionGroup = {
	flavor: "commonmark",
	description:
		"CommonMark core (links, headings, code) — provided by micromark itself, no extensions needed",
	syntax: [],
	fromMarkdown: [],
};

/**
 * Obsidian flavor — everything Obsidian adds on top of CommonMark that jact
 * must tokenize: `==highlight==`, `%%comment%%`, `[cite]` citation format,
 * `^caret-anchor`, `[[wikilink]]`, and permissive `[t](path with spaces)`
 * links (obsidianLink).
 */
export const obsidianFlavor: FlavorExtensionGroup = {
	flavor: "obsidian",
	description:
		"Obsidian additions: highlight, comment, citation, caret anchor, wikilink, permissive link",
	syntax: [
		highlightSyntax,
		obsidianCommentSyntax,
		citationSyntax,
		caretAnchorSyntax,
		wikilinkSyntax,
		obsidianLinkSyntax,
	],
	fromMarkdown: [
		highlightFromMarkdown,
		obsidianCommentFromMarkdown,
		citationFromMarkdown,
		caretAnchorFromMarkdown,
		wikilinkFromMarkdown,
		obsidianLinkFromMarkdown,
	],
};

/** Every flavor jact parses, in composition order. */
export const allFlavors: FlavorExtensionGroup[] = [
	commonmarkFlavor,
	obsidianFlavor,
];
