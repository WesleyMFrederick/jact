/**
 * CitationValidator — thin coordinator for citation validation.
 *
 * Delegates path resolution to PathResolver and anchor matching to AnchorMatcher.
 * Owns: pattern classification, result assembly, public validate API.
 *
 * Moved from src/CitationValidator.ts (issue #33).
 * Extraction of PathResolver and AnchorMatcher per issue #28.
 * Path-resolution waterfall replaced by strategy array (issue #28).
 */

import type { LinkObject } from "../../types/citationTypes.js";
import type {
	AnchorConversion,
	EnrichedLinkObject,
	PathConversion,
	ValidationMetadata,
	ValidationResult,
} from "../../types/validationTypes.js";
import { computeValidationSummary } from "../computeValidationSummary.js";
import type {
	ParsedDocumentLifecycleLike,
	ParsedDocumentLike,
} from "./AnchorMatcher.js";
import { AnchorMatcher } from "./AnchorMatcher.js";
import type { FileCacheLike } from "./PathResolver.js";
import { PathResolver } from "./PathResolver.js";

type FileCacheInterface = FileCacheLike;
interface SingleCitationValidationResult {
	line: number;
	citation: string;
	status: "valid" | "error" | "warning";
	linkType: string;
	scope: string;
	error?: string;
	suggestion?: string;
	pathConversion?: PathConversion;
	anchorConversion?: AnchorConversion;
}

// ── enrichLinkObject factory ──────────────────────────────────────────────────

/**
 * Constructs a new EnrichedLinkObject from a LinkObject and ValidationMetadata
 * via object spread. The original `link` is never mutated — callers holding a
 * reference to the original see no change after enrichment.
 *
 * Replaces the previous in-place mutation pattern:
 *   `(citation as EnrichedLinkObject).validation = validation`
 *
 * Contract:
 * - The returned object is a NEW reference (not the same object as `link`).
 * - The original `link` is NOT mutated: no properties are added, changed, or deleted.
 * - The returned object contains all fields from `link` plus `validation: meta`.
 */
export function enrichLinkObject(
	link: LinkObject,
	meta: ValidationMetadata,
): EnrichedLinkObject {
	return { ...link, validation: meta };
}

// ── Pattern constants ─────────────────────────────────────────────────────────

const CARET_SYNTAX_REGEX =
	/^\^([A-Za-z]{2,3}\d+(?:-\d+[a-z]?(?:AC\d+|T\d+(?:-\d+)?)?)?|[A-Za-z]+\d+|MVP-P\d+|[a-zA-Z][a-zA-Z0-9-]+[a-zA-Z0-9])$/;
const CARET_SYNTAX_EXAMPLES = [
	"^FR1",
	"^US1-1AC1",
	"^NFR2",
	"^MVP-P1",
	"^black-box-interfaces",
	"^F-LK-003",
];
const EMPHASIS_MARKED_REGEX = /^==\*\*[^*]+\*\*==$/;
const EMPHASIS_MARKED_EXAMPLES = [
	"==**Component**==",
	"==**Code Processing Application.SetupOrchestrator**==",
];

export class CitationValidator {
	private pathResolver: PathResolver;
	private anchorMatcher: AnchorMatcher;

	constructor(
		parsedDocumentLifecycle: ParsedDocumentLifecycleLike,
		fileCache: FileCacheInterface,
	) {
		this.pathResolver = new PathResolver(fileCache);
		this.anchorMatcher = new AnchorMatcher(parsedDocumentLifecycle);
	}

	// ── Public API ────────────────────────────────────────────────────────────

	/** Validate one semantic document using filePath as its link base and self-anchor key. */
	async validateDocument(
		document: ParsedDocumentLike,
		filePath: string,
	): Promise<ValidationResult> {
		const links = document.getLinks();

		const enrichedLinks: EnrichedLinkObject[] = await Promise.all(
			links.map((link: LinkObject) =>
				this.validateSingleCitation(link, filePath),
			),
		);

		const summary = computeValidationSummary(enrichedLinks);

		return { summary, links: enrichedLinks };
	}

