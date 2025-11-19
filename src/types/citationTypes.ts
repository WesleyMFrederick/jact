// src/types/citationTypes.ts

/**
 * Link scope classification for citation validation.
 * Decision: Discriminated union prevents invalid scope values.
 */
export type LinkScope = 'internal' | 'external';

/**
 * Citation validation status.
 * Decision: Three-state model (valid/warning/error) matches UI requirements.
 */
export type ValidationStatus = 'valid' | 'warning' | 'error';

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
  linkType: 'markdown' | 'wiki';

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
