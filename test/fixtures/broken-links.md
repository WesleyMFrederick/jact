# Broken Links Test File

This file contains broken citations to test error detection.

## Broken Cross-Document Links

- [Missing File](nonexistent-file.md#anchor) - File doesn't exist
- [Missing Anchor](test-target.md#missing-anchor) - Anchor doesn't exist
- [Bad Path](../../../invalid/path.md#anchor) - Invalid path

## Invalid Caret Patterns

- Invalid pattern without prefix: invalidPattern
- Invalid lowercase: ^lowercase
- Invalid numbers only: ^123
- Invalid special chars: ^FR1@invalid

## Malformed Emphasis Anchors

- [Component](test-target.md#==Component==) - Missing ** markers
- [Component](test-target.md#==**Component**) - Missing final ==
- [Component](test-target.md#Component**==) - Missing initial ==**
