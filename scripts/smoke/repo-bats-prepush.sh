#!/usr/bin/env bash
set -euo pipefail

if [[ "${CI:-}" == "true" || "${SKIP_BATS_PREPUSH:-}" == "1" ]]; then
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

export BATS_LIB_PATH=test/vendor
export TERM=xterm
export BATS_NO_COLOR=1

timeout 60s bash scripts/setup-bats-plugins.sh || {
  echo "[pre-push] Vendored Bats plugin verification failed" >&2
  exit 1
}

# Every suite, discovered the same way CI discovers them. The whole sweep takes
# under a minute, so there is no reason for a hand-kept list that can name a suite
# that no longer exists.
# Without nullglob an unmatched glob is passed through as the literal string,
# and bats would be run on a file called 'test/*.bats' before the count is read.
shopt -s nullglob
ran=0
for f in test/*.bats; do
  echo "[pre-push] bats -t $f"
  timeout 3m bats -t "$f"
  ran=$((ran + 1))
done
if [ "$ran" -eq 0 ]; then
  echo "[pre-push] No Bats suites ran." >&2
  exit 1
fi
