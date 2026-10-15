import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import path from "node:path";
import type { LinkObject } from "../../types/citationTypes.js";
import { ObsidianVaultView, unstableReason } from "../obsidianVaultView.js";
import { replaceFileWithRecovery } from "../replaceFile.js";
import { findVaultRoot } from "../resolveScope.js";
import {
	ANCHOR_START,
	destinationSpan,
	isInside,
	resolveVaultEscape,
	resolveVaultTarget,
} from "../vaultEscape.js";

const PASEO_WORKTREE = /^(.*\/\.paseo\/worktrees\/[^/]+\/[^/]+)(?:\/|$)/;

/** A vault note plus the directories its links resolve against. */
export interface VaultNote {
	notePath: string;
	noteRealDir: string;
	vaultRoot: string;
}

/** Return the note's vault context, or null when the note is not in a vault. */
export function vaultNote(notePath: string): VaultNote | null {
	const vaultRoot = findVaultRoot(notePath);
	if (vaultRoot === null) return null;
	return {
		notePath,
		noteRealDir: path.dirname(fs.realpathSync(notePath)),
		vaultRoot,
	};
}

/** Result of linking one escaping target through a vault symlink. */
export type VaultLinkOutcome =
	| {
			kind: "linked";
			/** Relative link to write, with the original `#anchor`. */
			link: string;
			symlinkPath: string;
			mapped: string;
			/** "created": the symlink does not exist yet and is to be created. */
			status: "created" | "reused";
	  }
	| {
			/** Obsidian already shows the file at `vaultPath`; no symlink needed. */
			kind: "in-vault";
			link: string;
			vaultPath: string;
	  }
	| { kind: "refused"; reason: string };

type Mapping =
	| { kind: "mapped"; mapped: string; symlinkPath: string }
	| { kind: "in-vault"; vaultPath: string }
	| { kind: "refused"; reason: string };

/**
 * Plans vault symlinks for link targets Obsidian cannot open. One instance
 * shares git lookups per repository and one symlink per target file. It
 * changes nothing on disk; {@link createVaultSymlinks} creates the symlinks.
 */
export class VaultLinker {
	readonly note: VaultNote;
	private readonly view: ObsidianVaultView;
	private worktreeLists = new Map<
		string,
		{ bare: boolean; paths: string[] } | null
	>();
	/** Planned symlinks, keyed by path as the note's disk compares names. */
	private symlinks = new Map<
		string,
		{ symlinkPath: string; mapped: string; status: "created" | "reused" }
	>();
	/** True when the note's disk ignores letter case, as macOS does by default. */
	private readonly caseInsensitive: boolean;

	constructor(note: VaultNote) {
		this.note = note;
		this.view = new ObsidianVaultView(note.vaultRoot);
		const dir = note.noteRealDir;
		const flipped =
			dir.toUpperCase() === dir ? dir.toLowerCase() : dir.toUpperCase();
		this.caseInsensitive = flipped !== dir && fs.existsSync(flipped);
	}

