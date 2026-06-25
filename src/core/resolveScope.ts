// Pure function — no I/O beyond fs.existsSync
// Algorithm: ① explicit → ② nearest marker up from cwd → ③ nearest marker up
//            from targetFile dir → ④ none
//
// "Nearest wins": walking up from a start dir, the first directory level that
// contains ANY recognized marker wins. Same-level tiebreak order is
// .git > .obsidian > package.json (repo root > vault root > sub-project).

import * as defaultFs from "node:fs";
import path from "node:path";

export type ScopeSource =
	| "explicit"
	| "cwd-git"
	| "cwd-obsidian"
	| "cwd-pkg"
	| "target-git"
	| "target-obsidian"
	| "target-pkg"
	| "none";

export interface ResolveScopeInput {
	explicit?: string;
	cwd: string;
	targetFile?: string;
	fs?: typeof import("fs"); // injectable for tests
}

export interface ScopeResolution {
	scope: string; // resolved abs path; empty string when source === 'none'
	source: ScopeSource;
	/** Marker that won (".git" | ".obsidian" | "package.json"), for messaging. */
	marker?: Marker;
	triedFallbacks?: string[]; // for D7 M3 error message; populated when source === 'none'
}

type Marker = ".git" | ".obsidian" | "package.json";

// Same-level priority: repo root, then vault root, then sub-project.
const MARKERS: readonly Marker[] = [".git", ".obsidian", "package.json"];

const CWD_SOURCE: Record<Marker, ScopeSource> = {
	".git": "cwd-git",
	".obsidian": "cwd-obsidian",
	"package.json": "cwd-pkg",
};
const TARGET_SOURCE: Record<Marker, ScopeSource> = {
	".git": "target-git",
	".obsidian": "target-obsidian",
	"package.json": "target-pkg",
};

export function resolveScope(input: ResolveScopeInput): ScopeResolution {
	const { explicit, cwd, targetFile } = input;
	const fsModule = input.fs ?? defaultFs;

	// ① explicit override — trust caller completely
	if (explicit !== undefined && explicit !== "") {
		return { scope: explicit, source: "explicit" };
	}

	// ② nearest marker walking up from cwd
	const cwdHit = walkUpForAny(cwd, fsModule);
	if (cwdHit !== null) {
		return {
			scope: cwdHit.dir,
			source: CWD_SOURCE[cwdHit.marker],
			marker: cwdHit.marker,
		};
	}

	// ③ nearest marker walking up from targetFile dir
	if (targetFile !== undefined) {
		const targetDir = path.dirname(path.resolve(targetFile));
		const targetHit = walkUpForAny(targetDir, fsModule);
		if (targetHit !== null) {
			return {
				scope: targetHit.dir,
				source: TARGET_SOURCE[targetHit.marker],
				marker: targetHit.marker,
			};
		}
	}

	// ④ none — enumerate what was tried for M3 error message
	const triedFallbacks: string[] = [`cwd: ${cwd}`];
	if (targetFile !== undefined) {
		triedFallbacks.push(
			`targetFile dir: ${path.dirname(path.resolve(targetFile))}`,
		);
	}

	return { scope: "", source: "none", triedFallbacks };
}

/**
 * Walk up from startDir; return the first directory level containing any
 * recognized marker, plus which marker won (same-level order: MARKERS).
 */
function walkUpForAny(
	startDir: string,
	fsModule: typeof import("fs"),
): { dir: string; marker: Marker } | null {
	let dir = path.resolve(startDir);
	while (true) {
		for (const marker of MARKERS) {
			if (fsModule.existsSync(path.join(dir, marker))) return { dir, marker };
		}
		const parent = path.dirname(dir);
		if (parent === dir) return null; // reached filesystem root
		dir = parent;
	}
}
