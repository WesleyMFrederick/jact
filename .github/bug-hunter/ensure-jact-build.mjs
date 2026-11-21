#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, renameSync, rmdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { parseArgs } from "node:util";

const started = Date.now();
const log = { event: "jact-build", outcome: "failed", exit_code: 1 };

function git(repo, ...args) {
  const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || "git failed");
  return result.stdout.trim();
}

function readResult(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function cliExists(repo) {
  try {
    return statSync(join(repo, "dist", "cli.js")).isFile();
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function consume(result, identity, outcome = "reused") {
  if (result.repo !== identity.repo || result.head !== identity.head || result.session !== identity.session) {
    throw new Error("Build result identity does not match this repository, head and session; refusing to rebuild shared output.");
  }
  if (result.status === "failed" && Number.isInteger(result.exit_code) && result.exit_code > 0 && result.exit_code <= 255) {
    console.error(result.error || "The shared build failed; refusing another attempt in this session.");
    log.outcome = "failed";
    return result.exit_code;
  }
  if (result.status !== "ready" || result.exit_code !== 0) throw new Error("Invalid shared build result; refusing to rebuild.");
  if (!cliExists(identity.repo)) throw new Error("Shared build is ready but dist/cli.js is missing; refusing to rebuild shared output.");
  log.outcome = outcome;
  return 0;
}

function build(identity, lock, resultPath) {
  // Another owner may have published between our last read and acquiring the lock.
  const existing = readResult(resultPath);
  if (existing) return consume(existing, identity);
  let exitCode = 0;
  let failure;
  for (const args of [["ci", "--ignore-scripts"], ["run", "build"]]) {
    const child = spawnSync("npm", args, { cwd: identity.repo, stdio: "inherit" });
    exitCode = child.status ?? 1;
    if (child.error || exitCode !== 0) {
      failure = child.error?.message || `npm ${args.join(" ")} failed (${child.signal || exitCode}).`;
      break;
    }
  }
  if (!failure && !cliExists(identity.repo)) {
    exitCode = 1;
    failure = "npm run build succeeded but dist/cli.js is missing.";
  }
  const result = { ...identity, status: failure ? "failed" : "ready", exit_code: exitCode, ...(failure && { error: failure }) };
  const temporary = join(lock, "result.json");
  writeFileSync(temporary, `${JSON.stringify(result)}\n`);
  renameSync(temporary, resultPath);
  return consume(result, identity, "built");
}

async function main() {
  const { values } = parseArgs({ options: {
    repo: { type: "string" }, head: { type: "string" }, session: { type: "string" },
    "lock-timeout-ms": { type: "string", default: "240000" },
  } });
  if (!values.repo || !values.head || !values.session) throw new Error("Required arguments: --repo <path> --head <sha> --session <id>.");
  const timeout = Number(values["lock-timeout-ms"]);
  if (!Number.isSafeInteger(timeout) || timeout <= 0) throw new Error("--lock-timeout-ms must be a positive integer.");
  const identity = { repo: realpathSync(values.repo), head: values.head, session: values.session };
  Object.assign(log, identity);
  if (git(identity.repo, "rev-parse", "HEAD") !== identity.head) throw new Error("Repository HEAD does not match the requested build head.");
  const gitDir = git(identity.repo, "rev-parse", "--absolute-git-dir");
  const lock = join(gitDir, "bug-hunter-build.lock");
  const resultPath = join(gitDir, "bug-hunter-build-result.json");
  const deadline = Date.now() + timeout;
  for (;;) {
    const result = readResult(resultPath);
    if (result) return consume(result, identity);
    try {
      mkdirSync(lock);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (Date.now() >= deadline) {
        console.error(`Timed out waiting for shared build lock ${lock}; the lock was not removed.`);
        log.outcome = "timeout";
        return 124;
      }
      await setTimeout(Math.min(100, Math.max(1, deadline - Date.now())));
      continue;
    }
    // Release only after build() publishes and consumes its result. An exception
    // leaves the lock intact, so another caller cannot repeat a destructive build.
    const exitCode = build(identity, lock, resultPath);
    rmdirSync(lock);
    return exitCode;
  }
}

try {
  log.exit_code = await main();
} catch (error) {
  console.error(`jact-build: ${error.message}`);
} finally {
  log.duration_ms = Date.now() - started;
  console.log(JSON.stringify(log));
  process.exitCode = log.exit_code;
}
