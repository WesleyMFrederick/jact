# 008. Capabilities

**Status:** done

Feature matrix — what jact can do today. Command/flag details: [005 · Interfaces](005-interfaces.md#005. Interfaces).

| Capability | Status | Where |
|---|---|---|
| Validate cross-document markdown links + anchors | ✅ | `jact validate <file>` |
| Validate from stdin (hook/pipe usage) | ✅ | `jact validate --stdin` |
| Batch validation with file selection + reporting | ✅ | `src/validate/batch-runner.ts` |
| Auto-fix broken anchors + path conversions | ✅ | `jact validate --fix` (structured `PathConversion`/`AnchorConversion`) |
| Line-scoped validation | ✅ | `--lines N-M` |
| Scope override for cross-project resolution | ✅ | `--scope <dir>` (auto-inferred in-repo) |
| AST + extracted-data view | ✅ | `jact ast <file>` |
| Content extraction (links / header / whole file) | ✅ | `jact extract links|header|file` |
| Base-path extraction | ✅ | `jact base-paths <file>` |
| Obsidian flavor tokenizing (wikilinks, caret anchors, highlights, comments, citations, permissive links) | ✅ | Flavor Extension Collection — `src/core/MarkdownParser/extensions/flavors.ts` |
| GFM kebab-slug anchor matching | 🔲 designed | Flavor-scoped anchor policy — see design doc §4 in `design-docs/features/20260701T161127-markdown-flavor-extension-collection/` |
| `anchorKind` threading (field reads over fragment regex) | 🔲 designed | Same design doc §5 |
