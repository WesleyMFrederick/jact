import type { Token } from "marked";
import type { HeadingObject } from "../../types/citationTypes.js";

/**
 * Type guard for tokens with nested token arrays
 */
function hasNestedTokens(token: Token): token is Token & { tokens: Token[] } {
	return "tokens" in token && Array.isArray((token as { tokens?: unknown }).tokens);
}

/**
 * Extract heading metadata from token tree
 *
 * Recursively walks token tree (using walkTokens-like pattern) to find all
 * heading tokens. Preserves heading level, text, and raw markdown for later
 * section extraction or anchor validation.
 *
 * @param tokens - Token array from marked.lexer()
 * @returns Array of { level, text, raw } heading objects
 */
export function extractHeadings(tokens: Token[]): HeadingObject[] {
	const headings: HeadingObject[] = [];

	const extractFromTokens = (tokenList: Token[]): void => {
		for (const token of tokenList) {
			if (token.type === "heading") {
				headings.push({
					level: token.depth,
					text: token.text,
					raw: token.raw,
				});
			}

			// Recursively check nested tokens
			if (hasNestedTokens(token)) {
				extractFromTokens(token.tokens);
			}
		}
	};

	extractFromTokens(tokens);
	return headings;
}
