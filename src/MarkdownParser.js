import { marked } from "marked";
import { dirname, isAbsolute, resolve, relative } from "node:path";

export class MarkdownParser {
	constructor(fileSystem) {
		this.fs = fileSystem;
		this.currentSourcePath = null; // Store current file being parsed
		this.anchorPatterns = {
			CARET: /\^([A-Za-z0-9-]+)/g,
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
		this.currentSourcePath = filePath; // Store for use in extractLinks()
		const content = this.fs.readFileSync(filePath, "utf8");
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
		const sourceAbsolutePath = this.currentSourcePath;

		lines.forEach((line, index) => {
			// Cross-document markdown links with .md extension (with optional anchors)
			const linkPattern = /\[([^\]]+)\]\(([^)#]+\.md)(#([^)]+))?\)/g;
			let match = linkPattern.exec(line);
			while (match !== null) {
				const text = match[1];
				const rawPath = match[2];
				const anchor = match[4] || null;

				const linkType = "markdown";
				const scope = "cross-document";
				const anchorType = anchor ? this.determineAnchorType(anchor) : null;

				const absolutePath = this.resolvePath(rawPath, sourceAbsolutePath);
				const relativePath = absolutePath
					? relative(dirname(sourceAbsolutePath), absolutePath)
					: null;

				links.push({
					linkType: linkType,
					scope: scope,
					anchorType: anchorType,
					source: {
						path: {
							absolute: sourceAbsolutePath,
						},
					},
					target: {
						path: {
							raw: rawPath,
							absolute: absolutePath,
							relative: relativePath,
						},
						anchor: anchor,
					},
					text: text,
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
				const rawPath = match[1].trim();
				const text = `cite: ${rawPath}`;

				const linkType = "markdown";
				const scope = "cross-document";
				const anchorType = null;

				const absolutePath = this.resolvePath(rawPath, sourceAbsolutePath);
				const relativePath = absolutePath
					? relative(dirname(sourceAbsolutePath), absolutePath)
					: null;

				links.push({
					linkType: linkType,
					scope: scope,
					anchorType: anchorType,
					source: {
						path: {
							absolute: sourceAbsolutePath,
						},
					},
					target: {
						path: {
							raw: rawPath,
							absolute: absolutePath,
							relative: relativePath,
						},
						anchor: null,
					},
					text: text,
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
				const filepath = match[2];
				if (
					!filepath.endsWith(".md") &&
					!filepath.startsWith("http") &&
					filepath.includes("/")
				) {
					const text = match[1];
					const rawPath = match[2];
					const anchor = match[3] ? match[3].substring(1) : null;

					const linkType = "markdown";
					const scope = "cross-document";
					const anchorType = anchor ? this.determineAnchorType(anchor) : null;

					const absolutePath = this.resolvePath(rawPath, sourceAbsolutePath);
					const relativePath = absolutePath
						? relative(dirname(sourceAbsolutePath), absolutePath)
						: null;

					links.push({
						linkType: linkType,
						scope: scope,
						anchorType: anchorType,
						source: {
							path: {
								absolute: sourceAbsolutePath,
							},
						},
						target: {
							path: {
								raw: rawPath,
								absolute: absolutePath,
								relative: relativePath,
							},
							anchor: anchor,
						},
						text: text,
						fullMatch: match[0],
						line: index + 1,
						column: match.index,
					});
				}
				match = relativeDocRegex.exec(line);
			}

			// Wiki-style cross-document links: [[file.md#anchor|text]]
			const wikiCrossDocRegex = /\[\[([^#\]]+\.md)(#([^\]|]+))?\|([^\]]+)\]\]/g;
			match = wikiCrossDocRegex.exec(line);
			while (match !== null) {
				const rawPath = match[1];
				const anchor = match[3] || null;
				const text = match[4];

				const linkType = "wiki";
				const scope = "cross-document";
				const anchorType = anchor ? this.determineAnchorType(anchor) : null;

				const absolutePath = this.resolvePath(rawPath, sourceAbsolutePath);
				const relativePath = absolutePath
					? relative(dirname(sourceAbsolutePath), absolutePath)
					: null;

				links.push({
					linkType: linkType,
					scope: scope,
					anchorType: anchorType,
					source: {
						path: {
							absolute: sourceAbsolutePath,
						},
					},
					target: {
						path: {
							raw: rawPath,
							absolute: absolutePath,
							relative: relativePath,
						},
						anchor: anchor,
					},
					text: text,
					fullMatch: match[0],
					line: index + 1,
					column: match.index,
				});
				match = wikiCrossDocRegex.exec(line);
			}

			// Wiki-style links (internal anchors only)
			const wikiRegex = /\[\[#([^|]+)\|([^\]]+)\]\]/g;
			match = wikiRegex.exec(line);
			while (match !== null) {
				const anchor = match[1];
				const text = match[2];

				const linkType = "wiki";
				const scope = "internal";
				const anchorType = this.determineAnchorType(anchor);

				links.push({
					linkType: linkType,
					scope: scope,
					anchorType: anchorType,
					source: {
						path: {
							absolute: sourceAbsolutePath,
						},
					},
					target: {
						path: {
							raw: null,
							absolute: null,
							relative: null,
						},
						anchor: anchor,
					},
					text: text,
					fullMatch: match[0],
					line: index + 1,
					column: match.index,
				});
				match = wikiRegex.exec(line);
			}

			// Caret syntax references (internal references)
			const caretRegex = /\^([A-Za-z0-9-]+)/g;
			match = caretRegex.exec(line);
			while (match !== null) {
				const anchor = match[1];

				const linkType = "markdown";
				const scope = "internal";
				const anchorType = "block";

				links.push({
					linkType: linkType,
					scope: scope,
					anchorType: anchorType,
					source: {
						path: {
							absolute: sourceAbsolutePath,
						},
					},
					target: {
						path: {
							raw: null,
							absolute: null,
							relative: null,
						},
						anchor: anchor,
					},
					text: null,
					fullMatch: match[0],
					line: index + 1,
					column: match.index,
				});
				match = caretRegex.exec(line);
			}
		});

		return links;
	}

	// Helper method to determine anchor type from anchor string
	determineAnchorType(anchorString) {
		if (!anchorString) return null;

		// Block references start with ^ or match ^alphanumeric pattern
		if (
			anchorString.startsWith("^") ||
			/^\^[a-zA-Z0-9\-_]+$/.test(anchorString)
		) {
			return "block";
		}

		// Everything else is a header reference
		return "header";
	}

	// Helper method to resolve relative paths to absolute paths
	resolvePath(rawPath, sourceAbsolutePath) {
		if (!rawPath || !sourceAbsolutePath) return null;

		if (isAbsolute(rawPath)) {
			return rawPath;
		}

		const sourceDir = dirname(sourceAbsolutePath);
		return resolve(sourceDir, rawPath);
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
					anchorType: "block",
					id: obsidianMatch[1],
					rawText: null,
					fullMatch: obsidianMatch[0],
					line: index + 1,
					column: line.lastIndexOf(obsidianMatch[0]),
				});
			}

			// Caret syntax anchors (legacy format, keep for compatibility)
			const caretRegex = /\^([A-Za-z0-9-]+)/g;
			match = caretRegex.exec(line);
			while (match !== null) {
				// Skip if this is already captured as an Obsidian block reference
				const isObsidianBlock = line.endsWith(match[0]);
				if (!isObsidianBlock) {
					anchors.push({
						anchorType: "block",
						id: match[1],
						rawText: null,
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
					anchorType: "block",
					id: `==**${match[1]}**==`,
					rawText: match[1],
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
						anchorType: "header",
						id: explicitMatch[2],
						rawText: explicitMatch[1].trim(),
						fullMatch: headerMatch[0],
						line: index + 1,
						column: 0,
					});
				} else {
					// Always use raw text as anchor for all headers
					anchors.push({
						anchorType: "header",
						id: headerText,
						rawText: headerText,
						fullMatch: headerMatch[0],
						line: index + 1,
						column: 0,
					});

					// Also add Obsidian-compatible anchor (drops colons, URL-encodes spaces)
					const obsidianAnchor = headerText
						.replace(/:/g, "") // Remove colons
						.replace(/\s+/g, "%20"); // URL-encode spaces

					if (obsidianAnchor !== headerText) {
						anchors.push({
							anchorType: "header",
							id: obsidianAnchor,
							rawText: headerText,
							fullMatch: headerMatch[0],
							line: index + 1,
							column: 0,
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
