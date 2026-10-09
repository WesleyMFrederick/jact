import type { ValidationRule } from "../../../types/validationRuleTypes.js";

/**
 * Heading anchors that use characters Obsidian drops (`: # | ^ [ ]`). The
 * check needs the target's anchors, so it runs inside `AnchorMatcher` when
 * this ID is enabled and reports through the link's validation result.
 */
export const ANCHOR_DROPPED_CHARS_RULE = "obsidian/anchor-dropped-chars";

export const anchorDroppedChars: ValidationRule = {
	id: ANCHOR_DROPPED_CHARS_RULE,
	preset: "obsidian",
	check: () => [],
};
