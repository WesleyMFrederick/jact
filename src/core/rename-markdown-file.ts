import {
	chmodSync,
	copyFileSync,
	existsSync,
	readFileSync,
	realpathSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import type { FileCache } from "../FileCache.js";
import {
	createFileCache,
	createMarkdownParser,
	createParsedFileCache,
} from "../factories/componentFactory.js";
import type { ParsedFileCache } from "../ParsedFileCache.js";
import type { LinkObject } from "../types/citationTypes.js";
import type { CliRenameOptions } from "../types/cli-types.js";

export interface RenameMarkdownFileDeps {
	fileCache: FileCache;
	parsedDocuments: ParsedFileCache;
}

export interface RenameFileChange {
	path: string;
	links: number;
}

export interface RenameMarkdownFileResult {
	source: string;
	destination: string;
	scope: string;
	applied: boolean;
	links: number;
	files: RenameFileChange[];
	backups: string[];
}

export class RenameValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RenameValidationError";
	}
}

interface TextEdit {
	start: number;
	end: number;
	replacement: string;
}

interface PlannedFile extends RenameFileChange {
	original: string;
	updated: string;
}

function canonicalExisting(filePath: string): string {
	return realpathSync(filePath);
}

function isWithin(scope: string, candidate: string): boolean {
	const relative = path.relative(scope, candidate);
	return (
		relative === "" ||
		(!relative.startsWith(`..${path.sep}`) && relative !== "..")
	);
}

function decodedBasename(rawPath: string): string {
	const basename = rawPath.slice(
		Math.max(rawPath.lastIndexOf("/"), rawPath.lastIndexOf("\\")) + 1,
	);
	try {
		return decodeURIComponent(basename);
	} catch {
		return basename;
	}
}

function renamedRawPath(
	link: LinkObject,
	rawPath: string,
	newFilename: string,
): string {
	const citationAnchor =
		link.fullMatch.startsWith("[cite:") && rawPath.includes("#")
			? rawPath.slice(rawPath.indexOf("#"))
			: "";
	const filePath =
		citationAnchor === "" ? rawPath : rawPath.slice(0, -citationAnchor.length);
	const separator = Math.max(
		filePath.lastIndexOf("/"),
		filePath.lastIndexOf("\\"),
	);
	const prefix = filePath.slice(0, separator + 1);
	const oldBasename = decodedBasename(filePath);
	const keepsExtension = /\.md$/i.test(oldBasename);
	const nextBasename = keepsExtension
		? newFilename
		: newFilename.replace(/\.md$/i, "");

	if (link.linkType === "wiki" || link.fullMatch.startsWith("[cite:")) {
		return `${prefix}${nextBasename}${citationAnchor}`;
	}

	return `${prefix}${encodeURI(nextBasename)}`;
}

function destinationStart(link: LinkObject, rawPath: string): number {
	const fullMatch = link.fullMatch;
	let searchFrom: number;

	if (link.linkType === "wiki") {
		const opening = fullMatch.indexOf("[[");
		searchFrom = opening < 0 ? -1 : opening + 2;
	} else if (fullMatch.startsWith("[cite:")) {
		searchFrom = "[cite:".length;
	} else {
		const inlineBoundary = fullMatch.indexOf("](");
		const definitionBoundary = fullMatch.indexOf("]:");
		if (inlineBoundary >= 0) searchFrom = inlineBoundary + 2;
		else if (definitionBoundary >= 0) searchFrom = definitionBoundary + 2;
		else searchFrom = -1;
	}

	const start = searchFrom < 0 ? -1 : fullMatch.indexOf(rawPath, searchFrom);
	if (start < 0) {
		throw new RenameValidationError(
			`Cannot isolate the destination in a parsed link at ${link.source.path.absolute}:${link.line}. No files were changed.`,
		);
	}
	return start;
}

function rewriteLink(link: LinkObject, newFilename: string): string {
	const rawPath = link.target.path.raw;
	if (rawPath === null) {
		throw new RenameValidationError(
			`Parsed link has no destination at ${link.source.path.absolute}:${link.line}. No files were changed.`,
		);
	}
	const start = destinationStart(link, rawPath);
	return `${link.fullMatch.slice(0, start)}${renamedRawPath(link, rawPath, newFilename)}${link.fullMatch.slice(start + rawPath.length)}`;
}

function lineStarts(content: string): number[] {
	const starts = [0];
	for (let index = 0; index < content.length; index++) {
		if (content.charCodeAt(index) === 10) starts.push(index + 1);
	}
	return starts;
}

