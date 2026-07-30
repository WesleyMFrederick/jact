import { describe, expect, it } from "vitest";
import { JactCli } from "../../dist/jact-cli.js";

describe("JactCli public operations", () => {
	const operationNames = [
		"getAst",
		"validate",
		"validateContent",
		"extractLinks",
		"extractFile",
	] as const;

	for (const operationName of operationNames) {
		it(`exposes ${operationName}`, () => {
			const manager = new JactCli();
			expect(typeof manager[operationName]).toBe("function");
		});
	}
});
