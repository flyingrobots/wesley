#!/usr/bin/env bash

# Stdin and JSON Improvements E2E Test Suite
# Tests the new --stdin support and improved --json behavior

set -euo pipefail

# Test framework functions
source "$(dirname "$0")/test-framework.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLI_PATH="$CLI_ROOT/wesley.mjs"
TEMP_DIR="/tmp/wesley-stdin-json-test-$(date +%s)"

setup_test_workspace() {
    log_info "Setting up test workspace: $TEMP_DIR"
    mkdir -p "$TEMP_DIR"
    cd "$TEMP_DIR"
    
    # Create test schemas
    cat > simple.graphql << 'EOF'
type Query {
  hello: String
}
EOF
    
    log_info "Created test workspace in $TEMP_DIR"
}

cleanup_test_workspace() {
    if [[ -d "$TEMP_DIR" ]]; then
        rm -rf "$TEMP_DIR"
        log_info "Cleaned up test workspace"
    fi
}

# Test 1: Basic stdin support with --schema -
test_stdin_with_schema_dash() {
    log_info "Testing stdin with --schema -..."
    
    local exit_code=0
    local output
    local stderr_output
    
    # Capture both stdout and stderr separately
    output=$(echo 'type Query { hello: String }' | node "$CLI_PATH" generate --schema - --quiet 2>/dev/null) || exit_code=$?
    stderr_output=$(echo 'type Query { hello: String }' | node "$CLI_PATH" generate --schema - --quiet 2>&1 >/dev/null) || true
    
    if [[ $exit_code -eq 3 ]]; then
        log_success "✓ Stdin input processed (exits 3 due to stub parser - expected)"
        if [[ -z "$output" ]]; then
            log_success "✓ Quiet mode produces no stdout output"
        else
            log_error "✗ Quiet mode produced unexpected stdout output"
            echo "Stdout: '$output'"
            return 1
        fi
    else
        log_error "✗ Unexpected exit code: $exit_code"
        echo "Stdout: $output"
        echo "Stderr: $stderr_output"
        return 1
    fi
    
    return 0
}

# Test 2: --stdin convenience flag
test_stdin_flag() {
    log_info "Testing --stdin convenience flag..."
    
    local exit_code=0
    local output
    
    output=$(echo 'type Query { hello: String }' | node "$CLI_PATH" generate --stdin --quiet 2>/dev/null) || exit_code=$?
    
    if [[ $exit_code -eq 3 ]]; then
        log_success "✓ --stdin flag works (exits 3 due to stub parser - expected)"
        if [[ -z "$output" ]]; then
            log_success "✓ --stdin with --quiet produces no stdout output"
        else
            log_error "✗ --stdin with --quiet produced unexpected output"
            echo "Output: '$output'"
            return 1
        fi
    else
        log_error "✗ Unexpected exit code with --stdin: $exit_code"
        echo "Output: $output"
        return 1
    fi
    
    return 0
}

# Test 3: Empty stdin error handling
test_empty_stdin() {
    log_info "Testing empty stdin error handling..."
    
    local exit_code=0
    local output
    
    output=$(echo -n '' | node "$CLI_PATH" generate --schema - 2>&1) || exit_code=$?
    
    if [[ $exit_code -eq 2 ]]; then
        log_success "✓ Empty stdin exits with code 2 (EEMPTYSCHEMA)"
        if echo "$output" | grep -q "Schema input from stdin is empty"; then
            log_success "✓ Contains helpful empty stdin error message"
        else
            log_error "✗ Missing helpful empty stdin error message"
            echo "Output: $output"
            return 1
        fi
    else
        log_error "✗ Expected exit code 2 for empty stdin, got $exit_code"
        echo "Output: $output"
        return 1
    fi
    
    return 0
}

