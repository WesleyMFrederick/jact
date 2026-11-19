#!/usr/bin/env node
// Measures the three numbers the README cites, on any folder of Markdown.
//
//   node scripts/measure-agent-value.mjs <folder> [<folder>...]
//
// 1. Reading: characters an agent loads for "outline + one section" compared
//    with the whole file. Counted on files of 4,000+ characters with two or
//    more H2 sections; the section is the file's median-length H2 section.
// 2. Writing: links checked, broken links found, and seconds taken by one
//    `jact validate` run over the same folders.
// 3. Hook cost: median milliseconds for one `jact hook` call on a write.
//
// Run `npm run build` first. Prints one JSON object.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "cli.js");
const roots = process.argv.slice(2).map((root) => resolve(root)).filter((root) => existsSync(root));
if (roots.length === 0) {
	console.error("Usage: node scripts/measure-agent-value.mjs <folder> [<folder>...]");
	process.exit(2);
}

const jact = (args, input) =>
	spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", maxBuffer: 1e9, input });
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const percent = (value) => Math.round(value * 100);

function markdownFiles(folder, found = []) {
	for (const entry of readdirSync(folder)) {
		if (entry === "node_modules" || entry.startsWith(".")) continue;
		const path = join(folder, entry);
		let stats;
		try {
			stats = statSync(path);
		} catch {
			continue;
		}
		if (stats.isDirectory()) markdownFiles(path, found);
		else if (path.endsWith(".md")) found.push(path);
	}
	return found;
}

const files = roots.flatMap((root) => markdownFiles(root));

// 1. Reading
const rows = [];
for (const file of files) {
	const whole = readFileSync(file, "utf8").length;
	if (whole < 4000) continue;
	let headings;
	try {
		headings = JSON.parse(jact(["ast", file]).stdout).headings ?? [];
	} catch {
		continue;
	}
	const sections = headings
		.filter((heading) => heading.level === 2)
		.map((heading) => jact(["extract", "header", file, heading.text]))
		.filter((result) => result.status === 0 && result.stdout.length > 0)
		.map((result) => result.stdout.length);
	if (sections.length < 2) continue;
	rows.push({ whole, cost: jact(["outline", file]).stdout.length + median(sections) });
}
const savings = rows.map((row) => 1 - row.cost / row.whole);
const sum = (key) => rows.reduce((total, row) => total + row[key], 0);

// 2. Writing
// One batch run gives the time. Per-file runs give the link counts.
const validateStarted = Date.now();
jact(["validate", ...roots.map((root) => join(root, "**/*.md")), "--json"]);
const validateSeconds = (Date.now() - validateStarted) / 1000;
const summary = { files: files.length, linksChecked: 0, brokenLinks: 0, filesWithBrokenLinks: 0 };
for (const file of files) {
	try {
		const counts = JSON.parse(jact(["validate", file, "--format", "json"]).stdout).summary;
		summary.linksChecked += counts.total;
		summary.brokenLinks += counts.errors;
		if (counts.errors > 0) summary.filesWithBrokenLinks += 1;
	} catch {
		// A file jact cannot parse adds nothing to the counts.
	}
}

// 3. Hook cost
const sample = files[0];
const hookMs = [];
if (sample !== undefined)
	for (let run = 0; run < 15; run += 1) {
		const started = performance.now();
		jact(["hook", "claude"], JSON.stringify({ tool_name: "Write", tool_input: { file_path: sample }, cwd: dirname(sample) }));
		hookMs.push(performance.now() - started);
	}

console.log(
	JSON.stringify(
		{
			folders: roots,
			reading: {
				filesScanned: files.length,
				filesMeasured: rows.length,
				medianWholeFileChars: median(rows.map((row) => row.whole)),
				medianOutlinePlusSectionChars: median(rows.map((row) => row.cost)),
				medianSavingPercent: percent(median(savings)),
				smallestSavingPercent: percent(Math.min(...savings)),
				largestSavingPercent: percent(Math.max(...savings)),
				allFilesTogetherSavingPercent: percent(1 - sum("cost") / sum("whole")),
			},
			writing: { ...summary, seconds: Number(validateSeconds.toFixed(2)) },
			hook: { calls: hookMs.length, medianMs: Math.round(median(hookMs)) },
		},
		null,
		1,
	),
);
