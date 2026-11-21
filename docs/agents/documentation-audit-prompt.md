# Documentation audit prompt

Audit the requested Jact documentation at the current revision. If no scope is given, check the Markdown files tracked by Git, excluding test fixtures (sample files used by tests). Record the revision and the files covered. In an audit-only request, report findings without editing; if asked to correct them, apply the supported documentation fixes.

1. **Check claims against evidence.** Compare current behavior claims with implementation, relevant tests, or actual CLI output. For historical claims, use the revision or public pull request that records what happened. Record a source for each finding; label anything you cannot verify.
2. **Fix the source document.** Correct the maintained spec or guide rather than copying the correction into several docs. Keep original findings in historical reports and link to any later resolution. Replace links to ignored local files with tracked or public evidence where available; otherwise label the evidence local-only or unavailable. Keep runtime changes and test fixtures out of a documentation fix.
3. **Check links without local-only files.** Run `jact validate` on the in-scope docs in a copy containing only tracked files plus the proposed documentation edits. A working link proves the destination resolves, not that the claim is true.
4. **Report what you checked.** List findings or fixes with their sources, which checks you actually ran, and any remaining gaps. A verification date records when a review took place; it is not evidence by itself.
