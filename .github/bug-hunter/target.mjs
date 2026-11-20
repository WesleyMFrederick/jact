// What Bug Hunter reviews: a pull request (CI), or a fixed commit range (exam mode).
//
// Exam mode replays an old snapshot so a newer Bug Hunter can be scored against an answer key
// written for that snapshot. Set BASE_SHA and HEAD_SHA (full 40-character SHAs; names follow
// tj-actions/changed-files `base_sha`/`sha` and the pull_request payload's base.sha/head.sha).
// RUN_LABEL names one exam (letters, digits, - and _; default: a timestamp) so parallel exams on
// the same snapshot get distinct session titles. Exam mode never posts: there is no pull request
// to post to, and a posted review would leak the result into the repo the next exam mounts.

const FULL_SHA = /^[0-9a-f]{40}$/;

export function reviewTarget(env) {
  const base = env.BASE_SHA;
  const head = env.HEAD_SHA;
  if (!base && !head) return { exam: false };
  if (!FULL_SHA.test(base ?? "") || !FULL_SHA.test(head ?? "")) {
    throw new Error("Exam mode needs both BASE_SHA and HEAD_SHA as full 40-character commit SHAs.");
  }
  const label = env.RUN_LABEL || Date.now().toString(36);
  if (!/^[A-Za-z0-9_-]+$/.test(label)) throw new Error("RUN_LABEL may contain only letters, digits, - and _.");
  return { exam: true, base, head, label };
}

// The GitHub compare API returns at most 300 files and gives no way to page past them.
// https://docs.github.com/en/rest/commits/commits#compare-two-commits
export const COMPARE_FILE_LIMIT = 300;

// Turns a compare response into the { pr, files } shape the rest of the runner reads.
// Title and description come only from commits inside the range, so nothing after HEAD leaks in.
export function compareToPr(compare, { base, head }) {
  const files = compare.files ?? [];
  if (files.length >= COMPARE_FILE_LIMIT) {
    throw new Error(`The range ${base.slice(0, 7)}..${head.slice(0, 7)} changes ${files.length} or more files; GitHub's compare API stops at ${COMPARE_FILE_LIMIT}.`);
  }
  const subjects = (compare.commits ?? []).map((c) => `- ${c.sha.slice(0, 7)} ${c.commit.message.split("\n")[0]}`);
  return {
    pr: {
      title: `Commits ${base.slice(0, 7)}..${head.slice(0, 7)}`,
      body: subjects.length ? `Commits in this range:\n${subjects.join("\n")}` : "(no commits)",
      head: { sha: head },
      base: { ref: base.slice(0, 7), sha: base },
    },
    files,
  };
}

// Session titles carry this prefix; the stale-session sweep only stops sessions with the same
// prefix, so an exam and a CI run on the same pull request never stop each other, and the label
// (always set, trailing space included) keeps two exams from matching each other.
export function sessionPrefix(repo, target, prNumber) {
  return target.exam ? `Bug Hunter exam ${repo}@${target.base.slice(0, 7)}..${target.head.slice(0, 7)} #${target.label} ` : `Bug Hunter ${repo}#${prNumber} `;
}
