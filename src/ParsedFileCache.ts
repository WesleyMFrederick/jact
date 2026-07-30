import { normalize, resolve } from "node:path";
import type { MarkdownParser } from "./core/MarkdownParser/index.js";
import ParsedDocument from "./ParsedDocument.js";
import type { ParserOutput } from "./types/citationTypes.js";

export type ParsedDocumentSource =
	| { kind: "file"; filePath: string }
	| { kind: "memory"; filePath: string; content: string };

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
 * const result1 = await cache.resolveDocument({ kind: "file", filePath: "/path/to/file.md" });
 * const result2 = await cache.resolveDocument({ kind: "file", filePath: "/path/to/file.md" }); // Uses cached Promise
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
	 * Resolve a semantic document from a file or in-memory source.
	 *
	 * Returns a cached Promise if a file is currently being parsed or already parsed.
	 * If cache miss, creates new parse operation, wraps result in ParsedDocument facade,
	 * and caches the Promise immediately before awaiting (prevents duplicate parses for concurrent requests).
	 *
	 * Failed parse operations are automatically removed from cache to allow retry.
	 *
	 * @param source - File or in-memory markdown source
	 * @returns Semantic ParsedDocument facade
	 */
	async resolveDocument(source: ParsedDocumentSource): Promise<ParsedDocument> {
		const cacheKey = resolve(normalize(source.filePath));

		if (source.kind === "file") {
			const cached = this.cache.get(cacheKey);
			if (cached) return cached;
		}

		const parsePromise: Promise<ParserOutput> =
			source.kind === "file"
				? this.parser.parseFile(cacheKey)
				: Promise.resolve().then(() =>
						this.parser.parseContent(source.content, cacheKey),
					);
		const documentPromise = parsePromise.then(
			(parsed) => new ParsedDocument(parsed),
		);

		// Store the in-flight promise before any caller can await it. An explicit
		// memory source replaces an older entry for the same intended path so
		// self-anchors always resolve against the supplied content.
		this.cache.set(cacheKey, documentPromise);
		documentPromise.catch(() => {
			if (this.cache.get(cacheKey) === documentPromise) {
				this.cache.delete(cacheKey);
			}
		});

		return documentPromise;
	}
}
