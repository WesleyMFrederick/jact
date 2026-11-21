// Parses and validates the agent's final report. Kept apart from bug-hunter.mjs so tests can load it
// without starting a session.

export function parseReport(text) {
  // Fences count only on their own line. A JSON string cannot hold a raw newline, so a finding body
  // that quotes code (```js ... ```) never starts a line and cannot cut the block short.
  const blocks = [...text.matchAll(/^```json[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/gm)];
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
