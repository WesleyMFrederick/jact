#!/usr/bin/env node
/**
 * Manual testing script for content extraction
 *
 * Usage:
 *   node scripts/test-extract.js <source-file> [--full-files]
 *
 * Examples:
 *   node scripts/test-extract.js test/fixtures/us2.2/mixed-links-source.md
 *   node scripts/test-extract.js path/to/file.md --full-files
 */

import { createContentExtractor } from "../dist/factories/componentFactory.js";
import { resolve } from "node:path";

async function testExtract(sourceFilePath, cliFlags = {}) {
	console.log(`\n${"=".repeat(60)}`);
	console.log(`Extracting content from: ${sourceFilePath}`);
	console.log(`${"=".repeat(60)}\n`);

	const extractor = createContentExtractor();
	const results = await extractor.extractLinksContent(sourceFilePath, cliFlags);

	console.log(`Found ${results.length} link(s)\n`);

	for (let i = 0; i < results.length; i++) {
		const result = results[i];
		console.log(`${"-".repeat(60)}`);
		console.log(`Link ${i + 1}:`);
		console.log(`  Link: ${result.sourceLink.fullMatch}`);
		console.log(`  Line: ${result.sourceLink.line}`);
		console.log(
			`  Target: ${result.sourceLink.target.path?.raw || "(internal)"}`,
		);
		console.log(
			`  Anchor: ${result.sourceLink.target.anchor || "(none - full file)"}`,
		);
		console.log(`  Type: ${result.sourceLink.anchorType || "full-file"}`);
		console.log(`  Status: ${result.status}`);

		if (result.status === "success") {
			const content = result.successDetails.extractedContent;
			console.log(`  Content Length: ${content.length} characters`);
			console.log(`  Decision: ${result.successDetails.decisionReason}`);
			console.log("\n  Content Preview (first 300 chars):");
			console.log(`  ${"-".repeat(56)}`);
			const preview = content
				.substring(0, 300)
				.split("\n")
				.map((line) => `  ${line}`)
				.join("\n");
			console.log(preview);
			if (content.length > 300) {
				console.log(`  ... (${content.length - 300} more characters)`);
			}
		} else if (result.status === "skipped") {
			console.log(`  Reason: ${result.failureDetails.reason}`);
		} else {
			console.log(`  Error: ${result.failureDetails.reason}`);
		}
		console.log("");
	}

	console.log(`${"=".repeat(60)}`);
	console.log(
		`Extraction complete: ${results.filter((r) => r.status === "success").length} successful, ${results.filter((r) => r.status === "skipped").length} skipped, ${results.filter((r) => r.status === "error").length} errors`,
	);
	console.log(`${"=".repeat(60)}\n`);
}

// Parse command line arguments
const args = process.argv.slice(2);
// Collect all non-flag arguments and join them to handle paths with spaces
const nonFlagArgs = args.filter((arg) => !arg.startsWith("--"));
const sourceFile = nonFlagArgs.length > 0 ? nonFlagArgs.join(" ") : null;
const fullFiles = args.includes("--full-files");

if (!sourceFile) {
	console.error("Error: Source file path required\n");
	console.error(
		"Usage: node scripts/test-extract.js <source-file> [--full-files]\n",
	);
	console.error("Examples:");
	console.error(
		"  node scripts/test-extract.js test/fixtures/us2.2/mixed-links-source.md",
	);
	console.error("  node scripts/test-extract.js path/to/file.md --full-files");
	process.exit(1);
}

// Resolve absolute path
const absolutePath = resolve(sourceFile);

// Run extraction
testExtract(absolutePath, { fullFiles }).catch((err) => {
	console.error("\n❌ Extraction failed:", err.message);
	console.error(err.stack);
	process.exit(1);
});
