/**
 * Levenshtein edit distance between two strings.
 *
 * Uses two rolling rows of length n+1 — O(n) auxiliary space, O(m*n) time.
 * Case-sensitive. Callers should lowercase inputs if case-insensitive comparison is needed.
 *
 * @param a - First string
 * @param b - Second string
 * @returns Minimum number of single-character edits (insertions, deletions, substitutions) to transform a into b
 */
export function levenshteinDistance(a: string, b: string): number {
	const m = a.length;
	const n = b.length;
	if (m === 0) return n;
	if (n === 0) return m;

	let prev = Array.from({ length: n + 1 }, (_, j) => j);
	let curr = new Array<number>(n + 1);

	for (let i = 1; i <= m; i++) {
		curr[0] = i;
		for (let j = 1; j <= n; j++) {
			if (a[i - 1] === b[j - 1]) {
				curr[j] = prev[j - 1]!;
			} else {
				curr[j] = 1 + Math.min(prev[j]!, curr[j - 1]!, prev[j - 1]!);
			}
		}
		[prev, curr] = [curr, prev];
	}
	return prev[n]!;
}
