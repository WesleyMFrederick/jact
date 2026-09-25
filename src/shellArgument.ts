/** Double-quote a value for a copy-pasteable shell command. */
export function quote(value: string): string {
	return JSON.stringify(value);
}

/** Leave simple paths bare; quote anything with spaces or shell characters. */
export function shellFileArgument(filePath: string): string {
	return /^[A-Za-z0-9_./-]+$/.test(filePath) ? filePath : quote(filePath);
}

/** Quote for the shell; single quotes when double quotes would expand `` ` `` or `$`. */
export function shellTextArgument(value: string): string {
	return /[`$\\]/.test(value)
		? `'${value.replaceAll("'", `'\\''`)}'`
		: quote(value);
}
