import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runCLI } from "../test/helpers/cli-runner.js";

/**
 * Helper: Detect if running in Vitest test context
 * Pattern: Environment Detection (Workspace Architecture)
 * Reference: ARCHITECTURE.md#Process Cleanup and Nested Test Execution
 * Reference: US1.4a cli-runner.js for safe CLI execution in tests
 */
function isInTestContext(): boolean {
	// biome-ignore lint/complexity/useLiteralKeys: environment variable names must use bracket notation
	return !!(process.env["VITEST_POOL_ID"] || process.env["VITEST_WORKER_ID"]);
}

/**
 * Validation checkpoint result for a single check
 */
export interface ValidationResult {
	checkpoint: string;
	passed: boolean;
	message: string;
}

/**
 * Complete conversion validation result
 */
export interface ConversionValidation {
	file: string;
	results: ValidationResult[];
	allPassed: boolean;
}

/**
 * Validate TypeScript conversion quality for a file.
 * Integration: Spawns tsc, grep, npm test as child processes.
 *
 * @param filePath - Absolute path to TypeScript file to validate
 * @returns Validation result with 7 checkpoint outcomes
 */
export function validateConversion(filePath: string): ConversionValidation {
	// --- Checkpoint Execution ---
	const results: ValidationResult[] = [];

	// Checkpoint 1: TypeScript compilation
	results.push(validateCompilation(filePath));

	// Checkpoint 2: No `any` escapes
	results.push(validateNoAnyEscapes(filePath));

	// Checkpoint 3: Explicit return types
	results.push(validateExplicitReturnTypes(filePath));

	// Checkpoint 4: Strict null checking
	results.push(validateStrictNullChecks(filePath));

	// Checkpoint 5: All tests pass
	results.push(validateTestsPassing(filePath));

	// Checkpoint 6: JavaScript consumers work
	results.push(validateConsumerCompatibility(filePath));

	// Checkpoint 7: Compiled output generated
	results.push(validateCompiledOutput(filePath));

	// --- Result Aggregation ---
	const allPassed = results.every((r) => r.passed);

	return { file: filePath, results, allPassed };
}

function validateCompilation(_filePath: string): ValidationResult {
	// Boundary: Execute tsc compiler as child process
	try {
		// Integration: npx tsc --noEmit spawns TypeScript compiler
		execSync("npx tsc --noEmit", {
			cwd: getProjectRoot(),
			stdio: "pipe",
			encoding: "utf8",
		});

		return {
			checkpoint: "TypeScript Compilation",
			passed: true,
			message: "Zero compiler errors",
		};
	} catch (error) {
		// Decision: Catch exec errors, extract stderr for diagnostics
		const message = error instanceof Error ? error.message : String(error);
		return {
			checkpoint: "TypeScript Compilation",
			passed: false,
			message: message.substring(0, 200), // Limit message length
		};
	}
}

function validateNoAnyEscapes(filePath: string): ValidationResult {
	// Boundary: Read file content from disk
	try {
		if (!existsSync(filePath)) {
			return {
				checkpoint: "No `any` Escapes",
				passed: false,
				message: `File not found: ${filePath}`,
			};
		}

		const content = readFileSync(filePath, "utf8");

		// Pattern: Regex search for `: any` or `as any` patterns
		// Decision: Exclude comments from search
		const anyRegex = /:\s*any\b|as\s+any\b/g;
		const commentRegex = /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm;

		// Remove comments before checking
		const contentWithoutComments = content.replace(commentRegex, "");
		const anyMatches = contentWithoutComments.match(anyRegex) || [];

		return {
			checkpoint: "No `any` Escapes",
			passed: anyMatches.length === 0,
			message:
				anyMatches.length === 0
					? "No any escapes found"
					: `Found ${anyMatches.length} any escapes`,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			checkpoint: "No `any` Escapes",
			passed: false,
			message: message.substring(0, 200),
		};
	}
}

