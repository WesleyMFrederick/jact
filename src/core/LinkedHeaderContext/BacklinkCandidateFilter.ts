import { readFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

export interface BacklinkCandidateFilterLike {
	selectCandidates(
		scopeFiles: readonly string[],
		rootFilePath: string,
	): Promise<readonly string[]>;
}

export class BacklinkCandidateFilter implements BacklinkCandidateFilterLike {
	async selectCandidates(
		scopeFiles: readonly string[],
		rootFilePath: string,
	): Promise<readonly string[]> {
		const needles = this.needlesFor(rootFilePath);
		if (needles.length === 0) return scopeFiles;

		const rootIdentity = resolve(rootFilePath);
		const candidates = await Promise.all(
			scopeFiles.map(async (scopeFile) => {
				if (resolve(scopeFile) === rootIdentity) return scopeFile;
				try {
					const content = (await readFile(scopeFile, "utf8")).toLowerCase();
					return needles.some((needle) => content.includes(needle))
						? scopeFile
						: null;
				} catch {
					return scopeFile;
				}
			}),
		);
		return candidates.filter(
			(candidate): candidate is string => candidate !== null,
		);
	}

	private needlesFor(rootFilePath: string): readonly string[] {
		const encodedStem = basename(rootFilePath, extname(rootFilePath));
		if (encodedStem.length === 0) return [];

		let decodedStem: string;
		try {
			decodedStem = decodeURIComponent(encodedStem);
		} catch {
			decodedStem = encodedStem;
		}
		const decodedNeedle = decodedStem.toLowerCase();
		const encodedNeedle = encodeURIComponent(decodedStem).toLowerCase();
		return encodedNeedle === decodedNeedle
			? [decodedNeedle]
			: [decodedNeedle, encodedNeedle];
	}
}
