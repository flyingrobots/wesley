#!/usr/bin/env bash

# Test Framework Functions
# Shared utilities for Wesley CLI tests

# Colors for output
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export BLUE='\033[0;34m'
export YELLOW='\033[0;33m'
export NC='\033[0m' # No Color

# Test result tracking
export TESTS_PASSED=0
export TESTS_FAILED=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Test assertion functions
assert_file_exists() {
    local file_path="$1"
    if [[ -f "$file_path" ]]; then
        log_success "File exists: $file_path"
        return 0
    else
        log_error "File not found: $file_path"
        return 1
    fi
}

assert_contains() {
    local text="$1"
    local pattern="$2"
    if echo "$text" | grep -q "$pattern"; then
        log_success "Text contains pattern: $pattern"
        return 0
    else
        log_error "Text does not contain pattern: $pattern"
        return 1
    fi
}

assert_exit_code() {
    local expected="$1"
    local actual="$2"
    if [[ "$actual" -eq "$expected" ]]; then
        log_success "Exit code matches: $expected"
        return 0
    else
        log_error "Exit code mismatch: expected $expected, got $actual"
        return 1
    fi
}

# Test execution helpers
run_test() {
    local test_name="$1"
    local test_function="$2"
    
    log_info "Running test: $test_name"
    
    if $test_function; then
        log_success "✓ $test_name"
        ((TESTS_PASSED++))
        return 0
    else
        log_error "✗ $test_name"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Test summary
print_test_summary() {
    local total=$((TESTS_PASSED + TESTS_FAILED))
    echo ""
    echo "Test Summary:"
    echo "============="
    echo "Passed: $TESTS_PASSED"
    echo "Failed: $TESTS_FAILED"
    echo "Total:  $total"
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        log_success "All tests passed! 🎉"
        return 0
    else
        log_error "Some tests failed. 😞"
        return 1
    fi
}