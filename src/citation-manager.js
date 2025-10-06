#!/usr/bin/env node

import { Command } from "commander";
import {
	createCitationValidator,
	createFileCache,
	createMarkdownParser,
} from "./factories/componentFactory.js";

class CitationManager {
	constructor() {
		this.parser = createMarkdownParser();
		this.validator = createCitationValidator();
		this.fileCache = createFileCache();
	}

	async validate(filePath, options = {}) {
		try {
			const startTime = Date.now();

			// Build file cache if scope is provided
			if (options.scope) {
				const cacheStats = this.fileCache.buildCache(options.scope);
				// Only show cache messages in non-JSON mode
				if (options.format !== "json") {
					console.log(
						`📁 Scanned ${cacheStats.totalFiles} files in ${cacheStats.scopeFolder}`,
					);
					if (cacheStats.duplicates > 0) {
						console.log(
							`⚠️  Found ${cacheStats.duplicates} duplicate filenames`,
						);
					}
				}
				this.validator.setFileCache(this.fileCache);
			}

			const result = await this.validator.validateFile(filePath);
			const endTime = Date.now();

			result.validationTime = `${((endTime - startTime) / 1000).toFixed(1)}s`;

			// Apply line range filtering if specified
			if (options.lines) {
				const filteredResult = this.filterResultsByLineRange(
					result,
					options.lines,
				);
				if (options.format === "json") {
					return this.formatAsJSON(filteredResult);
				} else {
					return this.formatForCLI(filteredResult);
				}
			}

			if (options.format === "json") {
				return this.formatAsJSON(result);
			} else {
				return this.formatForCLI(result);
			}
		} catch (error) {
			if (options.format === "json") {
				return JSON.stringify(
					{
						error: error.message,
						file: filePath,
						success: false,
					},
					null,
					2,
				);
			} else {
				return `❌ ERROR: ${error.message}`;
			}
		}
	}

	filterResultsByLineRange(result, lineRange) {
		const { startLine, endLine } = this.parseLineRange(lineRange);

		const filteredResults = result.results.filter((citation) => {
			return citation.line >= startLine && citation.line <= endLine;
		});

		const filteredSummary = {
			total: filteredResults.length,
			valid: filteredResults.filter((r) => r.status === "valid").length,
			errors: filteredResults.filter((r) => r.status === "error").length,
			warnings: filteredResults.filter((r) => r.status === "warning").length,
		};

		return {
			...result,
			results: filteredResults,
			summary: filteredSummary,
			lineRange: `${startLine}-${endLine}`,
		};
	}

	parseLineRange(lineRange) {
		if (lineRange.includes("-")) {
			const [start, end] = lineRange
				.split("-")
				.map((n) => parseInt(n.trim(), 10));
			return { startLine: start, endLine: end };
		} else {
			const line = parseInt(lineRange.trim(), 10);
			return { startLine: line, endLine: line };
		}
	}

	formatForCLI(result) {
		const lines = [];
		lines.push("Citation Validation Report");
		lines.push("==========================");
		lines.push("");
		lines.push(`File: ${result.file}`);
		if (result.lineRange) {
			lines.push(`Line Range: ${result.lineRange}`);
		}
		lines.push(`Processed: ${result.summary.total} citations found`);
		lines.push("");

		if (result.summary.errors > 0) {
			lines.push(`❌ CRITICAL ERRORS (${result.summary.errors})`);
			result.results
				.filter((r) => r.status === "error")
				.forEach((error, index) => {
					const isLast =
						index ===
						result.results.filter((r) => r.status === "error").length - 1;
					const prefix = isLast ? "└─" : "├─";
					lines.push(`${prefix} Line ${error.line}: ${error.citation}`);
					lines.push(`│  └─ ${error.error}`);
					if (error.suggestion) {
						lines.push(`│  └─ Suggestion: ${error.suggestion}`);
					}
					if (!isLast) lines.push("│");
				});
			lines.push("");
		}

		if (result.summary.warnings > 0) {
			lines.push(`⚠️  WARNINGS (${result.summary.warnings})`);
			result.results
				.filter((r) => r.status === "warning")
				.forEach((warning, index) => {
					const isLast =
						index ===
						result.results.filter((r) => r.status === "warning").length - 1;
					const prefix = isLast ? "└─" : "├─";
					lines.push(`${prefix} Line ${warning.line}: ${warning.citation}`);
					if (warning.suggestion) {
						lines.push(`│  └─ ${warning.suggestion}`);
					}
					if (!isLast) lines.push("│");
				});
			lines.push("");
		}

		if (result.summary.valid > 0) {
			lines.push(`✅ VALID CITATIONS (${result.summary.valid})`);
			result.results
				.filter((r) => r.status === "valid")
				.forEach((valid, index) => {
					const isLast =
						index ===
						result.results.filter((r) => r.status === "valid").length - 1;
					const prefix = isLast ? "└─" : "├─";
					lines.push(`${prefix} Line ${valid.line}: ${valid.citation} ✓`);
				});
			lines.push("");
		}

		lines.push("SUMMARY:");
		lines.push(`- Total citations: ${result.summary.total}`);
		lines.push(`- Valid: ${result.summary.valid}`);
		lines.push(`- Warnings: ${result.summary.warnings}`);
		lines.push(`- Critical errors: ${result.summary.errors}`);
		lines.push(`- Validation time: ${result.validationTime}`);
		lines.push("");

		if (result.summary.errors > 0) {
			lines.push(
				`❌ VALIDATION FAILED - Fix ${result.summary.errors} critical errors`,
			);
		} else if (result.summary.warnings > 0) {
			lines.push(
				`⚠️  VALIDATION PASSED WITH WARNINGS - ${result.summary.warnings} issues to review`,
			);
		} else {
			lines.push("✅ ALL CITATIONS VALID");
		}

		return lines.join("\n");
	}

