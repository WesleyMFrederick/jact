import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

function computeCacheKey(sessionId: string, filePath: string): string {
	const content = readFileSync(filePath);
	const contentHash = createHash("md5").update(content).digest("hex");
	return `${sessionId}_${contentHash}`;
}

/**
 * Check if extraction results are cached for the given session and file content.
 *
 * Cache key: `${sessionId}_${md5(fileContent)}` — content-hash-based invalidation
 * ensures re-extraction when file changes between reads.
 *
 * @param sessionId - Claude Code session identifier
 * @param filePath - Path to the file being extracted
 * @param cacheDir - Directory for cache marker files
 * @returns true if cached (skip extraction), false if cache miss
 */
export function checkExtractCache(
	sessionId: string,
	filePath: string,
	cacheDir: string,
): boolean {
	mkdirSync(cacheDir, { recursive: true });
	const cacheKey = computeCacheKey(sessionId, filePath);
	return existsSync(`${cacheDir}/${cacheKey}`);
}

/**
 * Write a cache marker after successful extraction.
 *
 * Creates an empty marker file at `${cacheDir}/${sessionId}_${md5(fileContent)}`.
 * Auto-creates cache directory if missing.
 *
 * @param sessionId - Claude Code session identifier
 * @param filePath - Path to the file that was extracted
 * @param cacheDir - Directory for cache marker files
 */
export function writeExtractCache(
	sessionId: string,
	filePath: string,
	cacheDir: string,
): void {
	mkdirSync(cacheDir, { recursive: true });
	const cacheKey = computeCacheKey(sessionId, filePath);
	writeFileSync(`${cacheDir}/${cacheKey}`, "");
}
