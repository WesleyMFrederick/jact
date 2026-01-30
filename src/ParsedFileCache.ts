import { normalize, resolve } from "node:path";
import ParsedDocument from "./ParsedDocument.js";
import type { ParserOutput } from "./types/citationTypes.js";
import type { MarkdownParser } from "./core/MarkdownParser/index.js";

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
 * Wraps parser output in ParsedDocument facade before caching to provide stable query interface.
 *
 * @example
 * const cache = new ParsedFileCache(parser);
 * // First call triggers parsing and facade wrapping, second call awaits the same Promise
 * const result1 = await cache.resolveParsedFile('/path/to/file.md');
 * const result2 = await cache.resolveParsedFile('/path/to/file.md'); // Uses cached Promise
 */
export class ParsedFileCache {
	private parser: MarkdownParser;
	private cache: Map<string, Promise<ParsedDocument>>;

	/**
	 * Initialize cache with markdown parser
	 *
	 * @param markdownParser - Parser instance for processing markdown files
	 */
	constructor(markdownParser: MarkdownParser) {
		this.parser = markdownParser;
		this.cache = new Map<string, Promise<ParsedDocument>>();
	}

	/**
	 * Resolve parsed file data with automatic concurrent request deduplication
	 *
	 * Returns cached Promise if file is currently being parsed or already parsed.
	 * If cache miss, creates new parse operation, wraps result in ParsedDocument facade,
	 * and caches the Promise immediately before awaiting (prevents duplicate parses for concurrent requests).
	 *
	 * Failed parse operations are automatically removed from cache to allow retry.
	 *
	 * @param filePath - Path to markdown file (relative or absolute, will be normalized)
	 * @returns ParsedDocument facade instance wrapping parser output
	 */
	async resolveParsedFile(filePath: string): Promise<ParsedDocument> {
		// 1. Normalize path to absolute for consistent cache keys
		const cacheKey = resolve(normalize(filePath));

		// 2. Decision point: Check cache for existing Promise
		if (this.cache.has(cacheKey)) {
			// Cache hit: Return existing ParsedDocument Promise
			return this.cache.get(cacheKey)!;
		}

		// 3. Cache miss: Create parse operation
		const parsePromise = this.parser.parseFile(cacheKey);

		// 4. Wrap parser output in ParsedDocument facade before caching
		const parsedDocPromise = parsePromise.then(
			(contract: ParserOutput) => new ParsedDocument(contract),
		);

		// 5. Store ParsedDocument Promise IMMEDIATELY (prevents duplicate parses)
		this.cache.set(cacheKey, parsedDocPromise);

		// 6. Error handling: Cleanup failed promises from cache
		parsedDocPromise.catch(() => {
			this.cache.delete(cacheKey);
		});

		return parsedDocPromise;
	}
}
