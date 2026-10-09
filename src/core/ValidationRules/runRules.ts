import type { ParserOutput } from "../../types/citationTypes.js";
import type { RuleSet } from "../../types/validationRuleTypes.js";
import type { ValidationResult } from "../../types/validationTypes.js";

/**
 * Run every enabled rule over a validated file. Each finding is an error:
 * it joins `result.findings` and counts in `summary.errors`.
 */
export function runRules(
	ruleSet: RuleSet,
	filePath: string,
	document: ParserOutput,
	result: ValidationResult,
): ValidationResult {
	const findings = ruleSet.rules.flatMap((rule) =>
		rule.check({ filePath, document, links: result.links }),
	);
	return {
		...result,
		summary: {
			...result.summary,
			errors: result.summary.errors + findings.length,
		},
		findings,
	};
}

/** An error message tagged with the rule that owns it, e.g. `msg [obsidian/x]`. */
export function withRuleId(
	message: string,
	ruleId: string | undefined,
): string {
	return ruleId ? `${message} [${ruleId}]` : message;
}
