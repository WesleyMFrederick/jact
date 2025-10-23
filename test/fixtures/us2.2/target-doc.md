# Target Document for Extraction Testing

This document contains various types of extractable content for US2.2 testing.

## Section to Extract

This is the content that should be extracted when linking to this section.
It spans multiple lines and contains important information.

**Key points:**

- Point 1
- Point 2
- Point 3

### Nested Subsection

This nested content should be included when extracting "Section to Extract".

## Another Section

This section should NOT be extracted when requesting "Section to Extract".
It demonstrates proper section boundary detection.

This is a block reference that can be extracted. ^block-ref-1

Another block for testing. ^block-ref-2

More content after the block references.

## Complex Section

This section tests extraction with multiple formatting types.

```javascript
// Code block example
console.log('test');
```

> Quote block

| Table | Example |
|-------|---------|
| Cell  | Data    |

Final paragraph. ^inline-block
