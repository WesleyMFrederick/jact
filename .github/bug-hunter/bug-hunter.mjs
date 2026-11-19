#!/usr/bin/env node
// Bug Hunter: multi-agent PR review on Claude Managed Agents.
//
// 1. Finds or creates the Bug Hunter agent and its cloud environment.
//    Both names carry a hash of their config, so a config change makes new ones.
// 2. Starts a session with the repo mounted at the PR head and the PR diff in the message.
//    The agent runs a dynamic workflow: split -> read -> second look -> pick -> prove -> report.
// 3. Polls until every workflow run has ended and the session idles with end_turn.
// 4. Posts the confirmed findings as one PR review with inline comments.
//
// Env: ANTHROPIC_API_KEY, GITHUB_TOKEN, GITHUB_REPOSITORY (owner/name), PR_NUMBER.
// Optional: REPO_TOKEN (repo mount, private repos only; never set by default), BUG_HUNTER_MODEL,
// BUDGET_CENTS (default 300 = $3.00), FAIL_ON (high|medium|low|none, default high),
// TIMEOUT_MINUTES (default 50), DRY_RUN=1 (print the review instead of posting it).
//
// Exit codes: 0 no blocking findings, 1 blocking findings, 2 the review itself failed.

import { createHash } from "node:crypto";
import { readFileSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

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
const BUDGET_CENTS = String(Number(process.env.BUDGET_CENTS || 300));
const FAIL_ON = process.env.FAIL_ON || "high";
const TIMEOUT_MS = Number(process.env.TIMEOUT_MINUTES || 50) * 60_000;
const DRY_RUN = process.env.DRY_RUN === "1";
const MOUNT_PATH = "/workspace/repo";
const POLL_MS = 15_000;
const MAX_DIFF_CHARS = 400_000;

const SEVERITY_RANK = { high: 3, medium: 2, low: 1, none: 99 };
const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });

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
  return accept.includes("diff") ? res.text() : res.json();
}

// Lines on the new side of the diff that GitHub accepts inline comments on.
async function commentableLines() {
  const lines = new Map();
  for (let page = 1; ; page++) {
    const files = await gh(`/repos/${REPO}/pulls/${PR_NUMBER}/files?per_page=100&page=${page}`);
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
    if (files.length < 100) return lines;
  }
}

// ---------- Managed Agents setup ----------

const systemPrompt = readFileSync(join(here, "system-prompt.md"), "utf8");
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

function userMessage(pr, diff) {
  const clipped = diff.length > MAX_DIFF_CHARS;
  return [
    `Review pull request #${PR_NUMBER} in ${REPO}: "${pr.title}".`,
    `The repository is mounted at ${MOUNT_PATH}, checked out at the PR head commit ${pr.head.sha}.`,
    `The PR merges ${pr.head.ref} into ${pr.base.ref} (base commit ${pr.base.sha}).`,
    "",
    "PR description:",
    pr.body || "(none)",
    "",
    clipped
      ? `The diff is ${diff.length} characters, so it is cut at ${MAX_DIFF_CHARS}. List the changed files with git in the mounted repo to cover the rest.`
      : "Full unified diff:",
    "```diff",
    diff.slice(0, MAX_DIFF_CHARS),
    "```",
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
  report.findings = Array.isArray(report.findings) ? report.findings : [];
  return report;
}

// ---------- Report ----------

function formatFinding(f) {
  return `**[${String(f.severity).toUpperCase()}] ${f.title}**\n\n${f.body}\n\n<sub>Bug Hunter (Claude Managed Agents)</sub>`;
}

async function postReview(pr, report, sessionId, note) {
  const lines = await commentableLines();
  const inline = [];
  const elsewhere = [];
  for (const f of report.findings) {
    if (lines.get(f.file)?.has(Number(f.line))) inline.push({ path: f.file, line: Number(f.line), side: "RIGHT", body: formatFinding(f) });
    else elsewhere.push(f);
  }
  const counts = ["high", "medium", "low"].map((s) => `${report.findings.filter((f) => f.severity === s).length} ${s}`).join(", ");
  const body = [
    `## Bug Hunter: ${report.findings.length ? counts : "no confirmed bugs"}`,
    "",
    report.summary || "",
    note ? `\n> ${note}` : "",
    report.not_covered?.length ? `\nNot covered: ${report.not_covered.join(", ")}` : "",
    ...elsewhere.map((f) => `\n---\n\`${f.file}:${f.line}\`\n\n${formatFinding(f)}`),
    `\n<sub>Managed Agents session \`${sessionId}\` · model \`${MODEL}\` · budget $${(Number(BUDGET_CENTS) / 100).toFixed(2)}</sub>`,
  ].join("\n");

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) appendFileSync(summaryPath, `${body}\n`);
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

async function main() {
  const pr = await gh(`/repos/${REPO}/pulls/${PR_NUMBER}`);
  const diff = await gh(`/repos/${REPO}/pulls/${PR_NUMBER}`, { accept: "application/vnd.github.v3.diff" });
  const [agentId, environmentId] = await Promise.all([ensureAgent(), ensureEnvironment()]);

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
    ],
  });
  console.log(`Session ${session.id} started for ${REPO}#${PR_NUMBER} (budget ${BUDGET_CENTS} cents).`);
  await client.beta.sessions.events.send(session.id, {
    events: [{ type: "user.message", content: [{ type: "text", text: userMessage(pr, diff) }] }],
  });

  const deadline = Date.now() + TIMEOUT_MS;
  let verdict = { state: "working" };
  let events = [];
  let seen = 0;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const current = await client.beta.sessions.retrieve(session.id);
    if (current.status === "terminated") throw new Error(`Session ${session.id} terminated.`);
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

  let note = "";
  if (verdict.state === "working") note = `Timed out after ${TIMEOUT_MS / 60000} minutes; findings may be partial.`;
  if (verdict.state === "budget") note = `Stopped at the $${(Number(BUDGET_CENTS) / 100).toFixed(2)} session budget; findings may be partial.`;
  if (verdict.state === "blocked") throw new Error(`Session ${session.id} is waiting on a tool confirmation; check the agent's permission policy.`);
  if (verdict.state !== "done") {
    await client.beta.sessions.archive(session.id).catch(() => {});
  }

  let report;
  try {
    report = parseReport(finalText(events));
  } catch (err) {
    if (verdict.state === "done") throw err;
    report = { summary: "The review did not finish, so there is no report.", findings: [] };
  }
  await postReview(pr, report, session.id, note);

  const threshold = SEVERITY_RANK[FAIL_ON] ?? SEVERITY_RANK.high;
  const blocking = report.findings.filter((f) => (SEVERITY_RANK[f.severity] ?? 0) >= threshold);
  if (note) console.log(`::warning title=Bug Hunter::${note}`);
  if (blocking.length) {
    console.log(`::error title=Bug Hunter::${blocking.length} finding(s) at or above "${FAIL_ON}" severity. See the PR review.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`::error title=Bug Hunter failed::${err.message.split("\n")[0]}`);
  console.error(err);
  process.exit(2);
});
