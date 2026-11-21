import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const helper = fileURLToPath(new URL("../../.github/bug-hunter/ensure-jact-build.mjs", import.meta.url));
// Helpers still running, mapped to the promise that settles once they and their fake npm closed stdio.
const live = new Map();
let root;
let repo;
let head;
let env;

function git(...args) {
  return execFileSync("git", ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", ...args], {
    cwd: repo, encoding: "utf8",
  }).trim();
}

function stop(child) {
  // Each helper leads its own process group, so this also reaches the fake npm it spawned,
  // even after the helper itself has died.
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

function run(overrides = {}, extraArgs = [], onMessage = () => {}, processMs = 4000) {
  let child;
  const closed = new Promise((resolve, reject) => {
    const preload = overrides.BUILD_TEST_BARRIER ? ["--import", join(root, "lock-probe.mjs")] : [];
    child = spawn(process.execPath, [...preload, helper, "--repo", repo, "--head", head, "--session", "test-session", ...extraArgs], {
      env: { ...env, ...overrides }, stdio: ["ignore", "pipe", "pipe", "ipc"], detached: true,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let installReady = false;
    // A hung helper and its fake npm are killed here, so the hang fails an assertion
    // instead of waiting for Vitest's timeout.
    const timer = setTimeout(() => {
      timedOut = true;
      stop(child);
    }, processMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (!installReady && stdout.includes("BUILD_TEST_INSTALL_READY\n")) {
        installReady = true;
        onMessage({ event: "install-ready", pid: child.pid });
      }
    });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("message", onMessage);
    // The fake npm inherits the helper's stdout and stderr, so "close" also means it has exited.
    child.on("close", async (code, signal) => {
      clearTimeout(timer);
      live.delete(child);
      const cli = await readFile(join(repo, "dist", "cli.js"), "utf8").catch(() => null);
      resolve({ pid: child.pid, code, signal, timedOut, stdout, stderr, cli });
    });
  });
  live.set(child, closed);
  return closed;
}

// The barrier gets its own window to gather five waiters. Each waiter's lock deadline covers that
// whole window plus the released install and build; each helper process, with its fake npm, is
// killed shortly after that deadline, and the test's own timeout comes after that.
function budgets(barrierMs, buildMs = 5000) {
  const lockMs = barrierMs + buildMs;
  const processMs = lockMs + 2000;
  return { barrierMs, lockMs, processMs, testMs: processMs + 2000 };
}

// Six callers share one held install gate. `barrier` resolves with the lock owner's pid once the
// other five report waiting on its lock: at once, or with `late`, only when the barrier window ends.
function contend({ barrierMs, lockMs, processMs }, { late = false } = {}) {
  const gate = join(root, "release-build");
  const waiting = new Set();
  let owner;
  let installReady = false;
  let settle;
  const barrier = new Promise((resolve, reject) => {
    settle = (final) => {
      if (waiting.size === 5 && owner && installReady) resolve(owner);
      else if (final) reject(new Error(`Owner install and five waiters did not reach the barrier within ${barrierMs} ms`));
    };
  });
  const timer = setTimeout(() => settle(true), barrierMs);
  const calls = Array.from({ length: 6 }, () => run(
    { BUILD_TEST_BARRIER: gate, BUILD_TEST_BARRIER_MS: String(lockMs) },
    ["--lock-timeout-ms", String(lockMs)],
    (message) => {
      if (message.event === "lock-owner") owner = message.pid;
      if (message.event === "install-ready") installReady = true;
      if (message.event === "lock-wait") waiting.add(message.pid);
      if (!late) settle(false);
    },
    processMs,
  ));
  return { calls, barrier: barrier.finally(() => clearTimeout(timer)), release: () => writeFile(gate, "release") };
}

async function expectOneBuild(results) {
  for (const result of results) {
    expect(result.code, result.stderr).toBe(0);
    expect(["built", "reused"]).toContain(callLog(result).outcome);
    expect(result.cli).toBe("built for test\n");
  }
  expect(await commands()).toEqual(["ci --ignore-scripts", "run build"]);
  expect(await readFile(join(repo, "dist", "cli.js"), "utf8")).toBe("built for test\n");
  expect(results.map(callLog).filter((entry) => entry.outcome === "built")).toHaveLength(1);
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
import { appendFileSync, existsSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2).join(' ');
appendFileSync(process.env.BUILD_TEST_LOG, args + '\\n');
if (args === 'ci --ignore-scripts' && process.env.BUILD_TEST_BARRIER) {
  // Held only until the gate opens, its own bound passes, or its helper dies and orphans it.
  const parent = process.ppid;
  const deadline = Date.now() + Number(process.env.BUILD_TEST_BARRIER_MS);
  console.log('BUILD_TEST_INSTALL_READY');
  while (!existsSync(process.env.BUILD_TEST_BARRIER)) {
    // Check the recorded helper PID, not a potentially reparented PID.
    let parentAlive = true;
    try { process.kill(parent, 0); }
    catch (error) {
      if (error.code !== 'ESRCH') throw error;
      parentAlive = false;
    }
    if (!parentAlive) {
      appendFileSync(process.env.BUILD_TEST_LOG, 'orphaned\\n');
      process.exit(75);
    }
    if (Date.now() >= deadline) {
      appendFileSync(process.env.BUILD_TEST_LOG, 'barrier timeout\\n');
      process.exit(75);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
if (args === process.env.BUILD_TEST_FAIL) process.exit(23);
if (args === 'run build') {
  mkdirSync('dist', { recursive: true });
  if (process.env.BUILD_TEST_BAD_OUTPUT) symlinkSync('cli.js', join('dist', 'cli.js'));
  else writeFileSync(join('dist', 'cli.js'), 'built for test\\n');
}
`, { mode: 0o755 });
  // .mjs is not needed for npm's extensionless executable when its enclosing
  // package declares ESM; keep the fixture independent of Node's syntax detection.
  await writeFile(join(root, "package.json"), '{"type":"module"}\n');
  env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, BUILD_TEST_LOG: join(root, "npm-calls") };
  await writeFile(join(root, "lock-probe.mjs"), `
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const mkdir = fs.mkdirSync;
let now = Date.now();
if (process.env.BUILD_TEST_TICK_MS) Date.now = () => now;
fs.mkdirSync = (...args) => {
  const lock = String(args[0]).endsWith('/bug-hunter-build.lock');
  try {
    const made = mkdir(...args);
    if (lock) process.send?.({ event: 'lock-owner', pid: process.pid });
    return made;
  } catch (error) {
    if (lock && error.code === 'EEXIST') now += Number(process.env.BUILD_TEST_TICK_MS || 0);
    if (lock && error.code === 'EEXIST') process.send?.({ event: 'lock-wait', pid: process.pid });
    throw error;
  }
};
syncBuiltinESMExports();
`);
});

afterEach(async () => {
  // Kill whatever a failed or timed-out test left running, fake npm included, before removing its files.
  const running = [...live];
  for (const [child] of running) stop(child);
  await Promise.allSettled(running.map(([, closed]) => closed));
  await rm(root, { recursive: true, force: true });
});

describe("shared prover build guard", () => {
  it("lets six simultaneous callers use CLI output after exactly one install and build", async () => {
    const contest = contend(budgets(5000));
    await contest.barrier;
    await contest.release();
    await expectOneBuild(await Promise.all(contest.calls));
  }, budgets(5000).testMs);

  it("still builds once when the held install is released at the very end of the barrier window", async () => {
    // The barrier resolves from its own timer, after all five wait, so the release is as late as is valid.
    const contest = contend(budgets(3000), { late: true });
    await contest.barrier;
    await contest.release();
    await expectOneBuild(await Promise.all(contest.calls));
  }, budgets(3000).testMs);

  it("fails each waiter on its own lock bound, leaving no process behind, when the lock owner dies", async () => {
    const contest = contend(budgets(3000, 1000));
    const owner = await contest.barrier;
    // Kill the owner alone, as a crash would: its orphaned fake npm must still exit.
    process.kill(owner, "SIGKILL");
    const results = await Promise.all(contest.calls);
    for (const result of results) {
      expect(result.timedOut, result.stderr).toBe(false);
      if (result.pid === owner) {
        expect(result.signal).toBe("SIGKILL");
        continue;
      }
      expect(result.code, result.stderr).toBe(124);
      expect(callLog(result).outcome).toBe("timeout");
    }
    expect(await commands()).toEqual(["ci --ignore-scripts", "orphaned"]);
    expect(live.size).toBe(0);
  }, budgets(3000, 1000).testMs);

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

  it("keeps the lock after an output-check exception so later callers cannot rebuild", async () => {
    const failed = await run({ BUILD_TEST_BAD_OUTPUT: "1" });
    expect(failed.code, failed.stderr).toBe(1);
    expect(failed.stderr).toMatch(/ELOOP/);
    const subsequent = await run({}, ["--lock-timeout-ms", "100"]);
    expect(await commands()).toEqual(["ci --ignore-scripts", "run build"]);
    expect(subsequent.code, subsequent.stderr).toBe(124);
    expect(callLog(subsequent).outcome).toBe("timeout");
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

  it("reports a default lock timeout before the sandbox's 295s command cutoff", async () => {
    await mkdir(join(repo, ".git", "bug-hunter-build.lock"));
    // Advance the helper's clock at each failed lock attempt, not the test's wall clock.
    const result = await run({ BUILD_TEST_BARRIER: "unused", BUILD_TEST_TICK_MS: "60000" });
    expect(result.timedOut).toBe(false);
    expect(result.code, result.stderr).toBe(124);
    const log = callLog(result);
    expect(log.outcome).toBe("timeout");
    expect(log.duration_ms).toBeLessThan(295_000);
    expect(result.stderr).toMatch(/timed out waiting/i);
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
