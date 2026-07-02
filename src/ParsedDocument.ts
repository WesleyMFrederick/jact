import type { Heading } from "mdast";
import { visit } from "unist-util-visit";
import { headingText as getHeadingText } from "./core/MarkdownParser/extractHeadings.js";
import { normalizeAnchorText } from "./core/MarkdownParser/normalizeInlineText.js";
import type { LinkObject, ParserOutput } from "./types/citationTypes.js";
import { levenshteinDistance } from "./utils/stringDistance.js";

/**
 * Facade providing stable query interface over MarkdownParser.Output.DataContract
 *
 * Encapsulates parser output complexity and provides high-level query methods
 * for anchor validation, fuzzy matching, and content extraction. Isolates
 * consumers from internal schema changes through lazy-loaded caches and
 * stable public interface.
 *
 * @class ParsedDocument
 */
class ParsedDocument {
	private _data: ParserOutput;
	private _cachedAnchorIds: string[] | null;

	/**
	 * Create a ParsedDocument facade wrapping parser output
	 * @param parserOutput - MarkdownParser.Output.DataContract with filePath, content, ast, links, headings, anchors
	 */
	constructor(parserOutput: ParserOutput) {
		// Store parser output privately for encapsulation
		this._data = parserOutput;

		// Initialize lazy-load cache for performance
		this._cachedAnchorIds = null;
	}

	/**
	 * Get internal parser output data
	 * Used by CitationValidator for direct data access
	 */
	get data(): ParserOutput {
		return this._data;
	}

	// === PUBLIC QUERY METHODS ===

	/**
	 * Check if anchor exists in document
	 *
	 * Checks both id and urlEncodedId properties to handle all anchor formats.
	 * Also handles URL-decoded comparisons for Obsidian anchors with stripped characters (colons, etc).
	 *
	 * @param anchorId - Anchor ID to check (either id or urlEncodedId format)
	 * @returns True if anchor exists in document
	 */
	hasAnchor(anchorId: string): boolean {
		// Try decoding the input anchor for comparison
		let decodedAnchorId: string;
		try {
			decodedAnchorId = decodeURIComponent(anchorId);
		} catch {
			decodedAnchorId = anchorId;
		}

		return this._data.anchors.some((a) => {
			// Direct match on id
			if (a.id === anchorId) return true;

			// Match on urlEncodedId (header anchors only)
			if (a.anchorType === "header" && a.urlEncodedId === anchorId) return true;

			// Decoded comparison: strip Obsidian-invalid chars from id and compare
			if (a.anchorType === "header") {
				// Decode the urlEncodedId for comparison
				let decodedUrlEncodedId: string;
				try {
					decodedUrlEncodedId = decodeURIComponent(a.urlEncodedId);
				} catch {
					decodedUrlEncodedId = a.urlEncodedId;
				}
				if (decodedUrlEncodedId === decodedAnchorId) return true;

				// Also try: strip colons from id and compare to decoded anchor
				// stripMarkdown: false — a.id/decodedAnchorId are already-resolved
				// anchor ids, not markdown text; running the tokenizer over them
				// would risk misreading literal `_`/`*` characters as formatting.
				const idWithoutColons = normalizeAnchorText(a.id, {
					stripMarkdown: false,
					colons: "strip",
				});
				const decodedWithoutColons = normalizeAnchorText(decodedAnchorId, {
					stripMarkdown: false,
					colons: "strip",
				});
				if (idWithoutColons === decodedWithoutColons) return true;
			}

			return false;
		});
	}

	/**
	 * Find anchors similar to given anchor ID
	 *
	 * Uses fuzzy matching (Levenshtein distance) to find similar anchor IDs
	 * for suggestion generation. Returns top 5 matches sorted by similarity score.
	 *
	 * @param anchorId - Anchor ID to find similar matches for
	 * @returns Array of similar anchor IDs sorted by similarity score (max 5)
	 */
	findSimilarAnchors(anchorId: string): string[] {
		// Get all anchor IDs (lazy-loaded from cache)
		const allIds = this._getAnchorIds();

		// Perform fuzzy matching and return top 5 results
		return this._fuzzyMatch(anchorId, allIds);
	}

	/**
	 * Get all links in the document
	 * @returns Array of all link objects from parser output
	 */
	getLinks(): LinkObject[] {
		// Return links array from parser output
		return this._data.links;
	}

	/**
	 * Get all anchor IDs in the document
	 *
	 * Returns unique set of anchor IDs including both id and urlEncodedId variants.
	 * Results are lazy-loaded and cached for performance.
	 *
	 * @returns Array of all unique anchor IDs
	 */
	getAnchorIds(): string[] {
		// Return cached anchor IDs (lazy-loaded)
		return this._getAnchorIds();
	}

	/**
	 * Extract full file content
	 * @returns Full content of parsed file
	 */
	extractFullContent(): string {
		// Return content string from parser output
		return this._data.content;
	}

	/**
	 * Extract section content by heading text and optional level
	 *
	 * Uses 3-phase algorithm: (0) look up heading level if not provided,
	 * (1) flatten token tree and locate target heading,
	 * (2) find section boundary (next same-or-higher level heading),
	 * (3) reconstruct content from token.raw properties.
	 *
	 * @param headingText - Exact heading text to find (case-sensitive)
	 * @param headingLevel - Optional heading level (1-6). If not provided, looked up from headings array
	 * @returns Section content string or null if not found
	 */
	extractSection(headingText: string, headingLevel?: number): string | null {
		// Phase 0: Look up heading level if not provided
		let targetLevel = headingLevel;
		if (targetLevel === undefined) {
			// Normalize both input and heading text for Obsidian character comparison
			const normalizedInput = this._normalizeObsidianHeading(headingText);
			const headingMeta = this._data.headings.find(
				(h) => this._normalizeObsidianHeading(h.text) === normalizedInput,
			);
			if (!headingMeta) return null;
			targetLevel = headingMeta.level;
		}

		// Phase 1: Collect heading nodes from the mdast tree, locate the target.
		// Defensive: the facade is also constructed from hand-built ParserOutput
		// objects in JS (e.g. block-only fixtures) that omit `ast`; section
		// extraction has no tree to walk in that case.
		const ast = this._data.ast;
		if (!ast) return null;

		const normalizedHeadingText = this._normalizeObsidianHeading(headingText);
		const headingNodes: Heading[] = [];
		visit(ast, "heading", (node) => {
			headingNodes.push(node);
		});

		const targetIndex = headingNodes.findIndex(
			(node) =>
				node.depth === targetLevel &&
				this._normalizeObsidianHeading(
					getHeadingText(node, this._data.content),
				) === normalizedHeadingText,
		);
		if (targetIndex === -1) return null;

		// Phase 2: Find the section boundary (next same-or-higher level heading).
		let boundaryNode: Heading | null = null;
		for (let i = targetIndex + 1; i < headingNodes.length; i++) {
			const node = headingNodes[i];
			if (node && node.depth <= targetLevel) {
				boundaryNode = node;
				break;
			}
		}

		// Phase 3: Slice the original content between the heading and the boundary.
		const startOffset = headingNodes[targetIndex]?.position?.start.offset;
		if (startOffset === undefined) return null;
		const endOffset =
			boundaryNode?.position?.start.offset ?? this._data.content.length;
		return this._data.content.slice(startOffset, endOffset);
	}

	/**
	 * Extract block content by anchor ID
	 *
	 * Finds block anchor by ID, validates line index is within bounds,
	 * and extracts the single line containing the block anchor.
	 *
	 * @param anchorId - Block anchor ID without ^ prefix
	 * @returns Single line content string or null if not found
	 */
	extractBlock(anchorId: string): string | null {
		// Find anchor with matching ID and anchorType === "block"
		const anchor = this._data.anchors.find(
			(a) => a.anchorType === "block" && a.id === anchorId,
		);

		// Not found? Return null
		if (!anchor) return null;

		// Split content into lines (anchor.line is 1-based)
		const lines = this._data.content.split("\n");
		const lineIndex = anchor.line - 1; // Convert to 0-based

		// Validate line index within bounds
		if (lineIndex < 0 || lineIndex >= lines.length) return null;

		// Extract single line containing block anchor
		return lines[lineIndex] ?? null;
	}

