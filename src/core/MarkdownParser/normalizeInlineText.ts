/**
 * Purpose: Tokenizer-backed markdown stripping for text fragments.
 * Responsibilities: `stripInlineMarkdown` parses a fragment with jact's flavor
 *   extensions and re-reads plain text from the tree — replacing chained-regex
 *   stripping (which breaks on context, e.g. `` `**not bold**` `` keeps its
 *   asterisks here because code-span content is literal).
 * Boundary: Formatting removal only — domain normalization (colon→space,
 *   bracket strips, whitespace collapse) stays with the caller.
 */

import { fromMarkdown } from "mdast-util-from-markdown";
import {
	jactMdastExtensions,
	jactSyntaxExtension,
} from "./extensions/assemble.js";

interface InlineNode {
	type: string;
	value?: string;
	children?: InlineNode[];
}

/**
 * Strip markdown formatting from a text fragment by tokenizing it and
 * concatenating the plain text the tree holds.
 *
 * - `**bold**` / `*italic*` → children text
 * - `` `code` `` → literal value (content survives untouched)
 * - `==highlight==` → inner text (recursively stripped: `==**x**==` → `x`)
 * - `[text](url)` → link label text
 *
 * Note: the fragment is parsed as a document, so a leading `#` reads as a
 * heading marker and is dropped — callers pass anchor/heading *text*, which
 * carries no marker.
 */
export function stripInlineMarkdown(text: string): string {
	if (!text) return "";
	const tree = fromMarkdown(text, {
		extensions: [jactSyntaxExtension()],
		mdastExtensions: jactMdastExtensions(),
	}) as unknown as InlineNode;
	return collectPlainText(tree).trim();
}

function collectPlainText(node: InlineNode): string {
	switch (node.type) {
		case "text":
		case "inlineCode":
			return node.value ?? "";
		case "highlight":
			// Raw inner text may itself carry markdown (`==**text**==`).
			return stripInlineMarkdown(node.value ?? "");
		default:
			if (node.children) {
				return node.children.map(collectPlainText).join("");
			}
			return node.value ?? "";
	}
}

/**
 * Options for `normalizeAnchorText`. Each call site historically applied a
 * slightly different set of domain-specific character strips (colon
 * handling, Obsidian wiki-link markers, whitespace collapse width). Rather
 * than unify those into one behavior (which would flip existing matching
 * results), each option below defaults to a no-op so a call site opts in to
 * exactly the strips it previously performed inline.
 */
export interface NormalizeAnchorTextOptions {
	/** Run `stripInlineMarkdown` first. Default true. */
	stripMarkdown?: boolean;
	/** How to handle `:` — remove entirely, replace with a space, or leave. Default "keep". */
	colons?: "strip" | "space" | "keep";
	/** Remove `#` (heading marker leftovers). Default false. */
	removeHash?: boolean;
	/** Remove `|` (wiki-link alias separator). Default false. */
	removePipe?: boolean;
	/** Remove `^` (block-ref marker). Default false. */
	removeCaret?: boolean;
	/** Remove `%%` (Obsidian comment markers). Default false. */
	removeCommentMarkers?: boolean;
	/** Remove `[[` and `]]` (wiki-link brackets). Default false. */
	removeWikiBrackets?: boolean;
	/** Remove `\` (escaped-character backslash). Default false. */
	removeBackslash?: boolean;
	/** Remove `[` and `]` (plain brackets). Default false. */
	removeBrackets?: boolean;
	/**
	 * Whitespace-collapse pattern applied last, before trim. Default
	 * `/\s+/g` (any run of whitespace → one space). `AnchorMatcher` passes
	 * `/ {2,}/g` to preserve its original narrower behavior (only 2+
	 * consecutive literal spaces collapse).
	 */
	whitespacePattern?: RegExp;
}

/**
 * Domain-level anchor/heading text normalization, shared by the anchor
 * matching and comparison call sites that previously duplicated this logic
 * inline. Runs `stripInlineMarkdown` (formatting removal) first, then
 * applies the domain-specific strips selected via `options`.
 *
 * Behavior preservation over unification: options default to a no-op so
 * existing call sites can reproduce their exact prior character set. See
 * call sites in `AnchorMatcher.cleanMarkdownForComparison`,
 * `ParsedDocument.hasAnchor`, and `ParsedDocument._normalizeObsidianHeading`.
 */
export function normalizeAnchorText(
	text: string,
	options: NormalizeAnchorTextOptions = {},
): string {
	if (!text) return "";
	const {
		stripMarkdown = true,
		colons = "keep",
		removeHash = false,
		removePipe = false,
		removeCaret = false,
		removeCommentMarkers = false,
		removeWikiBrackets = false,
		removeBackslash = false,
		removeBrackets = false,
		whitespacePattern = /\s+/g,
	} = options;

	let result = stripMarkdown ? stripInlineMarkdown(text) : text;

	if (colons === "strip") result = result.replace(/:/g, "");
	else if (colons === "space") result = result.replace(/:/g, " ");

	if (removeHash) result = result.replace(/#/g, "");
	if (removePipe) result = result.replace(/\|/g, "");
	if (removeCaret) result = result.replace(/\^/g, "");
	if (removeCommentMarkers) result = result.replace(/%%/g, "");
	if (removeWikiBrackets)
		result = result.replace(/\[\[/g, "").replace(/\]\]/g, "");
	if (removeBackslash) result = result.replace(/\\/g, "");
	if (removeBrackets) result = result.replace(/[[\]]/g, "");

	return result.replace(whitespacePattern, " ").trim();
}
