#!/usr/bin/env node

/**
 * JACT CLI entry point — Commander command registration.
 *
 * This module owns all Commander `.command()` registrations. It delegates
 * orchestration to JactCli, which is independently importable without
 * activating Commander.
 *
 * Extracted from jact.ts as part of issue #29.
 *
 * @module cli
 */

import { Argument, Command, InvalidArgumentError, Option } from "commander";
import { isDynamicPattern } from "tinyglobby";
import {
	checkExtractCache,
	writeExtractCache,
} from "./cache/checkExtractCache.js";
import { RenameValidationError } from "./core/rename-markdown-file.js";
import { createValidationWorkflow } from "./factories/componentFactory.js";
import { formatContentMap, formatExtractResult } from "./formatExtractResult.js";
import { JactCli, linkedContentHints } from "./jact-cli.js";
import type {
	CliExtractOptions,
	CliRenameOptions,
	CliValidateOptions,
} from "./types/cli-types.js";
import type { HeaderExtractionResult } from "./types/extraction-types.js";
import { runBatch, type ValidateOneFn } from "./validate/batch-runner.js";
import { renderHuman, renderJson } from "./validate/renderers.js";
import { NotAGitRepositoryError } from "./validate/resolve-changed-files.js";
import {
	NoFilesMatchedError,
	resolveFileSet,
} from "./validate/resolve-files.js";

const CACHE_DIR = ".jact/claude-cache";

/**
 * Semantic suggestion map for common user mistakes
 *
 * Maps common synonyms and typos to correct commands/options.
 * Used by custom error handler to provide helpful suggestions.
 */
const semanticSuggestionMap: Record<string, string[]> = {
	// Command synonyms
	check: ["validate"],
	verify: ["validate"],
	lint: ["validate"],
	parse: ["ast"],
	tree: ["outline"],
	debug: ["ast"],
	show: ["ast"],

	// Option synonyms
	fix: ["--fix"],
	repair: ["--fix"],
	correct: ["--fix"],
	output: ["--format"],
	json: ["--format json"],
	range: ["--lines"],
	folder: ["--scope"],
	directory: ["--scope"],
	path: ["--scope"],
	dir: ["--scope"],
};

const program: Command = new Command();

program
	.name("jact")
	.description("Citation validation and management tool for markdown files")
	.version("1.0.0")
	.addHelpText(
		"after",
		"\nEach command has its own help page. Run `jact <command> --help`.",
	);

// Configure custom error output with semantic suggestions
program.configureOutput({
	outputError: (str: string, write: (str: string) => void) => {
		const match = str.match(/unknown (?:command|option) '([^']+)'/);
		if (match?.[1]) {
			const input = match[1].replace(/^--?/, "");
			const suggestions = semanticSuggestionMap[input];

			if (suggestions) {
				write(
					`Unknown ${match[0].includes("command") ? "command" : "option"} '${match[1]}'\n`,
				);
				write(`Did you mean: ${suggestions.join(", ")}?\n`);
				return;
			}
		}
		write(str);
	},
});

/** Read all of process.stdin to a UTF-8 string (used by `validate --stdin`). */
async function readAllStdin(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks).toString("utf8");
}

interface CliBatchValidateOptions extends CliValidateOptions {
	changed?: boolean;
	json?: boolean;
	stdin?: boolean;
}

