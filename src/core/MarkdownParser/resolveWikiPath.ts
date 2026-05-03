// Per D4 (a). Sibling to resolvePath.ts. FileCache is an injected parameter (per [H-D4-factory]).
import type { FileCache } from "../../FileCache.js";
import { pageNameToSlug } from "../../utils/wikiPageSlug.js";

// Return shape carries both attempted forms so the validator's broken-link reason
// can list them: "tried: <raw>, <slug>.md".
export type ResolvedPath =
	| { resolved: true; absolutePath: string }
	| { resolved: false; attempted: [rawPath: string, slugPath: string] };

/**
 * Two-step wiki page name resolver.
 *
 * Step 1: fileCache.resolveFile(rawPath)              — handles already-slugged or .md forms
 * Step 2: fileCache.resolveFile(slug + ".md")         — handles Title Case / em dash page names
 * Step 3: both miss → { resolved: false, attempted: [rawPath, slugPath] }
 *
 * Levenshtein suggestion path (D4 (e)) is out of scope for this spike (ships in plan-04).
 */
export function resolveWikiPath(
	rawPath: string,
	_sourceAbsolutePath: string,
	fileCache: FileCache,
): ResolvedPath {
	const step1 = fileCache.resolveFile(rawPath);
	if (step1.found) {
		return { resolved: true, absolutePath: step1.path };
	}

	const slugPath = `${pageNameToSlug(rawPath)}.md`;
	const step2 = fileCache.resolveFile(slugPath);
	if (step2.found) {
		return { resolved: true, absolutePath: step2.path };
	}

	return { resolved: false, attempted: [rawPath, slugPath] };
}
