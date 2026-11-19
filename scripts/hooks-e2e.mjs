#!/usr/bin/env node
// Proves that `jact setup <harness>` wires a real harness on the first try.
//
//   node scripts/hooks-e2e.mjs <claude|codex|antigravity|gemini|pi|omp|all> [--synthetic] [--keep]
//
// For each harness it builds a throwaway project, runs `jact setup`, starts the
// harness without a UI, and asks it to write one Markdown file with a broken
// link and to read one Markdown file. The hook records each call in a log
// (JACT_HOOK_LOG). The run passes when the log shows the write was caught and
// the read returned linked content.
//
// Antigravity CLI hands the result over through a later hook. So its live run
// also fails unless the model's reply shows the broken-link report and the
// linked content, two texts that only jact supplies.
//
// --synthetic  skip the harness; pipe a sample event into the installed command
// --keep       leave the throwaway project on disk and print its path
//
// A live run uses your logged-in harness account for one short prompt.
// Run `npm run build` first: the hooks call this checkout's dist/cli.js.

import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HARNESSES = ["claude", "codex", "antigravity", "gemini", "pi", "omp"];
// Codex reads files through shell commands, so it has no read event to hook.
const HAS_READ_HOOK = {
	claude: true,
	codex: false,
	antigravity: true,
	gemini: true,
	pi: true,
	omp: true,
};
const PROMPT = [
	"Do exactly two things, then stop.",
	"1. Create the file docs/broken.md with exactly this one line: See [the missing page](missing.md).",
	"2. Read the file docs/index.md with your file read tool.",
	"Then reply with the single word DONE. Do not fix or change any file afterwards.",
].join("\n");
// Antigravity CLI hands jact's text to the model through a separate hook, so
// the hook log shows what jact handed over but not what the model read. This
// prompt makes the reply show it: neither answer is in a file the model opens.
const ANTIGRAVITY_PROMPT = [
	"Do exactly these steps, then stop.",
	"1. Create the file docs/broken.md with exactly this one line: See [the missing page](missing.md).",
	"2. Read the file docs/index.md with your file read tool. Do not open any other file.",
	"3. Reply with two lines.",
	"Line 1: the port that the staging server listens on, if any text shown to you in this conversation states it. Otherwise the word UNKNOWN.",
	"Line 2: the first line of any report about docs/broken.md that you received. Otherwise the word NONE.",
	"Do not fix or change any file afterwards.",
].join("\n");
const REPORT_MARK = "broken markdown links";
const LINKED_MARK = "4242";

const cli = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"dist",
	"cli.js",
);
const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const wanted = args.filter((arg) => !arg.startsWith("--"));
const targets = wanted.includes("all") ? HARNESSES : wanted;

if (targets.length === 0 || targets.some((name) => !HARNESSES.includes(name))) {
	console.error(
		`Usage: node scripts/hooks-e2e.mjs <${HARNESSES.join("|")}|all> [--synthetic] [--keep]`,
	);
	process.exit(2);
}
if (!existsSync(cli)) {
	console.error(`Missing ${cli}. Run: npm run build`);
	process.exit(2);
}

function quote(value) {
	return `'${value.replaceAll("'", "'\\''")}'`;
}

function harnessCommand(harness, project) {
	switch (harness) {
		case "claude":
			return [
				"claude",
				"-p",
				PROMPT,
				"--setting-sources",
				"project",
				"--permission-mode",
				"acceptEdits",
			];
		case "codex":
			return [
				"codex",
				"exec",
				"-s",
				"workspace-write",
				"--skip-git-repo-check",
				"--dangerously-bypass-hook-trust",
				"-c",
				`projects.${JSON.stringify(project)}.trust_level="trusted"`,
				PROMPT,
			];
		case "antigravity":
			// Without a UI, agy denies each tool it was not allowed. This project is throwaway.
			return [
				"agy",
				"-p",
				ANTIGRAVITY_PROMPT,
				"--dangerously-skip-permissions",
			];
		case "gemini":
			// Gemini ignores project hooks in a folder it does not trust.
			return ["gemini", "-p", PROMPT, "--approval-mode=yolo", "--skip-trust"];
		case "pi":
			// pi skips a project's extensions until the project is trusted.
			return ["pi", "-p", PROMPT, "--no-session", "--approve"];
		default:
			return ["omp", "-p", PROMPT, "--no-session"];
	}
}

function syntheticEvents(harness, project) {
	const broken = join(project, "docs", "broken.md");
	const index = join(project, "docs", "index.md");
	const base = { cwd: project, session_id: "e2e-synthetic" };
	if (harness === "claude")
		return [
			{ ...base, tool_name: "Write", tool_input: { file_path: broken } },
			{ ...base, tool_name: "Read", tool_input: { file_path: index } },
		];
	if (harness === "codex")
		return [
			{
				...base,
				tool_name: "apply_patch",
				tool_input: {
					command:
						"*** Begin Patch\n*** Add File: docs/broken.md\n+See [the missing page](missing.md).\n*** End Patch",
				},
			},
		];
	if (harness === "gemini")
		return [
			{ ...base, tool_name: "write_file", tool_input: { file_path: broken } },
			{ ...base, tool_name: "read_file", tool_input: { file_path: index } },
		];
	return [
		{ ...base, tool_name: "write", tool_input: { path: "docs/broken.md" } },
		{ ...base, tool_name: "read", tool_input: { path: "docs/index.md" } },
	];
}