	formatAsJSON(result) {
		return JSON.stringify(result, null, 2);
	}

	async extractBasePaths(filePath) {
		try {
			const { resolve, dirname, isAbsolute } = await import("node:path");
			const result = await this.validator.validateFile(filePath);

			const basePaths = new Set();
			const sourceDir = dirname(filePath);

			result.results.forEach((citation) => {
				// Extract path from citation link - handle multiple patterns
				let path = null;

				// Standard markdown link pattern: [text](path) or [text](path#anchor)
				const standardMatch = citation.citation.match(
					/\[([^\]]+)\]\(([^)#]+)(?:#[^)]+)?\)/,
				);
				if (standardMatch) {
					path = standardMatch[2];
				}

				// Citation pattern: [cite: path]
				const citeMatch = citation.citation.match(/\[cite:\s*([^\]]+)\]/);
				if (citeMatch) {
					path = citeMatch[1].trim();
				}

				if (path) {
					// Convert relative paths to absolute paths
					const absolutePath = isAbsolute(path)
						? path
						: resolve(sourceDir, path);
					basePaths.add(absolutePath);
				}
			});

			return Array.from(basePaths).sort();
		} catch (error) {
			throw new Error(`Failed to extract base paths: ${error.message}`);
		}
	}

	async fix(filePath, options = {}) {
		try {
			// Import fs for file operations
			const { readFileSync, writeFileSync } = await import("node:fs");

			// Build file cache if scope is provided
			if (options.scope) {
				const cacheStats = this.fileCache.buildCache(options.scope);
				console.log(
					`📁 Scanned ${cacheStats.totalFiles} files in ${cacheStats.scopeFolder}`,
				);
				if (cacheStats.duplicates > 0) {
					console.log(`⚠️  Found ${cacheStats.duplicates} duplicate filenames`);
				}
				this.validator.setFileCache(this.fileCache);
			}

			// First, validate to find fixable issues
			const validationResult = await this.validator.validateFile(filePath);

			// Find all fixable issues: warnings (path conversion) and errors (anchor fixes)
			const fixableResults = validationResult.results.filter(
				(result) =>
					(result.status === "warning" && result.pathConversion) ||
					(result.status === "error" && result.suggestion && (
						result.suggestion.includes("Use raw header format for better Obsidian compatibility") ||
						(result.error.startsWith("Anchor not found") && result.suggestion.includes("Available headers:"))
					)),
			);

			if (fixableResults.length === 0) {
				return `✅ No auto-fixable citations found in ${filePath}`;
			}

			// Read the file content
			let fileContent = readFileSync(filePath, "utf8");

			let fixesApplied = 0;
			let pathFixesApplied = 0;
			let anchorFixesApplied = 0;
			const fixes = [];

			// Process all fixable results
			for (const result of fixableResults) {
				let newCitation = result.citation;
				let fixType = "";

				// Apply path conversion if available
				if (result.pathConversion) {
					newCitation = this.applyPathConversion(
						newCitation,
						result.pathConversion,
					);
					pathFixesApplied++;
					fixType = "path";
				}

				// Apply anchor fix if needed (expanded logic for all anchor errors)
				if (
					result.status === "error" &&
					result.suggestion &&
					(result.suggestion.includes("Use raw header format for better Obsidian compatibility") ||
					(result.error.startsWith("Anchor not found") && result.suggestion.includes("Available headers:")))
				) {
					newCitation = this.applyAnchorFix(newCitation, result);
					anchorFixesApplied++;
					fixType = fixType ? "path+anchor" : "anchor";
				}

				// Replace citation in file content
				fileContent = fileContent.replace(result.citation, newCitation);

				fixes.push({
					line: result.line,
					old: result.citation,
					new: newCitation,
					type: fixType,
				});
				fixesApplied++;
			}

			// Write the fixed content back to the file
			if (fixesApplied > 0) {
				writeFileSync(filePath, fileContent, "utf8");

				// Enhanced reporting with breakdown
				const output = [
					`✅ Fixed ${fixesApplied} citation${fixesApplied === 1 ? "" : "s"} in ${filePath}:`,
				];

				if (pathFixesApplied > 0) {
					output.push(
						`   - ${pathFixesApplied} path correction${pathFixesApplied === 1 ? "" : "s"}`,
					);
				}
				if (anchorFixesApplied > 0) {
					output.push(
						`   - ${anchorFixesApplied} anchor correction${anchorFixesApplied === 1 ? "" : "s"}`,
					);
				}

				output.push("", "Changes made:");

				fixes.forEach((fix) => {
					output.push(`  Line ${fix.line} (${fix.type}):`);
					output.push(`    - ${fix.old}`);
					output.push(`    + ${fix.new}`);
					output.push("");
				});

				return output.join("\n");
			} else {
				return `⚠️  Found ${fixableResults.length} fixable citations but could not apply fixes`;
			}
		} catch (error) {
			return `❌ ERROR: ${error.message}`;
		}
	}

