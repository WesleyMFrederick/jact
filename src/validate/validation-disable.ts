import type { Root } from "mdast";

export const VALIDATION_DISABLE_DIRECTIVE = "<!-- jact-validate-disable -->";
export const VALIDATION_DISABLED_REASON =
	"validation disabled by document directive";

/** Recognize the exact disable comment as the first body block after optional YAML. */
export function isValidationDisabled(ast: Root): boolean {
	const firstBodyIndex = ast.children[0]?.type === "yaml" ? 1 : 0;
	const firstBodyNode = ast.children[firstBodyIndex];
	return (
		firstBodyNode?.type === "html" &&
		firstBodyNode.value.trim() === VALIDATION_DISABLE_DIRECTIVE
	);
}
