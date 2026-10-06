# Warning Test Source

This file tests warning detection for cross-directory short filename citations.

## Cross-Directory Citations with Wrong Paths

The following citation uses an incorrect path, but the file cache should resolve it:

- [Valid file, wrong path](../wrong-path/warning-test-target.md#Test%20Anchor) - Should trigger warning

The citation above has the wrong directory. The file cache should find the target by its short name and report a path-conversion warning.
