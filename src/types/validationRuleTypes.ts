/**
 * Validation rule contracts: rules grouped into presets, run after link
 * validation, reporting findings that may carry `--fix` edits.
 */

import type { ParserOutput } from "./citationTypes.js";
import type { EnrichedLinkObject } from "./validationTypes.js";

/** One text replacement over source offsets (end exclusive). */
export interface RuleEdit {
	start: number;
	end: number;
	replacement: string;
}

/** One problem a rule reports. Counts as a validation error. */
export interface RuleFinding {
	ruleId: string;
	/** 1-based */
	line: number;
	/** 0-based */
	column: number;
	message: string;
	/** source text the finding points at, for display */
	source?: string;
	/** `--fix` edits; applied together with jact's own link fixes */
	edits?: RuleEdit[];
}

/** What a rule sees: the parsed file and its validated links. */
export interface RuleContext {
	filePath: string;
	document: ParserOutput;
	links: EnrichedLinkObject[];
}

export interface ValidationRule {
	/** `<namespace>/<name>`, unique across built-ins and plugins */
	id: string;
	/** the one preset that enables this rule by default */
	preset: string;
	check(context: RuleContext): RuleFinding[];
}

/** A plugin module's default export. */
export interface ValidationPlugin {
	rules: ValidationRule[];
	/** preset names the plugin declares, so config can select them */
	presets?: string[];
}

/** The rules enabled for one file. */
export interface RuleSet {
	enabled: ReadonlySet<string>;
	rules: readonly ValidationRule[];
}

/** Looks up the rules enabled for a file (from config). */
export type RuleSetResolver = (filePath: string) => Promise<RuleSet>;