program
	.command("validate")
	.description(
		"Validate citations in a markdown file, checking that target files exist and anchors resolve correctly",
	)
	// Optional at the Commander level so --stdin's missing-<file-path> case can exit 2
	// with our own message (D2) instead of Commander's generic usage error.
	.argument(
		"[paths...]",
		"path(s) to markdown file(s) and/or glob patterns; omit when using --changed alone; with --stdin, exactly one path (the intended on-disk path, not read from disk)",
	)
	.option("--format <type>", "output format (cli, json)", "cli")
	.option(
		"--lines <range>",
		'validate specific line range (e.g., "150-160" or "157")',
	)
	.option(
		"--scope <folder>",
		"limit file resolution to specific folder (enables smart filename matching)",
	)
	.option(
		"--fix",
		"automatically fix citation anchors including kebab-case conversions and missing anchor corrections",
	)
	.option(
		"--dry-run",
		"preview fixes without writing files; prints a diff of what would change (use with --fix)",
	)
	.option(
		"--verbose",
		"show full validation report; in batch mode, expand error details that default output collapses",
		false,
	)
	.option(
		"--allow-gitignore",
		"include files that .gitignore would normally exclude in the scope scan (default: respect .gitignore)",
		false,
	)
	.option(
		"--changed",
		"add git working-tree-modified markdown to the selection (union with paths, deduped); alone → just the changed markdown",
		false,
	)
	.option(
		"--json",
		"batch mode: emit one compact JSON object per file (JSONL) instead of human-readable lines",
		false,
	)
	.option(
		"--stdin",
		"read markdown from stdin; <path> is treated as the intended path (not read from disk); requires exactly one path, incompatible with batch selection",
	)
	.addHelpText(
		"after",
		`
Default Output (no --verbose):
  Clean file:      "OK: <N> citations valid"
  Errors/warnings: ERRORS (n) and/or WARNINGS (n) blocks with line, link, error, suggestion; ends with "FAILED: X errors, Y warnings"
  Disabled document: "SKIPPED: validation disabled by document directive"

Batch mode (multiple paths, a glob, --changed, or --json):
  Up to 5 errors: one status line per file with error details, plus the file-count summary
  More than 5 errors: one line per failing file with its error count, the summary, and drill/filter/fix commands; use --verbose for full details
  --json → one complete JSONL object per file: {"path","ok","errors","skipped"?}; no summary line

Examples:
    $ jact validate docs/design.md                   # minimal output (default, single-file, unchanged)
    $ jact validate docs/design.md --verbose         # full report with valid-citation tree
    $ jact validate file.md --format json            # JSON output (single-file, unchanged)
    $ jact validate file.md --lines 100-200
    $ jact validate file.md --fix --scope ./docs
    $ jact validate file.md --fix --dry-run          # preview fixes without writing files
    $ jact validate "concepts/*.md"                  # glob — batch mode, one line per match
    $ jact validate a.md b.md c.md                   # explicit multi-path — batch mode
    $ jact validate --changed                        # all markdown you edited
    $ jact validate "**/*.md" --json                 # JSONL for CI/agents
    $ cat draft.md | jact validate <path> --stdin    # validate unwritten content (single-file only)

With --stdin:
  <path> is NOT read; it is the intended on-disk path, used to resolve scope,
  relative links, and self-anchors. <path> is still REQUIRED (D2). Batch
  selection (multiple paths, glob, --changed, --json) is not supported together
  with --stdin.

Exit Codes:
  0  All validated files passed (or --changed matched nothing)
  1  At least one file failed validation
  2  A glob/path matched nothing and nothing else was selected, or a system error (missing file, git unavailable, conflicting --json/--format json)
`,
	)
	.action(async (paths: string[], options: CliBatchValidateOptions) => {
		if (options.json && options.format === "json") {
			console.error(
				"ERROR: --json and --format json cannot both be set; choose one output format.",
			);
			process.exitCode = 2;
			return;
		}

		if (options.stdin) {
			const isBatchSelection =
				paths.length > 1 ||
				Boolean(options.changed) ||
				Boolean(options.json) ||
				paths.some((p) => isDynamicPattern(p));
			if (paths.length !== 1 || isBatchSelection) {
				console.error(
					"ERROR: --stdin requires exactly one <path> (intended path for scope/links); batch selection (multiple paths, glob, --changed, --json) is not supported with --stdin",
				);
				process.exitCode = 2;
				return;
			}
		}

		const isBatch =
			paths.length > 1 ||
			Boolean(options.changed) ||
			Boolean(options.json) ||
			paths.some((p) => isDynamicPattern(p));

		if (!isBatch) {
			const file = paths[0];
			if (file === undefined) {
				console.error("ERROR: missing required argument 'paths'");
				process.exitCode = 2;
				return;
			}

			const manager = new JactCli();
			let result: string;

			if (options.stdin) {
				const content = await readAllStdin();
				result = await manager.validateContent(content, {
					...options,
					filePath: file,
				});
				console.log(result);
			} else if (options.fix) {
				result = await manager.fix(file, options);
				console.log(result);
			} else {
				result = await manager.validate(file, options);
				console.log(result);
			}

			// Set exit code based on validation result (only for validation, not fix)
			if (!options.fix) {
				if (options.format === "json") {
					const parsed = JSON.parse(result);
					if (parsed.error) {
						process.exit(2); // File not found or other errors
					} else {
						process.exit(parsed.summary?.errors > 0 ? 1 : 0);
					}
				} else {
					if (result.includes("ERROR:")) {
						process.exit(2); // File not found or other errors
					} else {
						// Minimal: "FAILED:" / Verbose: "VALIDATION FAILED"
						process.exit(
							result.includes("FAILED:") || result.includes("VALIDATION FAILED")
								? 1
								: 0,
						);
					}
				}
			}
			return;
		}

		// Batch mode (ADR D1–D6): resolve the file set, run the shared
		// single-input validation workflow sequentially, render, exit per D4/D5.
		try {
			const files = await resolveFileSet(
				{ paths, changed: Boolean(options.changed) },
				process.cwd(),
			);

			const workflow = createValidationWorkflow();
			const validateOne: ValidateOneFn = async (filePath) => {
				const outcome = await workflow.validate(
					{ kind: "file", filePath },
					options,
				);
				if (outcome.kind === "failed") throw new Error(outcome.error);
				if (outcome.kind === "skipped") return { skipped: true };
				return outcome.result;
			};

			const summary = await runBatch(files, validateOne);

			console.log(
				options.json
					? renderJson(summary)
					: renderHuman(summary, options.verbose),
			);
			process.exitCode = summary.failed > 0 ? 1 : 0;
		} catch (error) {
			if (
				error instanceof NoFilesMatchedError ||
				error instanceof NotAGitRepositoryError
			) {
				console.error(`ERROR: ${error.message}`);
				process.exitCode = 2;
				return;
			}
			const message = error instanceof Error ? error.message : String(error);
			console.error(`ERROR: ${message}`);
			process.exitCode = 2;
		}
	});

