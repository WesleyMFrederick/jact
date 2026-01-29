import { resolve, relative, basename } from "node:path";
import type { LinkObject } from "../types/citationTypes.js";

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
	 * @param targetPath - Absolute or relative path to target file (must be non-empty)
	 * @param headerName - Exact header text to extract (must be non-empty)
	 * @returns Unvalidated LinkObject with anchorType: "header"
	 * @throws {Error} If targetPath or headerName is empty
	 */
	createHeaderLink(targetPath: string, headerName: string): LinkObject {
		// Defensive validation: reject empty inputs at CLI boundary
		if (!targetPath?.trim()) {
			throw new Error("targetPath cannot be empty");
		}
		if (!headerName?.trim()) {
			throw new Error("headerName cannot be empty");
		}

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
		};
	}

	/**
	 * Create synthetic LinkObject for full-file extraction
	 *
	 * Integration: Produces LinkObject for extract file subcommand (US2.5)
	 * Pattern: CLI calls this before validator.validateSingleCitation()
	 * Decision: anchorType: null signals full-file link
	 *
	 * @param targetPath - Absolute or relative path to target file (must be non-empty)
	 * @returns Unvalidated LinkObject with anchorType: null
	 * @throws {Error} If targetPath is empty
	 */
	createFileLink(targetPath: string): LinkObject {
		// Defensive validation: reject empty inputs at CLI boundary
		if (!targetPath?.trim()) {
			throw new Error("targetPath cannot be empty");
		}

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
		};
	}
}
