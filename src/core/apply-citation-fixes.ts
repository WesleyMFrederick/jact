/**
 * apply-citation-fixes — file-I/O, timestamped-backup, and diff-rendering
 * logic for JactCli.fix().
 *
 * Extracted from JactCli (issue: god-class — JactCli bundled scope
 * resolution, validation orchestration, extraction, AND fix orchestration
 * in one 630-line class). JactCli.fix() is now a thin facade that delegates
 * here; no behavior change.
 */

import { readFileSync, writeFileSync } from "node:fs";
import type { FileCache } from "../FileCache.js";
import type { CliValidateOptions } from "../types/contentExtractorTypes.js";
import type {
	EnrichedLinkObject,
	FixRecord,
} from "../types/validationTypes.js";
import type { CitationValidator } from "./CitationValidator/CitationValidator.js";
import { applyAnchorFix, applyPathConversion } from "./citationFixer.js";

/** Dependencies apply-citation-fixes reads from JactCli — same instances, not copies. */
export interface ApplyCitationFixesDeps {
	validator: CitationValidator;
	fileCache: FileCache;
}

/** fs functions fix() can override for test isolation, matching JactCli.fix()'s `_fs` param. */
export interface FixFsOverrides {
	readFileSync?: (p: string, enc: BufferEncoding) => string;
	writeFileSync?: (p: string, data: string, enc: BufferEncoding) => void;
}

/**
 * Validate citations in filePath, auto-fix path/anchor issues, write in-place.
 *
 * Safety features:
 * - Writes a timestamped `.bak` backup before any file mutation.
 * - When `options.dryRun` is true, returns a diff without writing any files.
 * - Fails fast with a clear error if path corrections are needed but `options.scope` is absent.
 *
 * @param deps - Shared JactCli instances (validator, fileCache) this needs
 * @param filePath - Path to the markdown file to fix
 * @param options - Fix options (scope, dryRun, etc.)
 * @param _fs - Optional fs overrides for testing (read/write functions)
 * @returns Fix report string, dry-run diff string, or error string
 */
export async function applyCitationFixes(
	deps: ApplyCitationFixesDeps,
	filePath: string,
	options: CliValidateOptions = {},
	_fs?: FixFsOverrides,
): Promise<string> {
	const fsRead = _fs?.readFileSync ?? readFileSync;
	const fsWrite = _fs?.writeFileSync ?? writeFileSync;
	try {
		if (options.scope) {
			const cacheStats = deps.fileCache.buildCache(
				options.scope,
				false,
				undefined,
				{
					respectGitignore: !options.allowGitignore,
				},
			);
			console.log(
				`Scanned ${cacheStats.totalFiles} files in ${cacheStats.scopeFolder}`,
			);
			if (cacheStats.duplicates > 0) {
				console.log(
					`WARNING: Found ${cacheStats.duplicates} duplicate filenames`,
				);
			}
		}
		const validationResults = await deps.validator.validateFile(filePath);
		const fixableLinks = validationResults.links.filter(
			(link: EnrichedLinkObject) =>
				(link.validation.status === "warning" &&
					link.validation.pathConversion) ||
				(link.validation.status === "error" &&
					link.validation.suggestion &&
					(link.validation.suggestion.includes(
						"Use raw header format for better Obsidian compatibility",
					) ||
						(link.validation.error.startsWith("Anchor not found") &&
							link.validation.suggestion.includes("Available headers:")))),
		);
		if (fixableLinks.length === 0) {
			return `No auto-fixable citations found in ${filePath}`;
		}

		// Scope boundary check: path corrections require scope to resolve filenames.
		// Anchor-only fixes are safe without scope.
		const needsPathFix = fixableLinks.some(
			(link) =>
				link.validation.status !== "valid" && link.validation.pathConversion,
		);
		if (needsPathFix && !options.scope) {
			return `ERROR: Path corrections require --scope. Re-run with --scope <folder> to enable filename resolution.`;
		}

		const originalContent = fsRead(filePath, "utf8");
		let fileContent = originalContent;
		let fixesApplied = 0;
		let pathFixesApplied = 0;
		let anchorFixesApplied = 0;
		const fixes: FixRecord[] = [];
		for (const link of fixableLinks) {
			let newCitation = link.fullMatch;
			let fixType = "";
			if (
				link.validation.status !== "valid" &&
				link.validation.pathConversion
			) {
				newCitation = applyPathConversion(
					newCitation,
					link.validation.pathConversion,
				);
				pathFixesApplied++;
				fixType = "path";
			}
			if (
				link.validation.status === "error" &&
				link.validation.suggestion &&
				(link.validation.suggestion.includes(
					"Use raw header format for better Obsidian compatibility",
				) ||
					(link.validation.error.startsWith("Anchor not found") &&
						link.validation.suggestion.includes("Available headers:")))
			) {
				newCitation = applyAnchorFix(newCitation, link);
				anchorFixesApplied++;
				fixType = fixType ? "path+anchor" : "anchor";
			}
			fileContent = fileContent.replace(link.fullMatch, newCitation);
			fixes.push({
				line: link.line,
				old: link.fullMatch,
				new: newCitation,
				type: fixType,
			});
			fixesApplied++;
		}
		if (fixesApplied > 0) {
			if (options.dryRun) {
				// Dry-run: print diff, do not write any files
				const output = [
					`DRY RUN — ${fixesApplied} fix${fixesApplied === 1 ? "" : "es"} would be applied to ${filePath}:`,
					"",
				];
				for (const fix of fixes) {
					output.push(`  Line ${fix.line} (${fix.type}):`);
					output.push(`    - ${fix.old}`);
					output.push(`    + ${fix.new}`);
					output.push("");
				}
				output.push("No files were written (--dry-run).");
				return output.join("\n");
			}

			// Write backup before mutating the file
			const backupPath = `${filePath}.${Date.now()}.bak`;
			fsWrite(backupPath, originalContent, "utf8");

			// Apply fix
			fsWrite(filePath, fileContent, "utf8");

			const output = [
				`Fixed ${fixesApplied} citation${fixesApplied === 1 ? "" : "s"} in ${filePath}:`,
				`  Backup written to: ${backupPath}`,
			];
			if (pathFixesApplied > 0)
				output.push(
					`   - ${pathFixesApplied} path correction${pathFixesApplied === 1 ? "" : "s"}`,
				);
			if (anchorFixesApplied > 0)
				output.push(
					`   - ${anchorFixesApplied} anchor correction${anchorFixesApplied === 1 ? "" : "s"}`,
				);
			output.push("", "Changes made:");
			for (const fix of fixes) {
				output.push(`  Line ${fix.line} (${fix.type}):`);
				output.push(`    - ${fix.old}`);
				output.push(`    + ${fix.new}`);
				output.push("");
			}
			return output.join("\n");
		}
		return `WARNING: Found ${fixableLinks.length} fixable citations but could not apply fixes`;
	} catch (error) {
		return `ERROR: ${error instanceof Error ? error.message : String(error)}`;
	}
}
