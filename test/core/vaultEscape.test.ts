import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	destinationSpan,
	resolveVaultEscape,
} from "../../src/core/vaultEscape.js";

const vault = "/vault";
const noteDir = "/vault/notes";

describe("resolveVaultEscape", () => {
	it("Given a file URL whose scheme colon is percent-encoded, When classified, Then it still escapes to the decoded path", () => {
		expect(resolveVaultEscape("file%3A///repo/docs/a%20b.md", noteDir, vault)).toBe(
			"/repo/docs/a b.md",
		);
	});

	it("Given a percent-encoded web URL, When classified, Then it is external and does not escape", () => {
		expect(resolveVaultEscape("https%3A//example.com/x.md", noteDir, vault)).toBeNull();
	});

	it("Given malformed percent-encoding in an absolute path, When classified, Then the undecoded path still escapes", () => {
		expect(resolveVaultEscape("/repo/100%.md", noteDir, vault)).toBe("/repo/100%.md");
	});

	it("Given Markdown backslash escapes in a relative path, When classified, Then the unescaped path resolves outside the vault", () => {
		expect(resolveVaultEscape("../../repo/spec\\_v1\\.md#A", noteDir, vault)).toBe(
			path.resolve(noteDir, "../../repo/spec_v1.md"),
		);
	});
});

describe("destinationSpan", () => {
	it("Given an inline link whose title holds escaped quotes, When located, Then the destination is the path alone and the title stays after it", () => {
		const fullMatch = '[q](/abs/e.md "say \\"hi\\" now")';
		const span = destinationSpan(fullMatch);
		expect(span?.text).toBe("/abs/e.md");
		expect(fullMatch.slice(span?.end)).toBe(' "say \\"hi\\" now")');
	});

	it("Given a reference definition whose title holds escaped quotes, When located, Then the destination is the path alone", () => {
		const span = destinationSpan('[q]: /abs/e.md "say \\"hi\\" now"');
		expect(span?.text).toBe("/abs/e.md");
	});

	it("Given an angle destination holding an escaped >, When located, Then the destination runs to the first unescaped > and resolves to the unescaped path", () => {
		const fullMatch = "[q](</abs/a\\>b.md>)";
		const span = destinationSpan(fullMatch);
		expect(span?.text).toBe("/abs/a\\>b.md");
		expect(span?.end).toBe(fullMatch.length - 1);
		expect(resolveVaultEscape(span?.text ?? "", noteDir, vault)).toBe(
			"/abs/a>b.md",
		);
	});
});
