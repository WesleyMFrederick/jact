import {
	createCitationValidator,
	createContentExtractor,
	createFileCache,
	createMarkdownParser,
	createParsedFileCache,
} from "../../src/factories/componentFactory.js";
import { ReadBoundary } from "../../src/core/ContentExtractor/readBoundary.js";

/** Boundary that permits every path. Unit tests do not exercise confinement. */
export const OPEN_READ_BOUNDARY = new ReadBoundary(["/"]);

export function createCitationHarness(overrides = {}) {
	const fileCache = overrides.fileCache ?? createFileCache();
	const parser = overrides.parser ?? createMarkdownParser(fileCache);
	const parsedDocuments =
		overrides.parsedDocuments ?? createParsedFileCache(parser);
	const validator =
		overrides.validator ?? createCitationValidator(parsedDocuments, fileCache);
	return {
		fileCache,
		parser,
		parsedDocuments,
		validator,
		validateDocumentFile: (filePath) =>
			validateDocumentFile(validator, parsedDocuments, filePath),
	};
}

export async function validateDocumentFile(
	validator,
	parsedDocuments,
	filePath,
) {
	const document = await parsedDocuments.resolveDocument({
		kind: "file",
		filePath,
	});
	return validator.validateDocument(document, filePath);
}

export async function extractDocumentLinks(
	{ extractor, validator, parsedDocuments },
	sourceFile,
	flags,
) {
	const validation = await validateDocumentFile(
		validator,
		parsedDocuments,
		sourceFile,
	);
	return extractor.extractContent(validation.links, flags, {
		readBoundary: OPEN_READ_BOUNDARY,
	});
}

export function createExtractionHarness(overrides = {}) {
	const citation = createCitationHarness(overrides);
	const extractor =
		overrides.extractor ??
		createContentExtractor(
			citation.parsedDocuments,
			overrides.strategies ?? null,
		);
	return {
		...citation,
		extractor,
		extractFile: (sourceFile, flags) =>
			extractDocumentLinks(
				{
					extractor,
					validator: citation.validator,
					parsedDocuments: citation.parsedDocuments,
				},
				sourceFile,
				flags,
			),
	};
}
