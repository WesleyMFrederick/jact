import {
	chmodSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	realpathSync,
	renameSync,
	rmdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import type { Root } from "mdast";
import { visit } from "unist-util-visit";
import type { FileCache } from "../FileCache.js";
import {
	createFileCache,
	createMarkdownParser,
	createParsedFileCache,
} from "../factories/componentFactory.js";
import type { ParsedFileCache } from "../ParsedFileCache.js";
import type { LinkObject } from "../types/citationTypes.js";
import type { CliRenameOptions } from "../types/cli-types.js";

export interface RenameMarkdownFilesDeps {
	fileCache: FileCache;
	parsedDocuments: ParsedFileCache;
}

/**
 * One rename request. `sources` are absolute paths to `.md` files or
 * directories (globs already expanded by the caller). `batch` is true when the
 * caller received more than one source or a glob: `destination` is then always
 * a directory and every source lands at `<destination>/<basename>`.
 */
export interface RenameRequest {
	sources: string[];
	destination: string;
	batch: boolean;
}

export interface RenameFileChange {
	path: string;
	links: number;
}

/** One planned file-system move. A directory move carries its whole tree. */
export interface RenameMove {
	kind: "file" | "directory";
	source: string;
	destination: string;
	/** Directory moves only: number of files (any type) carried by the move. */
	movedFiles?: number;
}

/**
 * Plan or outcome of a rename. `source`/`destination` are present only for a
 * single-file request, keeping the original single-file JSON shape.
 */
export interface RenameMarkdownFilesResult {
	source?: string;
	destination?: string;
	scope: string;
	applied: boolean;
	moves: RenameMove[];
	/** Missing destination directories, created (outermost first) on --fix. */
	directories: string[];
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
	expectedTargets: string[];
}

/** Internal move: canonical paths for checks, requested paths for reports. */
interface PlannedMove {
	kind: "file" | "directory";
	from: string;
	to: string;
	reportedFrom: string;
	reportedTo: string;
}

interface MovePlan {
	moves: PlannedMove[];
	/** Requested-form missing directories, outermost first. */
	directories: string[];
	/** Every moved file (any type): canonical old path → canonical new path. */
	moved: Map<string, string>;
	/** Every moved file: canonical old path → requested-form new path. */
	reported: Map<string, string>;
	/** Directory moves only: canonical source → number of files carried. */
	carried: Map<string, number>;
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

function rewrittenRawPath(
	link: LinkObject,
	rawPath: string,
	target: string,
	sourceAfterMove: string,
): string {
	const citationAnchor =
		link.fullMatch.startsWith("[cite:") && rawPath.includes("#")
			? rawPath.slice(rawPath.indexOf("#"))
			: "";
	const filePath =
		citationAnchor === "" ? rawPath : rawPath.slice(0, -citationAnchor.length);
	let decodedPath: string;
	try {
		decodedPath = decodeURI(filePath);
	} catch {
		decodedPath = filePath;
	}
	const keepsExtension = /\.md$/i.test(decodedBasename(filePath));
	const targetPath = path.isAbsolute(decodedPath)
		? target
		: path.relative(path.dirname(sourceAfterMove), target);
	const portablePath = targetPath.split(path.sep).join("/");
	const nextPath = keepsExtension
		? portablePath
		: portablePath.replace(/\.md$/i, "");

	if (link.linkType === "wiki" || link.fullMatch.startsWith("[cite:")) {
		return `${nextPath}${citationAnchor}`;
	}
	return encodeURI(nextPath);
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

function rewriteLink(
	link: LinkObject,
	target: string,
	sourceAfterMove: string,
): string {
	const rawPath = link.target.path.raw;
	if (rawPath === null) {
		throw new RenameValidationError(
			`Parsed link has no destination at ${link.source.path.absolute}:${link.line}. No files were changed.`,
		);
	}
	const start = destinationStart(link, rawPath);
	return `${link.fullMatch.slice(0, start)}${rewrittenRawPath(link, rawPath, target, sourceAfterMove)}${link.fullMatch.slice(start + rawPath.length)}`;
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

function existingTarget(link: LinkObject): string | null {
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
			return canonicalExisting(candidate);
		} catch {}
	}
	return null;
}

/** Canonical form of a path that may not exist yet: realpath of the nearest existing ancestor plus the rest. */
function canonicalPath(filePath: string): string {
	const missing: string[] = [];
	let current = path.resolve(filePath);
	while (!existsSync(current)) {
		const parent = path.dirname(current);
		if (parent === current) break;
		missing.unshift(path.basename(current));
		current = parent;
	}
	return path.join(canonicalExisting(current), ...missing);
}

function isDirectory(filePath: string): boolean {
	return existsSync(filePath) && statSync(filePath).isDirectory();
}

/** Every file under `directory`, without following directory symlinks. */
function filesUnder(directory: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...filesUnder(entryPath));
		else files.push(entryPath);
	}
	return files;
}

