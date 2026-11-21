// Own one run's resources and its only shutdown. A signal shortens, never restarts, cleanup.
export function createSessionLifecycle(client, {
  gracefulMs = 30_000, fastMs = 2_000, requestMs = 1_000, pollMs = 5_000,
  log = console.error,
} = {}) {
  const uploads = new Set();
  const pendingSetup = new Set();
  const deletions = new Map();
  const changed = new Set();
  const setupAbort = new AbortController();
  let mode = "none";
  let deadline = Infinity;
  let sessionId;
  let creationTitle;
  let shutdownPromise;
  let archivePromise;
  let failed = false;

  function failure(label, error) {
    failed = true;
    log(`::error title=Bug Hunter shutdown::${label}: ${error.message ?? error}`);
  }

  function startResource(work, remember) {
    if (mode !== "none") return Promise.reject(new Error("Shutdown already requested"));
    let abort;
    const aborted = new Promise((_, reject) => {
      abort = () => reject(setupAbort.signal.reason);
      setupAbort.signal.addEventListener("abort", abort, { once: true });
    });
    // Register before calling the SDK: a service callback can synchronously emit a signal.
    const request = Promise.resolve().then(() => work({
      signal: setupAbort.signal, timeout: gracefulMs, maxRetries: 0,
    })).then((result) => {
      remember(result);
      return result;
    });
    // Settle the caller even if an SDK request ignores abort. Its eventual answer still records IDs.
    const pending = Promise.race([request, aborted]);
    pendingSetup.add(pending);
    const settled = () => {
      pendingSetup.delete(pending);
      setupAbort.signal.removeEventListener("abort", abort);
    };
    pending.then(settled, settled);
    return pending;
  }

  function upload(file) {
    return startResource(
      (options) => client.beta.files.upload({ file }, options),
      (result) => uploads.add(result.id),
    );
  }

  function createSession(params) {
    if (mode !== "none") return Promise.reject(new Error("Shutdown already requested"));
    creationTitle = params.title;
    return startResource(
      (options) => client.beta.sessions.create(params, options),
      (session) => { sessionId = session.id; },
    );
  }

  // Reserve a share for later stages so a stalled request cannot consume the archive/delete window.
  // Each local deadline also moves earlier when graceful shutdown escalates to fast.
  async function attempt(label, work, reserve = 1, retainMs) {
    const controller = new AbortController();
    let end = Date.now() + requestMs;
    let timer;
    let expire;
    const timeout = new Promise((_, reject) => {
      expire = () => {
        const error = new Error("deadline expired; service outcome is unconfirmed");
        reject(error);
        controller.abort(error);
      };
    });
    const arm = () => {
      end = Math.min(
        end, Date.now() + Math.max(0, deadline - Date.now()) / reserve,
        deadline - (retainMs?.() ?? 0),
      );
      clearTimeout(timer);
      timer = setTimeout(expire, Math.max(0, end - Date.now()));
    };
    changed.add(arm);
    arm();
    try {
      if (end <= Date.now()) {
        expire();
        return await timeout;
      }
      return await Promise.race([
        Promise.resolve().then(() => work({
          signal: controller.signal, timeout: Math.max(1, Math.ceil(end - Date.now())), maxRetries: 0,
        })),
        timeout,
      ]);
    } catch (error) {
      failure(label, error);
      return undefined;
    } finally {
      clearTimeout(timer);
      changed.delete(arm);
    }
  }

  function pause(reserveMs) {
    return new Promise((resolve) => {
      const wake = () => {
        clearTimeout(timer);
        changed.delete(wake);
        resolve();
      };
      const timer = setTimeout(wake, Math.min(
        pollMs, mode === "fast" ? 100 : pollMs, Math.max(0, deadline - Date.now() - reserveMs),
      ));
      changed.add(wake);
    });
  }

  function archive(id) {
    if (!archivePromise) {
      archivePromise = stopAndArchive(id);
    }
    return archivePromise;
  }

  async function stopAndArchive(id) {
    const deletionReserveMs = () => Math.min(requestMs, (mode === "fast" ? fastMs : gracefulMs) / 8);
    let current = await attempt(`retrieve ${id}`, (options) => client.beta.sessions.retrieve(id, {}, options), 5, deletionReserveMs);
    // A failed lookup is not evidence that the session stopped.
    const running = () => !current || current.status === "running" || current.status === "rescheduling";
    // Initially reserve archive and deletion time. A confirmed rejection can borrow the
    // archive half for more polling/retries, but must retain the deletion half.
    let retrying = false;
    const reserveMs = () => deletionReserveMs() * (retrying ? 1 : 2);
    let stopRequested = false;
    const stopRuns = async () => {
      stopRequested = true;
      await attempt(`stop runs ${id}`, (options) => client.beta.sessions.events.send(id, {
        events: [{ type: "user.message", content: [{ type: "text", text: "Stop all workflow runs now and start no new work." }] }],
      }, options), 5, deletionReserveMs);
    };
    if (running()) {
      await attempt(`interrupt ${id}`, (options) => client.beta.sessions.events.send(id, {
        events: [{ type: "user.interrupt" }],
      }, options), 4, deletionReserveMs);
      // Interrupt ends a turn, not its workflows. Ask afterward so this request can take effect.
      await stopRuns();
    }
    for (;;) {
      while (running() && deadline - Date.now() > reserveMs()) {
        await pause(reserveMs());
        current = await attempt(`retrieve ${id}`, (options) => client.beta.sessions.retrieve(id, {}, options), 3, deletionReserveMs);
      }
      let rejection;
      const archived = await attempt(`archive ${id}`, async (options) => {
        try {
          await client.beta.sessions.archive(id, {}, options);
          return true;
        } catch (error) {
          // Only retry a confirmed rejection, never an unconfirmed in-flight request.
          if (error.status !== 400 && error.status !== 409) throw error;
          rejection = error;
          return false;
        }
      }, 2, deletionReserveMs);
      if (archived !== false) return;
      retrying = true;
      if (deadline - Date.now() <= reserveMs()) {
        failure(`archive ${id}`, rejection);
        return;
      }
      // Even an idle session can have paused workflows that prevent archival.
      if (!stopRequested) await stopRuns();
      await pause(reserveMs());
      current = await attempt(`retrieve ${id}`, (options) => client.beta.sessions.retrieve(id, {}, options), 3, deletionReserveMs);
    }
  }

  function deleteFile(id) {
    if (!deletions.has(id)) {
      deletions.set(id, attempt(`delete ${id}`, (options) => client.beta.files.delete(id, {}, options)));
    }
    return deletions.get(id);
  }

  async function shutdown() {
    if (pendingSetup.size) {
      await attempt("settle in-flight setup", () => Promise.allSettled([...pendingSetup]), 6);
    }
    setupAbort.abort(new Error("Setup aborted by shutdown"));

    if (creationTitle && !sessionId) {
      const found = await attempt(`find unconfirmed session ${creationTitle}`, async (options) => {
        for await (const session of client.beta.sessions.list({}, options)) {
          if (session.title === creationTitle && !session.archived_at) return session.id;
        }
        return undefined;
      }, 5);
      // A delayed create response may have arrived during lookup.
      sessionId ??= found;
      if (!sessionId) {
        failure(`creation ${creationTitle}`, new Error("session ID unknown; a later run must reconcile this title"));
      }
    }

    // Await archive confirmation when available; failures still leave a deletion window.
    if (sessionId) await archive(sessionId);

    // Include IDs from late responses that arrived while stopping/archiving.
    for (;;) {
      const ids = [...uploads].filter((id) => !deletions.has(id));
      if (!ids.length) break;
      await Promise.all(ids.map(deleteFile));
    }
    if (Date.now() >= deadline) failure("shutdown", new Error("total deadline expired"));
    return { ok: !failed };
  }

  function requestShutdown(requestedMode) {
    if (mode === "none" || (mode === "graceful" && requestedMode === "fast")) {
      mode = requestedMode;
      // 2s fits even a first SIGTERM: GitHub allows 2.5s before killing the process tree.
      // https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-cancellation
      deadline = Math.min(deadline, Date.now() + (mode === "fast" ? fastMs : gracefulMs));
      for (const notify of changed) notify();
    }
    if (!shutdownPromise) shutdownPromise = Promise.resolve().then(shutdown);
    return shutdownPromise;
  }

  return { upload, createSession, requestShutdown, get mode() { return mode; } };
}
