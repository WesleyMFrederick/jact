/**
 * InMemoryFileCache — in-memory adapter implementing FileCacheLike.
 *
 * Intended for test scenarios where callers need to inject a FileCache
 * dependency without spinning up a real filesystem scan. Pre-seed the
 * cache with filename → absolute-path entries; resolveFile returns a
 * FileCacheLike-compatible result.
 *
 * Usage:
 *   const cache = new InMemoryFileCache({ "foo.md": "/abs/path/foo.md" });
 *   const validator = createCitationValidator(null, cache);
 */

import type { FileCacheLike } from "../../src/types/componentInterfaces.js";

export class InMemoryFileCache implements FileCacheLike {
	private entries: Map<string, string>;

	/**
	 * @param entries - Optional seed map of filename → absolute path.
	 *   Defaults to empty (every resolveFile call returns not-found).
	 */
	constructor(entries: Record<string, string> = {}) {
		this.entries = new Map(Object.entries(entries));
	}

	/**
	 * Add or overwrite a single entry.
	 */
	set(filename: string, absolutePath: string): void {
		this.entries.set(filename, absolutePath);
	}

	/**
	 * Resolve a filename to its pre-seeded path.
	 * Returns a FileCacheLike-compatible result object.
	 */
	resolveFile(filename: string): {
		found: boolean;
		path?: string | null;
		fuzzyMatch?: boolean;
		message?: string;
		reason?: string;
	} {
		const resolved = this.entries.get(filename);
		if (resolved !== undefined) {
			return { found: true, path: resolved };
		}
		return {
			found: false,
			reason: "not_found",
			message: `InMemoryFileCache: "${filename}" not in seed entries.`,
		};
	}
}
