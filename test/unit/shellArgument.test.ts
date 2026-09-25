import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { shellFileArgument } from "../../src/shellArgument.js";

describe("shellFileArgument", () => {
	it.each([
		"docs/file with spaces.md",
		"docs/it's literal.md",
		'docs/"double quote".md',
		"docs/$(printf injected).md",
		"docs/`printf injected`.md",
		"docs/path\\segment.md",
		'docs/combined path/it\'s "$HOME" `printf injected` \\file.md',
	])("passes %s through the shell as literal text", (input) => {
		const result = spawnSync(
			"sh",
			["-c", `printf '%s' ${shellFileArgument(input)}`],
			{ encoding: "utf8" },
		);

		expect(result.status).toBe(0);
		expect(result.stderr).toBe("");
		expect(result.stdout).toBe(input);
	});
});
