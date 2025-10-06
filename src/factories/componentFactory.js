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

export function createCitationValidator() {
	const parser = createMarkdownParser();
	const fileCache = createFileCache();
	return new CitationValidator(parser, fileCache);
}
