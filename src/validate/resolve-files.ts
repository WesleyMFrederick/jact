/**
 * File-set resolver for batch `jact validate`.
 *
 * Expands explicit paths and glob patterns into a deduplicated, sorted list of
 * absolute `.md` file paths. Zero-match throws {@link NoFilesMatchedError},
 * which the CLI maps to exit code 2 (usage error, per ADR D5).
 */

import fs from "node:fs";
import path from "node:path";
import { glob } from "tinyglobby";
import { buildIgnoreRules } from "../core/ignoreRules.js";
import {
	defaultRunGit,
	type RunGit,
	resolveChangedFiles,
} from "./resolve-changed-files.js";

/**
 * Thrown when no `.md` files match any of the supplied inputs.
 *
 * The CLI layer catches this and exits with code 2 (usage error, ADR D5).
 */
export class NoFilesMatchedError extends Error {
	/** The original inputs that produced zero matches. */
	readonly patterns: readonly string[];

	constructor(patterns: readonly string[]) {
		const listed = patterns.map((p) => JSON.stringify(p)).join(", ");
		super(
			patterns.length === 0
				? "No file paths or glob patterns were provided."
				: `No .md files matched: ${listed}`,
		);
		this.name = "NoFilesMatchedError";
		this.patterns = patterns;
	}
}

/**
 * True when `input` contains glob magic characters (picomatch syntax), i.e.
 * must be expanded by tinyglobby rather than treated as a literal path.
 */
function isGlobPattern(input: string): boolean {
	return /[*?[\]{}()!]/.test(input);
}

/**
 * Expand `inputs` (explicit `.md` paths and/or glob patterns) into a
 * deduplicated, lexicographically sorted list of absolute `.md` file paths.
 *
 * - Uses **tinyglobby** for glob expansion (ADR D1).
 * - Filters results to `.md` files only; non-markdown matches are silently
 *   excluded so broad patterns like `src/**` remain useful.
 * - Deduplicates: overlapping patterns or repeated paths never double-count.
 * - Returns paths sorted lexicographically for stable, predictable order.
 *
 * @param inputs One or more explicit file paths or tinyglobby-compatible glob
 *   patterns. Relative patterns are resolved against `cwd`.
 * @param cwd Working directory for glob expansion. Defaults to
 *   `process.cwd()`.
 * @returns Absolute `.md` paths in lexicographic order.
 * @throws {NoFilesMatchedError} When the expanded, filtered set is empty.
 *   The CLI maps this to exit code 2 (ADR D5).
 */
export async function resolveFiles(
	inputs: readonly string[],
	cwd: string = process.cwd(),
): Promise<string[]> {
	if (inputs.length === 0) {
		throw new NoFilesMatchedError([]);
	}

	// Split inputs: an explicitly named existing *file* bypasses ignore
	// filtering ("you named it, you get it" — mirrors git, where ignore rules
	// affect sweeps, not directly targeted paths). Globs, directories, and
	// nonexistent paths are sweeps: expanded via tinyglobby, then filtered.
	const explicitFiles: string[] = [];
	const sweepPatterns: string[] = [];
	for (const input of inputs) {
		if (!isGlobPattern(input)) {
			const abs = path.resolve(cwd, input);
			let isFile = false;
			try {
				isFile = fs.statSync(abs).isFile();
			} catch (_error) {
				// Nonexistent — falls through to the sweep branch (contributes
				// nothing there; overall zero-match still throws below).
			}
			if (isFile) {
				explicitFiles.push(abs);
				continue;
			}
		}
		sweepPatterns.push(input);
	}

	let sweepMatches: string[] = [];
	if (sweepPatterns.length > 0) {
		const matched = await glob(sweepPatterns, {
			absolute: true,
			cwd,
			onlyFiles: true,
		});

		// Exclude .gitignore'd/.jactignore'd paths (e.g. node_modules, test
		// fixtures) so broad patterns like `**` don't sweep up vendored/build
		// output. Same rules FileCache applies for the single-file validate
		// path (shared via core/ignoreRules.js).
		// Paths outside `cwd` have no ignore scope to apply, so they pass
		// through unfiltered (the `ignore` package throws on a `..`-relative
		// path).
		const ignoreRules = buildIgnoreRules(fs, path, cwd, true);
		sweepMatches = matched.filter((f) => {
			const rel = path.relative(cwd, f);
			if (rel.startsWith("..")) return true;
			return !ignoreRules.ignores(rel);
		});
	}

	// Filter to .md only, deduplicate via Set, then sort for stable order.
	const mdFiles = [
		...new Set(
			[...explicitFiles, ...sweepMatches].filter((f) => f.endsWith(".md")),
		),
	].sort();

	if (mdFiles.length === 0) {
		throw new NoFilesMatchedError(inputs.slice());
	}

	return mdFiles;
}

