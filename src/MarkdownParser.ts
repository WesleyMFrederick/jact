import type { readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { marked } from "marked";
import type { Token } from "marked";

/** Type guard for tokens with nested token arrays */
function hasNestedTokens(token: Token): token is Token & { tokens: Token[] } {
	return "tokens" in token && Array.isArray((token as { tokens?: unknown }).tokens);
}
import type {
	AnchorObject,
	HeadingObject,
	LinkObject,
	ParserOutput,
} from "./types/citationTypes.js";

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
	 * @param {string} filePath - Absolute or relative path to markdown file
	 * @returns {Promise<ParserOutput>} Object containing parsed markdown metadata including filePath, content, tokens, links, headings, and anchors
	 */
	async parseFile(filePath: string): Promise<ParserOutput> {
		const content = this.fs.readFileSync(filePath, "utf8");
		const tokens = marked.lexer(content);

		return {
			filePath,
			content,
			tokens,
			links: this.extractLinks(content, filePath),
			headings: this.extractHeadings(tokens),
			anchors: this.extractAnchors(content),
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
	 * For each link, resolves paths to absolute and relative forms using the
	 * source file path as reference. Determines anchor type (header vs block)
	 * and link scope (internal vs cross-document).
	 *
	 * @param {string} content - Full markdown file content
	 * @param {string} sourcePath - Absolute path to the source file being parsed
	 * @returns {Array<Object>} Array of link objects with { linkType, scope, anchorType, source, target, text, fullMatch, line, column }
	 */
	extractLinks(content: string, sourcePath: string): LinkObject[] {
		const links: LinkObject[] = [];
		const lines = content.split("\n");
		const sourceAbsolutePath = sourcePath;

		// Phase 1: Token-based extraction for standard markdown links
		const tokens = marked.lexer(content);
		this._extractLinksFromTokens(tokens, lines, sourceAbsolutePath, links);

		// Phase 2: Regex extraction for patterns not in CommonMark or not caught by token parser
		lines.forEach((line, index) => {
			// Regex fallback for markdown links with non-URL-encoded anchors
			// (CommonMark only recognizes URL-encoded anchors, but Obsidian allows raw spaces/colons)
			this._extractMarkdownLinksRegex(line, index, sourceAbsolutePath, links);

			// Citation format: [cite: path] — NOT in CommonMark
			this._extractCiteLinks(line, index, sourceAbsolutePath, links);

			// Wiki-style cross-document links: [[file.md#anchor|text]] — NOT in CommonMark
			this._extractWikiCrossDocLinks(line, index, sourceAbsolutePath, links);

			// Wiki-style internal links: [[#anchor|text]] — NOT in CommonMark
			this._extractWikiInternalLinks(line, index, sourceAbsolutePath, links);

			// Caret syntax references: ^anchor-id — NOT in CommonMark
			this._extractCaretLinks(line, index, sourceAbsolutePath, links);
		});

		return links;
	}

	/**
	 * Type guard for link tokens from marked.js
	 */
	private _isLinkToken(token: Token): token is Token & { href: string; text: string; raw: string } {
		return (
			token.type === "link" &&
			typeof (token as any).href === "string" &&
			typeof (token as any).text === "string" &&
			typeof (token as any).raw === "string"
		);
	}

	/**
	 * Walk marked.js tokens recursively to extract standard markdown links.
	 * Handles: [text](file.md#anchor), [text](#anchor), [text](path/to/file)
	 */
	private _extractLinksFromTokens(
		tokens: Token[],
		lines: string[],
		sourceAbsolutePath: string,
		links: LinkObject[]
	): void {
		const walkTokens = (tokenList: Token[]): void => {
			for (const token of tokenList) {
				if (this._isLinkToken(token)) {
					const href = token.href;
					const text = token.text;
					const raw = token.raw;

					// Skip external links (http/https)
					if (href.startsWith("http://") || href.startsWith("https://")) {
						// Recurse into children regardless
						if (hasNestedTokens(token)) {
							walkTokens(token.tokens);
						}
						continue;
					}

					// Determine scope and parse anchor
					const isInternal = href.startsWith("#");
					const scope = isInternal ? ("internal" as const) : ("cross-document" as const);

					let rawPath: string | null = null;
					let anchor: string | null = null;

					if (isInternal) {
						anchor = href.substring(1); // Remove leading #
					} else {
						const hashIndex = href.indexOf("#");
						if (hashIndex !== -1) {
							rawPath = href.substring(0, hashIndex);
							anchor = href.substring(hashIndex + 1);
						} else {
							rawPath = href;
						}
					}

					// Resolve paths for cross-document links
					const absolutePath = rawPath
						? this.resolvePath(rawPath, sourceAbsolutePath)
						: null;
					const relativePath = absolutePath && sourceAbsolutePath
						? relative(dirname(sourceAbsolutePath), absolutePath)
						: null;

					const anchorType = anchor ? this.determineAnchorType(anchor) : null;

					// Find line/column from raw match in content
					const { line: lineNum, column } = this._findPosition(raw, lines);

					const linkObject: LinkObject = {
						linkType: "markdown" as const,
						scope,
						anchorType,
						source: { path: { absolute: sourceAbsolutePath } },
						target: {
							path: {
								raw: rawPath,
								absolute: absolutePath,
								relative: relativePath,
							},
							anchor,
						},
						text,
						fullMatch: raw,
						line: lineNum,
						column,
						extractionMarker:
							lineNum > 0
								? this._detectExtractionMarker(
										lines[lineNum - 1] || "",
										column + raw.length
									)
								: null,
					};
					links.push(linkObject);
				}

				// Recurse into nested tokens
				if (hasNestedTokens(token)) {
					walkTokens(token.tokens);
				}
				// Also check items (list items have items property)
				if ("items" in token && Array.isArray((token as any).items)) {
					for (const item of (token as any).items) {
						if (hasNestedTokens(item)) {
							walkTokens(item.tokens);
						}
					}
				}
			}
		};
		walkTokens(tokens);
	}

	/**
	 * Find line number and column for a raw match string in content lines.
	 * Returns 1-based line, 0-based column.
	 */
	private _findPosition(raw: string, lines: string[]): { line: number; column: number } {
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line === undefined) continue;
			const col = line.indexOf(raw);
			if (col !== -1) {
				return { line: i + 1, column: col };
			}
		}
		return { line: 0, column: 0 };
	}

	/**
	 * Deduplication helper: check if a link was already extracted.
	 * Uses multi-property matching to handle variations in encoding/whitespace.
	 * Compares: rawPath, anchor, line, column (stricter than fullMatch alone)
	 */
	private _isDuplicateLink(
		candidate: { rawPath: string | null; anchor: string | null; line: number; column: number },
		existingLinks: LinkObject[]
	): boolean {
		return existingLinks.some(
			l =>
				l.target.path.raw === candidate.rawPath &&
				l.target.anchor === candidate.anchor &&
				l.line === candidate.line &&
				l.column === candidate.column
		);
	}

	/**
	 * Regex fallback for markdown links with non-URL-encoded anchors.
	 * CommonMark (marked.js) only recognizes URL-encoded anchors in links,
	 * but Obsidian allows raw spaces/colons. This catches those edge cases.
	 * Only extracts links NOT already extracted by token parser.
	 */
	private _extractMarkdownLinksRegex(
		line: string,
		index: number,
		sourceAbsolutePath: string,
		links: LinkObject[]
	): void {
		// Pattern for markdown links: [text](path#anchor)
		// Permissive anchor pattern allows spaces, colons, parens
		const linkPattern = /\[([^\]]+)\]\(([^)#]+\.md)(?:#((?:[^()]|\([^)]*\))+))?\)/g;
		let match = linkPattern.exec(line);
		while (match !== null) {
			const text = match[1] ?? "";
			const rawPath = match[2] ?? "";
			const anchor = match[3] ?? null;
			const fullMatch = match[0];

			// Skip if already extracted by token parser using robust deduplication
			const alreadyExtracted = this._isDuplicateLink(
				{ rawPath, anchor, line: index + 1, column: match.index },
				links
			);
			if (!alreadyExtracted) {
				const absolutePath = this.resolvePath(rawPath, sourceAbsolutePath ?? "");
				const relativePath =
					absolutePath && sourceAbsolutePath
						? relative(dirname(sourceAbsolutePath), absolutePath)
						: null;

				links.push({
					linkType: "markdown" as const,
					scope: "cross-document" as const,
					anchorType: anchor ? this.determineAnchorType(anchor) : null,
					source: { path: { absolute: sourceAbsolutePath } },
					target: {
						path: {
							raw: rawPath,
							absolute: absolutePath,
							relative: relativePath,
						},
						anchor,
					},
					text,
					fullMatch: fullMatch,
					line: index + 1,
					column: match.index,
					extractionMarker: this._detectExtractionMarker(
						line,
						match.index + fullMatch.length
					),
				});
			}
			match = linkPattern.exec(line);
		}

		// Internal anchor links: [text](#anchor) with permissive anchor
		const internalAnchorRegex = /\[([^\]]+)\]\(#((?:[^()]|\([^)]*\))+)\)/g;
		match = internalAnchorRegex.exec(line);
		while (match !== null) {
			const text = match[1] ?? "";
			const anchor = match[2] ?? "";
			const fullMatch = match[0];

			// Skip if already extracted using robust deduplication
			const alreadyExtracted = this._isDuplicateLink(
				{ rawPath: null, anchor, line: index + 1, column: match.index },
				links
			);
			if (!alreadyExtracted) {
				links.push({
					linkType: "markdown" as const,
					scope: "internal" as const,
					anchorType: this.determineAnchorType(anchor),
					source: { path: { absolute: sourceAbsolutePath ?? "" } },
					target: {
						path: { raw: null, absolute: null, relative: null },
						anchor,
					},
					text,
					fullMatch: fullMatch,
					line: index + 1,
					column: match.index,
					extractionMarker: this._detectExtractionMarker(
						line,
						match.index + fullMatch.length
					),
				});
			}
			match = internalAnchorRegex.exec(line);
		}

		// Relative doc links without .md extension: [text](path/to/file#anchor)
		const relativeDocRegex = /\[([^\]]+)\]\(([^)]*\/[^)#]+)(?:#((?:[^()]|\([^)]*\))+))?\)/g;
		match = relativeDocRegex.exec(line);
		while (match !== null) {
			const filepath = match[2] ?? "";
			if (
				filepath &&
				!filepath.endsWith(".md") &&
				!filepath.startsWith("http") &&
				filepath.includes("/")
			) {
				const text = match[1] ?? "";
				const rawPath = match[2] ?? "";
				const anchor = match[3] ?? null;
				const fullMatch = match[0];

				// Skip if already extracted using robust deduplication
				const alreadyExtracted = this._isDuplicateLink(
					{ rawPath, anchor, line: index + 1, column: match.index },
					links
				);
				if (!alreadyExtracted) {
					const absolutePath = this.resolvePath(rawPath, sourceAbsolutePath ?? "");
					const relativePath =
						absolutePath && sourceAbsolutePath
							? relative(dirname(sourceAbsolutePath), absolutePath)
							: null;

					links.push({
						linkType: "markdown" as const,
						scope: "cross-document" as const,
						anchorType: anchor ? this.determineAnchorType(anchor) : null,
						source: { path: { absolute: sourceAbsolutePath } },
						target: {
							path: {
								raw: rawPath,
								absolute: absolutePath,
								relative: relativePath,
							},
							anchor,
						},
						text,
						fullMatch: fullMatch,
						line: index + 1,
						column: match.index,
						extractionMarker: this._detectExtractionMarker(
							line,
							match.index + fullMatch.length
						),
					});
				}
			}
			match = relativeDocRegex.exec(line);
		}
	}

	/**
	 * Extract citation format links: [cite: path]
	 * NOT in CommonMark — Obsidian specific
	 */
	private _extractCiteLinks(
		line: string,
		index: number,
		sourceAbsolutePath: string,
		links: LinkObject[]
	): void {
		const citePattern = /\[cite:\s*([^\]]+)\]/g;
		let match = citePattern.exec(line);
		while (match !== null) {
			const rawPath = (match[1] ?? "").trim();
			const text = `cite: ${rawPath}`;

			const absolutePath = this.resolvePath(rawPath, sourceAbsolutePath ?? "");
			const relativePath =
				absolutePath && sourceAbsolutePath
					? relative(dirname(sourceAbsolutePath), absolutePath)
					: null;

			links.push({
				linkType: "markdown" as const,
				scope: "cross-document" as const,
				anchorType: null,
				source: { path: { absolute: sourceAbsolutePath } },
				target: {
					path: { raw: rawPath, absolute: absolutePath, relative: relativePath },
					anchor: null,
				},
				text: text,
				fullMatch: match[0],
				line: index + 1,
				column: match.index,
				extractionMarker: this._detectExtractionMarker(
					line,
					match.index + match[0].length
				),
			});
			match = citePattern.exec(line);
		}
	}

	/**
	 * Extract wiki-style cross-document links: [[file.md#anchor|text]]
	 * NOT in CommonMark — Obsidian specific
	 */
	private _extractWikiCrossDocLinks(
		line: string,
		index: number,
		sourceAbsolutePath: string,
		links: LinkObject[]
	): void {
		const wikiCrossDocRegex = /\[\[([^#\]]+\.md)(#([^|]+?))?\|([^\]]+)\]\]/g;
		let match = wikiCrossDocRegex.exec(line);
		while (match !== null) {
			const rawPath = match[1] ?? "";
			const anchor = match[3] ?? null;
			const text = match[4] ?? "";

			const absolutePath = this.resolvePath(rawPath, sourceAbsolutePath ?? "");
			const relativePath =
				absolutePath && sourceAbsolutePath
					? relative(dirname(sourceAbsolutePath), absolutePath)
					: null;

			links.push({
				linkType: "wiki" as const,
				scope: "cross-document" as const,
				anchorType: anchor ? this.determineAnchorType(anchor) : null,
				source: { path: { absolute: sourceAbsolutePath } },
				target: {
					path: {
						raw: rawPath,
						absolute: absolutePath,
						relative: relativePath,
					},
					anchor,
				},
				text,
				fullMatch: match[0],
				line: index + 1,
				column: match.index,
				extractionMarker: this._detectExtractionMarker(
					line,
					match.index + match[0].length
				),
			});
			match = wikiCrossDocRegex.exec(line);
		}
	}

	/**
	 * Extract wiki-style internal links: [[#anchor|text]]
	 * NOT in CommonMark — Obsidian specific
	 */
	private _extractWikiInternalLinks(
		line: string,
		index: number,
		sourceAbsolutePath: string,
		links: LinkObject[]
	): void {
		const wikiRegex = /\[\[#([^|]+)\|([^\]]+)\]\]/g;
		let match = wikiRegex.exec(line);
		while (match !== null) {
			const anchor = match[1] ?? "";
			const text = match[2] ?? "";

			links.push({
				linkType: "wiki" as const,
				scope: "internal" as const,
				anchorType: this.determineAnchorType(anchor),
				source: { path: { absolute: sourceAbsolutePath ?? "" } },
				target: {
					path: { raw: null, absolute: null, relative: null },
					anchor,
				},
				text,
				fullMatch: match[0],
				line: index + 1,
				column: match.index,
				extractionMarker: this._detectExtractionMarker(
					line,
					match.index + match[0].length
				),
			});
			match = wikiRegex.exec(line);
		}
	}

	/**
	 * Extract caret syntax references: ^anchor-id
	 * NOT in CommonMark — Obsidian specific
	 */
	private _extractCaretLinks(
		line: string,
		index: number,
		sourceAbsolutePath: string,
		links: LinkObject[]
	): void {
		const caretRegex = /\^([A-Za-z0-9-]+)/g;
		let match = caretRegex.exec(line);
		while (match !== null) {
			const anchor = match[1] ?? "";

			// Skip semantic version patterns (^14.0.1, ^v1.2.3, etc)
			const afterMatch = line.substring(match.index + match[0].length);
			const isSemanticVersion = /^\.\d/.test(afterMatch);

			if (!isSemanticVersion) {
				links.push({
					linkType: "markdown" as const,
					scope: "internal" as const,
					anchorType: "block" as const,
					source: { path: { absolute: sourceAbsolutePath ?? "" } },
					target: {
						path: { raw: null, absolute: null, relative: null },
						anchor,
					},
					text: null,
					fullMatch: match[0],
					line: index + 1,
					column: match.index,
					extractionMarker: this._detectExtractionMarker(
						line,
						match.index + match[0].length
					),
				});
			}
			match = caretRegex.exec(line);
		}
	}

	/**
	 * Detect extraction markers after link on same line.
	 * Supports %%marker%% and <!-- marker --> formats.
	 *
	 * @param {string} line - Full line containing the link
	 * @param {number} linkEndColumn - Column where link ends
	 * @returns {Object|null} { fullMatch, innerText } or null if no marker
	 */
	_detectExtractionMarker(line: string, linkEndColumn: number): { fullMatch: string; innerText: string } | null {
		// Get text after link on same line
		const remainingLine = line.substring(linkEndColumn);

		// Pattern: %%text%% or <!-- text -->
		const markerPattern = /\s*(%%(.+?)%%|<!--\s*(.+?)\s*-->)/;
		const match = remainingLine.match(markerPattern);

		if (match) {
			return {
				fullMatch: match[1] ?? "", // Full marker with delimiters
				innerText: (match[2] ?? match[3] ?? "").trim(), // Text between delimiters (trimmed)
			};
		}

		return null;
	}

	// Classify anchor as "block" (^prefix) or "header"
	determineAnchorType(anchorString: string): 'header' | 'block' | null {
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
	resolvePath(rawPath: string, sourceAbsolutePath: string): string | null {
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
	extractHeadings(tokens: Token[]): HeadingObject[] {
		const headings: HeadingObject[] = [];

		const extractFromTokens = (tokenList: Token[]): void => {
			for (const token of tokenList) {
				if (token.type === "heading") {
					headings.push({
						level: token.depth,
						text: token.text,
						raw: token.raw,
					});
				}

				// Recursively check nested tokens
				if (hasNestedTokens(token)) {
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
	extractAnchors(content: string): AnchorObject[] {
		const anchors: AnchorObject[] = [];
		const lines = content.split("\n");

		lines.forEach((line, index) => {
			// Obsidian block references (end-of-line format: ^anchor-name)
			let match;
			const obsidianBlockRegex = /\^([a-zA-Z0-9\-_]+)$/;
			const obsidianMatch = line.match(obsidianBlockRegex);
			if (obsidianMatch) {
				anchors.push({
					anchorType: "block",
					id: obsidianMatch[1] ?? "",
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

				// Skip semantic version patterns (^14.0.1, ^v1.2.3, etc)
				const afterMatch = line.substring(match.index + match[0].length);
				const isSemanticVersion = /^\.\d/.test(afterMatch);

				if (!isObsidianBlock && !isSemanticVersion) {
					anchors.push({
						anchorType: "block",
						id: match[1] ?? "",
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
				const emphasisText = match[1] ?? "";
				anchors.push({
					anchorType: "block",
					id: `==**${emphasisText}**==`,
					rawText: null, // Block anchors have null rawText per type contract
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
				const headerText = headerMatch[2] ?? "";

				// Check for explicit anchor ID like {#anchor-id}
				const explicitAnchorRegex = /^(.+?)\s*\{#([^}]+)\}$/;
				const explicitMatch = headerText.match(explicitAnchorRegex);

				if (explicitMatch) {
					// Use explicit anchor ID
					const explicitId = explicitMatch[2] ?? "";
					anchors.push({
						anchorType: "header",
						id: explicitId,
						urlEncodedId: explicitId, // Explicit IDs are already URL-safe
						rawText: (explicitMatch[1] ?? "").trim(),
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
	containsMarkdown(text: string): boolean {
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
	toKebabCase(text: string): string {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, "") // Remove special chars except spaces and hyphens
			.replace(/\s+/g, "-") // Replace spaces with hyphens
			.replace(/-+/g, "-") // Replace multiple hyphens with single
			.replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
	}
}
