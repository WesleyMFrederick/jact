# Source Document with Mixed Link Types

This document has links with different outcomes: success, skipped, and error cases.

## Successful Link

This link should successfully extract content:

[[target-doc.md#Shared Section|Valid Link]]

## Skipped Link (Non-existent Section)

This link references a section that doesn't exist (should be skipped):

[[target-doc.md#Nonexistent Section|Missing Section]]

## Error Link (Non-existent File)

This link references a file that doesn't exist (should result in error):

[[nonexistent-file.md#Some Section|Broken Link]]

This allows testing all three link processing outcomes.
