# Wiki-Style Cross-Document Test

This file tests wiki-style cross-document link detection and validation.

## Valid Wiki-Style Cross-Document Links

Links to existing file with valid anchors:
- [[test-target.md#auth-service|Authentication Details]]
- [[test-target.md#database|Database Info]]

Links with caret anchors:
- [[test-target.md#^FR1|Requirement FR1]]

## Invalid Wiki-Style Cross-Document Links

File doesn't exist:
- [[nonexistent.md#anchor|Broken Link]]

Directory instead of file (should fail with our isFile() fix):
- [[../fixtures#anchor|Directory Link]]
