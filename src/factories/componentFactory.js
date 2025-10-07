import fs from 'node:fs';
import path from 'node:path';
import { CitationValidator } from '../CitationValidator.js';
import { MarkdownParser } from '../MarkdownParser.js';
import { FileCache } from '../FileCache.js';
import { ParsedFileCache } from '../ParsedFileCache.js';

export function createMarkdownParser() {
	return new MarkdownParser(fs);
}

export function createFileCache() {
	return new FileCache(fs, path);
}

export function createParsedFileCache(parser = null) {
	const _parser = parser || createMarkdownParser();
	return new ParsedFileCache(_parser);
}

export function createCitationValidator(parsedFileCache = null, fileCache = null) {
	const _parsedFileCache = parsedFileCache || createParsedFileCache();
	const _fileCache = fileCache || createFileCache();
	return new CitationValidator(_parsedFileCache, _fileCache);
}
