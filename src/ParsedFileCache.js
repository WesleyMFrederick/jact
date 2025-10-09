import { normalize, resolve } from "node:path";

/**
 * Promise-based cache for parsed markdown files
 *
 * Provides async access to parsed markdown data with automatic concurrent request deduplication.
 * Uses Promise caching to ensure the same file is never parsed multiple times simultaneously,
 * even when validation requests overlap (e.g., validating multiple files that reference the same target).
 *
 * Architecture decision: Cache stores Promises rather than resolved values to handle concurrent
 * requests during the parsing phase. This prevents duplicate parser.parseFile() calls when multiple
 * validators check the same target file simultaneously.
 *
 * @example
 * const cache = new ParsedFileCache(parser);
 * // First call triggers parsing, second call awaits the same Promise
 * const result1 = await cache.resolveParsedFile('/path/to/file.md');
 * const result2 = await cache.resolveParsedFile('/path/to/file.md'); // Uses cached Promise
 */
export class ParsedFileCache {
	/**
	 * Initialize cache with markdown parser
	 *
	 * @param {MarkdownParser} markdownParser - Parser instance for processing markdown files
	 */
	constructor(markdownParser) {
		this.parser = markdownParser;
		this.cache = new Map();
	}

	/**
	 * Resolve parsed file data with automatic concurrent request deduplication
	 *
	 * Returns cached Promise if file is currently being parsed or already parsed.
	 * If cache miss, creates new parse operation and caches the Promise immediately
	 * before awaiting (prevents duplicate parses for concurrent requests).
	 *
	 * Failed parse operations are automatically removed from cache to allow retry.
	 *
	 * @param {string} filePath - Path to markdown file (relative or absolute, will be normalized)
	 * @returns {Promise<Object>} Parser output with { filePath, content, tokens, links, headings, anchors }
	 */
	async resolveParsedFile(filePath) {
		// 1. Normalize path to absolute for consistent cache keys
		const cacheKey = resolve(normalize(filePath));

		// 2. Decision point: Check cache for existing Promise
		if (this.cache.has(cacheKey)) {
			// Cache hit: Return existing Promise (handles concurrent requests)
			return this.cache.get(cacheKey);
		}

		// 3. Cache miss: Create parse operation
		const parsePromise = this.parser.parseFile(cacheKey);

		// 4. Store Promise IMMEDIATELY (prevents duplicate parses for concurrent requests)
		this.cache.set(cacheKey, parsePromise);

		// 5. Error handling: Cleanup failed promises from cache
		parsePromise.catch(() => {
			this.cache.delete(cacheKey);
		});

		return parsePromise;
	}
}
