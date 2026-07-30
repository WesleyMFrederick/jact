import { describe, expect, it, vi } from "vitest";
import { PathResolver } from "../../../src/core/CitationValidator/PathResolver.js";
import type { LinkObject } from "../../../src/types/citationTypes.js";

function citation(rawPath: string): LinkObject {
	return {
		line: 1,
		column: 1,
		text: "target",
		fullMatch: `[target](${rawPath})`,
		linkType: "markdown",
		scope: "cross-document",
		anchorType: null,
		source: { path: { raw: "/base/source.md", absolute: "/base/source.md" } },
		target: {
			path: { raw: rawPath, absolute: null },
			anchor: null,
		},
		extractionMarker: null,
	};
}

function resolver(): PathResolver {
	return new PathResolver({
		resolveFile: () => ({ found: false, reason: "not_found" }),
	});
}

describe("PathResolver complete outcomes", () => {
	it("returns the standard path when the direct file exists", () => {
		const subject = resolver();
		vi.spyOn(subject, "isFile").mockImplementation((candidate) =>
			candidate.endsWith("/target.md"),
		);

		const outcome = subject.resolveCitationPath(
			citation("target.md"),
			"/base/source.md",
		);

		expect(outcome).toMatchObject({
			kind: "resolved",
			targetPath: "/base/target.md",
			anchorFailureStatus: "error",
		});
	});

	it("expands tilde paths before returning a resolved outcome", () => {
		const subject = resolver();
		vi.spyOn(subject, "isFile").mockImplementation((candidate) =>
			candidate.endsWith("/somefile.md"),
		);

		const outcome = subject.resolveCitationPath(
			citation("~/somefile.md"),
			"/any/source.md",
		);

		expect(outcome.kind).toBe("resolved");
		if (outcome.kind === "resolved") {
			expect(outcome.targetPath).not.toMatch(/^~/);
			expect(outcome.targetPath).toMatch(/somefile\.md$/);
		}
	});

	it("detects vault-relative Obsidian paths", () => {
		const subject = resolver();

		expect(
			subject.isObsidianAbsolutePath("0_SoftwareDevelopment/file.md"),
		).toBe(true);
		expect(subject.isObsidianAbsolutePath("/absolute/path.md")).toBe(false);
		expect(subject.isObsidianAbsolutePath("relative/file.md")).toBe(true);
		expect(subject.isObsidianAbsolutePath("/starts/with/slash.md")).toBe(
			false,
		);
	});

	it("returns a complete warning outcome for folder targets", () => {
		const subject = resolver();
		vi.spyOn(subject, "isDirectory").mockImplementation((candidate) =>
			candidate.endsWith("/folder"),
		);

		const outcome = subject.resolveCitationPath(
			citation("folder"),
			"/base/source.md",
		);

		expect(outcome).toMatchObject({
			kind: "warning",
			error: "Link points to a folder, not a file: folder",
		});
	});

	it("returns a complete error outcome for missing files", () => {
		const outcome = resolver().resolveCitationPath(
			citation("missing.md"),
			"/base/source.md",
		);

		expect(outcome).toMatchObject({
			kind: "error",
			error: "File not found: missing.md",
		});
		if (outcome.kind === "error") {
			expect(outcome.suggestion).toContain("Tried: /base/missing.md");
		}
	});

	it("includes attempted paths in missing-file diagnostics", () => {
		const info = resolver().generatePathResolutionDebugInfo(
			"relative/target.md",
			"/base/source.md",
		);
		expect(info).toContain("Tried:");
	});
});
