#!/usr/bin/env bash

# Verify vendored Bats plugin dependencies for repo-level Bats suites.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="$ROOT_DIR/test/vendor/bats-plugins"

required_files=(
  "bats-support/LICENSE"
  "bats-support/load.bash"
  "bats-support/src/output.bash"
  "bats-support/src/error.bash"
  "bats-support/src/lang.bash"
  "bats-assert/LICENSE"
  "bats-assert/load.bash"
  "bats-assert/src/assert_success.bash"
  "bats-assert/src/assert_failure.bash"
  "bats-assert/src/assert_output.bash"
  "bats-file/LICENSE"
  "bats-file/load.bash"
  "bats-file/src/file.bash"
  "bats-file/src/temp.bash"
)

missing=()

for path in "${required_files[@]}"; do
  if [[ ! -f "$TARGET_DIR/$path" ]]; then
    missing+=("$path")
  fi
done

if (( ${#missing[@]} > 0 )); then
  echo "Missing vendored Bats plugin files under $TARGET_DIR:" >&2
  printf '  - %s\n' "${missing[@]}" >&2
  echo "Restore test/vendor/bats-plugins from the repository before running Bats." >&2
  exit 1
fi

echo "Vendored Bats plugins verified in $TARGET_DIR."
