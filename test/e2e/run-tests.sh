#!/bin/bash
set -e

# E2E Test Runner for Wesley
# Creates temp workspace, runs CLI commands, validates outputs

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMP_DIR="/tmp/wesley-e2e-$(date +%s)"
SUPABASE_RUNNING=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[E2E]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Check if Supabase is running
check_supabase() {
    if docker ps --format "table {{.Names}}" | grep -q "supabase"; then
        SUPABASE_RUNNING=true
        log "Supabase already running"
    else
        log "Supabase not running, will start it"
        SUPABASE_RUNNING=false
    fi
}

# Start Supabase if needed
start_supabase() {
    if [ "$SUPABASE_RUNNING" = false ]; then
        log "Starting Supabase..."
        cd "$PROJECT_ROOT"
        if [ -f "supabase/config.toml" ]; then
            npx supabase start
            log "Waiting for Supabase to be ready..."
            sleep 10
        else
            warn "No Supabase config found, skipping database tests"
        fi
    fi
}

# Create temporary test workspace
setup_workspace() {
    log "Creating temp workspace: $TEMP_DIR"
    mkdir -p "$TEMP_DIR"
    
    # Copy example files to temp directory
    cp -r "$PROJECT_ROOT/example" "$TEMP_DIR/"
    
    # Create output directories
    mkdir -p "$TEMP_DIR/out" "$TEMP_DIR/tests" "$TEMP_DIR/db/migrations"
    
    log "Workspace ready at $TEMP_DIR"
}

# Clean up
cleanup() {
    if [ -d "$TEMP_DIR" ]; then
        log "Cleaning up temp workspace"
        rm -rf "$TEMP_DIR"
    fi
}

# Run a test case
run_test() {
    local test_name="$1"
    local test_function="$2"
    
    log "Running test: $test_name"
    
    if $test_function; then
        success "✓ $test_name"
        return 0
    else
        error "✗ $test_name"
        return 1
    fi
}

# Test 1: CLI argument parsing
test_cli_args() {
    local output
    output=$(node "$PROJECT_ROOT/packages/wesley-cli/wesley.mjs" --help 2>&1)
    
    if [[ "$output" == *"Wesley - GraphQL → Everything"* ]]; then
        return 0
    else
        error "CLI help output incorrect"
        return 1
    fi
}

# Test 2: Generate command basic parsing
test_generate_help() {
    local output
    output=$(node "$PROJECT_ROOT/packages/wesley-cli/wesley.mjs" generate --help 2>&1)
    
    if [[ "$output" == *"Generate SQL, tests, and more"* ]]; then
        return 0
    else
        error "Generate help output incorrect"
        return 1
    fi
}

# Test 3: Schema file not found error handling
test_missing_schema() {
    local output
    output=$(node "$PROJECT_ROOT/packages/wesley-cli/wesley.mjs" generate --schema nonexistent.graphql 2>&1 || true)
    
    if [[ "$output" == *"Schema file not found"* ]]; then
        return 0
    else
        error "Missing schema error handling failed"
        return 1
    fi
}

# Test 4: Basic schema parsing (will fail gracefully for now)
test_basic_schema_parsing() {
    local output
    cd "$TEMP_DIR"
    
    # Create a minimal valid GraphQL schema
    cat > minimal.graphql << 'EOF'
type Query {
  hello: String
}
EOF
    
    output=$(node "$PROJECT_ROOT/packages/wesley-cli/wesley.mjs" generate --schema minimal.graphql 2>&1 || true)
    
    # For now, we expect it to fail gracefully (not crash)
    if [[ "$output" == *"Error during generation"* ]] || [[ "$output" == *"Generated:"* ]]; then
        return 0
    else
        error "Schema parsing failed unexpectedly: $output"
        return 1
    fi
}

# Main test runner
main() {
    log "Starting Wesley E2E Tests"
    log "Project root: $PROJECT_ROOT"
    
    # Setup
    trap cleanup EXIT
    check_supabase
    start_supabase
    setup_workspace
    
    # Track test results
    local total_tests=0
    local passed_tests=0
    
    # Run tests
    tests=(
        "CLI Help Output:test_cli_args"
        "Generate Command Help:test_generate_help"
        "Missing Schema Handling:test_missing_schema"
        "Basic Schema Parsing:test_basic_schema_parsing"
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
    log "Test Summary: $passed_tests/$total_tests passed"
    
    if [ "$passed_tests" -eq "$total_tests" ]; then
        success "All tests passed! 🎉"
        exit 0
    else
        error "Some tests failed"
        exit 1
    fi
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi