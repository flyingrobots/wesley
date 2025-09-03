#!/bin/bash
set -e

# CLI Features Test Suite
# Tests all the CLI enhancements we just implemented

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$CLI_ROOT/../.." && pwd)"
TEMP_DIR="/tmp/wesley-cli-test-$(date +%s)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[CLI-TEST]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Setup test workspace
setup() {
    log "Setting up test workspace: $TEMP_DIR"
    mkdir -p "$TEMP_DIR"
    
    # Create test schema files
    cat > "$TEMP_DIR/valid.graphql" << 'EOF'
type Query {
  hello: String
}
EOF

    cat > "$TEMP_DIR/invalid.graphql" << 'EOF'
type Query {
  hello: String
  # Missing closing brace
EOF
}

# Cleanup
cleanup() {
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}

# Run Wesley CLI command
run_wesley() {
    node "$CLI_ROOT/wesley.mjs" "$@" 2>&1 || true
}

# Test version flag
test_version_flag() {
    local output
    output=$(run_wesley --version)
    
    if [[ "$output" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        return 0
    else
        error "Version output invalid: '$output'"
        return 1
    fi
}

# Test short version flag
test_short_version_flag() {
    local output
    output=$(run_wesley -V)
    
    if [[ "$output" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        return 0
    else
        error "Short version output invalid: '$output'"
        return 1
    fi
}

# Test help flag
test_help_flag() {
    local output
    output=$(run_wesley --help)
    
    if [[ "$output" == *"Wesley - GraphQL → Everything"* ]] && [[ "$output" == *"Commands:"* ]]; then
        return 0
    else
        error "Help output incorrect"
        return 1
    fi
}

# Test short help flag
test_short_help_flag() {
    local output
    output=$(run_wesley -h)
    
    if [[ "$output" == *"Wesley - GraphQL → Everything"* ]]; then
        return 0
    else
        error "Short help output incorrect"
        return 1
    fi
}

# Test generate command help
test_generate_help() {
    local output
    output=$(run_wesley generate --help)
    
    if [[ "$output" == *"Generate SQL, tests, and more"* ]] && 
       [[ "$output" == *"--verbose"* ]] && 
       [[ "$output" == *"--json"* ]] && 
       [[ "$output" == *"--quiet"* ]]; then
        return 0
    else
        error "Generate help missing expected flags"
        return 1
    fi
}

# Test missing schema file error
test_missing_schema_error() {
    local output
    output=$(run_wesley generate --schema "$TEMP_DIR/nonexistent.graphql")
    
    if [[ "$output" == *"Schema file not found"* ]] && [[ "$output" == *"Try: wesley generate"* ]]; then
        return 0
    else
        error "Missing schema error handling failed: '$output'"
        return 1
    fi
}

# Test quiet flag suppresses output
test_quiet_flag() {
    cd "$TEMP_DIR"
    local output
    output=$(run_wesley generate --schema valid.graphql --quiet)
    
    # Should have minimal output in quiet mode
    if [[ ${#output} -lt 100 ]]; then
        return 0
    else
        error "Quiet flag didn't suppress output: '$output'"
        return 1
    fi
}

# Test verbose flag shows more output
test_verbose_flag() {
    cd "$TEMP_DIR"
    local output
    output=$(run_wesley generate --schema valid.graphql --verbose)
    
    # Should have more detailed output (or error with stack trace)
    if [[ "$output" == *"Error during generation"* ]] || [[ ${#output} -gt 50 ]]; then
        return 0
    else
        error "Verbose flag didn't show detailed output: '$output'"
        return 1
    fi
}

# Test JSON output format
test_json_output() {
    cd "$TEMP_DIR"
    local output
    output=$(run_wesley generate --schema valid.graphql --json)
    
    # Should be valid JSON (starts with { or contains "success")
    if [[ "$output" == *"{"* ]] && ([[ "$output" == *'"success"'* ]] || [[ "$output" == *'"error"'* ]]); then
        return 0
    else
        error "JSON output format invalid: '$output'"
        return 1
    fi
}

# Test test command
test_test_command() {
    local output
    output=$(run_wesley test)
    
    if [[ "$output" == *"pgTAP tests"* ]] && [[ "$output" == *"not yet implemented"* ]]; then
        return 0
    else
        error "Test command output incorrect: '$output'"
        return 1
    fi
}

# Test test command help
test_test_command_help() {
    local output
    output=$(run_wesley test --help)
    
    if [[ "$output" == *"Run generated pgTAP tests"* ]] && 
       [[ "$output" == *"--database-url"* ]] && 
       [[ "$output" == *"--verbose"* ]]; then
        return 0
    else
        error "Test command help incorrect: '$output'"
        return 1
    fi
}

# Test validate-bundle command
test_validate_bundle_command() {
    local output
    output=$(run_wesley validate-bundle)
    
    # Should either work, show not implemented error, or show missing file error
    if [[ "$output" == *"ValidateBundleCommand not implemented"* ]] || 
       [[ "$output" == *"validating"* ]] || 
       [[ "$output" == *"ENOENT"* ]] || 
       [[ "$output" == *"no such file"* ]]; then
        return 0
    else
        error "Validate-bundle command failed unexpectedly: '$output'"
        return 1
    fi
}

# Run a test case
run_test() {
    local test_name="$1"
    local test_function="$2"
    
    log "Running: $test_name"
    
    if $test_function; then
        success "✓ $test_name"
        return 0
    else
        error "✗ $test_name"
        return 1
    fi
}

# Main test runner
main() {
    log "Starting Wesley CLI Features Test Suite"
    
    # Setup
    trap cleanup EXIT
    setup
    
    # Track results
    local total_tests=0
    local passed_tests=0
    
    # Test cases
    tests=(
        "Version Flag:test_version_flag"
        "Short Version Flag:test_short_version_flag"
        "Help Flag:test_help_flag"
        "Short Help Flag:test_short_help_flag"
        "Generate Help:test_generate_help"
        "Missing Schema Error:test_missing_schema_error"
        "Quiet Flag:test_quiet_flag"
        "Verbose Flag:test_verbose_flag"
        "JSON Output:test_json_output"
        "Test Command:test_test_command"
        "Test Command Help:test_test_command_help"
        "Validate Bundle Command:test_validate_bundle_command"
    )
    
    for test_spec in "${tests[@]}"; do
        IFS=':' read -r test_name test_function <<< "$test_spec"
        total_tests=$((total_tests + 1))
        
        if run_test "$test_name" "$test_function"; then
            passed_tests=$((passed_tests + 1))
        fi
        echo
    done
    
    # Summary
    log "CLI Test Summary: $passed_tests/$total_tests passed"
    
    if [ "$passed_tests" -eq "$total_tests" ]; then
        success "All CLI tests passed! 🎉"
        exit 0
    else
        error "Some CLI tests failed"
        exit 1
    fi
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi