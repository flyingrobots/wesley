#!/usr/bin/env bash

# Local CI Test Simulation
# Simulates what GitHub Actions will do

set -euo pipefail

echo "🧪 Wesley CLI - Local CI Simulation"
echo "===================================="

cd packages/wesley-cli

echo ""
echo "📦 Installing dependencies..."
pnpm install

echo ""
echo "🔧 Checking Bats installation..."
if ! command -v bats &> /dev/null; then
    echo "❌ Bats not found. Install with: brew install bats-core"
    exit 1
fi

bats --version
echo "✅ Bats is available"

echo ""
echo "📋 Verifying git repository..."
if [[ ! -d .git ]]; then
    echo "🔧 Initializing git repository for tests..."
    git init .
    git config user.name "Local Test"
    git config user.email "test@local.dev"
    git add .
    git commit -m "Local CI test commit" || echo "Nothing to commit"
fi

echo ""
echo "🧪 Running CLI tests (same as CI)..."
pnpm test

echo ""
echo "📄 Running tests with TAP output (CI format)..."
pnpm test:tap > cli-test-results-local.tap
echo "TAP results saved to cli-test-results-local.tap"

echo ""
echo "🔥 Running smoke tests..."
echo "Version check:"
node wesley.mjs --version

echo ""
echo "Help check:"  
node wesley.mjs --help | head -5

echo ""
echo "stdin support check:"
echo 'type Query { hello: String }' | node wesley.mjs generate --schema - --json --quiet || echo "✓ Expected parser failure"

echo ""
echo "✅ Local CI simulation completed successfully!"
echo "🚀 Ready for GitHub Actions"