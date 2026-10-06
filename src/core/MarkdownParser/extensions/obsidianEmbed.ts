/**
 * Obsidian embeds `![[target#anchor|alias]]` start at a raw `!`.
 * CommonMark resolves overlapping images first. Only unresolved raw candidates
 * become embeds; escaped punctuation and code remain with CommonMark.
 */
import type { Extension as MdastExtension } from "mdast-util-from-markdown";
import { attention, labelEnd, labelStartImage } from "micromark-core-commonmark";
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

const protectCandidates: Resolver = (events) => {
	// Media labels resolve before their enclosing image is known. Keep raw
	// candidate starts separate from adjacent data until that decision is final.
	for (const [kind, token] of events) {
		if (kind === "enter" && token._obsidianEmbedEnd) {
			token.type = "obsidianEmbedCandidate";
		}
	}
	return events;
};

function replaceEvents(
	events: Event[],
	start: number,
	end: number,
	replacement: Event[],
): void {
	const length = events.length;
	const delta = replacement.length - (end - start);
	if (delta > 0) {
		for (let index = length - 1; index >= end; index--) {
			events[index + delta] = events[index]!;
		}
	} else if (delta < 0) {
		for (let index = end; index < length; index++) {
			events[index + delta] = events[index]!;
		}
	}
	for (let index = 0; index < replacement.length; index++) {
		events[start + index] = replacement[index]!;
	}
	events.length = length + delta;
}

function restoreAttention(events: Event[]): void {
	for (const [, token] of events) {
		if (token.type === "obsidianEmbedAttentionSequence") {
			token.type = "attentionSequence";
		}
	}
}

function resolveAttention(events: Event[], context: TokenizeContext): void {
	// Resolve the same label scopes as CommonMark, innermost first. Their
	// delimiters must not pair with delimiters outside the media label.
	const labels: number[] = [];
	for (let index = 0; index < events.length; index++) {
		const [kind, token] = events[index]!;
		if (token.type !== "labelText") continue;
		if (kind === "enter") {
			labels.push(index);
		} else {
			const start = labels.pop()! + 1;
			const content = events.slice(start, index);
			restoreAttention(content);
			const resolved = attention.resolveAll!(content, context);
			replaceEvents(events, start, index, resolved);
			index = start + resolved.length;
		}
	}
	restoreAttention(events);
	attention.resolveAll!(events, context);
}

const resolveEmbeds: Resolver = (events, context) => {
	// All media now have their final ownership. Clean unresolved label markers
	// before replacing active candidates, regardless of delimiter encounter order.
	labelEnd.resolveAll!(events, context);
	let resolved: Event[] | undefined;
	let imageDepth = 0;
	let hasAttention = false;
	let index = 0;
	while (index < events.length) {
		const event = events[index]!;
		const token = event[1];
		if (token.type === "image") {
			imageDepth += event[0] === "enter" ? 1 : -1;
		}
		const candidateEnd = token._obsidianEmbedEnd;
		if (token.type === "obsidianEmbedCandidate") token.type = "data";
		if (event[0] !== "enter" || !candidateEnd || imageDepth > 0) {
			delete token._obsidianEmbedEnd;
			hasAttention ||= token.type === "obsidianEmbedAttentionSequence";
			resolved?.push(event);
			index++;
			continue;
		}

		resolved ??= events.slice(0, index);
		const embed: Token = {
			type: "obsidianEmbed",
			start: token.start,
			end: candidateEnd,
		};
		resolved.push(["enter", embed, event[2]], ["exit", embed, event[2]]);

		// Discard whole body tokens, not just attention delimiters. A token
		// crossing the raw end contributes its remaining source as literal data.
		while (index < events.length) {
			const current = events[index]!;
			const body = current[1];
			if (current[0] !== "enter" || body.start.offset >= candidateEnd.offset) break;
			delete body._obsidianEmbedEnd;
			index++;
			while (index < events.length) {
				const closing = events[index++]!;
				if (closing[0] === "exit" && closing[1] === body) break;
			}
			if (body.end.offset > candidateEnd.offset) {
				const tail: Token = {
					type: "data",
					start: candidateEnd,
					end: body.end,
				};
				resolved.push(["enter", tail, event[2]], ["exit", tail, event[2]]);
				break;
			}
		}
	}
	// subtokenize retains this array before tokenizer.write().
	if (resolved) replaceEvents(events, 0, events.length, resolved);
	if (hasAttention) resolveAttention(events, context);
	return events;
};

const obsidianEmbedConstruct: Construct = {
	name: "obsidianEmbed",
	tokenize,
	resolveAll: resolveEmbeds,
};

const deferredAttention: Construct = {
	name: "attention",
	tokenize(effects, ok, nok) {
		// Use CommonMark's flanking rules, but defer pairing until media
		// ownership and literal embed boundaries are known.
		return attention.tokenize.call(this, effects, (code) => {
			this.events[this.events.length - 1]![1].type = "obsidianEmbedAttentionSequence";
			return ok(code);
		}, nok);
	},
	resolveAll: resolveEmbeds,
};

export const obsidianEmbedSyntax: Extension = {
	text: {
		[codes.exclamationMark]: obsidianEmbedConstruct,
		[codes.asterisk]: deferredAttention,
		[codes.underscore]: deferredAttention,
	},
	insideSpan: { null: [labelEnd, { resolveAll: protectCandidates }] },
};

export const obsidianEmbedFromMarkdown: MdastExtension = {
	enter: {
		obsidianEmbed(token) {
			this.enter({ type: "obsidianEmbed", value: "" }, token);
		},
	},
	exit: {
		obsidianEmbed(token) {
			const raw = this.sliceSerialize(token);
			const node = this.stack[this.stack.length - 1];
			if (node && "value" in node) {
				node.value = raw.slice(3, -2);
			}
			this.exit(token);
		},
	},
};
