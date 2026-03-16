import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { detectNestedCodeblocks } from "../../src/core/MarkdownParser/detectNestedCodeblocks.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, "..", "fixtures");

describe("Issue #16: detect nested backtick codeblocks", () => {
	describe("nested backtick detection", () => {
		it("should flag nested backtick codeblocks", () => {
			// Given: A markdown file with backtick fences nested inside backtick fences
			const content = readFileSync(
				join(fixturesDir, "issue-16-nested-backticks.md"),
				"utf8",
			);

			// When: Detecting nested codeblocks
			const warnings = detectNestedCodeblocks(content);

			// Then: Should have a warning about nested backtick codeblocks
			expect(warnings.length).toBeGreaterThan(0);

			const nestedWarning = warnings.find((w) => w.message.includes("Nested"));
			expect(nestedWarning).toBeDefined();
			expect(nestedWarning.line).toBeGreaterThan(0);
		});

		it("should suggest using tilde fences for the outer block", () => {
			// Given: A file with nested backtick codeblocks
			const content = readFileSync(
				join(fixturesDir, "issue-16-nested-backticks.md"),
				"utf8",
			);

			// When: Detecting nested codeblocks
			const warnings = detectNestedCodeblocks(content);

			// Then: The warning message should suggest using ~~~ for the outer block
			const nestedWarning = warnings.find((w) => w.message.includes("Nested"));
			expect(nestedWarning).toBeDefined();
			expect(nestedWarning.message).toMatch(/~~~/);
		});
	});

	describe("valid tilde-wrapped outer blocks", () => {
		it("should NOT flag tilde outer blocks containing backtick inner blocks", () => {
			// Given: A markdown file that correctly uses ~~~ for outer and ``` for inner
			const content = readFileSync(
				join(fixturesDir, "issue-16-tilde-outer-valid.md"),
				"utf8",
			);

			// When: Detecting nested codeblocks
			const warnings = detectNestedCodeblocks(content);

			// Then: No nested codeblock warnings should be present
			const nestedWarnings = warnings.filter((w) =>
				w.message.includes("Nested"),
			);
			expect(nestedWarnings).toHaveLength(0);
		});
	});
});
