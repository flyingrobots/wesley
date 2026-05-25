#!/usr/bin/env bash

# Local CI Test Simulation.
# Simulates the retained Rust product and repo-level smoke checks.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "🧪 Wesley - Local CI Simulation"
echo "==============================="

cd "$ROOT_DIR"

echo ""
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

echo ""
echo "🔧 Checking Bats installation..."
if ! command -v bats &> /dev/null; then
    echo "❌ Bats not found. Install with: brew install bats-core"
    exit 1
fi

bats --version
echo "✅ Bats is available"

echo ""
echo "🧪 Running workspace tests..."
pnpm -w test

echo ""
echo "🦀 Running Rust product preflight..."
cargo xtask preflight

echo ""
echo "🔥 Running repo-level Bats checks..."
export BATS_LIB_PATH=test
export TERM=xterm
export BATS_NO_COLOR=1
bash scripts/setup-bats-plugins.sh
ln -sfn "$PWD/test/bats-plugins" test/hosts/bats-plugins
bats -t test/ci-workflows.bats test/domain-empty-boundary.bats test/docs-whitespace.bats

echo ""
echo "✅ Local CI simulation completed successfully!"
echo "🚀 Ready for GitHub Actions"
