/**
 * Component Factory - Dependency injection and component creation
 *
 * Provides factory functions for creating jact components with proper
 * dependency injection. Enables testability by allowing dependency override while
 * providing sensible defaults for production use.
 *
 * Factory pattern benefits:
 * - Encapsulates dependency wiring complexity
 * - Allows mock injection for testing
 * - Provides consistent component initialization
 * - Supports optional dependency override
 *
 * @module componentFactory
 */

import fs from "node:fs";
import path from "node:path";
import { CitationValidator } from "../core/CitationValidator/CitationValidator.js";
import { ContentExtractor } from "../core/ContentExtractor/ContentExtractor.js";
import { CliFlagStrategy } from "../core/ContentExtractor/eligibilityStrategies/CliFlagStrategy.js";
import { ForceMarkerStrategy } from "../core/ContentExtractor/eligibilityStrategies/ForceMarkerStrategy.js";
import { SectionLinkStrategy } from "../core/ContentExtractor/eligibilityStrategies/SectionLinkStrategy.js";
import { StopMarkerStrategy } from "../core/ContentExtractor/eligibilityStrategies/StopMarkerStrategy.js";
import { MarkdownParser } from "../core/MarkdownParser/index.js";
import { FileCache } from "../FileCache.js";
import { ParsedFileCache } from "../ParsedFileCache.js";
import type {
	FileCacheLike,
	ParsedFileCacheLike,
} from "../types/componentInterfaces.js";
import type { ExtractionEligibilityStrategy } from "../types/contentExtractorTypes.js";

/**
 * Create markdown parser with file system dependency
 *
 * @param fileCache - Optional shared FileCache instance; creates a fresh one if omitted
 * @returns Parser instance configured with Node.js fs module
 */
export function createMarkdownParser(
	fileCache: FileCache = createFileCache(),
): MarkdownParser {
	return new MarkdownParser(fs, fileCache);
}

/**
 * Create file cache with file system and path dependencies
 *
 * @returns Cache instance configured with Node.js fs and path modules
 */
export function createFileCache(): FileCache {
	return new FileCache(fs, path);
}

/**
 * Create parsed file cache with optional parser dependency override
 *
 * If no parser provided, creates default MarkdownParser. This enables test
 * scenarios to inject mock parsers while production code uses defaults.
 *
 * @param parser - Optional parser instance for testing
 * @returns Cache instance configured with parser
 */
export function createParsedFileCache(
	parser: MarkdownParser | null = null,
): ParsedFileCache {
	const _parser = parser || createMarkdownParser();
	return new ParsedFileCache(_parser);
}

/**
 * Create citation validator with optional dependency overrides
 *
 * Wires together ParsedFileCacheLike and FileCacheLike dependencies. If not
 * provided, creates default production instances. Accepts interface types so
 * callers can inject test doubles without importing production classes.
 *
 * @param parsedFileCache - Optional cache (production or test double)
 * @param fileCache - Optional file cache (production or test double)
 * @returns Validator instance with all dependencies wired
 */
export function createCitationValidator(
	parsedFileCache: ParsedFileCacheLike | null = null,
	fileCache: FileCacheLike | null = null,
): CitationValidator {
	const _parsedFileCache = parsedFileCache || createParsedFileCache();
	const _fileCache = fileCache || createFileCache();
	return new CitationValidator(_parsedFileCache, _fileCache);
}

/**
 * Create ContentExtractor with eligibility strategies and dependencies.
 * Factory pattern for dependency injection.
 *
 * Precedence order (highest to lowest):
 * 1. StopMarkerStrategy - %%stop-extract-link%%
 * 2. ForceMarkerStrategy - %%force-extract%%
 * 3. SectionLinkStrategy - Anchors eligible by default
 * 4. CliFlagStrategy - --full-files flag (terminal)
 *
 * @param parsedFileCache - Optional cache for testing
 * @param citationValidator - Optional validator for testing
 * @param strategies - Optional strategy override
 * @returns Configured ContentExtractor instance
 */
export function createContentExtractor(
	parsedFileCache: ParsedFileCache | null = null,
	citationValidator: CitationValidator | null = null,
	strategies: ExtractionEligibilityStrategy[] | null = null,
): ContentExtractor {
	// Use provided dependencies or create defaults
	const _parsedFileCache = parsedFileCache || createParsedFileCache();
	const _citationValidator = citationValidator || createCitationValidator();
	const _strategies = strategies || [
		new StopMarkerStrategy(),
		new ForceMarkerStrategy(),
		new SectionLinkStrategy(),
		new CliFlagStrategy(),
	];

	// Instantiate ContentExtractor with ALL dependencies
	return new ContentExtractor(
		_strategies,
		_parsedFileCache,
		_citationValidator,
	);
}
