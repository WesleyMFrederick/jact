import type { readFileSync } from "node:fs";
import type { Token } from "marked";
import { marked } from "marked";
import type { ParserOutput, LinkObject, HeadingObject, AnchorObject } from "../../types/citationTypes.js";
import { extractLinks } from "./extractLinks.js";
import { extractHeadings } from "./extractHeadings.js";
import { extractAnchors } from "./extractAnchors.js";
import { createLinkObject } from "./createLinkObject.js";

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

	/**
	 * Initialize parser with file system dependency
	 *
	 * @param fileSystem - Node.js fs module (or mock for testing)
	 */
	constructor(fileSystem: FileSystemInterface) {
		this.fs = fileSystem;
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

		return {
			filePath,
			content,
			tokens,
			links: this.extractLinks(content, filePath),
			headings,
			anchors: this.extractAnchors(content, headings),
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
		return extractLinks(content, sourcePath);
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
		return createLinkObject(params);
	}
}
