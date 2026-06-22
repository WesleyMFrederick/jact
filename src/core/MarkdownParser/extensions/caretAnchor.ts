/**
 * Purpose: Obsidian block-reference anchor `^id` as a micromark extension.
 * Responsibilities: Tokenize `^<id>` (id = alphanumerics, `-`, `_`) and emit a
 *   `caretAnchor` mdast node whose `value` is the id (without the caret).
 * Boundary: Tokenization only — anchor classification stays in extractAnchors /
 *   the adapter.
 */

import type { Extension as MdastExtension } from "mdast-util-from-markdown";
import { asciiAlphanumeric } from "micromark-util-character";
import { codes } from "micromark-util-symbol";
import type {
	Code,
	Construct,
	Extension,
	State,
	TokenizeContext,
	Tokenizer,
} from "micromark-util-types";

function isIdChar(code: Code): boolean {
	return (
		asciiAlphanumeric(code) || code === codes.dash || code === codes.underscore
	);
}

const tokenize: Tokenizer = function (this: TokenizeContext, effects, ok, nok) {
	const start: State = (code) => {
		effects.enter("caretAnchor");
		effects.enter("caretAnchorData");
		effects.consume(code); // the caret
		return firstIdChar;
	};

	const firstIdChar: State = (code) => {
		if (!isIdChar(code)) return nok(code);
		effects.consume(code);
		return idRun;
	};

	const idRun: State = (code) => {
		if (isIdChar(code)) {
			effects.consume(code);
			return idRun;
		}
		effects.exit("caretAnchorData");
		effects.exit("caretAnchor");
		return ok(code);
	};

	return start;
};

const caretConstruct: Construct = { name: "caretAnchor", tokenize };

export const caretAnchorSyntax: Extension = {
	text: { [codes.caret]: caretConstruct },
};

export const caretAnchorFromMarkdown: MdastExtension = {
	enter: {
		caretAnchor(token) {
			this.enter({ type: "caretAnchor", value: "" }, token);
		},
	},
	exit: {
		caretAnchor(token) {
			const raw = this.sliceSerialize(token); // "^id"
			const node = this.stack[this.stack.length - 1];
			if (node && "value" in node) {
				node.value = raw.slice(1);
			}
			this.exit(token);
		},
	},
};
