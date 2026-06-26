/**
 * Purpose: Obsidian permissive markdown links `[label](dest#anchor)` as a
 *   micromark extension, where the anchor may contain raw spaces, colons, and
 *   balanced parens that CommonMark rejects (a raw space terminates a link
 *   destination, so micromark never tokenizes these as `link` nodes).
 * Responsibilities: Tokenize the 3 forms previously matched by the permissive
 *   markdown-link regex fallback (cross-doc `.md`, internal `#`,
 *   relative no-`.md`) and emit an `obsidianLink` mdast node whose `value` is
 *   the raw matched text `[label](dest#anchor)`. Parsing of label/dest/anchor
 *   stays in the extractor (parse-don't-validate boundary, mirrors `wikilink`).
 * Boundary (D1): nok-fast so non-permissive links fall through to the core link
 *   construct and `[[…]]` falls through to wikilink. A link is claimed only when
 *   the destination carries BOTH a `#` fragment AND a raw space — the exact
 *   subset CommonMark cannot express, keeping this construct's claim disjoint
 *   from the core link/definition path (so titled/encoded links are untouched).
 *   Registered on the `text` construct, so a permissive link inside a code span
 *   or fenced block is never tokenized — micromark handles code context
 *   natively (which is why the hand-rolled code-guard layer can retire, D4).
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
	let parenDepth = 0;
	let sawSpaceInFragment = false;
	let sawHash = false;

	const start: State = (code) => {
		if (code !== codes.leftSquareBracket) return nok(code);
		effects.enter("obsidianLink");
		effects.enter("obsidianLinkData");
		effects.consume(code);
		return afterOpen;
	};

	// `[[` belongs to the wikilink construct — let it win.
	const afterOpen: State = (code) => {
		if (code === codes.leftSquareBracket) return nok(code);
		return label(code);
	};

	// Link label `[ … ]` (may not span lines or contain `]`).
	const label: State = (code) => {
		if (code === codes.eof || code === codes.lineFeed) return nok(code);
		if (code === codes.rightSquareBracket) {
			effects.consume(code);
			return expectParen;
		}
		effects.consume(code);
		return label;
	};

	const expectParen: State = (code) => {
		if (code !== codes.leftParenthesis) return nok(code);
		effects.consume(code);
		return dest;
	};

	// Destination + permissive anchor. Tracks paren nesting so a balanced `(…)`
	// inside the anchor does not prematurely close the link, and records whether
	// the CommonMark-breaking signals (`#` fragment + raw space) were present.
	const dest: State = (code) => {
		if (code === codes.eof || code === codes.lineFeed) return nok(code);
		if (code === codes.numberSign) {
			sawHash = true;
			effects.consume(code);
			return dest;
		}
		if (code === codes.leftParenthesis) {
			parenDepth += 1;
			effects.consume(code);
			return dest;
		}
		if (code === codes.rightParenthesis) {
			if (parenDepth > 0) {
				parenDepth -= 1;
				effects.consume(code);
				return dest;
			}
			// Closing the link. Only claim it when it is genuinely permissive;
			// otherwise nok so the core link construct handles it. "Permissive"
			// means a raw space *inside the `#` fragment* — a space in the path
			// (before `#`) does not qualify, so titled/spaced-path links fall
			// through to the core construct.
			if (!(sawHash && sawSpaceInFragment)) return nok(code);
			effects.consume(code);
			effects.exit("obsidianLinkData");
			effects.exit("obsidianLink");
			return ok;
		}
		if (code === codes.space) {
			// Only a space *after* the `#` makes this a permissive fragment.
			if (sawHash) sawSpaceInFragment = true;
			effects.consume(code);
			return dest;
		}
		effects.consume(code);
		return dest;
	};

	return start;
};

const obsidianLinkConstruct: Construct = { name: "obsidianLink", tokenize };

/** micromark syntax extension for Obsidian permissive markdown links. */
export const obsidianLinkSyntax: Extension = {
	text: { [codes.leftSquareBracket]: obsidianLinkConstruct },
};

/** mdast-util-from-markdown extension producing `obsidianLink` nodes. */
export const obsidianLinkFromMarkdown: MdastExtension = {
	enter: {
		obsidianLink(token) {
			this.enter({ type: "obsidianLink", value: "" }, token);
		},
	},
	exit: {
		obsidianLink(token) {
			const raw = this.sliceSerialize(token); // "[label](dest#anchor)"
			const node = this.stack[this.stack.length - 1];
			if (node && "value" in node) {
				node.value = raw;
			}
			this.exit(token);
		},
	},
};
