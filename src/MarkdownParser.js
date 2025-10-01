import { readFileSync } from "node:fs";
import { marked } from "marked";

export class MarkdownParser {
	constructor() {
		this.anchorPatterns = {
			CARET: /\^([A-Z0-9-]+)/g,
			OBSIDIAN_BLOCK_REF: /\^([a-zA-Z0-9\-_]+)$/g, // End-of-line block references
			EMPHASIS_MARKED: /==\*\*([^*]+)\*\*==/g,
			STANDARD_HEADER: /^#+\s+(.+)$/gm,
			WIKI_STYLE: /\[\[#([^|]+)\|([^\]]+)\]\]/g,
		};

		this.linkPatterns = {
			CROSS_DOCUMENT: /\[([^\]]+)\]\(([^)]+\.md)(#[^)]+)?\)/g,
			EMPHASIS_COMPONENT: /#==\*\*[^*]+\*\*==/g,
			URL_ENCODED: /%20|%5B|%5D/g,
		};
	}

	async parseFile(filePath) {
		const content = readFileSync(filePath, "utf8");
		const tokens = marked.lexer(content);

		return {
			filePath,
			content,
			tokens,
			links: this.extractLinks(content),
			headings: this.extractHeadings(tokens),
			anchors: this.extractAnchors(content),
		};
	}

	extractLinks(content) {
		const links = [];
		const lines = content.split("\n");

		lines.forEach((line, index) => {
			// Cross-document links with .md extension (with optional anchors)
			const linkPattern = /\[([^\]]+)\]\(([^)#]+\.md)(#([^)]+))?\)/g;
			let match = linkPattern.exec(line);
			while (match !== null) {
				const text = match[1];
				const file = match[2];
				const anchor = match[4] || null; // match[4] is the anchor without #

				links.push({
					type: "cross-document",
					text: text,
					file: file,
					anchor: anchor,
					fullMatch: match[0],
					line: index + 1,
					column: match.index,
				});
				match = linkPattern.exec(line);
			}

			// Citation format: [cite: path]
			const citePattern = /\[cite:\s*([^\]]+)\]/g;
			match = citePattern.exec(line);
			while (match !== null) {
				const file = match[1].trim();

				links.push({
					type: "cross-document",
					text: `cite: ${file}`,
					file: file,
					anchor: null,
					fullMatch: match[0],
					line: index + 1,
					column: match.index,
				});
				match = citePattern.exec(line);
			}

			// Cross-document links without .md extension (relative paths)
			const relativeDocRegex = /\[([^\]]+)\]\(([^)]*\/[^)#]+)(#[^)]+)?\)/g;
			match = relativeDocRegex.exec(line);
			while (match !== null) {
				// Skip if already caught by .md regex or if it's a web URL
				const filepath = match[2];
				if (
					!filepath.endsWith(".md") &&
					!filepath.startsWith("http") &&
					filepath.includes("/")
				) {
					links.push({
						type: "cross-document",
						text: match[1],
						file: match[2],
						anchor: match[3] ? match[3].substring(1) : null, // Remove #
						fullMatch: match[0],
						line: index + 1,
						column: match.index,
					});
				}
				match = relativeDocRegex.exec(line);
			}

			// Wiki-style links
			const wikiRegex = /\[\[#([^|]+)\|([^\]]+)\]\]/g;
			match = wikiRegex.exec(line);
			while (match !== null) {
				links.push({
					type: "wiki-style",
					anchor: match[1],
					text: match[2],
					fullMatch: match[0],
					line: index + 1,
					column: match.index,
				});
				match = wikiRegex.exec(line);
			}

			// Caret syntax references
			const caretRegex = /\^([A-Z0-9-]+)/g;
			match = caretRegex.exec(line);
			while (match !== null) {
				links.push({
					type: "caret-reference",
					anchor: match[1],
					fullMatch: match[0],
					line: index + 1,
					column: match.index,
				});
				match = caretRegex.exec(line);
			}
		});

		return links;
	}

	extractHeadings(tokens) {
		const headings = [];

		const extractFromTokens = (tokenList) => {
			tokenList.forEach((token) => {
				if (token.type === "heading") {
					headings.push({
						level: token.depth,
						text: token.text,
						raw: token.raw,
					});
				}

				// Recursively check nested tokens
				if (token.tokens) {
					extractFromTokens(token.tokens);
				}
			});
		};

		extractFromTokens(tokens);
		return headings;
	}

	extractAnchors(content) {
		const anchors = [];
		const lines = content.split("\n");

		lines.forEach((line, index) => {
			// Obsidian block references (end-of-line format: ^anchor-name)
			let match;
			const obsidianBlockRegex = /\^([a-zA-Z0-9\-_]+)$/;
			const obsidianMatch = line.match(obsidianBlockRegex);
			if (obsidianMatch) {
				anchors.push({
					type: "obsidian-block-ref",
					anchor: obsidianMatch[1],
					fullMatch: obsidianMatch[0],
					line: index + 1,
					column: line.lastIndexOf(obsidianMatch[0]),
				});
			}

			// Caret syntax anchors (legacy format, keep for compatibility)
			const caretRegex = /\^([A-Z0-9-]+)/g;
			match = caretRegex.exec(line);
			while (match !== null) {
				// Skip if this is already captured as an Obsidian block reference
				const isObsidianBlock = line.endsWith(match[0]);
				if (!isObsidianBlock) {
					anchors.push({
						type: "caret",
						anchor: match[1],
						fullMatch: match[0],
						line: index + 1,
						column: match.index,
					});
				}
				match = caretRegex.exec(line);
			}

			// Emphasis-marked anchors
			const emphasisRegex = /==\*\*([^*]+)\*\*==/g;
			match = emphasisRegex.exec(line);
			while (match !== null) {
				anchors.push({
					type: "emphasis-marked",
					anchor: `==**${match[1]}**==`,
					text: match[1],
					fullMatch: match[0],
					line: index + 1,
					column: match.index,
				});
				match = emphasisRegex.exec(line);
			}

			// Standard header anchors with explicit IDs or auto-generated kebab-case
			const headerRegex = /^(#+)\s+(.+)$/;
			const headerMatch = line.match(headerRegex);
			if (headerMatch) {
				const headerText = headerMatch[2];

				// Check for explicit anchor ID like {#anchor-id}
				const explicitAnchorRegex = /^(.+?)\s*\{#([^}]+)\}$/;
				const explicitMatch = headerText.match(explicitAnchorRegex);

				if (explicitMatch) {
					// Use explicit anchor ID
					anchors.push({
						type: "header-explicit",
						anchor: explicitMatch[2],
						text: explicitMatch[1].trim(),
						level: headerMatch[1].length,
						line: index + 1,
					});
				} else {
					// Always use raw text as anchor for all headers
					anchors.push({
						type: "header",
						anchor: headerText,
						text: headerText,
						rawText: headerText,
						level: headerMatch[1].length,
						line: index + 1,
					});

					// Also add Obsidian-compatible anchor (drops colons, URL-encodes spaces)
					const obsidianAnchor = headerText
						.replace(/:/g, "") // Remove colons
						.replace(/\s+/g, "%20"); // URL-encode spaces

					if (obsidianAnchor !== headerText) {
						anchors.push({
							type: "header-obsidian",
							anchor: obsidianAnchor,
							text: headerText,
							rawText: headerText,
							level: headerMatch[1].length,
							line: index + 1,
						});
					}
				}
			}
		});

		return anchors;
	}

	containsMarkdown(text) {
		// Check for common markdown patterns that would affect anchor generation
		const markdownPatterns = [
			/`[^`]+`/, // Backticks (code spans)
			/\*\*[^*]+\*\*/, // Bold text
			/\*[^*]+\*/, // Italic text
			/==([^=]+)==/, // Highlight markers
			/\[([^\]]+)\]\([^)]+\)/, // Links
		];

		return markdownPatterns.some((pattern) => pattern.test(text));
	}

	toKebabCase(text) {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, "") // Remove special chars except spaces and hyphens
			.replace(/\s+/g, "-") // Replace spaces with hyphens
			.replace(/-+/g, "-") // Replace multiple hyphens with single
			.replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
	}
}
