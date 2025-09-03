# Wesley CLI Test Helpers
# Simple assertion helpers without external dependencies

# Assert command succeeded  
assert_success() {
    if [[ $status -ne 0 ]]; then
        echo "Expected success but got exit code $status"
        echo "Output: $output"
        return 1
    fi
}

# Assert command failed with specific code
assert_failure() {
    local expected_code=${1:-1}
    if [[ $status -eq 0 ]]; then
        echo "Expected failure but command succeeded"
        echo "Output: $output"
        return 1
    fi
    if [[ $status -ne $expected_code ]]; then
        echo "Expected exit code $expected_code but got $status"
        echo "Output: $output"
        return 1
    fi
}

# Assert output contains text
assert_output() {
    local mode=""
    local expected=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --partial)
                mode="partial"
                expected="$2"
                shift 2
                ;;
            *)
                expected="$1"
                shift
                ;;
        esac
    done
    
    if [[ "$mode" == "partial" ]]; then
        if ! echo "$output" | grep -q "$expected"; then
            echo "Expected output to contain: $expected"
            echo "Actual output: $output"
            return 1
        fi
    else
        if [[ "$output" != "$expected" ]]; then
            echo "Expected output: $expected"
            echo "Actual output: $output"
            return 1
        fi
    fi
}