	/**
	 * Link one target as written in the note. Returns null when Obsidian can
	 * already open the target.
	 */
	link(written: string): VaultLinkOutcome | null {
		const { noteRealDir, vaultRoot } = this.note;
		const escaping = resolveVaultEscape(written, noteRealDir, vaultRoot);
		let mapping: Mapping;
		if (escaping !== null) {
			mapping = this.map(escaping);
		} else {
			const inside = resolveVaultTarget(written, noteRealDir, vaultRoot);
			if (inside === null) return null;
			const reason = this.view.unindexed(inside);
			if (reason?.kind === "dot") {
				// A dot path maps to itself so the dot check below refuses it.
				mapping = { kind: "in-vault", vaultPath: inside };
			} else if (
				(reason === null && this.view.unstableAlias(inside) === null) ||
				!fs.existsSync(inside)
			) {
				return null;
			} else {
				// Obsidian skips this path, or a symlink on it can break:
				// link the real file the way an escaping link is linked.
				mapping = this.map(inside);
			}
		}
		if (mapping.kind === "refused") return mapping;
		const placedAt =
			mapping.kind === "in-vault" ? mapping.vaultPath : mapping.symlinkPath;
		const hidden = path
			.relative(
				mapping.kind === "in-vault"
					? this.view.realRoot
					: this.note.noteRealDir,
				placedAt,
			)
			.split(path.sep)
			.find((segment) => segment.startsWith(".") && segment !== "..");
		if (hidden !== undefined) {
			return {
				kind: "refused",
				reason: `${placedAt} is under ${hidden}; Obsidian does not index names that start with a dot`,
			};
		}
		if (mapping.kind === "in-vault") {
			return {
				kind: "in-vault",
				link: this.relativeLink(mapping.vaultPath, written),
				vaultPath: mapping.vaultPath,
			};
		}
		const { mapped, symlinkPath } = mapping;

		const key = this.caseInsensitive ? symlinkPath.toLowerCase() : symlinkPath;
		const known = this.symlinks.get(key);
		let status = known?.status;
		if (
			known !== undefined &&
			(known.mapped !== mapped || known.symlinkPath !== symlinkPath)
		) {
			return {
				kind: "refused",
				reason: `${known.symlinkPath} is already planned to point at ${known.mapped}, not ${mapped}`,
			};
		}
		if (status === undefined) {
			const placed = this.place(symlinkPath, mapped);
			if (placed.kind === "refused") return placed;
			status = placed.status;
			this.symlinks.set(key, { symlinkPath, mapped, status });
		}

		return {
			kind: "linked",
			link: this.relativeLink(symlinkPath, written),
			symlinkPath,
			mapped,
			status,
		};
	}

