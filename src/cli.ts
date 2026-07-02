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

import { Command, Option } from "commander";
import { isDynamicPattern } from "tinyglobby";
import {
	checkExtractCache,
	writeExtractCache,
} from "./cache/checkExtractCache.js";
import {
	createCitationValidator,
	createFileCache,
	createParsedFileCache,
} from "./factories/componentFactory.js";
import { formatExtractResult } from "./formatExtractResult.js";
import { JactCli } from "./jact-cli.js";
import type {
	CliExtractOptions,
	CliValidateOptions,
} from "./types/contentExtractorTypes.js";
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
	tree: ["ast"],
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
	.version("1.0.0");

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
		"show full validation report: all valid citations, duplicate-filename warnings, summary block (default: minimal output with only errors/warnings)",
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

Batch mode (multiple paths, a glob, --changed, or --json):
  ✅/❌ one line per file, plus a "<N> files · <P> passed · <F> failed" summary
  --json → one JSONL object per file: {"path","ok","errors"}; no summary line

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

		// Batch mode (ADR D1–D6): resolve file set, run sequentially over a
		// fresh CitationValidator, render, exit per D4/D5.
		try {
			const files = await resolveFileSet(
				{ paths, changed: Boolean(options.changed) },
				process.cwd(),
			);

			const parsedFileCache = createParsedFileCache();
			const fileCache = createFileCache();
			const validator = createCitationValidator(parsedFileCache, fileCache);
			const validateOne: ValidateOneFn = (f) => validator.validateFile(f);

			const summary = await runBatch(files, validateOne);

			console.log(options.json ? renderJson(summary) : renderHuman(summary));
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

extractCmd
	.command("header")
	.description("Extract specific header section content from a target file")
	.argument("<target-file>", "Markdown file to extract from")
	.argument("<header-name>", "Exact header text to extract")
	.option("--scope <folder>", SCOPE_OPTION_DESCRIPTION)
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
    $ jact extract header file.md "Design" | jq '.extractedContentBlocks'

Exit Codes:
  0  Header extracted successfully
  1  Header not found or validation failed
  2  System error (file not found, permission denied)
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

			try {
				// Pattern: Delegate to JactCli orchestration method
				const result = await manager.extractHeader(
					targetFile,
					headerName,
					options,
				);

				// Format output based on --format flag (default: markdown); minimal payload by default
				if (result) {
					console.log(
						formatExtractResult(
							result,
							options.format ?? "markdown",
							options.verbose ? "verbose" : "minimal",
						),
					);
					process.exitCode = 0;
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
	.option("-v, --verbose", VERBOSE_OPTION_DESCRIPTION, false)
	.option("--format <type>", "Output format (json)", "json")
	.addHelpText(
		"after",
		`
Examples:
    $ jact extract file docs/architecture.md
    $ jact extract file architecture.md --scope ./docs
    $ jact extract file file.md | jq '.extractedContentBlocks'
    $ jact extract file file.md | jq '.stats'

Exit Codes:
  0  File extracted successfully
  1  File not found or validation failed
  2  System error (permission denied, parse error)
`,
	)
	.action(async (targetFile: string, options: CliExtractOptions) => {
		// Integration: Create JactCli instance
		const manager = new JactCli();

		try {
			// Pattern: Delegate to JactCli orchestration method
			const result = await manager.extractFile(targetFile, options);

			// Output JSON to stdout if extraction succeeded — minimal by default, --verbose adds report + stats
			if (result) {
				console.log(
					formatExtractResult(
						result,
						"json",
						options.verbose ? "verbose" : "minimal",
					),
				);
				process.exitCode = 0;
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