/** Maps a path through the planned moves (directory moves carry descendants). */
function pathAfterMoves(filePath: string, moves: PlannedMove[]): string {
	for (const move of moves) {
		if (filePath === move.from) return move.to;
		if (move.kind === "directory" && isWithin(move.from, filePath)) {
			return path.join(move.to, path.relative(move.from, filePath));
		}
	}
	return filePath;
}

function requestedDestination(
	request: RenameRequest,
	source: string,
	sourceIsDirectory: boolean,
): string {
	const destination = request.destination;
	if (request.batch) {
		const directory = path.resolve(destination);
		if (existsSync(directory) && !isDirectory(directory)) {
			throw new RenameValidationError(
				`Destination must be a directory when moving several sources: ${directory}`,
			);
		}
		return path.join(directory, path.basename(source));
	}
	if (sourceIsDirectory) {
		const resolved = path.resolve(destination);
		return isDirectory(resolved)
			? path.join(resolved, path.basename(source))
			: resolved;
	}
	const resolved =
		path.basename(destination) === destination
			? path.join(path.dirname(source), destination)
			: path.resolve(destination);
	if (
		isDirectory(resolved) ||
		destination.endsWith("/") ||
		destination.endsWith(path.sep)
	) {
		return path.join(resolved, path.basename(source));
	}
	if (!/\.md$/i.test(resolved)) {
		throw new RenameValidationError(
			"The destination must be a Markdown filename or a directory (existing, or ending in /).",
		);
	}
	return resolved;
}

/** Missing ancestors of `filePath`, outermost first; refuses a file in the way. */
function missingParents(filePath: string): string[] {
	const missing: string[] = [];
	let current = path.dirname(filePath);
	while (!existsSync(current)) {
		missing.unshift(current);
		const parent = path.dirname(current);
		if (parent === current) break;
		current = parent;
	}
	if (!statSync(current).isDirectory()) {
		throw new RenameValidationError(
			`Destination parent is not a directory: ${current}`,
		);
	}
	return missing;
}

