import { dirname, isAbsolute, relative, resolve } from "node:path";
import { marked } from "marked";
import type { readFileSync } from "node:fs";
import type { LinkObject, ParserOutput } from "./types/citationTypes.js";

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

/**
 * File system interface for dependency injection.
 * Matches Node.js fs module subset used by MarkdownParser.
 */
interface FileSystemInterface {
	readFileSync: typeof readFileSync;
}

export class MarkdownParser {
	private fs: FileSystemInterface;
	private currentSourcePath: string | null;

	/**
	 * Initialize parser with file system dependency
	 *
	 * @param fileSystem - Node.js fs module (or mock for testing)
	 */
	constructor(fileSystem: FileSystemInterface) {
		this.fs = fileSystem;
		this.currentSourcePath = null;
	}

	/**
	 * Parse markdown file and extract all metadata
	 *
	 * Main entry point for file parsing. Reads file, tokenizes with marked.lexer(),
	 * and extracts links, headings, and anchors. Stores source path for relative
	 * link resolution during extraction.
	 *
	 * @param {string} filePath - Absolute or relative path to markdown file
	 * @returns {Promise<ParserOutput>} Object containing parsed markdown metadata including filePath, content, tokens, links, headings, and anchors
	 */
	async parseFile(filePath: string): Promise<ParserOutput> {
		this.currentSourcePath = filePath; // Store for use in extractLinks()
		const content = this.fs.readFileSync(filePath, "utf8");
		const tokens = marked.lexer(content);

		return {
			filePath,
			content,
			tokens,
			links: this.extractLinks(content),
			headings: this.extractHeadings(tokens),
			anchors: this.extractAnchors(content),
		};
	}

