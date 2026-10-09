import * as fs from "node:fs";
import path from "node:path";
import type {
	RuleFinding,
	ValidationRule,
} from "../../../types/validationRuleTypes.js";
import { findVaultRoot } from "../../resolveScope.js";

export const NO_VAULT_ESCAPE_LINK_RULE = "obsidian/no-vault-escape-link";

const MESSAGE =
	"Link points outside the Obsidian vault, so Obsidian cannot open it. Create a symlink beside this note that points at the stable main checkout (never a .paseo/worktrees path), then link to the symlink with a relative path.";

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function cleanTarget(raw: string): string {
	let target = raw.split("#", 1)[0] ?? "";
	try {
		target = decodeURIComponent(target);
	} catch {
		// keep the undecoded text
	}
	return target.replace(/^<|>$/g, "");
}

/**
 * A markdown link in a vault note must stay inside the vault. Relative targets
 * are resolved lexically (never realpathed), so a symlink inside the vault that
 * points outside is a valid way to link out.
 */
export const noVaultEscapeLink: ValidationRule = {
	id: NO_VAULT_ESCAPE_LINK_RULE,
	preset: "obsidian",
	check({ filePath, links }) {
		const vault = findVaultRoot(filePath);
		if (vault === null) return [];
		let noteDir: string;
		try {
			noteDir = path.dirname(fs.realpathSync(filePath));
		} catch {
			noteDir = path.dirname(path.resolve(filePath));
		}

		const findings: RuleFinding[] = [];
		for (const link of links) {
			if (link.linkType !== "markdown") continue;
			// Obsidian footnote definition (`[^id]: text`), not a link.
			if (
				link.markdownForm === "definition" &&
				(link.text ?? "").startsWith("^")
			)
				continue;
			const raw = link.target.path.raw;
			if (!raw) continue;
			const target = cleanTarget(raw);
			if (target === "") continue;

			let escapes: boolean;
			if (/^file:/i.test(target)) {
				escapes = true;
			} else if (URL_SCHEME.test(target)) {
				continue;
			} else if (path.isAbsolute(target)) {
				escapes = true;
			} else if (target.includes(".paseo/worktrees/")) {
				escapes = true;
			} else {
				const relative = path.relative(vault, path.resolve(noteDir, target));
				escapes =
					relative === ".." ||
					relative.startsWith(`..${path.sep}`) ||
					path.isAbsolute(relative);
			}
			if (!escapes) continue;

			findings.push({
				ruleId: NO_VAULT_ESCAPE_LINK_RULE,
				line: link.line,
				column: link.column,
				message: MESSAGE,
				source: link.fullMatch,
			});
		}
		return findings;
	},
};
