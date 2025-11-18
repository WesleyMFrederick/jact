import { createHash } from "crypto";

/**
 * Generate content-based identifier using SHA-256 hashing
 * Integration: Uses Node.js crypto module for deterministic hashing
 *
 * @param {string} content - Content string to hash
 * @returns {string} 16-character hex hash (truncated SHA-256)
 */
export function generateContentId(content) {
	// Boundary: Use Node crypto for SHA-256 hash generation
	const hash = createHash("sha256");

	// Pattern: Update hash with content, generate hex digest
	hash.update(content);
	const fullHash = hash.digest("hex");

	// Decision: Truncate to 16 chars per AC2 (balance uniqueness vs brevity)
	return fullHash.substring(0, 16);
}
