import { describe, expect, it } from "vitest";
import { assess } from "../../.github/bug-hunter/progress.mjs";

const T = (s) => `2026-11-20T${s}Z`;
const ev = (type, at, extra = {}) => ({ type, processed_at: at && T(at), ...extra });
const STALL_MS = 3 * 60_000;
const opts = (at) => ({ now: Date.parse(T(at)), stallMs: STALL_MS });

// Shape of run 3 (sesn_01BvNZE7JRpReioMeQpvHLgn): the lead wakes after the workflow and reports.
const run3 = [
	ev("user.message", "01:26:30"),
	ev("workflow_run.created", "01:26:44", { workflow_run_id: "w" }),
	ev("session.thread_status_terminated", "01:29:04", { session_thread_id: "t" }),
	ev("workflow_run.status_ended", "01:29:05", { workflow_run_id: "w" }),
	ev("span.model_request_start", "01:29:05"),
	ev("agent.message", "01:29:20"),
	ev("session.status_idle", "01:29:21", { stop_reason: { type: "end_turn" } }),
];

// Shape of exam 1 (sesn_0169BWdXnQa1HrxFhqPuvxR1): the workflow ended, the lead never woke.
const frozen = run3.slice(0, 4);
// ...then an interrupt turned the frozen turn into an idle with no report.
const interrupted = [
	...frozen,
	ev("span.model_request_end", "01:37:41"),
	ev("user.interrupt", "01:37:41"),
	ev("session.status_idle", "01:37:41", { stop_reason: { type: "end_turn" } }),
];

describe("assess", () => {
	it("is done when the lead reports after the workflow ends", () => {
		expect(assess(run3, opts("01:29:30")).state).toBe("done");
	});

	it("keeps working while the workflow is still open", () => {
		expect(assess(run3.slice(0, 3), opts("01:40:00")).state).toBe("working");
	});

	it("waits briefly after the workflow ends before calling the lead stalled", () => {
		expect(assess(frozen, opts("01:31:00")).state).toBe("working");
	});

	it("calls the lead stalled when nothing happens for the stall window after the workflow ends", () => {
		expect(assess(frozen, opts("01:32:10")).state).toBe("stalled");
	});

	it("does not call an idle with no report done", () => {
		expect(assess(interrupted, opts("01:37:50")).state).toBe("no_report");
	});

	it("counts a reminder sent after the idle as a new turn", () => {
		const reminded = [...interrupted, ev("user.message", "01:37:51")];
		expect(assess(reminded, opts("01:37:55")).state).toBe("working");
	});

	it("ignores agent messages from worker threads when looking for the report", () => {
		const workerOnly = [...frozen, ev("agent.message", "01:30:00", { session_thread_id: "t" }), ev("session.status_idle", "01:30:01", { stop_reason: { type: "end_turn" } })];
		expect(assess(workerOnly, opts("01:30:05")).state).toBe("no_report");
	});

	it.each([
		["budget_reached", "budget"],
		["requires_action", "blocked"],
	])("maps a %s idle to %s", (reason, state) => {
		const events = [...run3.slice(0, 4), ev("session.status_idle", "01:29:10", { stop_reason: { type: reason } })];
		expect(assess(events, opts("01:29:20")).state).toBe(state);
	});
});

describe("assess without a workflow run", () => {
	it("is done when the lead answers without starting a run, as before", () => {
		const events = [ev("user.message", "01:00:00"), ev("agent.message", "01:00:30"), ev("session.status_idle", "01:00:31", { stop_reason: { type: "end_turn" } })];
		expect(assess(events, opts("01:00:40")).state).toBe("done");
	});

	it("never calls a session stalled before any run has ended", () => {
		expect(assess([ev("user.message", "01:00:00")], opts("02:00:00")).state).toBe("working");
	});
});
