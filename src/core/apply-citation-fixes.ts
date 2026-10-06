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
import path from "node:path";
import type { FileCache } from "../FileCache.js";
import type { ParsedFileCache } from "../ParsedFileCache.js";
import type { CliValidateOptions } from "../types/cli-types.js";
import type {
	EnrichedLinkObject,
	FixRecord,
} from "../types/validationTypes.js";
import { OBSIDIAN_DROPPED_CHARS_ERROR } from "./CitationValidator/AnchorMatcher.js";
import type { CitationValidator } from "./CitationValidator/CitationValidator.js";
import { applyAnchorFix, applyPathConversion } from "./citationFixer.js";
import { VALIDATION_DISABLED_REASON } from "../validate/validation-disable.js";
import { findPlainFilePaths, resolvePlainFilePath } from "./plain-file-paths.js";
import { resolveScope } from "./resolveScope.js";

/** Dependencies apply-citation-fixes reads from JactCli — same instances, not copies. */
export interface ApplyCitationFixesDeps {
	validator: CitationValidator;
	fileCache: FileCache;
	parsedDocuments: ParsedFileCache;
}

/** fs functions fix() can override for test isolation, matching JactCli.fix()'s `_fs` param. */
export interface FixFsOverrides {
	readFileSync?: (p: string, enc: BufferEncoding) => string;
	writeFileSync?: (p: string, data: string, enc: BufferEncoding) => void;
}

/** True when the validator reported an anchor error that `--fix` can rewrite. */
const isAnchorFixable = (link: EnrichedLinkObject): boolean =>
	link.validation.status === "error" &&
	(link.validation.error.includes(OBSIDIAN_DROPPED_CHARS_ERROR) ||
		(link.validation.suggestion !== undefined &&
			(link.validation.suggestion.includes(
				"Use raw header format for better Obsidian compatibility",
			) ||
				(link.validation.error.startsWith("Anchor not found") &&
					link.validation.suggestion.includes("Available headers:")))));

