import type { Root } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toString as mdastToString } from "mdast-util-to-string";
import type { Position } from "unist";
import { visit } from "unist-util-visit";
import type { FileCache } from "../../FileCache.js";
import type { LinkObject } from "../../types/citationTypes.js";
import { createLinkObject } from "./createLinkObject.js";
import {
	collectExtractionMarkers,
	detectExtractionMarker,
} from "./detectExtractionMarker.js";
import {
	jactMdastExtensions,
	jactSyntaxExtension,
} from "./extensions/assemble.js";
import { extractObsidianLinks } from "./extractObsidianLinks.js";
import { extractWikilinks } from "./extractWikilinks.js";

/** Per-line extraction-marker spans, keyed by 1-based line number. */
type ExtractionMarkerMap = ReturnType<typeof collectExtractionMarkers>;

/** Minimal shape of a value-bearing custom node (citation, caretAnchor). */
interface PositionedNode {
	type: string;
	value?: string;
	position?: Position;
}

/**
 * Walk the mdast tree to extract standard markdown links.
 * Handles: [text](file.md#anchor), [text](#anchor), [text](path/to/file).
 *
 * `unist-util-visit` descends only into nodes with children, so `link` nodes
 * inside `code`/`inlineCode` are naturally excluded (those nodes carry no link
 * children). Line/column come from `node.position` (D1) — micromark already
 * tracked the source span, so no `indexOf` re-find is needed.
 */
function extractLinksFromAst(
	ast: Root,
	content: string,
	lines: string[],
	markers: ExtractionMarkerMap,
	sourceAbsolutePath: string,
	links: LinkObject[],
	fileCache: FileCache,
): void {
	const handleHref = (
		rawHref: string,
		text: string | null,
		raw: string,
		position: Position | undefined,
	) => {
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

		// Line/column come from the node's source position (1-based line, 0-based column).
		const lineNum = position?.start.line ?? 0;
		const column = (position?.start.column ?? 1) - 1;

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
							markers.get(lineNum),
							column + raw.length,
							lines[lineNum - 1] ?? "",
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
		handleHref(node.url, text, sliceRaw(node, text), node.position);
	});

	// Link reference definitions: [label]: dest — micromark stores these as
	// `definition` nodes (marked previously produced resolved link tokens). The dest carries
	// the cross-document path (e.g. footnote definitions like `[^S-001]: path`).
	visit(ast, "definition", (node) => {
		handleHref(
			node.url,
			node.label ?? null,
			sliceRaw(node, node.url),
			node.position,
		);
	});
}

/**
 * Extract Obsidian-specific link forms from mdast tokens micromark already
 * produced (D4): `citation` (`[cite: path]`) and `caretAnchor` (`^id`).
 *
 * These constructs are `text` constructs, so they are never tokenized inside
 * fenced code, inline code, or wikilink spans — the prior hand-rolled fence /
 * backtick guards and the phantom `#^anchor`-inside-wikilink matches are gone
 * for free. Nodes are bucketed by 1-based start line and emitted per line as
 * citations (left→right) then carets (left→right), preserving the order of the
 * prior line-by-line regex passes.
 */
