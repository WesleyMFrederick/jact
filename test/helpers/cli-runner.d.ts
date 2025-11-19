/**
 * CLI execution options
 */
export interface CLIOptions {
	cwd?: string;
	captureStderr?: boolean;
	encoding?: string;
	[key: string]: unknown;
}

/**
 * Execute CLI command with proper cleanup to prevent worker process accumulation.
 *
 * Uses shell redirection to temporary file to bypass Node.js 64KB stdio pipe buffer
 * limit. Direct stdio piping truncates output at ~65KB due to internal buffering,
 * which causes JSON parse errors for story files with 100+ citations (producing
 * 100KB+ JSON output). This approach captures full output regardless of size.
 *
 * @param command - Command to execute (e.g., "node script.js arg1 arg2")
 * @param options - spawn options
 * @returns Command output (stdout)
 * @throws Error with stdout and stderr properties when command fails
 */
export function runCLI(command: string, options?: CLIOptions): string;
