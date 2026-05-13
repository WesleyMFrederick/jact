# AC3 — Indented code block adjacent to fenced block

%% *Last Modified: 05/03/26 18:34:34* %%

CommonMark §4.5: an indented code block (4+ leading spaces) sitting next
to a fenced block must not perturb fence boundary detection. Note: the
shipped D1 parser currently tracks fenced blocks only (per
`getFencedCodeBlockLineSet`); wiki-shaped content inside indented code is
extracted by design (no silent drop).

[[BeforeIndented]]

    [[ExtractedFromIndentedCode]]

```
[[InsideFence]] should be ignored.
```

[[AfterFence]] should be extracted.
