import { resolve, normalize } from 'node:path';

export class ParsedFileCache {
	constructor(markdownParser) {
		this.parser = markdownParser;
		this.cache = new Map();
	}

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
