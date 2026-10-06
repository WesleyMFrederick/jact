#!/usr/bin/env bash
# Packs the built package, checks the tarball contents, installs the tarball
# into an empty prefix, and runs the installed CLI.
# Usage: bash smoke-pack.sh [project-root]
# Run `npm run build` first. The script does not build the package.

set -euo pipefail

PROJECT_ROOT="$(cd -- "${1:-$(pwd)}" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf -- "$WORK"' EXIT

fail() {
  echo "smoke-pack: FAIL — $1" >&2
  exit 1
}

cd -- "$PROJECT_ROOT"

# Pack without lifecycle scripts, so the check sees the current build output.
TARBALL_NAME="$(npm pack --ignore-scripts --silent --pack-destination "$WORK" | tail -n 1)"
TARBALL="$WORK/$TARBALL_NAME"
[[ -f "$TARBALL" ]] || fail "npm pack did not create a tarball"

# 1. The tarball contains only the intended files.
UNEXPECTED="$(tar -tzf "$TARBALL" | grep -Ev '^package/(bin/.+|dist/.+|package\.json|README[^/]*|LICENSE[^/]*)$' || true)"
[[ -z "$UNEXPECTED" ]] || fail "unexpected files in tarball:
$UNEXPECTED"

mkdir -p "$WORK/unpacked"
tar -xzf "$TARBALL" -C "$WORK/unpacked"

# 2. Source maps do not embed source text.
if grep -rl --include='*.map' 'sourcesContent' "$WORK/unpacked" >/dev/null; then
  fail "a source map embeds sourcesContent"
fi

# 3. The tarball does not contain private local paths.
if grep -rl '/Users/' "$WORK/unpacked" >/dev/null; then
  fail "tarball contains a /Users/ path: $(grep -rl '/Users/' "$WORK/unpacked" | head -n 5)"
fi

# 4. The tarball installs into an empty prefix without install scripts.
PREFIX="$WORK/prefix"
npm install --global --prefix "$PREFIX" --ignore-scripts --no-audit --no-fund "$TARBALL" >/dev/null
JACT="$PREFIX/bin/jact"
[[ -x "$JACT" ]] || fail "installed package has no jact executable"

EXPECTED_VERSION="$(node -p "require('./package.json').version")"
ACTUAL_VERSION="$("$JACT" --version)"
[[ "$ACTUAL_VERSION" == "$EXPECTED_VERSION" ]] || fail "jact --version printed '$ACTUAL_VERSION', expected '$EXPECTED_VERSION'"

"$JACT" --help >/dev/null || fail "jact --help failed"

# 5. The installed CLI validates and outlines a real document.
FIXTURE="$WORK/fixture"
mkdir -p "$FIXTURE"
printf '# Guide\n\nSee [the target](target.md#Details).\n' >"$FIXTURE/guide.md"
printf '# Target\n\n## Details\n\nText.\n' >"$FIXTURE/target.md"

"$JACT" validate "$FIXTURE/guide.md" --scope "$FIXTURE" >/dev/null || fail "jact validate rejected a valid link"

printf '# Guide\n\nSee [the target](target.md#Missing).\n' >"$FIXTURE/broken.md"
if "$JACT" validate "$FIXTURE/broken.md" --scope "$FIXTURE" >/dev/null 2>&1; then
  fail "jact validate accepted a broken anchor"
fi

OUTLINE="$("$JACT" outline "$FIXTURE/target.md")"
[[ "$OUTLINE" == *'"Details"'* ]] || fail "jact outline did not list the Details heading"

echo "smoke-pack: PASS — $TARBALL_NAME (jact $ACTUAL_VERSION)"
