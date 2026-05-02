// Migrated from src/FileCache.ts inline (per file header comment guidance, G1)
// Types now consumed by: FileCache, JactCli.applyScope, error formatters
import type { ScopeResolution } from "../core/resolveScope.js";

export interface CacheStats {
	totalFiles: number;
	duplicates: number;
	scopeFolder: string;
	realScopeFolder: string;
}

export interface ResolveResultSuccess {
	found: true;
	path: string;
	fuzzyMatch?: boolean;
	correctedFilename?: string;
	message?: string;
}

export interface ResolveResultFailure {
	found: false;
	reason: "duplicate" | "not_found" | "duplicate_fuzzy";
	message: string;
	// D7 additions (optional fields populated based on `reason`):
	candidates?: string[]; // when reason: 'duplicate' | 'duplicate_fuzzy'
	scope?: ScopeResolution; // populated by applyScope (Phase 2 D3)
	nearMisses?: string[]; // when reason: 'not_found'; top-3 Levenshtein ≤2
}

export type ResolveResult = ResolveResultSuccess | ResolveResultFailure;
