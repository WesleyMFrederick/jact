/**
 * Result from nested codeblock detection.
 * Simple internal type — not part of shared data contracts.
 */
export interface NestedCodeblockWarning {
	line: number;
	message: string;
}

/**
 * Detect backtick codeblocks nested inside other backtick codeblocks.
 *
 * Tracks fence type (backtick vs tilde) to distinguish valid nesting
 * (backtick inside tilde) from invalid nesting (backtick inside backtick).
 *
 * @param content - Full markdown file content
 * @returns Array of warnings for detected nesting issues
 */
export function detectNestedCodeblocks(
	content: string,
): NestedCodeblockWarning[] {
	const warnings: NestedCodeblockWarning[] = [];
	const lines = content.split("\n");

	let inFenceType: "backtick" | "tilde" | null = null;
	let outerBacktickLine = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;
		const trimmed = line.trim();

		const isBacktickFence = trimmed.startsWith("```");
		const isTildeFence =
			trimmed.startsWith("~~~") && !trimmed.startsWith("```");

		if (!isBacktickFence && !isTildeFence) continue;

		if (inFenceType === null) {
			// Opening a new code block
			if (isBacktickFence) {
				inFenceType = "backtick";
				outerBacktickLine = i + 1; // 1-based
			} else {
				inFenceType = "tilde";
			}
		} else if (inFenceType === "backtick") {
			if (isBacktickFence) {
				// If the line has a language specifier (e.g., ```typescript), it's an inner opening
				const hasLangSpec = trimmed.length > 3 && !trimmed.endsWith("```");
				if (hasLangSpec) {
					// Inner opening backtick fence — nested problem
					warnings.push({
						line: i + 1,
						message: `Nested backtick codeblock detected inside backtick block opened at line ${outerBacktickLine}. Wrap the outer code block with ~~~ (tilde fences) instead.`,
					});
					// Outer block is effectively broken, reset state
					inFenceType = null;
				} else {
					// Closing backtick fence — normal close
					inFenceType = null;
				}
			}
		} else if (inFenceType === "tilde") {
			if (isTildeFence) {
				// Closing tilde fence
				inFenceType = null;
			}
			// Backtick fence inside tilde block — valid nesting, no warning
		}
	}

	return warnings;
}
