import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const runner = fileURLToPath(new URL("../../.github/bug-hunter/bug-hunter.mjs", import.meta.url));
// Keep the real CLI and exit handling; replace only external services. The SDK lives in
// a separate CI package and is not installed by the repository's npm install.
const sdkLoader = `
  export function resolve(specifier, context, next) {
    if (specifier === '@anthropic-ai/sdk') return {
      url: 'data:text/javascript,export default class Anthropic {}; export const toFile = () => {};',
      shortCircuit: true,
    };
    return next(specifier, context);
  }
`;
const preload = `
  import { register } from 'node:module';
  register(${JSON.stringify(`data:text/javascript,${encodeURIComponent(sdkLoader)}`)});
  globalThis.fetch = async (url) => {
    console.error('TEST_GITHUB_REQUEST');
    if (String(url).includes('test-oidc')) return { ok: false, status: 503 };
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

function runCi(failOn) {
  const temp = mkdtempSync(join(tmpdir(), "bug-hunter-ci-"));
  try {
    // Run the workflow's shell commands, excluding dependency installation. Actions
    // supply the runtime/SDK; this fixture supplies Node and the same SDK stub above.
    const workflow = readFileSync(new URL("../../.github/workflows/bug-hunter.yml", import.meta.url), "utf8");
    const commands = [...workflow.matchAll(/^        run: (?:\|\n((?:          .*\n)+)|(.+))/gm)]
      .map((match) => match[1]?.replace(/^          /gm, "") ?? match[2])
      .filter((command) => !command.startsWith("npm ci"));
    symlinkSync(process.execPath, join(temp, "node"));
    writeFileSync(join(temp, "curl"), "#!/bin/sh\necho TEST_GITHUB_REQUEST >&2\nexit 1\n", { mode: 0o755 });
    writeFileSync(join(temp, "jq"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    return spawnSync("/bin/bash", ["-e", "-o", "pipefail", "-c", commands.join("\n")], {
      cwd: dirname(runner),
      env: {
        PATH: temp,
        NODE_OPTIONS: `--import=data:text/javascript,${encodeURIComponent(preload)}`,
        GITHUB_REPOSITORY: "test/repo", PR_NUMBER: "1", GITHUB_TOKEN: "test-only",
        FAIL_ON: failOn, PLAN_ONLY: "1",
        ACTIONS_ID_TOKEN_REQUEST_URL: "https://test-oidc.invalid?request=1",
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: "test-only",
        ANTHROPIC_IDENTITY_TOKEN_FILE: join(temp, "gha-jwt"),
        TOKEN_FILE: join(temp, "gha-jwt"),
      },
      encoding: "utf8", timeout: 10_000,
    });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
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

  it("reports invalid CI configuration even when the identity-token service fails", () => {
    const result = runCi("Medium");
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Invalid FAIL_ON "Medium"');
    expect(result.stderr).not.toContain("TEST_GITHUB_REQUEST");
  });

  it("still requests a CI identity token after accepting the configuration", () => {
    const result = runCi("high");
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("GitHub OIDC token request -> 503");
    expect(result.stderr).toContain("TEST_GITHUB_REQUEST");
  });
});
