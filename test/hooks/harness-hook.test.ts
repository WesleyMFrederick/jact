import {
	appendFileSync,
	closeSync,
	openSync,
	mkdirSync,
	mkdtempSync,
	realpathSync,
	renameSync,
	rmSync,
	writeSync,
	writeFileSync,
} from "node:fs";
import type * as NodeFs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	type JactRunner,
	MAX_READ_CONTEXT_CHARS,
	parseHookPayload,
	runHarnessHook,
} from "../../src/hooks/harnessHook.js";

vi.mock("node:fs", async (importOriginal) => {
	const fs = await importOriginal<typeof NodeFs>();
	return { ...fs, appendFileSync: vi.fn(fs.appendFileSync), renameSync: vi.fn(fs.renameSync) };
});

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

// Antigravity CLI events, in the shape of https://antigravity.google/docs/hooks.
function antigravityEvent(fields: object, conversationId: string): string {
	return JSON.stringify({
		conversationId,
		workspacePaths: [project],
		transcriptPath: `~/.gemini/antigravity/brain/${conversationId}/.system_generated/logs/transcript.jsonl`,
		artifactDirectoryPath: `~/.gemini/antigravity/brain/${conversationId}`,
		modelName: "gemini-3.6-flash-medium",
		...fields,
	});
}

const antigravityTool = (name: string, args: object, conversationId = "c-0") =>
	antigravityEvent(
		{ toolCall: { name, args }, stepIdx: 5, error: "" },
		conversationId,
	);
const antigravityModelCall = (conversationId: string) =>
	antigravityEvent({ invocationNum: 1, initialNumSteps: 6 }, conversationId);
const antigravityStop = (conversationId: string) =>
	antigravityEvent(
		{ executionNum: 0, terminationReason: "model_stop", fullyIdle: true },
		conversationId,
	);

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

	it("Antigravity CLI: the tool sits under toolCall, with TargetFile or AbsolutePath", () => {
		for (const tool of [
			"write_to_file",
			"replace_file_content",
			"multi_replace_file_content",
		])
			expect(
				parseHookPayload(
					antigravityTool(tool, { TargetFile: note }, "c-parse"),
				),
			).toEqual({
				kind: "write",
				paths: [note],
				cwd: project,
				sessionId: "c-parse",
			});
		expect(
			parseHookPayload(
				antigravityTool("view_file", { AbsolutePath: note }, "c-parse"),
			),
		).toMatchObject({ kind: "read", paths: [note] });
		expect(
			parseHookPayload(
				antigravityTool("run_command", { CommandLine: "npm test" }),
			),
		).toBeUndefined();
	});

	it("Antigravity CLI 1.5.12, as a live session sent it: write_file, edit_file and read_file carry Path", () => {
		const live = (name: string, args: object) =>
			antigravityEvent(
				{
					cwd: project,
					hookEventName: "PostToolUse",
					toolCall: { name, args, id: "call_1" },
					stepIdx: 2,
					error: "",
				},
				"c-live",
			);
		expect(
			parseHookPayload(
				live("write_file", { Content: "x\n", Overwrite: true, Path: note }),
			),
		).toEqual({
			kind: "write",
			paths: [note],
			cwd: project,
			sessionId: "c-live",
		});
		expect(
			parseHookPayload(
				live("edit_file", { Path: note, Replacement: "b", Target: "a" }),
			),
		).toMatchObject({ kind: "write", paths: [note] });
		expect(parseHookPayload(live("read_file", { Path: note }))).toMatchObject({
			kind: "read",
			paths: [note],
		});
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

describe("runHarnessHook for Antigravity CLI, whose tool hook cannot answer the model", () => {
	const broken: JactRunner = () => ({
		status: 1,
		stdout: "ERRORS (1)\n- Line 1: [x](missing.md)\n",
	});
	const clean: JactRunner = () => ({ status: 0, stdout: "" });
	const linked: JactRunner = () => ({
		status: 0,
		stdout: JSON.stringify({
			extractedContentBlocks: {
				abc123: { content: "## Details\n\nThe answer." },
			},
		}),
	});
	const antigravityHook = (
		event: string,
		payload: string,
		run: JactRunner = clean,
	) => runHarnessHook("antigravity", payload, run, event);
	const write = (conversationId: string) =>
		antigravityTool("write_to_file", { TargetFile: note }, conversationId);
	const read = (conversationId: string) =>
		antigravityTool("view_file", { AbsolutePath: note }, conversationId);

	it("holds a broken-link report, then hands it over one time before the next model call", () => {
		expect(antigravityHook("PostToolUse", write("c-1"), broken)).toBe("{}");
		const delivered = JSON.parse(
			antigravityHook("PreInvocation", antigravityModelCall("c-1")),
		);
		expect(delivered.injectSteps).toHaveLength(1);
		expect(delivered.injectSteps[0].systemMessage.systemMessage).toContain(
			"missing.md",
		);
		expect(antigravityHook("PreInvocation", antigravityModelCall("c-1"))).toBe(
			"{}",
		);
	});

	it("hands a result over as a nested system message, which agy 1.5.12 keeps in the conversation", () => {
		// In live sessions the model lost an ephemeralMessage after one model call,
		// and agy dropped a systemMessage that was plain text.
		antigravityHook("PostToolUse", write("c-13"), broken);
		const delivered = JSON.parse(
			antigravityHook("PreInvocation", antigravityModelCall("c-13")),
		);
		expect(delivered).toEqual({
			injectSteps: [
				{ systemMessage: { systemMessage: expect.stringContaining("jact:") } },
			],
		});
	});

	it("hands over the sections that a read file links to", () => {
		expect(antigravityHook("PostToolUse", read("c-2"), linked)).toBe("{}");
		const delivered = JSON.parse(
			antigravityHook("PreInvocation", antigravityModelCall("c-2")),
		);
		expect(delivered.injectSteps[0].systemMessage.systemMessage).toContain(
			"## Details\n\nThe answer.",
		);
	});

	it("withdraws a report when the same file is written again with valid links", () => {
		antigravityHook("PostToolUse", write("c-3"), broken);
		antigravityHook("PostToolUse", write("c-3"), clean);
		expect(antigravityHook("PreInvocation", antigravityModelCall("c-3"))).toBe(
			"{}",
		);
	});

	it("withdraws each file of a multi-file patch when fixed separately", () => {
		const id = "multi-file-fix";
		antigravityHook("PostToolUse", antigravityTool("apply_patch", { paths: [note, other] }, id), broken);
		antigravityHook("PostToolUse", write(id), clean);
		const remaining = JSON.parse(antigravityHook("Stop", antigravityStop(id)));
		expect(remaining.reason).not.toContain(`in ${note}\n`);
		expect(remaining.reason).toContain(`in ${other}\n`);
		antigravityHook("PostToolUse", antigravityTool("apply_patch", { paths: [note, other] }, id), broken);
		antigravityHook("PostToolUse", write(id), clean);
		antigravityHook("PostToolUse", antigravityTool("edit_file", { Path: other }, id), clean);
		expect(JSON.parse(antigravityHook("Stop", antigravityStop(id)))).toEqual({ decision: "stop" });
	});

	it.each([2, null])("does not withdraw a report after inconclusive validation (%s)", (status) => {
		const id = `inconclusive-${status}`;
		antigravityHook("PostToolUse", write(id), broken);
		antigravityHook("PostToolUse", write(id), () => ({ status, stdout: "" }));
		expect(antigravityHook("Stop", antigravityStop(id))).toContain("missing.md");
	});

	it("cannot lose a writer's entry when a consumer drains during its write", async () => {
		const fs = await vi.importActual<typeof NodeFs>("node:fs");
		const id = "overlapping-writer";
		antigravityHook("PostToolUse", write(id), broken);
		const received: string[] = [];
		vi.mocked(appendFileSync).mockImplementationOnce((file, data) => {
			// Reproduce opening the append handle before a consumer renames and reads it.
			const descriptor = openSync(file, "a");
			received.push(antigravityHook("PreInvocation", antigravityModelCall(id)));
			try {
				writeSync(descriptor, String(data));
			} finally {
				closeSync(descriptor);
			}
		});
		vi.mocked(renameSync).mockImplementationOnce((from, to) => {
			// New storage publishes a closed temporary file after the concurrent drain.
			received.push(antigravityHook("PreInvocation", antigravityModelCall(id)));
			fs.renameSync(from, to);
		});
		try {
			antigravityHook("PostToolUse", antigravityTool("edit_file", { Path: other }, id), broken);
			received.push(antigravityHook("PreInvocation", antigravityModelCall(id)));
			expect(received.join("\n")).toContain(`in ${note}\\n`);
			expect(received.join("\n")).toContain(`in ${other}\\n`);
		} finally {
			vi.mocked(appendFileSync).mockReset().mockImplementation(fs.appendFileSync);
			vi.mocked(renameSync).mockReset().mockImplementation(fs.renameSync);
		}
	});

	it("keeps the report of each conversation apart", () => {
		antigravityHook("PostToolUse", write("c-4"), broken);
		expect(
			antigravityHook("PreInvocation", antigravityModelCall("c-other")),
		).toBe("{}");
		expect(
			antigravityHook("PreInvocation", antigravityModelCall("c-4")),
		).toContain("missing.md");
	});

	it("Stop: a report the model has not seen makes the agent continue, one time", () => {
		antigravityHook("PostToolUse", write("c-5"), broken);
		const held = JSON.parse(antigravityHook("Stop", antigravityStop("c-5")));
		expect(held.decision).toBe("continue");
		expect(held.reason).toContain("missing.md");
		expect(JSON.parse(antigravityHook("Stop", antigravityStop("c-5")))).toEqual(
			{
				decision: "stop",
			},
		);
	});

	it("Stop: linked content from a read never holds the agent", () => {
		antigravityHook("PostToolUse", read("c-6"), linked);
		expect(JSON.parse(antigravityHook("Stop", antigravityStop("c-6")))).toEqual(
			{
				decision: "stop",
			},
		);
		expect(antigravityHook("PreInvocation", antigravityModelCall("c-6"))).toBe(
			"{}",
		);
	});

	it("skips a tool call that Antigravity reports as failed", () => {
		const failedWrite = antigravityEvent(
			{
				toolCall: { name: "write_to_file", args: { TargetFile: note } },
				stepIdx: 5,
				error: "permission denied",
			},
			"c-7",
		);
		expect(antigravityHook("PostToolUse", failedWrite, broken)).toBe("{}");
		expect(antigravityHook("PreInvocation", antigravityModelCall("c-7"))).toBe(
			"{}",
		);
	});

	it("always answers with JSON, because Antigravity reads an answer from each hook", () => {
		const noTool = antigravityEvent({ toolCall: null, stepIdx: 1 }, "c-8");
		for (const payload of ["", "not json", "[]", noTool]) {
			expect(antigravityHook("PostToolUse", payload, broken)).toBe("{}");
			expect(antigravityHook("PreInvocation", payload)).toBe("{}");
			expect(JSON.parse(antigravityHook("Stop", payload))).toEqual({
				decision: "stop",
			});
		}
		expect(antigravityHook("SomeNewEvent", antigravityModelCall("c-8"))).toBe(
			"{}",
		);
	});

	it("treats a call without an event name as PostToolUse", () => {
		expect(runHarnessHook("antigravity", write("c-9"), broken)).toBe("{}");
		expect(
			antigravityHook("PreInvocation", antigravityModelCall("c-9")),
		).toContain("missing.md");
	});

	it("reads the event from hookEventName, which agy 1.5.12 sends, when none is passed", () => {
		runHarnessHook("antigravity", write("c-10"), broken);
		const named = (hookEventName: string) =>
			antigravityEvent({ hookEventName, invocationNum: 1 }, "c-10");
		expect(
			runHarnessHook("antigravity", named("PreInvocation"), clean),
		).toContain("missing.md");
		expect(
			JSON.parse(runHarnessHook("antigravity", named("Stop"), clean)),
		).toEqual({ decision: "stop" });
	});

	it("an event name that is passed wins over hookEventName", () => {
		antigravityHook("PostToolUse", write("c-11"), broken);
		const stopNamedOtherwise = antigravityEvent(
			{ hookEventName: "PreInvocation" },
			"c-11",
		);
		expect(
			JSON.parse(antigravityHook("Stop", stopNamedOtherwise)).decision,
		).toBe("continue");
	});

	it("a second read of the same file in one step keeps the linked content", () => {
		// jact extracts each linked section one time for a session, so the second read is empty.
		antigravityHook("PostToolUse", read("c-12"), linked);
		antigravityHook("PostToolUse", read("c-12"), clean);
		expect(
			antigravityHook("PreInvocation", antigravityModelCall("c-12")),
		).toContain("The answer.");
	});

	it("leaves the other harnesses unchanged when an event name is passed", () => {
		const output = runHarnessHook(
			"claude",
			event("Write", { file_path: note }),
			broken,
			"PostToolUse",
		);
		expect(JSON.parse(output).decision).toBe("block");
	});
});
