# AC4 — Escaped backtick inside potential code span

%% *Last Modified: 05/03/26 18:34:40* %%

CommonMark §6.1: backslash-escaped backticks (`\``) are literal characters
and do not open or close a code span. The wikilink that follows must be
extracted normally.

Text with \`escaped backtick\` and [[ValidAfterEscape]] should be extracted.

A real code span: `not a \`real\` escape inside` — wikilink [[OutsideRealSpan]] is normal text.
