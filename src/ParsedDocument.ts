import type {
	ParserOutput,
	LinkObject,
	AnchorObject,
} from "./types/citationTypes.js";

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
	 * @param parserOutput - MarkdownParser.Output.DataContract with filePath, content, tokens, links, headings, anchors
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
	 *
	 * @param {string} anchorId - Anchor ID to check (either id or urlEncodedId format)
	 * @returns {boolean} True if anchor exists in document
	 */
	hasAnchor(anchorId: string): boolean {
		// Check both id and urlEncodedId for match
		return this._data.anchors.some(
			(a) =>
				a.id === anchorId ||
				(a.anchorType === "header" && a.urlEncodedId === anchorId),
		);
	}

	/**
	 * Find anchors similar to given anchor ID
	 *
	 * Uses fuzzy matching (Levenshtein distance) to find similar anchor IDs
	 * for suggestion generation. Returns top 5 matches sorted by similarity score.
	 *
	 * @param {string} anchorId - Anchor ID to find similar matches for
	 * @returns {string[]} Array of similar anchor IDs sorted by similarity score (max 5)
	 */
	findSimilarAnchors(anchorId: string): string[] {
		// Get all anchor IDs (lazy-loaded from cache)
		const allIds = this._getAnchorIds();

		// Perform fuzzy matching and return top 5 results
		return this._fuzzyMatch(anchorId, allIds);
	}

	/**
	 * Get all links in the document
	 * @returns {Array<Object>} Array of all link objects from parser output
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
	 * @returns {string[]} Array of all unique anchor IDs
	 */
	getAnchorIds(): string[] {
		// Return cached anchor IDs (lazy-loaded)
		return this._getAnchorIds();
	}

	/**
	 * Extract full file content
	 * @returns {string} Full content of parsed file
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
	 * @param {string} headingText - Exact heading text to find (case-sensitive)
	 * @param {number} [headingLevel] - Optional heading level (1-6). If not provided, looked up from headings array
	 * @returns {string|null} Section content string or null if not found
	 */
	extractSection(headingText: string, headingLevel: number): string | null {
		// Phase 0: Look up heading level if not provided
		let targetLevel = headingLevel;
		if (targetLevel === undefined) {
			const headingMeta = this._data.headings.find(
				(h) => h.text === headingText,
			);
			if (!headingMeta) return null;
			targetLevel = headingMeta.level;
		}

		// Phase 1: Flatten token tree and locate target heading
		const orderedTokens: any[] = [];
		let targetIndex = -1;

		const walkTokens = (tokenList: any) => {
			for (const token of tokenList) {
				const currentIndex = orderedTokens.length;
				orderedTokens.push(token);

				// Found our target heading?
				if (
					token.type === "heading" &&
					token.text === headingText &&
					token.depth === targetLevel
				) {
					targetIndex = currentIndex;
				}

				// Recurse into nested tokens ONLY if token.raw doesn't already include child content
				// Skip for: heading, paragraph (their .raw includes full content with inline formatting)
				// Recurse for: list, list_item, blockquote, table (structural tokens where .raw is minimal)
				if (token.tokens && !this._tokenIncludesChildrenInRaw(token.type)) {
					walkTokens(token.tokens);
				}
			}
		};

		walkTokens(this._data.tokens);

		// Not found? Return null
		if (targetIndex === -1) return null;

		// Phase 2: Find section boundary (next same-or-higher level heading)
		const targetHeadingLevel = orderedTokens[targetIndex].depth;
		let endIndex = orderedTokens.length; // Default: to end of file

		for (let i = targetIndex + 1; i < orderedTokens.length; i++) {
			const token = orderedTokens[i];
			if (token.type === "heading" && token.depth <= targetHeadingLevel) {
				endIndex = i;
				break;
			}
		}

		// Phase 3: Reconstruct content from token.raw properties
		const sectionTokens = orderedTokens.slice(targetIndex, endIndex);
		return sectionTokens.map((t) => t.raw).join("");
	}

	/**
	 * Extract block content by anchor ID
	 *
	 * Finds block anchor by ID, validates line index is within bounds,
	 * and extracts the single line containing the block anchor.
	 *
	 * @param {string} anchorId - Block anchor ID without ^ prefix
	 * @returns {string|null} Single line content string or null if not found
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
	 * Check if token type includes children content in its raw property
	 *
	 * For some token types (heading, paragraph), the .raw property includes
	 * the full content including nested inline formatting. For these types,
	 * we should NOT recurse into .tokens to avoid duplication.
	 *
	 * For structural tokens (list, blockquote, table), .raw is minimal and
	 * we MUST recurse into .tokens to capture nested content.
	 *
	 * @private
	 * @param {string} tokenType - Token type from marked.js
	 * @returns {boolean} True if token.raw includes all child content
	 */
	_tokenIncludesChildrenInRaw(tokenType: string): boolean {
		// Token types where .raw includes full content (skip recursion)
		const inclusiveTypes = new Set([
			"heading", // "## Title\n" includes inline text
			"paragraph", // "Text with **bold**\n" includes inline formatting
			"text", // Inline text tokens
			"code", // Code blocks include full content
			"html", // HTML blocks include full content
		]);

		return inclusiveTypes.has(tokenType);
	}

	/**
	 * Get all anchor IDs (both id and urlEncodedId variants)
	 *
	 * Lazy-loaded and cached for performance. Extracts both id and urlEncodedId
	 * from all anchors, ensuring unique values only.
	 *
	 * @private
	 * @returns {string[]} Array of all anchor IDs
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
	 * @param {string} target - Target string to match
	 * @param {string[]} candidates - Array of candidate strings
	 * @returns {string[]} Array of similar strings sorted by similarity (max 5)
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
	 * @param {string} str1 - First string
	 * @param {string} str2 - Second string
	 * @returns {number} Similarity score between 0 and 1 (1 = identical)
	 */
	private _calculateSimilarity(str1: string, str2: string): number {
		// Handle edge cases
		if (str1 === str2) return 1.0;
		if (str1.length === 0 || str2.length === 0) return 0.0;

		// Convert to lowercase for case-insensitive comparison
		const a = str1.toLowerCase();
		const b = str2.toLowerCase();

		// Initialize matrix for dynamic programming
		const matrix: number[][] = [];
		for (let i = 0; i <= b.length; i++) {
			matrix[i] = [i];
		}
		for (let j = 0; j <= a.length; j++) {
			matrix[0]![j] = j;
		}

		// Fill matrix with Levenshtein distance calculation
		for (let i = 1; i <= b.length; i++) {
			for (let j = 1; j <= a.length; j++) {
				if (b.charAt(i - 1) === a.charAt(j - 1)) {
					matrix[i]![j] = matrix[i - 1]![j - 1]!;
				} else {
					matrix[i]![j] = Math.min(
						matrix[i - 1]![j - 1]! + 1, // substitution
						matrix[i]![j - 1]! + 1, // insertion
						matrix[i - 1]![j]! + 1, // deletion
					);
				}
			}
		}

		// Get final distance
		const distance = matrix[b.length]![a.length]!;

		// Normalize to 0-1 range (1 = identical, 0 = completely different)
		const maxLength = Math.max(a.length, b.length);
		return 1 - distance / maxLength;
	}
}

export default ParsedDocument;
