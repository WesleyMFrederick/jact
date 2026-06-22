/**
 * Purpose: Shared factory for symmetric multi-character inline delimiters
 *   (e.g. Obsidian highlight `==text==`, comment `%%text%%`).
 * Responsibilities: Produce a micromark text construct + a mdast fromMarkdown
 *   extension for a single symmetric delimiter pair. Content is captured raw
 *   (no nested inline parsing) — jact reads values from `node.value` / position.
 * Boundary: This module owns ONLY delimiter tokenization. It does not resolve
 *   paths, validate, or know about LinkObject/AnchorObject. The adapter consumes
 *   the resulting mdast nodes.
 */

import type { Extension as MdastExtension } from "mdast-util-from-markdown";
import { markdownLineEnding } from "micromark-util-character";
import { codes } from "micromark-util-symbol";
import type {
	Construct,
	Extension,
	State,
	TokenizeContext,
	Tokenizer,
	TokenType,
} from "micromark-util-types";

/** Configuration for one symmetric-delimiter inline syntax. */
export interface WrappedInlineConfig {
	/** Character code of the delimiter (e.g. codes.equalsTo for `=`). */
	markerCode: number;
	/** Number of repeated marker chars that open/close (e.g. 2 for `==`). */
	runLength: number;
	/** mdast node type emitted (factory serves the symmetric Obsidian pairs). */
	nodeType: "highlight" | "obsidianComment";
	/** micromark token name (must be unique; e.g. "highlight"). */
	tokenName: TokenType;
	/** micromark token name for the raw inner content (e.g. "highlightData"). */
	dataTokenName: TokenType;
}

/**
 * Build a micromark syntax extension for a symmetric delimiter pair.
 * Single-line only: a line ending inside the run aborts the match (mirrors
 * Obsidian, which does not span highlights/comments across blank lines).
 */
export function wrappedInlineSyntax(config: WrappedInlineConfig): Extension {
	const { markerCode, runLength, tokenName, dataTokenName } = config;

	const tokenize: Tokenizer = function (
		this: TokenizeContext,
		effects,
		ok,
		nok,
	) {
		let opened = 0;
		let closing = 0;

		// micromark rule: `effects.consume` is only legal while a token is open
		// (the last event must be an `enter`). So we keep ONE data token open
		// across the whole content — including the closing run — and exit it only
		// once the run is complete. The fromMarkdown handler slices the delimiters
		// off by `runLength`, so it does not matter that the close markers land
		// inside the data span.
		const start: State = (code) => {
			effects.enter(tokenName);
			return openRun(code);
		};

		const openRun: State = (code) => {
			if (code === markerCode) {
				effects.consume(code);
				opened += 1;
				return opened === runLength ? afterOpen : openRun;
			}
			return nok(code);
		};

		const afterOpen: State = (code) => {
			if (code === codes.eof || markdownLineEnding(code)) return nok(code);
			effects.enter(dataTokenName);
			return inside(code);
		};

		const inside: State = (code) => {
			if (code === codes.eof || markdownLineEnding(code)) return nok(code);
			if (code === markerCode) {
				effects.consume(code);
				closing += 1;
				return closing === runLength ? done : inside;
			}
			closing = 0;
			effects.consume(code);
			return inside;
		};

		const done: State = (code) => {
			effects.exit(dataTokenName);
			effects.exit(tokenName);
			return ok(code);
		};

		return start;
	};

	const construct: Construct = { name: tokenName, tokenize };
	return { text: { [markerCode]: construct } };
}

/** Build the matching mdast fromMarkdown extension. */
export function wrappedInlineFromMarkdown(
	config: WrappedInlineConfig,
): MdastExtension {
	const { nodeType, runLength, tokenName } = config;
	return {
		enter: {
			[tokenName](token) {
				this.enter({ type: nodeType, value: "" }, token);
			},
		},
		exit: {
			[tokenName](token) {
				const raw = this.sliceSerialize(token);
				const node = this.stack[this.stack.length - 1];
				if (node && "value" in node) {
					node.value = raw.slice(runLength, raw.length - runLength);
				}
				this.exit(token);
			},
		},
	};
}
