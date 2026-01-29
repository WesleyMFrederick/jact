import { createHash } from 'crypto';

/**
 * Generate content-based identifier using SHA-256 hashing.
 * Integration: Uses Node.js crypto module for deterministic hashing.
 *
 * @param content - Content string to hash
 * @returns 16-character hex hash (truncated SHA-256)
 */
export function generateContentId(content: string): string {
	const hash = createHash('sha256');
	hash.update(content);
	const fullHash = hash.digest('hex');
	return fullHash.substring(0, 16);
}
