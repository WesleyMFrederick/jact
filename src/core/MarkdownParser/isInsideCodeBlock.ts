/**
 * Check if a 0-based line index falls inside a CommonMark fenced code block.
 * Supports both ``` (backtick) and ~~~ (tilde) fences — CommonMark allows either.
 * Opener/closer fence lines themselves are NOT considered inside.
 *
 * Callers filtering many matches should hoist via `getFencedCodeBlockLineSet`
 * to avoid re-scanning the source per call.
 */
export function isInsideCodeBlock(source: string, lineIndex: number): boolean {
	return getFencedCodeBlockLineSet(source).has(lineIndex);
}

/**
 * Precompute the set of 0-based line indices that fall inside fenced code blocks.
 * Fence type is tracked so a backtick fence requires a backtick closer, and
 * a tilde fence requires a tilde closer (per CommonMark §4.5).
 */
export function getFencedCodeBlockLineSet(source: string): Set<number> {
	const lines = source.split("\n");
	const insideLines = new Set<number>();
	let inFenceType: "backtick" | "tilde" | null = null;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;
		const trimmed = line.trim();
		const isBacktickFence = trimmed.startsWith("```");
		const isTildeFence =
			trimmed.startsWith("~~~") && !trimmed.startsWith("```");

		if (inFenceType === null) {
			if (isBacktickFence) inFenceType = "backtick";
			else if (isTildeFence) inFenceType = "tilde";
		} else if (inFenceType === "backtick" && isBacktickFence) {
			inFenceType = null;
		} else if (inFenceType === "tilde" && isTildeFence) {
			inFenceType = null;
		} else {
			insideLines.add(i);
		}
	}

	return insideLines;
}