/**
 * Validate citations in filePath, auto-fix path/anchor issues, write in-place.
 *
 * Safety features:
 * - Writes a timestamped `.bak` backup before any file mutation, unless `options.backup` is false.
 * - Skips fixes that leave a citation unchanged; they are not counted or reported.
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
		const document = await deps.parsedDocuments.resolveDocument({
			kind: "file",
			filePath,
		});
		if (document.data.validationDisabled) {
			return `SKIPPED: ${VALIDATION_DISABLED_REASON}`;
		}
		const validationResults = await deps.validator.validateDocument(
			document,
			filePath,
		);
		const originalContent = fsRead(filePath, "utf8");
		const plainReferences = findPlainFilePaths(originalContent);
		const scope = resolveScope({
			cwd: process.cwd(), targetFile: filePath,
			...(options.scope !== undefined && { explicit: options.scope }),
		});
		if (plainReferences.length > 0 && scope.source === "none") {
			throw new Error("Cannot resolve plain file paths without a scope. Pass --scope <dir>.");
		}
		const plainPaths = plainReferences.map((reference) => ({
			reference,
			resolution: resolvePlainFilePath(reference, filePath, scope.scope),
		}));
		const unresolved = plainPaths.filter(({ resolution }) => resolution.target === null);
		const diagnostics = unresolved.length === 0 ? "" : `\n\nUnresolved plain file paths:\n${unresolved.map(({ reference, resolution }) =>
			`  Line ${reference.line}: ${resolution.candidates.length > 1
				? `Ambiguous plain file path: ${reference.raw}. Candidates: ${resolution.candidates.join(", ")}`
				: `File not found: ${reference.path}`}`,
		).join("\n")}`;
		const plainFixes = plainPaths.filter(({ reference, resolution }) =>
			reference.context === "prose" && reference.path.toLowerCase().endsWith(".md") &&
			resolution.target !== null,
		);
		const fixableLinks = validationResults.links.filter(
			(link: EnrichedLinkObject) =>
				(link.validation.status === "warning" &&
					link.validation.pathConversion) ||
				isAnchorFixable(link),
		);
		if (fixableLinks.length === 0 && plainFixes.length === 0) {
			return `No auto-fixable citations found in ${filePath}${diagnostics}`;
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

		let fileContent = originalContent;
		let fixesApplied = 0;
		let pathFixesApplied = 0;
		let anchorFixesApplied = 0;
		const fixes: FixRecord[] = [];
		const edits: { start: number; end: number; replacement: string }[] = [];
		const lineStarts = [0];
		for (let index = 0; index < originalContent.length; index++) {
			if (originalContent[index] === "\n") lineStarts.push(index + 1);
		}
		for (const link of fixableLinks) {
			const pathCitation =
				link.validation.status !== "valid" && link.validation.pathConversion
					? applyPathConversion(link.fullMatch, link.validation.pathConversion)
					: link.fullMatch;
			const newCitation = isAnchorFixable(link)
				? applyAnchorFix(pathCitation, link)
				: pathCitation;
			// A fix that leaves the citation unchanged is not a fix: skip it.
			if (newCitation === link.fullMatch) continue;
			const pathChanged = pathCitation !== link.fullMatch;
			const anchorChanged = newCitation !== pathCitation;
			if (pathChanged) pathFixesApplied++;
			if (anchorChanged) anchorFixesApplied++;
			const lineStart = lineStarts[link.line - 1];
			const start = lineStart === undefined ? -1 : lineStart + link.column;
			if (
				!Number.isInteger(link.line) || link.line < 1 ||
				!Number.isInteger(link.column) || link.column < 0 ||
				lineStart === undefined ||
				start >= (lineStarts[link.line] ?? originalContent.length) ||
				originalContent.slice(start, start + link.fullMatch.length) !== link.fullMatch
			) {
				throw new Error(`Citation changed at line ${link.line}; no files were written.`);
			}
			edits.push({ start, end: start + link.fullMatch.length, replacement: newCitation });
			fixes.push({
				line: link.line,
				old: link.fullMatch,
				new: newCitation,
				type:
					pathChanged && anchorChanged
						? "path+anchor"
						: pathChanged
							? "path"
							: "anchor",
			});
			fixesApplied++;
		}
		for (const { reference, resolution } of plainFixes) {
			// Make the link note-relative even when the original resolved from scope.
			const relative = path.relative(path.dirname(path.resolve(filePath)), resolution.target ?? "");
			const destination = relative.split(path.sep).map(encodeURIComponent).join("/") + reference.suffix;
			const replacement = `[${reference.raw}](${destination})`;
			edits.push({ start: reference.start, end: reference.end, replacement });
			fixes.push({ line: reference.line, old: reference.raw, new: replacement, type: "plain-path" });
			fixesApplied++;
		}
		let nextEditStart = originalContent.length;
		for (const edit of edits.sort((left, right) => right.start - left.start)) {
			if (edit.end > nextEditStart) {
				throw new Error("Citation fixes overlap; no files were written.");
			}
			nextEditStart = edit.start;
			fileContent = fileContent.slice(0, edit.start) + edit.replacement + fileContent.slice(edit.end);
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
				return output.join("\n") + diagnostics;
			}

			// Write backup before mutating the file, unless --no-backup
			const backupPath =
				options.backup === false ? null : `${filePath}.${Date.now()}.bak`;
			if (backupPath !== null) fsWrite(backupPath, originalContent, "utf8");

			// Apply fix
			fsWrite(filePath, fileContent, "utf8");

			const output = [
				`Fixed ${fixesApplied} citation${fixesApplied === 1 ? "" : "s"} in ${filePath}:`,
				backupPath === null
					? "  No backup written (--no-backup)."
					: `  Backup written to: ${backupPath}`,
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
			return output.join("\n") + diagnostics;
		}
		return `No auto-fixable citations found in ${filePath}${diagnostics}`;
	} catch (error) {
		return `ERROR: ${error instanceof Error ? error.message : String(error)}`;
	}
}
