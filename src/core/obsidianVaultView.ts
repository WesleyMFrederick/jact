import * as fs from "node:fs";
import path from "node:path";
import { isInside } from "./vaultEscape.js";

/** Why Obsidian will not open a path inside the vault. */
export type UnindexedReason =
	| { kind: "dot"; segment: string }
	| { kind: "shown-elsewhere"; vaultPath: string };

/**
 * The files Obsidian shows in one vault: real files outside dot-named folders,
 * plus files under folder symlinks whose targets are disjoint from the vault.
 * Obsidian skips a symlink whose target overlaps the vault or another
 * symlink's target, so such a file opens only at the vault path Obsidian
 * already shows. Folder symlinks are found once per instance.
 */
export class ObsidianVaultView {
	readonly realRoot: string;
	private folderSymlinkList:
		| { vaultPath: string; target: string }[]
		| undefined;

	constructor(vaultRoot: string) {
		this.realRoot = fs.realpathSync(vaultRoot);
	}

	/**
	 * Vault path where Obsidian already shows a real file: the file itself when
	 * it lies in the vault, or its path under a vault folder symlink. Null when
	 * the vault does not reach it.
	 */
	shownAt(realFile: string): string | null {
		if (isInside(this.realRoot, realFile)) return realFile;
		for (const { vaultPath, target } of this.folderSymlinks()) {
			if (isInside(target, realFile)) {
				return path.join(vaultPath, path.relative(target, realFile));
			}
		}
		return null;
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
		return shown === null || shown === vaultPath
			? null
			: { kind: "shown-elsewhere", vaultPath: shown };
	}

	/**
	 * Folder symlinks Obsidian follows: outside dot folders, with a target
	 * disjoint from the vault. Found once per instance, in path order.
	 */
	private folderSymlinks(): { vaultPath: string; target: string }[] {
		if (this.folderSymlinkList !== undefined) return this.folderSymlinkList;
		const found: { vaultPath: string; target: string }[] = [];
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
						found.push({ vaultPath: entryPath, target });
					}
				}
			}
		}
		found.sort((a, b) => a.vaultPath.localeCompare(b.vaultPath));
		this.folderSymlinkList = found;
		return found;
	}
}
