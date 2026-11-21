// Bug Hunter's CI script turns the agent's last message into a review. These tests pin how it reads
// that message: a misread report either loses findings or passes a broken review as clean.
import { describe, expect, it } from "vitest";
import { parseReport } from "../../.github/bug-hunter/report.mjs";

const wrap = (report, before = "Done. Here is the report.") =>
	`${before}\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n`;

const finding = (overrides = {}) => ({
	severity: "high",
	file: "src/a.ts",
	line: 10,
	title: "Crash on empty input",
	body: "Throws on an empty list.",
	...overrides,
});

describe("parseReport", () => {
	it("reads a plain report", () => {
		const report = parseReport(
			wrap({ summary: "s", not_covered: [], findings: [finding()] }),
		);
		expect(report.findings).toHaveLength(1);
	});

	// C11/F6: a finding whose body quotes code in a fence used to cut the json block short.
	it("keeps a finding whose body contains a code fence", () => {
		const body = "Repro:\n```js\nparse([])\n```\nThrows TypeError.";
		const report = parseReport(
			wrap({ summary: "s", not_covered: [], findings: [finding({ body })] }),
		);
		expect(report.findings).toHaveLength(1);
		expect(report.findings[0].body).toBe(body);
	});

	it("keeps a finding whose body mentions a json fence", () => {
		const body = "The agent returns ```json blocks; the last one wins.";
		const report = parseReport(
			wrap({ summary: "s", not_covered: [], findings: [finding({ body })] }),
		);
		expect(report.findings[0].body).toBe(body);
	});

	it("uses the last json block when the message has more than one", () => {
		const text = `${wrap({ findings: [] }, "Draft:")}${wrap({ findings: [finding()] }, "Final:")}`;
		expect(parseReport(text).findings).toHaveLength(1);
	});

	// C30/R10: a broken report must fail the review, never pass as zero findings.
	it.each([
		["an empty object", {}],
		["a capitalised severity", { findings: [finding({ severity: "High" })] }],
		["an unknown severity", { findings: [finding({ severity: "critical" })] }],
		["a non-numeric line", { findings: [finding({ line: "ten" })] }],
		["a non-array not_covered", { findings: [], not_covered: "s1" }],
	])("rejects %s", (_name, report) => {
		expect(() => parseReport(wrap(report))).toThrow();
	});

	it("rejects a message with no json block", () => {
		expect(() => parseReport("No findings.")).toThrow(/no json block/);
	});
});
