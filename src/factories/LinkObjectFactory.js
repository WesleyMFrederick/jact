import { resolve, relative, basename } from "node:path";

/**
 * LinkObjectFactory - Level 4 helper for CLI Orchestrator
 *
 * Pattern: Adapts CLI string inputs to LinkObject data contract
 * Boundary: Creates unvalidated LinkObjects for synthetic extraction workflows
 */
export class LinkObjectFactory {
	/**
	 * Create synthetic LinkObject for header extraction
	 *
	 * Integration: Produces LinkObject matching MarkdownParser output contract
	 * Pattern: CLI calls this before validator.validateSingleCitation()
	 *
	 * @param targetPath - Absolute or relative path to target file
	 * @param headerName - Exact header text to extract
	 * @returns Unvalidated LinkObject with anchorType: "header"
	 */
	createHeaderLink(targetPath, headerName) {
		// Boundary: Normalize path to absolute
		const absolutePath = resolve(targetPath);

		// Pattern: Create LinkObject structure matching parser contract
		return {
			linkType: "markdown",
			scope: "cross-document",
			anchorType: "header",
			source: {
				path: {
					absolute: process.cwd(), // CLI invocation directory
				},
			},
			target: {
				path: {
					raw: targetPath,
					absolute: absolutePath,
					relative: relative(process.cwd(), absolutePath),
				},
				anchor: headerName,
			},
			text: headerName,
			fullMatch: `[${headerName}](${targetPath}#${headerName})`,
			line: 0, // Synthetic links have no source line
			column: 0,
			extractionMarker: null,
			validation: null, // Will be enriched by validator
		};
	}

	/**
	 * Create synthetic LinkObject for full-file extraction
	 *
	 * Integration: Produces LinkObject for extract file subcommand (US2.5)
	 * Pattern: CLI calls this before validator.validateSingleCitation()
	 * Decision: anchorType: null signals full-file link
	 *
	 * @param targetPath - Absolute or relative path to target file
	 * @returns Unvalidated LinkObject with anchorType: null
	 */
	createFileLink(targetPath) {
		const absolutePath = resolve(targetPath);
		const fileName = basename(targetPath);

		return {
			linkType: "markdown",
			scope: "cross-document",
			anchorType: null, // Decision: null indicates full-file link
			source: {
				path: {
					absolute: process.cwd(),
				},
			},
			target: {
				path: {
					raw: targetPath,
					absolute: absolutePath,
					relative: relative(process.cwd(), absolutePath),
				},
				anchor: null, // No anchor for full-file links
			},
			text: fileName,
			fullMatch: `[${fileName}](${targetPath})`,
			line: 0,
			column: 0,
			extractionMarker: null,
			validation: null,
		};
	}
}
