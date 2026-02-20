import { describe, it, expect } from "vitest";

describe("jact CLI wiring TypeScript", () => {
	it("imports without errors", async () => {
		// Dynamic import to test the module loads correctly
		const module = await import("../../dist/jact.js");
		expect(module.JactCli).toBeDefined();
	});
});
