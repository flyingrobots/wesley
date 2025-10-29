#!/usr/bin/env bash

# Bootstrap Bats plugin dependencies for the CLI test suite.
# Downloads pinned releases of bats-support, bats-assert, and bats-file
# into packages/wesley-cli/test/bats-plugins/.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="$ROOT_DIR/packages/wesley-cli/test/bats-plugins"

declare -A REPOS=(
  [bats-support]="https://github.com/bats-core/bats-support.git"
  [bats-assert]="https://github.com/bats-core/bats-assert.git"
  [bats-file]="https://github.com/bats-core/bats-file.git"
)

declare -A TAGS=(
  [bats-support]="v0.3.0"
  [bats-assert]="v2.2.3"
  [bats-file]="v0.4.0"
)

echo "📦 Installing Bats plugins into $TARGET_DIR"
mkdir -p "$TARGET_DIR"

for name in "${!REPOS[@]}"; do
  repo="${REPOS[$name]}"
  tag="${TAGS[$name]}"
  dest="$TARGET_DIR/$name"

  echo "→ Fetching $name ($tag)"
  rm -rf "$dest"
  tmp_dir="$(mktemp -d)"
  git clone --depth 1 --branch "$tag" "$repo" "$tmp_dir"
  rm -rf "$tmp_dir/.git"
  mkdir -p "$(dirname "$dest")"
  mv "$tmp_dir" "$dest"
done

echo "✅ Bats plugins installed."