/**
 * Options selecting the file set for one batch `jact validate` invocation.
 *
 * @property paths Explicit file paths and/or glob patterns. May be empty.
 * @property changed `--changed`: union git working-tree-changed `.md` files
 *   into the selection (ADR D2).
 */
export interface ResolveFileSetOptions {
	paths: readonly string[];
	changed: boolean;
}

/**
 * Resolve the final file set for a batch validate run, combining explicit
 * `paths`/globs with `--changed` per ADR D2/D5.
 *
 * - `changed` alone (`paths` empty): resolves to just the changed set. No
 *   changes present is a normal success (empty array), not an error.
 * - `paths` alone (`changed` false): identical to {@link resolveFiles} —
 *   zero-match throws {@link NoFilesMatchedError}.
 * - Both: `--changed` **unions** into the path/glob selection — it only adds
 *   files, never shrinks the set. A zero-match glob is tolerated as long as
 *   `changed` contributes at least one file; if the union is still empty,
 *   the original zero-match error propagates (ADR D5: "nothing selected at
 *   all from a bad glob → exit 2").
 *
 * @param options File-set selection options.
 * @param cwd Working directory for glob expansion and `git status`. Defaults
 *   to `process.cwd()`.
 * @param runGit Injectable git seam, forwarded to {@link resolveChangedFiles}.
 *   Defaults to {@link defaultRunGit}.
 * @returns Absolute `.md` paths in lexicographic order.
 * @throws {NoFilesMatchedError} When the resulting union is empty and empty
 *   is not the tolerated "`--changed` alone, no changes" case.
 * @throws {NotAGitRepositoryError} When `changed` is true and `cwd` is not
 *   inside a git repository.
 */
export async function resolveFileSet(
	options: ResolveFileSetOptions,
	cwd: string = process.cwd(),
	runGit: RunGit = defaultRunGit,
): Promise<string[]> {
	// `--changed` is a sweep, not an explicit ask — filter it through the same
	// ignore rules (.gitignore + .jactignore + defaults) as glob expansion so
	// e.g. an edited test fixture doesn't fail an otherwise-clean batch.
	let changedFiles: string[] = [];
	if (options.changed) {
		const ignoreRules = buildIgnoreRules(fs, path, cwd, true);
		changedFiles = resolveChangedFiles(cwd, runGit).filter((f) => {
			const rel = path.relative(cwd, f);
			if (rel.startsWith("..")) return true;
			return !ignoreRules.ignores(rel);
		});
	}

	let pathFiles: string[] = [];
	let pathError: NoFilesMatchedError | undefined;
	if (options.paths.length > 0) {
		try {
			pathFiles = await resolveFiles(options.paths, cwd);
		} catch (err) {
			if (!(err instanceof NoFilesMatchedError)) {
				throw err;
			}
			// Swallow for now — tolerated only if `changed` fills the union below.
			pathError = err;
		}
	}

	const merged = [...new Set([...pathFiles, ...changedFiles])].sort();

	if (merged.length === 0) {
		// `--changed` alone with no pending changes is a normal, successful
		// empty result (ADR D5). Every other empty-union case is an error.
		const changedAloneNoChanges = options.changed && options.paths.length === 0;
		if (!changedAloneNoChanges) {
			throw pathError ?? new NoFilesMatchedError(options.paths.slice());
		}
	}

	return merged;
}
