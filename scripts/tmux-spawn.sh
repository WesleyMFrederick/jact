#!/usr/bin/env bash
# tmux-spawn.sh — Spawn a jact agent via tmux
#
# Modes:
#   detached session (default)  — tmux new-session -d
#   new window                  — tmux new-window inside current tmux session
#   new pane                    — tmux split-window inside current tmux window
#
# Usage:
#   ./scripts/tmux-spawn.sh [OPTIONS] <path-to-markdown>
#
# Options:
#   -w, --window            Spawn as a new window in the current tmux session
#                           (useful with tmux -CC / iTerm2 integration)
#   -p, --pane              Spawn as a new pane in the current tmux window
#                           (splits the current window, visible side-by-side)
#   -n, --name NAME         Session or window name (default: jact-<timestamp>)
#
# Examples:
#   # Detached session (fire-and-forget)
#   ./scripts/tmux-spawn.sh test/fixtures/sample.md
#   ./scripts/tmux-spawn.sh -n my-agent test/fixtures/sample.md
#
#   # New window in current tmux session (visible in iTerm2 -CC)
#   ./scripts/tmux-spawn.sh -w test/fixtures/sample.md
#   ./scripts/tmux-spawn.sh -w -n jact-agent test/fixtures/sample.md
#
#   # New pane in current window (split side-by-side in iTerm2 -CC)
#   ./scripts/tmux-spawn.sh -p test/fixtures/sample.md
#   ./scripts/tmux-spawn.sh -p -n jact-agent test/fixtures/sample.md
#
# Management:
#   tmux ls                              # list sessions
#   tmux attach -t <name>                # attach to detached session
#   tmux capture-pane -pt <name>         # grab output without attaching
#   tmux kill-session -t <name>          # kill detached session
#   tmux kill-window -t <name>           # kill window in current session
#   tmux kill-pane -t <name>             # kill pane in current window

set -euo pipefail

MODE="session"
NAME=""
FILE=""

usage() {
  sed -n '2,/^$/p' "$0"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -w|--window)
      MODE="window"
      shift
      ;;
    -p|--pane)
      MODE="pane"
      shift
      ;;
    -n|--name)
      NAME="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    -*)
      echo "Unknown option: $1"
      usage
      ;;
    *)
      if [[ -z "$FILE" ]]; then
        FILE="$1"
      else
        echo "Unexpected argument: $1"
        usage
      fi
      shift
      ;;
  esac
done

if [[ -z "$FILE" ]]; then
  echo "Error: no markdown file specified"
  usage
fi

if [[ -z "$NAME" ]]; then
  NAME="jact-$(date +%s)"
fi

if ! command -v tmux &>/dev/null; then
  echo "Error: tmux is not installed"
  exit 1
fi

CMD="npm run jact:validate '$FILE'; read -n 1 -s -r -p 'Press any key to exit...'"
PANE_CMD="npm run jact:validate '$FILE'"

if [[ "$MODE" == "window" ]]; then
  if [[ -z "${TMUX:-}" ]]; then
    echo "Error: --window requires running inside an existing tmux session (TMUX is not set)"
    exit 1
  fi

  echo "Spawning new tmux window '$NAME' in current session for: $FILE"
  tmux new-window -n "$NAME" "$CMD"
  echo "Window '$NAME' created in current session."
  echo "  Switch:     tmux select-window -t $NAME"
  echo "  Capture:    tmux capture-pane -pt $NAME"
  echo "  Kill:       tmux kill-window -t $NAME"
elif [[ "$MODE" == "pane" ]]; then
  if [[ -z "${TMUX:-}" ]]; then
    echo "Error: --pane requires running inside an existing tmux session (TMUX is not set)"
    exit 1
  fi

  echo "Spawning new tmux pane '$NAME' in current window for: $FILE"
  # Open a plain interactive shell pane, then send the command via keys
  # so the pane stays interactive and focus events are handled by the shell
  PANE_ID=$(tmux split-window -v -p 50 -P -F '#{pane_id}' -c "#{pane_current_path}")
  tmux send-keys -t "$PANE_ID" "$PANE_CMD" Enter
  echo "Pane $PANE_ID created in current window (split view, interactive shell)."
  echo "  Navigate:   tmux select-pane -t $PANE_ID"
  echo "  Capture:    tmux capture-pane -p -t $PANE_ID"
  echo "  Kill:       tmux kill-pane -t $PANE_ID"
else
  echo "Spawning detached tmux session '$NAME' for: $FILE"
  tmux new-session -d -s "$NAME" "$CMD"
  echo "Session '$NAME' is running detached."
  echo "  Attach:     tmux attach -t $NAME"
  echo "  Capture:    tmux capture-pane -pt $NAME"
  echo "  Kill:       tmux kill-session -t $NAME"
fi
