# Scope Test File

This file tests smart file resolution with folder scope.

## Cross-Document Links with Short Filenames

- [Valid Target](test-target.md#integration-tests) - Should work with scope
- [Broken Path](../missing/test-target.md#database) - Should resolve via cache
- [Missing File](nonexistent.md#anchor) - Should still fail

## Line Range Testing

Line 10: [Test Link 1](test-target.md#auth-service)
Line 11: [Test Link 2](valid-citations.md#user-authentication)
Line 12: [Test Link 3](broken-links.md#any-anchor)

End of test file.