function planMoves(
	request: RenameRequest,
	scopeFolder: string,
	canonicalScope: string,
): MovePlan {
	const moves: PlannedMove[] = [];
	const seenSources = new Set<string>();
	for (const requestedSource of request.sources) {
		if (!existsSync(requestedSource)) {
			throw new RenameValidationError(
				`Source file not found: ${requestedSource}`,
			);
		}
		const from = canonicalExisting(requestedSource);
		if (seenSources.has(from)) continue;
		seenSources.add(from);
		const sourceIsDirectory = statSync(from).isDirectory();
		if (!sourceIsDirectory && !/\.md$/i.test(from)) {
			throw new RenameValidationError(
				`Source is not a Markdown file or a directory: ${requestedSource}`,
			);
		}
		if (!isWithin(canonicalScope, from)) {
			throw new RenameValidationError(
				`Source is outside the rename scope: ${scopeFolder}`,
			);
		}
		const reportedTo = requestedDestination(
			request,
			requestedSource,
			sourceIsDirectory,
		);
		moves.push({
			kind: sourceIsDirectory ? "directory" : "file",
			from,
			to: canonicalPath(reportedTo),
			reportedFrom: requestedSource,
			reportedTo,
		});
	}

	for (const move of moves) {
		if (!isWithin(canonicalScope, move.to)) {
			throw new RenameValidationError(
				`Destination is outside the rename scope: ${move.to}`,
			);
		}
		if (move.to === move.from) {
			throw new RenameValidationError("The destination is unchanged.");
		}
		if (move.kind === "directory" && isWithin(move.from, move.to)) {
			throw new RenameValidationError(
				`Cannot move a directory into itself: ${move.from} -> ${move.to}`,
			);
		}
		if (existsSync(move.to)) {
			throw new RenameValidationError(
				`Destination already exists: ${move.to}`,
			);
		}
		for (const other of moves) {
			if (other === move) continue;
			if (other.kind === "directory" && isWithin(other.from, move.from)) {
				throw new RenameValidationError(
					`Sources overlap: ${move.from} is inside ${other.from}`,
				);
			}
			if (other.to === move.to) {
				throw new RenameValidationError(
					`Two sources map to the same destination ${move.to}: ${move.from}, ${other.from}`,
				);
			}
			if (other.kind === "directory" && isWithin(other.from, move.to)) {
				throw new RenameValidationError(
					`Destination ${move.to} is inside a directory being moved: ${other.from}`,
				);
			}
			if (other.kind === "directory" && isWithin(other.to, move.to)) {
				throw new RenameValidationError(
					`Destination ${move.to} is inside another destination: ${other.to}`,
				);
			}
		}
	}

	const directories = [
		...new Set(moves.flatMap((move) => missingParents(move.reportedTo))),
	].sort((left, right) => left.length - right.length);

	const moved = new Map<string, string>();
	const reported = new Map<string, string>();
	const carried = new Map<string, number>();
	for (const move of moves) {
		if (move.kind === "file") {
			moved.set(move.from, move.to);
			reported.set(move.from, move.reportedTo);
			continue;
		}
		const files = filesUnder(move.from);
		carried.set(move.from, files.length);
		for (const filePath of files) {
			const relative = path.relative(move.from, filePath);
			moved.set(filePath, path.join(move.to, relative));
			reported.set(filePath, path.join(move.reportedTo, relative));
		}
	}
	return { moves, directories, moved, reported, carried };
}

/**
 * Image embeds (`![alt](path)`, `![[path/file]]`) are not part of jact's link
 * model, so rename cannot rewrite them and `jact validate` cannot see them.
 * Returns `file:line raw` for every embed the planned moves would break, so the
 * caller can refuse the plan instead of silently breaking it. Bare-name
 * `![[file]]` embeds resolve by name in Obsidian and survive any move.
 */
