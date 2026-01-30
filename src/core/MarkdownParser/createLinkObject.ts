import { dirname, relative } from "node:path";
import type { LinkObject } from "../../types/citationTypes.js";
import { determineAnchorType } from "./determineAnchorType.js";
import { resolvePath } from "./resolvePath.js";

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
}): LinkObject {
	const anchorType = params.anchor ? determineAnchorType(params.anchor) : null;

	const absolutePath = params.rawPath
		? resolvePath(params.rawPath, params.sourceAbsolutePath)
		: null;
	const relativePath = absolutePath && params.sourceAbsolutePath
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
