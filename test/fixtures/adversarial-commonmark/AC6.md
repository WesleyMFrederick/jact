# AC6 — Multi-backtick span spanning a wiki link (residual emission)

%% *Last Modified: 05/03/26 18:34:52* %%

CommonMark §6.5: a multi-backtick code span (`` `` ``) properly enclosing
`[[wikilink]]` must suppress extraction. A wiki-SHAPED bracket fragment
that does NOT match the D1 grammar (e.g. unclosed `[[`) must be emitted
as an `UnrecognizedSyntaxRecord` by the residual scanner (D2, P2).

A valid extracted wiki: [[ValidNormalWiki]] is captured by D1.

Inside multi-backtick span: ``[[InsideMultiBacktickSuppressed]]`` is NOT extracted (correctly skipped via `isInsideInlineCode`).

Malformed [[unclosed wiki fragment with no closer should appear as a residual record after P2.
