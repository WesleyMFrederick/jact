# Cross-File Duplicate Source

This document tests that content deduplication works based on content hash (SHA-256),
not on file identity or anchor identity.

## First Link - File A

This link extracts from file A:

[[target-doc-a.md#Identical Section|From File A]]

## Second Link - File B

This link extracts the same content from file B:

[[target-doc-b.md#Identical Section|From File B]]

Both files contain identical section content and should be deduplicated.
