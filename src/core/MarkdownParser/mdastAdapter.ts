/**
 * Purpose: Decode a parsed mdast Root into jact's ParserOutput fields
 *   (links, embeds, headings, anchors) — the parse-don't-validate boundary
 *   that produces fully-typed domain objects once, so consumers never touch mdast.
 * Responsibilities: Orchestrate extractors over a single already-parsed tree.
 *   Produce fully-typed domain objects once.
 * Boundary: Pure decode over a valid mdast Root — does not read the filesystem,
 *   does not throw; the caller guarantees `filePath` is resolvable.
 */
import type { Root } from "mdast";
import { visit } from "unist-util-visit";
import type { FileCache } from "../../FileCache.js";
import type {
	AnchorObject,
	EmbedReference,
	HeadingObject,
	LinkObject,
} from "../../types/citationTypes.js";
import { isValidationDisabled } from "../../validate/validation-disable.js";
import { extractAnchors } from "./extractAnchors.js";
import { extractHeadings } from "./extractHeadings.js";
import { extractLinks } from "./extractLinks.js";

/** The parsed, domain-typed portions of a ParserOutput (everything but ast/content/filePath). */
export interface AdaptedParserFields {
	links: LinkObject[];
	embeds: EmbedReference[];
	headings: HeadingObject[];
	anchors: AnchorObject[];
	validationDisabled: boolean;
}

/**
 * Decode an mdast Root into ParserOutput's domain fields.
 *
 * @param ast - mdast Root produced by fromMarkdown over `content`
 * @param content - Full source content for raw slicing
 * @param filePath - Source file path (link resolution reference)
 * @param fileCache - FileCache for path resolution
 */
export function adaptMdastToParserOutput(
	ast: Root,
	content: string,
	filePath: string,
	fileCache: FileCache,
): AdaptedParserFields {
	const headings = extractHeadings(ast, content);
	const links = extractLinks(content, filePath, fileCache, ast);
	const anchors = extractAnchors(ast, content);
	const embeds: EmbedReference[] = [];
	visit(ast, ["image", "obsidianEmbed"], (node) => {
		if (node.type === "image") {
			embeds.push({
				kind: "markdown",
				target: node.url,
				line: node.position?.start.line ?? 0,
			});
		} else if (node.type === "obsidianEmbed") {
			// Split only the token's value, never decoded document text.
			const target = node.value.split(/[|#^]/, 1)[0] ?? "";
			embeds.push({
				kind: "wiki",
				target,
				line: node.position?.start.line ?? 0,
			});
		}
	});
	const validationDisabled = isValidationDisabled(ast);
	return { links, embeds, headings, anchors, validationDisabled };
}
