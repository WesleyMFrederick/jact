import path from "node:path";
import type {
	HeaderExtractionResult,
	LinkedContentSource,
	LinkedHeaderContextResult,
	OutgoingLinksExtractedContent,
} from "./types/extraction-types.js";
import { shellFileArgument, shellTextArgument } from "./shellArgument.js";
export interface FormatExtractOptions {
	lineNumbers?: boolean;
	/** Prefix each markdown block with `Source:` (and `Via:` for linked blocks) lines. */
	sourceLabels?: boolean;
}

interface BlockLocation {
	/** `path[:start-end]`, relative to cwd. */
	source: string;
	/** `path:line` of the link that pulled this block in; undefined for the root. */
	via: string | undefined;
	/** Command (or read instruction) that loads only this block. */
	load: string;
}

/** Where one block came from, using the first link that extracted it. */
function blockLocation(
	result: OutgoingLinksExtractedContent,
	contentId: string,
	content: string,
	startLine: number | undefined,
): BlockLocation | undefined {
	const entry = result.outgoingLinksReport.processedLinks.find(
		(link) => link.contentId === contentId,
	);
	const target = entry?.sourceLink.target.path.absolute;
	if (!entry || !target) return undefined;
	const targetPath = path.relative(process.cwd(), decodeURIComponent(target));
	const lineCount =
		content.split("\n").length - (content.endsWith("\n") ? 1 : 0);
	const lines =
		startLine === undefined
			? ""
			: lineCount <= 1
				? `:${startLine}`
				: `:${startLine}-${startLine + lineCount - 1}`;
	const via = entry.sourceLink.source.path.absolute;
	// Synthetic root links (extract file/header) have no real source line.
	const viaLabel =
		via &&
		entry.sourceLink.line > 0 &&
		path.resolve(via) !== path.resolve(decodeURIComponent(target))
			? `${path.relative(process.cwd(), via)}:${entry.sourceLink.line}`
			: undefined;
	const file = shellFileArgument(targetPath);
	const { anchorType } = entry.sourceLink;
	const { anchor } = entry.sourceLink.target;
	const load =
		anchorType === "header" && anchor
			? `jact extract header ${file} ${shellTextArgument(decodeURIComponent(anchor))}`
			: anchorType === null
				? `jact extract file ${file}`
				: `read ${targetPath}${lines}`;
	return { source: `${targetPath}${lines}`, via: viaLabel, load };
}

/** Inline-code span that survives backticks inside `text` (CommonMark §6.1). */
function inlineCode(text: string): string {
	return text.includes("`") ? `\`\` ${text} \`\`` : `\`${text}\``;
}

/** `Source:`/`Via:` header for one block. */
function blockSourceLabel(
	result: OutgoingLinksExtractedContent,
	contentId: string,
	content: string,
	startLine: number | undefined,
): string {
	const location = blockLocation(result, contentId, content, startLine);
	if (!location) return "Source: unknown";
	return location.via === undefined
		? `Source: ${location.source}`
		: `Source: ${location.source}\nVia: ${location.via}`;
}

/** Command (or read instruction) that loads only one block. */
function loadCommand(
	file: string,
	kind: "header" | "block" | "file",
	heading: string | undefined,
	lines: string,
): string {
	if (kind === "header" && heading)
		return `jact extract header ${shellFileArgument(file)} ${shellTextArgument(heading)}`;
	if (kind === "file") return `jact extract file ${shellFileArgument(file)}`;
	return `read ${file}${lines}`;
}

function linkedContentMapRows(result: LinkedHeaderContextResult): string[] {
	// Linked-context files are scope-relative; map commands must run from cwd.
	const fromCwd = (file: string) =>
		path.relative(process.cwd(), path.resolve(result.scope.path, file));
	return Object.entries(result.extractedContentBlocks).flatMap(
		([contentId, block]) => {
			if (typeof block === "number") return [];
			const via =
				contentId === result.root.contentId
					? undefined
					: result.outgoingLinks.find((link) => link.contentId === contentId);
			const { source } = block;
			const file = fromCwd(source.file);
			return [
				mapRow(
					formatLinkedSource({ ...source, file }),
					via && `${fromCwd(via.source.file)}:${via.source.line}`,
					block.content.length,
					loadCommand(
						file,
						source.kind,
						source.heading,
						`:${source.startLine}-${source.endLine}`,
					),
				),
			];
		},
	);
}

function mapRow(
	source: string,
	via: string | undefined,
	chars: number,
	load: string,
): string {
	return `| ${source} | ${via ?? "—"} | ${chars.toLocaleString("en-US")} | ${inlineCode(load)} |`;
}

/**
 * Replaces over-budget linked output with one row per block: where it lives,
 * its size, and the command that loads only that block. Header results keep
 * their backlinks and failures, which are short.
 */
export function formatContentMap(
	result: HeaderExtractionResult,
	fullLength: number,
	maxChars: number,
): string {
	const rows = isLinkedHeaderContextResult(result)
		? linkedContentMapRows(result)
		: Object.entries(result.extractedContentBlocks).flatMap(
				([contentId, block]) => {
					if (typeof block === "number") return [];
					const location = blockLocation(
						result,
						contentId,
						block.content,
						block.startLine,
					);
					return [
						location
							? mapRow(location.source, location.via, block.content.length, location.load)
							: `| unknown | — | ${block.content.length.toLocaleString("en-US")} | — |`,
					];
				},
			);
	const sections = [
		"# Content map",
		`Full output would be ${fullLength.toLocaleString("en-US")} characters, over the ${maxChars.toLocaleString("en-US")}-character limit, so jact lists the ${rows.length} blocks instead. Load only the ones you need.`,
		["| Source | Via | Chars | Load only this |", "|---|---|---:|---|", ...rows].join("\n"),
	];
	if (isLinkedHeaderContextResult(result)) {
		sections.push("## Backlinks to root", backlinksMarkdown(result));
		if (result.failures.length > 0) {
			sections.push("## Failures", failuresMarkdown(result));
		}
	}
	return sections.join("\n\n");
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
	sections.push(`## Linked content (depth ${result.depth})`);
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
		sections.push("## Failures", failuresMarkdown(result));
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

function failuresMarkdown(result: LinkedHeaderContextResult): string {
	return result.failures
		.map((failure) => {
			const location =
				failure.source === undefined
					? "linked context"
					: `${failure.source.file}:${failure.source.line}`;
			return `- ${location} — ${failure.reason}`;
		})
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
				.map(([contentId, block]) => {
					if (typeof block === "number") {
						return undefined;
					}
					let body = block.content;
					if (options.lineNumbers) {
						if (block.startLine === undefined) {
							throw new Error(
								"Cannot render line numbers: extracted content has no source start line.",
							);
						}
						body = formatSourceLines(block.content, block.startLine);
					}
					return options.sourceLabels
						? `${blockSourceLabel(result, contentId, block.content, block.startLine)}\n${body}`
						: body;
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
