/**
 * Component Factory - Dependency injection and component creation
 *
 * Provides factory functions for creating citation-manager components with proper
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
import { CitationValidator } from "../CitationValidator.js";
import { FileCache } from "../FileCache.js";
import { MarkdownParser } from "../MarkdownParser.js";
import { ParsedFileCache } from "../ParsedFileCache.js";

/**
 * Create markdown parser with file system dependency
 *
 * @returns {MarkdownParser} Parser instance configured with Node.js fs module
 */
export function createMarkdownParser() {
	return new MarkdownParser(fs);
}

/**
 * Create file cache with file system and path dependencies
 *
 * @returns {FileCache} Cache instance configured with Node.js fs and path modules
 */
export function createFileCache() {
	return new FileCache(fs, path);
}

/**
 * Create parsed file cache with optional parser dependency override
 *
 * If no parser provided, creates default MarkdownParser. This enables test
 * scenarios to inject mock parsers while production code uses defaults.
 *
 * @param {MarkdownParser|null} [parser=null] - Optional parser instance for testing
 * @returns {ParsedFileCache} Cache instance configured with parser
 */
export function createParsedFileCache(parser = null) {
	const _parser = parser || createMarkdownParser();
	return new ParsedFileCache(_parser);
}

/**
 * Create citation validator with optional dependency overrides
 *
 * Wires together ParsedFileCache and FileCache dependencies. If not provided,
 * creates default instances. This is the main entry point for production code
 * while supporting full dependency injection for testing.
 *
 * @param {ParsedFileCache|null} [parsedFileCache=null] - Optional cache for testing
 * @param {FileCache|null} [fileCache=null] - Optional file cache for testing
 * @returns {CitationValidator} Validator instance with all dependencies wired
 */
export function createCitationValidator(
	parsedFileCache = null,
	fileCache = null,
) {
	const _parsedFileCache = parsedFileCache || createParsedFileCache();
	const _fileCache = fileCache || createFileCache();
	return new CitationValidator(_parsedFileCache, _fileCache);
}
