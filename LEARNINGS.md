# Learnings

### 1. Vitest auto-transforms TS; build step unnecessary for tests (2026-03-23 09:24)
- [OBS: Vitest config uses default esbuild transform for .ts files; no explicit build step needed before `npm test`]
- [OBS: `npm run build` (tsc) is only required for the CLI binary in `dist/`, not for test execution]
- [F-ID: During TDD, run tests directly after editing .ts source. Only build when verifying CLI behavior or before commit.]

[^L-001]: User correction: "Always build after making changes. Is vite set up to autobuild"

### 2. Always run npm run build after tests pass (2026-03-25 10:58)
- [OBS: User friction — "did you build jact? I always want you to build it after tests pass so other repos can use it"]
- [F-ID: jact is consumed by other repos via `npm link`. The linked binary points to `dist/`, so a stale build means other repos get stale behavior.]
- **Rule: After tests pass, ALWAYS run `npm run build`. No exceptions. Other repos depend on the compiled output.**

[^L-002]: User correction: "did you build jact? I always want you to build it after tests pass so other repos can use it"

### 3. "Push to PR" means commit + push + create PR in one flow (2026-03-25 11:15)
- [OBS: User said "push to pr" — expected commit, push, and PR creation as a single uninterrupted flow]
- [OBS: I stopped after push to ask "want me to create a PR?" which broke the flow]
- [F-ID: "push to pr" is a compound instruction. Execute all steps: commit → push → create PR. Do not pause to ask between steps.]
- **Rule: When user says "push to pr", execute the full pipeline without stopping to ask.**

[^L-003]: User correction: "push to pr" followed by "#USER-FRICTION:" and "What did I originally fucking ask you to do?"
