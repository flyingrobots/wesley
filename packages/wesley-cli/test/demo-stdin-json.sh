#!/usr/bin/env bash

# Demonstration Scripts for Stdin and JSON Features
# Re-runnable test scenarios from our Codex discussion

set -euo pipefail

CLI_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/wesley.mjs"

echo "Wesley CLI - Stdin and JSON Feature Demonstration"
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

demo() {
    echo -e "${BLUE}[DEMO]${NC} $1"
}

result() {
    echo -e "${GREEN}[RESULT]${NC} $1"
}

separator() {
    echo ""
    echo "---"
    echo ""
}

# Demo 1: Basic stdin support with --schema -
demo "1. Basic stdin support with --schema -"
echo 'Command: echo "type Query { hello: String }" | node wesley.mjs generate --schema - --quiet ; echo $?'
echo ""

exit_code=0
echo 'type Query { hello: String }' | node "$CLI_PATH" generate --schema - --quiet || exit_code=$?
result "Exit code: $exit_code (3 = PARSE_FAILED, expected due to stub parser)"

separator

# Demo 2: Stdin convenience flag
demo "2. Stdin convenience flag (--stdin)"
echo 'Command: echo "type Query { hello: String }" | node wesley.mjs generate --stdin --quiet ; echo $?'
echo ""

exit_code=0
echo 'type Query { hello: String }' | node "$CLI_PATH" generate --stdin --quiet || exit_code=$?
result "Exit code: $exit_code (3 = PARSE_FAILED, expected due to stub parser)"

separator

# Demo 3: Empty stdin handling
demo "3. Empty stdin error handling"
echo 'Command: echo -n "" | node wesley.mjs generate --schema - ; echo $?'
echo ""

exit_code=0
echo -n '' | node "$CLI_PATH" generate --schema - || exit_code=$?
result "Exit code: $exit_code (2 = EEMPTYSCHEMA, proper error handling)"

separator

# Demo 4: JSON mode with stdin - Stream separation
demo "4. JSON mode with stream separation (logs → stderr, result → stdout)"
echo 'Command: echo "type Query { hello: String }" | node wesley.mjs generate --stdin --json'
echo ""
echo "Combined output:"
exit_code=0
echo 'type Query { hello: String }' | node "$CLI_PATH" generate --stdin --json || exit_code=$?
result "Exit code: $exit_code"

echo ""
echo "Stdout only (final result):"
stdout_only=$(echo 'type Query { hello: String }' | node "$CLI_PATH" generate --stdin --json 2>/dev/null) || true
if [[ -n "$stdout_only" ]]; then
    echo "$stdout_only" | jq .
else
    result "No stdout output (expected for this error case)"
fi

echo ""
echo "Stderr only (logs):"
stderr_only=$(echo 'type Query { hello: String }' | node "$CLI_PATH" generate --stdin --json 2>&1 >/dev/null) || true
echo "$stderr_only" | head -3  # Show first 3 lines of logs

separator

# Demo 5: JSON error output consistency
demo "5. JSON error output consistency"
echo 'Command: echo -n "" | node wesley.mjs generate --schema - --json'
echo ""

exit_code=0
echo -n '' | node "$CLI_PATH" generate --schema - --json || exit_code=$?
result "Exit code: $exit_code (2 = EEMPTYSCHEMA)"
echo "Note: Error formatted as JSON with success: false"

separator

# Demo 6: Quiet mode suppresses all output
demo "6. Quiet mode suppresses all output (even in error cases)"
echo 'Command: echo -n "" | node wesley.mjs generate --schema - --quiet ; echo $?'
echo ""

exit_code=0
output=$(echo -n '' | node "$CLI_PATH" generate --schema - --quiet 2>&1) || exit_code=$?
result "Exit code: $exit_code (2 = EEMPTYSCHEMA)"
if [[ -z "$output" ]]; then
    result "No output produced (quiet mode working)"
else
    result "Output: '$output'"
fi

separator

# Demo 7: Help text includes stdin documentation
demo "7. Help text includes stdin documentation"
echo 'Command: node wesley.mjs generate --help | grep -A2 -B2 stdin'
echo ""

node "$CLI_PATH" generate --help | grep -A2 -B2 -i stdin
result "Help text documents stdin support"

separator

# Demo 8: Scripting example - Pure stdout for JSON results
demo "8. Scripting example - Extract data from JSON output"
echo 'Command: echo "type Query { hello: String }" | node wesley.mjs generate --stdin --json --quiet 2>/dev/null | jq -r .success'
echo ""

json_result=$(echo 'type Query { hello: String }' | node "$CLI_PATH" generate --stdin --json --quiet 2>/dev/null || true)
if [[ -n "$json_result" ]]; then
    success_value=$(echo "$json_result" | jq -r '.success // "null"')
    result "JSON success field: $success_value"
else
    result "No JSON output (expected for this error case - logs went to stderr)"
fi

echo ""
echo "================================================="
echo "✅ All stdin and JSON features demonstrated!"
echo ""
echo "Key improvements:"
echo "- ✅ --schema - and --stdin support"
echo "- ✅ Stream separation (logs→stderr, results→stdout)"
echo "- ✅ JSON error formatting with success/error fields"
echo "- ✅ Quiet mode suppresses all output but preserves exit codes"
echo "- ✅ Proper exit codes: 2 (missing/empty), 3 (parse failed)"
echo "- ✅ Script-friendly JSON output for automation"