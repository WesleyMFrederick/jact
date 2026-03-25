import { homedir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePath } from "../../src/core/MarkdownParser/resolvePath.js";

describe("resolvePath — tilde expansion", () => {
	const sourceFile = "/Users/wes/docs/source.md";

	it("expands ~/foo/bar.md to {homedir}/foo/bar.md", () => {
		const result = resolvePath("~/foo/bar.md", sourceFile);
		expect(result).toBe(resolve(homedir(), "foo/bar.md"));
	});

	it("expands ~/.claude/projects/file.md to absolute path", () => {
		const result = resolvePath("~/.claude/projects/file.md", sourceFile);
		expect(result).toBe(resolve(homedir(), ".claude/projects/file.md"));
	});

	it("does NOT expand bare ~ (no slash)", () => {
		const result = resolvePath("~", sourceFile);
		// bare ~ should resolve as a relative path against source dir
		expect(result).toBe(resolve("/Users/wes/docs", "~"));
	});

	it("does NOT expand ~user/foo (named user tilde)", () => {
		const result = resolvePath("~user/foo", sourceFile);
		// ~user is not ~/user — should resolve as relative
		expect(result).toBe(resolve("/Users/wes/docs", "~user/foo"));
	});

	it("passes absolute paths through unchanged", () => {
		const result = resolvePath("/absolute/path.md", sourceFile);
		expect(result).toBe("/absolute/path.md");
	});

	it("resolves relative paths against source directory", () => {
		const result = resolvePath("sibling.md", sourceFile);
		expect(result).toBe("/Users/wes/docs/sibling.md");
	});

	it("returns null for empty rawPath", () => {
		expect(resolvePath("", sourceFile)).toBeNull();
	});

	it("returns null for empty sourceAbsolutePath", () => {
		expect(resolvePath("~/foo.md", "")).toBeNull();
	});
});
