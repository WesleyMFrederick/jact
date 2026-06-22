/**
 * Purpose: jact citation syntax `[cite: path]` as a micromark extension.
 * Responsibilities: Tokenize `[cite: ...]` and emit a `citation` mdast node
 *   whose `value` is the trimmed citation path. Non-matching `[` falls through
 *   to the core link construct (this construct noks fast).
 * Boundary: Tokenization only — path resolution/validation stays in the adapter.
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

// Character codes for the literal prefix `[cite:`.
const PREFIX = [
	codes.leftSquareBracket,
	codes.lowercaseC,
	codes.lowercaseI,
	codes.lowercaseT,
	codes.lowercaseE,
	codes.colon,
];

const tokenize: Tokenizer = function (this: TokenizeContext, effects, ok, nok) {
	let index = 0;

	const start: State = (code) => {
		effects.enter("citation");
		effects.enter("citationData");
		return prefix(code);
	};

	const prefix: State = (code) => {
		if (code === PREFIX[index]) {
			effects.consume(code);
			index += 1;
			return index === PREFIX.length ? content : prefix;
		}
		return nok(code);
	};

	const content: State = (code) => {
		if (code === codes.eof || code === codes.lineFeed) return nok(code);
		if (code === codes.rightSquareBracket) {
			effects.consume(code);
			effects.exit("citationData");
			effects.exit("citation");
			return ok;
		}
		effects.consume(code);
		return content;
	};

	return start;
};

const citationConstruct: Construct = { name: "citation", tokenize };

export const citationSyntax: Extension = {
	text: { [codes.leftSquareBracket]: citationConstruct },
};

export const citationFromMarkdown: MdastExtension = {
	enter: {
		citation(token) {
			this.enter({ type: "citation", value: "" }, token);
		},
	},
	exit: {
		citation(token) {
			const raw = this.sliceSerialize(token); // "[cite: path]"
			const node = this.stack[this.stack.length - 1];
			if (node && "value" in node) {
				// Strip leading "[cite:" and trailing "]", then trim.
				node.value = raw.slice(PREFIX.length, raw.length - 1).trim();
			}
			this.exit(token);
		},
	},
};