function linkOffset(link: LinkObject, starts: number[]): number {
	const start = starts[link.line - 1];
	if (start === undefined || link.column < 0) {
		throw new RenameValidationError(
			`Invalid parser position at ${link.source.path.absolute}:${link.line}. No files were changed.`,
		);
	}
	return start + link.column;
}

function applyEdits(
	content: string,
	edits: TextEdit[],
	filePath: string,
): string {
	let updated = content;
	let previousStart = content.length + 1;
	for (const edit of edits.sort((left, right) => right.start - left.start)) {
		if (edit.end > previousStart) {
			throw new RenameValidationError(
				`Overlapping parsed links in ${filePath}. No files were changed.`,
			);
		}
		updated = `${updated.slice(0, edit.start)}${edit.replacement}${updated.slice(edit.end)}`;
		previousStart = edit.start;
	}
	return updated;
}

function sameExistingFile(link: LinkObject, canonicalSource: string): boolean {
	const candidates: string[] = [];
	const absolute = link.target.path.absolute;
	if (absolute != null) {
		candidates.push(
			absolute.includes("#")
				? absolute.slice(0, absolute.indexOf("#"))
				: absolute,
		);
	}
	const raw = link.target.path.raw;
	const sourceAbsolute = link.source.path.absolute;
	if (raw != null && sourceAbsolute != null) {
		const rawWithoutAnchor = raw.includes("#")
			? raw.slice(0, raw.indexOf("#"))
			: raw;
		try {
			const decoded = decodeURI(rawWithoutAnchor);
			candidates.push(
				path.isAbsolute(decoded)
					? decoded
					: path.resolve(path.dirname(sourceAbsolute), decoded),
			);
		} catch {
			candidates.push(
				path.resolve(path.dirname(sourceAbsolute), rawWithoutAnchor),
			);
		}
	}
	for (const candidate of [...candidates]) {
		if (path.extname(candidate) === "") candidates.push(`${candidate}.md`);
	}
	for (const candidate of candidates) {
		if (!existsSync(candidate)) continue;
		try {
			if (canonicalExisting(candidate) === canonicalSource) return true;
		} catch {}
	}
	return false;
}

async function planFiles(
	deps: RenameMarkdownFileDeps,
	canonicalSource: string,
	newFilename: string,
): Promise<PlannedFile[]> {
	const indexedFiles = deps.fileCache
		.getAllFiles()
		.map((entry) => entry.path)
		.sort((left, right) => left.localeCompare(right));
	const planned: PlannedFile[] = [];

	for (const filePath of indexedFiles) {
		const document = await deps.parsedDocuments.resolveDocument({
			kind: "file",
			filePath,
		});
		const matchingLinks = document.data.links.filter(
			(link) =>
				link.scope === "cross-document" &&
				sameExistingFile(link, canonicalSource),
		);
		if (matchingLinks.length === 0) continue;

		const content = document.data.content;
		const starts = lineStarts(content);
		const edits = matchingLinks.map((link): TextEdit => {
			const start = linkOffset(link, starts);
			const end = start + link.fullMatch.length;
			if (content.slice(start, end) !== link.fullMatch) {
				throw new RenameValidationError(
					`Parsed link text changed at ${filePath}:${link.line}. No files were changed.`,
				);
			}
			return { start, end, replacement: rewriteLink(link, newFilename) };
		});
		planned.push({
			path: filePath,
			links: matchingLinks.length,
			original: content,
			updated: applyEdits(content, edits, filePath),
		});
	}

	return planned;
}

function assertUnchanged(
	plannedFiles: PlannedFile[],
	source: string,
	destination: string,
): void {
	if (!existsSync(source)) {
		throw new Error(`Source disappeared before commit: ${source}`);
	}
	if (existsSync(destination)) {
		throw new Error(`Destination appeared before commit: ${destination}`);
	}
	for (const file of plannedFiles) {
		if (readFileSync(file.path, "utf8") !== file.original) {
			throw new Error(`File changed while planning: ${file.path}`);
		}
	}
}

function cleanup(paths: Iterable<string>): void {
	for (const filePath of paths) rmSync(filePath, { force: true });
}

async function verifyRelationships(
	files: PlannedFile[],
	source: string,
	destination: string,
	scope: string,
	allowGitignore: boolean,
): Promise<void> {
	const verificationCache = createFileCache();
	verificationCache.buildCache(scope, false, undefined, {
		respectGitignore: !allowGitignore,
		alwaysIncludeDir: path.dirname(destination),
	});
	const parser = createMarkdownParser(verificationCache);
	const documents = createParsedFileCache(parser);
	const canonicalDestination = canonicalExisting(destination);

	for (const file of files) {
		const finalPath = file.path === source ? destination : file.path;
		const document = await documents.resolveDocument({
			kind: "file",
			filePath: finalPath,
		});
		const resolved = document.data.links.filter(
			(link) =>
				link.scope === "cross-document" &&
				sameExistingFile(link, canonicalDestination),
		).length;
		if (resolved < file.links) {
			throw new Error(
				`Post-rename verification failed in ${finalPath}: expected ${file.links} updated links, found ${resolved}`,
			);
		}
	}
}

