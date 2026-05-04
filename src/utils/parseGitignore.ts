/**
 * Minimal gitignore parser supporting basic patterns and negation
 * No external dependencies required
 */

export interface GitignorePattern {
	pattern: string; // trailing / stripped, leading / stripped
	dirOnly: boolean; // true when original ended with /
	negate: boolean; // true when original started with !
}

/**
 * Parse .gitignore content into pattern list.
 * Skip blank lines and lines starting with #.
 */
export function parseGitignore(content: string): GitignorePattern[] {
	const lines = content.split("\n");
	const patterns: GitignorePattern[] = [];

	for (const line of lines) {
		let trimmed = line.trim();

		// Skip empty lines and comments
		if (!trimmed || trimmed.startsWith("#")) {
			continue;
		}

		// Check for negation
		const negate = trimmed.startsWith("!");
		if (negate) {
			trimmed = trimmed.slice(1).trim();
		}

		// Check for directory-only marker
		const dirOnly = trimmed.endsWith("/");
		if (dirOnly) {
			trimmed = trimmed.slice(0, -1);
		}

		// Strip leading slash (makes pattern relative to scope root)
		if (trimmed.startsWith("/")) {
			trimmed = trimmed.slice(1);
		}

		if (trimmed.length > 0) {
			patterns.push({
				pattern: trimmed,
				dirOnly,
				negate,
			});
		}
	}

	return patterns;
}

/**
 * Returns true if relativePath (posix-style, relative to scope root) should be excluded.
 * isDir: true when checking a directory entry.
 * Negate patterns (!) are applied after positive matches.
 */
export function isGitignored(
	patterns: GitignorePattern[],
	relativePath: string,
	isDir: boolean,
): boolean {
	// Separate negate patterns from positive patterns
	const positivePatterns = patterns.filter((p) => !p.negate);
	const negatePatterns = patterns.filter((p) => p.negate);

	// Check if any positive pattern matches
	let isIgnored = false;
	for (const pattern of positivePatterns) {
		if (patternMatches(pattern, relativePath, isDir)) {
			isIgnored = true;
			break;
		}
	}

	// If ignored, check if any negate pattern re-includes it
	if (isIgnored) {
		for (const pattern of negatePatterns) {
			if (patternMatches(pattern, relativePath, isDir)) {
				return false; // Re-included by negate pattern
			}
		}
	}

	return isIgnored;
}

function patternMatches(
	pattern: GitignorePattern,
	relativePath: string,
	isDir: boolean,
): boolean {
	const patternStr = pattern.pattern;

	// Handle wildcard patterns
	if (patternStr.includes("*")) {
		return matchWildcardPattern(patternStr, relativePath);
	}

	// Exact match against basename or full path
	const pathComponents = relativePath.split("/");
	const basename = pathComponents[pathComponents.length - 1] || "";

	// If pattern doesn't contain /, it can match basename or be a dirOnly pattern
	if (!patternStr.includes("/")) {
		if (pattern.dirOnly) {
			// dirOnly pattern (e.g., ".claude/"): matches directory and its contents
			// Match if: this path component is the directory, OR
			// this path is inside the directory
			if (isDir) {
				return basename === patternStr;
			} else {
				// For files, check if any path component matches
				return pathComponents.includes(patternStr);
			}
		} else {
			// Regular pattern: match basename
			return basename === patternStr;
		}
	}

	// Pattern contains /, must match full path or path prefix
	return (
		relativePath === patternStr || relativePath.startsWith(patternStr + "/")
	);
}

function matchWildcardPattern(pattern: string, relativePath: string): boolean {
	// Convert gitignore wildcard to regex
	// * matches anything except /
	// ** matches anything including /
	let regexStr = "";
	let i = 0;
	const chars = pattern.split("");

	while (i < chars.length) {
		const char = chars[i];

		if (char === "*") {
			if (i + 1 < chars.length && chars[i + 1] === "*") {
				// ** pattern
				if (i + 2 < chars.length && chars[i + 2] === "/") {
					// **/ pattern — matches zero or more directories
					regexStr += "(?:.*/)?";
					i += 3;
				} else {
					// ** at end — matches everything
					regexStr += ".*";
					i += 2;
				}
			} else {
				// Single * — matches anything except /
				regexStr += "[^/]*";
				i += 1;
			}
		} else if (
			char === "?" ||
			char === "[" ||
			char === "]" ||
			char === "(" ||
			char === ")"
		) {
			// Escape regex special chars
			regexStr += "\\" + char;
			i += 1;
		} else if (char === ".") {
			regexStr += "\\.";
			i += 1;
		} else {
			regexStr += char;
			i += 1;
		}
	}

	// Match full path or basename
	const regex = new RegExp(`^${regexStr}$`);
	return regex.test(relativePath);
}
