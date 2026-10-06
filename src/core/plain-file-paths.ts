import { statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { Root } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import type { Node, Parent } from "unist";
import {
	jactMdastExtensions,
	jactSyntaxExtension,
} from "./MarkdownParser/extensions/assemble.js";

export interface PlainFilePath {
	raw: string;
	path: string;
	suffix: string;
	start: number;
	end: number;
	line: number;
	column: number;
	context: "prose" | "code";
}

const excludedNodes = new Set([
	"link", "linkReference", "image", "imageReference", "definition",
	"wikilink", "obsidianLink", "citation", "html", "yaml", "obsidianComment",
]);

/** Preserve command-shaped, unmarked lines until their prose/code policy is explicit. */
function isCommandLine(line: string): boolean {
	const text = line.trim().replace(/^(?:>\s*|[-*+]\s+|\d+[.)]\s+)/, "");
	return /^\/goal(?:\s|$)/.test(text) || /^\$\s/.test(text) ||
		/^[a-z][a-z0-9_-]*\s+\S/.test(text);
}

/** Scan path tokens only inside contexts already identified by the Markdown parser. */
export function findPlainFilePaths(content: string): PlainFilePath[] {
	const ast: Root = fromMarkdown(content, {
		extensions: [jactSyntaxExtension()],
		mdastExtensions: jactMdastExtensions(),
	});
	const references: PlainFilePath[] = [];
	const lineStarts = [0];
	for (let index = 0; index < content.length; index++) {
		if (content[index] === "\n") lineStarts.push(index + 1);
	}
	const location = (offset: number): { line: number; column: number } => {
		let low = 0;
		let high = lineStarts.length;
		while (low + 1 < high) {
			const middle = (low + high) >>> 1;
			if ((lineStarts[middle] ?? 0) <= offset) low = middle;
			else high = middle;
		}
		return { line: low + 1, column: offset - (lineStarts[low] ?? 0) };
	};
	const scan = (node: Node, code: boolean): void => {
		const start = node.position?.start.offset;
		const end = node.position?.end.offset;
		if (start === undefined || end === undefined) return;
		const source = content.slice(start, end);
		// Quotes and code delimiters remain outside each reference's edit span.
		const tokens = /[^\s`"'<>[\](){}|;!?=]+/g;
		for (const match of source.matchAll(tokens)) {
			let raw = match[0];
			let tokenStart = start + match.index;
			if (/[*?{}]/.test(raw) || raw.includes("\\") || raw.includes("${") ||
				raw.includes("%") && !/%[0-9a-f]{2}/i.test(raw)) continue;
			// Do not pick paths out of a URL, glob or template token split by punctuation.
			const before = tokenStart > start ? content[tokenStart - 1] ?? "" : "";
			const after = tokenStart + raw.length < end ? content[tokenStart + raw.length] ?? "" : "";
			if (/[>}]/.test(content[tokenStart - 1] ?? "")) continue;
			if (/[\w/*?{}$]/.test(before) || /[*?{}]/.test(after)) continue;
			if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || /^(?:mailto|file|data):/i.test(raw)) continue;
			const labeledPath = /^[a-z][a-z0-9_-]*:(?=\.\.?\/|~\/|\/)/i.exec(raw);
			if (labeledPath) {
				tokenStart += labeledPath[0].length;
				raw = raw.slice(labeledPath[0].length);
			}
			raw = raw.replace(/[.,:]+$/, "");
			const suffixMatch = /(?:#[^\s]+|:L?\d+(?:[,-]L?\d+)*)$/.exec(raw);
			const suffix = suffixMatch?.[0] ?? "";
			const filePath = suffix ? raw.slice(0, -suffix.length) : raw;
			if (!filePath || filePath.endsWith("/") || filePath.includes(":")) continue;
			if (!filePath.includes("/") && !/^[\p{L}\p{N}_.@+-]*\.[a-z][a-z0-9_-]*$/iu.test(filePath)) continue;
			if (filePath.includes("/") && !/^(?:~\/|\/|\.\.?\/)?[\p{L}\p{N}_.@+%/-]+$/u.test(filePath)) continue;
			const position = location(tokenStart);
			const lineStart = lineStarts[position.line - 1] ?? 0;
			const lineEnd = content.indexOf("\n", lineStart);
			const lineText = content.slice(lineStart, lineEnd < 0 ? content.length : lineEnd);
			if (filePath === "/goal" && /^\s*\/goal\s+/.test(lineText) &&
				content.slice(lineStart, tokenStart).trim() === "") continue;
			references.push({
				raw, path: filePath, suffix, start: tokenStart,
				end: tokenStart + raw.length, ...position,
				context: code || isCommandLine(lineText) ? "code" : "prose",
			});
		}
	};
	const walk = (node: Node): void => {
		if (excludedNodes.has(node.type)) return;
		if (node.type === "text" || node.type === "inlineCode" || node.type === "code") {
			scan(node, node.type !== "text");
			return;
		}
		if ("children" in node) {
			for (const child of (node as Parent).children) walk(child);
		}
	};
	walk(ast);
	return references.sort((left, right) => left.start - right.start);
}

/** Exact files only. Two distinct existing candidates are ambiguous, never guessed. */
export function resolvePlainFilePath(
	reference: PlainFilePath,
	sourceFile: string,
	scope: string,
): { target: string | null; candidates: string[] } {
	const rawPath = reference.path.startsWith("~/")
		? path.join(homedir(), reference.path.slice(2))
		: reference.path;
	const possible = path.isAbsolute(rawPath)
		? [path.normalize(rawPath)]
		: [path.resolve(path.dirname(sourceFile), rawPath), path.resolve(scope, rawPath)];
	const candidates = [...new Set(possible)].filter((candidate) => {
		try {
			return statSync(candidate).isFile();
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT" ||
				(error as NodeJS.ErrnoException).code === "ENOTDIR") return false;
			throw error;
		}
	});
	return { target: candidates.length === 1 ? candidates[0] ?? null : null, candidates };
}