	// Helper method for applying path conversions
	applyPathConversion(citation, pathConversion) {
		return citation.replace(
			pathConversion.original,
			pathConversion.recommended,
		);
	}

	// Parse "Available headers: \"Vision Statement\" → #Vision Statement, ..."
	parseAvailableHeaders(suggestion) {
		const headerRegex = /"([^"]+)"\s*→\s*#([^,]+)/g;
		return [...suggestion.matchAll(headerRegex)].map(match => ({
			text: match[1].trim(),
			anchor: `#${match[2].trim()}`
		}));
	}

	// Convert "#kebab-case-format" to "kebab case format"
	normalizeAnchorForMatching(anchor) {
		return anchor.replace('#', '').replace(/-/g, ' ').toLowerCase();
	}

	// Find best header match using fuzzy logic
	findBestHeaderMatch(brokenAnchor, availableHeaders) {
		const searchText = this.normalizeAnchorForMatching(brokenAnchor);
		return availableHeaders.find(header =>
			header.text.toLowerCase() === searchText ||
			header.text.toLowerCase().replace(/[.\s]/g, '') === searchText.replace(/\s/g, '')
		);
	}

	// Apply URL encoding: "Vision Statement" → "Vision%20Statement"
	urlEncodeAnchor(headerText) {
		return headerText.replace(/ /g, '%20').replace(/\./g, '%2E');
	}

	// Helper method for applying anchor fixes (maintain existing logic)
	applyAnchorFix(citation, result) {
		const suggestionMatch = result.suggestion.match(
			/Use raw header format for better Obsidian compatibility: #(.+)$/,
		);
		if (suggestionMatch) {
			const newAnchor = suggestionMatch[1];
			const citationMatch = citation.match(/\[([^\]]+)\]\(([^)]+)#([^)]+)\)/);
			if (citationMatch) {
				const [, linkText, filePath] = citationMatch;
				return `[${linkText}](${filePath}#${newAnchor})`;
			}
		}

		// Handle anchor not found errors
		if (result.error.startsWith("Anchor not found") && result.suggestion.includes("Available headers:")) {
			const availableHeaders = this.parseAvailableHeaders(result.suggestion);
			const citationMatch = citation.match(/\[([^\]]+)\]\(([^)]+)#([^)]+)\)/);

			if (citationMatch && availableHeaders.length > 0) {
				const [, linkText, filePath, brokenAnchor] = citationMatch;
				const bestMatch = this.findBestHeaderMatch(`#${brokenAnchor}`, availableHeaders);

				if (bestMatch) {
					const encodedAnchor = this.urlEncodeAnchor(bestMatch.text);
					return `[${linkText}](${filePath}#${encodedAnchor})`;
				}
			}
		}

		return citation;
	}
}

const program = new Command();

program
	.name("citation-manager")
	.description("Citation validation and management tool for markdown files")
	.version("1.0.0");

program
	.command("validate")
	.description("Validate citations in a markdown file")
	.argument("<file>", "path to markdown file to validate")
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
	.action(async (file, options) => {
		const manager = new CitationManager();
		let result;

		if (options.fix) {
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
				if (result.includes("❌ ERROR:")) {
					process.exit(2); // File not found or other errors
				} else {
					process.exit(result.includes("VALIDATION FAILED") ? 1 : 0);
				}
			}
		}
	});

program
	.command("ast")
	.description("Show AST and extracted data from markdown file")
	.argument("<file>", "path to markdown file to analyze")
	.action(async (file) => {
		const manager = new CitationManager();
		const ast = await manager.parser.parseFile(file);
		console.log(JSON.stringify(ast, null, 2));
	});

program
	.command("base-paths")
	.description("Extract distinct base paths from citations in a markdown file")
	.argument("<file>", "path to markdown file to analyze")
	.option("--format <type>", "output format (cli, json)", "cli")
	.action(async (file, options) => {
		try {
			const manager = new CitationManager();
			const basePaths = await manager.extractBasePaths(file);

			if (options.format === "json") {
				console.log(
					JSON.stringify({ file, basePaths, count: basePaths.length }, null, 2),
				);
			} else {
				console.log("Distinct Base Paths Found:");
				console.log("========================");
				console.log("");
				basePaths.forEach((path, index) => {
					console.log(`${index + 1}. ${path}`);
				});
				console.log("");
				console.log(
					`Total: ${basePaths.length} distinct base path${basePaths.length === 1 ? "" : "s"}`,
				);
			}
		} catch (error) {
			console.error(`❌ ERROR: ${error.message}`);
			process.exit(1);
		}
	});

program.parse();
