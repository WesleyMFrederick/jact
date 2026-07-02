import ignore, { type Ignore } from "ignore";

/**
 * Default ignore patterns applied to every scan regardless of `.gitignore`
 * presence. Keeps scans from indexing VCS metadata, vendored deps, and
 * build output that are never meaningful as markdown targets.
 */
export const DEFAULT_SCAN_IGNORE_PATTERNS: readonly string[] = [
	".git/",
	".hg/",
	".svn/",
	".venv/",
	"venv/",
	"node_modules/",
	"dist/",
	"build/",
	"coverage/",
];

/**
 * Build the Ignore rules object used to filter paths under `scanRoot`.
 *
 * Always includes {@link DEFAULT_SCAN_IGNORE_PATTERNS}. When `respectGitignore`
 * is true and `scanRoot` has a readable `.gitignore`, its patterns are loaded
 * first, then the defaults are added to ensure they're authoritative (cannot
 * be negated by `.gitignore`). Missing or unreadable `.gitignore` is
 * non-fatal — defaults still apply.
 *
 * A `.jactignore` file at `scanRoot` (gitignore syntax) is loaded
 * **unconditionally** — it is jact's own per-repo config, independent of the
 * `respectGitignore` flag. Load order is `.gitignore` → `.jactignore` →
 * defaults, so `.jactignore` may negate `.gitignore` entries but never the
 * hardcoded defaults.
 *
 * Shared by {@link FileCache} (recursive scope scan) and the batch-validate
 * file-set resolver (glob/explicit-path expansion) so gitignore-awareness
 * stays consistent across both entry points.
 *
 * @param fs - Node.js fs module (or mock for testing)
 * @param pathModule - Node.js path module (or mock for testing)
 * @param scanRoot - Directory whose `.gitignore` should be loaded
 * @param respectGitignore - When true, load and apply the root `.gitignore`
 */
export function buildIgnoreRules(
	fs: typeof import("fs"),
	pathModule: typeof import("path"),
	scanRoot: string,
	respectGitignore: boolean,
): Ignore {
	const rules = ignore();
	if (respectGitignore) {
		const gitignorePath = pathModule.join(scanRoot, ".gitignore");
		try {
			const content = fs.readFileSync(gitignorePath, "utf-8");
			rules.add(content);
		} catch (_error) {
			// No .gitignore or unreadable — defaults still apply.
		}
	}
	const jactignorePath = pathModule.join(scanRoot, ".jactignore");
	try {
		const content = fs.readFileSync(jactignorePath, "utf-8");
		rules.add(content);
	} catch (_error) {
		// No .jactignore or unreadable — non-fatal.
	}
	rules.add([...DEFAULT_SCAN_IGNORE_PATTERNS]);
	return rules;
}
