# Issue 100 Backslash Bracket Heading Fixture

## **[M-002]** Tag distribution

This heading contains bold brackets. A link may encode the backslash as %5C,
producing "#**%5CM-002%5C]**%20Tag%20distribution". Obsidian resolves this by
stripping backslash escape chars and lone brackets during heading comparison.
