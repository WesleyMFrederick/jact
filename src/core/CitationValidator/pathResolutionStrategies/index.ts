/**
 * pathResolutionStrategies — default strategy array for cross-document link resolution.
 *
 * Precedence order (first non-null result wins):
 *   1. WikiFastPath  — wiki link with parser-resolved absolute path
 *   2. WikiFailLoud  — wiki link that failed parser resolution
 *   3. FolderLink    — resolved path is a directory (not a file)
 *   4. FileFound     — target file exists on disk (standard or cross-dir)
 *   5. CacheFallback — file not found; probe FileCache for fuzzy/exact/duplicate
 *
 * Pattern mirrors eligibilityStrategies in ContentExtractor (issue #28).
 */

export { CacheFallbackStrategy } from "./CacheFallbackStrategy.js";
export { FileFoundStrategy } from "./FileFoundStrategy.js";
export { FolderLinkStrategy } from "./FolderLinkStrategy.js";
export type {
	PathResolutionContext,
	PathResolutionResult,
	PathResolutionStrategy,
} from "./PathResolutionStrategy.js";
export { WikiFailLoudStrategy } from "./WikiFailLoudStrategy.js";
export { WikiFastPathStrategy } from "./WikiFastPathStrategy.js";

import { CacheFallbackStrategy } from "./CacheFallbackStrategy.js";
import { FileFoundStrategy } from "./FileFoundStrategy.js";
import { FolderLinkStrategy } from "./FolderLinkStrategy.js";
import type { PathResolutionStrategy } from "./PathResolutionStrategy.js";
import { WikiFailLoudStrategy } from "./WikiFailLoudStrategy.js";
import { WikiFastPathStrategy } from "./WikiFastPathStrategy.js";

export const defaultPathResolutionStrategies: PathResolutionStrategy[] = [
	new WikiFastPathStrategy(),
	new WikiFailLoudStrategy(),
	new FolderLinkStrategy(),
	new FileFoundStrategy(),
	new CacheFallbackStrategy(),
];