// Antigravity CLI's tool hook cannot answer the model. So this plays the
// harness: it reads the installed hooks file and runs the command of each
// event, with input in the shape that agy 1.5.12 sent in a live session.
// Returns the problems it found.
function playAntigravity(project) {
	const problems = [];
	const installed =
		JSON.parse(readFileSync(join(project, ".agents", "hooks.json"), "utf8"))
			.jact ?? {};
	const send = (handler, hookEventName, fields) => {
		const { stdout } = spawnSync(handler.command, {
			cwd: project,
			shell: true,
			encoding: "utf8",
			input: JSON.stringify({
				conversationId: "e2e-synthetic",
				workspacePaths: [project],
				cwd: project,
				hookEventName,
				...fields,
			}),
		});
		try {
			return JSON.parse(stdout);
		} catch {
			problems.push(`"${handler.command}" did not print JSON: ${stdout}`);
			return {};
		}
	};
	// [tool name, tool arguments or undefined to check the matcher only, matcher must select it]
	const toolCalls = [
		// The names and the Path field that agy 1.5.12 sent.
		["write_file", { Path: join(project, "docs", "broken.md") }, true],
		["read_file", { Path: join(project, "docs", "index.md") }, true],
		["edit_file", undefined, true],
		// The names in Google's hook documentation.
		["write_to_file", undefined, true],
		["replace_file_content", undefined, true],
		["multi_replace_file_content", undefined, true],
		["view_file", undefined, true],
		["run_command", undefined, false],
	];
	for (const [name, toolArgs, wanted] of toolCalls) {
		const handlers = (installed.PostToolUse ?? [])
			.filter((group) => new RegExp(`^(?:${group.matcher})$`).test(name))
			.flatMap((group) => group.hooks);
		if (handlers.length > 0 !== wanted)
			problems.push(`the PostToolUse matcher is wrong for the tool ${name}`);
		if (toolArgs === undefined) continue;
		for (const handler of handlers) {
			const answer = send(handler, "PostToolUse", {
				toolCall: { name, args: toolArgs, id: "call_1" },
				stepIdx: 2,
				error: "",
			});
			if (Object.keys(answer).length > 0)
				problems.push(`PostToolUse must answer {} but answered for ${name}`);
		}
	}
	const told = (installed.PreInvocation ?? [])
		.map((handler) =>
			send(handler, "PreInvocation", { invocationNum: 1, initialNumSteps: 3 }),
		)
		.flatMap((answer) => answer.injectSteps ?? [])
		.map((step) => step.systemMessage?.systemMessage ?? "")
		.join("\n");
	if (!told.includes("missing.md"))
		problems.push("PreInvocation did not hand the broken link to the model");
	if (!told.includes("4242"))
		problems.push("PreInvocation did not hand the linked section to the model");
	for (const handler of installed.Stop ?? []) {
		const answer = send(handler, "Stop", {
			executionNum: 0,
			fullyIdle: true,
			continuationActive: false,
			terminationReason: "NO_TOOL_CALL",
			error: "",
		});
		if (answer.decision !== "stop")
			problems.push(
				`Stop must let the agent stop but answered ${JSON.stringify(answer)}`,
			);
	}
	return problems;
}

