#!/usr/bin/env bash

# Master Test Runner - Runs all Wesley CLI test suites
# Use this script to verify all functionality works

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PASSED_SUITES=0
FAILED_SUITES=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Wesley CLI - Master Test Suite Runner${NC}"
echo "===================================="
echo ""

run_suite() {
    local suite_name="$1"
    local suite_script="$2"
    
    echo -e "${BLUE}[SUITE]${NC} Running $suite_name..."
    echo ""
    
    if "$SCRIPT_DIR/$suite_script"; then
        echo -e "${GREEN}✓ $suite_name PASSED${NC}"
        ((PASSED_SUITES++))
    else
        echo -e "${RED}✗ $suite_name FAILED${NC}"
        ((FAILED_SUITES++))
    fi
    
    echo ""
    echo "----------------------------------------"
    echo ""
}

# Run all test suites
run_suite "CLI Features" "cli-features.test.sh"
run_suite "Error Handling" "error-handling.test.sh" 
run_suite "Codex Features Regression" "regression-codex-features.sh"

# Optional demo (doesn't affect pass/fail)
echo -e "${YELLOW}[DEMO]${NC} Running feature demonstration..."
echo ""
if "$SCRIPT_DIR/demo-stdin-json.sh"; then
    echo -e "${GREEN}✓ Demo completed successfully${NC}"
else
    echo -e "${YELLOW}⚠ Demo had issues (non-critical)${NC}"
fi

echo ""
echo "===================================="
echo "Master Test Suite Results:"
echo ""
echo "  PASSED SUITES: $PASSED_SUITES"
echo "  FAILED SUITES: $FAILED_SUITES"
echo "  TOTAL SUITES:  $((PASSED_SUITES + FAILED_SUITES))"

if [[ $FAILED_SUITES -eq 0 ]]; then
    echo ""
    echo -e "${GREEN}🎉 ALL TEST SUITES PASSED!${NC}"
    echo ""
    echo "Wesley CLI is ready for:"
    echo "  ✅ Basic file and stdin schema input"
    echo "  ✅ JSON and quiet output modes"
    echo "  ✅ Proper exit codes for all error scenarios"
    echo "  ✅ Stream separation for script-friendly usage"
    echo "  ✅ Comprehensive error handling"
    echo ""
    exit 0
else
    echo ""
    echo -e "${RED}💥 SOME TEST SUITES FAILED${NC}"
    echo ""
    echo "Please review the failed test output above and fix the issues."
    echo ""
    exit 1
fi