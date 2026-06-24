/**
 * Purpose: Obsidian wikilink syntax `[[target#anchor|alias]]` as a micromark extension.
 * Responsibilities: Tokenize the 10 `[[…]]` forms previously matched by WIKI_REGEX
 *   and emit a `wikilink` mdast node whose `value` is the raw inner text
 *   (`target#anchor|alias`, any part optional). Parsing of inner parts stays in
 *   the extractor (parse-don't-validate boundary).
 * Boundary: Tokenization only. Registered on the `text` construct, so `[[…]]`
 *   inside a code span or fenced block is never tokenized — micromark handles code
 *   context natively, which is why the hand-rolled code-guard layer can retire (D4).
 *   Inner content may not contain `]` (matches the prior WIKI_REGEX character class).
 */

import type { Extension as MdastExtension } from "mdast-util-from-markdown";
import { codes } from "micromark-util-symbol";
import type {
	Construct,
	Extension,
	State,
	TokenizeContext,
	Tokenizer,
} from "micromark-util-types";

const tokenize: Tokenizer = function (this: TokenizeContext, effects, ok, nok) {
	const start: State = (code) => {
		if (code !== codes.leftSquareBracket) return nok(code);
		effects.enter("wikilink");
		effects.enter("wikilinkData");
		effects.consume(code);
		return open2;
	};

	// Second opening bracket: `[[`
	const open2: State = (code) => {
		if (code !== codes.leftSquareBracket) return nok(code);
		effects.consume(code);
		return content;
	};

	const content: State = (code) => {
		if (code === codes.eof || code === codes.lineFeed) return nok(code);
		if (code === codes.rightSquareBracket) return close1(code);
		effects.consume(code);
		return content;
	};

	// First closing bracket of `]]`.
	const close1: State = (code) => {
		effects.consume(code);
		return close2;
	};

	// Second closing bracket: complete the token.
	const close2: State = (code) => {
		if (code !== codes.rightSquareBracket) return nok(code);
		effects.consume(code);
		effects.exit("wikilinkData");
		effects.exit("wikilink");
		return ok;
	};

	return start;
};

const wikilinkConstruct: Construct = { name: "wikilink", tokenize };

/** micromark syntax extension for Obsidian wikilinks. */
export const wikilinkSyntax: Extension = {
	text: { [codes.leftSquareBracket]: wikilinkConstruct },
};

/** mdast-util-from-markdown extension producing `wikilink` nodes. */
export const wikilinkFromMarkdown: MdastExtension = {
	enter: {
		wikilink(token) {
			this.enter({ type: "wikilink", value: "" }, token);
		},
	},
	exit: {
		wikilink(token) {
			const raw = this.sliceSerialize(token); // "[[inner]]"
			const node = this.stack[this.stack.length - 1];
			if (node && "value" in node) {
				// Strip the leading "[[" and trailing "]]".
				node.value = raw.slice(2, raw.length - 2);
			}
			this.exit(token);
		},
	},
};
