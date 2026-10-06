import { realpathSync } from "node:fs";
import path from "node:path";

/** Reason reported for a link target that the read boundary blocks. */
export const BLOCKED_READ_REASON =
	"Blocked: target is outside the project. To allow, add --allow-read <dir>.";

/** Resolve symlinks. A missing path keeps its absolute form; the read fails later. */
function canonicalPath(filePath: string): string {
	try {
		return realpathSync(filePath);
	} catch {
		return path.resolve(filePath);
	}
}

/**
 * Directories that extraction may read for targets found inside Markdown.
 * Paths are compared after symlink resolution, so a link cannot escape
 * through a symlinked file or a symlinked parent directory.
 */
export class ReadBoundary {
	private readonly roots: readonly string[];
	private readonly trustedFiles: ReadonlySet<string>;

	/**
	 * @param roots - Permitted directories: the project scope plus each --allow-read value.
	 * @param trustedFiles - Files the user named on the command line.
	 */
	constructor(roots: readonly string[], trustedFiles: readonly string[] = []) {
		this.roots = roots.map(canonicalPath);
		this.trustedFiles = new Set(trustedFiles.map(canonicalPath));
	}

	/** True when `filePath` is a trusted file or is inside one permitted directory. */
	permits(filePath: string): boolean {
		const target = canonicalPath(filePath);
		if (this.trustedFiles.has(target)) return true;
		return this.roots.some((root) => {
			const relative = path.relative(root, target);
			return (
				relative !== ".." &&
				!relative.startsWith(`..${path.sep}`) &&
				!path.isAbsolute(relative)
			);
		});
	}
}
