import { spawnSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Execute CLI command with proper cleanup to prevent worker process accumulation.
 *
 * Uses shell redirection to temporary file to bypass Node.js 64KB stdio pipe buffer
 * limit. Direct stdio piping truncates output at ~65KB due to internal buffering,
 * which causes JSON parse errors for story files with 100+ citations (producing
 * 100KB+ JSON output). This approach captures full output regardless of size.
 *
 * @param {string} command - Command to execute (e.g., "node script.js arg1 arg2")
 * @param {object} options - spawn options
 * @param {boolean} options.captureStderr - If false, only capture stdout (for JSON output); if true, merge stderr into stdout (default: true)
 * @returns {string} Command output (stdout)
 * @throws {Error} Error with stdout and stderr properties when command fails
 */
export function runCLI(command, options = {}) {
	// Create temporary file for output capture
	const tempFile = join(
		tmpdir(),
		`cli-output-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`,
	);

	const { captureStderr = true, ...spawnOptions } = options;

	const defaultOptions = {
		encoding: "utf8",
		...spawnOptions,
	};

	try {
		// Execute command with shell redirection to avoid stdio buffering limits
		// For JSON output, only capture stdout to avoid mixing warnings/errors
		const redirectCmd = captureStderr
			? `${command} > "${tempFile}" 2>&1`
			: `${command} > "${tempFile}"`;
		const result = spawnSync("sh", ["-c", redirectCmd], defaultOptions);

		// Read output from temporary file
		const output = readFileSync(tempFile, "utf8");

		// Clean up temp file
		unlinkSync(tempFile);

		// Check if spawn failed (null status means spawn itself failed)
		if (result.status === null) {
			const error = new Error(
				`Failed to spawn command: ${result.error?.message || "Unknown error"}`,
			);
			error.stderr = output;
			throw error;
		}

		// If command exited with non-zero status, throw error with output
		if (result.status !== 0) {
			const error = new Error(`Command failed with exit code ${result.status}`);
			error.stdout = output;
			error.stderr = "";
			error.status = result.status;
			throw error;
		}

		return output;
	} catch (error) {
		// Clean up temp file on error
		try {
			unlinkSync(tempFile);
		} catch {
			// Ignore cleanup errors
		}
		throw error;
	} finally {
		// Hint garbage collector (helps but doesn't force)
		if (global.gc) global.gc();
	}
}