	// === PRIVATE HELPER METHODS ===

	/**
	 * Normalize heading text using Obsidian's link anchor rules
	 *
	 * Obsidian removes invalid characters when creating link anchors: # | ^ : %% [[ ]]
	 * This function applies the same normalization for heading text comparison.
	 *
	 * @private
	 * @param text - Raw heading text
	 * @returns Normalized text matching Obsidian link anchor format
	 */
	private _normalizeObsidianHeading(text: string): string {
		// stripMarkdown: false — raw heading text is compared verbatim against
		// Obsidian's own anchor-generation rules, not re-tokenized.
		return normalizeAnchorText(text, {
			stripMarkdown: false,
			colons: "strip",
			removeHash: true,
			removePipe: true,
			removeCaret: true,
			removeCommentMarkers: true,
			removeWikiBrackets: true,
		});
	}

	/**
	 * Get all anchor IDs (both id and urlEncodedId variants)
	 *
	 * Lazy-loaded and cached for performance. Extracts both id and urlEncodedId
	 * from all anchors, ensuring unique values only.
	 *
	 * @private
	 * @returns Array of all anchor IDs
	 */
	private _getAnchorIds(): string[] {
		// Check if cache exists
		if (this._cachedAnchorIds === null) {
			// Build Set of unique IDs
			const ids = new Set<string>();
			for (const anchor of this._data.anchors) {
				ids.add(anchor.id);

				// Add urlEncodedId if different from id (header anchors only)
				if (
					anchor.anchorType === "header" &&
					anchor.urlEncodedId !== anchor.id
				) {
					ids.add(anchor.urlEncodedId);
				}
			}

			// Cache the result
			this._cachedAnchorIds = Array.from(ids);
		}

		// Return cached value
		return this._cachedAnchorIds;
	}

	/**
	 * Fuzzy matching implementation to find similar strings
	 *
	 * Uses Levenshtein distance to calculate similarity scores, filters by
	 * threshold (0.6), and returns top 5 matches sorted by score descending.
	 *
	 * @private
	 * @param target - Target string to match
	 * @param candidates - Array of candidate strings
	 * @returns Array of similar strings sorted by similarity (max 5)
	 */
	private _fuzzyMatch(target: string, candidates: string[]): string[] {
		// Calculate similarity scores for all candidates
		const matches: Array<{ candidate: string; score: number }> = [];
		for (const candidate of candidates) {
			const similarity = this._calculateSimilarity(target, candidate);

			// Filter by threshold (0.3 for fuzzy matching)
			if (similarity > 0.3) {
				matches.push({ candidate, score: similarity });
			}
		}

		// Sort by score descending
		matches.sort((a, b) => b.score - a.score);

		// Return top 5 candidate strings
		return matches.map((m) => m.candidate).slice(0, 5);
	}

	/**
	 * Calculate string similarity using Levenshtein distance
	 *
	 * Implements dynamic programming algorithm to calculate edit distance,
	 * then normalizes to 0-1 range based on maximum string length.
	 *
	 * @private
	 * @param str1 - First string
	 * @param str2 - Second string
	 * @returns Similarity score between 0 and 1 (1 = identical)
	 */
	private _calculateSimilarity(str1: string, str2: string): number {
		// Handle edge cases
		if (str1 === str2) return 1.0;
		if (str1.length === 0 || str2.length === 0) return 0.0;

		// Case-insensitive comparison via shared distance helper
		const a = str1.toLowerCase();
		const b = str2.toLowerCase();
		const distance = levenshteinDistance(a, b);

		// Normalize to 0-1 range (1 = identical, 0 = completely different)
		const maxLength = Math.max(a.length, b.length);
		return 1 - distance / maxLength;
	}
}

export default ParsedDocument;