// Shared option descriptions — kept in one place so wording stays consistent across subcommands
const SCOPE_OPTION_DESCRIPTION =
	"Folder to search for filename matches. Defaults to nearest ancestor of cwd containing .git or package.json; falls back to target file's ancestors. Required only when neither cwd nor target reveal a project root.";
const VERBOSE_OPTION_DESCRIPTION =
	"Include outgoingLinksReport + stats in output";

program
	.command("rename")
	.description(
		"Preview (default) or apply (--fix) a Markdown file rename or move and update incoming and outgoing links in scope",
	)
	.argument("<source-file>", "path to the Markdown file to rename or move")
	.argument(
		"<destination>",
		"new .md path or existing directory; a bare filename renames in place",
	)
	.option("--scope <folder>", SCOPE_OPTION_DESCRIPTION)
	.option(
		"--fix",
		"apply the rename and link updates; without this flag, only preview",
		false,
	)
	.option("--json", "emit machine-readable JSON", false)
	.option(
		"--allow-gitignore",
		"include files excluded by .gitignore (default ignore patterns still apply)",
		false,
	)
	.addHelpText(
		"after",
		`
Examples:
    $ jact rename docs/old-name.md new-name.md --scope .
    $ jact rename docs/old-name.md archive/renamed.md --scope . --fix
    $ jact rename docs/old-name.md archive/ --scope . --json

Safety:
  Preview is the default. --fix creates backups, verifies inputs did not change,
  moves the file, updates incoming and moved-file outgoing links, then verifies every relationship.

Exit Codes:
  0  Preview or rename completed successfully
  1  Invalid request or unsafe rename plan; no files changed
  2  File-system, parse, commit, or rollback failure
`,
	)
	.action(
		async (
			sourceFile: string,
			destination: string,
			options: CliRenameOptions,
		) => {
			const manager = new JactCli();
			try {
				const result = await manager.rename(sourceFile, destination, options);
				if (options.json) {
					console.log(JSON.stringify(result, null, 2));
					return;
				}

				const lines = [
					result.applied ? "Rename applied." : "Rename preview.",
					`Source: ${result.source}`,
					`Destination: ${result.destination}`,
					`Updated links: ${result.links} in ${result.files.length} file${result.files.length === 1 ? "" : "s"}`,
				];
				for (const file of result.files) {
					lines.push(`  ${file.links}  ${file.path}`);
				}
				if (result.applied) {
					lines.push(`Backups: ${result.backups.length}`);
					for (const backup of result.backups) lines.push(`  ${backup}`);
				} else {
					lines.push("No files written. Re-run with --fix to apply this plan.");
				}
				console.log(lines.join("\n"));
			} catch (error) {
				console.error(
					"ERROR:",
					error instanceof Error ? error.message : String(error),
				);
				process.exitCode = error instanceof RenameValidationError ? 1 : 2;
			}
		},
	);

