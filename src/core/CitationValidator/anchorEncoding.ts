/**
 * Anchor encoding for markdown links (jact#125).
 *
 * CommonMark does not allow a raw space in a link destination, and GitHub and
 * Obsidian both show `[t](file.md#Header (x) y)` as plain text. The canonical
 * anchor %-encodes those characters; both renderers accept it.
 */

/** Error prefix for a markdown-link anchor with a raw space, `(`, or `)`. */
export const UNRENDERABLE_ANCHOR_ERROR =
	"Anchor has characters a markdown link cannot contain";

/** Raw characters that stop a markdown link from rendering, in report order. */
const UNRENDERABLE_CHARS: ReadonlyArray<[char: string, label: string]> = [
	[" ", "space"],
	["(", '"("'],
	[")", '")"'],
];

/**
 * Labels for the raw characters in a markdown-link anchor that stop the link
 * from rendering: `space`, `"("`, `")"`. Empty when the anchor renders.
 */
export const findUnrenderableAnchorChars = (anchor: string): string[] =>
	UNRENDERABLE_CHARS.filter(([char]) => anchor.includes(char)).map(
		([, label]) => label,
	);

/**
 * Canonical %-encoded anchor: space → `%20`, `(` → `%28`, `)` → `%29`,
 * `` ` `` → `%60`, and a bare `%` → `%25`. A `%` that already starts a `%XX`
 * escape stays. Same rules as `scripts/encode-spec-link-anchors.mjs`.
 *
 * Contract:
 * - Idempotent: encoding an already-encoded anchor returns the same string,
 *   so `--fix` never double-encodes.
 */
export const encodeAnchor = (anchor: string): string =>
	anchor
		.replace(/%(?![0-9A-Fa-f]{2})/g, "%25")
		.replace(/ /g, "%20")
		.replace(/\(/g, "%28")
		.replace(/\)/g, "%29")
		.replace(/`/g, "%60");
