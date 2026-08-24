import type {
	HeaderExtractionResult,
	LinkedContentSource,
	LinkedHeaderContextResult,
} from "./types/extraction-types.js";
export interface FormatExtractOptions {
	lineNumbers?: boolean;
}

function formatSourceLines(content: string, startLine: number): string {
	if (content.length === 0) return content;

	const lines = content.split("\n");
	const hasTrailingNewline = content.endsWith("\n");
	if (hasTrailingNewline) lines.pop();

	const numbered = lines
		.map((line, index) => `${String(startLine + index).padStart(6)}\t${line}`)
		.join("\n");
	return hasTrailingNewline ? `${numbered}\n` : numbered;
}


function isLinkedHeaderContextResult(
	result: HeaderExtractionResult,
): result is LinkedHeaderContextResult {
	return "mode" in result && result.mode === "linked-context";
}
function formatLinkedSource(source: LinkedContentSource): string {
	const lines =
		source.startLine === source.endLine
			? String(source.startLine)
			: `${source.startLine}-${source.endLine}`;
	return `${source.file}:${lines}`;
}

function formatLinkedBlock(
	content: string,
	source: LinkedContentSource,
	options: FormatExtractOptions,
): string {
	return options.lineNumbers
		? formatSourceLines(content, source.startLine)
		: content;
}

function formatLinkedContext(
	result: LinkedHeaderContextResult,
	mode: "minimal" | "verbose",
	options: FormatExtractOptions,
): string {
	const ignorePolicy = result.scope.respectGitignore
		? "ignore rules respected"
		: "ignored paths included";
	const sections = [
		"# Header context",
		`Scope: ${result.scope.path} (${result.scope.filesScanned} Markdown files scanned; ${ignorePolicy})`,
		`Complete: ${result.complete ? "yes" : "no"}`,
	];
	const rootBlock = result.extractedContentBlocks[result.root.contentId];
	if (typeof rootBlock === "number" || rootBlock === undefined) {
		throw new Error(`Missing root content block: ${result.root.contentId}`);
	}
	sections.push(
		"## Root",
		`Source: ${formatLinkedSource(result.root.source)}`,
		formatLinkedBlock(rootBlock.content, rootBlock.source, options),
	);

	const linkedBlocks = Object.entries(result.extractedContentBlocks).filter(
		([contentId, block]) =>
			contentId !== "_totalContentCharacterLength" &&
			contentId !== result.root.contentId &&
			typeof block !== "number",
	);
	sections.push("## Direct linked content");
	if (linkedBlocks.length === 0) {
		sections.push("(none)");
	} else {
		sections.push(
			linkedBlocks
				.map(([contentId, block]) => {
					if (typeof block === "number") {
						throw new Error(`Invalid linked content block: ${contentId}`);
					}
					const via = result.outgoingLinks.find(
						(link) => link.contentId === contentId,
					);
					const viaLine =
						via === undefined
							? "unknown"
							: `${via.source.file}:${via.source.line}`;
					return [
						`Source: ${formatLinkedSource(block.source)}`,
						`Via: ${viaLine}`,
						formatLinkedBlock(block.content, block.source, options),
					].join("\n");
				})
				.join("\n\n---\n"),
		);
	}

	sections.push(
		"## Backlinks to root",
		backlinksMarkdown(result),
	);
	const notFollowed = result.outgoingLinks.filter(
		(link) => link.status === "not-followed",
	);
	if (notFollowed.length > 0) {
		sections.push(
			"## Direct links not followed",
			notFollowed
				.map(
					(link) =>
						`- ${link.source.file}:${link.source.line} — ${link.reason ?? "not followed"} — ${link.source.raw}`,
				)
				.join("\n"),
		);
	}
	if (result.failures.length > 0) {
		sections.push(
			"## Failures",
			result.failures
				.map((failure) => {
					const location =
						failure.source === undefined
							? "linked context"
							: `${failure.source.file}:${failure.source.line}`;
					return `- ${location} — ${failure.reason}`;
				})
				.join("\n"),
		);
	}
	if (mode === "verbose") {
		sections.push(
			"## Link resolution details",
			"```json\n" + JSON.stringify(result.outgoingLinks, null, 2) + "\n```",
			"## Stats",
			"```json\n" + JSON.stringify(result.stats, null, 2) + "\n```",
		);
	}
	return sections.join("\n\n");
}

function backlinksMarkdown(result: LinkedHeaderContextResult): string {
	if (result.backlinks.length === 0) return "(none)";
	return result.backlinks
		.map(
			(backlink) =>
				`- ${backlink.source.file}:${backlink.source.line} — ${backlink.source.raw}`,
		)
		.join("\n");
}


/**
 * Formats an extraction result as either JSON or raw markdown.
 *
 * D-002: Shared formatter to avoid triple duplication across extract commands.
 *
 * @param result - The extraction result containing content blocks and metadata.
 * @param format - Output format: "json" for full JSON, "markdown" for raw content.
 * @param options - Presentation options for markdown output.
 * @returns Formatted string for stdout output.
 */
export function formatExtractResult(
	result: HeaderExtractionResult,
	format: "markdown" | "json",
	mode: "minimal" | "verbose" = "minimal",
	options: FormatExtractOptions = {},
): string {
	if (isLinkedHeaderContextResult(result)) {
		if (format === "json") return JSON.stringify(result, null, 2);
		return formatLinkedContext(result, mode, options);
	}
	switch (format) {
		case "json": {
			const payload =
				mode === "verbose"
					? result
					: { extractedContentBlocks: result.extractedContentBlocks };
			return JSON.stringify(payload, null, 2);
		}

		case "markdown": {
			const contentEntries = Object.entries(result.extractedContentBlocks)
				.filter(([key]) => key !== "_totalContentCharacterLength")
				.map(([, block]) => {
					if (typeof block === "number") {
						return undefined;
					}
					if (!options.lineNumbers) return block.content;
					if (block.startLine === undefined) {
						throw new Error(
							"Cannot render line numbers: extracted content has no source start line.",
						);
					}
					return formatSourceLines(block.content, block.startLine);
				})
				.filter((content): content is string => content !== undefined);

			const content = contentEntries.join("\n---\n");
			if (mode === "minimal") return content;
			return `${content}\n\n---\n## Outgoing Links Report\n\n\`\`\`json\n${JSON.stringify(result.outgoingLinksReport, null, 2)}\n\`\`\`\n\n## Stats\n\n\`\`\`json\n${JSON.stringify(result.stats, null, 2)}\n\`\`\``;
		}

		default: {
			const _exhaustive: never = format;
			throw new Error(`Unsupported format: ${_exhaustive}`);
		}
	}
}
