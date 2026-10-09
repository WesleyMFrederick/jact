import { normalizeIdentifier } from "micromark-util-normalize-identifier";
import { visit } from "unist-util-visit";
import type {
	RuleEdit,
	RuleFinding,
	ValidationRule,
} from "../../../types/validationRuleTypes.js";
import type { EnrichedLinkObject } from "../../../types/validationTypes.js";
import { applyPathConversion } from "../../citationFixer.js";

export const NO_REFERENCE_NOTE_LINK_RULE = "obsidian/no-reference-note-link";

const MESSAGE =
	"Split-style link to a local file: Obsidian opens [text][label] links as web links, not notes. Use [text](path) instead.";

/** `scheme:` destinations (https:, obsidian:, file:) are not local files. */
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** The label as written in `[label]: dest`; `\]` may appear inside it. */
const RAW_DEFINITION_LABEL = /^\[((?:[^\\\]]|\\.)*)\]:/s;

/** The trailing `[label]` of a full reference; labels hold no unescaped brackets. */
const TRAILING_LABEL = /\[(?:[^\\[\]]|\\.)*\]$/s;

/**
 * The definition's destination and optional title as written, with the path
 * and anchor corrections jact's own `--fix` would apply folded in.
 */
function correctedTarget(definition: EnrichedLinkObject): string {
	const labelLength =
		RAW_DEFINITION_LABEL.exec(definition.fullMatch)?.[0].length ?? 0;
	const afterLabel = definition.fullMatch.slice(labelLength).trim();
	let destination = afterLabel.startsWith("<")
		? afterLabel.slice(0, afterLabel.indexOf(">") + 1)
		: (afterLabel.split(/\s/, 1)[0] ?? "");
	const title = afterLabel.slice(destination.length).trim();
	if (definition.validation.status !== "valid") {
		const { pathConversion, anchorConversion } = definition.validation;
		if (pathConversion) {
			destination = applyPathConversion(destination, pathConversion);
		}
		const hash = destination.indexOf("#");
		if (anchorConversion && hash !== -1) {
			const closer = destination.endsWith(">") ? ">" : "";
			destination = `${destination.slice(0, hash + 1)}${anchorConversion.recommended}${closer}`;
		}
	}
	return title === "" ? destination : `${destination} ${title}`;
}

/**
 * Obsidian resolves only inline `[text](path)` links to notes; a split-style
 * link (`[text][label]` + `[label]: path`) opens as a web URL. Each usage of a
 * local-file definition is an error; `--fix` inlines every link usage and
 * deletes the definition unless an image reference still needs it. Footnotes
 * (`[^label]`) are a separate Obsidian construct and are not checked.
 */
export const noReferenceNoteLink: ValidationRule = {
	id: NO_REFERENCE_NOTE_LINK_RULE,
	preset: "obsidian",
	check({ document, links }) {
		if (document.linkReferences.length === 0) return [];
		const imageIdentifiers = new Set<string>();
		visit(document.ast, "imageReference", (node) => {
			imageIdentifiers.add(normalizeIdentifier(node.identifier).toLowerCase());
		});
		const lineStarts = [0];
		for (let index = 0; index < document.content.length; index++) {
			if (document.content[index] === "\n") lineStarts.push(index + 1);
		}

		// CommonMark: the first definition of a label wins. Key by the raw label,
		// as mdast does for usages, so escapes and entities match.
		const definitions = new Map<string, EnrichedLinkObject>();
		for (const link of links) {
			if (link.markdownForm !== "definition") continue;
			const rawLabel = RAW_DEFINITION_LABEL.exec(link.fullMatch)?.[1];
			if (rawLabel === undefined) continue;
			const identifier = normalizeIdentifier(rawLabel).toLowerCase();
			if (!definitions.has(identifier)) definitions.set(identifier, link);
		}

		const findings: RuleFinding[] = [];
		for (const [identifier, definition] of definitions) {
			if (
				identifier.startsWith("^") ||
				definition.scope !== "cross-document" ||
				URL_SCHEME.test(definition.target.path.raw ?? "")
			) {
				continue;
			}
			const usages = document.linkReferences.filter(
				(usage) => usage.identifier === identifier,
			);
			if (usages.length === 0) continue;

			const target = correctedTarget(definition);
			const definitionStart =
				(lineStarts[definition.line - 1] ?? 0) + definition.column;
			let definitionEnd = definitionStart + definition.fullMatch.length;
			if (document.content[definitionEnd] === "\n") definitionEnd++;

			usages.forEach((usage, index) => {
				// Slice off the known suffix: the text may hold escaped brackets.
				const suffixLength =
					usage.referenceType === "full"
						? (TRAILING_LABEL.exec(usage.raw)?.[0].length ?? 0)
						: usage.referenceType === "collapsed"
							? 2
							: 0;
				const text = usage.raw.slice(1, usage.raw.length - suffixLength - 1);
				const edits: RuleEdit[] = [
					{
						start: usage.start,
						end: usage.end,
						replacement: `[${text}](${target})`,
					},
				];
				// Images keep their reference syntax and still need the definition.
				if (index === usages.length - 1 && !imageIdentifiers.has(identifier)) {
					edits.push({
						start: definitionStart,
						end: definitionEnd,
						replacement: "",
					});
				}
				findings.push({
					ruleId: NO_REFERENCE_NOTE_LINK_RULE,
					line: usage.line,
					column: usage.column,
					message: MESSAGE,
					source: usage.raw,
					edits,
				});
			});
		}
		return findings.sort((a, b) => a.line - b.line || a.column - b.column);
	},
};