async function commitPlan(
	plannedFiles: PlannedFile[],
	source: string,
	destination: string,
	scope: string,
	allowGitignore: boolean,
): Promise<string[]> {
	assertUnchanged(plannedFiles, source, destination);
	const stamp = Date.now();
	const originalPaths = new Set([
		source,
		...plannedFiles.map((file) => file.path),
	]);
	const backups = new Map<string, string>();
	const staged = new Map<string, string>();
	let sourceRenamed = false;
	const committedFiles: string[] = [];

	try {
		for (const filePath of originalPaths) {
			const backup = `${filePath}.${stamp}.bak`;
			if (existsSync(backup))
				throw new Error(`Backup already exists: ${backup}`);
			copyFileSync(filePath, backup);
			backups.set(filePath, backup);
		}
		for (const file of plannedFiles) {
			const temporary = `${file.path}.jact-rename-${process.pid}-${stamp}.tmp`;
			if (existsSync(temporary))
				throw new Error(`Temporary file already exists: ${temporary}`);
			writeFileSync(temporary, file.updated, "utf8");
			chmodSync(temporary, statSync(file.path).mode);
			staged.set(file.path, temporary);
		}
	} catch (error) {
		cleanup(staged.values());
		cleanup(backups.values());
		throw error;
	}

	try {
		for (const file of plannedFiles) {
			const temporary = staged.get(file.path);
			if (temporary === undefined) {
				throw new Error(`Missing staged file for ${file.path}`);
			}
			renameSync(temporary, file.path);
			committedFiles.push(file.path);
		}
		renameSync(source, destination);
		sourceRenamed = true;
		await verifyRelationships(
			plannedFiles,
			source,
			destination,
			scope,
			allowGitignore,
		);
		return [...backups.values()];
	} catch (error) {
		cleanup(staged.values());
		try {
			if (sourceRenamed && existsSync(destination) && !existsSync(source)) {
				renameSync(destination, source);
			}
			for (const filePath of committedFiles.reverse()) {
				const backup = backups.get(filePath);
				if (backup !== undefined) copyFileSync(backup, filePath);
			}
		} catch (rollbackError) {
			throw new Error(
				`Rename failed (${String(error)}) and rollback failed (${String(rollbackError)}). Backups: ${[...backups.values()].join(", ")}`,
			);
		}
		throw new Error(`Rename failed and was rolled back: ${String(error)}`);
	}
}

export async function renameMarkdownFile(
	deps: RenameMarkdownFileDeps,
	sourceFile: string,
	newFilename: string,
	scopeFolder: string,
	options: CliRenameOptions = {},
): Promise<RenameMarkdownFileResult> {
	const source = path.resolve(sourceFile);
	if (!existsSync(source)) {
		throw new RenameValidationError(`Source file not found: ${source}`);
	}
	if (
		path.basename(newFilename) !== newFilename ||
		newFilename === "." ||
		newFilename === ".."
	) {
		throw new RenameValidationError(
			"The new name must be a filename, not a path. Moves are not supported.",
		);
	}
	if (!/\.md$/i.test(newFilename)) {
		throw new RenameValidationError("The new filename must end in .md.");
	}

	const canonicalSource = canonicalExisting(source);
	const canonicalScope = canonicalExisting(scopeFolder);
	if (!isWithin(canonicalScope, canonicalSource)) {
		throw new RenameValidationError(
			`Source is outside the rename scope: ${scopeFolder}`,
		);
	}
	const destination = path.join(path.dirname(source), newFilename);
	if (destination === source) {
		throw new RenameValidationError("The new filename is unchanged.");
	}
	if (existsSync(destination)) {
		throw new RenameValidationError(
			`Destination already exists: ${destination}`,
		);
	}

	const plannedFiles = await planFiles(deps, canonicalSource, newFilename);
	const links = plannedFiles.reduce((total, file) => total + file.links, 0);
	const backups = options.fix
		? await commitPlan(
				plannedFiles,
				source,
				destination,
				canonicalScope,
				options.allowGitignore === true,
			)
		: [];

	return {
		source,
		destination,
		scope: canonicalScope,
		applied: options.fix === true,
		links,
		files: plannedFiles.map(({ path: filePath, links: fileLinks }) => ({
			path: filePath === source ? destination : filePath,
			links: fileLinks,
		})),
		backups,
	};
}
