/**
 * Shared component interfaces for dependency injection across the jact codebase.
 *
 * These interfaces define the minimal contracts that concrete implementations
 * (ParsedFileCache, FileCache) must satisfy, enabling test doubles and adapters
 * to be injected without importing production classes.
 *
 * Canonical definitions live in:
 *   - ParsedFileCacheLike: AnchorMatcher.ts (used by AnchorMatcher, CitationValidator)
 *   - FileCacheLike: PathResolver.ts (used by PathResolver, CitationValidator)
 *
 * This module re-exports both for use in componentFactory and other consumers
 * that should not take a transitive dependency on internal component modules.
 */

export type { ParsedFileCacheLike } from "../core/CitationValidator/AnchorMatcher.js";
export type { FileCacheLike } from "../core/CitationValidator/PathResolver.js";
