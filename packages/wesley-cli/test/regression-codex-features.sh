#!/usr/bin/env bash

# Regression Test Suite for Codex-Discussed Features
# Automated tests that can be re-run to ensure features don't break

set -euo pipefail

CLI_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/wesley.mjs"
PASSED=0
FAILED=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

test_case() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

pass() {
    echo -e "${GREEN}✓ PASS${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗ FAIL${NC} $1"
    ((FAILED++))
}

echo "Wesley CLI - Codex Features Regression Test Suite"
echo "================================================="

# Test 1: --schema - reads from stdin
test_case "Basic stdin reading with --schema -"
exit_code=0
output=$(echo 'type Query { hello: String }' | node "$CLI_PATH" generate --schema - --quiet 2>&1) || exit_code=$?
if [[ $exit_code -eq 3 ]]; then
    pass "Stdin input processed correctly (exit 3)"
else
    fail "Expected exit code 3, got $exit_code"
fi

# Test 2: --stdin convenience flag
test_case "Stdin convenience flag"
exit_code=0
output=$(echo 'type Query { hello: String }' | node "$CLI_PATH" generate --stdin --quiet 2>&1) || exit_code=$?
if [[ $exit_code -eq 3 ]]; then
    pass "--stdin flag works correctly (exit 3)"
else
    fail "Expected exit code 3 with --stdin, got $exit_code"
fi

# Test 3: Empty stdin detection
test_case "Empty stdin error handling"
exit_code=0
output=$(echo -n '' | node "$CLI_PATH" generate --schema - 2>&1) || exit_code=$?
if [[ $exit_code -eq 2 ]]; then
    pass "Empty stdin properly detected (exit 2)"
else
    fail "Expected exit code 2 for empty stdin, got $exit_code"
fi

if echo "$output" | grep -q "empty"; then
    pass "Empty stdin error message is helpful"
else
    fail "Missing or unhelpful empty stdin error message"
fi

# Test 4: JSON output format
test_case "JSON output formatting"
exit_code=0
output=$(echo -n '' | node "$CLI_PATH" generate --schema - --json 2>&1) || exit_code=$?
if echo "$output" | jq -e '.success == false' >/dev/null 2>&1; then
    pass "JSON output contains success: false"
else
    fail "JSON output malformed or missing success field"
fi

if echo "$output" | jq -e '.code' >/dev/null 2>&1; then
    pass "JSON output contains error code"
else
    fail "JSON output missing error code"
fi

# Test 5: Quiet mode suppression
test_case "Quiet mode output suppression"
exit_code=0
output=$(echo -n '' | node "$CLI_PATH" generate --schema - --quiet 2>&1) || exit_code=$?
if [[ $exit_code -eq 2 ]]; then
    pass "Quiet mode preserves exit code"
else
    fail "Quiet mode changed exit code: expected 2, got $exit_code"
fi

if [[ -z "$output" ]]; then
    pass "Quiet mode suppresses all output"
else
    fail "Quiet mode leaked output: '$output'"
fi

# Test 6: Stream separation (logs to stderr, results to stdout)
test_case "Stream separation (stdout/stderr)"
exit_code=0
stdout_only=$(echo 'type Query { hello: String }' | node "$CLI_PATH" generate --stdin --json 2>/dev/null) || exit_code=$?
stderr_only=$(echo 'type Query { hello: String }' | node "$CLI_PATH" generate --stdin --json 2>&1 >/dev/null) || true

if [[ $exit_code -eq 3 ]]; then
    pass "Stream separation test exits correctly"
else
    fail "Stream separation test: unexpected exit code $exit_code"
fi

# Check stderr contains logs
if [[ -n "$stderr_only" ]]; then
    pass "Logs properly routed to stderr"
else
    fail "No logs found on stderr"
fi

# Test 7: Help text documents stdin
test_case "Help documentation includes stdin"
help_output=$(node "$CLI_PATH" generate --help 2>&1)
if echo "$help_output" | grep -q -i "stdin"; then
    pass "Help text documents stdin support"
else
    fail "Help text missing stdin documentation"
fi

if echo "$help_output" | grep -q "\-"; then
    pass "Help text mentions - for stdin"
else
    fail "Help text doesn't mention - for stdin"
fi

# Test 8: Error code consistency across modes
test_case "Error code consistency across output modes"

# Normal mode
exit_normal=0
$(echo -n '' | node "$CLI_PATH" generate --schema - >/dev/null 2>&1) || exit_normal=$?

# JSON mode  
exit_json=0
$(echo -n '' | node "$CLI_PATH" generate --schema - --json >/dev/null 2>&1) || exit_json=$?

# Quiet mode
exit_quiet=0
$(echo -n '' | node "$CLI_PATH" generate --schema - --quiet >/dev/null 2>&1) || exit_quiet=$?

if [[ $exit_normal -eq $exit_json && $exit_json -eq $exit_quiet ]]; then
    pass "Exit codes consistent across modes ($exit_normal)"
else
    fail "Exit codes inconsistent: normal=$exit_normal, json=$exit_json, quiet=$exit_quiet"
fi

# Test 9: File vs stdin path reporting
test_case "Path reporting (file vs stdin)"
file_error=$(node "$CLI_PATH" generate --schema nonexistent.graphql 2>&1 || true)
stdin_error=$(echo -n '' | node "$CLI_PATH" generate --schema - 2>&1 || true)

if echo "$file_error" | grep -q "nonexistent.graphql"; then
    pass "File path properly reported in errors"
else
    fail "File path missing from error message"
fi

if echo "$stdin_error" | grep -q "stdin"; then
    pass "Stdin path properly reported in errors"
else
    fail "Stdin path missing from error message"
fi

# Test 10: Mixed flags (--stdin with --schema file should prefer stdin)
test_case "Flag precedence (--stdin + --schema file)"
exit_code=0
output=$(echo 'type Query { hello: String }' | node "$CLI_PATH" generate --stdin --schema nonexistent.graphql --quiet 2>&1) || exit_code=$?

if [[ $exit_code -eq 3 ]]; then
    pass "Mixed flags: stdin takes precedence (exit 3, not file error 2)"
else
    fail "Mixed flags: expected stdin precedence (exit 3), got $exit_code"
fi

echo ""
echo "================================================="
echo "Test Results:"
echo "  PASSED: $PASSED"
echo "  FAILED: $FAILED"
echo "  TOTAL:  $((PASSED + FAILED))"

if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED${NC}"
    exit 0
else
    echo -e "${RED}💥 SOME TESTS FAILED${NC}"
    exit 1
fi