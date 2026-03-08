#!/usr/bin/env bash
set -euo pipefail

# Ensure bats plugin directories exist under packages/wesley-cli/test/bats-plugins
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PLUGINS_DIR="$ROOT_DIR/packages/wesley-cli/test/bats-plugins"
mkdir -p "$PLUGINS_DIR"

fetch_plugin() {
  local name="$1"; shift
  local url="$1"; shift
  local dest="$PLUGINS_DIR/$name"
  if [[ -d "$dest" && -f "$dest/load" ]]; then
    echo "✓ $name already present"
    return 0
  fi
  echo "→ Fetching $name from $url"
  tmpdir="$(mktemp -d)"
  curl -fsSL "$url" | tar -xz -C "$tmpdir"
  local unpacked
  unpacked="$(find "$tmpdir" -maxdepth 1 -type d -name "${name}-*" -print -quit)"
  if [[ -z "$unpacked" ]]; then
    echo "Failed to unpack $name" >&2
    exit 1
  fi
  rm -rf "$dest"
  mv "$unpacked" "$dest"
  echo "✓ Installed $name → $dest"
}

# Versions pinned for determinism
fetch_plugin bats-support https://github.com/bats-core/bats-support/archive/refs/tags/v0.3.0.tar.gz
fetch_plugin bats-assert  https://github.com/bats-core/bats-assert/archive/refs/tags/v2.1.0.tar.gz
fetch_plugin bats-file    https://github.com/bats-core/bats-file/archive/refs/tags/v0.4.0.tar.gz

echo "All bats plugins ready in $PLUGINS_DIR"
