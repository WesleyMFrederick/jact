import { describe, expect, it } from "vitest";
import { JactCli } from "../../dist/jact.js";

describe("JactCli public methods TypeScript", () => {
	it("validate returns { output, result } per Type-I shape (D3 GAP-6)", async () => {
		const manager = new JactCli();
		// Use a non-existent file to trigger error path
		const { output, result } = await manager.validate("/nonexistent/file.md");
		expect(typeof output).toBe("string");
		expect(result.summary).toBeDefined();
		expect(result.summary.byLinkClass).toBeDefined();
		expect(result.summary.unrecognizedCount).toBeDefined();
	});

	it("validate with json format returns parseable JSON output", async () => {
		const manager = new JactCli();
		const { output, result } = await manager.validate("/nonexistent/file.md", {
			format: "json",
		});
		expect(typeof output).toBe("string");
		const parsed = JSON.parse(output);
		expect(parsed.error).toBeDefined();
		// result is structured even on error path
		expect(result.summary).toBeDefined();
	});

	it("fix returns string", async () => {
		const manager = new JactCli();
		const result = await manager.fix("/nonexistent/file.md");
		expect(typeof result).toBe("string");
	});
});
