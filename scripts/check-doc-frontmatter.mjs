#!/usr/bin/env node
// Fails when a tracked markdown file carries vault edit stamps (`created`, `last_modified`)
// in its YAML header. Those stamps come from a local editor hook and leak private
// bookkeeping into PRs; this repo opts out with `.no-frontmatter-timestamps`.
// Verification keys (`last_verified`, `verified_by`) written by `doc-verify` are allowed.
// Test fixtures are skipped: some fixtures model real-world front matter on purpose.
//
// Usage: node scripts/check-doc-frontmatter.mjs   (run from anywhere inside the repo)
// Exit:  0 clean, 1 stamps found.
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const BANNED_KEYS = ["created", "last_modified"];
const SKIPPED_PREFIXES = ["test/fixtures/"];

/** Returns the banned keys found in the file's leading YAML header, in header order. */
export function findStampKeys(content) {
	const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
	if (lines[0]?.trimEnd() !== "---") return [];
	const end = lines.findIndex((line, index) => index > 0 && /^(?:---|\.\.\.)$/.test(line.trimEnd()));
	if (end === -1) return [];
	return lines
		.slice(1, end)
		.map((line) => /^(["']?)([A-Za-z_]+)\1[ \t]*:/.exec(line)?.[2])
		.filter((key) => key !== undefined && BANNED_KEYS.includes(key));
}

function main() {
	const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
	const files = execFileSync("git", ["ls-files", "-z", ":(icase)*.md", ":(icase)*.markdown"], { cwd: root, encoding: "utf8" })
		.split("\0")
		.filter((file) => file.length > 0 && !SKIPPED_PREFIXES.some((prefix) => file.startsWith(prefix)))
		.filter((file) => statSync(join(root, file), { throwIfNoEntry: false })?.isFile());
	const offenders = files
		.map((file) => ({ file, keys: findStampKeys(readFileSync(join(root, file), "utf8")) }))
		.filter(({ keys }) => keys.length > 0);
	for (const { file, keys } of offenders) {
		console.error(`${file}: remove ${keys.join(", ")} from the YAML header`);
	}
	if (offenders.length > 0) {
		console.error(
			`\n${offenders.length} file(s) carry editor timestamps. Delete those lines; keep last_verified/verified_by.`,
		);
		process.exitCode = 1;
		return;
	}
	console.log(`check-doc-frontmatter: ${files.length} markdown files clean`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
