import {
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	type Harness,
	type JactRunner,
	MAX_READ_CONTEXT_CHARS,
	parseHookPayload,
	runHarnessHook,
} from "../../src/hooks/harnessHook.js";

let project: string;
let note: string;
let other: string;

beforeAll(() => {
	project = realpathSync(mkdtempSync(join(tmpdir(), "jact-hook-unit-")));
	mkdirSync(join(project, "docs"));
	note = join(project, "docs", "note.md");
	other = join(project, "docs", "other.md");
	writeFileSync(note, "# Note\n");
	writeFileSync(other, "# Other\n");
	writeFileSync(join(project, "docs", "code.ts"), "export {};\n");
});

afterAll(() => {
	rmSync(project, { recursive: true, force: true });
});

function event(
	toolName: string,
	toolInput: unknown,
	extra: object = {},
): string {
	return JSON.stringify({
		tool_name: toolName,
		tool_input: toolInput,
		cwd: project,
		...extra,
	});
}

describe("parseHookPayload reads each harness's tool event", () => {
	it("Claude Code: Write, Edit and MultiEdit carry tool_input.file_path", () => {
		for (const tool of ["Write", "Edit", "MultiEdit"]) {
			const request = parseHookPayload(
				event(tool, { file_path: note }, { session_id: "s1" }),
			);
			expect(request).toEqual({
				kind: "write",
				paths: [note],
				cwd: project,
				sessionId: "s1",
			});
		}
	});

	it("Claude Code: Read is a read", () => {
		expect(parseHookPayload(event("Read", { file_path: note }))?.kind).toBe(
			"read",
		);
	});

	it("Codex: apply_patch names each changed file in the patch text", () => {
		const patch = [
			"*** Begin Patch",
			"*** Add File: docs/note.md",
			"+# Note",
			"*** Update File: docs/other.md",
			"@@",
			"-old",
			"+new",
			"*** Update File: docs/code.ts",
			"*** Add File: docs/not-on-disk.md",
			"*** End Patch",
		].join("\n");
		const request = parseHookPayload(event("apply_patch", { command: patch }));
		expect(request?.kind).toBe("write");
		expect(request?.paths).toEqual([note, other]);
	});

	it("Codex: a patch that renames a file checks the new name", () => {
		const patch =
			"*** Begin Patch\n*** Update File: docs/gone.md\n*** Move to: docs/other.md\n*** End Patch";
		expect(
			parseHookPayload(event("apply_patch", { command: patch }))?.paths,
		).toEqual([other]);
	});

	it("Gemini CLI: write_file, replace and read_file carry tool_input.file_path", () => {
		expect(
			parseHookPayload(event("write_file", { file_path: note }))?.kind,
		).toBe("write");
		expect(parseHookPayload(event("replace", { file_path: note }))?.kind).toBe(
			"write",
		);
		expect(
			parseHookPayload(event("read_file", { file_path: "docs/note.md" })),
		).toMatchObject({ kind: "read", paths: [note] });
	});

	it("pi and omp: write, edit and read carry tool_input.path, relative or @-prefixed", () => {
		expect(
			parseHookPayload(event("write", { path: "docs/note.md" }))?.paths,
		).toEqual([note]);
		expect(
			parseHookPayload(event("read", { path: "@docs/note.md" })),
		).toMatchObject({ kind: "read", paths: [note] });
		expect(
			parseHookPayload(
				event("edit", { paths: ["docs/note.md", "docs/other.md"] }),
			)?.paths,
		).toEqual([note, other]);
	});

	it("ignores events jact has nothing to say about", () => {
		const ignored = [
			event("Bash", { command: "cat docs/note.md" }),
			event("Write", { file_path: join(project, "docs", "code.ts") }),
			event("Write", { file_path: join(project, "docs", "missing.md") }),
			event("Write", {}),
			JSON.stringify({ tool_input: { file_path: note } }),
			"not json",
			"[]",
			"",
		];
		for (const payload of ignored)
			expect(parseHookPayload(payload)).toBeUndefined();
	});
});

