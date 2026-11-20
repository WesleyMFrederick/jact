import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const runner = fileURLToPath(new URL("../../.github/bug-hunter/bug-hunter.mjs", import.meta.url));
// Keep the real CLI and exit handling; replace only external services. The SDK lives in
// a separate CI package and is not installed by the repository's npm install.
const preload = `
  import { registerHooks } from 'node:module';
  registerHooks({
    resolve(specifier, context, next) {
      if (specifier === '@anthropic-ai/sdk') return {
        url: 'data:text/javascript,export default class Anthropic {}; export const toFile = () => {};',
        shortCircuit: true,
      };
      return next(specifier, context);
    },
  });
  globalThis.fetch = async (url) => {
    console.error('TEST_GITHUB_REQUEST');
    return { ok: true, json: async () => String(url).includes('/files?') ? [] : {
      title: 'Config check', body: '', head: { sha: 'abc' }, base: { ref: 'main' },
    } };
  };
`;

function run(failOn) {
  const env = {
    GITHUB_REPOSITORY: "test/repo",
    PR_NUMBER: "1",
    GITHUB_TOKEN: "test-only",
    PLAN_ONLY: "1",
  };
  if (failOn !== undefined) env.FAIL_ON = failOn;
  return spawnSync(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(preload)}`, runner], {
    env, encoding: "utf8", timeout: 10_000,
  });
}

describe("FAIL_ON configuration", () => {
  it.each(["Medium", "hgih", "toString", "__proto__"])("rejects %s with exit 2 before any API request", (value) => {
    const result = run(value);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain(`Invalid FAIL_ON ${JSON.stringify(value)}`);
    expect(result.stderr).toContain("high, medium, low, none");
    expect(result.stderr).not.toContain("TEST_GITHUB_REQUEST");
  });

  it.each([undefined, "", "high", "medium", "low", "none"])("allows %s without changing plan-only behavior", (value) => {
    const result = run(value);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PLAN_ONLY: no session started.");
  });
});
