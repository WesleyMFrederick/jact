/**
 * PathResolver — owns all path resolution logic extracted from CitationValidator.
 *
 * Responsibilities:
 *   - Strategy-based target path resolution (tilde, standard, Obsidian, symlink, cache)
 *   - Obsidian vault-relative path detection and conversion
 *   - Symlink-aware resolution helpers
 *   - Path debug info generation
 *   - Directory / same-directory checks
 *   - Path conversion suggestion generation
 *
 * Extracted from CitationValidator (issue #28).
 */

import { existsSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { LinkObject } from "../../types/citationTypes.js";
import type { PathConversion } from "../../types/validationTypes.js";
import { CacheFallbackStrategy } from "./pathResolutionStrategies/CacheFallbackStrategy.js";
import { FileFoundStrategy } from "./pathResolutionStrategies/FileFoundStrategy.js";
import { FolderLinkStrategy } from "./pathResolutionStrategies/FolderLinkStrategy.js";
import type { PathResolutionStrategy } from "./pathResolutionStrategies/PathResolutionStrategy.js";
import { WikiFailLoudStrategy } from "./pathResolutionStrategies/WikiFailLoudStrategy.js";
import { WikiFastPathStrategy } from "./pathResolutionStrategies/WikiFastPathStrategy.js";

/**
 * Minimal interface over FileCache to avoid circular imports.
 */
export interface FileCacheLike {
	resolveFile(filename: string): {
		found: boolean;
		path?: string | null;
		fuzzyMatch?: boolean;
		message?: string;
		reason?: string;
	};
}

export type PathResolutionOutcome =
	| {
			kind: "resolved";
			targetPath: string;
			anchorFailureStatus: "error" | "warning";
			anchorFailurePrefix?: string;
			warning?: string;
			pathConversion?: PathConversion;
	  }
	| { kind: "warning"; error: string; suggestion?: string }
	| { kind: "error"; error: string; suggestion?: string };

export class PathResolver {
	private fileCache: FileCacheLike;
	private strategies: PathResolutionStrategy[];

	constructor(fileCache: FileCacheLike) {
		this.fileCache = fileCache;
		this.strategies = [
			new WikiFastPathStrategy(),
			new WikiFailLoudStrategy(),
			new FolderLinkStrategy(),
			new FileFoundStrategy(),
			new CacheFallbackStrategy(),
		];
	}

	// ── Filesystem primitives ──────────────────────────────────────────────────

	safeRealpathSync(path: string): string {
		try {
			return realpathSync(path);
		} catch (_error) {
			return path;
		}
	}

	isFile(path: string): boolean {
		try {
			return existsSync(path) && statSync(path).isFile();
		} catch (_error) {
			return false;
		}
	}

	isDirectory(path: string): boolean {
		try {
			return existsSync(path) && statSync(path).isDirectory();
		} catch (_error: unknown) {
			return false;
		}
	}

	// ── Obsidian path helpers ──────────────────────────────────────────────────

	isObsidianAbsolutePath(path: string): boolean {
		return /^[A-Za-z0-9_-]+\//.test(path) && !isAbsolute(path);
	}

	convertObsidianToFilesystemPath(
		obsidianPath: string,
		sourceFile: string,
	): string | null {
		let currentDir = dirname(sourceFile);

		while (currentDir !== dirname(currentDir)) {
			const testPath = join(currentDir, obsidianPath);
			if (existsSync(testPath)) {
				return testPath;
			}
			currentDir = dirname(currentDir);
		}

		return null;
	}

	// ── Debug info ─────────────────────────────────────────────────────────────

	generatePathResolutionDebugInfo(
		relativePath: string,
		sourceFile: string,
	): string {
		const sourceDir = dirname(sourceFile);
		const realSourceFile = this.safeRealpathSync(sourceFile);
		const isSymlink = realSourceFile !== sourceFile;

		const debugParts: string[] = [];

		if (isSymlink) {
			debugParts.push(`Source via symlink: ${sourceFile} → ${realSourceFile}`);
		}

		const standardPath = resolve(sourceDir, relativePath);
		debugParts.push(`Tried: ${standardPath}`);

		if (isSymlink) {
			const realSourceDir = dirname(realSourceFile);
			const symlinkResolvedPath = resolve(realSourceDir, relativePath);
			debugParts.push(`Symlink-resolved: ${symlinkResolvedPath}`);
		}

		if (this.isObsidianAbsolutePath(relativePath)) {
			debugParts.push("Detected Obsidian absolute path format");
		}

		return debugParts.join("; ");
	}

	// ── Complete citation path resolution ─────────────────────────────────────

	resolveCitationPath(
		citation: LinkObject,
		sourceFile: string,
	): PathResolutionOutcome {
		const rawPath = citation.target.path.raw ?? "";
		const decodedPath = decodeURIComponent(rawPath);
		const sourceDir = dirname(sourceFile);
		const standardPath = resolve(sourceDir, decodedPath);
		const candidatePath = this.findCandidatePath(rawPath, sourceFile);
		const context = {
			citation,
			sourceFile,
			candidatePath,
			standardPath,
			pathResolver: this,
			fileCache: this.fileCache,
		};

		for (const strategy of this.strategies) {
			const outcome = strategy.resolve(context);
			if (outcome !== null) return outcome;
		}

		return {
			kind: "error",
			error: "Path resolution failed: no strategy matched",
		};
	}

	private findCandidatePath(relativePath: string, sourceFile: string): string {
		const decodedRelativePath = decodeURIComponent(relativePath);

		// Strategy 0: Expand tilde to home directory
		if (decodedRelativePath.startsWith("~/")) {
			const expandedPath = resolve(homedir(), decodedRelativePath.slice(2));
			if (this.isFile(expandedPath)) {
				return expandedPath;
			}
		}

		// Strategy 1: Standard relative path resolution with decoded path
		const sourceDir = dirname(sourceFile);
		const standardPath = resolve(sourceDir, decodedRelativePath);

		if (this.isFile(standardPath)) {
			return standardPath;
		}

		// Also try with original (non-decoded) path for backwards compatibility
		if (decodedRelativePath !== relativePath) {
			const originalStandardPath = resolve(sourceDir, relativePath);
			if (this.isFile(originalStandardPath)) {
				return originalStandardPath;
			}
		}

		// Strategy 2: Handle Obsidian absolute path format
		if (this.isObsidianAbsolutePath(decodedRelativePath)) {
			const obsidianPath = this.convertObsidianToFilesystemPath(
				decodedRelativePath,
				sourceFile,
			);
			if (obsidianPath && this.isFile(obsidianPath)) {
				return obsidianPath;
			}
		}

		// Strategy 3: Resolve source file symlinks, then try relative resolution
		try {
			const realSourceFile = this.safeRealpathSync(sourceFile);
			if (realSourceFile !== sourceFile) {
				const realSourceDir = dirname(realSourceFile);

				const symlinkResolvedPath = resolve(realSourceDir, decodedRelativePath);
				if (this.isFile(symlinkResolvedPath)) {
					return symlinkResolvedPath;
				}

				if (decodedRelativePath !== relativePath) {
					const originalSymlinkPath = resolve(realSourceDir, relativePath);
					if (this.isFile(originalSymlinkPath)) {
						return originalSymlinkPath;
					}
				}
			}
		} catch (_error) {
			// Continue to next strategy if symlink resolution fails
		}

		return standardPath;
	}

	// ── Directory helpers ──────────────────────────────────────────────────────

	isDirectoryMatch(sourceFile: string, targetFile: string): boolean {
		const sourceDir = dirname(sourceFile);
		const targetDir = dirname(targetFile);
		return sourceDir === targetDir;
	}

	calculateRelativePath(sourceFile: string, targetFile: string): string {
		const sourceDir = dirname(sourceFile);
		const relPath = relative(sourceDir, targetFile);
		return relPath.replace(/\\/g, "/");
	}

	// ── Path conversion suggestion ─────────────────────────────────────────────

	generatePathConversionSuggestion(
		originalCitation: string,
		sourceFile: string,
		targetFile: string,
	): PathConversion {
		const relativePath = this.calculateRelativePath(sourceFile, targetFile);

		const anchorMatch = originalCitation.match(/#(.*)$/);
		const anchor = anchorMatch?.[1] ? `#${anchorMatch[1]}` : "";

		return {
			type: "path-conversion",
			original: originalCitation,
			recommended: `${relativePath}${anchor}`,
		};
	}
}