	/**
	 * Relative, percent-encoded link from the note to `to`, keeping the written
	 * `#anchor`. Every character that would end, break or change the link
	 * destination is encoded: `% ( ) # ? \ < >`, whitespace and control
	 * characters.
	 */
	private relativeLink(to: string, written: string): string {
		const hash = written.search(ANCHOR_START);
		return (
			path
				.relative(this.note.noteRealDir, to)
				.split(path.sep)
				.map((segment) =>
					segment.replace(/[%()#?\\<>\s\p{Cc}]/gu, (character) =>
						[...Buffer.from(character)]
							.map(
								(byte) =>
									`%${byte.toString(16).toUpperCase().padStart(2, "0")}`,
							)
							.join(""),
					),
				)
				.join("/") + (hash < 0 ? "" : written.slice(hash))
		);
	}

	/**
	 * Map an escaping path to its main-checkout file and vault symlink path.
	 * An existing path maps by its real location, so a symlink outside any
	 * repo that points into a worktree still maps to the main checkout.
	 */
	private map(resolved: string): Mapping {
		const exists = fs.existsSync(resolved);
		if (exists && !fs.statSync(resolved).isFile()) {
			return { kind: "refused", reason: `${resolved} is not a file` };
		}
		const escaping = exists ? fs.realpathSync(resolved) : resolved;
		const shown = exists ? this.view.shownAt(escaping) : null;
		if (shown !== null && (shown.via === null || shown.via.unstable === null)) {
			return { kind: "in-vault", vaultPath: shown.vaultPath };
		}
		const sourcesDir = path.join(this.note.noteRealDir, "sources");
		const worktree = PASEO_WORKTREE.exec(escaping)?.[1];
		if (worktree !== undefined && !fs.existsSync(worktree)) {
			return {
				kind: "refused",
				reason: `worktree ${worktree} no longer exists, so its main checkout cannot be found`,
			};
		}

		let startDir = path.dirname(escaping);
		while (!fs.existsSync(startDir)) startDir = path.dirname(startDir);
		const realStart = fs.realpathSync(startDir);
		const realPath = path.join(realStart, path.relative(startDir, escaping));
		const toplevelOutput = git(realStart, ["rev-parse", "--show-toplevel"]);
		const toplevel =
			toplevelOutput === null
				? null
				: toplevelOutput.endsWith("\n")
					? toplevelOutput.slice(0, -1)
					: toplevelOutput;

		if (toplevel === null) {
			if (worktree !== undefined) {
				return {
					kind: "refused",
					reason: `cannot find the git repository for ${escaping}`,
				};
			}
			if (!fs.existsSync(escaping)) {
				return { kind: "refused", reason: `${escaping} does not exist` };
			}
			return this.reuseOrLink(
				escaping,
				escaping,
				path.join(sourcesDir, path.basename(escaping)),
			);
		}

		if (
			worktree !== undefined &&
			!isInside(fs.realpathSync(worktree), toplevel)
		) {
			return {
				kind: "refused",
				reason: `cannot find the git repository for ${escaping}`,
			};
		}
		const worktrees = this.worktrees(toplevel);
		if (worktrees?.bare) {
			return {
				kind: "refused",
				reason: `bare repository: no main checkout for ${toplevel}`,
			};
		}
		const main = worktrees?.paths[0];
		if (main === undefined) {
			return {
				kind: "refused",
				reason: `cannot find the main checkout of ${toplevel}`,
			};
		}
		const repoRelative = path.relative(toplevel, realPath);
		if (repoRelative.startsWith("..") || path.isAbsolute(repoRelative)) {
			return {
				kind: "refused",
				reason: `${escaping} is outside its git repository ${toplevel}`,
			};
		}
		const mapped = path.join(main, repoRelative);
		if (mapped.includes(`${path.sep}.paseo${path.sep}worktrees${path.sep}`)) {
			return {
				kind: "refused",
				reason: `main checkout path ${mapped} is inside .paseo/worktrees`,
			};
		}
		if (!fs.existsSync(mapped)) {
			return {
				kind: "refused",
				reason: `main checkout has no ${mapped}; land the file on the main checkout first`,
			};
		}
		if (!fs.statSync(mapped).isFile()) {
			return { kind: "refused", reason: `${mapped} is not a file` };
		}
		const realMapped = fs.realpathSync(mapped);
		const linkedWorktree = worktrees?.paths.slice(1).find((linked) => {
			let realLinked = linked;
			try {
				realLinked = fs.realpathSync(linked);
			} catch {
				// a pruned worktree keeps its listed path
			}
			return isInside(realLinked, realMapped);
		});
		if (
			linkedWorktree !== undefined ||
			realMapped.includes(`${path.sep}.paseo${path.sep}worktrees${path.sep}`)
		) {
			return {
				kind: "refused",
				reason: `main checkout file ${mapped} resolves to ${realMapped}, inside a worktree`,
			};
		}
		return this.reuseOrLink(
			realMapped,
			mapped,
			path.join(sourcesDir, path.basename(main), repoRelative),
		);
	}

	/**
	 * Use the vault path Obsidian shows `realFile` at; refuse when only an
	 * unstable folder symlink shows it, since Obsidian would skip a second
	 * symlink to the same file; otherwise plan a symlink to `mapped`.
	 */
	private reuseOrLink(
		realFile: string,
		mapped: string,
		symlinkPath: string,
	): Mapping {
		const shown = this.view.shownAt(realFile);
		if (shown === null) return { kind: "mapped", mapped, symlinkPath };
		if (shown.via === null || shown.via.unstable === null) {
			return { kind: "in-vault", vaultPath: shown.vaultPath };
		}
		return {
			kind: "refused",
			reason: `Obsidian already shows ${realFile} through folder symlink ${shown.via.vaultPath}, which ${unstableReason(shown.via)}; Obsidian will not open a second symlink to the same file. Remove that folder symlink, then rerun`,
		};
	}

	/**
	 * Worktree paths of a repository, main checkout first, from NUL-separated
	 * porcelain output so a path may hold a newline. `bare` is true when the
	 * first entry is a bare repository, which has no main checkout; it is
	 * left out of `paths`.
	 */
	private worktrees(
		toplevel: string,
	): { bare: boolean; paths: string[] } | null {
		let worktrees = this.worktreeLists.get(toplevel);
		if (worktrees === undefined) {
			const list = git(toplevel, ["worktree", "list", "--porcelain", "-z"]);
			if (list === null) {
				worktrees = null;
			} else {
				const entries: { path: string; bare: boolean }[] = [];
				let current: { path: string; bare: boolean } | undefined;
				for (const field of list.split("\0")) {
					if (field.startsWith("worktree ")) {
						current = { path: field.slice("worktree ".length), bare: false };
						entries.push(current);
					} else if (field === "bare" && current !== undefined) {
						current.bare = true;
					}
				}
				worktrees = {
					bare: entries[0]?.bare ?? false,
					paths: entries
						.filter((entry) => !entry.bare)
						.map((entry) => entry.path),
				};
			}
			this.worktreeLists.set(toplevel, worktrees);
		}
		return worktrees;
	}

	/** Plan a new symlink, or reuse one that already points at `mapped`. */
	private place(
		symlinkPath: string,
		mapped: string,
	):
		| { kind: "placed"; status: "created" | "reused" }
		| { kind: "refused"; reason: string } {
		const parent = path.dirname(symlinkPath);
		if (
			!isInside(this.note.noteRealDir, parent) ||
			!isInside(this.note.vaultRoot, symlinkPath)
		) {
			return {
				kind: "refused",
				reason: `${symlinkPath} would leave the vault`,
			};
		}
		let dir = this.note.noteRealDir;
		for (const segment of path
			.relative(dir, parent)
			.split(path.sep)
			.filter(Boolean)) {
			dir = path.join(dir, segment);
			let stats: fs.Stats;
			try {
				stats = fs.lstatSync(dir);
			} catch {
				break;
			}
			if (!stats.isDirectory()) {
				return {
					kind: "refused",
					reason: `${dir} is ${stats.isSymbolicLink() ? "a symlink" : "not a folder"}; not creating a symlink through it`,
				};
			}
		}
		let existing: fs.Stats | undefined;
		try {
			existing = fs.lstatSync(symlinkPath);
		} catch {
			existing = undefined;
		}
		if (existing !== undefined) {
			if (
				existing.isSymbolicLink() &&
				fs.readlinkSync(symlinkPath) === mapped
			) {
				return { kind: "placed", status: "reused" };
			}
			const what = existing.isSymbolicLink()
				? `a symlink to ${fs.readlinkSync(symlinkPath)}`
				: existing.isDirectory()
					? "a directory"
					: "a file";
			return {
				kind: "refused",
				reason: `${symlinkPath} already exists as ${what}; not overwriting it`,
			};
		}
		return { kind: "placed", status: "created" };
	}
}

/**
 * Run git and return raw stdout, or null when git fails. Variables that point
 * git at another repository, such as those a git hook sets, are dropped so
 * `-C cwd` decides the repository.
 */
function git(cwd: string, args: string[]): string | null {
	const env = { ...process.env };
	for (const name of [
		"GIT_DIR",
		"GIT_WORK_TREE",
		"GIT_COMMON_DIR",
		"GIT_INDEX_FILE",
		"GIT_PREFIX",
	]) {
		delete env[name];
	}
	try {
		return execFileSync("git", ["-C", cwd, ...args], {
			encoding: "utf8",
			env,
			stdio: ["ignore", "pipe", "ignore"],
		});
	} catch {
		return null;
	}
}

/** A symlink `--all` or a single target plans to create. */
export interface PlannedSymlink {
	symlinkPath: string;
	mapped: string;
}

/**
 * Create planned symlinks and their missing folders. On failure, remove what
 * this call created and return the reason. On success, `remove` undoes it.
 */
export function createVaultSymlinks(
	planned: readonly PlannedSymlink[],
):
	| { kind: "created"; remove: () => void }
	| { kind: "refused"; reason: string } {
	const made: string[] = [];
	const remove = () => {
		for (const madePath of [...made].reverse()) {
			try {
				if (fs.lstatSync(madePath).isSymbolicLink()) fs.unlinkSync(madePath);
				else fs.rmdirSync(madePath);
			} catch {
				// already gone, or a folder that now holds other files
			}
		}
	};
	for (const { symlinkPath, mapped } of planned) {
		try {
			const parent = path.dirname(symlinkPath);
			const firstMade = fs.mkdirSync(parent, { recursive: true });
			if (firstMade !== undefined) {
				let dir = firstMade;
				made.push(dir);
				for (const segment of path
					.relative(firstMade, parent)
					.split(path.sep)
					.filter(Boolean)) {
					dir = path.join(dir, segment);
					made.push(dir);
				}
			}
			fs.symlinkSync(mapped, symlinkPath, "file");
			made.push(symlinkPath);
		} catch (error) {
			remove();
			return {
				kind: "refused",
				reason: `cannot create ${symlinkPath}: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	}
	return { kind: "created", remove };
}

/**
 * Apply an `--all` plan and retain the actual displaced note for recovery.
 * Earlier changes are refused; late saves survive in the recovery inode or
 * at a pathname an editor recreates. Installation never replaces that path.
 */
export function applyVaultLinkPlan(
	notePath: string,
	original: string,
	plan: { content: string; symlinks: readonly PlannedSymlink[] },
):
	| { kind: "written"; recoveryPath: string }
	| { kind: "refused"; reason: string } {
	const realNote = fs.realpathSync(notePath);
	fs.accessSync(realNote, fs.constants.W_OK);
	const mode = fs.statSync(realNote).mode & 0o777;
	const unchanged = () => fs.readFileSync(realNote, "utf8") === original;
	const changed = {
		kind: "refused",
		reason: `${notePath} changed while vault-link ran; nothing was written. Run vault-link again`,
	} as const;
	if (!unchanged()) return changed;
	const created = createVaultSymlinks(plan.symlinks);
	if (created.kind === "refused") return created;
	try {
		const replaced = replaceFileWithRecovery(
			realNote,
			plan.content,
			mode,
			original,
		);
		if (replaced.kind === "refused") {
			created.remove();
			return replaced.recoveryPath === undefined
				? changed
				: {
						kind: "refused",
						reason: `${notePath} changed while vault-link ran; rewrite not installed. Displaced note retained at ${replaced.recoveryPath}. Check both files before retrying`,
					};
		}
		return replaced;
	} catch (error) {
		created.remove();
		throw error;
	}
}

/** One escaping link handled by `--all`. */
export type VaultLinkRewrite =
	| { line: number; kind: "rewritten"; oldTarget: string; newTarget: string }
	| { line: number; kind: "refused"; reason: string };

/**
 * Plan a link for every escaping markdown link in `content` and return the
 * rewritten content, the symlinks the applied rewrites need, and counts.
 * Nothing is written. Refused links stay unchanged. Footnote definitions are
 * skipped, as the rule skips them.
 */
export function rewriteVaultEscapes(
	content: string,
	links: readonly LinkObject[],
	linker: VaultLinker,
): {
	content: string;
	rewrites: VaultLinkRewrite[];
	symlinks: PlannedSymlink[];
	summary: { created: number; reused: number; inVault: number };
} {
	const lineStarts = [0];
	for (let i = 0; i < content.length; i++) {
		if (content[i] === "\n") lineStarts.push(i + 1);
	}

	const edits: { start: number; end: number; text: string }[] = [];
	const rewrites: VaultLinkRewrite[] = [];
	const symlinkStatus = new Map<string, PlannedSymlink & { status: string }>();
	let inVault = 0;
	const ordered = links
		.filter(
			(link) =>
				link.linkType === "markdown" &&
				link.target.path.raw &&
				!(
					link.markdownForm === "definition" &&
					(link.text ?? "").startsWith("^")
				),
		)
		.sort((a, b) => a.line - b.line || a.column - b.column);
	for (const link of ordered) {
		const span = destinationSpan(link.fullMatch);
		const outcome = linker.link(span?.text ?? link.target.path.raw ?? "");
		if (outcome === null) continue;
		if (outcome.kind === "refused") {
			rewrites.push({ line: link.line, kind: "refused", reason: outcome.reason });
			continue;
		}
		const offset = (lineStarts[link.line - 1] ?? 0) + link.column;
		if (
			span === null ||
			content.slice(offset, offset + link.fullMatch.length) !== link.fullMatch
		) {
			rewrites.push({
				line: link.line,
				kind: "refused",
				reason: "cannot locate the link destination in the note text",
			});
			continue;
		}
		edits.push({
			start: offset + span.start,
			end: offset + span.end,
			text: outcome.link,
		});
		rewrites.push({
			line: link.line,
			kind: "rewritten",
			oldTarget: span.text,
			newTarget: outcome.link,
		});
		if (outcome.kind === "in-vault") {
			inVault++;
		} else {
			symlinkStatus.set(outcome.symlinkPath, {
				symlinkPath: outcome.symlinkPath,
				mapped: outcome.mapped,
				status: outcome.status,
			});
		}
	}

	let rewritten = content;
	for (const edit of edits.reverse()) {
		rewritten =
			rewritten.slice(0, edit.start) + edit.text + rewritten.slice(edit.end);
	}
	const planned = [...symlinkStatus.values()];
	const symlinks = planned
		.filter((symlink) => symlink.status === "created")
		.map(({ symlinkPath, mapped }) => ({ symlinkPath, mapped }));
	return {
		content: rewritten,
		rewrites,
		symlinks,
		summary: {
			created: symlinks.length,
			reused: planned.length - symlinks.length,
			inVault,
		},
	};
}
