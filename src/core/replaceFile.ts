import { randomUUID } from "node:crypto";
import {
	linkSync,
	mkdtempSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";

/**
 * Replace `realFile` in one step using a same-folder temporary file.
 * This unconditional writer is used by citation fixes; concurrent-save
 * preservation belongs to replaceFileWithRecovery.
 */
export function replaceFile(
	realFile: string,
	content: string,
	mode: number,
): void {
	const tempPath = path.join(
		path.dirname(realFile),
		`.${path.basename(realFile)}.${randomUUID()}.tmp`,
	);
	try {
		writeFileSync(tempPath, content, { flag: "wx", mode });
		renameSync(tempPath, realFile);
	} catch (error) {
		rmSync(tempPath, { force: true });
		throw error;
	}
}

/**
 * Preserve the displaced inode, then install only into an absent pathname.
 * The note is briefly absent. Recovery is retained even after success: an
 * editor may still hold a descriptor for that inode and write to it later.
 */
export function replaceFileWithRecovery(
	realFile: string,
	content: string,
	mode: number,
	original: string,
):
	| { kind: "written"; recoveryPath: string }
	| { kind: "refused"; recoveryPath?: string } {
	const recoveryDir = mkdtempSync(
		path.join(path.dirname(realFile), `.${path.basename(realFile)}.recovery-`),
	);
	const recoveryPath = path.join(recoveryDir, path.basename(realFile));
	const staged = path.join(recoveryDir, "rewrite.tmp");
	let displaced = false;
	const restore = () => {
		try {
			linkSync(recoveryPath, realFile);
		} catch (error) {
			// An editor's new pathname must win over restoration.
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
		}
	};
	try {
		writeFileSync(staged, content, { flag: "wx", mode });
		if (readFileSync(realFile, "utf8") !== original) {
			return { kind: "refused" };
		}
		renameSync(realFile, recoveryPath);
		displaced = true;
		if (readFileSync(recoveryPath, "utf8") !== original) {
			restore();
			return { kind: "refused", recoveryPath };
		}
		try {
			linkSync(staged, realFile);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
			return { kind: "refused", recoveryPath };
		}
		return { kind: "written", recoveryPath };
	} catch (error) {
		if (!displaced) throw error;
		let restoreError = "";
		try {
			restore();
		} catch (failure) {
			restoreError = `; could not restore the note path: ${String(failure)}`;
		}
		throw new Error(
			`${error instanceof Error ? error.message : String(error)}; displaced note retained at ${recoveryPath}${restoreError}`,
			{ cause: error },
		);
	} finally {
		// Cleanup must not turn an installed note into a failed apply whose
		// symlinks the caller removes. Never remove the displaced inode.
		try {
			rmSync(staged, { force: true });
			if (!displaced) rmSync(recoveryDir, { recursive: true, force: true });
		} catch {
			// Only owned staging may remain; recovery is deliberately persistent.
		}
	}
}
