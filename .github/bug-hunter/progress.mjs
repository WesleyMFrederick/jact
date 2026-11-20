// Decides from session events whether a Bug Hunter session is done.
//
// Done means: every workflow run seen has ended, the session then idled with end_turn, and the
// lead (the primary thread, no session_thread_id) wrote a message after the last run ended.
// https://platform.claude.com/docs/en/managed-agents/workflow-runs#know-when-the-work-is-done
//
// Two failures seen in exam 1 (sesn_0169BWdXnQa1HrxFhqPuvxR1) get their own states:
// - stalled: the last run ended, the lead never woke, and no event arrived for stallMs.
// - no_report: the session idled after the last run without a lead message (an interrupt does this),
//   or idled before the last run ended and stayed silent for stallMs after it.
// The runner answers each once: an interrupt for stalled, a "write the report" message for no_report.
export function assess(events, { now = Date.now(), stallMs = 3 * 60_000 } = {}) {
  const open = new Set();
  let lastRunEnd = -1;
  let lastIdle;
  let lastUserMessage = -1;
  let lastLeadMessage = -1;
  let lastEventAt = 0;
  events.forEach((e, i) => {
    if (e.type === "user.message") lastUserMessage = i;
    if (e.type === "agent.message" && !e.session_thread_id) lastLeadMessage = i;
    if (e.type === "workflow_run.created") open.add(e.workflow_run_id);
    if (e.type === "workflow_run.status_ended") { open.delete(e.workflow_run_id); lastRunEnd = i; }
    if (e.type === "session.status_idle") lastIdle = { index: i, reason: e.stop_reason?.type };
    const at = Date.parse(e.processed_at ?? "");
    if (at > lastEventAt) lastEventAt = at;
  });
  const runsDone = open.size === 0;
  const reported = lastLeadMessage > lastRunEnd;
  // A message sent after the last idle (such as the wrap-up request) starts a new turn.
  if (!lastIdle || lastUserMessage > lastIdle.index) {
    if (lastRunEnd >= 0 && runsDone && !reported && lastRunEnd > lastUserMessage && now - lastEventAt >= stallMs) return { state: "stalled" };
    return { state: "working" };
  }
  if (lastIdle.reason === "budget_reached") return { state: "budget" };
  if (lastIdle.reason === "requires_action") return { state: "blocked" };
  // The docs leave a refusal for the caller to handle; waiting cannot change it.
  if (lastIdle.reason === "refusal") return { state: "refused" };
  if (lastIdle.reason === "end_turn" && runsDone && lastIdle.index > lastRunEnd) return { state: reported ? "done" : "no_report" };
  // The lead may end its turn while a run is still open; the run's end should wake it. If it stays
  // silent for stallMs after that, it is idle with no report (seen in Bug Hunter's PR #135 review).
  if (lastIdle.reason === "end_turn" && runsDone && lastRunEnd > lastIdle.index && !reported && now - lastEventAt >= stallMs) return { state: "no_report" };
  return { state: "working", reason: lastIdle.reason };
}
