// ESLint flat config — D1 named-array rule library.
// Pattern: lbnl-benefits/eslint.config.js (named arrays composed per file scope).
// Each ban cites §9f cheat ID it defeats.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import tsParser from "@typescript-eslint/parser";

/* HARDENING-ALLOWLIST
   Default injectable type names (jact-specific).
   Override via env var HARDENING_INJECTABLE_TYPES (comma-separated)
   or co-located .hardening-config.json with key injectableTypes.

   DEFAULT_INJECTABLE_TYPES = [
     "FileCache",
     "FileSystemInterface",
     "LinkObjectFactory",
     "MarkdownParser",
     "CitationValidator",
     "ContentExtractor",
     "ParsedFileCache",
     "ParsedDocument",
   ];
HARDENING-ALLOWLIST */

function loadInjectableTypes() {
	if (process.env.HARDENING_INJECTABLE_TYPES) {
		return process.env.HARDENING_INJECTABLE_TYPES.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
	}
	const cfgPath = join(process.cwd(), ".hardening-config.json");
	if (existsSync(cfgPath)) {
		try {
			const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
			if (
				Array.isArray(cfg.injectableTypes) &&
				cfg.injectableTypes.length > 0
			) {
				return cfg.injectableTypes;
			}
		} catch {}
	}
	// Fallback: parse default list from the HARDENING-ALLOWLIST block comment in this file.
	// Keeps the canonical list inside the allowlist block (HC14 portability).
	const self = readFileSync(new URL(import.meta.url), "utf8");
	const block = self.match(/HARDENING-ALLOWLIST([\s\S]*?)HARDENING-ALLOWLIST/);
	if (block && block[1]) {
		const literal = block[1].match(
			/DEFAULT_INJECTABLE_TYPES\s*=\s*\[([\s\S]*?)\]/,
		);
		if (literal && literal[1]) {
			return literal[1]
				.split(",")
				.map((s) => s.trim().replace(/^["']|["']$/g, ""))
				.filter(Boolean);
		}
	}
	return [];
}

const INJECTABLE_TYPES = loadInjectableTypes();
const TYPE_REGEX = INJECTABLE_TYPES.join("|");

// Named-array: D1 injectable optional dep bans.
// Defeats Plan-01 Cheat 1 (dead-code-on-optional injectable).
const injectableDepBans = [
	{
		selector: `TSTypeAnnotation > TSTypeReference > Identifier[name=/^(${TYPE_REGEX})$/]`,
		message:
			"Injectable dep used (D1). If OPTIONAL (param?: T), use required injection or add `// @inject-optional: <reason>` on prev line. Defeats Plan-01 Cheat 1.",
	},
];

const baseRules = {
	"no-restricted-syntax": ["error", ...injectableDepBans],
};

const baseLanguageOptions = {
	parser: tsParser,
	parserOptions: { ecmaVersion: 2022, sourceType: "module" },
};

export default [
	{
		files: ["src/**/*.ts"],
		languageOptions: baseLanguageOptions,
		rules: baseRules,
	},
	{
		files: ["src/factories/**/*.ts"],
		languageOptions: baseLanguageOptions,
		rules: baseRules,
	},
	{
		files: ["test/**/*.ts"],
		languageOptions: baseLanguageOptions,
		rules: baseRules,
	},
];
