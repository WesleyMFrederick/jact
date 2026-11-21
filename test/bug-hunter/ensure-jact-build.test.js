import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const helper = fileURLToPath(new URL("../../.github/bug-hunter/ensure-jact-build.mjs", import.meta.url));
let root;
let repo;
let head;
let env;

function git(...args) {
  return execFileSync("git", ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", ...args], {
    cwd: repo, encoding: "utf8",
  }).trim();
}

function run(overrides = {}, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [helper, "--repo", repo, "--head", head, "--session", "test-session", ...extraArgs], {
      env: { ...env, ...overrides },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", async (code) => {
      const cli = await readFile(join(repo, "dist", "cli.js"), "utf8").catch(() => null);
      resolve({ code, stdout, stderr, cli });
    });
  });
}

async function commands() {
  return (await readFile(join(root, "npm-calls"), "utf8")).trim().split("\n");
}

function callLog(result) {
  const entries = result.stdout.split("\n").filter((line) => line.startsWith("{")).map((line) => JSON.parse(line));
  expect(entries).toHaveLength(1);
  expect(entries[0].event).toBe("jact-build");
  expect(entries[0].exit_code).toBe(result.code);
  return entries[0];
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "jact-build-guard-"));
  repo = join(root, "repo");
  const bin = join(root, "bin");
  await mkdir(repo);
  await mkdir(bin);
  git("init", "--quiet");
  git("-c", "user.name=Build Guard Test", "-c", "user.email=build-guard@example.invalid", "commit", "--quiet", "--allow-empty", "-m", "fixture");
  head = git("rev-parse", "HEAD");
  await writeFile(join(bin, "npm"), `#!/usr/bin/env node
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2).join(' ');
appendFileSync(process.env.BUILD_TEST_LOG, args + '\\n');
await new Promise((resolve) => setTimeout(resolve, 100));
if (args === process.env.BUILD_TEST_FAIL) process.exit(23);
if (args === 'run build') {
  mkdirSync('dist', { recursive: true });
  writeFileSync(join('dist', 'cli.js'), 'built for test\\n');
}
`, { mode: 0o755 });
  // .mjs is not needed for npm's extensionless executable when its enclosing
  // package declares ESM; keep the fixture independent of Node's syntax detection.
  await writeFile(join(root, "package.json"), '{"type":"module"}\n');
  env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, BUILD_TEST_LOG: join(root, "npm-calls") };
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("shared prover build guard", () => {
  it("lets six simultaneous callers use CLI output after exactly one install and build", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => run()));
    for (const result of results) {
      expect(result.code, result.stderr).toBe(0);
      expect(["built", "reused"]).toContain(callLog(result).outcome);
      expect(result.cli).toBe("built for test\n");
    }
    expect(await commands()).toEqual(["ci --ignore-scripts", "run build"]);
    expect(await readFile(join(repo, "dist", "cli.js"), "utf8")).toBe("built for test\n");
    expect(results.map(callLog).filter((entry) => entry.outcome === "built")).toHaveLength(1);
  });

  it("does not trust a preexisting dist directory, and reuses only a successful guarded build", async () => {
    await mkdir(join(repo, "dist"));
    await writeFile(join(repo, "dist", "cli.js"), "stale output\n");
    const first = await run();
    expect(first.code, first.stderr).toBe(0);
    expect(await readFile(join(repo, "dist", "cli.js"), "utf8")).toBe("built for test\n");
    const second = await run();
    expect(second.code, second.stderr).toBe(0);
    expect(callLog(second).outcome).toBe("reused");
    expect(await commands()).toEqual(["ci --ignore-scripts", "run build"]);
  });

  it.each(["ci --ignore-scripts", "run build"])("preserves a failing %s exit code without publishing readiness", async (stage) => {
    const failed = await run({ BUILD_TEST_FAIL: stage });
    expect(failed.code, failed.stderr).toBe(23);
    expect(callLog(failed).outcome).toBe("failed");
    const subsequent = await run();
    expect(subsequent.code).toBe(23);
    expect(callLog(subsequent).outcome).toBe("failed");
    expect(await commands()).toEqual(stage === "run build" ? ["ci --ignore-scripts", "run build"] : ["ci --ignore-scripts"]);
  });

  it("times out loudly on a stale lock without installing or deleting the lock", async () => {
    const lock = join(repo, ".git", "bug-hunter-build.lock");
    await mkdir(lock);
    const result = await run({}, ["--lock-timeout-ms", "100"]);
    expect(result.code).toBe(124);
    expect(result.stderr).toMatch(/timed out waiting/i);
    expect(callLog(result).outcome).toBe("timeout");
    await expect(readFile(join(root, "npm-calls"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(mkdir(lock)).rejects.toMatchObject({ code: "EEXIST" });
  });

  it("fails rather than rebuilding output removed after readiness", async () => {
    expect((await run()).code).toBe(0);
    await rm(join(repo, "dist"), { recursive: true });
    const result = await run();
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/ready.*missing|missing.*ready/i);
    expect(await commands()).toEqual(["ci --ignore-scripts", "run build"]);
  });

  it("fails rather than cleaning ready output for a different session", async () => {
    expect((await run()).code).toBe(0);
    const result = await run({}, ["--session", "different-session"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/session|identity/i);
    expect(await commands()).toEqual(["ci --ignore-scripts", "run build"]);
    expect(await readFile(join(repo, "dist", "cli.js"), "utf8")).toBe("built for test\n");
  });
});