program
	.command("outline")
	.description("Display a compact text tree of parsed Markdown headings")
	.argument("<file>", "path to markdown file to outline")
	.addArgument(
		new Argument("[level]", "document-wide heading ceiling")
			.choices(["H1", "H2", "H3", "H4", "H5", "H6"])
			.default("H2"),
	)
	.addOption(
		new Option(
			"--exact-heading-level <level>",
			"show only headings at one level",
		).choices(["H1", "H2", "H3", "H4", "H5", "H6"]),
	)
	.option(
		"-n, --line-number",
		"prefix headings with one-based source line numbers",
		false,
	)
	.option(
		"--expand <headings>",
		"fully expand comma-separated heading branches",
	)
	.option(
		"--within <parent>",
		"limit the outline and heading resolution to one parent branch",
	)
	.option(
		"--cache-reset",
		"show next-step reminders again for the active session and target",
		false,
	)
	.option("--scope <folder>", SCOPE_OPTION_DESCRIPTION)
	.addHelpText(
		"after",
		`
Default: H2 shows H1 through H2 across the document. Expanded branches show all descendants.
--exact-heading-level selects only that level; positional H-level remains an inclusive ceiling.

Examples:
    $ jact outline docs/guide.md
    $ jact outline docs/guide.md H1
    $ jact outline docs/guide.md --exact-heading-level H3 --line-number
    $ jact outline docs/guide.md H3 --expand "Install,Troubleshooting"
    $ jact outline handbook.md H2 --expand "Install" --within "Guide"
    $ jact outline docs/guide.md --cache-reset

Exit Codes:
  0  Outline rendered successfully, including a valid file with no headings
  1  Heading selector is missing, ambiguous, or unsupported
  2  File lookup, scope, permission, or parse error
`,
	)
	.action(
		async (
			file: string,
			level: string,
			options: {
				expand?: string;
				within?: string;
				exactHeadingLevel?: string;
				lineNumber?: boolean;
				cacheReset?: boolean;
				scope?: string;
			},
		) => {
			const manager = new JactCli();
			const { exactHeadingLevel, ...outlineOptions } = options;
			try {
				const result = await manager.outline(
					file,
					Number.parseInt(level.slice(1), 10),
					{
						...outlineOptions,
						...(exactHeadingLevel !== undefined && {
							exactHeadingLevel: Number.parseInt(
								exactHeadingLevel.slice(1),
								10,
							),
						}),
						...(process.env["JACT_SESSION_ID"] !== undefined
							? { sessionId: process.env["JACT_SESSION_ID"] }
							: process.env["CLAUDE_SESSION_ID"] !== undefined
								? { sessionId: process.env["CLAUDE_SESSION_ID"] }
								: {}),
					},
				);
				if (result.success) console.log(result.output);
				else console.error(result.output);
				process.exitCode = result.success ? 0 : 1;
			} catch (error) {
				const e = error as Error & { suggestion?: string };
				console.error("ERROR:", e.message);
				if (e.suggestion) console.error("Suggestion:", e.suggestion);
				process.exitCode = 2;
			}
		},
	);