function validateExplicitReturnTypes(filePath: string): ValidationResult {
	// Boundary: Read file content
	try {
		if (!existsSync(filePath)) {
			return {
				checkpoint: "Explicit Return Types",
				passed: false,
				message: `File not found: ${filePath}`,
			};
		}

		const content = readFileSync(filePath, "utf8");

		// Pattern: Find exported functions and check for return type annotations
		// Decision: Use regex to find export function patterns
		const exportFunctionRegex =
			/export\s+((?:async\s+)?function|const\s+\w+\s*=\s*(?:async\s*)?\()/g;

		// Find all export statements and check if they have return types
		const functionsWithoutReturnTypes: string[] = [];

		let match: RegExpExecArray | null = exportFunctionRegex.exec(content);
		while (match !== null) {
			const startPos = match.index + match[0].length;
			// Look ahead for return type annotation pattern `: Type` before `{`
			const nextPart = content.substring(startPos, startPos + 100);
			const hasReturnType = /^[^{]*:\s*[\w<>[\]|&\s]+\s*[={]/.test(nextPart);

			if (!hasReturnType && !nextPart.includes("=>")) {
				// For arrow functions, check for => Type pattern
				const arrowTypeMatch = /=>\s*[\w<>[\]|&\s]+\s*[={]/.test(nextPart);
				if (!arrowTypeMatch) {
					functionsWithoutReturnTypes.push(match[0].trim());
				}
			}
			match = exportFunctionRegex.exec(content);
		}

		return {
			checkpoint: "Explicit Return Types",
			passed: functionsWithoutReturnTypes.length === 0,
			message:
				functionsWithoutReturnTypes.length === 0
					? "All exports have explicit types"
					: `Found ${functionsWithoutReturnTypes.length} exports without return types`,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			checkpoint: "Explicit Return Types",
			passed: false,
			message: message.substring(0, 200),
		};
	}
}

function validateStrictNullChecks(filePath: string): ValidationResult {
	// Integration: Run tsc with --strictNullChecks flag
	try {
		execSync("npx tsc --noEmit --strictNullChecks", {
			cwd: getProjectRoot(),
			stdio: "pipe",
		});

		return {
			checkpoint: "Strict Null Checking",
			passed: true,
			message: "Zero strict null errors",
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			checkpoint: "Strict Null Checking",
			passed: false,
			message: message.substring(0, 200),
		};
	}
}

function validateTestsPassing(filePath: string): ValidationResult {
	// CRITICAL: Prevent nested Vitest process explosion
	// Reference: ARCHITECTURE.md#Process Cleanup and Nested Test Execution
	if (isInTestContext()) {
		return {
			checkpoint: "All Tests Pass",
			passed: true,
			message: "SKIPPED in test context (prevents nested process explosion)",
		};
	}

	// Decision: Find corresponding test file
	const testFilePath = convertPathToTestFile(filePath);

	if (!existsSync(testFilePath)) {
		return {
			checkpoint: "All Tests Pass",
			passed: false,
			message: `Test file not found: ${testFilePath}`,
		};
	}

	// Integration: Use cli-runner helper (US1.4a) for safe CLI execution
	// NEVER use execSync directly - always use runCLI() helper
	try {
		runCLI(`npm test -- ${testFilePath}`, {
			cwd: getProjectRoot(),
		});

		return {
			checkpoint: "All Tests Pass",
			passed: true,
			message: "All tests passed for converted file",
		};
	} catch (error) {
		// Research: Catch test failures
		const message = error instanceof Error ? error.message : String(error);
		return {
			checkpoint: "All Tests Pass",
			passed: false,
			message: message.substring(0, 200),
		};
	}
}

function validateConsumerCompatibility(filePath: string): ValidationResult {
	// CRITICAL: Prevent nested Vitest process explosion
	// Reference: ARCHITECTURE.md#Process Cleanup and Nested Test Execution
	if (isInTestContext()) {
		return {
			checkpoint: "JavaScript Consumers Work",
			passed: true,
			message: "SKIPPED in test context (prevents nested process explosion)",
		};
	}

	// Integration: Use cli-runner helper (US1.4a) for safe CLI execution
	// NEVER use execSync directly - always use runCLI() helper
	try {
		// Pattern: Execute the full test suite to validate all consumers work
		// Decision: Full suite ensures JavaScript consumers can use the converted exports
		runCLI("npm test", {
			cwd: getProjectRoot(),
		});

		return {
			checkpoint: "JavaScript Consumers Work",
			passed: true,
			message: "Full test suite passed - JavaScript consumers work",
		};
	} catch (error) {
		// Research: Catch test failures indicating consumer incompatibility
		const message = error instanceof Error ? error.message : String(error);
		return {
			checkpoint: "JavaScript Consumers Work",
			passed: false,
			message: message.substring(0, 200),
		};
	}
}

function validateCompiledOutput(filePath: string): ValidationResult {
	// Integration: Run tsc --build to generate output
	try {
		execSync("npx tsc --build", {
			cwd: getProjectRoot(),
			stdio: "pipe",
		});

		// Boundary: Check dist/ files exist
		const distPath = convertPathToDistFile(filePath, ".js");
		const dtsPath = convertPathToDistFile(filePath, ".d.ts");

		const jsExists = existsSync(distPath);
		const dtsExists = existsSync(dtsPath);

		// Decision: Both .js and .d.ts must exist
		if (jsExists && dtsExists) {
			return {
				checkpoint: "Compiled Output Generated",
				passed: true,
				message: "Both .js and .d.ts generated",
			};
		}
		const missing = [];
		if (!jsExists) missing.push(".js");
		if (!dtsExists) missing.push(".d.ts");

		return {
			checkpoint: "Compiled Output Generated",
			passed: false,
			message: `Missing compiled files: ${missing.join(", ")}`,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			checkpoint: "Compiled Output Generated",
			passed: false,
			message: message.substring(0, 200),
		};
	}
}

/**
 * Convert src file path to test file path
 * e.g., src/core/file.ts -> test/core/file.test.ts
 */
function convertPathToTestFile(filePath: string): string {
	const relativePath = filePath.replace(/.*\/tools\/citation-manager\//, "");
	const withoutExt = relativePath.replace(/\.(ts|js)$/, "");
	const testPath = withoutExt.replace(/^src\//, "test/");
	return resolve(getProjectRoot(), `${testPath}.test.ts`);
}

/**
 * Convert src file path to dist file path
 * e.g., src/core/file.ts -> dist/core/file.js or .d.ts
 */
function convertPathToDistFile(filePath: string, ext: ".js" | ".d.ts"): string {
	const relativePath = filePath.replace(/.*\/tools\/citation-manager\//, "");
	const withoutExt = relativePath.replace(/\.(ts|js)$/, "");
	const distPath = withoutExt.replace(/^src\//, "dist/");
	return resolve(getProjectRoot(), `${distPath}${ext}`);
}

/**
 * Get the project root directory (citation-manager)
 */
function getProjectRoot(): string {
	// Get the directory containing this script
	const scriptDir = dirname(resolve(import.meta.url.replace(/^file:\/\//, "")));
	// Go up to the citation-manager root
	return dirname(scriptDir);
}

/**
 * Format validation results with color coding
 */
function formatResults(validation: ConversionValidation): string {
	const lines: string[] = [];
	const resetColor = "\x1b[0m";

	lines.push(`\nValidation Results for: ${validation.file}`);
	lines.push("=".repeat(60));

	for (const result of validation.results) {
		const status = result.passed ? "✓ PASS" : "✗ FAIL";
		const statusColor = result.passed ? "\x1b[32m" : "\x1b[31m"; // green or red

		lines.push(`${statusColor}${status}${resetColor} - ${result.checkpoint}`);
		lines.push(`       ${result.message}`);
	}

	lines.push("=".repeat(60));
	const allPassedColor = validation.allPassed ? "\x1b[32m" : "\x1b[31m";
	lines.push(
		`${allPassedColor}${validation.allPassed ? "✓ ALL CHECKPOINTS PASSED" : "✗ SOME CHECKPOINTS FAILED"}${resetColor}`,
	);
	lines.push("");

	return lines.join("\n");
}

/**
 * Main CLI entry point
 */
function main(): void {
	const args = process.argv.slice(2);

	if (args.length === 0) {
		console.error("Usage: validate-typescript-conversion.ts <file-path>");
		console.error(
			"Example: validate-typescript-conversion.ts src/core/ContentExtractor/normalizeAnchor.ts",
		);
		process.exit(1);
	}

	const fileArg = args[0];
	if (!fileArg) {
		console.error("Error: file path argument is required");
		process.exit(1);
	}

	const filePath = resolve(fileArg);
	console.log(`\nValidating: ${filePath}`);

	try {
		const validation = validateConversion(filePath);
		console.log(formatResults(validation));

		process.exit(validation.allPassed ? 0 : 1);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`\nValidation error: ${message}`);
		process.exit(1);
	}
}

// Only run main if this is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
