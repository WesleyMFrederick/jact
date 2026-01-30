import { dirname, isAbsolute, resolve } from "node:path";

/**
 * Resolve relative paths to absolute using source file's directory
 *
 * @param rawPath - The raw path from markdown link
 * @param sourceAbsolutePath - The absolute path of the source file
 * @returns Absolute path or null if resolution fails
 */
export function resolvePath(rawPath: string, sourceAbsolutePath: string): string | null {
	if (!rawPath || !sourceAbsolutePath) return null;

	if (isAbsolute(rawPath)) {
		return rawPath;
	}

	const sourceDir = dirname(sourceAbsolutePath);
	return resolve(sourceDir, rawPath);
}
