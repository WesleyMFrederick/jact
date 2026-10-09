/**
 * apply-citation-fixes — file-I/O, timestamped-backup, and diff-rendering
 * logic for JactCli.fix().
 *
 * Extracted from JactCli (issue: god-class — JactCli bundled scope
 * resolution, validation orchestration, extraction, AND fix orchestration
 * in one 630-line class). JactCli.fix() is now a thin facade that delegates
 * here; no behavior change.
 */

import { randomUUID } from "node:crypto";
import {
	lstatSync,
	readFileSync,
	realpathSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import type { FileCache } from "../FileCache.js";
import type { ParsedFileCache } from "../ParsedFileCache.js";
import type { CliValidateOptions } from "../types/cli-types.js";
import type { RuleEdit, RuleSetResolver } from "../types/validationRuleTypes.js";
import type {
	EnrichedLinkObject,
	FixRecord,
} from "../types/validationTypes.js";
import { VALIDATION_DISABLED_REASON } from "../validate/validation-disable.js";
import { OBSIDIAN_DROPPED_CHARS_ERROR } from "./CitationValidator/AnchorMatcher.js";
import type { CitationValidator } from "./CitationValidator/CitationValidator.js";
import { applyAnchorFix, applyPathConversion } from "./citationFixer.js";
import { findPlainFilePaths, resolvePlainFilePath } from "./plain-file-paths.js";
import { resolveScope } from "./resolveScope.js";
import { runRules } from "./ValidationRules/runRules.js";

/** Dependencies apply-citation-fixes reads from JactCli — same instances, not copies. */
export interface ApplyCitationFixesDeps {
	validator: CitationValidator;
	fileCache: FileCache;
	parsedDocuments: ParsedFileCache;
	/** Enabled validation rules per file. */
	resolveRuleSet: RuleSetResolver;
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
 * Write the fixed content safely and return the backup path, or null.
 *
 * The target must be a regular file, not a symbolic link. Its real path must
 * be inside the real scope root. The backup never replaces an existing path.
 * The new content goes to a temporary file in the same folder. A rename then
 * replaces the target in one step.
 */
function writeFixedFile(
	filePath: string,
	scopeRoot: string,
	originalContent: string,
	fixedContent: string,
	backup: boolean,
): string | null {
	const stats = lstatSync(filePath);
	if (stats.isSymbolicLink()) {
		throw new Error(
			`Refused: ${filePath} is a symbolic link. jact --fix does not write through links.`,
		);
	}
	const realFile = realpathSync(filePath);
	const realRoot = realpathSync(scopeRoot);
	const relative = path.relative(realRoot, realFile);
	if (
		relative === ".." ||
		relative.startsWith(`..${path.sep}`) ||
		path.isAbsolute(relative)
	) {
		throw new Error(
			`Refused: ${filePath} is outside the scope ${realRoot}. Pass --scope with a folder that contains the file.`,
		);
	}
	const mode = stats.mode & 0o777;

	// The "wx" flag fails when the path exists, also when it is a symbolic link.
	const backupPath = backup ? `${filePath}.${Date.now()}.bak` : null;
	if (backupPath !== null) {
		try {
			writeFileSync(backupPath, originalContent, { flag: "wx", mode });
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "EEXIST") {
				throw new Error(
					`Refused: backup path ${backupPath} already exists. jact --fix does not replace it.`,
				);
			}
			throw error;
		}
	}

	const tempPath = path.join(
		path.dirname(realFile),
		`.${path.basename(realFile)}.${randomUUID()}.tmp`,
	);
	try {
		writeFileSync(tempPath, fixedContent, { flag: "wx", mode });
		renameSync(tempPath, realFile);
	} catch (error) {
		rmSync(tempPath, { force: true });
		throw error;
	}
	return backupPath;
}

/**
 * Validate citations in filePath, auto-fix path/anchor issues, write in-place.
 *
 * Safety features:
 * - Refuses to write through symbolic links or outside the scope root.
 * - Writes a timestamped `.bak` backup before any file mutation, unless `options.backup` is false.
 * - Skips fixes that leave a citation unchanged; they are not counted or reported.
 * - When `options.dryRun` is true, returns a diff without writing any files.
 * - Fails fast with a clear error if path corrections are needed but `options.scope` is absent.
 *
 * @param deps - Shared JactCli instances (validator, fileCache) this needs
 * @param filePath - Path to the markdown file to fix
 * @param options - Fix options (scope, dryRun, etc.)
 * @returns Fix report string, dry-run diff string, or error string
 */
export async function applyCitationFixes(
	deps: ApplyCitationFixesDeps,
	filePath: string,
	options: CliValidateOptions = {},
): Promise<string> {
	const fsRead = readFileSync;
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
		const ruleSet = await deps.resolveRuleSet(filePath);
		const validationResults = runRules(
			ruleSet,
			filePath,
			document.data,
			await deps.validator.validateDocument(document, filePath, {
				ruleIds: ruleSet.enabled,
			}),
		);
		const ruleFixes = (validationResults.findings ?? []).flatMap((finding) =>
			finding.edits !== undefined && finding.edits.length > 0
				? [{ ...finding, edits: finding.edits }]
				: [],
		);
		const ruleEdits = ruleFixes.flatMap((finding) => finding.edits);
		const originalContent = fsRead(filePath, "utf8");
		const scope = resolveScope({
			cwd: process.cwd(), targetFile: filePath,
			...(options.scope !== undefined && { explicit: options.scope }),
		});
		// Plain text is not a reference: only resolved prose `.md` paths become links.
		const plainFixes = scope.source === "none"
			? []
			: findPlainFilePaths(originalContent)
				.filter((reference) =>
					reference.context === "prose" && reference.path.toLowerCase().endsWith(".md"))
				.map((reference) => ({
					reference,
					resolution: resolvePlainFilePath(reference, filePath, scope.scope),
				}))
				.filter(({ resolution }) => resolution.target !== null);
		const fixableLinks = validationResults.links.filter(
			(link: EnrichedLinkObject) =>
				(link.validation.status === "warning" &&
					link.validation.pathConversion) ||
				isAnchorFixable(link),
		);
		if (fixableLinks.length === 0 && plainFixes.length === 0 && ruleFixes.length === 0) {
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


		let fileContent = originalContent;
		let fixesApplied = 0;
		let pathFixesApplied = 0;
		let anchorFixesApplied = 0;
		const fixes: FixRecord[] = [];
		const edits: RuleEdit[] = [];
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
			const end = start + link.fullMatch.length;
			// A rule edit that rewrites or deletes this citation already folds in its fix.
			if (ruleEdits.some((edit) => edit.start <= start && end <= edit.end)) continue;
			if (pathChanged) pathFixesApplied++;
			if (anchorChanged) anchorFixesApplied++;
			edits.push({ start, end, replacement: newCitation });
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
			const anchor = reference.suffix.startsWith("#") ? reference.suffix : "";
			const destination = relative.split(path.sep).map(encodeURIComponent).join("/") + anchor;
			const replacement = `[${reference.raw}](${destination})`;
			edits.push({ start: reference.start, end: reference.end, replacement });
			fixes.push({ line: reference.line, old: reference.raw, new: replacement, type: "plain-path" });
			fixesApplied++;
		}
		edits.push(...ruleEdits);
		for (const finding of ruleFixes) {
			fixes.push({
				line: finding.line,
				old: finding.source ?? "",
				new: finding.edits[0]?.replacement ?? "",
				type: finding.ruleId,
			});
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
				return output.join("\n");
			}

			const scopeRoot =
				options.scope ??
				resolveScope({ cwd: process.cwd(), targetFile: filePath }).scope;
			if (scopeRoot === "") {
				return `ERROR: Refused: cannot resolve a scope for ${filePath}. Pass --scope <folder>.`;
			}
			const backupPath = writeFixedFile(
				filePath,
				scopeRoot,
				originalContent,
				fileContent,
				options.backup !== false,
			);

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
			return output.join("\n");
		}
		return `No auto-fixable citations found in ${filePath}`;
	} catch (error) {
		return `ERROR: ${error instanceof Error ? error.message : String(error)}`;
	}
}
