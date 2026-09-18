#!/usr/bin/env bash
# Maintains the global jact link from the canonical main checkout.
# Use --hook only from the post-merge hook.

set -euo pipefail

# Clear inherited Git variables so rev-parse resolves the current checkout,
# not a foreign repository passed through the environment.
unset GIT_DIR GIT_WORK_TREE GIT_COMMON_DIR

HOOK_MODE=0
case "${1:-}" in
  "")
    ;;
  --hook)
    HOOK_MODE=1
    ;;
  *)
    echo "usage: $0 [--hook]" >&2
    exit 2
    ;;
esac

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"

if ! GIT_COMMON_DIR="$(git -C "$SCRIPT_DIR" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)"; then
  echo "refresh-global-cli: not inside a git repository ($SCRIPT_DIR)" >&2
  exit 1
fi

# The canonical checkout is the parent of the shared .git directory; every
# worktree reports that same common dir.
CANONICAL_ROOT="$(dirname -- "$GIT_COMMON_DIR")"
CURRENT_ROOT="$(git rev-parse --path-format=absolute --show-toplevel)"

skip_or_refuse() {
  if (( HOOK_MODE )); then
    echo "refresh-global-cli: skipped — $1"
    exit 0
  fi
  echo "refresh-global-cli: refused — $1" >&2
  echo "refresh-global-cli: the global jact link is owned by $CANONICAL_ROOT on main." >&2
  exit 1
}

if [[ "$CURRENT_ROOT" != "$CANONICAL_ROOT" ]]; then
  skip_or_refuse "not the canonical checkout (here: $CURRENT_ROOT)"
fi

CANONICAL_BRANCH="$(git -C "$CANONICAL_ROOT" symbolic-ref --quiet --short HEAD || true)"
if [[ "$CANONICAL_BRANCH" != "main" ]]; then
  skip_or_refuse "canonical checkout is on '${CANONICAL_BRANCH:-detached HEAD}', not main"
fi

cd -- "$CANONICAL_ROOT"

BACKUP_DIR="$(mktemp -d "$CANONICAL_ROOT/.jact-refresh.XXXXXX")"
REFRESH_COMPLETE=0

rollback() {
  local status="$1"
  if (( ! REFRESH_COMPLETE )); then
    rm -rf -- node_modules
    if [[ -e "$BACKUP_DIR/node_modules" || -L "$BACKUP_DIR/node_modules" ]]; then
      mv -- "$BACKUP_DIR/node_modules" node_modules
    fi
  fi
  rm -rf -- "$BACKUP_DIR"
  trap - EXIT INT TERM
  exit "$status"
}

trap 'rollback $?' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [[ -e node_modules || -L node_modules ]]; then
  mv -- node_modules "$BACKUP_DIR/node_modules"
fi

if ! npm ci; then
  echo "refresh-global-cli: dependency sync failed in $CANONICAL_ROOT; the previous CLI dependencies will be restored." >&2
  exit 1
fi

if ! npm run build; then
  echo "refresh-global-cli: build failed in $CANONICAL_ROOT; the previous CLI dependencies will be restored." >&2
  exit 1
fi

REFRESH_COMPLETE=1
rm -rf -- "$BACKUP_DIR"
trap - EXIT INT TERM

if ! npm link; then
  echo "refresh-global-cli: npm link failed; check write permission on the npm global prefix (npm prefix -g)." >&2
  exit 1
fi

echo "refresh-global-cli: global jact linked to $CANONICAL_ROOT (main)."
