/**
 * Changed-file selector `jact validate --changed` (ADR D2/D5).
 *
 * Resolves the set of git-tracked-or-untracked `.md` files with pending
 * changes (staged, unstaged, untracked) in a repo's working tree via
 * `git status --porcelain`. The git call is wrapped in an injectable
 * {@link RunGit} seam so tests stub it directly instead of mocking
 * `node:child_process`.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * Thrown when the working directory is not inside a git repository (or the
 * `git` invocation otherwise fails). CLI layer maps this to exit code 2
 * (usage error, per ADR D5).
 */
export class NotAGitRepositoryError extends Error {
  /** Directory that was not a git working tree. */
  readonly cwd: string;

  constructor(cwd: string) {
    super(`Not a git repository (or any parent up to the mount point): ${cwd}`);
    this.name = "NotAGitRepositoryError";
    this.cwd = cwd;
  }
}

/**
 * Injectable seam for running `git`. Real implementation is
 * {@link defaultRunGit}; tests supply a stub returning canned porcelain
 * output — never `vi.mock` of `node:child_process`.
 *
 * @param args `git` subcommand and arguments, e.g.
 * `["status", "--porcelain", "--untracked-files=all"]`.
 * @param cwd Directory to run `git` in.
 * @returns Raw stdout from the git invocation.
 * @throws {NotAGitRepositoryError} When `cwd` is not (in) a git working tree.
 */
export type RunGit = (args: string[], cwd: string) => string;

/**
 * Default {@link RunGit}: spawns the real `git` binary synchronously.
 *
 * @throws {NotAGitRepositoryError} When `git` exits non-zero or fails to spawn
 * (not a repo, `git` not installed, etc).
 */
export function defaultRunGit(args: string[], cwd: string): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });

  if (result.error !== undefined || result.status !== 0) {
    throw new NotAGitRepositoryError(cwd);
  }

  return result.stdout;
}

/**
 * Parse `git status --porcelain` output into absolute file paths.
 *
 * Handles the `XY <path>` format for staged/unstaged/untracked entries and
 * the `XY <old> -> <new>` rename form (renames resolve to the new path).
 * Quoted paths (git quotes paths containing unusual characters) are
 * unquoted via JSON parsing, matching git's C-style quoting.
 */
function parsePorcelain(output: string, cwd: string): string[] {
  const lines = output.split("\n").filter((line) => line.trim().length > 0);

  return lines.map((line) => {
    // First 2 chars = status codes (XY), 3rd = space, rest = path.
    const rest = line.slice(3);
    const arrowIndex = rest.indexOf(" -> ");
    const rawPath = arrowIndex >= 0 ? rest.slice(arrowIndex + 4) : rest;
    const unquoted =
      rawPath.startsWith('"') && rawPath.endsWith('"')
        ? (JSON.parse(rawPath) as string)
        : rawPath;

    return path.resolve(cwd, unquoted);
  });
}

/**
 * Resolve the set of `.md` files with pending git changes (staged, unstaged,
 * or untracked) in `cwd`'s working tree.
 *
 * - Zero changed `.md` files is a normal, successful result (empty array) —
 *   not an error (ADR D5, "no changes present" scenario).
 * - Deduplicates and returns paths sorted lexicographically, matching
 *   {@link resolveFiles}'s ordering contract.
 *
 * @param cwd Directory to run `git status` in. Defaults to `process.cwd()`.
 * @param runGit Injectable git seam. Defaults to {@link defaultRunGit}.
 * @returns Absolute `.md` paths with pending changes, in lexicographic order.
 * @throws {NotAGitRepositoryError} When `cwd` is not inside a git repository.
 */
export function resolveChangedFiles(
  cwd: string = process.cwd(),
  runGit: RunGit = defaultRunGit,
): string[] {
  const output = runGit(["status", "--porcelain", "--untracked-files=all"], cwd);
  const files = parsePorcelain(output, cwd);

  return [...new Set(files.filter((f) => f.endsWith(".md")))].sort();
}
