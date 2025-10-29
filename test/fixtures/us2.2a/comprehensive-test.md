# Comprehensive Deduplication Test Source

This document tests all aspects of the content deduplication pipeline with a comprehensive set of scenarios.

## Test Case 1: Duplicate Section Extractions

First reference to Section A from target-1:

[[target-1.md#Section A - Frequently Referenced|First Ref to Section A]]

Second reference to the same Section A:

[[target-1.md#Section A - Frequently Referenced|Second Ref to Section A]]

Third reference to Section A again:

[[target-1.md#Section A - Frequently Referenced|Third Ref to Section A]]

## Test Case 2: Unique Content Extraction

Single reference to Section B (no duplicates):

[[target-1.md#Section B - Unique Content|Unique Section B]]

## Test Case 3: Multiple Duplicate Groups

First reference to Section C:

[[target-1.md#Section C - Another Duplicate Target|First Ref to Section C]]

Second reference to Section C:

[[target-1.md#Section C - Another Duplicate Target|Second Ref to Section C]]

## Test Case 4: Cross-Document Extraction

Reference to content from target-2:

[[target-2.md#Section X - Cross-Document Reference|Cross-doc Section X]]

Another unique reference from target-2:

[[target-2.md#Section Y - Standalone Content|Standalone Section Y]]

## Test Case 5: Skipped Links (Ineligible)

This link references a non-existent section (should be skipped):

[[target-1.md#Nonexistent Section|Missing Section]]

## Test Case 6: Error Links (Validation Failures)

This link references a non-existent file (should error):

[[nonexistent-file.md#Some Section|Broken File Link]]

## Summary

This comprehensive test includes:
- 3 duplicate references to Section A
- 2 duplicate references to Section C
- 2 unique content extractions (Section B, Section Y)
- 1 cross-document extraction (Section X)
- 1 skipped link (missing section)
- 1 error link (missing file)

Total: 10 links with mixed success/skipped/error statuses
