import { describe, it, expect } from "vitest";
import type {
	CliValidateOptions,
	CliExtractOptions,
	FormattedValidationResult,
	FixDetail,
} from "../../../src/types/contentExtractorTypes.js";

describe("CLI Types", () => {
	it("CliValidateOptions accepts valid options", () => {
		const opts: CliValidateOptions = {
			format: "json",
			lines: "150-160",
			scope: "/docs",
			fix: true,
		};
		expect(opts.format).toBe("json");
	});

	it("CliValidateOptions allows empty object", () => {
		const opts: CliValidateOptions = {};
		expect(opts).toBeDefined();
	});

	it("CliExtractOptions accepts valid options", () => {
		const opts: CliExtractOptions = {
			scope: "/docs",
			format: "json",
			fullFiles: true,
		};
		expect(opts.fullFiles).toBe(true);
	});

	it("FormattedValidationResult extends ValidationResult", () => {
		const result: FormattedValidationResult = {
			summary: { total: 1, valid: 1, warnings: 0, errors: 0 },
			links: [],
			validationTime: "0.5s",
			lineRange: "10-20",
		};
		expect(result.validationTime).toBe("0.5s");
		expect(result.lineRange).toBe("10-20");
	});

	it("FixDetail captures fix metadata", () => {
		const fix: FixDetail = {
			line: 42,
			old: "old-citation-text",
			new: "new-citation-text",
			type: "path",
		};
		expect(fix.type).toBe("path");
	});
});
