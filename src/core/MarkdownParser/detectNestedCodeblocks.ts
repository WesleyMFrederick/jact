import type { FileDiagnostic } from "../../types/validationTypes.js";

/**
 * Detect backtick codeblocks nested inside other backtick codeblocks.
 *
 * Tracks fence type (backtick vs tilde) to distinguish valid nesting
 * (backtick inside tilde) from invalid nesting (backtick inside backtick).
 *
 * @param content - Full markdown file content
 * @returns Array of diagnostics for detected nesting issues
 */
export function detectNestedCodeblocks(content: string): FileDiagnostic[] {
	const diagnostics: FileDiagnostic[] = [];
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
				// Another backtick fence inside a backtick block
				// If the trimmed line has a language specifier (e.g., ```typescript), it's an inner opening
				const hasLangSpec = trimmed.length > 3 && !trimmed.endsWith("```");
				if (hasLangSpec) {
					// Inner opening backtick fence — this is the nested problem
					diagnostics.push({
						line: i + 1,
						status: "warning",
						message: `Nested backtick codeblock detected inside backtick block opened at line ${outerBacktickLine}`,
						suggestion:
							"Wrap the outer code block with ~~~ (tilde fences) instead of ``` to allow backtick blocks inside",
					});
					// The outer block is now effectively broken, reset state
					inFenceType = null;
				} else {
					// Closing backtick fence — normal close
					inFenceType = null;
				}
			}
			// Tilde fence inside backtick block — ignored (not part of our detection)
		} else if (inFenceType === "tilde") {
			if (isTildeFence) {
				// Closing tilde fence
				inFenceType = null;
			}
			// Backtick fence inside tilde block — valid nesting, no diagnostic
		}
	}

	return diagnostics;
}