	/**
	 * Contract:
	 * - Returns an `EnrichedLinkObject` whose `validation.status` is `"valid"`,
	 *   `"warning"`, or `"error"` — never a fourth value.
	 * - The returned object is a NEW reference; the original `citation` is not mutated.
	 * - `validation.error` is present when `status === "error"`.
	 * - `validation.suggestion` is present when a suggestion exists.
	 */
	async validateSingleCitation(
		citation: LinkObject,
		contextFile?: string,
	): Promise<EnrichedLinkObject> {
		const result = await this._validateSingleCitationInternal(
			citation,
			contextFile,
		);

		let validation: ValidationMetadata;
		if (result.status === "valid") {
			validation = { status: "valid" };
		} else if (result.status === "warning") {
			validation = {
				status: "warning",
				message:
					result.error ?? result.suggestion ?? "Unknown validation warning",
				...(result.suggestion && { suggestion: result.suggestion }),
				...(result.pathConversion && { pathConversion: result.pathConversion }),
				...(result.anchorConversion && {
					anchorConversion: result.anchorConversion,
				}),
			};
		} else {
			validation = {
				status: "error",
				error: result.error ?? "Unknown validation error",
				...(result.suggestion && { suggestion: result.suggestion }),
				...(result.pathConversion && { pathConversion: result.pathConversion }),
				...(result.anchorConversion && {
					anchorConversion: result.anchorConversion,
				}),
			};
		}

		return enrichLinkObject(citation, validation);
	}

	// ── Pattern classification ────────────────────────────────────────────────

	private classifyPattern(citation: LinkObject): string {
		if (citation.scope === "internal" && citation.anchorType === "block") {
			return "CARET_SYNTAX";
		}

		if (citation.linkType === "wiki") {
			if (citation.scope === "internal") {
				return "WIKI_STYLE";
			}
			return "CROSS_DOCUMENT";
		}

		if (citation.scope === "cross-document") {
			if (
				citation.target.anchor?.startsWith("==**") &&
				citation.target.anchor.endsWith("**==")
			) {
				return "EMPHASIS_MARKED";
			}
			return "CROSS_DOCUMENT";
		}

		if (
			citation.linkType === "markdown" &&
			citation.scope === "internal" &&
			citation.anchorType === "header"
		) {
			return "INTERNAL_ANCHOR";
		}

		return "UNKNOWN_PATTERN";
	}

	// ── Internal dispatch ─────────────────────────────────────────────────────

	private async _validateSingleCitationInternal(
		citation: LinkObject,
		contextFile?: string,
	): Promise<SingleCitationValidationResult> {
		const patternType = this.classifyPattern(citation);

		switch (patternType) {
			case "CARET_SYNTAX":
				return this.validateCaretPattern(citation);
			case "EMPHASIS_MARKED":
				return this.validateEmphasisPattern(citation);
			case "CROSS_DOCUMENT":
				return await this.validateCrossDocumentLink(citation, contextFile);
			case "WIKI_STYLE":
				return this.validateWikiStyleLink(citation);
			case "INTERNAL_ANCHOR":
				return await this.validateInternalAnchorLink(citation, contextFile);
			default:
				return this.createValidationResult(
					citation,
					"error",
					"Unknown citation pattern",
					"Use one of: cross-document [text](file.md#anchor), caret ^FR1, or wiki-style [[#anchor|text]]",
				);
		}
	}

	// ── Pattern validators ────────────────────────────────────────────────────

	private validateCaretPattern(
		citation: LinkObject,
	): SingleCitationValidationResult {
		const anchor = citation.target.anchor || citation.fullMatch.substring(1);
		const anchorToTest = anchor.startsWith("^") ? anchor : `^${anchor}`;

		if (CARET_SYNTAX_REGEX.test(anchorToTest)) {
			return this.createValidationResult(citation, "valid");
		}
		return this.createValidationResult(
			citation,
			"error",
			`Invalid caret pattern: ${anchorToTest}`,
			`Use format: ${CARET_SYNTAX_EXAMPLES.join(", ")}`,
		);
	}

	private validateEmphasisPattern(
		citation: LinkObject,
	): SingleCitationValidationResult {
		const anchor = citation.target.anchor ?? "";

		if (EMPHASIS_MARKED_REGEX.test(anchor)) {
			return this.createValidationResult(citation, "valid");
		}
		if (anchor.includes("==") && anchor.includes("**")) {
			if (!anchor.startsWith("==**") || !anchor.endsWith("**==")) {
				return this.createValidationResult(
					citation,
					"error",
					"Malformed emphasis anchor - incorrect marker placement",
					`Use format: ==**ComponentName**== (found: ${anchor})`,
				);
			}
		} else {
			return this.createValidationResult(
				citation,
				"error",
				"Malformed emphasis anchor - missing ** markers",
				`Use format: ==**ComponentName**== (found: ${anchor})`,
			);
		}

		return this.createValidationResult(
			citation,
			"error",
			"Invalid emphasis pattern",
			`Use format: ${EMPHASIS_MARKED_EXAMPLES.join(", ")}`,
		);
	}

