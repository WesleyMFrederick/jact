#!/usr/bin/env node
// Bug Hunter: multi-agent PR review on Claude Managed Agents.
//
// 1. Splits the PR into slices here, in plain code, and uploads each slice as a diff file.
//    Lockfiles, build output and planning docs are skipped. No reviewable change, no session.
// 2. Finds or creates the agent and its cloud environment. Both names carry a hash of
//    their config, so a config change makes new ones.
// 3. Starts a session with the repo mounted at the PR head, the slice files mounted beside
//    it, and a short manifest as the first message. The agent runs a dynamic workflow:
//    read each slice -> pick candidates -> prove each candidate -> report.
// 4. Polls until every workflow run has ended and the session idles with end_turn.
//    At 75% of the budget it asks the agent to stop its runs and report.
// 5. Posts the confirmed findings as one PR review, and prints what the session cost.
//
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY (owner/name), PR_NUMBER, plus Anthropic credentials:
// in CI the Workload Identity Federation vars (no stored key); locally ANTHROPIC_API_KEY.
// Optional: REPO_TOKEN (repo mount, private repos only; never set by default), BUG_HUNTER_MODEL,
// BUDGET_CENTS (default 1500 = $15.00), FAIL_ON (high|medium|low|none, default high),
// TIMEOUT_MINUTES (default 50), DRY_RUN=1 (print the review instead of posting it).
//
// Exit codes: 0 no blocking findings, 1 blocking findings, 2 the review itself failed.

import { createHash } from "node:crypto";
import { readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic, { toFile } from "@anthropic-ai/sdk";

const here = dirname(fileURLToPath(import.meta.url));
const env = (name, fallback) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") throw new Error(`Missing required env var ${name}`);
  return value;
};

const REPO = env("GITHUB_REPOSITORY");
const PR_NUMBER = Number(env("PR_NUMBER"));
const GITHUB_TOKEN = env("GITHUB_TOKEN");
// The agent's sandbox gets no GitHub credential by default: a public repo clones without one.
// Set REPO_TOKEN (a read-only, single-repo token) only for a private repo.
const REPO_TOKEN = process.env.REPO_TOKEN || undefined;
const MODEL = process.env.BUG_HUNTER_MODEL || "claude-opus-5-5";
const BUDGET_CENTS = String(Number(process.env.BUDGET_CENTS || 1500));
const FAIL_ON = process.env.FAIL_ON || "high";
const TIMEOUT_MS = Number(process.env.TIMEOUT_MINUTES || 50) * 60_000;
const DRY_RUN = process.env.DRY_RUN === "1";
const MOUNT_PATH = "/workspace/repo";
const SLICE_DIR = "/workspace/slices";
const POLL_MS = 15_000;
// At this share of the budget, the runner asks the agent to stop its runs and report,
// so the final report is never the request that runs out of money.
const WRAP_UP_AT = 0.75;
const SLICE_LINES = 400;
const MAX_SLICES = 6;
// Files no reviewer needs: lockfiles, build output, snapshots, and planning docs.
const SKIP = /(^|\/)(package-lock\.json|[^/]*\.lock|pnpm-lock\.yaml)$|^dist\/|\.snap$|\.min\.[a-z]+$|^(docs|design-docs|\.scratch)\//;

const SEVERITY_RANK = { high: 3, medium: 2, low: 1, none: 99 };
const dollars = (cents) => `$${(Number(cents) / 100).toFixed(2)}`;
// In CI there is no API key: the SDK reads ANTHROPIC_IDENTITY_TOKEN_FILE and the federation
// IDs, swaps GitHub's OIDC token for a short-lived Anthropic token, and refreshes it.
// https://platform.claude.com/docs/en/manage-claude/wif-providers/github-actions
// Locally, an ANTHROPIC_API_KEY in the environment takes precedence.
const client = new Anthropic();