function runOne(harness) {
	const project = realpathSync(
		mkdtempSync(join(tmpdir(), `jact-hook-e2e-${harness}-`)),
	);
	const log = join(project, "jact-hook.log");
	const problems = [];
	const jact = (extra) =>
		spawnSync(process.execPath, [cli, ...extra], {
			cwd: project,
			encoding: "utf8",
		});

	mkdirSync(join(project, "docs"), { recursive: true });
	writeFileSync(
		join(project, "package.json"),
		'{ "name": "jact-hook-e2e", "private": true }\n',
	);
	// The linked fact is dull on purpose. With "The launch code is 4242." a Claude
	// model in Antigravity CLI answered UNKNOWN in 4 of 4 runs: it read the text
	// and would not repeat a code that a hook supplied.
	writeFileSync(
		join(project, "docs", "target.md"),
		"# Target\n\n## Details\n\nThe staging server listens on port 4242.\n",
	);
	writeFileSync(
		join(project, "docs", "index.md"),
		"# Index\n\nSee [Details](target.md#Details).\n",
	);

	const command = `JACT_HOOK_LOG=${quote(log)} ${quote(process.execPath)} ${quote(cli)}`;
	const setup = jact(["setup", harness, "--command", command]);
	if (setup.status !== 0)
		problems.push(`setup exited ${setup.status}: ${setup.stderr.trim()}`);
	const check = jact(["setup", harness, "--check", "--command", command]);
	if (check.status !== 0) problems.push(`setup --check exited ${check.status}`);

	const started = Date.now();
	let reply = "";
	if (flags.has("--synthetic")) {
		writeFileSync(
			join(project, "docs", "broken.md"),
			"See [the missing page](missing.md).\n",
		);
		if (harness === "antigravity") problems.push(...playAntigravity(project));
		else
			for (const event of syntheticEvents(harness, project))
				spawnSync(`${command} hook ${harness}`, {
					cwd: project,
					shell: true,
					input: JSON.stringify(event),
					encoding: "utf8",
				});
	} else {
		// JACT_E2E_ARGS adds harness flags, for example: JACT_E2E_ARGS="--model <id>"
		const extra = (process.env.JACT_E2E_ARGS ?? "").split(" ").filter(Boolean);
		const [bin, ...rest] = [...harnessCommand(harness, project), ...extra];
		const run = spawnSync(bin, rest, {
			cwd: project,
			encoding: "utf8",
			timeout: 300_000,
			stdio: ["ignore", "pipe", "pipe"],
		});
		reply = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
		if (run.error) problems.push(`could not run ${bin}: ${run.error.message}`);
		else if (run.status !== 0)
			problems.push(
				`${bin} exited ${run.status}: ${(run.stderr || run.stdout).trim().slice(-400)}`,
			);
		if (flags.has("--verbose"))
			console.log(
				`  harness output:\n${`${run.stdout}\n${run.stderr}`.trim().slice(-1500)}`,
			);
	}
	const seconds = ((Date.now() - started) / 1000).toFixed(1);

	const calls = existsSync(log)
		? readFileSync(log, "utf8")
				.split("\n")
				.filter(Boolean)
				.map((line) => JSON.parse(line))
		: [];
	const caughtWrite = calls.some(
		(call) => call.kind === "write" && call.failed === true,
	);
	const enrichedRead = calls.some(
		(call) => call.kind === "read" && call.contextChars > 0,
	);
	if (!caughtWrite)
		problems.push("the write hook did not report the broken link");
	if (HAS_READ_HOOK[harness] && !enrichedRead)
		problems.push("the read hook did not return linked content");
	// Antigravity CLI: a caught write counts only when a later event handed it to the model.
	const handedOver = [
		...new Set(
			calls.filter((call) => call.deliveredChars > 0).map((call) => call.event),
		),
	];
	if (harness === "antigravity") {
		if (handedOver.length === 0)
			problems.push(
				"no PreInvocation or Stop call handed a result to the model",
			);
		else console.log(`  handed to the model by: ${handedOver.join(", ")}`);
		if (!flags.has("--synthetic")) {
			// If the model opened the linked page itself, the port number proves nothing.
			const openedLinkedPage = calls.some((call) =>
				(call.paths ?? []).some((path) => path.endsWith("target.md")),
			);
			const sawReport = reply.toLowerCase().includes(REPORT_MARK);
			const sawLinked = reply.includes(LINKED_MARK) && !openedLinkedPage;
			const shown = [
				...(sawReport ? ["the broken-link report"] : []),
				...(sawLinked ? ["the linked content"] : []),
			];
			console.log(
				`  the model's reply shows: ${shown.length > 0 ? shown.join(", ") : "no text from jact"}`,
			);
			if (!sawReport)
				problems.push(
					"the model's reply does not show jact's broken-link report, so the write hook may not reach the model. Run again with --verbose to read the reply.",
				);
			if (openedLinkedPage)
				problems.push(
					"the model opened the linked page itself, so this run cannot show whether the read hook reaches the model. Run again.",
				);
			else if (!sawLinked)
				problems.push(
					"the model's reply does not show the linked content, so the read hook may not reach the model. Run again with --verbose to read the reply.",
				);
		}
	}

	if (flags.has("--keep")) console.log(`  kept ${project}`);
	else rmSync(project, { recursive: true, force: true });

	return {
		harness,
		pass: problems.length === 0,
		write: caughtWrite ? "caught" : "missed",
		read: HAS_READ_HOOK[harness]
			? enrichedRead
				? "enriched"
				: "missed"
			: "not offered by harness",
		hookCalls: calls.length,
		seconds,
		problems,
	};
}

const results = targets.map((harness) => {
	console.log(
		`▶ ${harness} (${flags.has("--synthetic") ? "synthetic" : "live"})`,
	);
	const result = runOne(harness);
	console.log(
		`  ${result.pass ? "PASS" : "FAIL"}  write: ${result.write}  read: ${result.read}  hook calls: ${result.hookCalls}  ${result.seconds}s`,
	);
	for (const problem of result.problems) console.log(`  - ${problem}`);
	return result;
});

process.exit(results.every((result) => result.pass) ? 0 : 1);
