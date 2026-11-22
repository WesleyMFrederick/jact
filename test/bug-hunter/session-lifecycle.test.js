import { describe, expect, it, vi } from "vitest";
import { createSessionLifecycle } from "../../.github/bug-hunter/session-lifecycle.mjs";

// The lifecycle owns every cleanup the runner does on its way out: finishing or failing
// (graceful) and GitHub's cancel signals (fast). These tests drive it through a fake SDK with
// real promises and short deadlines; no paid service is called. Signal and error labels map
// to the requestShutdown mode the runner passes; the real-runner tests cover the handlers.

const TITLE = "Bug Hunter test/repo#1 @ 0123456";
// The matrix releases each pending call about 10 ms after the second trigger, well inside
// these deadlines, so every service answer arrives in time and cleanup should succeed.
const MATRIX = { gracefulMs: 1_500, fastMs: 400, requestMs: 250, pollMs: 50 };
const SHORT = { gracefulMs: 500, fastMs: 120, requestMs: 30, pollMs: 100 };
const RANK = { none: 0, graceful: 1, fast: 2 };
const FIRST = { finish: "graceful", "setup-error": "graceful", "poll-error": "graceful", SIGINT: "fast", SIGTERM: "fast" };
const SECOND = { SIGINT: "fast", SIGTERM: "fast", error: "graceful", finish: "graceful" };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// A service that never answers, even after the request is aborted.
const never = () => new Promise(() => {});

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

// Rejects with a clear message well before Vitest's own timeout.
async function within(promise, ms, label) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} did not settle within ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([promise, guard]);
  } finally {
    clearTimeout(timer);
  }
}