function brokenEmbeds(
	ast: Root,
	filePath: string,
	moved: Map<string, string>,
	scope: string,
): string[] {
	const finalFile = moved.get(filePath) ?? filePath;
	const broken: string[] = [];
	const check = (raw: string, line: number, wiki: boolean): void => {
		if (raw === "" || raw.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(raw))
			return;
		const withoutSuffix = raw.split(/[?#]/)[0] ?? raw;
		let decoded: string;
		try {
			decoded = decodeURI(withoutSuffix);
		} catch {
			decoded = withoutSuffix;
		}
		const bases = wiki
			? [path.dirname(filePath), scope]
			: [path.dirname(filePath)];
		for (const base of bases) {
			const candidate = path.resolve(base, decoded);
			if (!existsSync(candidate)) continue;
			const current = canonicalExisting(candidate);
			if (!moved.has(current) && !moved.has(filePath)) return;
			const finalTarget = moved.get(current) ?? current;
			const finalBase =
				base === path.dirname(filePath) ? path.dirname(finalFile) : base;
			if (path.resolve(finalBase, decoded) !== finalTarget) {
				broken.push(`${filePath}:${line} ${raw}`);
			}
			return;
		}
	};
	visit(ast, "image", (node) => {
		check(node.url, node.position?.start.line ?? 0, false);
	});
	visit(ast, "text", (node) => {
		for (const match of node.value.matchAll(/!\[\[([^\]|#^]+)/g)) {
			const target = match[1] ?? "";
			if (target.includes("/")) {
				check(target, node.position?.start.line ?? 0, true);
			}
		}
	});
	return broken;
}

async function planFiles(
	deps: RenameMarkdownFilesDeps,
	moved: Map<string, string>,
	scope: string,
): Promise<PlannedFile[]> {
	const movedMarkdown = [...moved.keys()].filter((filePath) =>
		/\.md$/i.test(filePath),
	);
	const filesToPlan = [
		...new Set([
			...deps.fileCache.getAllFiles().map((entry) => entry.path),
			...movedMarkdown,
		]),
	].sort((left, right) => left.localeCompare(right));
	const planned: PlannedFile[] = [];
	const embeds: string[] = [];

	for (const filePath of filesToPlan) {
		const document = await deps.parsedDocuments.resolveDocument({
			kind: "file",
			filePath,
		});
		const sourceAfterMove = moved.get(filePath) ?? filePath;
		const changesDirectory =
			path.dirname(sourceAfterMove) !== path.dirname(filePath);
		const edits: TextEdit[] = [];
		const expectedTargets: string[] = [];
		const content = document.data.content;
		const starts = lineStarts(content);
		embeds.push(...brokenEmbeds(document.data.ast, filePath, moved, scope));

		for (const link of document.data.links) {
			if (link.scope !== "cross-document") continue;
			const currentTarget = existingTarget(link);
			const targetMoves = currentTarget !== null && moved.has(currentTarget);
			if (!targetMoves && !changesDirectory) continue;
			if (currentTarget === null) {
				throw new RenameValidationError(
					`Cannot safely move ${filePath}: outgoing link at line ${link.line} does not resolve. No files were changed.`,
				);
			}

			const nextTarget = moved.get(currentTarget) ?? currentTarget;
			const start = linkOffset(link, starts);
			const end = start + link.fullMatch.length;
			if (content.slice(start, end) !== link.fullMatch) {
				throw new RenameValidationError(
					`Parsed link text changed at ${filePath}:${link.line}. No files were changed.`,
				);
			}
			const replacement = rewriteLink(link, nextTarget, sourceAfterMove);
			if (replacement === link.fullMatch) continue;
			edits.push({ start, end, replacement });
			expectedTargets.push(nextTarget);
		}
		if (edits.length === 0) continue;

		planned.push({
			path: filePath,
			links: edits.length,
			original: content,
			updated: applyEdits(content, edits, filePath),
			expectedTargets,
		});
	}

	if (embeds.length > 0) {
		throw new RenameValidationError(
			`Cannot safely move: jact cannot rewrite image embeds, and these would break:\n${embeds.map((embed) => `  ${embed}`).join("\n")}\nNo files were changed.`,
		);
	}
	return planned;
}

function assertUnchanged(plannedFiles: PlannedFile[], plan: MovePlan): void {
	for (const move of plan.moves) {
		if (!existsSync(move.from)) {
			throw new Error(`Source disappeared before commit: ${move.from}`);
		}
		if (existsSync(move.to)) {
			throw new Error(`Destination appeared before commit: ${move.to}`);
		}
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
	plan: MovePlan,
	scope: string,
	allowGitignore: boolean,
): Promise<void> {
	const verificationCache = createFileCache();
	const firstMove = plan.moves[0];
	verificationCache.buildCache(scope, false, undefined, {
		respectGitignore: !allowGitignore,
		...(firstMove !== undefined && {
			alwaysIncludeDir: path.dirname(firstMove.to),
		}),
	});
	const parser = createMarkdownParser(verificationCache);
	const documents = createParsedFileCache(parser);

	for (const file of files) {
		const finalPath = plan.moved.get(file.path) ?? file.path;
		const document = await documents.resolveDocument({
			kind: "file",
			filePath: finalPath,
		});
		const actualCounts = new Map<string, number>();
		for (const link of document.data.links) {
			if (link.scope !== "cross-document") continue;
			const target = existingTarget(link);
			if (target !== null) {
				actualCounts.set(target, (actualCounts.get(target) ?? 0) + 1);
			}
		}
		const expectedCounts = new Map<string, number>();
		for (const target of file.expectedTargets) {
			const canonicalTarget = canonicalExisting(target);
			expectedCounts.set(
				canonicalTarget,
				(expectedCounts.get(canonicalTarget) ?? 0) + 1,
			);
		}
		for (const [target, expected] of expectedCounts) {
			const actual = actualCounts.get(target) ?? 0;
			if (actual < expected) {
				throw new Error(
					`Post-rename verification failed in ${finalPath}: expected ${expected} updated link(s) to ${target}, found ${actual}`,
				);
			}
		}
	}
}

/**
 * Applies the plan all-or-nothing: backs up edited files and moved file
 * sources, writes link edits, creates missing directories, performs the moves,
 * then re-parses and verifies every rewritten link. Any failure undoes the
 * moves, removes created directories, and restores edited files.
 * Returns backup paths at their final location (backups inside a moved
 * directory travel with it).
 */
async function commitPlan(
	plannedFiles: PlannedFile[],
	plan: MovePlan,
	scope: string,
	allowGitignore: boolean,
): Promise<string[]> {
	assertUnchanged(plannedFiles, plan);
	const stamp = Date.now();
	const originalPaths = new Set([
		...plan.moves
			.filter((move) => move.kind === "file")
			.map((move) => move.from),
		...plannedFiles.map((file) => file.path),
	]);
	const backups = new Map<string, string>();
	const staged = new Map<string, string>();
	const committedFiles: string[] = [];
	const createdDirectories: string[] = [];
	const completedMoves: PlannedMove[] = [];

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
		for (const directory of plan.directories) {
			mkdirSync(directory);
			createdDirectories.push(directory);
		}
		for (const move of plan.moves) {
			renameSync(move.from, move.to);
			completedMoves.push(move);
		}
		await verifyRelationships(plannedFiles, plan, scope, allowGitignore);
		return [...backups.values()].map((backup) =>
			pathAfterMoves(backup, plan.moves),
		);
	} catch (error) {
		cleanup(staged.values());
		try {
			for (const move of completedMoves.reverse()) {
				if (existsSync(move.to) && !existsSync(move.from)) {
					renameSync(move.to, move.from);
				}
			}
			for (const directory of createdDirectories.reverse()) {
				rmdirSync(directory);
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

/**
 * Plans (default) or applies (`options.fix`) one rename request as a single
 * batch: every move, every created directory, and every link rewrite between
 * moved files, from outside into moved files, and out of moved files.
 * Throws {@link RenameValidationError} (nothing written) for invalid or unsafe
 * plans; other errors are file-system, parse, commit, or rollback failures.
 */
export async function renameMarkdownFiles(
	deps: RenameMarkdownFilesDeps,
	request: RenameRequest,
	scopeFolder: string,
	options: CliRenameOptions = {},
): Promise<RenameMarkdownFilesResult> {
	const canonicalScope = canonicalExisting(scopeFolder);
	const plan = planMoves(request, scopeFolder, canonicalScope);
	const plannedFiles = await planFiles(deps, plan.moved, canonicalScope);
	const links = plannedFiles.reduce((total, file) => total + file.links, 0);
	const backups = options.fix
		? await commitPlan(
				plannedFiles,
				plan,
				canonicalScope,
				options.allowGitignore === true,
			)
		: [];

	const onlyMove = plan.moves.length === 1 ? plan.moves[0] : undefined;
	return {
		...(!request.batch &&
			onlyMove?.kind === "file" && {
				source: onlyMove.reportedFrom,
				destination: onlyMove.reportedTo,
			}),
		scope: canonicalScope,
		applied: options.fix === true,
		moves: plan.moves.map((move) => ({
			kind: move.kind,
			source: move.reportedFrom,
			destination: move.reportedTo,
			...(move.kind === "directory" && {
				movedFiles: plan.carried.get(move.from) ?? 0,
			}),
		})),
		directories: plan.directories,
		links,
		files: plannedFiles.map(({ path: filePath, links: fileLinks }) => ({
			path: plan.reported.get(filePath) ?? filePath,
			links: fileLinks,
		})),
		backups,
	};
}
