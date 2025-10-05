# Warning Test Source

This file tests warning detection for cross-directory short filename citations.

## Cross-Directory Citations with Wrong Paths

The following citation uses an incorrect path, but the file cache should resolve it:

- [Valid file, wrong path](../wrong-path/warning-test-target.md#Test%20Anchor) - Should trigger warning

This citation points to `../wrong-path/warning-test-target.md` but the actual file is at `subdir/warning-test-target.md`. The file cache should find the file by its short name but mark it as a warning because the path is incorrect.