function extractCiteAndCaretLinks(
	ast: Root,
	content: string,
	lines: string[],
	markers: ExtractionMarkerMap,
	sourceAbsolutePath: string,
	links: LinkObject[],
	fileCache: FileCache,
): void {
	const citeByLine = new Map<number, PositionedNode[]>();
	const caretByLine = new Map<number, PositionedNode[]>();

	const pushByLine = (
		map: Map<number, PositionedNode[]>,
		line: number,
		node: PositionedNode,
	): void => {
		const bucket = map.get(line);
		if (bucket) bucket.push(node);
		else map.set(line, [node]);
	};

	visit(ast, (node) => {
		const positioned = node as unknown as PositionedNode;
		const startLine = positioned.position?.start.line;
		if (startLine === undefined) return;
		if (positioned.type === "citation") {
			pushByLine(citeByLine, startLine, positioned);
		} else if (positioned.type === "caretAnchor") {
			pushByLine(caretByLine, startLine, positioned);
		}
	});

	const startColumn = (node: PositionedNode): number =>
		(node.position?.start.column ?? 1) - 1;
	const endColumn = (node: PositionedNode): number =>
		(node.position?.end.column ?? 1) - 1;
	const rawOf = (node: PositionedNode, fallback: string): string => {
		const start = node.position?.start.offset;
		const end = node.position?.end.offset;
		return start !== undefined && end !== undefined
			? content.slice(start, end)
			: fallback;
	};

	lines.forEach((line, index) => {
		const lineNum = index + 1;

		// Citation format: [cite: path] — NOT in CommonMark.
		const cites = (citeByLine.get(lineNum) ?? [])
			.slice()
			.sort((a, b) => startColumn(a) - startColumn(b));
		for (const node of cites) {
			const rawPath = node.value ?? "";
			const raw = rawOf(node, `[cite: ${rawPath}]`);
			const column = startColumn(node);
			links.push(
				createLinkObject({
					linkType: "markdown",
					scope: "cross-document",
					anchor: null,
					rawPath,
					sourceAbsolutePath,
					text: `cite: ${rawPath}`,
					fullMatch: raw,
					line: lineNum,
					column,
					extractionMarker: detectExtractionMarker(
						markers.get(lineNum),
						column + raw.length,
						line,
					),
					fileCache,
				}),
			);
		}

		// Caret syntax references: ^anchor-id — NOT in CommonMark.
		const carets = (caretByLine.get(lineNum) ?? [])
			.slice()
			.sort((a, b) => startColumn(a) - startColumn(b));
		for (const node of carets) {
			// Skip semantic-version suffixes (`^14.0.1`): a `.` immediately followed
			// by a digit after the caret token. Char check, not a source re-scan.
			const after = line.substring(endColumn(node));
			if (
				after.length >= 2 &&
				after[0] === "." &&
				after[1] !== undefined &&
				after[1] >= "0" &&
				after[1] <= "9"
			)
				continue;

			const anchor = node.value ?? "";
			const raw = rawOf(node, `^${anchor}`);
			const column = startColumn(node);
			links.push(
				createLinkObject({
					linkType: "markdown",
					scope: "internal",
					anchor,
					rawPath: null,
					sourceAbsolutePath,
					text: null,
					fullMatch: raw,
					line: lineNum,
					column,
					extractionMarker: detectExtractionMarker(
						markers.get(lineNum),
						column + raw.length,
						line,
					),
					fileCache,
				}),
			);
		}
	});
}

/**
 * Extract all link references from markdown content
 *
 * Reads links from the mdast tree micromark already produced — no regex
 * re-extraction (WMF-35):
 * - Core mdast: [text](file.md#anchor), [text](#anchor), [text](path/to/file)
 * - `wikilink` tokens: [[...]] (all forms)
 * - `obsidianLink` tokens: permissive markdown links (raw spaces in anchor)
 * - `citation` tokens: [cite: path]
 * - `caretAnchor` tokens: ^anchor-id
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

	// Extraction markers (`%%…%%` / `<!-- … -->`) resolved from tokens once,
	// then looked up per link by line — node adjacency, not a raw-line lookahead.
	const markers = collectExtractionMarkers(tree, content);

	// Standard markdown links (core mdast: link + definition nodes).
	extractLinksFromAst(
		tree,
		content,
		lines,
		markers,
		sourceAbsolutePath,
		links,
		fileCache,
	);

	// Wiki-style links (all forms): [[...]] — read from `wikilink` tokens. The
	// shared marker map is passed through so the helper does not re-walk the tree.
	links.push(
		...extractWikilinks(content, sourceAbsolutePath, fileCache, tree, markers),
	);

	// Permissive Obsidian markdown links (raw spaces in anchor that CommonMark
	// rejects) — read from `obsidianLink` tokens. `%20`-encoded / paren-only
	// links remain valid CommonMark and are caught on the core mdast path above.
	// Shares the same precomputed marker map (no redundant tree walk).
	links.push(
		...extractObsidianLinks(
			content,
			sourceAbsolutePath,
			fileCache,
			tree,
			markers,
		),
	);

	// Obsidian citation + caret references — read from `citation` / `caretAnchor`
	// tokens. Token constructs already exclude code spans and wikilink interiors,
	// so no code-block / inline-code guards are needed.
	extractCiteAndCaretLinks(
		tree,
		content,
		lines,
		markers,
		sourceAbsolutePath,
		links,
		fileCache,
	);

	return links;
}
