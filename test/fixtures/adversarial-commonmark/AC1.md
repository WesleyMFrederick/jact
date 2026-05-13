# AC1 — Triple-backtick fence on same line as inline single-backtick span

%% *Last Modified: 05/03/26 18:34:23* %%

CommonMark §4.5: a fenced code block must occupy its own line. A line that
contains both an inline `code` span and the literal characters ``` mid-line
must NOT be treated as opening a code block.

Here is `inline code` and then ``` triple backticks ``` on the same line. [[ValidWiki1]] survives.

Another paragraph with `single` and ``` triple ``` mixed: [[ValidWiki2]] also survives.

[[ValidWiki3]] standalone wiki, no code at all.
