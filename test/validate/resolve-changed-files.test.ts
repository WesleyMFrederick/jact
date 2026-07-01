import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  NotAGitRepositoryError,
  resolveChangedFiles,
} from "../../src/validate/resolve-changed-files.js";
import { resolveFileSet } from "../../src/validate/resolve-files.js";
import { NoFilesMatchedError } from "../../src/validate/resolve-files.js";
import {
  createGitFixture,
  removeGitFixture,
  writeCommittedClean,
  writeStaged,
  writeUnstaged,
  writeUntracked,
} from "./git-fixture-test-utils.js";

let repoDir: string;

beforeEach(() => {
  repoDir = createGitFixture();
});

afterEach(() => {
  removeGitFixture(repoDir);
});

// ---------------------------------------------------------------------------
// Scenario: Changed-only validation
// ---------------------------------------------------------------------------

describe("resolveChangedFiles — staged/unstaged/untracked", () => {
  it("includes a staged .md file", () => {
    const a = writeStaged(repoDir, "concepts/a.md");

    const result = resolveChangedFiles(repoDir);

    expect(result).toEqual([a]);
  });

  it("includes an unstaged (modified) .md file", () => {
    const a = writeUnstaged(repoDir, "concepts/a.md");

    const result = resolveChangedFiles(repoDir);

    expect(result).toEqual([a]);
  });

  it("includes an untracked .md file", () => {
    const a = writeUntracked(repoDir, "concepts/a.md");

    const result = resolveChangedFiles(repoDir);

    expect(result).toEqual([a]);
  });

  it("unions staged + unstaged + untracked, deduped and sorted", () => {
    const staged = writeStaged(repoDir, "staged.md");
    const unstaged = writeUnstaged(repoDir, "unstaged.md");
    const untracked = writeUntracked(repoDir, "untracked.md");

    const result = resolveChangedFiles(repoDir);

    expect(result).toEqual([staged, unstaged, untracked].sort());
  });

  it("excludes clean (committed, unmodified) files", () => {
    writeCommittedClean(repoDir, "clean.md");

    const result = resolveChangedFiles(repoDir);

    expect(result).toEqual([]);
  });

  it("excludes non-.md changed files", () => {
    writeUntracked(repoDir, "notes.txt");
    const md = writeUntracked(repoDir, "notes.md");

    const result = resolveChangedFiles(repoDir);

    expect(result).toEqual([md]);
  });

  it("dedupes a file that is both staged and further modified unstaged", () => {
    const full = path.join(repoDir, "both.md");
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, "v1");
    // Stage v1, then modify again unstaged — porcelain reports one line "MM".
    execFileSync("git", ["add", "both.md"], { cwd: repoDir });
    fs.writeFileSync(full, "v2");

    const result = resolveChangedFiles(repoDir);

    expect(result).toEqual([full]);
  });
});

// ---------------------------------------------------------------------------
// Scenario: No changes present
// ---------------------------------------------------------------------------

describe("resolveChangedFiles — no changes present", () => {
  it("returns an empty array (success), not an error", () => {
    const result = resolveChangedFiles(repoDir);

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Outside a git repo — clear error, no crash
// ---------------------------------------------------------------------------

describe("resolveChangedFiles — outside a git repository", () => {
  let nonRepoDir: string;

  beforeEach(() => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "non-repo-"));
    nonRepoDir = fs.realpathSync(tmp);
  });

  afterEach(() => {
    fs.rmSync(nonRepoDir, { recursive: true, force: true });
  });

  it("throws NotAGitRepositoryError instead of crashing", () => {
    expect(() => resolveChangedFiles(nonRepoDir)).toThrow(NotAGitRepositoryError);
  });
});

// ---------------------------------------------------------------------------
// Injectable runGit seam (DI, no vi.mock of node:child_process)
// ---------------------------------------------------------------------------

describe("resolveChangedFiles — injectable runGit seam", () => {
  it("uses the injected runGit instead of spawning real git", () => {
    const stubGit = (args: string[], cwd: string) => {
      expect(args).toEqual(["status", "--porcelain", "--untracked-files=all"]);
      expect(cwd).toBe(repoDir);
      return " M concepts/a.md\n?? concepts/b.md\n";
    };

    const result = resolveChangedFiles(repoDir, stubGit);

    expect(result).toEqual(
      [path.join(repoDir, "concepts/a.md"), path.join(repoDir, "concepts/b.md")].sort(),
    );
  });

  it("propagates a stub-thrown NotAGitRepositoryError", () => {
    const stubGit = () => {
      throw new NotAGitRepositoryError(repoDir);
    };

    expect(() => resolveChangedFiles(repoDir, stubGit)).toThrow(NotAGitRepositoryError);
  });
});

// ---------------------------------------------------------------------------
// resolveFileSet — `--changed` unions into path/glob selection (ADR D2/D5)
// ---------------------------------------------------------------------------

describe("resolveFileSet — union of paths and --changed", () => {
  it("changed alone resolves to just the changed set", async () => {
    const a = writeStaged(repoDir, "a.md");

    const result = await resolveFileSet({ paths: [], changed: true }, repoDir);

    expect(result).toEqual([a]);
  });

  it("changed alone with no changes succeeds with an empty array", async () => {
    const result = await resolveFileSet({ paths: [], changed: true }, repoDir);

    expect(result).toEqual([]);
  });

  it("unions changed files into an explicit path/glob selection", async () => {
    const explicit = writeCommittedClean(repoDir, "explicit.md");
    const changed = writeStaged(repoDir, "changed.md");

    const result = await resolveFileSet(
      { paths: ["explicit.md"], changed: true },
      repoDir,
    );

    expect(result).toEqual([changed, explicit].sort());
  });

  it("never shrinks: paths alone already covering a file plus changed adds more, never fewer", async () => {
    const explicit = writeCommittedClean(repoDir, "explicit.md");
    const changed = writeStaged(repoDir, "changed.md");

    const withChanged = await resolveFileSet(
      { paths: ["explicit.md"], changed: true },
      repoDir,
    );
    const withoutChanged = await resolveFileSet(
      { paths: ["explicit.md"], changed: false },
      repoDir,
    );

    expect(withChanged.length).toBeGreaterThanOrEqual(withoutChanged.length);
    expect(withChanged).toEqual([changed, explicit].sort());
    expect(withoutChanged).toEqual([explicit]);
  });

  it("tolerates a zero-match glob when changed contributes files", async () => {
    const changed = writeStaged(repoDir, "changed.md");

    const result = await resolveFileSet(
      { paths: ["nonexistent/*.md"], changed: true },
      repoDir,
    );

    expect(result).toEqual([changed]);
  });

  it("propagates NoFilesMatchedError when nothing is selected at all (bad glob, no changes)", async () => {
    await expect(
      resolveFileSet({ paths: ["nonexistent/*.md"], changed: true }, repoDir),
    ).rejects.toBeInstanceOf(NoFilesMatchedError);
  });

  it("paths alone with zero-match still throws (unchanged from resolveFiles)", async () => {
    await expect(
      resolveFileSet({ paths: ["nonexistent/*.md"], changed: false }, repoDir),
    ).rejects.toBeInstanceOf(NoFilesMatchedError);
  });
});
