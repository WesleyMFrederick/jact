# AC2 — Fenced block opened with N backticks, closed with M > N

%% *Last Modified: 05/03/26 18:34:28* %%

CommonMark §4.5: a closing fence may have more backticks than the opener.
Wiki-shaped content inside the block must be ignored; content after the
closer must be extracted normally.

[[BeforeFence]]

```
[[InsideFence1]] should be ignored.
[[InsideFence2]] also ignored.
````

[[AfterFence]] should be extracted.
