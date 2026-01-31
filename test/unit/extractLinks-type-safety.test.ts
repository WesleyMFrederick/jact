import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

/**
 * Type safety test for extractLinks.ts
 *
 * Validates that the source file contains zero `noExplicitAny` biome violations.
 * This test was written BEFORE the fix (TDD RED phase) and should fail
 * until all `any` type usages are replaced with proper marked.js types.
 */
describe("extractLinks.ts type safety", () => {
	const filePath = resolve(
		import.meta.dirname ?? "",
		"../../src/core/MarkdownParser/extractLinks.ts",
	);

	it("contains zero noExplicitAny biome violations", () => {
		let output: string;
		try {
			output = execSync(`npx biome check ${filePath} 2>&1`, {
				encoding: "utf-8",
				cwd: resolve(import.meta.dirname ?? "", "../../.."),
			});
		} catch (error) {
			// biome exits non-zero when there are violations
			output = (error as { stdout?: string }).stdout ?? String(error);
		}

		const anyViolations = (output.match(/noExplicitAny/g) ?? []).length;
		expect(anyViolations, `Found ${anyViolations} noExplicitAny violations`).toBe(0);
	});

	it("does not contain 'as any' type assertions in source", () => {
		const fs = require("node:fs");
		const content: string = fs.readFileSync(filePath, "utf-8");
		const asAnyMatches = content.match(/as any/g) ?? [];
		expect(
			asAnyMatches.length,
			`Found ${asAnyMatches.length} 'as any' assertions in extractLinks.ts`,
		).toBe(0);
	});
});
