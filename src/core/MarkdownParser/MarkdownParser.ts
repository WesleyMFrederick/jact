import type { readFileSync } from "node:fs";
import type { Token } from "marked";
import { marked } from "marked";
import type { FileCache } from "../../FileCache.js";
import type {
	AnchorObject,
	HeadingObject,
	LinkObject,
	ParserOutput,
} from "../../types/citationTypes.js";
import { createLinkObject } from "./createLinkObject.js";
import { extractAnchors } from "./extractAnchors.js";
import { extractHeadings } from "./extractHeadings.js";
import { extractLinks } from "./extractLinks.js";

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
 * Parses markdown files using marked.js tokenization and extracts structured metadata:
 * - Links (markdown, wiki-style, citations, cross-document)
 * - Headings (all levels with raw text)
 * - Anchors (block references, header anchors, emphasis-marked)
 *
 * Supports multiple link formats:
 * - Standard markdown: [text](file.md#anchor)
 * - Citation format: [cite: path]
 * - Caret references: ^anchor-id
 * - Wiki-style (10 forms per D1 grammar in src/core/MarkdownParser/extractWikilinks.ts):
 *     1. [[Page]]
 *     2. [[Page|Display]]
 *     3. [[Page.md]]
 *     4. [[Page.md|Display]]
 *     5. [[Page#section]]
 *     6. [[Page#section|Display]]
 *     7. [[Page.md#section]]
 *     8. [[Page.md#section|Display]]
 *     9. [[#anchor]]
 *    10. [[#anchor|Display]]
 *
 * Anchor compatibility:
 * - Obsidian block references: ^anchor-id at end of line
 * - Standard header anchors with auto-generated IDs
 * - Explicit header IDs: ## Heading {#custom-id}
 * - Obsidian-style URL encoding (spaces to %20, drops colons)
 * - Emphasis-marked anchors: ==**text**==
 *
 * Architecture decision: Uses marked.lexer() for tokenization (same engine as extraction methods)
 * to ensure consistency between parsing and analysis. Token structure follows marked.js conventions
 * with { type, depth, text, raw, tokens? } properties.
 *
 * @example
 * const parser = new MarkdownParser(fs);
 * const result = await parser.parseFile('/path/to/file.md');
 * // Returns { filePath, content, tokens, links, headings, anchors }
 */
export class MarkdownParser {
	private fs: FileSystemInterface;
	private fileCache: FileCache;

	/**
	 * Initialize parser with file system and file cache dependencies
	 *
	 * @param fileSystem - Node.js fs module (or mock for testing)
	 * @param fileCache - FileCache instance for wiki page name resolution
	 */
	constructor(fileSystem: FileSystemInterface, fileCache: FileCache) {
		this.fs = fileSystem;
		this.fileCache = fileCache;
	}

	/** Replace the FileCache reference used for wiki resolution. Called by factories to share the scope-seeded cache. */
	setFileCache(fc: FileCache): void {
		this.fileCache = fc;
	}

	/**
	 * Parse markdown file and extract all metadata
	 *
	 * Main entry point for file parsing. Reads file, tokenizes with marked.lexer(),
	 * and extracts links, headings, and anchors. Passes source path to link
	 * extraction for relative path resolution.
	 *
	 * @param filePath - Absolute or relative path to markdown file
	 * @returns Object containing parsed markdown metadata including filePath, content, tokens, links, headings, and anchors
	 */
	async parseFile(filePath: string): Promise<ParserOutput> {
		const content = this.fs.readFileSync(filePath, "utf8");
		const tokens = marked.lexer(content);
		const headings = this.extractHeadings(tokens);

		// Single extractLinks call: surface BOTH links + unrecognized through ParserOutput.
		// Wired in P3 so CitationValidator can populate ValidationResult.unrecognized[]
		// and ValidationSummary.unrecognizedCount (closes P2 placeholder).
		const { links, unrecognized } = extractLinks(
			content,
			filePath,
			this.fileCache,
		);

		return {
			filePath,
			content,
			tokens,
			links,
			headings,
			anchors: this.extractAnchors(content, headings),
			unrecognized,
		};
	}

	/**
	 * Extract all link references from markdown content
	 *
	 * Uses token-first extraction for standard markdown links (via marked.lexer tokens),
	 * retaining regex ONLY for Obsidian-specific syntax not in CommonMark:
	 * - Token extraction: [text](file.md#anchor), [text](#anchor), [text](path/to/file)
	 * - Regex extraction: citation format, wiki-links, caret syntax
	 *
	 * @param content - Full markdown file content
	 * @param sourcePath - Absolute path to the source file being parsed
	 * @returns Array of link objects with { linkType, scope, anchorType, source, target, text, fullMatch, line, column }
	 */
	extractLinks(content: string, sourcePath: string): LinkObject[] {
		return extractLinks(content, sourcePath, this.fileCache).links;
	}

	/**
	 * Extract heading metadata from token tree
	 *
	 * @param tokens - Token array from marked.lexer()
	 * @returns Array of { level, text, raw } heading objects
	 */
	extractHeadings(tokens: Token[]): HeadingObject[] {
		return extractHeadings(tokens);
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
	 * @param headings - Optional heading objects from extractHeadings
	 * @returns Array of { anchorType, id, rawText, fullMatch, line, column } anchor objects
	 */
	extractAnchors(content: string, headings?: HeadingObject[]): AnchorObject[] {
		return extractAnchors(content, headings);
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
