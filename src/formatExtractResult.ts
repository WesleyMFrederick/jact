import type { OutgoingLinksExtractedContent } from "./types/contentExtractorTypes.js";

/**
 * Formats an extraction result as either JSON or raw markdown.
 *
 * D-002: Shared formatter to avoid triple duplication across extract commands.
 *
 * @param result - The extraction result containing content blocks and metadata.
 * @param format - Output format: "json" for full JSON, "markdown" for raw content.
 * @returns Formatted string for stdout output.
 */
export function formatExtractResult(
	result: OutgoingLinksExtractedContent,
	format: "markdown" | "json",
	mode: "minimal" | "verbose" = "minimal",
): string {
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
					return block.content;
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
