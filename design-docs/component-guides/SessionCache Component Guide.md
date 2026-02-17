# Session Cache Baseline

## Overview

Documents the current session-based caching behavior for `extract links` as implemented in the extractor hook. This baseline captures the **pre-refactor state** (before [issue #92](https://github.com/WesleyMFrederick/cc-workflows/issues/92)) to inform the cache migration into the CLI tool.

### Problem

1. The [**`CLI Orchestrator`**](CLI%20Orchestrator%20Implementation%20Guide.md) is completely stateless — every `extract links` call performs full extraction regardless of whether the same content was already extracted in the current session. ^P1
2. In a Claude Code session, the PostToolUse hook fires on **every** `.md` file read, causing redundant extractions that bloat context with duplicate citation content. ^P2
3. Cache logic lives in ~145 lines of bash (`extractor.sh`), making it untestable with Vitest and invisible to the tool's architecture. ^P3

### Solution

The extractor hook (`extractor.sh`) implements session-aware caching by:
1. computing a cache key from `session_id + md5(file_content)` and checking for a marker file before invoking the CLI tool (addresses [P2](#^P2)) ^S1
2. writing an empty marker file after successful extraction to prevent re-extraction within the same session (addresses [P2](#^P2)) ^S2
3. formatting tool JSON output into `## Citation:` markdown blocks for Claude's `hookSpecificOutput` (addresses [P1](#^P1)) ^S3

### Impact

| Problem ID | Problem | Solution ID | Solution | Impact | Principles | How Principle Applies |
| :--------: | ------- | :---------: | -------- | ------ | ---------- | --------------------- |
| [P1](#^P1) | Tool is stateless | [S3](#^S3) | Hook wraps tool with formatting | Claude gets citation context | [Tool-First Design](../../../../ARCHITECTURE-PRINCIPLES.md#^tool-first-design) | Deterministic extraction via CLI tool |
| [P2](#^P2) | Redundant extractions on re-reads | [S1](#^S1), [S2](#^S2) | File-based marker cache | Each file extracted once per session | [Simplicity First](../../../../ARCHITECTURE-PRINCIPLES.md#^simplicity-first) | Empty marker files, no complex cache |
| [P3](#^P3) | Cache logic in bash, untestable | — | *Unaddressed (motivates refactor)* | Cache behavior not covered by Vitest | [Mechanical Separation](../../../../ARCHITECTURE-PRINCIPLES.md#^mechanical-separation) | Cache is deterministic I/O — belongs in tool |

### Boundaries

The session cache is exclusively responsible for preventing duplicate `extract links` invocations within a single Claude Code session. Its responsibilities are strictly limited to deduplication of the `extract links` subcommand.

The session cache is **not** responsible for:
- Caching `extract header` or `extract file` subcommands (on-demand only, no hook trigger)
- Content extraction logic (delegated to [**`ContentExtractor`**](ContentExtractor%20Component%20Guide.md))
- Output formatting for non-hook contexts (tool returns JSON; hook formats for Claude)
- Cache expiration or TTL (manual cleanup only)
- In-memory parsed file caching (separate concern handled by [**`ParsedFileCache`**](ParsedFileCache%20Implementation%20Guide.md))

---

## Current Architecture

### Trigger Chain

```text
Claude reads .md file
  → PostToolUse:Read hook fires
    → extractor.sh receives JSON stdin {session_id, tool_input.file_path}
      → Cache check (marker file exists?)
        → HIT: exit 0 silently (Claude sees nothing)
        → MISS: citation-manager extract links <file>
          → Format JSON → ## Citation: markdown
          → Write cache marker
          → Return hookSpecificOutput JSON to Claude
```

### What Gets Cached

| Subcommand | Auto-triggered? | Session cached? | Invocation context |
|---|---|---|---|
| `extract links` | Yes (PostToolUse:Read hook) | Yes (session + content hash) | Hook calls CLI on every `.md` read |
| `extract header` | No | No | Manual CLI call by agent |
| `extract file` | No | No | Manual CLI call by agent |

**Key insight**: Only `extract links` benefits from session caching because it's the only subcommand triggered automatically and repeatedly. `extract header` and `extract file` are called on-demand with explicit intent — no deduplication needed.

---

### File Structure

```text
.claude/hooks/citation-manager/
└── extractor.sh                               // Session cache + extraction hook (~145 lines)
    ├── stdin parsing                          // jq: extract session_id + file_path
    ├── cache check                            // marker file lookup (~lines 74-86)
    ├── extraction                             // citation-manager extract links <file>
    ├── formatting                             // JSON → ## Citation: markdown blocks
    ├── cache write                            // touch marker file (~line 128)
    └── output                                 // hookSpecificOutput JSON to stdout

.citation-manager/claude-cache/
└── ${session_id}_${content_hash}              // Empty marker files (0 bytes each)

.claude/settings.json                          // Hook registration
└── PostToolUse[].matcher: "Read"              // Triggers extractor.sh on Read
    └── command: ".claude/hooks/citation-manager/extractor.sh"
```

---

## Cache Mechanics

### Cache Key Strategy

```text
cache_key = "${session_id}_${content_hash}"
```

| Component | Source | Purpose |
|---|---|---|
| `session_id` | Hook stdin JSON `.session_id` | Scopes cache to current Claude Code conversation |
| `content_hash` | `md5 < "$file_path"` | Invalidates cache when file content changes |
| Separator | `_` | Joins components |

**Invalidation**: Content-hash-based. If the file is edited between reads, the hash changes, causing a cache miss and re-extraction. This is correct behavior — edited files may have new/changed citations.

### Cache Storage

- **Location**: `.citation-manager/claude-cache/` (project root)
- **Entry format**: Empty marker files (0 bytes) — existence = cached
- **Creation**: `touch "$cache_file"` after successful extraction
- **Cleanup**: Manual only (no TTL, no auto-expiry)
- **Lifecycle**: Persists across sessions until manually cleared

### Cache Check Flow (extractor.sh lines 74-86)

```bash
# Compute cache key
file_content_hash=$(md5 < "$file_path" 2>/dev/null || shasum -a 256 < "$file_path" 2>/dev/null | cut -d' ' -f1)
cache_key="${session_id}_${file_content_hash}"
cache_file="${CACHE_DIR}/${cache_key}"

# Check cache
if [[ -f "$cache_file" ]]; then
    exit 0  # Cache hit — silent exit
fi
```

### Output Formatting (extractor.sh lines 105-141)

On cache miss, the hook:
1. Calls `citation-manager extract links "$file_path"` (gets JSON)
2. Extracts `.extractedContentBlocks` via jq
3. Transforms each block into `## Citation: ${contentId}\n\n${content}` markdown
4. Wraps in `hookSpecificOutput.additionalContext` JSON for Claude

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "## Citation: abc123\n\n[extracted content]\n\n---\n\n## Citation: def456\n\n[more content]"
  }
}
```

---

## Refactor Target (Issue #92)

**Goal**: Move cache logic from bash into CLI tool. Hook becomes thin passthrough (~20 lines).

| Responsibility | Current owner | Target owner |
|---|---|---|
| Cache check/write | `extractor.sh` (bash) | `citation-manager` CLI (TypeScript) |
| Cache key computation | `extractor.sh` | `checkExtractCache.ts` module |
| Session ID awareness | `extractor.sh` | CLI `--session <id>` flag |
| Output formatting | `extractor.sh` | `extractor.sh` (stays in hook) |
| `hookSpecificOutput` wrapping | `extractor.sh` | `extractor.sh` (stays in hook) |

**New CLI flags**: `--session <id>`, `--no-cache`, `--clear-cache`

**Design doc**: [cache-refactor-extract-links](../../../../openspec/changes/cache-refactor-extract-links/design.md)

---

## Whiteboard

### Why Only `extract links` Is Cached

The three `extract` subcommands have fundamentally different invocation patterns:

| Subcommand | Trigger | Frequency | Dedup value |
|---|---|---|---|
| `extract links` | Automatic (every `.md` Read) | High (same file read multiple times per session) | **High** — prevents context bloat |
| `extract header` | Manual (agent requests specific section) | Low (intentional, targeted) | **None** — agent wants the content |
| `extract file` | Manual (agent requests full file) | Low (intentional, targeted) | **None** — agent wants the content |

The cache exists specifically to solve the "automatic repeated extraction" problem. Manual subcommands don't have this problem because they're called with explicit intent.

### Cache Growth Characteristics

- Marker files are 0 bytes (just filesystem metadata)
- Growth rate: ~1 file per unique `.md` read per session
- Typical session: 10-50 marker files
- Risk: Unbounded growth across sessions (files never auto-deleted)
- Mitigation: Manual `--clear-cache` (post-refactor) or `rm -rf .citation-manager/claude-cache/`
