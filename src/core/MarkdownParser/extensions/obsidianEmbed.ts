/**
 * Obsidian embeds `![[target#anchor|alias]]` start at a raw `!`.
 * CommonMark resolves overlapping images first. Only unresolved raw candidates
 * become embeds; escaped punctuation and code remain with CommonMark.
 */
import type {
	CompileContext,
	Extension as MdastExtension,
} from "mdast-util-from-markdown";
import { labelEnd, labelStartImage } from "micromark-core-commonmark";
import { markdownLineEnding } from "micromark-util-character";
import { codes } from "micromark-util-symbol";
import type {
	Construct,
	Event,
	Extension,
	Point,
	Resolver,
	State,
	TokenizeContext,
	Token,
	Tokenizer,
} from "micromark-util-types";

const tokenizeCandidate: Tokenizer = function (this: TokenizeContext, effects, ok, nok) {
	let sawContent = false;

	const start: State = (code) => {
		if (code !== codes.exclamationMark) return nok(code);
		effects.enter("obsidianEmbed");
		effects.consume(code);
		return open1;
	};

	const open1: State = (code) => {
		if (code !== codes.leftSquareBracket) return nok(code);
		effects.consume(code);
		return open2;
	};

	const open2: State = (code) => {
		if (code !== codes.leftSquareBracket) return nok(code);
		effects.consume(code);
		return content;
	};

	const content: State = (code) => {
		if (code === codes.eof || markdownLineEnding(code)) return nok(code);
		if (code === codes.rightSquareBracket) {
			if (!sawContent) return nok(code);
			effects.consume(code);
			return close2;
		}
		effects.consume(code);
		sawContent = true;
		return content;
	};

	const close2: State = (code) => {
		if (code !== codes.rightSquareBracket) return nok(code);
		effects.consume(code);
		effects.exit("obsidianEmbed");
		return ok;
	};

	return start;
};

const tokenize: Tokenizer = function (this: TokenizeContext, effects, ok, nok) {
	let candidateEnd: Point;
	const candidate: Construct = {
		partial: true,
		tokenize(effects, checked, rejected) {
			return tokenizeCandidate.call(
				this,
				effects,
				(code) => {
					candidateEnd = this.now();
					return checked(code);
				},
				rejected,
			);
		},
	};

	const markCandidate: State = (code) => {
		// labelStartImage ends with the exit event for its `![` opener.
		const opener = this.events[this.events.length - 1]![1];
		opener._obsidianEmbedEnd = candidateEnd;
		return ok(code);
	};

	const startImage: State = (code) =>
		labelStartImage.tokenize.call(this, effects, markCandidate, nok)(code);

	return effects.check(candidate, startImage, nok);
};

const resolveEmbeds: Resolver = (events) => {
	// Resolved images have already replaced their opener. Candidates survive
	// on unresolved opener tokens or their CommonMark cleanup data.
	let resolved: Event[] | undefined;
	let index = 0;
	while (index < events.length) {
		const event = events[index]!;
		const candidateEnd = event[1]._obsidianEmbedEnd;
		if (event[0] !== "enter" || !candidateEnd) {
			resolved?.push(event);
			index++;
			continue;
		}

		resolved ??= events.slice(0, index);
		const embed: Token = {
			type: "obsidianEmbed",
			start: event[1].start,
			end: candidateEnd,
		};
		resolved.push(["enter", embed, event[2]]);

		// Keep parsed events for image-caption decoding. Consume candidate
		// metadata once, so later span resolvers cannot wrap the body again.
		while (index < events.length) {
			const current = events[index]!;
			const token = current[1];
			if (token.start.offset >= candidateEnd.offset) break;
			delete token._obsidianEmbedEnd;
			if (token.end.offset > candidateEnd.offset) {
				// Do not split formatting, escapes, or code for image captions.
				// Outside images, the compiler emits this trailing source after
				// discarding the buffered body of the literal embed.
				embed._obsidianEmbedTail = {
					type: "data",
					start: candidateEnd,
					end: token.end,
				};
				while (index < events.length) {
					const closing = events[index++]!;
					delete closing[1]._obsidianEmbedEnd;
					resolved.push(closing);
					if (closing[0] === "exit" && closing[1] === token) break;
				}
				break;
			}
			resolved.push(current);
			index++;
		}
		resolved.push(["exit", embed, event[2]]);
	}
	// subtokenize retains this array before tokenizer.write(), so replacing
	// only the tokenizer's array would leave its caller with the old events.
	if (resolved) {
		for (let outputIndex = 0; outputIndex < resolved.length; outputIndex++) {
			events[outputIndex] = resolved[outputIndex]!;
		}
		events.length = resolved.length;
	}
	return events;
};

const obsidianEmbedConstruct: Construct = {
	name: "obsidianEmbed",
	tokenize,
	resolveAll: resolveEmbeds,
};

export const obsidianEmbedSyntax: Extension = {
	text: { [codes.exclamationMark]: obsidianEmbedConstruct },
	// Resolve candidates inside media labels before attention/text can merge
	// their opener data with adjacent text.
	insideSpan: { null: [labelEnd, obsidianEmbedConstruct] },
};

function inImageCaption(context: CompileContext): boolean {
	for (let index = context.stack.length - 1; index >= 0; index--) {
		const type = context.stack[index]!.type;
		if (type === "image" || type === "imageReference") return true;
	}
	return false;
}

export const obsidianEmbedFromMarkdown: MdastExtension = {
	enter: {
		obsidianEmbed(token) {
			if (inImageCaption(this)) return;
			this.enter({ type: "obsidianEmbed", value: "" }, token);
			// Retained CommonMark children serve captions only. Buffer and
			// discard them here so the active embed remains a raw literal.
			this.buffer();
		},
	},
	exit: {
		obsidianEmbed(token) {
			if (inImageCaption(this)) return;
			// Discard the fragment without flattening its unused text.
			this.stack.pop();
			const raw = this.sliceSerialize(token);
			const node = this.stack[this.stack.length - 1];
			if (node && "value" in node) {
				node.value = raw.slice(3, -2);
			}
			this.exit(token);
			const tail = token._obsidianEmbedTail;
			if (tail) {
				this.config.enter["data"]!.call(this, tail);
				this.config.exit["data"]!.call(this, tail);
			}
		},
	},
};