// GitHub's OIDC token expires about 5 minutes after it is issued, and the SDK rereads
// ANTHROPIC_IDENTITY_TOKEN_FILE each time it renews its 10-minute Anthropic token. So in CI,
// fetch a fresh GitHub token into that file every 4 minutes for as long as the job runs.
// https://platform.claude.com/docs/en/manage-claude/wif-providers/github-actions
async function refreshGithubIdToken() {
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const file = process.env.ANTHROPIC_IDENTITY_TOKEN_FILE;
  if (!url || !file) return;
  const res = await fetch(`${url}&audience=https://api.anthropic.com`, {
    headers: { authorization: `Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` },
  });
  if (!res.ok) throw new Error(`GitHub OIDC token request -> ${res.status}`);
  writeFileSync(file, (await res.json()).value);
}

// ---------- GitHub ----------

async function gh(path, { method = "GET", body, accept = "application/vnd.github+json" } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${GITHUB_TOKEN}`,
      accept,
      "x-github-api-version": "2022-11-28",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = new Error(`GitHub ${method} ${path} -> ${res.status}: ${await res.text()}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function prFiles() {
  const all = [];
  for (let page = 1; ; page++) {
    const files = await gh(`/repos/${REPO}/pulls/${PR_NUMBER}/files?per_page=100&page=${page}`);
    all.push(...files);
    if (files.length < 100) return all;
  }
}

// Lines on the new side of the diff that GitHub accepts inline comments on.
function commentableLines(files) {
  const lines = new Map();
  for (const f of files) {
    const set = new Set();
    let newLine = 0;
    for (const row of (f.patch || "").split("\n")) {
      const hunk = row.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunk) { newLine = Number(hunk[1]); continue; }
      if (row.startsWith("-")) continue;
      if (row.startsWith("+") || row.startsWith(" ")) { set.add(newLine); newLine++; }
    }
    lines.set(f.filename, set);
  }
  return lines;
}

// ---------- Slicing (plain code, no model) ----------

// Packs whole files, in PR order, into at most MAX_SLICES slices of about SLICE_LINES
// changed lines. A file larger than a slice gets a slice of its own.
function planSlices(files) {
  const reviewable = files.filter((f) => f.patch && f.status !== "removed" && !SKIP.test(f.filename));
  const skipped = files.filter((f) => !reviewable.includes(f)).map((f) => f.filename);
  const total = reviewable.reduce((n, f) => n + f.changes, 0);
  const target = Math.max(SLICE_LINES, Math.ceil(total / MAX_SLICES));
  const slices = [];
  for (const f of reviewable) {
    let last = slices.at(-1);
    if (!last || (last.lines + f.changes > target && slices.length < MAX_SLICES)) {
      last = { id: `s${slices.length + 1}`, files: [], lines: 0, text: "" };
      slices.push(last);
    }
    last.files.push(f.filename);
    last.lines += f.changes;
    last.text += `diff --git a/${f.previous_filename || f.filename} b/${f.filename}\n--- a/${f.previous_filename || f.filename}\n+++ b/${f.filename}\n${f.patch}\n`;
  }
  return { slices, skipped };
}

// ---------- Managed Agents setup ----------

// The vault's formatter adds YAML frontmatter to markdown files; the agent never needs it.
const systemPrompt = readFileSync(join(here, "system-prompt.md"), "utf8").replace(/^---\n[\s\S]*?\n---\n/, "");
const agentConfig = {
  model: MODEL,
  system: systemPrompt,
  tools: [
    {
      type: "agent_toolset_20260401",
      configs: [
        { name: "web_search", enabled: false },
        { name: "web_fetch", enabled: false },
      ],
    },
  ],
  multiagent: {
    type: "multiagent_20261001",
    workflows: { type: "enabled" },
    subagents: { type: "disabled" },
  },
};
const environmentConfig = {
  type: "cloud",
  networking: { type: "limited", allow_package_managers: true },
};
const shortHash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 10);

async function findByName(list, name) {
  for await (const item of list) if (item.name === name && !item.archived_at) return item;
  return undefined;
}

async function ensureAgent() {
  const name = `jact-bug-hunter-${shortHash(agentConfig)}`;
  const found = await findByName(client.beta.agents.list(), name);
  if (found) return found.id;
  const created = await client.beta.agents.create({ name, ...agentConfig });
  console.log(`Created agent ${name} (${created.id})`);
  return created.id;
}

