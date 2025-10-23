// tools/citation-manager/src/core/ContentExtractor/ContentExtractor.js
import { analyzeEligibility } from "./analyzeEligibility.js";
import { extractLinksContent as extractLinksContentOp } from "./extractLinksContent.js";

/**
 * Content Extractor component orchestrating extraction eligibility analysis.
 * Component entry point following TitleCase naming convention.
 *
 * US2.1 Scope: Eligibility analysis only
 * US2.2 Scope: Add content retrieval, ParsedFileCache, CitationValidator dependencies
 */
export class ContentExtractor {
	/**
	 * Create ContentExtractor with eligibility strategies and dependencies.
	 *
	 * @param {ExtractionStrategy[]} eligibilityStrategies - Ordered strategy chain
	 * @param {ParsedFileCache} parsedFileCache - Cache for parsed documents
	 * @param {CitationValidator} citationValidator - Validator for citations
	 */
	constructor(eligibilityStrategies, parsedFileCache, citationValidator) {
		this.eligibilityStrategies = eligibilityStrategies;
		this.parsedFileCache = parsedFileCache;
		this.citationValidator = citationValidator;
	}

	/**
	 * Analyze link eligibility using strategy chain.
	 * Public method for determining which links should be extracted.
	 *
	 * @param {LinkObject} link - Link to analyze
	 * @param {Object} cliFlags - CLI flags
	 * @returns {{ eligible: boolean, reason: string }} Eligibility decision
	 */
	analyzeEligibility(link, cliFlags) {
		return analyzeEligibility(link, cliFlags, this.eligibilityStrategies);
	}

	/**
	 * Extract content from links in source file.
	 * Thin wrapper delegating to operation file.
	 *
	 * @param {string} sourceFilePath - Path to source file
	 * @param {Object} cliFlags - CLI flags
	 * @returns {Promise<ExtractionResult[]>} Array of extraction results
	 */
	async extractLinksContent(sourceFilePath, cliFlags) {
		// Delegate to operation function with dependencies
		return await extractLinksContentOp(sourceFilePath, cliFlags, {
			parsedFileCache: this.parsedFileCache,
			citationValidator: this.citationValidator,
			eligibilityStrategies: this.eligibilityStrategies,
		});
	}
}
