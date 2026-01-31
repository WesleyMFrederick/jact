import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";

const srcDir = resolve(import.meta.dirname ?? "", "../../src");
const projectRoot = resolve(import.meta.dirname ?? "", "../../..");

/**
 * Recursively collect all .ts files in a directory.
 */
function collectTsFiles(dir: string): string[] {
	const results: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = resolve(dir, entry);
		if (statSync(full).isDirectory()) {
			results.push(...collectTsFiles(full));
		} else if (full.endsWith(".ts") && !full.endsWith(".test.ts") && !full.endsWith(".spec.ts")) {
			results.push(full);
		}
	}
	return results;
}

/**
 * Type safety tests for tools/citation-manager/src/
 *
 * Ensures zero explicit `any` usage across the entire source directory.
 * Covers both biome lint violations and raw `as any` assertions.
 */
describe("citation-manager src/ type safety — no explicit any", () => {
	it("contains zero noExplicitAny biome violations across all src/ files", () => {
		let output: string;
		try {
			output = execSync(`npx biome check ${srcDir} 2>&1`, {
				encoding: "utf-8",
				cwd: projectRoot,
			});
		} catch (error) {
			output = (error as { stdout?: string }).stdout ?? String(error);
		}

		const anyViolations = (output.match(/noExplicitAny/g) ?? []).length;
		expect(anyViolations, `Found ${anyViolations} noExplicitAny biome violations in src/`).toBe(
			0,
		);
	});

	it("contains zero 'as any' type assertions across all src/ files", () => {
		const tsFiles = collectTsFiles(srcDir);
		const violations: string[] = [];

		for (const file of tsFiles) {
			const content = readFileSync(file, "utf-8");
			const lines = content.split("\n");
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (line && /as any/.test(line)) {
					violations.push(`${relative(srcDir, file)}:${i + 1}: ${line.trim()}`);
				}
			}
		}

		expect(
			violations.length,
			`Found ${violations.length} 'as any' assertion(s):\n${violations.join("\n")}`,
		).toBe(0);
	});
});
