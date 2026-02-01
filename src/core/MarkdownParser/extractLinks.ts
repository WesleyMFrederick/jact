import type { Token, Tokens } from "marked";
import { marked } from "marked";
import type { LinkObject } from "../../types/citationTypes.js";
import { createLinkObject } from "./createLinkObject.js";
import { detectExtractionMarker } from "./detectExtractionMarker.js";

/**
 * Type guard for tokens with nested token arrays
 */
function hasNestedTokens(token: Token): token is Token & { tokens: Token[] } {
	return "tokens" in token && Array.isArray((token as { tokens?: unknown }).tokens);
}

/**
 * Type guard for link tokens from marked.js
 */
function isLinkToken(token: Token): token is Tokens.Link {
	return (
		token.type === "link" &&
		typeof (token as Tokens.Link).href === "string" &&
		typeof (token as Tokens.Link).text === "string" &&
		typeof (token as Tokens.Link).raw === "string"
	);
}

/**
 * Find line number and column for a raw match string in content lines.
 * Returns 1-based line, 0-based column.
 */
function findPosition(raw: string, lines: string[]): { line: number; column: number } {
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
 * Uses position-based matching (line + column) to prevent duplicate extraction
 * when the token parser and regex fallback extract the same link with different
 * anchor encodings (e.g., nested parens causing truncation in one extractor).
 */
function isDuplicateLink(
	candidate: { rawPath: string | null; anchor: string | null; line: number; column: number },
	existingLinks: LinkObject[]
): boolean {
	return existingLinks.some(
		l =>
			l.line === candidate.line &&
			l.column === candidate.column
	);
}

/**
 * Check if a position in a line is inside inline code (backticks).
 * Handles escaped backticks but not complex nesting scenarios.
 */
function isInsideInlineCode(line: string, position: number): boolean {
	let inCode = false;
	let i = 0;

	while (i < line.length && i < position) {
		const char = line[i];
		const prevChar = i > 0 ? line[i - 1] : "";

		// Check for unescaped backtick
		if (char === "`" && prevChar !== "\\") {
			inCode = !inCode;
		}
		i++;
	}

	return inCode;
}

/**
 * Build a set of line numbers that are inside code blocks.
 * Uses a state machine to track fenced code block boundaries.
 * Lines inside code blocks should be excluded from regex-based link extraction.
 */
function getCodeBlockLines(lines: string[]): Set<number> {
	const codeLines = new Set<number>();
	let inCodeBlock = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;

		// Check for fence markers (``` or ~~~)
		const trimmed = line.trim();
		if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
			if (inCodeBlock) {
				// Closing fence - add this line too
				codeLines.add(i + 1); // 1-based line number
				inCodeBlock = false;
			} else {
				// Opening fence
				codeLines.add(i + 1); // 1-based line number
				inCodeBlock = true;
			}
		} else if (inCodeBlock) {
			// We're inside a code block
			codeLines.add(i + 1); // 1-based line number
		}
	}

	return codeLines;
}

/**
 * Walk marked.js tokens recursively to extract standard markdown links.
 * Handles: [text](file.md#anchor), [text](#anchor), [text](path/to/file)
 */
function extractLinksFromTokens(
	tokens: Token[],
	lines: string[],
	sourceAbsolutePath: string,
	links: LinkObject[]
): void {
	const walkTokens = (tokenList: Token[]): void => {
		for (const token of tokenList) {
			// Skip code blocks and inline code spans - links inside are code examples, not citations
			if (token.type === "code" || token.type === "codespan") {
				continue;
			}

			if (isLinkToken(token)) {
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

				// Find line/column from raw match in content
				const { line: lineNum, column } = findPosition(raw, lines);

				// Use factory function to create link object
				const linkObject = createLinkObject({
					linkType: "markdown",
					scope,
					anchor,
					rawPath,
					sourceAbsolutePath,
					text,
					fullMatch: raw,
					line: lineNum,
					column,
					extractionMarker:
						lineNum > 0
							? detectExtractionMarker(
									lines[lineNum - 1] || "",
									column + raw.length
								)
							: null,
				});
				links.push(linkObject);
			}

			// Recurse into nested tokens
			if (hasNestedTokens(token)) {
				walkTokens(token.tokens);
			}
			// Also check items (list items have items property)
			if ("items" in token && Array.isArray((token as Tokens.List).items)) {
				for (const item of (token as Tokens.List).items) {
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
 * Regex fallback for markdown links with non-URL-encoded anchors.
 * CommonMark (marked.js) only recognizes URL-encoded anchors in links,
 * but Obsidian allows raw spaces/colons. This catches those edge cases.
 * Only extracts links NOT already extracted by token parser.
 */
function extractMarkdownLinksRegex(
	line: string,
	index: number,
	sourceAbsolutePath: string,
	links: LinkObject[]
): void {
	// Pattern for markdown links: [text](path#anchor)
	// Permissive anchor pattern allows spaces, colons, parens (supports 2 levels of nesting)
	const linkPattern = /\[([^\]]+)\]\(([^)#]+\.md)(?:#((?:[^()]|\((?:[^()]|\([^)]*\))*\))+))?\)/g;
	let match = linkPattern.exec(line);
	while (match !== null) {
		const text = match[1] ?? "";
		const rawPath = match[2] ?? "";
		const anchor = match[3] ?? null;
		const fullMatch = match[0];

		// Skip if inside inline code (backticks)
		if (isInsideInlineCode(line, match.index)) {
			match = linkPattern.exec(line);
			continue;
		}

		// Skip if already extracted by token parser using robust deduplication
		const alreadyExtracted = isDuplicateLink(
			{ rawPath, anchor, line: index + 1, column: match.index },
			links
		);
		if (!alreadyExtracted) {
			const linkObject = createLinkObject({
				linkType: "markdown",
				scope: "cross-document",
				anchor,
				rawPath,
				sourceAbsolutePath,
				text,
				fullMatch,
				line: index + 1,
				column: match.index,
				extractionMarker: detectExtractionMarker(
					line,
					match.index + fullMatch.length
				),
			});
			links.push(linkObject);
		}
		match = linkPattern.exec(line);
	}

	// Internal anchor links: [text](#anchor) with permissive anchor (supports 2 levels of nesting)
	const internalAnchorRegex = /\[([^\]]+)\]\(#((?:[^()]|\((?:[^()]|\([^)]*\))*\))+)\)/g;
	match = internalAnchorRegex.exec(line);
	while (match !== null) {
		const text = match[1] ?? "";
		const anchor = match[2] ?? "";
		const fullMatch = match[0];

		// Skip if inside inline code (backticks)
		if (isInsideInlineCode(line, match.index)) {
			match = internalAnchorRegex.exec(line);
			continue;
		}

		// Skip if already extracted using robust deduplication
		const alreadyExtracted = isDuplicateLink(
			{ rawPath: null, anchor, line: index + 1, column: match.index },
			links
		);
		if (!alreadyExtracted) {
			const linkObject = createLinkObject({
				linkType: "markdown",
				scope: "internal",
				anchor,
				rawPath: null,
				sourceAbsolutePath,
				text,
				fullMatch,
				line: index + 1,
				column: match.index,
				extractionMarker: detectExtractionMarker(
					line,
					match.index + fullMatch.length
				),
			});
			links.push(linkObject);
		}
		match = internalAnchorRegex.exec(line);
	}

	// Relative doc links without .md extension: [text](path/to/file#anchor)
	const relativeDocRegex = /\[([^\]]+)\]\(([^)]*\/[^)#]+)(?:#((?:[^()]|\((?:[^()]|\([^)]*\))*\))+))?\)/g;
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

			// Skip if inside inline code (backticks)
			if (!isInsideInlineCode(line, match.index)) {
				// Skip if already extracted using robust deduplication
				const alreadyExtracted = isDuplicateLink(
					{ rawPath, anchor, line: index + 1, column: match.index },
					links
				);
				if (!alreadyExtracted) {
					const linkObject = createLinkObject({
						linkType: "markdown",
						scope: "cross-document",
						anchor,
						rawPath,
						sourceAbsolutePath,
						text,
						fullMatch,
						line: index + 1,
						column: match.index,
						extractionMarker: detectExtractionMarker(
							line,
							match.index + fullMatch.length
						),
					});
					links.push(linkObject);
				}
			}
		}
		match = relativeDocRegex.exec(line);
	}
}

/**
 * Extract citation format links: [cite: path]
 * NOT in CommonMark — Obsidian specific
 */
function extractCiteLinks(
	line: string,
	index: number,
	sourceAbsolutePath: string,
	links: LinkObject[]
): void {
	const citePattern = /\[cite:\s*([^\]]+)\]/g;
	let match = citePattern.exec(line);
	while (match !== null) {
		// Skip if inside inline code (backticks)
		if (isInsideInlineCode(line, match.index)) {
			match = citePattern.exec(line);
			continue;
		}

		const rawPath = (match[1] ?? "").trim();
		const text = `cite: ${rawPath}`;

		const linkObject = createLinkObject({
			linkType: "markdown",
			scope: "cross-document",
			anchor: null,
			rawPath,
			sourceAbsolutePath,
			text,
			fullMatch: match[0],
			line: index + 1,
			column: match.index,
			extractionMarker: detectExtractionMarker(
				line,
				match.index + match[0].length
			),
		});
		links.push(linkObject);
		match = citePattern.exec(line);
	}
}

/**
 * Extract wiki-style cross-document links: [[file.md#anchor|text]]
 * NOT in CommonMark — Obsidian specific
 */
function extractWikiCrossDocLinks(
	line: string,
	index: number,
	sourceAbsolutePath: string,
	links: LinkObject[]
): void {
	const wikiCrossDocRegex = /\[\[([^#\]]+\.md)(#([^|]+?))?\|([^\]]+)\]\]/g;
	let match = wikiCrossDocRegex.exec(line);
	while (match !== null) {
		// Skip if inside inline code (backticks)
		if (isInsideInlineCode(line, match.index)) {
			match = wikiCrossDocRegex.exec(line);
			continue;
		}

		const rawPath = match[1] ?? "";
		const anchor = match[3] ?? null;
		const text = match[4] ?? "";

		const linkObject = createLinkObject({
			linkType: "wiki",
			scope: "cross-document",
			anchor,
			rawPath,
			sourceAbsolutePath,
			text,
			fullMatch: match[0],
			line: index + 1,
			column: match.index,
			extractionMarker: detectExtractionMarker(
				line,
				match.index + match[0].length
			),
		});
		links.push(linkObject);
		match = wikiCrossDocRegex.exec(line);
	}
}

/**
 * Extract wiki-style internal links: [[#anchor|text]]
 * NOT in CommonMark — Obsidian specific
 */
function extractWikiInternalLinks(
	line: string,
	index: number,
	sourceAbsolutePath: string,
	links: LinkObject[]
): void {
	const wikiRegex = /\[\[#([^|]+)\|([^\]]+)\]\]/g;
	let match = wikiRegex.exec(line);
	while (match !== null) {
		// Skip if inside inline code (backticks)
		if (isInsideInlineCode(line, match.index)) {
			match = wikiRegex.exec(line);
			continue;
		}

		const anchor = match[1] ?? "";
		const text = match[2] ?? "";

		const linkObject = createLinkObject({
			linkType: "wiki",
			scope: "internal",
			anchor,
			rawPath: null,
			sourceAbsolutePath,
			text,
			fullMatch: match[0],
			line: index + 1,
			column: match.index,
			extractionMarker: detectExtractionMarker(
				line,
				match.index + match[0].length
			),
		});
		links.push(linkObject);
		match = wikiRegex.exec(line);
	}
}

/**
 * Extract caret syntax references: ^anchor-id
 * NOT in CommonMark — Obsidian specific
 */
function extractCaretLinks(
	line: string,
	index: number,
	sourceAbsolutePath: string,
	links: LinkObject[]
): void {
	const caretRegex = /\^([A-Za-z0-9-]+)/g;
	let match = caretRegex.exec(line);
	while (match !== null) {
		// Skip if inside inline code (backticks)
		if (isInsideInlineCode(line, match.index)) {
			match = caretRegex.exec(line);
			continue;
		}

		const anchor = match[1] ?? "";

		// Skip semantic version patterns (^14.0.1, ^v1.2.3, etc)
		const afterMatch = line.substring(match.index + match[0].length);
		const isSemanticVersion = /^\.\d/.test(afterMatch);

		if (!isSemanticVersion) {
			const linkObject = createLinkObject({
				linkType: "markdown",
				scope: "internal",
				anchor,
				rawPath: null,
				sourceAbsolutePath,
				text: null,
				fullMatch: match[0],
				line: index + 1,
				column: match.index,
				extractionMarker: detectExtractionMarker(
					line,
					match.index + match[0].length
				),
			});
			links.push(linkObject);
		}
		match = caretRegex.exec(line);
	}
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
 * @param content - Full markdown file content
 * @param sourcePath - Absolute path to the source file being parsed
 * @returns Array of link objects with { linkType, scope, anchorType, source, target, text, fullMatch, line, column }
 */
export function extractLinks(content: string, sourcePath: string): LinkObject[] {
	const links: LinkObject[] = [];
	const lines = content.split("\n");
	const sourceAbsolutePath = sourcePath;

	// Phase 1: Token-based extraction for standard markdown links
	const tokens = marked.lexer(content);
	extractLinksFromTokens(tokens, lines, sourceAbsolutePath, links);

	// Build set of line numbers inside code blocks to skip in regex extraction
	const codeBlockLines = getCodeBlockLines(lines);

	// Phase 2: Regex extraction for patterns not in CommonMark or not caught by token parser
	lines.forEach((line, index) => {
		// Skip lines inside code blocks - they contain code examples, not real links
		const lineNumber = index + 1;
		if (codeBlockLines.has(lineNumber)) {
			return;
		}

		// Regex fallback for markdown links with non-URL-encoded anchors
		// (CommonMark only recognizes URL-encoded anchors, but Obsidian allows raw spaces/colons)
		extractMarkdownLinksRegex(line, index, sourceAbsolutePath, links);

		// Citation format: [cite: path] — NOT in CommonMark
		extractCiteLinks(line, index, sourceAbsolutePath, links);

		// Wiki-style cross-document links: [[file.md#anchor|text]] — NOT in CommonMark
		extractWikiCrossDocLinks(line, index, sourceAbsolutePath, links);

		// Wiki-style internal links: [[#anchor|text]] — NOT in CommonMark
		extractWikiInternalLinks(line, index, sourceAbsolutePath, links);

		// Caret syntax references: ^anchor-id — NOT in CommonMark
		extractCaretLinks(line, index, sourceAbsolutePath, links);
	});

	return links;
}
