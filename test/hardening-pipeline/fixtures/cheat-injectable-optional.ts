// Fixture for C1 (D1 ESLint + vitest idiom-guard).
// Reproduces Plan-01 Cheat 1 (dead-code-on-optional injectable dep).
// MUST trigger ESLint `no-restricted-syntax` AST selector AND vitest regex guard.
// MUST NOT trigger if `// @inject-optional: <reason>` precedes.

import type { FileCache } from "../../../src/FileCache.js";

// VIOLATION: optional FileCache injected as dep, no escape-hatch comment.
export function violatingFn(name: string, fileCache?: FileCache) {
	return fileCache ? fileCache : name;
}

// ALLOWED: same shape with explicit escape-hatch comment.
// @inject-optional: legacy adapter still in flight, see GH issue #999
export function allowedFn(name: string, fileCache?: FileCache) {
	return fileCache ? fileCache : name;
}
