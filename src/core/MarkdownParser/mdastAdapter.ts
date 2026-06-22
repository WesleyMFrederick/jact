/**
 * Purpose: Decode a parsed mdast Root into jact's ParserOutput fields
 *   (links, headings, anchors) in one pass — the parse-don't-validate boundary
 *   that produces fully-typed domain objects once, so consumers never touch mdast.
 * Responsibilities: Orchestrate the heading, link, and anchor extractors over a
 *   single already-parsed tree. Produce fully-typed domain objects once.
 * Boundary: Pure decode over a valid mdast Root — does not read the filesystem,
 *   does not throw; the caller guarantees `filePath` is resolvable.
 */
import type { Root } from "mdast";
import type { FileCache } from "../../FileCache.js";
import type {
	AnchorObject,
	HeadingObject,
	LinkObject,
} from "../../types/citationTypes.js";
import { extractAnchors } from "./extractAnchors.js";
import { extractHeadings } from "./extractHeadings.js";
import { extractLinks } from "./extractLinks.js";

/** The parsed, domain-typed portions of a ParserOutput (everything but ast/content/filePath). */
export interface AdaptedParserFields {
	links: LinkObject[];
	headings: HeadingObject[];
	anchors: AnchorObject[];
}

/**
 * Decode an mdast Root into ParserOutput's domain fields.
 *
 * @param ast - mdast Root produced by fromMarkdown over `content`
 * @param content - Full source content (for raw slicing + regex passes)
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
	const anchors = extractAnchors(content, headings);
	return { links, headings, anchors };
}
