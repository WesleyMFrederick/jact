/**
 * Purpose: Register jact's custom micromark token names AND custom mdast node
 *   types so tokenizers and fromMarkdown handlers are type-safe without casts.
 * Responsibilities: Module augmentation only. No runtime code.
 * Boundary: Names here MUST match the `tokenName`/`dataTokenName`/`nodeType`
 *   used by the extensions under core/MarkdownParser/extensions/.
 */
import type { Literal } from "mdast";

declare module "micromark-util-types" {
	interface TokenTypeMap {
		highlight: "highlight";
		highlightData: "highlightData";
		obsidianComment: "obsidianComment";
		obsidianCommentData: "obsidianCommentData";
		citation: "citation";
		citationData: "citationData";
		caretAnchor: "caretAnchor";
		caretAnchorData: "caretAnchorData";
		wikilink: "wikilink";
		wikilinkData: "wikilinkData";
		obsidianLink: "obsidianLink";
		obsidianLinkData: "obsidianLinkData";
	}
}

declare module "mdast" {
	/** Obsidian highlight `==text==`; `value` is the raw inner text. */
	interface Highlight extends Literal {
		type: "highlight";
	}
	/** Obsidian comment `%%text%%`; `value` is the raw inner text. */
	interface ObsidianComment extends Literal {
		type: "obsidianComment";
	}
	/** jact citation `[cite: path]`; `value` is the trimmed path. */
	interface Citation extends Literal {
		type: "citation";
	}
	/** Obsidian block-reference anchor `^id`; `value` is the id. */
	interface CaretAnchor extends Literal {
		type: "caretAnchor";
	}
	/** Obsidian wikilink `[[target#anchor|alias]]`; `value` is the raw inner text. */
	interface Wikilink extends Literal {
		type: "wikilink";
	}
	/** Obsidian permissive markdown link `[label](dest#anchor)`; `value` is the raw match. */
	interface ObsidianLink extends Literal {
		type: "obsidianLink";
	}

	interface PhrasingContentMap {
		highlight: Highlight;
		obsidianComment: ObsidianComment;
		citation: Citation;
		caretAnchor: CaretAnchor;
		wikilink: Wikilink;
		obsidianLink: ObsidianLink;
	}

	interface RootContentMap {
		highlight: Highlight;
		obsidianComment: ObsidianComment;
		citation: Citation;
		caretAnchor: CaretAnchor;
		wikilink: Wikilink;
		obsidianLink: ObsidianLink;
	}
}