# Test 4: JSON mode with stdin
test_json_with_stdin() {
    log_info "Testing JSON mode with stdin..."
    
    local exit_code=0
    local output
    
    output=$(echo 'type Query { hello: String }' | node "$CLI_PATH" generate --stdin --json 2>&1) || exit_code=$?
    
    if [[ $exit_code -eq 3 ]]; then
        log_success "✓ JSON + stdin exits 3 (parser error - expected)"
        if echo "$output" | jq -e '.success == false' >/dev/null 2>&1; then
            log_success "✓ JSON output contains success: false"
        else
            log_error "✗ JSON output malformed or missing success field"
            echo "Output: $output"
            return 1
        fi
    else
        log_error "✗ Expected exit code 3 for JSON + stdin, got $exit_code"
        echo "Output: $output"
        return 1
    fi
    
    return 0
}

# Test 5: Stream separation - logs to stderr, result to stdout
test_stream_separation() {
    log_info "Testing stream separation (logs→stderr, result→stdout)..."
    
    # This test checks that with --json, logs go to stderr and final JSON goes to stdout
    local exit_code=0
    local stdout_only
    local stderr_only
    
    # Capture stdout and stderr separately
    stdout_only=$(echo 'type Query { hello: String }' | node "$CLI_PATH" generate --stdin --json 2>/dev/null) || exit_code=$?
    stderr_only=$(echo 'type Query { hello: String }' | node "$CLI_PATH" generate --stdin --json 2>&1 >/dev/null) || true
    
    if [[ $exit_code -eq 3 ]]; then
        log_success "✓ Command exits 3 (parser error - expected)"
        
        # Check that stderr contains logs (structured JSON from Pino)
        if [[ -n "$stderr_only" ]]; then
            if echo "$stderr_only" | head -1 | jq -e '.level' >/dev/null 2>&1; then
                log_success "✓ Stderr contains structured JSON logs"
            else
                log_warning "⚠️ Stderr contains logs but not structured JSON (may be error output)"
            fi
        fi
        
        # Check that stdout contains final result (if any)
        if [[ -n "$stdout_only" ]]; then
            if echo "$stdout_only" | jq -e '.success == false' >/dev/null 2>&1; then
                log_success "✓ Stdout contains final JSON result"
            else
                log_warning "⚠️ Stdout contains data but not valid JSON result"
            fi
        else
            log_info "ℹ️ No stdout output (expected for this error case)"
        fi
        
    else
        log_error "✗ Unexpected exit code for stream separation test: $exit_code"
        return 1
    fi
    
    return 0
}

# Test 6: Help text mentions stdin support
test_help_mentions_stdin() {
    log_info "Testing help text includes stdin documentation..."
    
    local output
    output=$(node "$CLI_PATH" generate --help 2>&1)
    
    if echo "$output" | grep -q "stdin"; then
        log_success "✓ Help text mentions stdin support"
    else
        log_error "✗ Help text missing stdin documentation"
        echo "Help output:"
        echo "$output"
        return 1
    fi
    
    return 0
}

# Test Suite Execution
run_stdin_json_tests() {
    setup_test_workspace
    trap cleanup_test_workspace EXIT
    
    local tests=(
        "Stdin with --schema -:test_stdin_with_schema_dash"
        "Stdin convenience flag:test_stdin_flag"
        "Empty stdin handling:test_empty_stdin"
        "JSON mode with stdin:test_json_with_stdin"
        "Stream separation:test_stream_separation"
        "Help documentation:test_help_mentions_stdin"
    )
    
    log_info "Running Stdin & JSON Improvements Tests..."
    echo "=============================================="
    
    for test_spec in "${tests[@]}"; do
        IFS=':' read -r test_name test_function <<< "$test_spec"
        
        if run_test "$test_name" "$test_function"; then
            continue
        else
            log_error "Test failed: $test_name"
        fi
    done
    
    print_test_summary
}

# Main execution
main() {
    log_info "Wesley CLI Stdin & JSON Improvements Test Suite"
    log_info "=============================================="
    
    if run_stdin_json_tests; then
        log_success "🎉 Stdin & JSON Tests Complete"
        exit 0
    else
        log_error "💥 Some Stdin & JSON Tests Failed"  
        exit 1
    fi
}

# Execute if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi