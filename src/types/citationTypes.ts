// src/types/citationTypes.ts

import type { Root } from "mdast";
import type { Position } from "unist";
import type { ValidationMetadata } from "./validationTypes.js";

/**
 * Link scope classification for citation validation.
 * Decision: Discriminated union prevents invalid scope values.
 */
export type LinkScope = "internal" | "cross-document";

/**
 * Citation validation status.
 * Decision: Three-state model (valid/warning/error) matches UI requirements.
 */
export type ValidationStatus = "valid" | "warning" | "error";

/**
 * Link object representing a markdown reference.
 * Integration: Created by LinkObjectFactory, consumed by CitationValidator.
 *
 * Pattern: Immutable data structure with optional validation enrichment.
 *
 * Note: Internal links (scope="internal") have null target.path values
 * since they reference anchors within the same document, not external files.
 */
export interface LinkObject {
	linkType: "markdown" | "wiki";

	scope: LinkScope;

	/** null when the link has no anchor */
	anchorType: "header" | "block" | null;

	source: {
		path: {
			absolute: string | null;
		};
	};

	target: {
		path: {
			/** null for internal links */
			raw: string | null;
			/** null if unresolved or internal */
			absolute: string | null;
			/** null if unresolved or internal */
			relative: string | null;
			/** Wiki resolver attempt log (raw, slug+.md) when wiki resolution failed; undefined for success/non-wiki */
			attempted?: readonly string[];
		};
		/** null when the link has no anchor */
		anchor: string | null;
	};

	/** null for caret references */
	text: string | null;

	fullMatch: string;

	/** 1-based */
	line: number;

	/** 0-based */
	column: number;

	/** null if no marker follows the link */
	extractionMarker: {
		fullMatch: string;
		innerText: string;
	} | null;

	/** enriched during validation */
	validation?: ValidationMetadata;
}

/**
 * Anchor object representing a potential link target in a markdown document.
 * Created by MarkdownParser.extractAnchors().
 *
 * Uses discriminated union to enforce conditional properties:
 * - Header anchors ALWAYS have urlEncodedId (Obsidian-compatible format)
 * - Block anchors NEVER have urlEncodedId property
 */
export type AnchorObject =
	| {
			anchorType: "header";

			/** raw heading text */
			id: string;

			/** URL-encoded id for Obsidian compatibility (always present for headers) */
			urlEncodedId: string;

			rawText: string;

			fullMatch: string;

			/** 1-based */
			line: number;

			/** 1-based */
			column: number;
	  }
	| {
			anchorType: "block";

			/** block id like 'FR1' or '^my-anchor' */
			id: string;

			rawText: null;

			fullMatch: string;

			/** 1-based */
			line: number;

			/** 1-based */
			column: number;
	  };

/**
 * Heading object extracted from the mdast tree.
 * Created by MarkdownParser.extractHeadings().
 */
export interface HeadingObject {
	/** 1-6 */
	level: number;

	text: string;

	/** raw markdown including # symbols */
	raw: string;

	/** source position from the mdast heading node (D3 — line numbers come from the tree, not a regex re-find) */
	position?: Position | undefined;
}

/**
 * Parser output contract from MarkdownParser.parseFile().
 * Contains complete structural representation of a markdown document.
 */
export interface ParserOutput {
	filePath: string;

	content: string;

	/** internal reader for the ParsedDocument facade (D-008) */
	ast: Root;

	links: LinkObject[];

	headings: HeadingObject[];

	/** potential link targets in the document */
	anchors: AnchorObject[];
}
