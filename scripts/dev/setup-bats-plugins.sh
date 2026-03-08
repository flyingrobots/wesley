#!/usr/bin/env bash
set -euo pipefail

# Ensure bats plugin directories exist under packages/wesley-cli/test/bats-plugins
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PLUGINS_DIR="$ROOT_DIR/packages/wesley-cli/test/bats-plugins"
mkdir -p "$PLUGINS_DIR"

fetch_plugin() {
  local name="$1"; shift
  local url="$1"; shift
  local expected_sha="$1"; shift
  local dest="$PLUGINS_DIR/$name"
  if [[ -d "$dest" && -f "$dest/load" ]]; then
    echo "✓ $name already present"
    return 0
  fi
  echo "→ Fetching $name from $url"
  local tmpfile
  tmpfile="$(mktemp)"
  curl --proto =https --tlsv1.2 -fsSL -o "$tmpfile" "$url"
  local actual_sha
  actual_sha="$(shasum -a 256 "$tmpfile" | cut -d' ' -f1)"
  if [[ "$actual_sha" != "$expected_sha" ]]; then
    echo "SHA-256 mismatch for $name" >&2
    echo "  expected: $expected_sha" >&2
    echo "  actual:   $actual_sha" >&2
    rm -f "$tmpfile"
    exit 1
  fi
  local tmpdir
  tmpdir="$(mktemp -d)"
  tar -xz -C "$tmpdir" -f "$tmpfile"
  rm -f "$tmpfile"
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

# Versions and SHA-256 checksums pinned for determinism
fetch_plugin bats-support \
  https://github.com/bats-core/bats-support/archive/refs/tags/v0.3.0.tar.gz \
  7815237aafeb42ddcc1b8c698fc5808026d33317d8701d5ec2396e9634e2918f

fetch_plugin bats-assert \
  https://github.com/bats-core/bats-assert/archive/refs/tags/v2.2.3.tar.gz \
  749abf9d9cd254bd492a9d22ef6e347bacb3041d2bc95032a38af5293ded3198

fetch_plugin bats-file \
  https://github.com/bats-core/bats-file/archive/refs/tags/v0.4.0.tar.gz \
  9b69043241f3af1c2d251f89b4fcafa5df3f05e97b89db18d7c9bdf5731bb27a

echo "All bats plugins ready in $PLUGINS_DIR"
