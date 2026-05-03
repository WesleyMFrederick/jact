// Per D4 (c). Pure function; no I/O.
// Rule order: lowercase → whitespace runs → strip non-[a-z0-9\-_] → collapse repeated hyphens.
const WHITESPACE_RUN = /\s+/g;
const NON_SLUG_CHARS = /[^a-z0-9\-_]/g;
const REPEATED_HYPHENS = /-{2,}/g;

export function pageNameToSlug(pageName: string): string {
	return pageName
		.toLowerCase()
		.replace(WHITESPACE_RUN, "-")
		.replace(NON_SLUG_CHARS, "")
		.replace(REPEATED_HYPHENS, "-");
}
