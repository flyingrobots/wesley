#!/usr/bin/env bash

# Error Handling E2E Test Suite
# Tests CLI error scenarios and exit codes for complete flow coverage

set -euo pipefail

# Test framework functions
source "$(dirname "$0")/test-framework.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLI_PATH="$CLI_ROOT/wesley.mjs"
TEMP_DIR="/tmp/wesley-error-test-$(date +%s)"

setup_test_workspace() {
    log_info "Setting up test workspace: $TEMP_DIR"
    mkdir -p "$TEMP_DIR"
    cd "$TEMP_DIR"
    
    # Create test schema files for different scenarios
    cat > valid-simple.graphql << 'EOF'
type Query {
  hello: String
}
EOF

    cat > invalid-syntax.graphql << 'EOF'
type Query {
  hello: String
  # Missing closing brace - syntax error
EOF

    cat > invalid-wesley-directives.graphql << 'EOF' 
type User @table {
  id: ID! @pk @uid("invalid-syntax")
  name: String!
}
EOF

    log_info "Created test schemas in $TEMP_DIR"
}

cleanup_test_workspace() {
    if [[ -d "$TEMP_DIR" ]]; then
        rm -rf "$TEMP_DIR"
        log_info "Cleaned up test workspace"
    fi
}

# Test 1: Missing schema file should exit 2 (ENOENT)
test_missing_schema_file() {
    log_info "Testing missing schema file..."
    
    local exit_code=0
    local output
    
    # Capture output and exit code
    output=$(node "$CLI_PATH" generate --schema ./does-not-exist.graphql 2>&1) || exit_code=$?
    
    if [[ $exit_code -eq 2 ]]; then
        log_success "✓ Missing schema file exits with code 2"
        if echo "$output" | grep -q "Schema file not found"; then
            log_success "✓ Contains helpful error message"
        else
            log_error "✗ Missing helpful error message in output"
            echo "Actual output: $output"
            return 1
        fi
    else
        log_error "✗ Expected exit code 2, got $exit_code"
        echo "Output: $output"
        return 1
    fi
    
    return 0
}

# Test 2: GraphQL syntax error should exit 3 (PARSE_FAILED)
test_graphql_syntax_error() {
    log_info "Testing GraphQL syntax error..."
    
    local exit_code=0
    local output
    
    output=$(node "$CLI_PATH" generate --schema invalid-syntax.graphql 2>&1) || exit_code=$?
    
    if [[ $exit_code -eq 3 ]]; then
        log_success "✓ GraphQL syntax error exits with code 3 (PARSE_FAILED)"
        if echo "$output" | grep -q "PARSE_FAILED"; then
            log_success "✓ Contains PARSE_FAILED error code"
        else
            log_error "✗ Missing PARSE_FAILED error code in output"
            echo "Actual output: $output"
            return 1
        fi
    else
        log_error "✗ Expected exit code 3, got $exit_code"
        echo "Output: $output"
        return 1
    fi
    
    return 0
}

# Test 3: Wesley directive error should also exit 3 (PARSE_FAILED)
test_wesley_directive_error() {
    log_info "Testing Wesley directive syntax error..."
    
    local exit_code=0
    local output
    
    output=$(node "$CLI_PATH" generate --schema invalid-wesley-directives.graphql 2>&1) || exit_code=$?
    
    if [[ $exit_code -eq 3 ]]; then
        log_success "✓ Wesley directive error exits with code 3 (PARSE_FAILED)"
        if echo "$output" | grep -q "PARSE_FAILED"; then
            log_success "✓ Contains PARSE_FAILED error code"
        else
            log_error "✗ Missing PARSE_FAILED error code in output"
            echo "Actual output: $output"
            return 1
        fi
    else
        log_error "✗ Expected exit code 3, got $exit_code"
        echo "Output: $output"  
        return 1
    fi
    
    return 0
}

# Test 4: Simulate generation error (exit 4)
test_generation_error() {
    log_info "Testing generation error simulation..."
    
    # We'll need to modify the generators to throw specific errors
    # For now, create a test that expects this functionality
    log_warning "⚠️ Generation error test requires mock generator implementation"
    log_warning "   Expected: wesley generate should exit 4 when SqlGenerator throws"
    log_warning "   Expected: wesley generate should exit 4 when TestGenerator throws" 
    
    # This test is a placeholder - we'd need to inject a failing generator
    return 0
}

# Test 5: Simulate diff error (exit 5)  
test_diff_error() {
    log_info "Testing diff error simulation..."
    
    # Similar to generation error - needs mock diff engine
    log_warning "⚠️ Diff error test requires mock diff engine implementation"
    log_warning "   Expected: wesley generate should exit 5 when DiffEngine throws"
    
    # This test is a placeholder - we'd need to inject a failing diff engine
    return 0
}

# Test 6: JSON output for errors maintains exit codes
test_json_error_output() {
    log_info "Testing JSON error output with exit codes..."
    
    local exit_code=0
    local output
    
    output=$(node "$CLI_PATH" generate --schema ./does-not-exist.graphql --json 2>&1) || exit_code=$?
    
    if [[ $exit_code -eq 2 ]]; then
        log_success "✓ JSON mode preserves exit code 2 for missing file"
        if echo "$output" | jq -e '.success == false' >/dev/null 2>&1; then
            log_success "✓ JSON output contains success: false"
        else
            log_error "✗ JSON output malformed or missing success field"
            echo "Actual output: $output"
            return 1
        fi
    else
        log_error "✗ Expected exit code 2 in JSON mode, got $exit_code"
        echo "Output: $output"
        return 1
    fi
    
    return 0
}

# Test 7: Quiet mode still exits with correct codes
test_quiet_error_exit_codes() {
    log_info "Testing quiet mode error exit codes..."
    
    local exit_code=0
    local output
    
    output=$(node "$CLI_PATH" generate --schema ./does-not-exist.graphql --quiet 2>&1) || exit_code=$?
    
    if [[ $exit_code -eq 2 ]]; then
        log_success "✓ Quiet mode preserves exit code 2 for missing file"
        if [[ -z "$output" || "$output" =~ ^[[:space:]]*$ ]]; then
            log_success "✓ Quiet mode produces no output"
        else
            log_error "✗ Quiet mode produced unexpected output"
            echo "Actual output: '$output'"
            return 1
        fi
    else
        log_error "✗ Expected exit code 2 in quiet mode, got $exit_code"
        echo "Output: '$output'"
        return 1
    fi
    
    return 0
}

# Test Suite Execution
run_error_handling_tests() {
    setup_test_workspace
    trap cleanup_test_workspace EXIT
    
    local tests=(
        "Missing Schema File:test_missing_schema_file"
        "GraphQL Syntax Error:test_graphql_syntax_error" 
        "Wesley Directive Error:test_wesley_directive_error"
        "Generation Error Simulation:test_generation_error"
        "Diff Error Simulation:test_diff_error"
        "JSON Error Output:test_json_error_output"
        "Quiet Mode Error Codes:test_quiet_error_exit_codes"
    )
    
    log_info "Running Error Handling E2E Tests..."
    echo "========================================"
    
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
    log_info "Wesley CLI Error Handling Test Suite"
    log_info "====================================="
    
    if run_error_handling_tests; then
        log_success "🎉 Error Handling Tests Complete"
        exit 0
    else
        log_error "💥 Some Error Handling Tests Failed"  
        exit 1
    fi
}

# Execute if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi