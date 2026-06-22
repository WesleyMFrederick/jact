import type { Root } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toString as mdastToString } from "mdast-util-to-string";
import type { Position } from "unist";
import { visit } from "unist-util-visit";
import type { FileCache } from "../../FileCache.js";
import type { LinkObject } from "../../types/citationTypes.js";
import { createLinkObject } from "./createLinkObject.js";
import { detectExtractionMarker } from "./detectExtractionMarker.js";
import {
	jactMdastExtensions,
	jactSyntaxExtension,
} from "./extensions/assemble.js";
import { extractWikilinks } from "./extractWikilinks.js";
import { getFencedCodeBlockLineSet } from "./isInsideCodeBlock.js";
import { isInsideInlineCode } from "./isInsideInlineCode.js";

/**
 * Find line number and column for a raw match string in content lines.
 * Returns 1-based line, 0-based column.
 */
function findPosition(
	raw: string,
	lines: string[],
): { line: number; column: number } {
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
 * when the mdast extractor and regex fallback extract the same link with different
 * anchor encodings (e.g., nested parens causing truncation in one extractor).
 */
function isDuplicateLink(
	candidate: {
		rawPath: string | null;
		anchor: string | null;
		line: number;
		column: number;
	},
	existingLinks: LinkObject[],
): boolean {
	return existingLinks.some(
		(l) => l.line === candidate.line && l.column === candidate.column,
	);
}

/**
 * Walk the mdast tree to extract standard markdown links.
 * Handles: [text](file.md#anchor), [text](#anchor), [text](path/to/file).
 *
 * `unist-util-visit` descends only into nodes with children, so `link` nodes
 * inside `code`/`inlineCode` are naturally excluded (those nodes carry no link
 * children). Line/column come from `findPosition` to keep columns 0-based and
 * preserve dedup parity with the regex fallback below.
 */
function extractLinksFromAst(
	ast: Root,
	content: string,
	lines: string[],
	sourceAbsolutePath: string,
	links: LinkObject[],
	fileCache: FileCache,
): void {
	const handleHref = (rawHref: string, text: string | null, raw: string) => {
		// Strip surrounding backticks — footnote reference definitions like
		// `[^S-001]: `/path/file.md`` carry the dest wrapped in backticks.
		const href =
			rawHref.startsWith("`") && rawHref.endsWith("`")
				? rawHref.slice(1, -1)
				: rawHref;

		// Skip external and protocol links (http/https/vscode/mailto)
		if (
			href.startsWith("http://") ||
			href.startsWith("https://") ||
			href.startsWith("vscode://") ||
			href.startsWith("mailto:")
		) {
			return;
		}

		// Determine scope and parse anchor
		const isInternal = href.startsWith("#");
		const scope = isInternal
			? ("internal" as const)
			: ("cross-document" as const);

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
				// Strip trailing line-reference suffix from footnote paths before resolution.
				// Supports: ":17", ":17-36", ":L57", ":L57-L61", ":L57,L61", ":L57,L61,L65"
				rawPath = href.replace(/:L?\d+([,-]L?\d+)*$/, "");
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
							column + raw.length,
						)
					: null,
			fileCache,
		});
		links.push(linkObject);
	};

	const sliceRaw = (
		node: { position?: Position | undefined },
		fallback: string,
	): string => {
		const start = node.position?.start.offset;
		const end = node.position?.end.offset;
		return start !== undefined && end !== undefined
			? content.slice(start, end)
			: fallback;
	};

	// Inline links: [text](url)
	visit(ast, "link", (node) => {
		const text = mdastToString(node);
		handleHref(node.url, text, sliceRaw(node, text));
	});

	// Link reference definitions: [label]: dest — micromark stores these as
	// `definition` nodes (marked previously produced resolved link tokens). The dest carries
	// the cross-document path (e.g. footnote definitions like `[^S-001]: path`).
	visit(ast, "definition", (node) => {
		handleHref(node.url, node.label ?? null, sliceRaw(node, node.url));
	});
}

/**
 * Regex fallback for markdown links with non-URL-encoded anchors.
 * CommonMark (marked.js) only recognizes URL-encoded anchors in links,
 * but Obsidian allows raw spaces/colons. This catches those edge cases.
 * Only extracts links NOT already extracted by the mdast extractor.
 */
function extractMarkdownLinksRegex(
	line: string,
	index: number,
	sourceAbsolutePath: string,
	links: LinkObject[],
	fileCache: FileCache,
): void {
	// Pattern for markdown links: [text](path#anchor)
	// Permissive anchor pattern allows spaces, colons, parens (supports 2 levels of nesting)
	const linkPattern =
		/\[([^\]]+)\]\(([^)#]+\.md)(?:#((?:[^()]|\((?:[^()]|\([^)]*\))*\))+))?\)/g;
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

		// Skip if already extracted by the mdast extractor using robust deduplication
		const alreadyExtracted = isDuplicateLink(
			{ rawPath, anchor, line: index + 1, column: match.index },
			links,
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
					match.index + fullMatch.length,
				),
				fileCache,
			});
			links.push(linkObject);
		}
		match = linkPattern.exec(line);
	}

	// Internal anchor links: [text](#anchor) with permissive anchor (supports 2 levels of nesting)
	const internalAnchorRegex =
		/\[([^\]]+)\]\(#((?:[^()]|\((?:[^()]|\([^)]*\))*\))+)\)/g;
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
			links,
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
					match.index + fullMatch.length,
				),
				fileCache,
			});
			links.push(linkObject);
		}
		match = internalAnchorRegex.exec(line);
	}

	// Relative doc links without .md extension: [text](path/to/file#anchor)
	const relativeDocRegex =
		/\[([^\]]+)\]\(([^)]*\/[^)#]+)(?:#((?:[^()]|\((?:[^()]|\([^)]*\))*\))+))?\)/g;
	match = relativeDocRegex.exec(line);
	while (match !== null) {
		const filepath = match[2] ?? "";
		if (
			filepath &&
			!filepath.endsWith(".md") &&
			!filepath.startsWith("http") &&
			!filepath.startsWith("vscode://") &&
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
					links,
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
							match.index + fullMatch.length,
						),
						fileCache,
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
	links: LinkObject[],
	fileCache: FileCache,
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
				match.index + match[0].length,
			),
			fileCache,
		});
		links.push(linkObject);
		match = citePattern.exec(line);
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
	links: LinkObject[],
	fileCache: FileCache,
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
					match.index + match[0].length,
				),
				fileCache,
			});
			links.push(linkObject);
		}
		match = caretRegex.exec(line);
	}
}

/**
 * Extract all link references from markdown content
 *
 * Uses mdast-based extraction for standard markdown links (via fromMarkdown),
 * retaining regex ONLY for Obsidian-specific syntax not in CommonMark:
 * - mdast extraction: [text](file.md#anchor), [text](#anchor), [text](path/to/file)
 * - Regex extraction: citation format, wiki-links, caret syntax
 *
 * For each link, resolves paths to absolute and relative forms using the
 * source file path as reference. Determines anchor type (header vs block)
 * and link scope (internal vs cross-document).
 *
 * @param content - Full markdown file content
 * @param sourcePath - Absolute path to the source file being parsed
 * @param fileCache - FileCache for path resolution
 * @param ast - Optional pre-parsed mdast Root for the same content. When omitted
 *   (standalone callers/tests) the content is parsed with the default jact
 *   extension set; production callers pass the shared tree to avoid re-parsing.
 * @returns Array of link objects with { linkType, scope, anchorType, source, target, text, fullMatch, line, column }
 */
export function extractLinks(
	content: string,
	sourcePath: string,
	fileCache: FileCache,
	ast?: Root,
): LinkObject[] {
	const links: LinkObject[] = [];
	const lines = content.split("\n");
	const sourceAbsolutePath = sourcePath;

	const tree =
		ast ??
		fromMarkdown(content, {
			extensions: [jactSyntaxExtension()],
			mdastExtensions: jactMdastExtensions(),
		});

	// Phase 1: mdast-based extraction for standard markdown links
	extractLinksFromAst(
		tree,
		content,
		lines,
		sourceAbsolutePath,
		links,
		fileCache,
	);

	// 0-based line indices inside fenced code blocks. Single source of truth
	// shared with extractWikilinks (CommonMark §4.5 fence-type tracked).
	const codeBlockLines = getFencedCodeBlockLineSet(content);

	// Wiki-style links (all forms): [[...]] — NOT in CommonMark
	links.push(...extractWikilinks(content, sourceAbsolutePath, fileCache));

	// Phase 2: Regex extraction for patterns not in CommonMark or not caught by the mdast extractor
	lines.forEach((line, index) => {
		// Skip lines inside fenced code blocks - they contain code examples, not real links
		if (codeBlockLines.has(index)) {
			return;
		}

		// Regex fallback for markdown links with non-URL-encoded anchors
		// (CommonMark only recognizes URL-encoded anchors, but Obsidian allows raw spaces/colons)
		extractMarkdownLinksRegex(
			line,
			index,
			sourceAbsolutePath,
			links,
			fileCache,
		);

		// Citation format: [cite: path] — NOT in CommonMark
		extractCiteLinks(line, index, sourceAbsolutePath, links, fileCache);

		// Caret syntax references: ^anchor-id — NOT in CommonMark
		extractCaretLinks(line, index, sourceAbsolutePath, links, fileCache);
	});

	return links;
}
