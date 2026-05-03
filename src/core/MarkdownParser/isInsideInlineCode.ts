/**
 * Check if a position in a line is inside an inline code span (backticks)
 * per CommonMark §6.1: an opener run of N backticks closes only on a run of
 * exactly N backticks. Unmatched openers are treated as literal text.
 *
 * Backslash-escaped backticks (`\``) are treated as literal characters and
 * do not contribute to runs.
 */
export function isInsideInlineCode(line: string, position: number): boolean {
	type Run = { start: number; length: number };
	const runs: Run[] = [];
	let i = 0;
	while (i < line.length) {
		if (line[i] === "`" && (i === 0 || line[i - 1] !== "\\")) {
			const start = i;
			while (i < line.length && line[i] === "`") i++;
			runs.push({ start, length: i - start });
		} else {
			i++;
		}
	}

	// Greedy pairing: leftmost unpaired run is opener; closer is the next run
	// of the same length. Openers without matching closers are skipped.
	let openerIdx = 0;
	while (openerIdx < runs.length) {
		const opener = runs[openerIdx];
		if (opener === undefined) break;
		let closerIdx = openerIdx + 1;
		while (closerIdx < runs.length) {
			const candidate = runs[closerIdx];
			if (candidate !== undefined && candidate.length === opener.length) break;
			closerIdx++;
		}
		const closer = runs[closerIdx];
		if (closer === undefined) {
			// No matching closer — treat opener as literal, advance one run.
			openerIdx++;
			continue;
		}
		const insideStart = opener.start + opener.length;
		const insideEnd = closer.start;
		if (position >= insideStart && position < insideEnd) {
			return true;
		}
		openerIdx = closerIdx + 1;
	}
	return false;
}
