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
# Paths that this run moved into BACKUP_DIR. Rollback touches only these paths
# and paths that did not exist before the run.
MOVED=()
CREATED=()

backup() {
  local path="$1"
  if [[ -e "$path" || -L "$path" ]]; then
    mv -- "$path" "$BACKUP_DIR/$path"
    MOVED+=("$path")
  else
    CREATED+=("$path")
  fi
}

rollback() {
  local status="$1" path
  if (( ! REFRESH_COMPLETE )); then
    for path in "${MOVED[@]+"${MOVED[@]}"}"; do
      rm -rf -- "$path"
      mv -- "$BACKUP_DIR/$path" "$path"
    done
    for path in "${CREATED[@]+"${CREATED[@]}"}"; do
      rm -rf -- "$path"
    done
  fi
  rm -rf -- "$BACKUP_DIR"
  trap - EXIT INT TERM
  exit "$status"
}

trap 'rollback $?' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

backup node_modules
backup dist

# Install without dependency lifecycle scripts. Only the compiler runs below.
if ! npm ci --ignore-scripts; then
  echo "refresh-global-cli: dependency sync failed in $CANONICAL_ROOT; the previous CLI dependencies and build will be restored." >&2
  exit 1
fi

# The build deletes dist/ and tsconfig.tsbuildinfo, then compiles from source.
if ! npm run build; then
  echo "refresh-global-cli: build failed in $CANONICAL_ROOT; the previous CLI dependencies and build will be restored." >&2
  exit 1
fi

REFRESH_COMPLETE=1
rm -rf -- "$BACKUP_DIR"
trap - EXIT INT TERM

# The package was renamed from `jact` to `@wesleymfrederick/jact`. A link left under
# the old name still owns bin/jact, so npm link fails with EEXIST. Remove it only
# when it is a link (never a registry-installed package).
LEGACY_LINK="$(npm prefix -g)/lib/node_modules/jact"
if [[ -L "$LEGACY_LINK" ]]; then
  npm rm -g jact >/dev/null
fi

# dist/ is already built above; skip the package's prepare script.
if ! npm link --ignore-scripts; then
  echo "refresh-global-cli: npm link failed; check write permission on the npm global prefix (npm prefix -g)." >&2
  exit 1
fi

echo "refresh-global-cli: global jact linked to $CANONICAL_ROOT (main)."
