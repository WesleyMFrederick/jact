import * as fs from "node:fs";
import path from "node:path";
import { shellArgument } from "../../../shellArgument.js";
import type {
	RuleFinding,
	ValidationRule,
} from "../../../types/validationRuleTypes.js";
import { findVaultRoot } from "../../resolveScope.js";
import { destinationSpan, resolveVaultEscape } from "../../vaultEscape.js";

export const NO_VAULT_ESCAPE_LINK_RULE = "obsidian/no-vault-escape-link";

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
			if (resolveVaultEscape(raw, noteDir, vault) === null) continue;
			const written = destinationSpan(link.fullMatch)?.text ?? raw;

			findings.push({
				ruleId: NO_VAULT_ESCAPE_LINK_RULE,
				line: link.line,
				column: link.column,
				message: `Link leaves the Obsidian vault, so Obsidian cannot open it. Fix: jact vault-link ${shellArgument(filePath)} ${shellArgument(written)} (or --all for every such link in this note)`,
				source: link.fullMatch,
			});
		}
		return findings;
	},
};
