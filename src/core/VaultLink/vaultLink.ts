import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import path from "node:path";
import type { LinkObject } from "../../types/citationTypes.js";
import { ObsidianVaultView } from "../obsidianVaultView.js";
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
			/** "created" also covers a symlink a dry run would create. */
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
 * Plans and creates vault symlinks for link targets Obsidian cannot open.
 * One instance shares git lookups per repository and one symlink per target
 * file.
 */
export class VaultLinker {
	readonly note: VaultNote;
	readonly dryRun: boolean;
	created = 0;
	reused = 0;
	inVault = 0;
	private readonly view: ObsidianVaultView;
	private worktreeLists = new Map<string, string[] | null>();
	private symlinks = new Map<
		string,
		{ mapped: string; status: "created" | "reused" }
	>();

	constructor(note: VaultNote, dryRun: boolean) {
		this.note = note;
		this.dryRun = dryRun;
		this.view = new ObsidianVaultView(note.vaultRoot);
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
			const reason = inside === null ? null : this.view.unindexed(inside);
			if (inside === null || reason === null) return null;
			// A dot path maps to itself so the dot check below refuses it.
			mapping = {
				kind: "in-vault",
				vaultPath: reason.kind === "dot" ? inside : reason.vaultPath,
			};
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
			this.inVault++;
			return {
				kind: "in-vault",
				link: this.relativeLink(mapping.vaultPath, written),
				vaultPath: mapping.vaultPath,
			};
		}
		const { mapped, symlinkPath } = mapping;

		const known = this.symlinks.get(symlinkPath);
		let status = known?.status;
		if (known !== undefined && known.mapped !== mapped) {
			return {
				kind: "refused",
				reason: `${symlinkPath} is already planned to point at ${known.mapped}, not ${mapped}`,
			};
		}
		if (status === undefined) {
			const placed = this.place(symlinkPath, mapped);
			if (placed.kind === "refused") return placed;
			status = placed.status;
			this.symlinks.set(symlinkPath, { mapped, status });
			if (status === "created") this.created++;
			else this.reused++;
		}

		return {
			kind: "linked",
			link: this.relativeLink(symlinkPath, written),
			symlinkPath,
			mapped,
			status,
		};
	}

	/** Relative, percent-encoded link from the note to `to`, keeping the written `#anchor`. */
	private relativeLink(to: string, written: string): string {
		const hash = written.search(ANCHOR_START);
		return (
			path
				.relative(this.note.noteRealDir, to)
				.split(path.sep)
				.map((segment) =>
					segment
						.replaceAll("%", "%25")
						.replaceAll(" ", "%20")
						.replaceAll("(", "%28")
						.replaceAll(")", "%29")
						.replaceAll("#", "%23")
						.replaceAll("?", "%3F"),
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
		const escaping = exists ? fs.realpathSync(resolved) : resolved;
		const vaultPath = exists ? this.view.shownAt(escaping) : null;
		if (vaultPath !== null) return { kind: "in-vault", vaultPath };
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
		const toplevel = git(realStart, ["rev-parse", "--show-toplevel"]);

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
			return {
				kind: "mapped",
				mapped: escaping,
				symlinkPath: path.join(sourcesDir, path.basename(escaping)),
			};
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
		const main = worktrees?.[0];
		if (main === undefined) {
			return {
				kind: "refused",
				reason: `cannot find the main checkout of ${toplevel}`,
			};
		}
		const repoRelative = path.relative(toplevel, realPath);
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
		const realMapped = fs.realpathSync(mapped);
		const linkedWorktree = worktrees?.slice(1).find((linked) => {
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
		const mappedVaultPath = this.view.shownAt(realMapped);
		if (mappedVaultPath !== null) {
			return { kind: "in-vault", vaultPath: mappedVaultPath };
		}
		return {
			kind: "mapped",
			mapped,
			symlinkPath: path.join(sourcesDir, path.basename(main), repoRelative),
		};
	}

	/** Worktree paths of a repository, main checkout first. */
	private worktrees(toplevel: string): string[] | null {
		let worktrees = this.worktreeLists.get(toplevel);
		if (worktrees === undefined) {
			const list = git(toplevel, ["worktree", "list", "--porcelain"]);
			worktrees =
				list === null
					? null
					: [...list.matchAll(/^worktree (.+)$/gm)].map((match) => match[1] ?? "");
			this.worktreeLists.set(toplevel, worktrees);
		}
		return worktrees;
	}

	/** Create the symlink, or reuse one that already points at `mapped`. */
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
		if (!this.dryRun) {
			try {
				fs.mkdirSync(path.dirname(symlinkPath), { recursive: true });
				fs.symlinkSync(mapped, symlinkPath, "file");
			} catch (error) {
				return {
					kind: "refused",
					reason: `cannot create ${symlinkPath}: ${error instanceof Error ? error.message : String(error)}`,
				};
			}
		}
		return { kind: "placed", status: "created" };
	}
}

/** Run git and return trimmed stdout, or null when git fails. */
function git(cwd: string, args: string[]): string | null {
	try {
		return execFileSync("git", ["-C", cwd, ...args], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return null;
	}
}

/** One escaping link handled by `--all`. */
export type VaultLinkRewrite =
	| { line: number; kind: "rewritten"; oldTarget: string; newTarget: string }
	| { line: number; kind: "refused"; reason: string };

/**
 * Link every escaping markdown link in `content` and return the rewritten
 * content. Refused links stay unchanged. Footnote definitions are skipped,
 * as the rule skips them.
 */
export function rewriteVaultEscapes(
	content: string,
	links: readonly LinkObject[],
	linker: VaultLinker,
): { content: string; rewrites: VaultLinkRewrite[] } {
	const lineStarts = [0];
	for (let i = 0; i < content.length; i++) {
		if (content[i] === "\n") lineStarts.push(i + 1);
	}

	const edits: { start: number; end: number; text: string }[] = [];
	const rewrites: VaultLinkRewrite[] = [];
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
	}

	let rewritten = content;
	for (const edit of edits.reverse()) {
		rewritten =
			rewritten.slice(0, edit.start) + edit.text + rewritten.slice(edit.end);
	}
	return { content: rewritten, rewrites };
}
