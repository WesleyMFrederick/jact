import type {
	EnrichedLinkObject,
	ValidationSummary,
} from "../types/validationTypes.js";

/**
 * Build aggregate counts (total / valid / warnings / errors) from a list of
 * enriched links.
 *
 * Pure function — no class dependency, no `this`, no I/O. Extracted from
 * CitationValidator for testability and to eliminate a module-boundary leak
 * (per GH issue #30).
 *
 * @param links - Validated, enriched LinkObjects
 * @returns ValidationSummary aggregate counts
 */
export function computeValidationSummary(
	links: readonly EnrichedLinkObject[],
): ValidationSummary {
	return {
		total: links.length,
		valid: links.filter((link) => link.validation.status === "valid").length,
		warnings: links.filter((link) => link.validation.status === "warning")
			.length,
		errors: links.filter((link) => link.validation.status === "error").length,
	};
}