async function ensureEnvironment() {
  const name = `jact-bug-hunter-env-${shortHash(environmentConfig)}`;
  const found = await findByName(client.beta.environments.list(), name);
  if (found) return found.id;
  const created = await client.beta.environments.create({ name, config: environmentConfig });
  console.log(`Created environment ${name} (${created.id})`);
  return created.id;
}

// ---------- Session ----------

function manifest(pr, slices, skipped) {
  return [
    `Review pull request #${PR_NUMBER} in ${REPO}: "${pr.title}".`,
    `Repository: ${MOUNT_PATH}, checked out at the PR head commit ${pr.head.sha} (base ${pr.base.ref} at ${pr.base.sha}).`,
    "",
    "PR description:",
    (pr.body || "(none)").slice(0, 4000),
    "",
    "Slices (each is a unified diff file already in the sandbox):",
    ...slices.map((s) => `- ${s.id}: ${SLICE_DIR}/${s.id}.diff (${s.lines} changed lines) ${s.files.join(", ")}`),
    skipped.length ? `\nNot reviewed (lockfiles, build output, planning docs, removed or binary files): ${skipped.join(", ")}` : "",
    "",
    "Start the workflow run now.",
  ].join("\n");
}

async function listEvents(sessionId) {
  const events = [];
  for await (const event of client.beta.sessions.events.list(sessionId)) events.push(event);
  return events;
}

// Done when every run seen has ended, and after that the session idled with end_turn.
// https://platform.claude.com/docs/en/managed-agents/workflow-runs#know-when-the-work-is-done
function assess(events) {
  const open = new Set();
  let lastRunEnd = -1;
  let lastIdle;
  events.forEach((e, i) => {
    if (e.type === "workflow_run.created") open.add(e.workflow_run_id);
    if (e.type === "workflow_run.status_ended") { open.delete(e.workflow_run_id); lastRunEnd = i; }
    if (e.type === "session.status_idle") lastIdle = { index: i, reason: e.stop_reason?.type };
  });
  if (!lastIdle) return { state: "working" };
  if (lastIdle.reason === "budget_reached") return { state: "budget" };
  if (lastIdle.reason === "requires_action") return { state: "blocked" };
  if (lastIdle.reason === "end_turn" && open.size === 0 && lastIdle.index > lastRunEnd) return { state: "done" };
  return { state: "working", reason: lastIdle.reason };
}

