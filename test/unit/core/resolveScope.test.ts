import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveScope } from "../../../src/core/resolveScope.js";

// All temp dirs are created once and cleaned up after the suite
const temps: string[] = [];

function mkdtemp(): string {
	const d = fs.realpathSync(
		fs.mkdtempSync(path.join(os.tmpdir(), "resolvescope-test-")),
	);
	temps.push(d);
	return d;
}

afterAll(() => {
	for (const d of temps) fs.rmSync(d, { recursive: true, force: true });
});

// Fixtures created once (avoids repeated disk I/O per test)
let gitRoot: string;
let pkgRoot: string;
let bothRoot: string; // has both .git and package.json
let deepDir: string; // 3 levels below gitRoot
let subPkgDir: string; // sub-package nested inside gitRoot
let emptyDir: string; // no markers at all (isolated via mock fs)

beforeAll(() => {
	gitRoot = mkdtemp();
	fs.mkdirSync(path.join(gitRoot, ".git"));

	pkgRoot = mkdtemp();
	fs.writeFileSync(path.join(pkgRoot, "package.json"), "{}");

	bothRoot = mkdtemp();
	fs.mkdirSync(path.join(bothRoot, ".git"));
	fs.writeFileSync(path.join(bothRoot, "package.json"), "{}");

	deepDir = path.join(gitRoot, "a", "b", "c");
	fs.mkdirSync(deepDir, { recursive: true });

	subPkgDir = path.join(gitRoot, "packages", "sub");
	fs.mkdirSync(subPkgDir, { recursive: true });
	// sub-package has its own .git (worktree scenario)
	fs.mkdirSync(path.join(subPkgDir, ".git"));

	emptyDir = mkdtemp(); // no .git / package.json (ancestors under /tmp are safe)
});

describe("resolveScope — explicit override", () => {
	it("explicit path returned as-is with source 'explicit'", () => {
		const result = resolveScope({ explicit: "/my/docs", cwd: gitRoot });
		expect(result.source).toBe("explicit");
		expect(result.scope).toBe("/my/docs");
	});

	it("explicit takes priority over cwd .git marker", () => {
		const result = resolveScope({
			explicit: "/override",
			cwd: gitRoot, // gitRoot has .git — must be ignored
		});
		expect(result.source).toBe("explicit");
	});
});

describe("resolveScope — cwd marker walk-up", () => {
	it("cwd with .git → source 'cwd-git', scope equals that dir", () => {
		const result = resolveScope({ cwd: gitRoot });
		expect(result.source).toBe("cwd-git");
		expect(result.scope).toBe(gitRoot);
	});

	it(".git found 3 levels up from deep cwd", () => {
		const result = resolveScope({ cwd: deepDir });
		expect(result.source).toBe("cwd-git");
		expect(result.scope).toBe(gitRoot);
	});

	it("cwd with package.json only → source 'cwd-pkg'", () => {
		const result = resolveScope({ cwd: pkgRoot });
		expect(result.source).toBe("cwd-pkg");
		expect(result.scope).toBe(pkgRoot);
	});

	it("cwd with both .git and package.json → .git wins (cwd-git)", () => {
		const result = resolveScope({ cwd: bothRoot });
		expect(result.source).toBe("cwd-git");
	});

	it("sub-package with own .git: nearest .git returned first", () => {
		const result = resolveScope({ cwd: subPkgDir });
		expect(result.source).toBe("cwd-git");
		expect(result.scope).toBe(subPkgDir); // subPkgDir/.git found before gitRoot/.git
	});
});

