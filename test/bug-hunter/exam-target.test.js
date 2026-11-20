import { describe, expect, it } from "vitest";
import { COMPARE_FILE_LIMIT, compareToPr, reviewTarget, sessionPrefix } from "../../.github/bug-hunter/target.mjs";

const BASE = "0e4b88033d84a0b9ab83da71808dc82f24ee5c40";
const HEAD = "9f336d6df4c67aa04fe743ae48176723c1c6fe04";

describe("reviewTarget", () => {
	it("reviews a pull request when neither SHA is set", () => {
		expect(reviewTarget({ PR_NUMBER: "130" })).toEqual({ exam: false });
	});

	it("enters exam mode with two full SHAs and a run label", () => {
		expect(reviewTarget({ BASE_SHA: BASE, HEAD_SHA: HEAD, RUN_LABEL: "exam3" })).toEqual({ exam: true, base: BASE, head: HEAD, label: "exam3" });
	});

	it("gives every exam a label even when none is set", () => {
		expect(reviewTarget({ BASE_SHA: BASE, HEAD_SHA: HEAD }).label).toMatch(/^[a-z0-9]+$/);
	});

	it("rejects a label with spaces or symbols, since it goes in the session title", () => {
		expect(() => reviewTarget({ BASE_SHA: BASE, HEAD_SHA: HEAD, RUN_LABEL: "a b" })).toThrow(/RUN_LABEL/);
	});

	it.each([
		["only one SHA", { HEAD_SHA: HEAD }],
		["a short SHA", { BASE_SHA: BASE, HEAD_SHA: "9f336d6" }],
		["a branch name", { BASE_SHA: "main", HEAD_SHA: HEAD }],
	])("rejects %s", (_, env) => {
		expect(() => reviewTarget(env)).toThrow(/full 40-character/);
	});
});

describe("compareToPr", () => {
	const compare = {
		files: [{ filename: "a.mjs", patch: "@@ -1 +1 @@\n-x\n+y" }],
		commits: [{ sha: HEAD, commit: { message: "fix(bug-hunter): split in the runner\n\nlonger body" } }],
	};

	it("shapes the range like a pull request the runner already reads", () => {
		const { pr, files } = compareToPr(compare, { base: BASE, head: HEAD });
		expect(files).toBe(compare.files);
		expect(pr.head.sha).toBe(HEAD);
		expect(pr.base.sha).toBe(BASE);
		expect(pr.title).toBe("Commits 0e4b880..9f336d6");
	});

	it("describes the change with in-range commit subjects only", () => {
		const { pr } = compareToPr(compare, { base: BASE, head: HEAD });
		expect(pr.body).toBe("Commits in this range:\n- 9f336d6 fix(bug-hunter): split in the runner");
	});

	it("refuses a range at the compare API's file limit instead of reviewing part of it", () => {
		const many = { files: Array.from({ length: COMPARE_FILE_LIMIT }, (_, i) => ({ filename: `f${i}` })), commits: [] };
		expect(() => compareToPr(many, { base: BASE, head: HEAD })).toThrow(/stops at 300/);
	});
});

describe("sessionPrefix", () => {
	it("lets parallel exams on one snapshot leave each other alone", () => {
		const a = sessionPrefix("o/r", { exam: true, base: BASE, head: HEAD, label: "exam3" });
		const b = sessionPrefix("o/r", { exam: true, base: BASE, head: HEAD, label: "exam30" });
		expect(a).toBe("Bug Hunter exam o/r@0e4b880..9f336d6 #exam3 ");
		expect(a.startsWith(b) || b.startsWith(a)).toBe(false);
	});

	it("keeps exam sessions and pull request sessions apart", () => {
		const exam = sessionPrefix("o/r", { exam: true, base: BASE, head: HEAD, label: "x" });
		const pr = sessionPrefix("o/r", { exam: false }, 130);
		expect(exam).toBe("Bug Hunter exam o/r@0e4b880..9f336d6 #x ");
		expect(pr).toBe("Bug Hunter o/r#130 ");
		expect(exam.startsWith(pr) || pr.startsWith(exam)).toBe(false);
	});
});