program
	.command("ast")
	.description("Display markdown AST and citation metadata for debugging")
	.argument("<file>", "path to markdown file to analyze")
	.option("--scope <folder>", SCOPE_OPTION_DESCRIPTION)
	.addHelpText(
		"after",
		`
Examples:
    $ jact ast docs/design.md
    $ jact ast file.md | jq '.links'
    $ jact ast file.md | jq '.anchors | length'
    $ jact ast plan.md                        # smart default scope (cwd-git/pkg)
    $ jact ast plan.md --scope ./other-repo   # explicit override

Output includes:
  - ast: Markdown AST (mdast) from the micromark parser
  - links: Detected citation links with anchor metadata
  - headings: Parsed heading structure
  - anchors: Available anchor points (headers and blocks)
`,
	)
	.action(async (file: string, options: { scope?: string }) => {
		const manager = new JactCli();
		try {
			const ast = await manager.getAst(file, options);
			console.log(JSON.stringify(ast, null, 2));
		} catch (error) {
			const e = error as Error & { suggestion?: string };
			console.error("ERROR:", e.message);
			if (e.suggestion) {
				console.error("Suggestion:", e.suggestion);
			}
			process.exitCode = 2;
		}
	});

// Pattern: Extract command with links subcommand
const extractCmd = program
	.command("extract")
	.description("Extract content from citations");

