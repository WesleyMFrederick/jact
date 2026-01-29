import { describe, it, expect } from "vitest";

describe("citation-manager CLI wiring TypeScript", () => {
	it("imports without errors", async () => {
		// Dynamic import to test the module loads correctly
		const module = await import("../../dist/citation-manager.js");
		expect(module.CitationManager).toBeDefined();
	});
});
