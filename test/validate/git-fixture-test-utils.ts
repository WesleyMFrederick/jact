/**
 * Shared throwaway-git-repo fixture helpers for `--changed` selector tests
 * (task 003). Real `git` runs against a tmp dir — no mocking of
 * `node:child_process`, matching the injectable `RunGit` seam's intent.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Create a throwaway git repo under a fresh tmp dir and return its absolute
 * (symlink-resolved) path.
 */
export function createGitFixture(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "git-fixture-"));
  const dir = fs.realpathSync(tmp);

  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: dir });

  return dir;
}

/** Remove a git fixture directory created by {@link createGitFixture}. */
export function removeGitFixture(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeFileInFixture(dir: string, relPath: string, content: string): string {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}

/** Write and `git add` a file — appears as staged in `git status --porcelain`. */
export function writeStaged(dir: string, relPath: string, content = "# staged"): string {
  const full = writeFileInFixture(dir, relPath, content);
  execFileSync("git", ["add", relPath], { cwd: dir });
  return full;
}

/**
 * Commit a file, then modify it — appears as unstaged (modified) in
 * `git status --porcelain`.
 */
export function writeUnstaged(
  dir: string,
  relPath: string,
  initial = "# initial",
  modified = "# modified",
): string {
  const full = writeFileInFixture(dir, relPath, initial);
  execFileSync("git", ["add", relPath], { cwd: dir });
  // `--only` scopes the commit to this path so any other already-staged
  // fixture file (e.g. from writeStaged()) is left staged, not swept in.
  execFileSync("git", ["commit", "-q", "-m", "seed", "--only", relPath], { cwd: dir });
  fs.writeFileSync(full, modified);
  return full;
}

/** Write a file never added to git — appears as untracked (`??`). */
export function writeUntracked(dir: string, relPath: string, content = "# untracked"): string {
  return writeFileInFixture(dir, relPath, content);
}

/** Commit a file with no further modification — appears clean, not changed. */
export function writeCommittedClean(dir: string, relPath: string, content = "# clean"): string {
  const full = writeFileInFixture(dir, relPath, content);
  execFileSync("git", ["add", relPath], { cwd: dir });
  execFileSync("git", ["commit", "-q", "-m", "seed", "--only", relPath], { cwd: dir });
  return full;
}
