# Enhanced Citations Test File

This file tests new citation patterns including cite format and links without anchors.

## Standard Markdown Links (With Anchors)

- [Component Details](test-target.md#auth-service)
- [Testing Strategy](test-target.md#integration-tests)

## Standard Markdown Links (Without Anchors)

- [Implementation Guide](test-target.md)
- [Reference Documentation](another-file.md)
- [Setup Instructions](setup-guide.md)

## Citation Format

- This addresses technical debt [cite: test-target.md] in the architecture.
- Following design principles [cite: design-principles.md] is essential.
- The implementation follows [cite: ../architecture/patterns.md] established patterns.

## Mixed Content Line

The system uses [Standard Link](test-target.md#auth) and follows [cite: guidelines.md] patterns.

## Caret References

- FR1: Core requirement. ^FR1
- AC1: Acceptance criteria. ^US1-1AC1

## Headers for Testing

### Auth Service {#auth-service}

Authentication implementation details.

### Integration Tests {#integration-tests}

Testing approach and strategy.
