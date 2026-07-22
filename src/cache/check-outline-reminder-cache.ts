import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";

const OUTLINE_NAMESPACE = "outline";

function hash(value: string | Buffer): string {
	return createHash("sha256").update(value).digest("hex");
}

function markerPrefix(sessionId: string, filePath: string): string {
	return `${OUTLINE_NAMESPACE}_${hash(`${sessionId}\0${path.resolve(filePath)}`).slice(0, 24)}_`;
}

function markerPath(
	sessionId: string,
	filePath: string,
	cacheDir: string,
): string {
	const contentHash = hash(readFileSync(filePath)).slice(0, 24);
	return path.join(
		cacheDir,
		`${markerPrefix(sessionId, filePath)}${contentHash}`,
	);
}

/** Return whether reminders were already shown for this session, target, and content. */
export function checkOutlineReminderCache(
	sessionId: string,
	filePath: string,
	cacheDir: string,
): boolean {
	mkdirSync(cacheDir, { recursive: true });
	return existsSync(markerPath(sessionId, filePath, cacheDir));
}

/** Record that reminders were shown for this session, target, and content. */
export function writeOutlineReminderCache(
	sessionId: string,
	filePath: string,
	cacheDir: string,
): void {
	mkdirSync(cacheDir, { recursive: true });
	writeFileSync(markerPath(sessionId, filePath, cacheDir), "");
}

/** Remove only this session-target pair's outline reminder markers. */
export function resetOutlineReminderCache(
	sessionId: string,
	filePath: string,
	cacheDir: string,
): void {
	mkdirSync(cacheDir, { recursive: true });
	const prefix = markerPrefix(sessionId, filePath);
	for (const entry of readdirSync(cacheDir)) {
		if (entry.startsWith(prefix)) unlinkSync(path.join(cacheDir, entry));
	}
}
