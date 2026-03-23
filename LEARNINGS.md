# Learnings

### 1. Vitest auto-transforms TS; build step unnecessary for tests (2026-03-23 09:24)
- [OBS: Vitest config uses default esbuild transform for .ts files; no explicit build step needed before `npm test`]
- [OBS: `npm run build` (tsc) is only required for the CLI binary in `dist/`, not for test execution]
- [F-ID: During TDD, run tests directly after editing .ts source. Only build when verifying CLI behavior or before commit.]

[^L-001]: User correction: "Always build after making changes. Is vite set up to autobuild"
