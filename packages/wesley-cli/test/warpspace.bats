#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'
load 'bats-plugins/bats-file/load'

setup() {
    TEST_TEMP_DIR="$(mktemp -d -t wesley-bats-XXXXXX)"
    cd "$TEST_TEMP_DIR"

    CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"
    CONTINUUM_SCHEMA="$BATS_TEST_DIRNAME/../../../schemas/continuum-receipt-family.graphql"
}

teardown() {
    if [[ -d "$TEST_TEMP_DIR" ]]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
}

@test "typescript and zod resolve default output files from warpspace.mjs" {
    cp "$CONTINUUM_SCHEMA" schema.graphql
    cat > warpspace.mjs <<'EOF'
export default {
  kind: 'wesley.warpspace.v1',
  outputs: {
    typescript: 'src/generated/continuum',
    zod: 'src/generated/continuum/zod'
  }
};
EOF

    run node "$CLI_PATH" typescript --schema schema.graphql --json
    assert_success
    echo "$output" | jq -e '.success == true and (.result.outFile | endswith("src/generated/continuum/types.generated.ts"))' >/dev/null
    assert_file_exist src/generated/continuum/types.generated.ts

    run node "$CLI_PATH" zod --schema schema.graphql --json
    assert_success
    echo "$output" | jq -e '.success == true and (.result.outFile | endswith("src/generated/continuum/zod/zod.generated.ts"))' >/dev/null
    assert_file_exist src/generated/continuum/zod/zod.generated.ts
}

@test ".warpspace.local.mjs overrides committed warpspace output roots" {
    cp "$CONTINUUM_SCHEMA" schema.graphql
    cat > warpspace.mjs <<'EOF'
export default {
  kind: 'wesley.warpspace.v1',
  outputs: {
    typescript: 'src/generated/continuum'
  }
};
EOF
    cat > .warpspace.local.mjs <<'EOF'
export default {
  outputs: {
    typescript: 'src/generated/local-continuum'
  }
};
EOF

    run node "$CLI_PATH" typescript --schema schema.graphql --json
    assert_success
    echo "$output" | jq -e '.success == true and (.result.outFile | endswith("src/generated/local-continuum/types.generated.ts"))' >/dev/null
    assert_file_exist src/generated/local-continuum/types.generated.ts
}

@test "--out-file overrides warpspace defaults" {
    cp "$CONTINUUM_SCHEMA" schema.graphql
    cat > warpspace.mjs <<'EOF'
export default {
  kind: 'wesley.warpspace.v1',
  outputs: {
    zod: 'src/generated/continuum/zod'
  }
};
EOF

    run node "$CLI_PATH" zod --schema schema.graphql --out-file explicit/custom-zod.ts --json
    assert_success
    echo "$output" | jq -e '.success == true and .result.outFile == "explicit/custom-zod.ts"' >/dev/null
    assert_file_exist explicit/custom-zod.ts
    assert_file_not_exist src/generated/continuum/zod/zod.generated.ts
}
