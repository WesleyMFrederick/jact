# AC5 — Backslash before whitespace at end-of-line

%% *Last Modified: 05/03/26 18:34:44* %%

CommonMark §6.1: a backslash at end-of-line creates a hard line break but
does not consume the following line content. Wikilinks before and after
must be extracted normally.

Trailing-backslash hard break before wiki: \
[[WikiAfterHardBreak]] on next line.

Inline [[WikiBeforeBackslash]] before \
trailing backslash hard break.
