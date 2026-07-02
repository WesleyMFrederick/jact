#!/usr/bin/env node
/**
 * One-shot repair: URL-encode anchors in cross-file markdown links within
 * design-docs/spec/*.md so Obsidian (and strict CommonMark renderers) can
 * parse them. Encodes space, ( ) ` in the #anchor part only, scanning with
 * balanced-paren awareness so anchors containing parens are captured whole.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) {
	console.error("usage: encode-spec-link-anchors.mjs <spec-dir>");
	process.exit(2);
}

const encodeAnchor = (a) =>
	a
		// Encode only a bare "%" (not one already starting a %XX escape), so the
		// script is idempotent — re-running never double-encodes %20/%28/%29/%60.
		.replaceAll(/%(?![0-9A-Fa-f]{2})/g, "%25")
		.replaceAll(" ", "%20")
		.replaceAll("(", "%28")
		.replaceAll(")", "%29")
		.replaceAll("`", "%60");

function repairLine(line) {
	let out = "";
	let i = 0;
	while (i < line.length) {
		const start = line.indexOf("](", i);
		if (start === -1) {
			out += line.slice(i);
			break;
		}
		out += line.slice(i, start + 2);
		// scan destination with paren balance (starts at depth 1 from the "(" of "](")
		let j = start + 2;
		let depth = 1;
		while (j < line.length && depth > 0) {
			if (line[j] === "(") depth++;
			else if (line[j] === ")") depth--;
			if (depth > 0) j++;
		}
		const dest = line.slice(start + 2, j);
		const hash = dest.indexOf("#");
		if (hash !== -1 && /\.md$/.test(dest.slice(0, hash))) {
			out += dest.slice(0, hash + 1) + encodeAnchor(dest.slice(hash + 1));
		} else {
			out += dest;
		}
		i = j; // the closing ")" is appended on next iteration via slice
	}
	return out;
}

for (const f of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
	const p = join(dir, f);
	const before = readFileSync(p, "utf8");
	const after = before.split("\n").map(repairLine).join("\n");
	if (after !== before) {
		writeFileSync(p, after);
		console.log(`repaired: ${f}`);
	}
}