describe("runHarnessHook on a write", () => {
	const broken: JactRunner = () => ({
		status: 1,
		stdout: "ERRORS (1)\n- Line 1: [x](missing.md)\n",
	});

	it("runs validate on the written file", () => {
		const calls: string[][] = [];
		runHarnessHook(
			"claude",
			event("Write", { file_path: note }),
			(args, cwd) => {
				calls.push([...args, cwd]);
				return { status: 0, stdout: "" };
			},
		);
		expect(calls).toEqual([["validate", note, project]]);
	});

	it("says nothing when links are valid or when jact itself fails", () => {
		for (const status of [0, 2, null])
			expect(
				runHarnessHook("claude", event("Write", { file_path: note }), () => ({
					status,
					stdout: "anything",
				})),
			).toBe("");
	});

	it("Claude Code and Codex: broken links block with a reason the model reads", () => {
		for (const harness of ["claude", "codex"] as const) {
			const output = JSON.parse(
				runHarnessHook(harness, event("Write", { file_path: note }), broken),
			);
			expect(output.decision).toBe("block");
			expect(output.reason).toContain("missing.md");
			expect(output.reason).toContain(`jact validate "${note}"`);
		}
	});

	it("Gemini CLI: broken links arrive as AfterTool additional context", () => {
		const output = JSON.parse(
			runHarnessHook(
				"gemini",
				event("write_file", { file_path: note }),
				broken,
			),
		);
		expect(output.hookSpecificOutput.hookEventName).toBe("AfterTool");
		expect(output.hookSpecificOutput.additionalContext).toContain("missing.md");
	});

	it("pi and omp: broken links arrive as context plus a failed flag", () => {
		for (const harness of ["pi", "omp"] as const) {
			const output = JSON.parse(
				runHarnessHook(harness, event("write", { path: note }), broken),
			);
			expect(output.failed).toBe(true);
			expect(output.context).toContain("missing.md");
		}
	});
});

describe("runHarnessHook on a read", () => {
	const linked =
		(content: string): JactRunner =>
		() => ({
			status: 0,
			stdout: JSON.stringify({
				extractedContentBlocks: {
					_totalContentCharacterLength: content.length,
					abc123: { content, contentLength: content.length },
				},
			}),
		});

	it("runs extract links with the harness session id", () => {
		const calls: string[][] = [];
		runHarnessHook(
			"claude",
			event("Read", { file_path: note }, { session_id: "s9" }),
			(args) => {
				calls.push([...args]);
				return { status: 0, stdout: "{}" };
			},
		);
		expect(calls).toEqual([["extract", "links", note, "--session", "s9"]]);
	});

	it("returns linked sections in each harness's format and never marks a read as failed", () => {
		interface HookOutput {
			hookSpecificOutput?: { additionalContext?: string };
			context?: string;
			decision?: string;
			failed?: boolean;
		}
		const nested = (parsed: HookOutput) =>
			parsed.hookSpecificOutput?.additionalContext;
		const flat = (parsed: HookOutput) => parsed.context;
		const shapes = [
			["claude", nested],
			["codex", nested],
			["gemini", nested],
			["pi", flat],
			["omp", flat],
		] as const;
		for (const [harness, pick] of shapes) {
			const parsed: HookOutput = JSON.parse(
				runHarnessHook(
					harness,
					event("read", { path: note }),
					linked("## Details\n\nThe answer."),
				),
			);
			expect(pick(parsed)).toContain("## Details\n\nThe answer.");
			expect(parsed.decision).toBeUndefined();
			expect(parsed.failed ?? false).toBe(false);
		}
	});

	it("says nothing when the file links to nothing, or extraction fails", () => {
		const quiet: JactRunner[] = [
			() => ({ status: 0, stdout: "" }),
			() => ({ status: 0, stdout: '{"extractedContentBlocks":{}}' }),
			() => ({ status: 1, stdout: "No eligible links" }),
		];
		for (const run of quiet)
			expect(
				runHarnessHook("claude", event("Read", { file_path: note }), run),
			).toBe("");
	});

	it("caps the linked content it adds to the model's context", () => {
		const parsed = JSON.parse(
			runHarnessHook(
				"pi",
				event("read", { path: note }),
				linked("x".repeat(MAX_READ_CONTEXT_CHARS * 2)),
			),
		);
		expect(parsed.context.length).toBeLessThan(MAX_READ_CONTEXT_CHARS + 200);
		expect(parsed.context).toContain("linked content cut at");
	});
});
