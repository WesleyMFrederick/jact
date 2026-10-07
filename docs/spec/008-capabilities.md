# 008. Capabilities

**Status:** done

Feature matrix — implemented capabilities in this checkout. Command/flag details: [005 · Interfaces](005-interfaces.md#005. Interfaces).

| Capability | Status | Where |
|---|---|---|
| Validate cross-document markdown links + anchors | ✅ | `jact validate <file>` |
| Validate link syntax only; plain text, inline code, and fenced code never produce errors | ✅ | [`jact validate`](005-interfaces.md#`jact validate`) |
| Validate from stdin (hook/pipe usage) | ✅ | `jact validate --stdin` |
| Batch validation with file selection + reporting | ✅ | `src/validate/batch-runner.ts` |
| Auto-fix broken anchors + path conversions | ✅ | `jact validate --fix` (structured `PathConversion`/`AnchorConversion`) |
| Convert resolved prose `.md` paths into Markdown links only with `--fix`; exact resolution without fuzzy/basename guessing; retain code/command and non-Markdown text formatting, suffixes, and existing backup behavior; dry-run stays read-only | ✅ | [`jact validate`](005-interfaces.md#`jact validate`) |
| Rename or move arbitrary existing files, directories, batches, and globs while rewriting incoming plain paths and parsed links, outgoing references in moved Markdown notes, and relationships between moved notes | ✅ | [`jact rename`](005-interfaces.md#`jact rename <source...> <destination>`) |
| Preserve `#anchor`, `:line`, code formatting, and executable command syntax during moves; resolve plain paths against pre-move disk state and verify rewritten relationships after the transaction, with rollback on failure | ✅ | [`jact rename`](005-interfaces.md#`jact rename <source...> <destination>`) |
| Line-scoped validation | ✅ | `--lines N-M` |
| Scope override for cross-project resolution | ✅ | `--scope <dir>` (auto-inferred in-repo) |
| Heading outline for orient-before-extract | ✅ | [`jact outline`](005-interfaces.md#`jact%20outline%20<file>%20level%20`) |
| AST + extracted-data view (debugging) | ✅ | `jact ast <file>` |
| Content extraction (links / header / whole file) | ✅ | `jact extract links|header|file` |
| Base-path extraction | ✅ | `npm run jact:base-paths <file>` (npm script over `extract links --verbose`; no `jact base-paths` command) |
| Obsidian flavor tokenizing (wikilinks, caret anchors, highlights, comments, citations, permissive links) | ✅ | Flavor Extension Collection — `src/core/MarkdownParser/extensions/flavors.ts` |
| GFM kebab-slug anchor matching | 🔲 designed | Flavor-scoped anchor policy — see design doc §4 in `design-docs/features/20260701T161127-markdown-flavor-extension-collection/` |
| `anchorKind` threading (field reads over fragment regex) | 🔲 designed | Same design doc §5 |

Commands retain runnable plain-path syntax, including uncertain unmarked command-shaped lines. Their targets are rewritten during moves; prose Markdown paths are converted only with `--fix`.
