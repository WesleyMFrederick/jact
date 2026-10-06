/**
 * Render untrusted text for terminal output and paste-ready shell commands.
 *
 * Document text can hold shell syntax and terminal control codes. These
 * helpers keep both inert when a user reads or pastes jact output.
 */

/** C0 controls, DEL, and C1 controls. ESC starts ANSI sequences. */
const CONTROL_CHARACTERS = /\p{Cc}/gu;

/** Tokens that Bash and Zsh read as literal text without quotes. */
const BARE_ARGUMENT = /^[A-Za-z0-9_./][A-Za-z0-9_./:=@%+-]*$/;

/** A command-line option: a trusted flag and an optional untrusted value. */
export type ShellOption = readonly [flag: string, value?: string];

/**
 * Replace control characters with visible `\uXXXX` escapes.
 * Use this on document text before a human-readable message prints it.
 */
export function terminalText(value: string): string {
	return value.replace(
		CONTROL_CHARACTERS,
		(character) =>
			`\\u${(character.codePointAt(0) ?? 0).toString(16).padStart(4, "0")}`,
	);
}

/** Show text in double quotes for a message. Not for shell commands. */
export function terminalQuote(value: string): string {
	return terminalText(JSON.stringify(value));
}

/**
 * Quote one argument for Bash and Zsh.
 * The shell passes the result as the exact original string.
 * Normal text goes in single quotes. Control characters go in `$'\ooo'`
 * octal escapes, so the printed command holds no raw control characters.
 */
export function shellArgument(value: string): string {
	if (BARE_ARGUMENT.test(value)) return value;
	if (value === "") return "''";
	return value.replace(/\p{Cc}+|[^\p{Cc}]+/gu, (segment) =>
		/^\p{Cc}/u.test(segment)
			? `$'${[...Buffer.from(segment, "utf8")]
					.map((byte) => `\\${byte.toString(8).padStart(3, "0")}`)
					.join("")}'`
			: `'${segment.replaceAll("'", `'\\''`)}'`,
	);
}

/**
 * Render a paste-ready command. `program` is trusted literal text.
 * Positionals and option values are quoted.
 * When a positional starts with `-`, options move first and `--` ends
 * option parsing, so the CLI reads that positional as data.
 */
export function shellCommand(
	program: string,
	positionals: readonly string[],
	options: readonly ShellOption[] = [],
): string {
	const renderedOptions = options.map(([flag, value]) =>
		value === undefined ? flag : `${flag} ${shellArgument(value)}`,
	);
	const renderedPositionals = positionals.map(shellArgument);
	const words = positionals.some((value) => value.startsWith("-"))
		? [program, ...renderedOptions, "--", ...renderedPositionals]
		: [program, ...renderedPositionals, ...renderedOptions];
	return words.join(" ");
}
