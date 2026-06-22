#!/usr/bin/env node
/**
 * Lightweight LSP proxy using the TypeScript compiler API.
 * No new dependency — uses the `typescript` already in node_modules.
 *
 * This is the deterministic, replayable stand-in for "go to references /
 * go to implementation" in an editor. Same input → same output every run.
 *
 * Usage:
 *   node lsp-find-refs.mjs <file> <line> <symbolName>
 *
 * Finds <symbolName> on 1-based <line> of <file>, then reports:
 *   - references:      getReferencesAtPosition  (LSP "find all references")
 *   - implementations: getImplementationAtPosition (LSP "go to implementation")
 *
 * Output: JSON { symbol, position, references[], implementations[] }
 * Fails loudly with exit code 2 on any setup error (Hardening Principle: fail loud).
 */
import ts from "typescript";
import { readFileSync } from "node:fs";
import path from "node:path";

const [, , fileArg, lineArg, symbol] = process.argv;
if (!fileArg || !lineArg || !symbol) {
	console.error("usage: node lsp-find-refs.mjs <file> <line> <symbolName>");
	process.exit(2);
}

const projectRoot = process.cwd();
const targetFile = path.resolve(projectRoot, fileArg);
const line1 = Number(lineArg);

const configPath = ts.findConfigFile(projectRoot, ts.sys.fileExists, "tsconfig.json");
if (!configPath) {
	console.error("FAIL: no tsconfig.json found from " + projectRoot);
	process.exit(2);
}
const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
if (error) {
	console.error("FAIL: cannot read tsconfig: " + error.messageText);
	process.exit(2);
}
const parsed = ts.parseJsonConfigFileContent(config, ts.sys, path.dirname(configPath));

const fileVersions = new Map();
for (const f of parsed.fileNames) fileVersions.set(path.resolve(f), 0);
if (!fileVersions.has(targetFile)) fileVersions.set(targetFile, 0);

const host = {
	getScriptFileNames: () => Array.from(fileVersions.keys()),
	getScriptVersion: (f) => String(fileVersions.get(path.resolve(f)) ?? 0),
	getScriptSnapshot: (f) => {
		try {
			return ts.ScriptSnapshot.fromString(readFileSync(f, "utf8"));
		} catch {
			return undefined;
		}
	},
	getCurrentDirectory: () => projectRoot,
	getCompilationSettings: () => parsed.options,
	getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
	fileExists: ts.sys.fileExists,
	readFile: ts.sys.readFile,
	readDirectory: ts.sys.readDirectory,
	directoryExists: ts.sys.directoryExists,
	getDirectories: ts.sys.getDirectories,
};

const service = ts.createLanguageService(host, ts.createDocumentRegistry());

const text = readFileSync(targetFile, "utf8");
const lines = text.split(/\r?\n/);
const lineText = lines[line1 - 1] ?? "";
const col0 = lineText.indexOf(symbol);
if (col0 < 0) {
	console.error(`FAIL: symbol "${symbol}" not found on line ${line1} of ${fileArg}`);
	process.exit(2);
}

const sf = ts.createSourceFile(targetFile, text, ts.ScriptTarget.Latest, true);
const pos = sf.getPositionOfLineAndCharacter(line1 - 1, col0);

const program = service.getProgram();
const toLoc = (fileName, position) => {
	const src = program.getSourceFile(fileName);
	const lc = src.getLineAndCharacterOfPosition(position);
	return `${path.relative(projectRoot, fileName)}:${lc.line + 1}`;
};

const refs = service.getReferencesAtPosition(targetFile, pos) || [];
const impls = service.getImplementationAtPosition(targetFile, pos) || [];

console.log(
	JSON.stringify(
		{
			symbol,
			position: `${fileArg}:${line1}`,
			references: [...new Set(refs.map((r) => toLoc(r.fileName, r.textSpan.start)))].sort(),
			implementations: [
				...new Set(impls.map((i) => toLoc(i.fileName, i.textSpan.start))),
			].sort(),
		},
		null,
		2,
	),
);
