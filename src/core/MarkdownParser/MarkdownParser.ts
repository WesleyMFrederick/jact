import type { readFileSync } from "node:fs";
import type { Root } from "mdast";
import type { Extension as MdastExtension } from "mdast-util-from-markdown";
import { fromMarkdown } from "mdast-util-from-markdown";
import type { Extension as MicromarkExtension } from "micromark-util-types";
import type { FileCache } from "../../FileCache.js";
import type {
	AnchorObject,
	HeadingObject,
	LinkObject,
	ParserOutput,
} from "../../types/citationTypes.js";
import { createLinkObject } from "./createLinkObject.js";
import {
	jactMdastExtensions,
	jactSyntaxExtension,
} from "./extensions/assemble.js";
import { extractAnchors } from "./extractAnchors.js";
import { extractHeadings } from "./extractHeadings.js";
import { extractLinks } from "./extractLinks.js";
import { adaptMdastToParserOutput } from "./mdastAdapter.js";

/**
 * File system interface for dependency injection.
 * Matches Node.js fs module subset used by MarkdownParser.
 */
interface FileSystemInterface {
	readFileSync: typeof readFileSync;
}

/**
 * Markdown parser with Obsidian-compatible link and anchor extraction
 *
 * Parses markdown files using micromark (mdast via fromMarkdown) and extracts structured metadata:
 * - Links (markdown, wiki-style, citations, cross-document)
 * - Headings (all levels with raw text)
 * - Anchors (block references, header anchors, emphasis-marked)
 *
 * Supports multiple link formats:
 * - Standard markdown: [text](file.md#anchor)
 * - Wiki-style: [[file.md#anchor|text]] or [[#anchor|text]]
 * - Citation format: [cite: path]
 * - Caret references: ^anchor-id
 *
 * Anchor compatibility:
 * - Obsidian block references: ^anchor-id at end of line
 * - Standard header anchors with auto-generated IDs
 * - Explicit header IDs: ## Heading {#custom-id}
 * - Obsidian-style URL encoding (spaces to %20, drops colons)
 * - Emphasis-marked anchors: ==**text**==
 *
 * Architecture decision: Uses micromark's fromMarkdown to produce an mdast Root, with a family
 * of jact-owned Obsidian-style syntax extensions (highlight, comment, citation, caret) combined
 * via combineExtensions and injected through the factory. Line/column come free from node.position.
 *
 * @example
 * const parser = new MarkdownParser(fs);
 * const result = await parser.parseFile('/path/to/file.md');
 * // Returns { filePath, content, ast, links, headings, anchors }
 */
export class MarkdownParser {
	private fs: FileSystemInterface;
	private fileCache: FileCache;
	private syntaxExtension: MicromarkExtension;
	private mdastExtensions: MdastExtension[];

	/**
	 * Initialize parser with file system and file cache dependencies
	 *
	 * @param fileSystem - Node.js fs module (or mock for testing)
	 * @param fileCache - FileCache instance for wiki page name resolution
	 * @param extensions - Optional micromark/mdast extension set (D-005). Defaults
	 *   to the assembled jact Obsidian-style plugin family.
	 */
	constructor(
		fileSystem: FileSystemInterface,
		fileCache: FileCache,
		extensions?: {
			syntax: MicromarkExtension;
			mdast: MdastExtension[];
		},
	) {
		this.fs = fileSystem;
		this.fileCache = fileCache;
		this.syntaxExtension = extensions?.syntax ?? jactSyntaxExtension();
		this.mdastExtensions = extensions?.mdast ?? jactMdastExtensions();
	}

	/** Parse markdown content into an mdast Root using the injected extensions. */
	private parse(content: string): Root {
		return fromMarkdown(content, {
			extensions: [this.syntaxExtension],
			mdastExtensions: this.mdastExtensions,
		});
	}

	/**
	 * Parse markdown file and extract all metadata
	 *
	 * Main entry point for file parsing. Reads file, parses to mdast with fromMarkdown,
	 * and extracts links, headings, and anchors. Passes source path to link
	 * extraction for relative path resolution.
	 *
	 * @param filePath - Absolute or relative path to markdown file
	 * @returns Object containing parsed markdown metadata including filePath, content, ast, links, headings, and anchors
	 */
	async parseFile(filePath: string): Promise<ParserOutput> {
		const content = this.fs.readFileSync(filePath, "utf8");
		return this.parseContent(content, filePath);
	}

	/**
	 * Parse markdown content (already in memory) into a ParserOutput.
	 *
	 * Same pipeline as parseFile without the filesystem read — useful for tests
	 * and callers that already hold the content string.
	 *
	 * @param content - Full markdown content
	 * @param filePath - Source path used for link resolution (defaults to "inline.md")
	 */
	parseContent(content: string, filePath = "inline.md"): ParserOutput {
		const ast = this.parse(content);
		const parsed = adaptMdastToParserOutput(
			ast,
			content,
			filePath,
			this.fileCache,
		);

		return {
			filePath,
			content,
			ast,
			...parsed,
		};
	}

	/**
	 * Extract all link references from markdown content
	 *
	 * Uses mdast-based extraction for standard markdown links (via fromMarkdown),
	 * retaining regex ONLY for Obsidian-specific syntax not in CommonMark:
	 * - mdast extraction: [text](file.md#anchor), [text](#anchor), [text](path/to/file)
	 * - Regex extraction: citation format, wiki-links, caret syntax
	 *
	 * @param content - Full markdown file content
	 * @param sourcePath - Absolute path to the source file being parsed
	 * @returns Array of link objects with { linkType, scope, anchorType, source, target, text, fullMatch, line, column }
	 */
	extractLinks(content: string, sourcePath: string): LinkObject[] {
		return extractLinks(
			content,
			sourcePath,
			this.fileCache,
			this.parse(content),
		);
	}

	/**
	 * Extract heading metadata from markdown content
	 *
	 * @param content - Full markdown file content
	 * @returns Array of { level, text, raw } heading objects
	 */
	extractHeadings(content: string): HeadingObject[] {
		return extractHeadings(this.parse(content), content);
	}

	/**
	 * Extract all anchor definitions from markdown content
	 *
	 * Detects multiple anchor types:
	 * - Obsidian block references: ^anchor-id at end of line
	 * - Caret syntax: ^anchor-id (legacy format, for compatibility)
	 * - Emphasis-marked: ==**text**==
	 * - Header anchors: Auto-generated from headings or explicit {#id}
	 *
	 * @param content - Full markdown file content
	 * @returns Array of { anchorType, id, rawText, fullMatch, line, column } anchor objects
	 */
	extractAnchors(content: string): AnchorObject[] {
		return extractAnchors(this.parse(content), content);
	}

	/**
	 * Factory function for creating LinkObject instances (for testing/public API)
	 * Single source of truth for link object construction.
	 * Handles path resolution, anchor type classification, and structure.
	 *
	 * @param params - Link parameters
	 * @returns Fully constructed LinkObject
	 */
	_createLinkObject(params: {
		linkType: "markdown" | "wiki";
		scope: "internal" | "cross-document";
		anchor: string | null;
		rawPath: string | null;
		sourceAbsolutePath: string;
		text: string | null;
		fullMatch: string;
		line: number;
		column: number;
		extractionMarker: { fullMatch: string; innerText: string } | null;
	}): LinkObject {
		return createLinkObject({ ...params, fileCache: this.fileCache });
	}
}
