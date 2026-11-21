import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const runner = fileURLToPath(new URL("../../.github/bug-hunter/bug-hunter.mjs", import.meta.url));
const helper = new URL("../../.github/bug-hunter/ensure-jact-build.mjs", import.meta.url);
const HEAD = "0123456789abcdef0123456789abcdef01234567";

// Keep the real runner, CLI and exit handling; replace only external services: the Anthropic SDK
// (a separate CI package, not installed by the repository's npm install), GitHub's API, and the
// clock, so the 15-second poll returns at once. Every SDK call is printed as one TEST_SDK line.
const fakeSdk = `
  const record = (entry) => console.error('TEST_SDK ' + JSON.stringify(entry));
  const none = async function* () {};
  let uploads = 0;
  let sent = [];
  let releaseHelper;
  const helperReleased = new Promise((resolve) => { releaseHelper = resolve; });
  let releaseSlice;
  const sliceUploaded = new Promise((resolve) => { releaseSlice = resolve; });
  export const toFile = async (value, name, options) => ({ name, type: options?.type, base64: Buffer.from(value).toString('base64') });
  export default class Anthropic {
    beta = {
      agents: { list: none, create: async () => ({ id: 'agent_test' }) },
      environments: { list: none, create: async () => {
        if (process.env.TEST_SETUP_FAILURE) {
          await sliceUploaded;
          // Let setup reject and cleanup start before the helper finishes.
          setImmediate(releaseHelper);
          throw new Error('environment creation failed');
        }
        return { id: 'env_test' };
      } },
      files: {
        upload: async ({ file }) => {
          const id = 'file_' + ++uploads;
          if (process.env.TEST_SETUP_FAILURE && file.name === 'ensure-jact-build.mjs') await helperReleased;
          record({ op: 'upload', id, ...file });
          if (file.name !== 'ensure-jact-build.mjs') releaseSlice();
          return { id };
        },
        delete: async (id) => {
          record({ op: 'delete', id });
          if (process.env.TEST_SETUP_FAILURE) await helperReleased;
        },
      },
      sessions: {
        list: none,
        create: async (params) => {
          record({ op: 'create', params });
          return { id: process.env.TEST_SESSION_ID };
        },
        retrieve: async () => ({ status: 'idle', usage: { list_cost: { amount: '12' } } }),
        archive: async (id) => record({ op: 'archive', id }),
        threads: { list: none },
        events: {
          send: async (id, body) => {
            record({ op: 'send', id, body });
            sent.push(...body.events);
          },
          list: async function* () {
            yield* sent;
            yield { type: 'workflow_run.created', workflow_run_id: 'run_1' };
            yield { type: 'workflow_run.status_ended', workflow_run_id: 'run_1' };
            yield { type: 'agent.message', content: [{ type: 'text', text: process.env.TEST_FINAL_TEXT }] };
            yield { type: 'session.status_idle', stop_reason: { type: 'end_turn' } };
          },
        },
      },
    };
  }
`;
const sdkLoader = `
  export function resolve(specifier, context, next) {
    if (specifier === '@anthropic-ai/sdk') return {
      url: ${JSON.stringify(`data:text/javascript,${encodeURIComponent(fakeSdk)}`)},
      shortCircuit: true,
    };
    return next(specifier, context);
  }
`;
const preload = `
  import { register } from 'node:module';
  register(${JSON.stringify(`data:text/javascript,${encodeURIComponent(sdkLoader)}`)});
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, _ms, ...args) => realSetTimeout(fn, 0, ...args);
  globalThis.fetch = async (url, init) => {
    if (init?.method && init.method !== 'GET') throw new Error('unexpected GitHub write ' + url);
    return { ok: true, json: async () => String(url).includes('/files?') ? [
      { filename: 'src/cli.ts', status: 'modified', changes: 1, patch: '@@ -1 +1 @@\\n-old\\n+new' },
    ] : {
      title: 'Build once', body: '', head: { sha: '${HEAD}' }, base: { ref: 'main', sha: 'f'.repeat(40) },
    } };
  };
`;

