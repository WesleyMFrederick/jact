import fs from 'node:fs';
import path from 'node:path';
import { CitationValidator } from '../CitationValidator.js';
import { MarkdownParser } from '../MarkdownParser.js';
import { FileCache } from '../FileCache.js';

export function createMarkdownParser() {
	return new MarkdownParser(fs);
}

export function createFileCache() {
	return new FileCache(fs, path);
}

export function createCitationValidator(parser = null, fileCache = null) {
	const _parser = parser || createMarkdownParser();
	const _fileCache = fileCache || createFileCache();
	return new CitationValidator(_parser, _fileCache);
}