describe("resolveScope — targetFile fallback", () => {
	it("all-false fs returns 'none' even with targetFile", () => {
		// Use a fresh empty cwd (no .git / package.json hierarchy)
		const isolatedCwd = mkdtemp();
		// Mock fs always returns false: applies to cwd walk-up AND targetFile walk-up
		const mockNoMarkers = {
			existsSync: () => false,
		} as unknown as typeof import("fs");

		const result = resolveScope({
			cwd: isolatedCwd,
			targetFile: path.join(gitRoot, "README.md"),
			fs: mockNoMarkers,
		});
		expect(result.source).toBe("none"); // mock always returns false for everything
	});

	it("targetFile dir .git found when cwd has no markers (via real separate dirs)", () => {
		// cwd is a fresh temp dir with no .git or package.json in its path to root
		// targetFile is in gitRoot which has .git
		// We pass a custom fs that returns true only for gitRoot/.git
		const customFs = {
			existsSync: (p: string) => p === path.join(gitRoot, ".git"),
		} as unknown as typeof import("fs");

		const result = resolveScope({
			cwd: emptyDir,
			targetFile: path.join(gitRoot, "src", "file.md"),
			fs: customFs,
		});
		expect(result.source).toBe("target-git");
		expect(result.scope).toBe(gitRoot);
	});

	it("targetFile dir package.json found when cwd has no markers", () => {
		const customFs = {
			existsSync: (p: string) => p === path.join(pkgRoot, "package.json"),
		} as unknown as typeof import("fs");

		const result = resolveScope({
			cwd: emptyDir,
			targetFile: path.join(pkgRoot, "src", "file.md"),
			fs: customFs,
		});
		expect(result.source).toBe("target-pkg");
		expect(result.scope).toBe(pkgRoot);
	});

	it("cwd .git wins over targetFile .git (cwd checked first)", () => {
		const result = resolveScope({
			cwd: gitRoot, // has .git
			targetFile: path.join(pkgRoot, "file.md"), // pkgRoot has package.json
		});
		expect(result.source).toBe("cwd-git");
		expect(result.scope).toBe(gitRoot);
	});
});

describe("resolveScope — .obsidian vault marker + nearest-wins", () => {
	it("cwd with .obsidian only → source 'cwd-obsidian', marker '.obsidian'", () => {
		const vault = mkdtemp();
		fs.mkdirSync(path.join(vault, ".obsidian"));
		const result = resolveScope({ cwd: vault });
		expect(result.source).toBe("cwd-obsidian");
		expect(result.scope).toBe(vault);
		expect(result.marker).toBe(".obsidian");
	});

	it("nearest wins: a closer .obsidian beats a higher .git", () => {
		const repo = mkdtemp();
		fs.mkdirSync(path.join(repo, ".git"));
		const vaultSub = path.join(repo, "vault", "sub");
		fs.mkdirSync(vaultSub, { recursive: true });
		fs.mkdirSync(path.join(repo, "vault", ".obsidian"));
		const result = resolveScope({ cwd: vaultSub });
		// vault/.obsidian is nearer than repo/.git
		expect(result.source).toBe("cwd-obsidian");
		expect(result.scope).toBe(path.join(repo, "vault"));
	});

	it("same level: .git wins over .obsidian (tiebreak order)", () => {
		const root = mkdtemp();
		fs.mkdirSync(path.join(root, ".git"));
		fs.mkdirSync(path.join(root, ".obsidian"));
		const result = resolveScope({ cwd: root });
		expect(result.source).toBe("cwd-git");
		expect(result.marker).toBe(".git");
	});

	it("targetFile dir .obsidian found when cwd has no markers", () => {
		const vault = mkdtemp();
		fs.mkdirSync(path.join(vault, ".obsidian"));
		const customFs = {
			existsSync: (p: string) => p === path.join(vault, ".obsidian"),
		} as unknown as typeof import("fs");
		const result = resolveScope({
			cwd: emptyDir,
			targetFile: path.join(vault, "notes", "page.md"),
			fs: customFs,
		});
		expect(result.source).toBe("target-obsidian");
		expect(result.scope).toBe(vault);
	});
});

describe("resolveScope — fail-fast none", () => {
	it("no markers anywhere: source is 'none', scope is empty string", () => {
		const mockFs = {
			existsSync: () => false,
		} as unknown as typeof import("fs");
		const result = resolveScope({ cwd: emptyDir, fs: mockFs });
		expect(result.source).toBe("none");
		expect(result.scope).toBe("");
	});

	it("source 'none': triedFallbacks is a non-empty array", () => {
		const mockFs = {
			existsSync: () => false,
		} as unknown as typeof import("fs");
		const result = resolveScope({ cwd: emptyDir, fs: mockFs });
		expect(result.source).toBe("none");
		expect(Array.isArray(result.triedFallbacks)).toBe(true);
		expect((result.triedFallbacks ?? []).length).toBeGreaterThan(0);
	});
});