	/**
	 * Extract all link references from markdown content
	 *
	 * Detects and structures multiple link formats:
	 * - Cross-document markdown: [text](file.md#anchor)
	 * - Citation format: [cite: path]
	 * - Relative paths without extension: [text](path/to/file)
	 * - Wiki-style cross-document: [[file.md#anchor|text]]
	 * - Wiki-style internal: [[#anchor|text]]
	 * - Caret references: ^anchor-id
	 *
	 * For each link, resolves paths to absolute and relative forms using the
	 * current source file as reference. Determines anchor type (header vs block)
	 * and link scope (internal vs cross-document).
	 *
	 * @param {string} content - Full markdown file content
	 * @returns {Array<Object>} Array of link objects with { linkType, scope, anchorType, source, target, text, fullMatch, line, column }
	 */
	extractLinks(content: string): LinkObject[] {
		const links = [];
		const lines = content.split("\n");
		const sourceAbsolutePath = this.currentSourcePath;

		lines.forEach((line, index) => {
			// Cross-document markdown links with .md extension (with optional anchors)
			const linkPattern = /\[([^\]]+)\]\(([^)#]+\.md)(#([^)]+))?\)/g;
			let match = linkPattern.exec(line);
			while (match !== null) {
				const text = match[1];
				const rawPath = match[2];
				const anchor = match[4] || null;

				const linkType = "markdown";
				const scope = "cross-document";
				const anchorType = anchor ? this.determineAnchorType(anchor) : null;

				const absolutePath = this.resolvePath(rawPath, sourceAbsolutePath);
				const relativePath = absolutePath
					? relative(dirname(sourceAbsolutePath), absolutePath)
					: null;

				const linkObject = {
					linkType: linkType,
					scope: scope,
					anchorType: anchorType,
					source: {
						path: {
							absolute: sourceAbsolutePath,
						},
					},
					target: {
						path: {
							raw: rawPath,
							absolute: absolutePath,
							relative: relativePath,
						},
						anchor: anchor,
					},
					text: text,
					fullMatch: match[0],
					line: index + 1,
					column: match.index,
					extractionMarker: this._detectExtractionMarker(
						line,
						match.index + match[0].length,
					),
				};
				links.push(linkObject);
				match = linkPattern.exec(line);
			}

			// Citation format: [cite: path]
			const citePattern = /\[cite:\s*([^\]]+)\]/g;
			match = citePattern.exec(line);
			while (match !== null) {
				const rawPath = match[1].trim();
				const text = `cite: ${rawPath}`;

				const linkType = "markdown";
				const scope = "cross-document";
				const anchorType = null;

				const absolutePath = this.resolvePath(rawPath, sourceAbsolutePath);
				const relativePath = absolutePath
					? relative(dirname(sourceAbsolutePath), absolutePath)
					: null;

				const citeLinkObject = {
					linkType: linkType,
					scope: scope,
					anchorType: anchorType,
					source: {
						path: {
							absolute: sourceAbsolutePath,
						},
					},
					target: {
						path: {
							raw: rawPath,
							absolute: absolutePath,
							relative: relativePath,
						},
						anchor: null,
					},
					text: text,
					fullMatch: match[0],
					line: index + 1,
					column: match.index,
					extractionMarker: this._detectExtractionMarker(
						line,
						match.index + match[0].length,
					),
				};
				links.push(citeLinkObject);
				match = citePattern.exec(line);
			}

			// Cross-document links without .md extension (relative paths)
			const relativeDocRegex = /\[([^\]]+)\]\(([^)]*\/[^)#]+)(#[^)]+)?\)/g;
			match = relativeDocRegex.exec(line);
			while (match !== null) {
				const filepath = match[2];
				if (
					!filepath.endsWith(".md") &&
					!filepath.startsWith("http") &&
					filepath.includes("/")
				) {
					const text = match[1];
					const rawPath = match[2];
					const anchor = match[3] ? match[3].substring(1) : null;

					const linkType = "markdown";
					const scope = "cross-document";
					const anchorType = anchor ? this.determineAnchorType(anchor) : null;

					const absolutePath = this.resolvePath(rawPath, sourceAbsolutePath);
					const relativePath = absolutePath
						? relative(dirname(sourceAbsolutePath), absolutePath)
						: null;

					const relativeDocLinkObject = {
						linkType: linkType,
						scope: scope,
						anchorType: anchorType,
						source: {
							path: {
								absolute: sourceAbsolutePath,
							},
						},
						target: {
							path: {
								raw: rawPath,
								absolute: absolutePath,
								relative: relativePath,
							},
							anchor: anchor,
						},
						text: text,
						fullMatch: match[0],
						line: index + 1,
						column: match.index,
						extractionMarker: this._detectExtractionMarker(
							line,
							match.index + match[0].length,
						),
					};
					links.push(relativeDocLinkObject);
				}
				match = relativeDocRegex.exec(line);
			}

			// Wiki-style cross-document links: [[file.md#anchor|text]]
			const wikiCrossDocRegex = /\[\[([^#\]]+\.md)(#([^\]|]+))?\|([^\]]+)\]\]/g;
			match = wikiCrossDocRegex.exec(line);
			while (match !== null) {
				const rawPath = match[1];
				const anchor = match[3] || null;
				const text = match[4];

				const linkType = "wiki";
				const scope = "cross-document";
				const anchorType = anchor ? this.determineAnchorType(anchor) : null;

				const absolutePath = this.resolvePath(rawPath, sourceAbsolutePath);
				const relativePath = absolutePath
					? relative(dirname(sourceAbsolutePath), absolutePath)
					: null;

				const wikiCrossDocLinkObject = {
					linkType: linkType,
					scope: scope,
					anchorType: anchorType,
					source: {
						path: {
							absolute: sourceAbsolutePath,
						},
					},
					target: {
						path: {
							raw: rawPath,
							absolute: absolutePath,
							relative: relativePath,
						},
						anchor: anchor,
					},
					text: text,
					fullMatch: match[0],
					line: index + 1,
					column: match.index,
					extractionMarker: this._detectExtractionMarker(
						line,
						match.index + match[0].length,
					),
				};
				links.push(wikiCrossDocLinkObject);
				match = wikiCrossDocRegex.exec(line);
			}

			// Wiki-style links (internal anchors only)
			const wikiRegex = /\[\[#([^|]+)\|([^\]]+)\]\]/g;
			match = wikiRegex.exec(line);
			while (match !== null) {
				const anchor = match[1];
				const text = match[2];

				const linkType = "wiki";
				const scope = "internal";
				const anchorType = this.determineAnchorType(anchor);

				const wikiLinkObject = {
					linkType: linkType,
					scope: scope,
					anchorType: anchorType,
					source: {
						path: {
							absolute: sourceAbsolutePath,
						},
					},
					target: {
						path: {
							raw: null,
							absolute: null,
							relative: null,
						},
						anchor: anchor,
					},
					text: text,
					fullMatch: match[0],
					line: index + 1,
					column: match.index,
					extractionMarker: this._detectExtractionMarker(
						line,
						match.index + match[0].length,
					),
				};
				links.push(wikiLinkObject);
				match = wikiRegex.exec(line);
			}

			// Internal markdown anchor links: [text](#anchor)
			const internalAnchorRegex = /\[([^\]]+)\]\(#([^)]+)\)/g;
			match = internalAnchorRegex.exec(line);
			while (match !== null) {
				const text = match[1];
				const anchor = match[2];

				const linkType = "markdown";
				const scope = "internal";
				const anchorType = this.determineAnchorType(anchor);

				const internalAnchorLinkObject = {
					linkType: linkType,
					scope: scope,
					anchorType: anchorType,
					source: {
						path: {
							absolute: sourceAbsolutePath,
						},
					},
					target: {
						path: {
							raw: null,
							absolute: null,
							relative: null,
						},
						anchor: anchor,
					},
					text: text,
					fullMatch: match[0],
					line: index + 1,
					column: match.index,
					extractionMarker: this._detectExtractionMarker(
						line,
						match.index + match[0].length,
					),
				};
				links.push(internalAnchorLinkObject);
				match = internalAnchorRegex.exec(line);
			}

			// Caret syntax references (internal references)
			const caretRegex = /\^([A-Za-z0-9-]+)/g;
			match = caretRegex.exec(line);
			while (match !== null) {
				const anchor = match[1];

				const linkType = "markdown";
				const scope = "internal";
				const anchorType = "block";

				const caretLinkObject = {
					linkType: linkType,
					scope: scope,
					anchorType: anchorType,
					source: {
						path: {
							absolute: sourceAbsolutePath,
						},
					},
					target: {
						path: {
							raw: null,
							absolute: null,
							relative: null,
						},
						anchor: anchor,
					},
					text: null,
					fullMatch: match[0],
					line: index + 1,
					column: match.index,
					extractionMarker: this._detectExtractionMarker(
						line,
						match.index + match[0].length,
					),
				};
				links.push(caretLinkObject);
				match = caretRegex.exec(line);
			}
		});

		return links;
	}

	/**
	 * Detect extraction markers after link on same line.
	 * Supports %%marker%% and <!-- marker --> formats.
	 *
	 * @param {string} line - Full line containing the link
	 * @param {number} linkEndColumn - Column where link ends
	 * @returns {Object|null} { fullMatch, innerText } or null if no marker
	 */
	_detectExtractionMarker(line, linkEndColumn) {
		// Get text after link on same line
		const remainingLine = line.substring(linkEndColumn);

		// Pattern: %%text%% or <!-- text -->
		const markerPattern = /\s*(%%(.+?)%%|<!--\s*(.+?)\s*-->)/;
		const match = remainingLine.match(markerPattern);

		if (match) {
			return {
				fullMatch: match[1], // Full marker with delimiters
				innerText: (match[2] || match[3]).trim(), // Text between delimiters (trimmed)
			};
		}

		return null;
	}

	// Classify anchor as "block" (^prefix) or "header"
	determineAnchorType(anchorString) {
		if (!anchorString) return null;

		// Block references start with ^ or match ^alphanumeric pattern
		if (
			anchorString.startsWith("^") ||
			/^\^[a-zA-Z0-9\-_]+$/.test(anchorString)
		) {
			return "block";
		}

		// Everything else is a header reference
		return "header";
	}

	// Resolve relative paths to absolute using source file's directory
	resolvePath(rawPath, sourceAbsolutePath) {
		if (!rawPath || !sourceAbsolutePath) return null;

		if (isAbsolute(rawPath)) {
			return rawPath;
		}

		const sourceDir = dirname(sourceAbsolutePath);
		return resolve(sourceDir, rawPath);
	}

	/**
	 * Extract heading metadata from token tree
	 *
	 * Recursively walks token tree (using walkTokens-like pattern) to find all
	 * heading tokens. Preserves heading level, text, and raw markdown for later
	 * section extraction or anchor validation.
	 *
	 * @param {Array} tokens - Token array from marked.lexer()
	 * @returns {Array<Object>} Array of { level, text, raw } heading objects
	 */
	extractHeadings(tokens) {
		const headings = [];

		const extractFromTokens = (tokenList) => {
			for (const token of tokenList) {
				if (token.type === "heading") {
					headings.push({
						level: token.depth,
						text: token.text,
						raw: token.raw,
					});
				}

				// Recursively check nested tokens
				if (token.tokens) {
					extractFromTokens(token.tokens);
				}
			}
		};

		extractFromTokens(tokens);
		return headings;
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
	 * For headers, generates both:
	 * - Raw text anchor (exact heading text)
	 * - Obsidian-compatible anchor (URL-encoded with spaces as %20, colons removed)
	 *
	 * This dual anchor approach supports both standard markdown and Obsidian linking.
	 *
	 * @param {string} content - Full markdown file content
	 * @returns {Array<Object>} Array of { anchorType, id, rawText, fullMatch, line, column } anchor objects
	 */
	extractAnchors(content) {
		const anchors = [];
		const lines = content.split("\n");

		lines.forEach((line, index) => {
			// Obsidian block references (end-of-line format: ^anchor-name)
			let match;
			const obsidianBlockRegex = /\^([a-zA-Z0-9\-_]+)$/;
			const obsidianMatch = line.match(obsidianBlockRegex);
			if (obsidianMatch) {
				anchors.push({
					anchorType: "block",
					id: obsidianMatch[1],
					rawText: null,
					fullMatch: obsidianMatch[0],
					line: index + 1,
					column: line.lastIndexOf(obsidianMatch[0]),
				});
			}

			// Caret syntax anchors (legacy format, keep for compatibility)
			const caretRegex = /\^([A-Za-z0-9-]+)/g;
			match = caretRegex.exec(line);
			while (match !== null) {
				// Skip if this is already captured as an Obsidian block reference
				const isObsidianBlock = line.endsWith(match[0]);
				if (!isObsidianBlock) {
					anchors.push({
						anchorType: "block",
						id: match[1],
						rawText: null,
						fullMatch: match[0],
						line: index + 1,
						column: match.index,
					});
				}
				match = caretRegex.exec(line);
			}

			// Emphasis-marked anchors
			const emphasisRegex = /==\*\*([^*]+)\*\*==/g;
			match = emphasisRegex.exec(line);
			while (match !== null) {
				anchors.push({
					anchorType: "block",
					id: `==**${match[1]}**==`,
					rawText: match[1],
					fullMatch: match[0],
					line: index + 1,
					column: match.index,
				});
				match = emphasisRegex.exec(line);
			}

			// Standard header anchors with explicit IDs or auto-generated kebab-case
			const headerRegex = /^(#+)\s+(.+)$/;
			const headerMatch = line.match(headerRegex);
			if (headerMatch) {
				const headerText = headerMatch[2];

				// Check for explicit anchor ID like {#anchor-id}
				const explicitAnchorRegex = /^(.+?)\s*\{#([^}]+)\}$/;
				const explicitMatch = headerText.match(explicitAnchorRegex);

				if (explicitMatch) {
					// Use explicit anchor ID
					anchors.push({
						anchorType: "header",
						id: explicitMatch[2],
						rawText: explicitMatch[1].trim(),
						fullMatch: headerMatch[0],
						line: index + 1,
						column: 0,
					});
				} else {
					// Generate URL-encoded ID (Obsidian-compatible format)
					const urlEncodedId = headerText
						.replace(/:/g, "") // Remove colons
						.replace(/\s+/g, "%20"); // URL-encode spaces

					// Create single anchor with both ID variants
					anchors.push({
						anchorType: "header",
						id: headerText, // Raw text format
						urlEncodedId: urlEncodedId, // Always populated (even when identical to id)
						rawText: headerText,
						fullMatch: headerMatch[0],
						line: index + 1,
						column: 0,
					});
				}
			}
		});

		return anchors;
	}

	// Check if text contains markdown formatting (backticks, bold, italic, etc.)
	containsMarkdown(text) {
		// Check for common markdown patterns that would affect anchor generation
		const markdownPatterns = [
			/`[^`]+`/, // Backticks (code spans)
			/\*\*[^*]+\*\*/, // Bold text
			/\*[^*]+\*/, // Italic text
			/==([^=]+)==/, // Highlight markers
			/\[([^\]]+)\]\([^)]+\)/, // Links
		];

		return markdownPatterns.some((pattern) => pattern.test(text));
	}

	// Convert text to kebab-case (e.g., "Project Architecture" → "project-architecture")
	toKebabCase(text) {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, "") // Remove special chars except spaces and hyphens
			.replace(/\s+/g, "-") // Replace spaces with hyphens
			.replace(/-+/g, "-") // Replace multiple hyphens with single
			.replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
	}
}
