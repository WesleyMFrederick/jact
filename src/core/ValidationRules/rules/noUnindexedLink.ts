import * as fs from "node:fs";
import path from "node:path";
import { shellArgument } from "../../../shellArgument.js";
import type {
	RuleFinding,
	ValidationRule,
} from "../../../types/validationRuleTypes.js";
import { ObsidianVaultView } from "../../obsidianVaultView.js";
import { findVaultRoot } from "../../resolveScope.js";
import { destinationSpan, resolveVaultTarget } from "../../vaultEscape.js";

export const NO_UNINDEXED_LINK_RULE = "obsidian/no-unindexed-link";

/**
 * A markdown link that stays inside the vault must point where Obsidian shows
 * the file. Obsidian skips names that start with a dot, and skips a symlink
 * whose target it already shows at another vault path, so jact resolves such
 * a link but Obsidian cannot open it.
 */
export const noUnindexedLink: ValidationRule = {
	id: NO_UNINDEXED_LINK_RULE,
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

		let view: ObsidianVaultView | undefined;
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
			const target = resolveVaultTarget(raw, noteDir, vault);
			if (target === null) continue;
			view ??= new ObsidianVaultView(vault);
			const reason = view.unindexed(target);
			if (reason === null) continue;
			const written = destinationSpan(link.fullMatch)?.text ?? raw;

			findings.push({
				ruleId: NO_UNINDEXED_LINK_RULE,
				line: link.line,
				column: link.column,
				message:
					reason.kind === "dot"
						? `Link target is under ${reason.segment}, and Obsidian does not index names that start with a dot, so Obsidian cannot open it.`
						: `Obsidian does not open this file through this symlink, because the vault already shows it at ${path.relative(noteDir, reason.vaultPath)}. Fix: jact vault-link ${shellArgument(filePath)} ${shellArgument(written)} (or --all for every such link in this note)`,
				source: link.fullMatch,
			});
		}
		return findings;
	},
};