function review(sessionId, overrides = {}) {
  const result = spawnSync(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(preload)}`, runner], {
    env: {
      GITHUB_REPOSITORY: "test/repo",
      PR_NUMBER: "1",
      GITHUB_TOKEN: "test-only",
      DRY_RUN: "1",
      TEST_SESSION_ID: sessionId,
      TEST_FINAL_TEXT: ['Nothing confirmed.', '```json', '{"summary": "No bugs.", "findings": []}', '```'].join("\n"),
      ...overrides,
    },
    encoding: "utf8",
    timeout: 20_000,
  });
  const calls = result.stderr.split("\n").filter((line) => line.startsWith("TEST_SDK ")).map((line) => JSON.parse(line.slice(9)));
  return { result, calls };
}

describe("Bug Hunter build helper upload", () => {
  it("mounts the uploaded helper, gives the session its exact command, and deletes the upload after the session", () => {
    const { result, calls } = review("sesn_test01");
    expect(result.status, result.stderr).toBe(0);

    const uploads = calls.filter((c) => c.op === "upload");
    const helperUpload = uploads.find((c) => c.name === "ensure-jact-build.mjs");
    expect(Buffer.from(helperUpload.base64, "base64").equals(readFileSync(helper))).toBe(true);

    const { resources } = calls.find((c) => c.op === "create").params;
    expect(resources).toContainEqual({ type: "file", file_id: helperUpload.id, mount_path: "/ensure-jact-build.mjs" });
    const sliceUploads = uploads.filter((c) => c !== helperUpload);
    expect(resources.filter((r) => r.type === "file" && r.file_id !== helperUpload.id)).toEqual(
      sliceUploads.map((u, i) => ({ type: "file", file_id: u.id, mount_path: `/workspace/slices/s${i + 1}.diff` })),
    );

    const first = calls.find((c) => c.op === "send");
    expect(first.id).toBe("sesn_test01");
    const text = first.body.events[0].content[0].text;
    expect(text.split("\n")).toContain(`node /mnt/session/uploads/ensure-jact-build.mjs --repo /workspace/repo --head ${HEAD} --session sesn_test01`);
    expect(text).not.toMatch(/^- .*ensure-jact-build/m);

    const archived = calls.findIndex((c) => c.op === "archive");
    const deleted = calls.flatMap((c, i) => (c.op === "delete" ? [{ id: c.id, i }] : []));
    expect(deleted.map((d) => d.id).sort()).toEqual(uploads.map((u) => u.id).sort());
    expect(archived).toBeGreaterThanOrEqual(0);
    for (const d of deleted) expect(d.i).toBeGreaterThan(archived);
  });

  it("deletes a helper upload that finishes after environment creation fails", () => {
    const { result, calls } = review("sesn_setup_failure", { TEST_SETUP_FAILURE: "1" });
    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("environment creation failed");
    const uploads = calls.filter((c) => c.op === "upload");
    expect(uploads.map((u) => u.name).sort()).toEqual(["ensure-jact-build.mjs", "s1.diff"]);
    expect(calls.filter((c) => c.op === "delete").map((c) => c.id).sort()).toEqual(
      uploads.map((u) => u.id).sort(),
    );
    expect(calls.some((c) => c.op === "create")).toBe(false);
  });

  it("quotes a session id that is not shell-safe", () => {
    const { result, calls } = review("sesn_it's $(id)");
    expect(result.status, result.stderr).toBe(0);
    const text = calls.find((c) => c.op === "send").body.events[0].content[0].text;
    expect(text.split("\n")).toContain(`node /mnt/session/uploads/ensure-jact-build.mjs --repo /workspace/repo --head ${HEAD} --session 'sesn_it'\\''s $(id)'`);
  });
});
