import { dirname, relative } from "node:path";
import type { FileCache } from "../../FileCache.js";
import type { LinkObject } from "../../types/citationTypes.js";
import { determineAnchorType } from "./determineAnchorType.js";
import { resolvePath } from "./resolvePath.js";
import { resolveWikiPath } from "./resolveWikiPath.js";

/**
 * Factory function for creating LinkObject instances.
 * Single source of truth for link object construction.
 * Handles path resolution, anchor type classification, and structure.
 *
 * @param params - Link parameters including type, scope, anchor, path, and metadata
 * @returns Fully constructed LinkObject with resolved paths and anchor type
 */
export function createLinkObject(params: {
	linkType: "markdown" | "wiki";
	scope: "internal" | "cross-document";
	anchor: string | null;
	rawPath: string | null;
	sourceAbsolutePath: string;
	text: string | null;
	fullMatch: string;
	line: number;
	column: number;
	extractionMarker: { fullMatch: string; innerText: string } | null;
	fileCache: FileCache;
}): LinkObject {
	const anchorType = params.anchor ? determineAnchorType(params.anchor) : null;

	// Wiki resolution applies only to bare page names (no .md extension, no path separator).
	// Links like [[target-doc.md#section]] already specify a filename and resolve via resolvePath.
	let absolutePath: string | null;
	let attempted: readonly string[] | undefined;
	let suggestions: readonly string[] | undefined;
	if (
		params.linkType === "wiki" &&
		params.rawPath !== null &&
		!params.rawPath.includes("/") &&
		!params.rawPath.endsWith(".md")
	) {
		// Defense-in-depth: JS callers may omit fileCache — fail loudly rather than silently wrong
		if ((params.fileCache as FileCache | undefined) === undefined) {
			throw new Error(
				`createLinkObject: wiki link [[${params.rawPath}]] cannot be resolved — FileCache not injected`,
			);
		}
		const wikiResolved = resolveWikiPath(
			params.rawPath,
			params.sourceAbsolutePath,
			params.fileCache,
		);
		if (wikiResolved.resolved) {
			absolutePath = wikiResolved.absolutePath;
		} else {
			absolutePath = null;
			// Surface attempted paths so the validator can render both forms in error.
			attempted = wikiResolved.attempted;
			// Surface Levenshtein suggestions (D4) so the validator can build validation.suggestion.
			suggestions = wikiResolved.suggestions;
		}
	} else {
		absolutePath = params.rawPath
			? resolvePath(params.rawPath, params.sourceAbsolutePath)
			: null;
	}
	const relativePath =
		absolutePath && params.sourceAbsolutePath
			? relative(dirname(params.sourceAbsolutePath), absolutePath)
			: null;

	return {
		linkType: params.linkType,
		scope: params.scope,
		anchorType,
		source: { path: { absolute: params.sourceAbsolutePath } },
		target: {
			path: {
				raw: params.rawPath,
				absolute: absolutePath,
				relative: relativePath,
				...(attempted && { attempted }),
				...(suggestions && { suggestions }),
			},
			anchor: params.anchor,
		},
		text: params.text,
		fullMatch: params.fullMatch,
		line: params.line,
		column: params.column,
		extractionMarker: params.extractionMarker,
	};
}
