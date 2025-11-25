// src/types/citationTypes.ts

import type { Token } from 'marked';

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
 */
export interface LinkObject {
	/** Raw markdown syntax as found in source */
	rawSourceLink: string;

	/** Link syntax type */
	linkType: "markdown" | "wiki";

	/** Link scope classification */
	scope: LinkScope;

	/** Target resolution */
	target: {
		path: {
			/** Raw path string from markdown */
			raw: string;
			/** Absolute file system path (null if unresolved) */
			absolute: string | null;
			/** Relative path from source file (null if unresolved) */
			relative: string | null;
		};
		/** Header/block anchor (null if no anchor) */
		anchor: string | null;
	};

	/** Display text shown in markdown */
	text: string;

	/** Complete matched markdown syntax */
	fullMatch: string;

	/** Source file line number (1-based) */
	line: number;

	/** Source file column number (0-based) */
	column: number;

	/** Validation metadata (enriched during validation) */
	validation?: ValidationMetadata;
}

/**
 * Validation metadata enriched during validation.
 * Integration: Added by CitationValidator during validateFile.
 *
 * Pattern: Optional enrichment prevents coupling parser to validator.
 */
export interface ValidationMetadata {
	/** Validation outcome status */
	status: ValidationStatus;

	/** Target file exists on disk */
	fileExists: boolean;

	/** Target anchor exists in file (null if no anchor specified) */
	anchorExists: boolean | null;

	/** Suggested corrections for errors (empty for valid) */
	suggestions?: string[];

	/** Path conversion info for cross-references */
	pathConversion?: string;
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
			/** Anchor type classification */
			anchorType: "header";

			/** Anchor identifier (raw heading text) */
			id: string;

			/** URL-encoded ID for Obsidian compatibility (always present for headers) */
			urlEncodedId: string;

			/** Original heading text */
			rawText: string;

			/** Full matched pattern from source */
			fullMatch: string;

			/** Source file line number (1-based) */
			line: number;

			/** Source file column number (1-based) */
			column: number;
	  }
	| {
			/** Anchor type classification */
			anchorType: "block";

			/** Anchor identifier (block ID like 'FR1' or '^my-anchor') */
			id: string;

			/** Always null for block anchors */
			rawText: null;

			/** Full matched pattern from source */
			fullMatch: string;

			/** Source file line number (1-based) */
			line: number;

			/** Source file column number (1-based) */
			column: number;
	  };

/**
 * Heading object extracted from marked.js token structure.
 * Created by MarkdownParser.extractHeadings().
 */
export interface HeadingObject {
	/** Heading depth (1-6) */
	level: number;

	/** Heading text content */
	text: string;

	/** Raw markdown including # symbols */
	raw: string;
}

/**
 * Parser output contract from MarkdownParser.parseFile().
 * Contains complete structural representation of a markdown document.
 */
export interface ParserOutput {
	/** Absolute path of parsed file */
	filePath: string;

	/** Full raw content string */
	content: string;

	/** Tokenized markdown AST from marked.js */
	tokens: Token[];

	/** All outgoing links found in document */
	links: LinkObject[];

	/** All headings extracted from document structure */
	headings: HeadingObject[];

	/** All anchors (potential link targets) in document */
	anchors: AnchorObject[];
}
