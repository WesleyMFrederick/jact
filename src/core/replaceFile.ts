import { randomUUID } from "node:crypto";
import { renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Replace `realFile` in one step: write `content` to a temporary file in the
 * same folder with `mode`, then rename it over the target. `unchanged` runs
 * after the temporary file is written and before the rename; when it returns
 * false the temporary file is removed, the target is left alone, and the
 * result is false.
 */
export function replaceFile(
	realFile: string,
	content: string,
	mode: number,
	unchanged: () => boolean = () => true,
): boolean {
	const tempPath = path.join(
		path.dirname(realFile),
		`.${path.basename(realFile)}.${randomUUID()}.tmp`,
	);
	try {
		writeFileSync(tempPath, content, { flag: "wx", mode });
		if (!unchanged()) {
			rmSync(tempPath, { force: true });
			return false;
		}
		renameSync(tempPath, realFile);
		return true;
	} catch (error) {
		rmSync(tempPath, { force: true });
		throw error;
	}
}
