import * as fs from "node:fs";
import path from "node:path";
import { isInside } from "./vaultEscape.js";

/** Why Obsidian will not open a path inside the vault. */
export type UnindexedReason =
	| { kind: "dot"; segment: string }
	| { kind: "shown-elsewhere"; vaultPath: string };

/**
 * A vault symlink links can go through. `unstable` says why such links can
 * break: its target is in a temporary `.paseo/worktrees` checkout, or it sits
 * in a `sources` folder, which holds only the per-file symlinks
 * `jact vault-link` makes for one note.
 */
export interface VaultSymlink {
	vaultPath: string;
	target: string;
	unstable: "worktree" | "sources" | null;
}

const WORKTREE_SEGMENT = `${path.sep}.paseo${path.sep}worktrees${path.sep}`;

/** Plain-language reason a symlink is unstable, for messages. */
export function unstableReason(symlink: VaultSymlink): string {
	return symlink.unstable === "worktree"
		? "points into a temporary .paseo worktree"
		: "sits in a note's sources folder, which holds only jact vault-link's per-file symlinks";
}

/**
 * The files Obsidian shows in one vault: real files outside dot-named folders,
 * plus files under folder symlinks whose targets are disjoint from the vault.
 * Obsidian skips a symlink whose target overlaps the vault or another
 * symlink's target, so such a file opens only at the vault path Obsidian
 * already shows. Folder symlinks are found once per instance.
 */
export class ObsidianVaultView {
	readonly realRoot: string;
	private folderSymlinkList: VaultSymlink[] | undefined;

	constructor(vaultRoot: string) {
		this.realRoot = fs.realpathSync(vaultRoot);
	}

	/**
	 * Vault path where Obsidian already shows a real file: the file itself when
	 * it lies in the vault, or its path under a vault folder symlink, which
	 * `via` names. Null when the vault does not reach it.
	 */
	shownAt(
		realFile: string,
	): { vaultPath: string; via: VaultSymlink | null } | null {
		if (isInside(this.realRoot, realFile)) {
			return { vaultPath: realFile, via: null };
		}
		for (const symlink of this.folderSymlinks()) {
			if (isInside(symlink.target, realFile)) {
				return {
					vaultPath: path.join(
						symlink.vaultPath,
						path.relative(symlink.target, realFile),
					),
					via: symlink,
				};
			}
		}
		return null;
	}

	/**
	 * The unstable symlink that `vaultPath`, a path inside the vault under its
	 * real root, goes through: an unstable folder symlink on the path, or else
	 * `vaultPath` itself when a symlink sends it into a `.paseo/worktrees`
	 * checkout. Null when it goes through none.
	 */
	unstableAlias(vaultPath: string): VaultSymlink | null {
		const folder = this.folderSymlinks().find(
			(symlink) =>
				symlink.unstable !== null && isInside(symlink.vaultPath, vaultPath),
		);
		if (folder !== undefined) return folder;
		let target: string;
		try {
			target = fs.realpathSync(vaultPath);
		} catch {
			return null;
		}
		return target.includes(WORKTREE_SEGMENT) && !isInside(this.realRoot, target)
			? { vaultPath, target, unstable: "worktree" }
			: null;
	}

	/**
	 * Why Obsidian will not open `vaultPath`, a path inside the vault under its
	 * real root; null when Obsidian opens it or the file does not exist.
	 */
	unindexed(vaultPath: string): UnindexedReason | null {
		const segment = path
			.relative(this.realRoot, vaultPath)
			.split(path.sep)
			.find((part) => part.startsWith(".") && part !== "..");
		if (segment !== undefined) return { kind: "dot", segment };
		let real: string;
		try {
			real = fs.realpathSync(vaultPath);
		} catch {
			return null;
		}
		if (real === vaultPath) return null;
		const shown = this.shownAt(real);
		return shown === null || shown.vaultPath === vaultPath
			? null
			: { kind: "shown-elsewhere", vaultPath: shown.vaultPath };
	}

	/**
	 * Folder symlinks Obsidian follows: outside dot folders, with a target
	 * disjoint from the vault. Found once per instance; stable ones first, then
	 * in path order, so a file reachable both ways maps to the stable path.
	 */
	private folderSymlinks(): VaultSymlink[] {
		if (this.folderSymlinkList !== undefined) return this.folderSymlinkList;
		const found: VaultSymlink[] = [];
		const pending = [this.realRoot];
		for (let dir = pending.pop(); dir !== undefined; dir = pending.pop()) {
			let entries: fs.Dirent[];
			try {
				entries = fs.readdirSync(dir, { withFileTypes: true });
			} catch {
				continue;
			}
			for (const entry of entries) {
				if (entry.name.startsWith(".")) continue;
				const entryPath = path.join(dir, entry.name);
				if (entry.isDirectory()) {
					pending.push(entryPath);
				} else if (entry.isSymbolicLink()) {
					let target: string;
					try {
						target = fs.realpathSync(entryPath);
						if (!fs.statSync(target).isDirectory()) continue;
					} catch {
						continue;
					}
					if (
						!isInside(this.realRoot, target) &&
						!isInside(target, this.realRoot)
					) {
						found.push({
							vaultPath: entryPath,
							target,
							unstable: target.includes(WORKTREE_SEGMENT)
								? "worktree"
								: path
											.relative(this.realRoot, entryPath)
											.split(path.sep)
											.includes("sources")
									? "sources"
									: null,
						});
					}
				}
			}
		}
		found.sort(
			(a, b) =>
				Number(a.unstable !== null) - Number(b.unstable !== null) ||
				a.vaultPath.localeCompare(b.vaultPath),
		);
		this.folderSymlinkList = found;
		return found;
	}
}
