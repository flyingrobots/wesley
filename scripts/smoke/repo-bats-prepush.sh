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

files=(
  test/serve-static-unit.bats
  test/serve-static-relative-unit.bats
  test/docs-planning-boundary.bats
  test/domain-empty-boundary.bats
  test/ir-fixtures.bats
  test/ci-package-manager-policy.bats
  test/ci-workflows.bats
)

for f in "${files[@]}"; do
  echo "[pre-push] bats -t $f"
  timeout 3m bats -t "$f"
done
