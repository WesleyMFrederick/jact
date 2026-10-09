/**
 * Validation rule registry — one place that lists every rule and the preset
 * that enables it (mirrors the flavor registry, ADR-0003). Plugins add rules
 * and presets at load time.
 */

import type {
	RuleSet,
	ValidationPlugin,
	ValidationRule,
} from "../../types/validationRuleTypes.js";
import { anchorDroppedChars } from "./rules/anchorDroppedChars.js";
import { noReferenceNoteLink } from "./rules/noReferenceNoteLink.js";
import { noVaultEscapeLink } from "./rules/noVaultEscapeLink.js";

/** Preset used when no config selects one: plain CommonMark, no extra rules. */
export const DEFAULT_PRESET = "commonmark";

/** The rule set with nothing enabled — what `commonmark` resolves to with no config. */
export const NO_RULES: RuleSet = { enabled: new Set(), rules: [] };

/** Rule setting in config: force a rule on or off regardless of preset. */
export type RuleSetting = "off" | "error";

export class RuleRegistry {
	readonly presets = new Set<string>([DEFAULT_PRESET, "obsidian"]);
	readonly rules = new Map<string, ValidationRule>();

	constructor() {
		this.register(
			{ rules: [noReferenceNoteLink, anchorDroppedChars, noVaultEscapeLink] },
			"jact",
		);
	}

	/** Add a plugin's rules and presets. Throws on a rule ID already registered. */
	register(plugin: ValidationPlugin, source: string): void {
		for (const rule of plugin.rules) {
			if (this.rules.has(rule.id)) {
				throw new Error(`${source}: rule "${rule.id}" is already registered`);
			}
			this.rules.set(rule.id, rule);
			this.presets.add(rule.preset);
		}
		for (const preset of plugin.presets ?? []) this.presets.add(preset);
	}

	/**
	 * Enabled rules: the preset's rules, plus rules set to "error", minus rules
	 * set to "off". Callers validate preset and rule IDs first.
	 */
	resolve(preset: string, settings: Record<string, RuleSetting>): RuleSet {
		const rules = [...this.rules.values()].filter((rule) =>
			settings[rule.id] === undefined
				? rule.preset === preset
				: settings[rule.id] === "error",
		);
		return { enabled: new Set(rules.map((rule) => rule.id)), rules };
	}
}
