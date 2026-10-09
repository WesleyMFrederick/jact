import path from "node:path";
import { fileURLToPath } from "node:url";

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** First `#` not escaped by a Markdown backslash: where the anchor starts. */
export const ANCHOR_START = /(?<!\\)#/;

/** True when `child` is `parent` or lies under it. */
export function isInside(parent: string, child: string): boolean {
	const relative = path.relative(parent, child);
	return !(
		relative === ".." ||
		relative.startsWith(`..${path.sep}`) ||
		path.isAbsolute(relative)
	);
}

/**
 * Classify one markdown link target written in a vault note.
 * Returns the absolute path the target points at when it leaves the vault,
 * or null when it stays inside or is an external URL. The `#anchor` is
 * dropped, Markdown backslash escapes are removed, the path is URL-decoded
 * before classification, and `file:` URLs become paths.
 * Relative targets resolve lexically from the note's real directory (never
 * realpathed), so a symlink inside the vault is a valid way to link out.
 */
export function resolveVaultEscape(
	raw: string,
	noteRealDir: string,
	vaultRoot: string,
): string | null {
	const written = (raw.split(ANCHOR_START, 1)[0] ?? "")
		.replace(/\\([!-/:-@[-`{-~])/g, "$1")
		.replace(/^<|>$/g, "");
	const target = decode(written).replace(/^<|>$/g, "");
	if (/^file:/i.test(target)) {
		// Decode only the scheme: %23 or %3F in the path must stay part of the name.
		try {
			return fileURLToPath(written.replace(/^file%3A/i, "file:"));
		} catch {
			return path.resolve(target.replace(/^file:(\/\/)?/i, "/"));
		}
	}
	if (target === "" || URL_SCHEME.test(target)) return null;
	if (path.isAbsolute(target)) return path.normalize(target);
	const resolved = path.resolve(noteRealDir, target);
	if (target.includes(".paseo/worktrees/")) return resolved;
	return isInside(vaultRoot, resolved) ? null : resolved;
}

function decode(text: string): string {
	try {
		return decodeURIComponent(text);
	} catch {
		return text;
	}
}

/** Where a link's destination sits inside its source text. */
export interface DestinationSpan {
	/** Offset in `fullMatch` where the destination starts (at `<` when bracketed). */
	start: number;
	/** Offset just past the destination (past `>` when bracketed). */
	end: number;
	/** Destination as written, `#anchor` included, angle brackets removed. */
	text: string;
}

/**
 * Locate the destination of an inline link `[text](dest "title")` or a
 * reference definition `[label]: dest "title"` in its source text.
 */
export function destinationSpan(fullMatch: string): DestinationSpan | null {
	if (!fullMatch.startsWith("[")) return null;
	let depth = 0;
	let close = -1;
	for (let i = 0; i < fullMatch.length; i++) {
		const character = fullMatch[i];
		if (character === "\\") {
			i++;
		} else if (character === "[") {
			depth++;
		} else if (character === "]" && --depth === 0) {
			close = i;
			break;
		}
	}
	const opener = fullMatch[close + 1];
	if (close < 0 || (opener !== "(" && opener !== ":")) return null;
	const inline = opener === "(";
	let start = close + 2;
	while (/\s/.test(fullMatch[start] ?? "")) start++;
	if (fullMatch[start] === "<") {
		const end = fullMatch.indexOf(">", start);
		if (end < 0) return null;
		return { start, end: end + 1, text: fullMatch.slice(start + 1, end) };
	}
	const rest = inline
		? fullMatch.slice(start, fullMatch.lastIndexOf(")"))
		: fullMatch.slice(start);
	const titled = /^(\S+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*$/.exec(rest);
	const text = titled?.[1] ?? rest.trimEnd();
	if (text === "") return null;
	return { start, end: start + text.length, text };
}
