# Test Document with Code Blocks

This document tests that links inside code blocks are NOT validated.

[Real Link](./real-file.md)

## Code Example

Here's a markdown example in a fenced code block:

```markdown
[Example Link](./example.md#section)
[Another Example](../path/to/file.md)
```

And here's a JavaScript example with a comment containing a link:

```javascript
// See documentation: [docs](./api-docs.md)
function example() {
  return "code";
}
```

## Real Section

[#real-section](#real-section)

## More Code Examples

```
[Plain Code Block](./should-not-validate.md)
```

Back to normal content.
