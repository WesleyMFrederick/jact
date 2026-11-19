#!/usr/bin/env node
// Scores answer-key bugs with RICE-style value and prints a table plus recall for one run.
//
//   value = reach (per-run probability) x impact ($) x confidence x horizon (runs)
//   delay = (fix_wall_minutes / 60) x blocked work items x delay_usd_per_item_hour   (open bugs only)
//   label = fix if value + delay >= fix cost (S/M/L bin); later if >= later_ratio x fix cost
//
// Effort is shown as two separate quantities: model dollars (fix_model_usd) and wall-clock
// minutes (fix_wall_minutes). Neither is folded into the S/M/L fix cost. Blocking bugs sort first.
// All of these rules are provisional assumptions, set in the JSON's params, not facts.
//
// The model never computes this. Bins come from the scored JSON; prices, horizon, confidence
// map and label thresholds come from its `params` block, which the user owns.
//
// Usage:
//   node score.mjs <scored.json> [--run run3] [--caught F3,F4] [--ineligible F1,F2] [--exclude F12]
//
// --run reads caught and ineligible ids from the JSON's `runs` block; --caught and
// --ineligible override it. --exclude drops ids from the recall denominator and numerator,
// to show how much one bug's bin drives the headline number.
// Deterministic: Node builtins only, stable sort by value then id, fixed rounding.

import { readFileSync, realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const [file, ...rest] = argv;
  if (!file) throw new Error("usage: node score.mjs <scored.json> [--run id] [--caught ids] [--ineligible ids] [--exclude ids]");
  const opts = { file };
  for (let i = 0; i < rest.length; i += 2) {
    const flag = rest[i];
    const value = rest[i + 1] ?? "";
    if (!["--run", "--caught", "--ineligible", "--exclude"].includes(flag)) throw new Error(`unknown flag ${flag}`);
    opts[flag.slice(2)] = value;
  }
  return opts;
}

const ids = (s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);

function lookup(table, key, what, id) {
  if (!(key in table)) throw new Error(`${id}: unknown ${what} "${key}"`);
  return table[key];
}

export function score(data, { caught = [], ineligible = [], exclude = [] } = {}) {
  const p = data.params;
  const ratio = p.labels.later_ratio;
  const rows = data.bugs.map((b) => {
    const reach = lookup(p.reach_per_run, b.reach, "reach bin", b.id);
    const impact = lookup(p.impact_usd, b.impact, "impact class", b.id);
    const conf = lookup(p.confidence, b.confidence, "confidence tier", b.id);
    const cost = lookup(p.fix_cost_usd, b.fix, "fix size", b.id);
    const value = reach * impact * conf * p.horizon_runs;
    const blocks = Array.isArray(b.blocks) ? b.blocks : [];
    for (const w of blocks) lookup(p.work_items ?? {}, w, "work item", b.id);
    const blocking = blocks.length > 0 && b.status !== "fixed";
    const wall = Number(b.fix_wall_minutes ?? 0);
    const delay = blocking ? (wall / 60) * blocks.length * Number(p.delay_usd_per_item_hour ?? 0) : 0;
    const worth = value + delay;
    const label = worth >= cost ? "fix" : worth >= cost * ratio ? "later" : "not-worth-it";
    return {
      id: b.id,
      status: b.status ?? "",
      reach: b.reach,
      impact: b.impact,
      confidence: b.confidence,
      fix: b.fix,
      value,
      delay,
      cost,
      modelUsd: Number(b.fix_model_usd ?? 0),
      wall,
      blocks,
      blocking,
      label,
      eligible: !ineligible.includes(b.id),
      caught: caught.includes(b.id),
    };
  });
  rows.sort(
    (a, b) =>
      Number(b.blocking) - Number(a.blocking) ||
      b.value + b.delay - (a.value + a.delay) ||
      a.id.localeCompare(b.id, "en", { numeric: true }),
  );

  const pool = rows.filter((r) => r.eligible && !exclude.includes(r.id));
  const hit = pool.filter((r) => r.caught);
  const sum = (rs) => rs.reduce((t, r) => t + r.value, 0);
  return {
    rows,
    recall: {
      eligible: pool.length,
      caught: hit.length,
      count: pool.length ? hit.length / pool.length : 0,
      valueCaught: sum(hit),
      valueTotal: sum(pool),
      value: sum(pool) ? sum(hit) / sum(pool) : 0,
      excluded: exclude,
    },
  };
}

const money = (n) => `$${n.toFixed(2)}`;
const pct = (n) => `${(n * 100).toFixed(1)}%`;

function render({ rows, recall }, provisional) {
  const head = ["id", "status", "reach", "impact", "conf", "value", "blocks", "delay", "size", "fix cost", "fix model $", "fix wall", "label", "eligible", "caught"];
  const body = rows.map((r) => [
    r.id, r.status, r.reach, r.impact, r.confidence, money(r.value),
    r.blocks.length ? `${r.blocking ? "BLOCKING " : ""}${r.blocks.join(",")}` : "-", money(r.delay),
    r.fix, money(r.cost), money(r.modelUsd), `${r.wall} min`, r.label,
    r.eligible ? "yes" : "no", r.eligible ? (r.caught ? "yes" : "no") : "-",
  ]);
  const lines = [
    `| ${head.join(" | ")} |`,
    `| ${head.map(() => "---").join(" | ")} |`,
    ...body.map((c) => `| ${c.join(" | ")} |`),
    "",
    `Count recall: ${recall.caught}/${recall.eligible} = ${pct(recall.count)}`,
    `Value-weighted recall: ${money(recall.valueCaught)}/${money(recall.valueTotal)} = ${pct(recall.value)}`,
  ];
  if (recall.excluded.length) lines.push(`(excluding ${recall.excluded.join(", ")} from both)`);
  if (provisional) lines.push("Prices, horizon, confidence map, thresholds, delay rate, work items and fix estimates are PROVISIONAL.");
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const opts = parseArgs(process.argv.slice(2));
  const data = JSON.parse(readFileSync(opts.file, "utf8"));
  const run = opts.run ? data.runs?.[opts.run] : undefined;
  if (opts.run && !run) throw new Error(`no run "${opts.run}" in ${opts.file}`);
  const result = score(data, {
    caught: opts.caught !== undefined ? ids(opts.caught) : run?.caught ?? [],
    ineligible: opts.ineligible !== undefined ? ids(opts.ineligible) : run?.ineligible ?? [],
    exclude: ids(opts.exclude),
  });
  console.log(render(result, data.params.provisional));
}
