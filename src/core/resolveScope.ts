// Pure function — no I/O beyond fs.existsSync
// Algorithm: ① explicit → ② cwd .git → ③ cwd package.json → ④ targetFile .git
//            → ⑤ targetFile package.json → ⑥ none

import * as defaultFs from "node:fs";
import path from "node:path";

export type ScopeSource =
	| "explicit"
	| "cwd-git"
	| "cwd-pkg"
	| "target-git"
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
	triedFallbacks?: string[]; // for D7 M3 error message; populated when source === 'none'
}

export function resolveScope(input: ResolveScopeInput): ScopeResolution {
	const { explicit, cwd, targetFile } = input;
	const fsModule = input.fs ?? defaultFs;

	// ① explicit override — trust caller completely
	if (explicit !== undefined && explicit !== "") {
		return { scope: explicit, source: "explicit" };
	}

	// ② walk up from cwd looking for .git
	const cwdGit = walkUpFor(cwd, ".git", fsModule);
	if (cwdGit !== null) return { scope: cwdGit, source: "cwd-git" };

	// ③ walk up from cwd looking for package.json
	const cwdPkg = walkUpFor(cwd, "package.json", fsModule);
	if (cwdPkg !== null) return { scope: cwdPkg, source: "cwd-pkg" };

	// ④ walk up from targetFile dir looking for .git
	if (targetFile !== undefined) {
		const targetDir = path.dirname(path.resolve(targetFile));

		const targetGit = walkUpFor(targetDir, ".git", fsModule);
		if (targetGit !== null) return { scope: targetGit, source: "target-git" };

		// ⑤ walk up from targetFile dir looking for package.json
		const targetPkg = walkUpFor(targetDir, "package.json", fsModule);
		if (targetPkg !== null) return { scope: targetPkg, source: "target-pkg" };
	}

	// ⑥ none — enumerate what was tried for M3 error message
	const triedFallbacks: string[] = [`cwd: ${cwd}`];
	if (targetFile !== undefined) {
		triedFallbacks.push(
			`targetFile dir: ${path.dirname(path.resolve(targetFile))}`,
		);
	}

	return { scope: "", source: "none", triedFallbacks };
}

function walkUpFor(
	startDir: string,
	marker: ".git" | "package.json",
	fsModule: typeof import("fs"),
): string | null {
	let dir = path.resolve(startDir);
	while (true) {
		if (fsModule.existsSync(path.join(dir, marker))) return dir;
		const parent = path.dirname(dir);
		if (parent === dir) return null; // reached filesystem root
		dir = parent;
	}
}
