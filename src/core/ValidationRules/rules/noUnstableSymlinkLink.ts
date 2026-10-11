import * as fs from "node:fs";
import path from "node:path";
import { shellArgument } from "../../../shellArgument.js";
import type {
	RuleFinding,
	ValidationRule,
} from "../../../types/validationRuleTypes.js";
import { ObsidianVaultView, unstableReason } from "../../obsidianVaultView.js";
import { findVaultRoot } from "../../resolveScope.js";
import { destinationSpan, resolveVaultTarget } from "../../vaultEscape.js";

export const NO_UNSTABLE_SYMLINK_LINK_RULE =
	"obsidian/no-unstable-symlink-link";

/**
 * A markdown link that stays inside the vault must not go through a folder
 * symlink that can disappear: one whose target is a temporary
 * `.paseo/worktrees` checkout, or one in a note's `sources` folder. Obsidian
 * opens such a link today, and it breaks without warning when the worktree
 * or the folder symlink is removed.
 */
export const noUnstableSymlinkLink: ValidationRule = {
	id: NO_UNSTABLE_SYMLINK_LINK_RULE,
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
			const alias = view.unstableAlias(target);
			if (alias === null) continue;
			const written = destinationSpan(link.fullMatch)?.text ?? raw;

			findings.push({
				ruleId: NO_UNSTABLE_SYMLINK_LINK_RULE,
				line: link.line,
				column: link.column,
				message: `Link goes through folder symlink ${path.relative(noteDir, alias.vaultPath)}, which ${unstableReason(alias)}, so the link breaks without warning when it is removed. Fix: jact vault-link ${shellArgument(filePath)} ${shellArgument(written)} (or --all for every such link in this note)`,
				source: link.fullMatch,
			});
		}
		return findings;
	},
};