extractCmd
	.command("links <source-file>")
	.description(
		"Extract content from all links in source document with validation and deduplication",
	)
	.option("--scope <folder>", SCOPE_OPTION_DESCRIPTION)
	.option("--format <type>", "Output format (reserved for future)", "json")
	.option(
		"--full-files",
		"Enable full-file link extraction (default: sections only)",
	)
	.option(
		"--session <id>",
		"Session ID for cache deduplication (skips extraction on cache hit)",
	)
	.option("-v, --verbose", VERBOSE_OPTION_DESCRIPTION, false)
	.addHelpText(
		"after",
		`
Examples:
    $ jact extract links docs/design.md
    $ jact extract links docs/design.md --full-files
    $ jact extract links docs/design.md --scope ./docs
    $ jact extract links docs/design.md --session abc123
    $ jact extract links file.md | jq '.stats.compressionRatio'

Exit Codes:
  0  At least one link extracted successfully (or cache hit with --session)
  1  No eligible links or all extractions failed
  2  System error (file not found, permission denied)
`,
	)
	.action(async (sourceFile: string, options: CliExtractOptions) => {
		// Session cache short-circuits extraction at the CLI boundary
		if (options.session) {
			if (checkExtractCache(options.session, sourceFile, CACHE_DIR)) {
				process.exitCode = 0;
				return;
			}
		}

		// Pattern: Delegate to JactCli orchestrator
		const manager = new JactCli();

		try {
			await manager.extractLinks(sourceFile, options);

			// Write cache only after successful extraction
			if (options.session && process.exitCode !== 1) {
				writeExtractCache(options.session, sourceFile, CACHE_DIR);
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error("ERROR:", errorMessage);
			process.exitCode = 2;
		}
	});

const LINKED_CONTENT_OPTION = "--extract-linked-content [depth]";

/** Commander parser for the optional `--extract-linked-content` depth. */
function parseLinkedContentDepth(value: string): number {
	const depth = Number(value);
	if (!Number.isInteger(depth) || depth < 1) {
		throw new InvalidArgumentError("depth must be a whole number of 1 or more.");
	}
	return depth;
}

/** Print next-step hints after output; JSON keeps stdout parseable by using stderr. */
function writeNextStepHints(hints: readonly string[], format: string): void {
	if (hints.length === 0) return;
	if (format === "json") console.error(hints.join("\n"));
	else process.stdout.write(`\n\n${hints.join("\n")}\n`);
}

/** Fits a default Claude Code Bash result (30,000 characters inline). */
const DEFAULT_MAX_CHARS = 28_000;

/** Commander parser for `--max-chars`. */
function parseMaxChars(value: string): number {
	const maxChars = Number(value);
	if (!Number.isInteger(maxChars) || maxChars < 1) {
		throw new InvalidArgumentError("must be a whole number of 1 or more.");
	}
	return maxChars;
}

const MAX_CHARS_OPTION = "--max-chars <n>";
const MAX_CHARS_DESCRIPTION = `with --extract-linked-content: above this size, print a content map instead of the content (default: ${DEFAULT_MAX_CHARS})`;

/**
 * Print extraction output, failures, then hints. Linked markdown output above
 * `--max-chars` becomes a content map so agents load only the blocks they need.
 * JSON keeps stdout parseable: failures and hints go to stderr.
 */
function writeExtractOutput(
	result: HeaderExtractionResult,
	output: string,
	options: CliExtractOptions,
	hints: readonly string[],
	failures: readonly string[] = [],
): void {
	const format = options.format ?? "markdown";
	const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
	const failureLines = failures.map((failure) => `- ${failure}`).join("\n");
	const writeFailures = () => {
		if (failures.length === 0) return;
		if (format === "json") console.error(`Failures:\n${failureLines}`);
		else process.stdout.write(`\n\n## Failures\n\n${failureLines}`);
	};
	if (
		format === "markdown" &&
		options.extractLinkedContent !== undefined &&
		output.length > maxChars
	) {
		process.stdout.write(formatContentMap(result, output.length, maxChars));
		writeFailures();
		writeNextStepHints(
			[
				`To Print Everything Anyway: rerun with \`--max-chars ${output.length}\``,
				...hints,
			],
			format,
		);
		return;
	}
	if (format === "markdown" && !options.verbose) process.stdout.write(output);
	else console.log(output);
	writeFailures();
	writeNextStepHints(hints, format);
}

extractCmd
	.command("header")
	.description("Extract specific header section content from a target file")
	.argument("<target-file>", "Markdown file to extract from")
	.argument("<header-name>", "Exact header text to extract")
	.option("--scope <folder>", SCOPE_OPTION_DESCRIPTION)
	.option(
		"--within <parent>",
		"limit heading resolution to descendants of one unique parent",
	)
	.option(
		LINKED_CONTENT_OPTION,
		"also extract linked sections and files to depth (default: 1), plus scoped backlinks",
		parseLinkedContentDepth,
	)
	.option(MAX_CHARS_OPTION, MAX_CHARS_DESCRIPTION, parseMaxChars)
	.option("-v, --verbose", VERBOSE_OPTION_DESCRIPTION, false)
	.addOption(
		new Option("--format <type>", "Output format")
			.choices(["markdown", "json"])
			.default("markdown"),
	)
	.addHelpText(
		"after",
		`
Examples:
    $ jact extract header plan.md "Task 1: Implementation"
    $ jact extract header docs/guide.md "Overview" --scope ./docs
    $ jact extract header handbook.md "Install" --within "Guide"
    $ jact extract header file.md "Design" --format json | jq '.extractedContentBlocks'
    $ jact extract header plan.md "Overview" --extract-linked-content --scope ./docs
    $ jact extract header plan.md "Overview" --extract-linked-content 3
    $ jact extract header plan.md "Overview" --extract-linked-content --max-chars 100000

Exit Codes:
  0  Header extracted successfully; all linked content resolved
  1  Header failed to resolve, or some linked content failed to resolve
  2  System error (file not found, permission denied, incomplete scope scan)
`,
	)
	.action(
		async (
			targetFile: string,
			headerName: string,
			options: CliExtractOptions,
		) => {
			// Integration: Create JactCli instance
			const manager = new JactCli();
			// Commander stores `true` when the optional depth is omitted.
			const rawDepth: unknown = options.extractLinkedContent;
			if (rawDepth === true) options.extractLinkedContent = 1;

			try {
				// Pattern: Delegate to JactCli orchestration method
				const result = await manager.extractHeader(
					targetFile,
					headerName,
					options,
				);

				if (result) {
					const format = options.format ?? "markdown";
					const output = formatExtractResult(
						result,
						format,
						options.verbose ? "verbose" : "minimal",
						{ lineNumbers: true },
					);
					const linked = "mode" in result && result.mode === "linked-context";
					writeExtractOutput(
						result,
						output,
						options,
						linked
							? linkedContentHints(
									["header", targetFile, headerName],
									result.depth,
									result.unfollowedDeeperFiles,
								)
							: [],
					);
					process.exitCode = linked && !result.complete ? 1 : 0;
				}
				// Note: Error exit codes set by extractHeader() method
			} catch (error) {
				// Decision: Unexpected errors use exit code 2
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				console.error("ERROR:", errorMessage);
				process.exitCode = 2;
			}
		},
	);

extractCmd
	.command("file")
	.description("Extract entire markdown file content")
	.argument("<target-file>", "Markdown file to extract")
	.option("--scope <folder>", SCOPE_OPTION_DESCRIPTION)
	.option(
		LINKED_CONTENT_OPTION,
		"also extract linked content, following linked files to depth (default: 1)",
		parseLinkedContentDepth,
	)
	.option(MAX_CHARS_OPTION, MAX_CHARS_DESCRIPTION, parseMaxChars)
	.option("-v, --verbose", VERBOSE_OPTION_DESCRIPTION, false)
	.addOption(
		new Option("--format <type>", "Output format")
			.choices(["markdown", "json"])
			.default("markdown"),
	)
	.addHelpText(
		"after",
		`
Examples:
    $ jact extract file docs/architecture.md
    $ jact extract file architecture.md --scope ./docs
    $ jact extract file file.md --format json | jq '.extractedContentBlocks'
    $ jact extract file file.md --format json --verbose | jq '.stats'
    $ jact extract file plan.md --extract-linked-content
    $ jact extract file plan.md --extract-linked-content 2
    $ jact extract file plan.md --extract-linked-content --max-chars 100000

Exit Codes:
  0  File extracted successfully
  1  File not found or validation failed
  2  System error (permission denied, parse error)
`,
	)
	.action(async (targetFile: string, options: CliExtractOptions) => {
		// Integration: Create JactCli instance
		const manager = new JactCli();
		// Commander stores `true` when the optional depth is omitted.
		const rawDepth: unknown = options.extractLinkedContent;
		if (rawDepth === true) options.extractLinkedContent = 1;

		try {
			// Pattern: Delegate to JactCli orchestration method
			const outcome = await manager.extractFile(targetFile, options);

			if (outcome) {
				const format = options.format ?? "markdown";
				const output = formatExtractResult(
					outcome.result,
					format,
					options.verbose ? "verbose" : "minimal",
					{
						lineNumbers: true,
						sourceLabels: options.extractLinkedContent !== undefined,
					},
				);
				writeExtractOutput(
					outcome.result,
					output,
					options,
					outcome.nextStepHints,
					outcome.failures,
				);
				process.exitCode = outcome.failures.length > 0 ? 1 : 0;
			}
			// Note: Error exit codes set by extractFile() method
		} catch (error) {
			// Decision: Unexpected errors use exit code 2
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error("ERROR:", errorMessage);
			process.exitCode = 2;
		}
	});

// Run CLI unconditionally — this file IS the CLI entry point.
program.parse();