	private async validateCrossDocumentLink(
		citation: LinkObject,
		sourceFile?: string,
	): Promise<SingleCitationValidationResult> {
		const outcome = this.pathResolver.resolveCitationPath(
			citation,
			sourceFile ?? "",
		);
		if (outcome.kind === "error") {
			return this.createValidationResult(
				citation,
				"error",
				outcome.error,
				outcome.suggestion ?? null,
			);
		}
		if (outcome.kind === "warning") {
			return this.createValidationResult(
				citation,
				"warning",
				outcome.error,
				outcome.suggestion ?? null,
			);
		}

		if (citation.target.anchor) {
			const anchor = await this.anchorMatcher.validateAnchorExists(
				citation.target.anchor,
				outcome.targetPath,
			);
			if (!anchor.valid) {
				const anchorError = `Anchor not found: #${citation.target.anchor}`;
				const prefix = outcome.anchorFailurePrefix ?? outcome.warning;
				const error = prefix ? `${prefix}. ${anchorError}` : anchorError;
				return this.createValidationResult(
					citation,
					outcome.anchorFailureStatus,
					error,
					anchor.suggestion ?? null,
					null,
					anchor.anchorConversion ?? null,
				);
			}
			if (anchor.matchedAs === "block-ref-missing-caret") {
				return this.createValidationResult(
					citation,
					"warning",
					null,
					anchor.suggestion ?? null,
				);
			}
		}

		if (outcome.warning) {
			return this.createValidationResult(
				citation,
				"warning",
				null,
				outcome.warning,
				outcome.pathConversion ?? null,
			);
		}
		return this.createValidationResult(citation, "valid");
	}

	private validateWikiStyleLink(
		citation: LinkObject,
	): SingleCitationValidationResult {
		return this.createValidationResult(citation, "valid");
	}

	private async validateInternalAnchorLink(
		citation: LinkObject,
		sourceFile?: string,
	): Promise<SingleCitationValidationResult> {
		if (!sourceFile) {
			return this.createValidationResult(
				citation,
				"error",
				"Cannot validate internal anchor without source file context",
			);
		}

		const anchor = citation.target.anchor;
		if (!anchor) {
			return this.createValidationResult(
				citation,
				"error",
				"Internal anchor link missing anchor fragment",
			);
		}

		const anchorExists = await this.anchorMatcher.validateAnchorExists(
			anchor,
			sourceFile,
		);
		if (!anchorExists.valid) {
			return this.createValidationResult(
				citation,
				"error",
				`Anchor not found: #${anchor}`,
				anchorExists.suggestion,
				null,
				anchorExists.anchorConversion ?? null,
			);
		}

		if (
			anchorExists.matchedAs === "block-ref-missing-caret" &&
			!citation.fullMatch.startsWith("^")
		) {
			return this.createValidationResult(
				citation,
				"warning",
				null,
				anchorExists.suggestion,
				null,
				anchorExists.anchorConversion ?? null,
			);
		}

		return this.createValidationResult(citation, "valid");
	}

	// ── Result builder ────────────────────────────────────────────────────────

	private createValidationResult(
		citation: LinkObject,
		status: "valid" | "error" | "warning",
		error: string | null = null,
		message: string | null = null,
		suggestion: PathConversion | null = null,
		anchorConversion: AnchorConversion | null = null,
	): SingleCitationValidationResult {
		const result: SingleCitationValidationResult = {
			line: citation.line,
			citation: citation.fullMatch,
			status,
			linkType: citation.linkType,
			scope: citation.scope,
		};

		if (error) {
			result.error = error;
		}
		if (message) {
			result.suggestion = message;
		}
		if (suggestion) {
			result.pathConversion = suggestion;
		}
		if (anchorConversion) {
			result.anchorConversion = anchorConversion;
		}

		return result;
	}
}
