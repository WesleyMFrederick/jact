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
	// Optional diagnostic fields, populated based on `reason`:
	candidates?: string[]; // reason: 'duplicate' | 'duplicate_fuzzy'
	scope?: ScopeResolution; // populated when caller built the cache via applyScope
	nearMisses?: string[]; // reason: 'not_found'; top-3 Levenshtein ≤ 2
}

export type ResolveResult = ResolveResultSuccess | ResolveResultFailure;