function finalText(events) {
  const messages = events.filter((e) => e.type === "agent.message" && !e.session_thread_id);
  const last = messages.at(-1) ?? events.filter((e) => e.type === "agent.message").at(-1);
  return (last?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

function parseReport(text) {
  const blocks = [...text.matchAll(/```json\s*\n([\s\S]*?)```/g)];
  if (!blocks.length) throw new Error(`Agent's final message has no json block:\n${text.slice(-2000)}`);
  const report = JSON.parse(blocks.at(-1)[1]);
  // A report that breaks the schema is a failed review, not a clean one.
  if (!report || !Array.isArray(report.findings)) throw new Error("Agent's report has no findings array.");
  for (const f of report.findings) {
    if (!["high", "medium", "low"].includes(f?.severity) || typeof f.file !== "string" || typeof f.title !== "string" || !Number.isInteger(Number(f.line))) {
      throw new Error(`Agent's report has an invalid finding: ${JSON.stringify(f).slice(0, 300)}`);
    }
  }
  if (report.not_covered !== undefined && !Array.isArray(report.not_covered)) throw new Error("Agent's report has a non-array not_covered.");
  return report;
}

const say = (sessionId, text) =>
  client.beta.sessions.events.send(sessionId, { events: [{ type: "user.message", content: [{ type: "text", text }] }] });

// Best effort: ask the agent to end its runs, stop its turn, and archive the session so
// nothing keeps spending after the CI job is gone. Archiving can also end open runs.
// https://platform.claude.com/docs/en/managed-agents/workflow-runs#interrupt-a-session-with-runs-open
async function stopSession(sessionId) {
  await say(sessionId, "Stop all workflow runs now and start no new work.").catch(() => {});
  await client.beta.sessions.events.send(sessionId, { events: [{ type: "user.interrupt" }] }).catch(() => {});
  // A running session can't be archived; give the interrupt up to 30 seconds to land.
  for (let i = 0; i < 6; i++) {
    const { status } = await client.beta.sessions.retrieve(sessionId).catch(() => ({}));
    if (status !== "running" && status !== "rescheduling") break;
    await new Promise((r) => setTimeout(r, 5_000));
  }
  await client.beta.sessions.archive(sessionId).catch((err) => console.log(`  could not archive ${sessionId}: ${err.message}`));
}

// A cancelled or crashed earlier run can leave its session alive and spending.
// Stop any live Bug Hunter session for this PR before starting a new one.
async function stopStaleSessions() {
  const prefix = `Bug Hunter ${REPO}#${PR_NUMBER} `;
  let checked = 0;
  for await (const s of client.beta.sessions.list()) {
    if (++checked > 200) break;
    if (!s.title?.startsWith(prefix) || s.archived_at || s.status === "terminated") continue;
    console.log(`Stopping stale session ${s.id} (${s.status}).`);
    await stopSession(s.id);
  }
}

// What the session cost, in total and by agent. Thread figures leave out runtime cost,
// so they sum to a little less than the session total.
async function costReport(sessionId) {
  const session = await client.beta.sessions.retrieve(sessionId);
  const byAgent = new Map();
  for await (const t of client.beta.sessions.threads.list(sessionId)) {
    if (!t.usage) continue;
    const model = typeof t.agent?.model === "string" ? t.agent.model : t.agent?.model?.id ?? "?";
    const role = t.workflow_run_id ? (t.agent?.name || "workflow agent").replace(/[-_ ]?\d+$/, "") : "lead";
    const key = `${role} (${model})`;
    const row = byAgent.get(key) ?? { threads: 0, cents: 0, input: 0, cached: 0, output: 0 };
    row.threads++;
    row.cents += Number(t.usage.list_cost?.amount ?? 0);
    row.input += t.usage.input_tokens ?? 0;
    row.cached += t.usage.cache_read_input_tokens ?? 0;
    row.output += t.usage.output_tokens ?? 0;
    byAgent.set(key, row);
  }
  const total = session.usage?.list_cost?.amount;
  const table = [
    "| Agent | Threads | Cost | Input | Cached input | Output |",
    "| ----- | ------- | ---- | ----- | ------------ | ------ |",
    ...[...byAgent].sort((a, b) => b[1].cents - a[1].cents).map(([k, r]) => `| ${k} | ${r.threads} | ${dollars(r.cents)} | ${r.input} | ${r.cached} | ${r.output} |`),
    `| **Session total** (includes runtime, ${session.usage?.active_seconds ?? "?"}s) | | **${total === undefined ? "?" : dollars(total)}** | | | |`,
  ].join("\n");
  return { total, table };
}

// ---------- Report ----------

function formatFinding(f) {
  return `**[${String(f.severity).toUpperCase()}] ${f.title}**\n\n${f.body}\n\n<sub>Bug Hunter (Claude Managed Agents)</sub>`;
}

async function postReview(pr, files, report, { sessionId, note, finished, cost }) {
  const lines = commentableLines(files);
  const inline = [];
  const elsewhere = [];
  for (const f of report.findings) {
    if (lines.get(f.file)?.has(Number(f.line))) inline.push({ path: f.file, line: Number(f.line), side: "RIGHT", body: formatFinding(f) });
    else elsewhere.push(f);
  }
  const counts = ["high", "medium", "low"].map((s) => `${report.findings.filter((f) => f.severity === s).length} ${s}`).join(", ");
  const heading = !finished ? "did not finish" : report.findings.length ? counts : "no confirmed bugs";
  const body = [
    `## Bug Hunter: ${heading}`,
    "",
    report.summary || "",
    note ? `\n> ${note}` : "",
    report.not_covered?.length ? `\nNot covered: ${report.not_covered.join(", ")}` : "",
    ...elsewhere.map((f) => `\n---\n\`${f.file}:${f.line}\`\n\n${formatFinding(f)}`),
    `\n<sub>Managed Agents session \`${sessionId ?? "none"}\` · model \`${MODEL}\` · cost ${cost?.total === undefined ? "n/a" : dollars(cost.total)} of ${dollars(BUDGET_CENTS)} budget</sub>`,
  ].join("\n");

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) appendFileSync(summaryPath, `${body}\n${cost?.table ? `\n### Cost\n\n${cost.table}\n` : ""}`);
  if (DRY_RUN) {
    console.log("DRY_RUN: review not posted.\n", body, "\nInline:", JSON.stringify(inline, null, 2));
    return;
  }
  const review = { commit_id: pr.head.sha, event: "COMMENT", body, comments: inline };
  try {
    await gh(`/repos/${REPO}/pulls/${PR_NUMBER}/reviews`, { method: "POST", body: review });
  } catch (err) {
    if (err.status !== 422) throw err;
    // GitHub rejected an inline position. Fall back to one review with everything in the body.
    const flat = inline.map((c) => `\n---\n\`${c.path}:${c.line}\`\n\n${c.body}`).join("\n");
    await gh(`/repos/${REPO}/pulls/${PR_NUMBER}/reviews`, { method: "POST", body: { commit_id: pr.head.sha, event: "COMMENT", body: body + flat } });
  }
  console.log(`Posted review: ${inline.length} inline, ${elsewhere.length} in body.`);
}

// ---------- Main ----------

let liveSession; // the session to stop if this process is cancelled or crashes

async function main() {
  await refreshGithubIdToken();
  setInterval(() => refreshGithubIdToken().catch((err) => console.log(`  OIDC refresh failed: ${err.message}`)), 4 * 60_000).unref();
  const pr = await gh(`/repos/${REPO}/pulls/${PR_NUMBER}`);
  const files = await prFiles();
  // The PR object and its file list come from two calls; a push between them would mix two heads.
  const recheck = await gh(`/repos/${REPO}/pulls/${PR_NUMBER}`);
  if (recheck.head.sha !== pr.head.sha) throw new Error(`PR head moved from ${pr.head.sha} to ${recheck.head.sha} during setup; the newer push's run reviews it.`);
  const { slices, skipped } = planSlices(files);
  console.log(`Slices: ${slices.map((s) => `${s.id}=${s.lines} lines/${s.files.length} files`).join(", ") || "none"}; skipped ${skipped.length} files.`);
  if (!slices.length) {
    await postReview(pr, files, { summary: "Nothing to review: this PR changes only lockfiles, build output, planning docs, or removed or binary files.", findings: [] }, { finished: true });
    return;
  }

  await stopStaleSessions();
  const [agentId, environmentId, uploads] = await Promise.all([
    ensureAgent(),
    ensureEnvironment(),
    Promise.all(slices.map(async (s) => client.beta.files.upload({ file: await toFile(Buffer.from(s.text), `${s.id}.diff`, { type: "text/plain" }) }))),
  ]);

  const session = await client.beta.sessions.create({
    agent: agentId,
    environment_id: environmentId,
    title: `Bug Hunter ${REPO}#${PR_NUMBER} @ ${pr.head.sha.slice(0, 7)}`,
    budget: { type: "limit", max_list_cost: { amount: BUDGET_CENTS, currency: "USD" } },
    resources: [
      {
        type: "github_repository",
        url: `https://github.com/${REPO}`,
        mount_path: MOUNT_PATH,
        ...(REPO_TOKEN ? { authorization_token: REPO_TOKEN } : {}),
        checkout: { type: "commit", sha: pr.head.sha },
      },
      ...uploads.map((u, i) => ({ type: "file", file_id: u.id, mount_path: `${SLICE_DIR}/${slices[i].id}.diff` })),
    ],
  });
  liveSession = session.id;
  console.log(`Session ${session.id} started for ${REPO}#${PR_NUMBER} (budget ${dollars(BUDGET_CENTS)}).`);
  await say(session.id, manifest(pr, slices, skipped));

  const deadline = Date.now() + TIMEOUT_MS;
  const wrapUpCents = Number(BUDGET_CENTS) * WRAP_UP_AT;
  let askedToWrapUp = false;
  let verdict = { state: "working" };
  let events = [];
  let seen = 0;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const current = await client.beta.sessions.retrieve(session.id);
    if (current.status === "terminated") throw new Error(`Session ${session.id} terminated.`);
    const spent = Number(current.usage?.list_cost?.amount ?? 0);
    if (!askedToWrapUp && spent >= wrapUpCents) {
      askedToWrapUp = true;
      console.log(`  spent ${dollars(spent)}: asking the agent to stop its runs and report.`);
      await say(session.id, "The budget is nearly spent. Stop your workflow runs now, start no new agents, and write the final report from the findings that a prover has already confirmed. List everything unfinished in not_covered.").catch((err) => console.log(`  wrap-up message failed: ${err.message}`));
    }
    if (current.status !== "idle") continue;
    events = await listEvents(session.id);
    const fresh = events.slice(seen);
    seen = events.length;
    for (const e of fresh) {
      if (e.type === "session.error") console.log(`  session.error: ${JSON.stringify(e.error ?? e)}`);
      if (e.type === "workflow_run.created") console.log(`  run started: ${e.name} (${(e.phases || []).map((p) => p.name).join(" -> ")})`);
      if (e.type === "workflow_run.status_ended") console.log(`  run ended: ${JSON.stringify(e.result)}`);
    }
    verdict = assess(events);
    if (verdict.state !== "working") break;
  }

  if (verdict.state === "working" && verdict.reason === "retries_exhausted") {
    const errors = events.filter((e) => e.type === "session.error").map((e) => JSON.stringify(e.error ?? e)).slice(-3);
    throw new Error(`Session ${session.id} stopped with retries_exhausted. Last errors: ${errors.join(" | ") || "none logged"}`);
  }
  let note = "";
  if (verdict.state === "working") note = `Timed out after ${TIMEOUT_MS / 60000} minutes before the review finished.`;
  if (verdict.state === "budget") note = `Stopped at the ${dollars(BUDGET_CENTS)} session budget before the review finished.`;
  if (verdict.state === "blocked") throw new Error(`Session ${session.id} is waiting on a tool confirmation; check the agent's permission policy.`);
  const finished = verdict.state === "done";
  if (!finished) await stopSession(session.id);
  liveSession = undefined;

  const cost = await costReport(session.id).catch((err) => ({ table: `Cost unavailable: ${err.message}` }));
  console.log(`\nCost:\n${cost.table}\n`);

  let report;
  try {
    report = parseReport(finalText(events));
  } catch (err) {
    if (finished) throw err;
    report = { summary: "No report: the review did not finish, so this PR has not been checked.", findings: [] };
  }
  await postReview(pr, files, report, { sessionId: session.id, note, finished, cost });
  await Promise.all(uploads.map((u) => client.beta.files.delete(u.id).catch(() => {})));

  const threshold = SEVERITY_RANK[FAIL_ON] ?? SEVERITY_RANK.high;
  const blocking = report.findings.filter((f) => (SEVERITY_RANK[f.severity] ?? 0) >= threshold);
  if (note) console.log(`::warning title=Bug Hunter did not finish::${note}`);
  // An unfinished review passes with its warning, even if it already confirmed something.
  if (blocking.length && finished) {
    console.log(`::error title=Bug Hunter::${blocking.length} finding(s) at or above "${FAIL_ON}" severity. See the PR review.`);
    process.exit(1);
  }
}

// GitHub sends SIGINT, then SIGTERM, when a newer run cancels this one.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    if (liveSession) {
      console.log(`${signal}: stopping session ${liveSession}.`);
      await stopSession(liveSession);
    }
    process.exit(2);
  });
}

main().catch(async (err) => {
  console.error(`::error title=Bug Hunter failed::${err.message.split("\n")[0]}`);
  console.error(err);
  if (liveSession) await stopSession(liveSession);
  process.exit(2);
});
