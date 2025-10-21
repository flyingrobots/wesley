#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Not a git repository; skipping hook installation."
  exit 0
fi

current="$(git config --local core.hooksPath 2>/dev/null || true)"
if [[ "$current" == ".githooks" ]]; then
  echo "Git hooks path already set to .githooks"
  exit 0
fi

if git config --local core.hooksPath .githooks >/dev/null 2>&1; then
  echo "Configured git core.hooksPath to .githooks"
else
  echo "Could not set git hooks path (non-fatal)." >&2
fi
