import { execSync } from "node:child_process";

/**
 * Execute CLI command with proper cleanup to prevent worker process accumulation.
 *
 * @param {string} command - Command to execute
 * @param {object} options - execSync options
 * @returns {string} Command output
 */
export function runCLI(command, options = {}) {
	const defaultOptions = {
		encoding: "utf8",
		stdio: ["pipe", "pipe", "pipe"],
		...options,
	};

	try {
		const result = execSync(command, defaultOptions);
		return result;
	} catch (error) {
		// Re-throw with output attached for test assertions
		throw error;
	} finally {
		// Hint garbage collector (helps but doesn't force)
		if (global.gc) global.gc();
	}
}
2