async function until(check, label, ms = 2_000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${label}`);
    await sleep(2);
  }
}

// Fake Anthropic client with the SDK's argument order: create/upload/list take options second;
// retrieve/archive/delete/events.send take them third. SDK calls are recorded with `sdk: true`;
// "uploaded", "created", "archived" and "deleted" mark the moment the service answered.
function fakeClient({ upload, create, retrieve, send, archive, remove, interruptStops = true, requireIdle = false, listTail = false } = {}) {
  const calls = [];
  const server = new Map();
  let uploads = 0;
  const sdk = (op, id, options, extra = {}) => calls.push({ op, id, options, sdk: true, ...extra });
  const mark = (op, id) => calls.push({ op, id });
  const addSession = (session) => {
    const stored = { status: "idle", archived_at: null, ...session };
    server.set(stored.id, stored);
    return stored;
  };
  const files = {
    async upload(params, options) {
      const id = `file_${++uploads}`;
      sdk("upload", id, options, { name: params?.file?.name });
      await upload?.(id, params);
      mark("uploaded", id);
      return { id, filename: params?.file?.name };
    },
    async delete(id, _params, options) {
      sdk("delete", id, options);
      await remove?.(id);
      mark("deleted", id);
      return { id, type: "file_deleted" };
    },
  };
  const sessions = {
    async create(params, options) {
      sdk("create", params?.title, options);
      const spec = await create?.(params, addSession);
      const session = addSession({ id: "sesn_1", title: params.title, ...spec });
      mark("created", session.id);
      return { ...session };
    },
    async retrieve(id, _params, options) {
      sdk("retrieve", id, options);
      const session = server.get(id);
      if (!session) throw Object.assign(new Error(`no session ${id}`), { status: 404 });
      await retrieve?.(id, session, options);
      return { ...session };
    },
    async archive(id, _params, options) {
      sdk("archive", id, options);
      const session = server.get(id);
      if (requireIdle && session?.status !== "idle") {
        throw Object.assign(new Error("session is running"), { status: 400 });
      }
      await archive?.(id, session, options);
      if (session) Object.assign(session, { status: "idle", archived_at: new Date().toISOString() });
      mark("archived", id);
      return { ...session };
    },
    // Newest first, like the service. With listTail the list never ends: lookup must be bounded.
    list(_params, options) {
      sdk("list", undefined, options);
      const snapshot = [...server.values()].reverse().map((s) => ({ ...s }));
      async function* items() {
        yield* snapshot;
        for (let i = 0; listTail; i++) {
          if (options?.signal?.aborted) throw options.signal.reason ?? new Error("aborted");
          await new Promise(setImmediate);
          yield { id: `sesn_unrelated_${i}`, title: `Unrelated ${i}`, status: "running", archived_at: null };
        }
      }
      const iterator = items();
      return { data: snapshot, [Symbol.asyncIterator]: () => iterator };
    },
    events: {
      async send(id, params, options) {
        const types = (params?.events ?? []).map((e) => e.type);
        sdk("send", id, options, { events: types });
        await send?.(id, types, server.get(id), options);
        if (interruptStops && types.includes("user.interrupt")) {
          const session = server.get(id);
          if (session) session.status = "idle";
        }
        return {};
      },
    },
  };
  const ops = (op) => calls.filter((c) => c.op === op);
  return {
    client: { beta: { files, sessions }, files, sessions },
    calls,
    addSession,
    ops,
    ids: (op) => ops(op).map((c) => c.id),
    index: (op, id) => calls.findIndex((c) => c.op === op && c.id === id),
  };
}

function logger() {
  const lines = [];
  return { lines, log: (...args) => lines.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(" ")) };
}

const params = () => ({ title: TITLE, agent: "agent_test", environment_id: "env_test", resources: [] });
const uploadTwo = (life) => Promise.all([life.upload({ name: "helper.mjs" }), life.upload({ name: "s1.diff" })]);

function expectBoundedRequests(calls) {
  for (const c of calls.filter((call) => call.sdk)) {
    const label = `${c.op} ${c.id ?? ""}`;
    expect(c.options?.signal, `${label} has an AbortSignal`).toBeInstanceOf(AbortSignal);
    expect(c.options.maxRetries, `${label} does not retry`).toBe(0);
    expect(c.options.timeout, `${label} has a timeout`).toBeGreaterThan(0);
  }
}

// Each moment leaves one call pending (or a session running) when the first trigger arrives.
const MOMENTS = {
  "pending upload": {
    fake: (gate) => ({ upload: (id) => (id === "file_2" ? gate.promise : undefined) }),
    async reach(life, fake) {
      await life.upload({ name: "helper.mjs" });
      life.upload({ name: "s1.diff" }).catch(() => {});
      await until(() => fake.ops("upload").length === 2, "the second upload to start");
    },
    // No session exists yet, so there is nothing to archive.
    archived: [],
  },
  "pending create": {
    fake: (gate) => ({
      create: async () => {
        await gate.promise;
        return { id: "sesn_late" };
      },
    }),
    async reach(life, fake) {
      await uploadTwo(life);
      life.createSession(params()).catch(() => {});
      await until(() => fake.ops("create").length === 1, "creation to start");
    },
    archived: ["sesn_late"],
  },
  "running session": {
    fake: () => ({ create: async () => ({ id: "sesn_run", status: "running" }) }),
    async reach(life) {
      await uploadTwo(life);
      await life.createSession(params());
    },
    archived: ["sesn_run"],
  },
  "pending archive": {
    fake: (gate) => ({ create: async () => ({ id: "sesn_arch" }), archive: () => gate.promise }),
    async reach(life) {
      await uploadTwo(life);
      await life.createSession(params());
    },
    afterFirst: (fake) => until(() => fake.ops("archive").length === 1, "the archive request"),
    archived: ["sesn_arch"],
  },
};

const rows = Object.keys(FIRST).flatMap((first) =>
  Object.keys(MOMENTS).flatMap((moment) => Object.keys(SECOND).map((second) => ({ first, moment, second }))),
);

describe("Bug Hunter session lifecycle", () => {
  it.each(rows)("$first during $moment, then $second", async ({ first, moment, second }) => {
    const gate = deferred();
    const m = MOMENTS[moment];
    const fake = fakeClient(m.fake(gate));
    const { log } = logger();
    const life = createSessionLifecycle(fake.client, { ...MATRIX, log });
    await m.reach(life, fake);
    const started = { upload: fake.ops("upload").length, create: fake.ops("create").length };
    expect(life.mode).toBe("none");

    const stopping = life.requestShutdown(FIRST[first]);
    let resolvedAt;
    stopping.then(
      () => {
        resolvedAt = fake.calls.length;
      },
      () => {},
    );
    expect(life.mode).toBe(FIRST[first]);
    await m.afterFirst?.(fake);

    expect(life.requestShutdown(SECOND[second])).toBe(stopping);
    const mode = RANK[SECOND[second]] > RANK[FIRST[first]] ? SECOND[second] : FIRST[first];
    expect(life.mode).toBe(mode);

    // New work while stopping is refused without reaching the service.
    await within(expect(life.upload({ name: "late.diff" })).rejects.toThrow(), 1_000, "a refused upload");
    await within(expect(life.createSession(params())).rejects.toThrow(), 1_000, "a refused creation");

    await sleep(10);
    gate.resolve();
    const result = await within(stopping, (mode === "fast" ? MATRIX.fastMs : MATRIX.gracefulMs) + 250, "shutdown");

    expect(result).toMatchObject({ ok: true });
    expect(life.mode).toBe(mode);
    expect(fake.ops("upload")).toHaveLength(started.upload);
    expect(fake.ops("create")).toHaveLength(started.create);

    // Each known resource is cleaned up exactly once, before shutdown resolves.
    expect(fake.ids("archive")).toEqual(m.archived);
    const uploaded = fake.ids("uploaded").sort();
    expect(uploaded).toEqual(["file_1", "file_2"]);
    expect(fake.ids("delete").sort()).toEqual(uploaded);
    expect(fake.ids("deleted").sort()).toEqual(uploaded);
    for (const id of uploaded) expect(fake.index("deleted", id)).toBeLessThan(resolvedAt);
    for (const id of m.archived) {
      // The archive answered, so deletion waits for that answer.
      const archived = fake.index("archived", id);
      expect(archived).toBeGreaterThanOrEqual(0);
      expect(archived).toBeLessThan(resolvedAt);
      for (const fileId of uploaded) expect(fake.index("delete", fileId)).toBeGreaterThan(archived);
    }
    expectBoundedRequests(fake.calls);

    // A trigger after cleanup still gets the same promise and starts nothing new.
    const callCount = fake.calls.length;
    expect(life.requestShutdown("fast")).toBe(stopping);
    expect(life.requestShutdown("graceful")).toBe(stopping);
    await sleep(20);
    expect(fake.calls.slice(callCount).filter((c) => c.sdk)).toEqual([]);
  });

  it.each(["running", "idle"])("does not start an idle lead while the overall session is %s", async (status) => {
    let newTurns = 0;
    let archives = 0;
    const fake = fakeClient({
      create: async () => ({ status }),
      requireIdle: true,
      send: (_id, types, session) => {
        if (types.includes("user.message")) {
          newTurns++;
          session.status = "running";
        }
      },
      archive: () => {
        if (++archives === 1) throw Object.assign(new Error("busy"), { status: 409 });
      },
    });
    const { log } = logger();
    const life = createSessionLifecycle(fake.client, { ...SHORT, pollMs: 5, log });
    await life.createSession(params());
    const result = await life.requestShutdown("fast");
    expect(newTurns).toBe(0);
    expect(result).toEqual({ ok: true });
    expect(fake.ids("archived")).toEqual(["sesn_1"]);
    expect(fake.ops("send").map((call) => call.events)).toEqual(
      status === "running" ? [["user.interrupt"]] : [],
    );
  });

  it.each(["stops", "stays open"])("uses one stop fallback and one archive retry when a workflow %s", async (outcome) => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      let stopMessages = 0;
      let archives = 0;
      const fake = fakeClient({
        send: (_id, types, session) => {
          if (types.includes("user.message")) {
            stopMessages++;
            session.status = "running";
            setTimeout(() => { session.status = "idle"; }, 25);
          }
        },
        archive: () => {
          if (++archives === 1 || !stopMessages || outcome === "stays open") {
            throw Object.assign(new Error("open workflow"), {
              status: 400, error: { error: { details: { error_code: "workflow_run_open" } } },
            });
          }
        },
        requireIdle: true,
      });
      const { log } = logger();
      const life = createSessionLifecycle(fake.client, { ...SHORT, pollMs: 10, log });
      await uploadTwo(life);
      await life.createSession(params());
      const stopping = life.requestShutdown("graceful");
      await vi.advanceTimersByTimeAsync(SHORT.gracefulMs);
      expect(await stopping).toEqual({ ok: outcome === "stops" });
      expect(stopMessages).toBe(1);
      expect(archives).toBe(2);
      const sends = fake.ops("send");
      expect(sends.map((call) => call.events)).toEqual([["user.message"]]);
      expect(fake.index("send", "sesn_1")).toBeGreaterThan(fake.index("archive", "sesn_1"));
      expect(fake.ids("deleted").sort()).toEqual(["file_1", "file_2"]);
      await vi.advanceTimersByTimeAsync(SHORT.gracefulMs);
      expect(archives).toBe(2);
      expect(stopMessages).toBe(1);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it.each([
    { mode: "graceful", deadline: 30_000, archiveDelay: 0, stopDelay: 100, firstArchive: 22_500 },
    { mode: "fast", deadline: 2_000, archiveDelay: 150, stopDelay: 25, firstArchive: 1_500 },
  ])("reserves an archive retry after the stop fallback with default $mode timing", async ({ mode, deadline, archiveDelay, stopDelay, firstArchive }) => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      const archiveTimes = [];
      let stopMessages = 0;
      const fake = fakeClient({
        create: () => ({ status: "running" }),
        interruptStops: false,
        send: (_id, types, session) => {
          if (types.includes("user.message")) {
            stopMessages++;
            setTimeout(() => { session.status = "idle"; }, stopDelay);
          }
        },
        archive: async () => {
          archiveTimes.push(Date.now());
          if (archiveTimes.length === 1) {
            await sleep(archiveDelay);
            throw Object.assign(new Error("open workflow"), {
              status: 400, error: { error: { details: { error_code: "workflow_run_open" } } },
            });
          }
        },
      });
      const { log } = logger();
      const life = createSessionLifecycle(fake.client, { log });
      await uploadTwo(life);
      await life.createSession(params());
      const stopping = life.requestShutdown(mode);
      await vi.advanceTimersByTimeAsync(deadline);
      expect(await stopping).toEqual({ ok: true });
      expect(stopMessages).toBe(1);
      expect(archiveTimes).toHaveLength(2);
      expect(archiveTimes[0]).toBe(firstArchive);
      expect(archiveTimes[1]).toBeLessThan(deadline - deadline / 8);
      expect(fake.ids("archived")).toEqual(["sesn_1"]);
      expect(fake.ids("deleted").sort()).toEqual(["file_1", "file_2"]);
      await vi.advanceTimersByTimeAsync(deadline);
      expect(archiveTimes).toHaveLength(2);
      expect(stopMessages).toBe(1);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it.each([0, 2_000, 10_000])("sends the archive retry before the cutoff with a %ims fallback lookup", async (lookupDelay) => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      const archiveTimes = [];
      const lookupTimes = [];
      let stopMessages = 0;
      const fake = fakeClient({
        create: () => ({ status: "running" }),
        interruptStops: false,
        send: (_id, types, session) => {
          if (types.includes("user.message")) {
            stopMessages++;
            setTimeout(() => { session.status = "idle"; }, 100);
          }
        },
        retrieve: async (_id, _session, options) => {
          if (stopMessages) {
            lookupTimes.push({ at: Date.now(), options });
            await sleep(lookupDelay);
          }
        },
        archive: (_id, session) => {
          archiveTimes.push(Date.now());
          if (archiveTimes.length === 1 || session.status !== "idle") {
            throw Object.assign(new Error("open workflow"), {
              status: 400, error: { error: { details: { error_code: "workflow_run_open" } } },
            });
          }
        },
      });
      const { log } = logger();
      const life = createSessionLifecycle(fake.client, { log });
      await uploadTwo(life);
      await life.createSession(params());
      const stopping = life.requestShutdown("graceful");
      await vi.advanceTimersByTimeAsync(30_000);
      expect(archiveTimes).toHaveLength(2);
      expect(archiveTimes[0]).toBe(22_500);
      expect(archiveTimes[1]).toBeGreaterThanOrEqual(22_600);
      expect(archiveTimes[1]).toBeLessThan(26_250);
      expect(lookupTimes.length).toBeGreaterThan(0);
      expect(lookupTimes[0].at).toBeLessThan(archiveTimes[1]);
      if (lookupDelay === 10_000) expect(lookupTimes[0].options.signal.aborted).toBe(true);
      expect(await stopping).toEqual({ ok: true });
      expect(stopMessages).toBe(1);
      expect(fake.ids("archived")).toEqual(["sesn_1"]);
      expect(fake.ids("deleted").sort()).toEqual(["file_1", "file_2"]);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(archiveTimes).toHaveLength(2);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it.each([
    { mode: "graceful", deadline: 30_000, archiveDelay: 0, stopDelay: 100 },
    { mode: "fast", deadline: 2_000, archiveDelay: 150, stopDelay: 25 },
  ])("reserves the archive retry when the $mode stop message never settles", async ({ mode, deadline, archiveDelay, stopDelay }) => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      const archiveTimes = [];
      let stopMessages = 0;
      let stopOptions;
      const fake = fakeClient({
        create: () => ({ status: "running" }),
        interruptStops: false,
        send: (_id, types, session, options) => {
          if (types.includes("user.message")) {
            stopMessages++;
            stopOptions = options;
            setTimeout(() => { session.status = "idle"; }, stopDelay);
            return never();
          }
        },
        archive: async (_id, session) => {
          archiveTimes.push(Date.now());
          if (archiveTimes.length === 1) {
            await sleep(archiveDelay);
            throw Object.assign(new Error("open workflow"), {
              status: 400, error: { error: { details: { error_code: "workflow_run_open" } } },
            });
          }
          expect(session.status).toBe("idle");
        },
      });
      const { log } = logger();
      const life = createSessionLifecycle(fake.client, { log });
      await uploadTwo(life);
      await life.createSession(params());
      const stopping = life.requestShutdown(mode);
      await vi.advanceTimersByTimeAsync(deadline);
      expect(archiveTimes).toHaveLength(2);
      expect(archiveTimes[1]).toBeLessThan(deadline - deadline / 8);
      expect(stopMessages).toBe(1);
      expect(stopOptions.signal.aborted).toBe(true);
      expect(await stopping).toEqual({ ok: true });
      expect(fake.ids("archived")).toEqual(["sesn_1"]);
      expect(fake.ids("deleted").sort()).toEqual(["file_1", "file_2"]);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it.each(["upload", "create"])("waits for a 1.5s in-flight %s during graceful cleanup", async (stage) => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      const fake = fakeClient({
        upload: () => (stage === "upload" ? sleep(1_500) : undefined),
        create: () => sleep(1_500),
      });
      const { lines, log } = logger();
      const life = createSessionLifecycle(fake.client, { log });
      const pending = stage === "upload"
        ? life.upload({ name: "helper.mjs" })
        : life.createSession(params());
      const stopping = life.requestShutdown("graceful");
      // Attach before advancing: the old one-second cutoff rejects pending setup.
      const setup = pending.catch(() => {});
      await vi.advanceTimersByTimeAsync(1_500);
      await setup;
      expect(fake.ids(stage === "upload" ? "deleted" : "archived")).toEqual(
        [stage === "upload" ? "file_1" : "sesn_1"],
      );
      expect(await stopping).toEqual({ ok: true });
      expect(lines).toEqual([]);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("confirms graceful cleanup when each service request takes 1.5s", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      const fake = fakeClient({
        create: async () => ({ status: "running" }),
        retrieve: () => sleep(1_500),
        send: () => sleep(1_500),
        archive: () => sleep(1_500),
        remove: () => sleep(1_500),
        requireIdle: true,
      });
      const { lines, log } = logger();
      const life = createSessionLifecycle(fake.client, { log });
      await uploadTwo(life);
      await life.createSession(params());
      const stopping = life.requestShutdown("graceful");
      await vi.advanceTimersByTimeAsync(30_000);
      expect(await stopping).toEqual({ ok: true });
      expect(fake.ids("archived")).toEqual(["sesn_1"]);
      expect(fake.ids("deleted").sort()).toEqual(["file_1", "file_2"]);
      const cleanupCalls = fake.calls.filter((call) => call.sdk && call.op !== "upload" && call.op !== "create");
      expect(cleanupCalls.every((call) => !call.options.signal.aborted)).toBe(true);
      expect(lines).toEqual([]);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("confirms cleanup after one transient polling failure followed by idle and archival", async () => {
    let reads = 0;
    const fake = fakeClient({
      create: async () => ({ status: "running" }),
      interruptStops: false,
      requireIdle: true,
      retrieve: (_id, session) => {
        if (++reads === 2) throw new Error("transient 503");
        if (reads >= 3) session.status = "idle";
      },
    });
    const { lines, log } = logger();
    const life = createSessionLifecycle(fake.client, { ...SHORT, pollMs: 5, log });
    await uploadTwo(life);
    await life.createSession(params());
    const result = await life.requestShutdown("fast");
    expect(fake.ids("archived")).toEqual(["sesn_1"]);
    expect(fake.ids("deleted").sort()).toEqual(["file_1", "file_2"]);
    expect(lines.join("\n")).toContain("transient 503");
    expect(result).toEqual({ ok: true });
  });

  it("waits for a delayed interrupt to make the session idle before fast archival", async () => {
    const fake = fakeClient({
      create: async () => ({ status: "running" }),
      interruptStops: false,
      requireIdle: true,
      send: (_id, types, session) => {
        if (types.includes("user.interrupt")) setTimeout(() => { session.status = "idle"; }, 50);
      },
    });
    const { log } = logger();
    const life = createSessionLifecycle(fake.client, { gracefulMs: 1_000, fastMs: 400, requestMs: 60, pollMs: 10, log });
    await uploadTwo(life);
    await life.createSession(params());
    expect(await within(life.requestShutdown("fast"), 650, "delayed interrupt shutdown")).toEqual({ ok: true });
    expect(fake.ids("archived")).toEqual(["sesn_1"]);
    expect(fake.ids("archive")).toEqual(["sesn_1"]);
    expect(fake.ids("deleted").sort()).toEqual(["file_1", "file_2"]);
  });

  it("retries the 1.5s busy archive when the interrupt takes effect at 1.6s within the 2s fast budget", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      const fake = fakeClient({
        create: async () => ({ status: "running" }),
        interruptStops: false,
        requireIdle: true,
        send: (_id, types, session) => {
          if (types.includes("user.interrupt")) setTimeout(() => { session.status = "idle"; }, 1_600);
        },
      });
      const { lines, log } = logger();
      const life = createSessionLifecycle(fake.client, { log });
      await uploadTwo(life);
      await life.createSession(params());
      let result;
      let completedAt;
      const stopping = life.requestShutdown("fast");
      const settled = stopping.then((value) => { result = value; completedAt = Date.now(); });
      await vi.advanceTimersByTimeAsync(1_499);
      expect(fake.ops("archive")).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1);
      expect(fake.ops("archive")).toHaveLength(1); // Confirmed HTTP 400 while still running.
      expect(result, "the remaining half-second still permits recovery").toBeUndefined();
      expect(fake.ops("delete")).toHaveLength(0);
      expect(life.requestShutdown("fast")).toBe(stopping);
      await vi.advanceTimersByTimeAsync(250);
      await settled;
      expect(result).toEqual({ ok: true });
      expect(completedAt).toBeGreaterThanOrEqual(1_600);
      expect(completedAt).toBeLessThan(1_750);
      expect(fake.ids("archive")).toEqual(["sesn_1", "sesn_1"]);
      expect(fake.ids("archived")).toEqual(["sesn_1"]);
      expect(fake.ids("deleted").sort()).toEqual(["file_1", "file_2"]);
      expect(lines).toEqual([]);
      await vi.advanceTimersByTimeAsync(400);
      expect(fake.ops("archive")).toHaveLength(2);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("sends no expired cleanup request when another microtask delays SDK invocation past 2s", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      const fake = fakeClient();
      const { lines, log } = logger();
      const life = createSessionLifecycle(fake.client, { log });
      await uploadTwo(life);
      await life.createSession(params());
      const stopping = life.requestShutdown("fast");
      // Shutdown checks the status request, then this queued work runs before its SDK callback.
      await Promise.resolve().then(() => { vi.setSystemTime(2_100); });
      expect(await stopping).toEqual({ ok: false });
      for (const op of ["retrieve", "send", "archive", "delete"]) {
        expect(fake.ops(op), `${op} must not start after its cutoff`).toHaveLength(0);
      }
      expect(lines.join("\n")).toContain("deadline expired");
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it.each(["archive", "poll"])("preserves 250ms for two 225ms deletes when the retry %s stalls at 1.6s", async (stage) => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      const deletionTimes = [];
      const fake = fakeClient({
        create: async () => ({ status: "running" }),
        interruptStops: false,
        requireIdle: true,
        send: (_id, types, session) => {
          if (types.includes("user.interrupt")) setTimeout(() => { session.status = "idle"; }, 1_600);
        },
        retrieve: () => (stage === "poll" && Date.now() >= 1_600 ? sleep(200) : undefined),
        // Ignore abort: the local deadline must also protect against a stalled SDK.
        archive: () => (stage === "archive" ? sleep(200) : undefined),
        remove: async () => {
          deletionTimes.push(Date.now());
          await sleep(225);
        },
      });
      const { lines, log } = logger();
      const life = createSessionLifecycle(fake.client, { log });
      await uploadTwo(life);
      await life.createSession(params());
      let result;
      const stopping = life.requestShutdown("fast").then((value) => { result = value; });
      await vi.advanceTimersByTimeAsync(1_500);
      expect(fake.ops("archive")).toHaveLength(1); // Confirmed HTTP 400.
      await vi.advanceTimersByTimeAsync(100); // Idle, but the retry or its poll now stalls.
      expect(fake.ops("delete")).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(150);
      const deletionAt = stage === "archive" ? 1_750 : 1_625;
      expect(deletionTimes).toEqual([deletionAt, deletionAt]);
      const stalled = fake.ops(stage === "archive" ? "archive" : "retrieve").at(-1);
      expect(stalled.options.signal.aborted).toBe(true);
      await vi.advanceTimersByTimeAsync(225);
      await stopping;
      expect(Date.now()).toBe(1_975);
      expect(result).toEqual({ ok: stage === "poll" });
      expect(fake.ops("archive")).toHaveLength(2);
      if (stage === "poll") expect(fake.ids("archived")).toEqual(["sesn_1"]);
      expect(fake.ids("deleted").sort()).toEqual(["file_1", "file_2"]);
      expect(lines.join("\n")).not.toMatch(/delete file_/);
      expect(lines.join("\n")).toContain(stage === "archive" ? "archive sesn_1" : "retrieve sesn_1");
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("stops open workflows in a running session and retries confirmed archive rejection", async () => {
    let open = true;
    let attempts = 0;
    const fake = fakeClient({
      create: async () => ({ status: "running" }),
      requireIdle: true,
      send: (_id, types, session) => {
        if (types.includes("user.message")) {
          session.status = "running";
          setTimeout(() => { open = false; session.status = "idle"; }, 50);
        }
      },
      archive: () => {
        if (++attempts === 1 || open) {
          throw Object.assign(new Error("workflow_run_open"), {
            status: 400, error: { error: { details: { error_code: "workflow_run_open" } } },
          });
        }
      },
    });
    const { log } = logger();
    const life = createSessionLifecycle(fake.client, { gracefulMs: 1_000, fastMs: 400, requestMs: 60, pollMs: 10, log });
    await uploadTwo(life);
    await life.createSession(params());
    const stopping = life.requestShutdown("fast");
    expect(life.requestShutdown("fast")).toBe(stopping);
    expect(await within(stopping, 650, "workflow shutdown")).toEqual({ ok: true });
    expect(fake.ops("send").some((call) => call.events.includes("user.message"))).toBe(true);
    expect(attempts).toBe(2);
    expect(open).toBe(false);
    expect(fake.ids("archived")).toEqual(["sesn_1"]);
    expect(fake.ids("deleted").sort()).toEqual(["file_1", "file_2"]);
  });

  it("interrupts a potentially running session when its initial status lookup never answers", async () => {
    let reads = 0;
    const fake = fakeClient({
      create: async () => ({ status: "running" }),
      retrieve: () => (++reads === 1 ? never() : undefined),
      requireIdle: true,
    });
    const { lines, log } = logger();
    const life = createSessionLifecycle(fake.client, { gracefulMs: 1_000, fastMs: 400, requestMs: 60, pollMs: 10, log });
    await uploadTwo(life);
    await life.createSession(params());
    expect(await within(life.requestShutdown("fast"), 650, "unknown status shutdown")).toEqual({ ok: true });
    expect(fake.ops("send").some((call) => call.events.includes("user.interrupt"))).toBe(true);
    expect(fake.ids("archived")).toEqual(["sesn_1"]);
    expect(fake.ids("deleted").sort()).toEqual(["file_1", "file_2"]);
    expect(lines.join("\n")).toContain("retrieve sesn_1");
  });

  it("bounds repeated busy archive responses and still deletes every upload", async () => {
    const fake = fakeClient({
      archive: () => { throw Object.assign(new Error("workflow_run_open"), { status: 400 }); },
    });
    const { lines, log } = logger();
    const life = createSessionLifecycle(fake.client, { ...SHORT, pollMs: 5, log });
    await uploadTwo(life);
    await life.createSession(params());
    expect(await within(life.requestShutdown("fast"), SHORT.fastMs + 250, "busy archive shutdown")).toEqual({ ok: false });
    expect(fake.ops("archive").length).toBeGreaterThan(1);
    expect(fake.ids("deleted").sort()).toEqual(["file_1", "file_2"]);
    expect(lines.join("\n")).toContain("archive sesn_1");
    const count = fake.ops("archive").length;
    await sleep(20);
    expect(fake.ops("archive")).toHaveLength(count);
  });

  it("wakes a graceful stop that is waiting on a running session when a signal escalates it", async () => {
    const fake = fakeClient({ create: async () => ({ id: "sesn_busy", status: "running" }), interruptStops: false });
    const { log } = logger();
    // Graceful would wait ten seconds; after escalation allow only the fast budget plus scheduler slack.
    const life = createSessionLifecycle(fake.client, { gracefulMs: 10_000, fastMs: 120, requestMs: 30, pollMs: 5_000, log });
    await uploadTwo(life);
    await life.createSession(params());

    const stopping = life.requestShutdown("graceful"); // poll error
    await until(() => fake.ops("retrieve").length + fake.ops("send").length > 0, "the graceful stop to check the session");
    await sleep(50);
    expect(fake.ops("archive"), "graceful stop is still waiting for the session to stop running").toHaveLength(0);

    expect(life.requestShutdown("fast")).toBe(stopping); // SIGTERM
    expect(life.mode).toBe("fast");
    await within(stopping, SHORT.fastMs + 250, "shutdown after fast escalation");

    expect(life.mode).toBe("fast");
    expect(fake.ids("archive")).toEqual(["sesn_busy"]);
    expect(fake.ids("delete").sort()).toEqual(["file_1", "file_2"]);
    expect(fake.ids("deleted").sort()).toEqual(["file_1", "file_2"]);
    expectBoundedRequests(fake.calls);
  });

  it.each(["graceful", "fast"])(
    "%s stop of a creation that never answers finds the session by its exact title and archives it",
    async (mode) => {
      const fake = fakeClient({
        listTail: true,
        // The service made the session but its answer never arrives, even after abort.
        create: (p, addSession) => {
          addSession({ id: "sesn_ghost", title: p.title, status: "running" });
          return never();
        },
      });
      fake.addSession({ id: "sesn_other_pr", title: "Bug Hunter test/repo#2 @ abcdef0", status: "running" });
      fake.addSession({ id: "sesn_longer_title", title: `${TITLE} (retry)`, status: "running" });
      const { lines, log } = logger();
      const life = createSessionLifecycle(fake.client, { ...SHORT, log });
      await life.upload({ name: "s1.diff" });
      const settled = life.createSession(params()).then(
        () => "resolved",
        () => "rejected",
      );
      await until(() => fake.ops("create").length === 1, "creation to start");

      const result = await within(life.requestShutdown(mode), (mode === "fast" ? SHORT.fastMs : SHORT.gracefulMs) + 250, "shutdown with a stalled creation");
      await within(settled, 1_000, "the stalled createSession call");

      expect(result).toMatchObject({ ok: false });
      expect(lines.length, "a timed-out creation is logged").toBeGreaterThan(0);
      expect(fake.ops("list").length).toBeGreaterThan(0);
      expect(fake.ids("archive")).toEqual(["sesn_ghost"]);
      expect(fake.ids("delete")).toEqual(["file_1"]);
      expect(fake.ids("deleted")).toEqual(["file_1"]);
      expect(fake.ops("create")).toHaveLength(1);
      expectBoundedRequests(fake.calls);
    },
  );

  it.each(["graceful", "fast"])(
    "%s stop of a creation that never answers and never appears in the list still ends and deletes uploads",
    async (mode) => {
      const fake = fakeClient({ listTail: true, create: () => never() });
      const { lines, log } = logger();
      const life = createSessionLifecycle(fake.client, { ...SHORT, log });
      await life.upload({ name: "s1.diff" });
      life.createSession(params()).catch(() => {});
      await until(() => fake.ops("create").length === 1, "creation to start");

      const result = await within(life.requestShutdown(mode), (mode === "fast" ? SHORT.fastMs : SHORT.gracefulMs) + 250, "shutdown with a stalled creation");

      expect(result).toMatchObject({ ok: false });
      expect(lines.length).toBeGreaterThan(0);
      expect(fake.ids("archive")).toEqual([]);
      expect(fake.ids("deleted")).toEqual(["file_1"]);
      expectBoundedRequests(fake.calls);
    },
  );

  it.each([
    ["never answer", { archive: () => never(), remove: (id) => (id === "file_1" ? never() : undefined) }],
    [
      "fail",
      {
        archive: async () => {
          throw new Error("archive refused");
        },
        remove: async (id) => {
          if (id === "file_1") throw new Error("delete refused");
        },
      },
    ],
  ])("finishes every cleanup step loudly when the archive and one delete %s", async (_label, behavior) => {
    const fake = fakeClient({ create: async () => ({ id: "sesn_stuck" }), ...behavior });
    const { lines, log } = logger();
    const life = createSessionLifecycle(fake.client, { ...SHORT, log });
    await uploadTwo(life);
    await life.createSession(params());

    const stopping = life.requestShutdown("graceful");
    await until(() => fake.ops("archive").length === 1, "the archive request");
    expect(life.requestShutdown("fast")).toBe(stopping);
    const result = await within(stopping, SHORT.fastMs + 250, "shutdown with stalled cleanup");

    expect(result).toMatchObject({ ok: false });
    expect(fake.ids("archive")).toEqual(["sesn_stuck"]);
    expect(fake.ids("delete").sort()).toEqual(["file_1", "file_2"]);
    expect(fake.ids("deleted")).toEqual(["file_2"]);
    expect(lines.some((line) => line.includes("sesn_stuck")), lines.join("\n")).toBe(true);
    expect(lines.some((line) => line.includes("file_1")), lines.join("\n")).toBe(true);
    expectBoundedRequests(fake.calls);

    await sleep(20);
    expect(fake.ops("archive")).toHaveLength(1);
    expect(fake.ops("delete")).toHaveLength(2);
  });

  it("only escalates its mode and refuses new uploads and sessions once shutdown is requested", async () => {
    const fake = fakeClient();
    const life = createSessionLifecycle(fake.client, SHORT);
    expect(life.mode).toBe("none");

    const stopping = life.requestShutdown("graceful");
    expect(life.mode).toBe("graceful");
    expect(life.requestShutdown("fast")).toBe(stopping);
    expect(life.mode).toBe("fast");
    expect(life.requestShutdown("graceful")).toBe(stopping);
    expect(life.mode).toBe("fast");

    await within(expect(life.upload({ name: "s1.diff" })).rejects.toThrow(), 1_000, "a refused upload");
    await within(expect(life.createSession(params())).rejects.toThrow(), 1_000, "a refused creation");
    const result = await within(stopping, SHORT.fastMs + 250, "shutdown with nothing to clean");

    expect(result).toMatchObject({ ok: true });
    expect(life.mode).toBe("fast");
    await within(expect(life.upload({ name: "s2.diff" })).rejects.toThrow(), 1_000, "a refused upload");
    await within(expect(life.createSession(params())).rejects.toThrow(), 1_000, "a refused creation");
    expect(fake.calls.filter((c) => c.sdk)).toEqual([]);
  });
});
