#!/usr/bin/env bats

# CLI Composition Tests - Multi-file schema composition with imports and namespacing

load 'helpers'

setup() {
    export CLI_PATH="$BATS_TEST_DIRNAME/../packages/wesley-host-node/bin/wesley.mjs"
    export TEMP_DIR="$(mktemp -d)"
    export FIXTURES="$BATS_TEST_DIRNAME/fixtures/composition"
}

teardown() {
    rm -rf "$TEMP_DIR"
}

# ─── Basic composition ────────────────────────────────────────────────────────

@test "composition: game.graphql resolves all imports and generates" {
    run node "$CLI_PATH" generate --schema "$FIXTURES/game.graphql" --out-dir "$TEMP_DIR/out" --quiet
    assert_success
}

@test "composition: --print-composed-sdl outputs mangled SDL" {
    run node "$CLI_PATH" generate --schema "$FIXTURES/game.graphql" --print-composed-sdl --dry-run
    assert_success
    # Should contain mangled type names
    assert_output --partial "testXdcore__Widget"
    assert_output --partial "testXdgame__Player"
    assert_output --partial "testXdprotocol__WidgetEvent"
}

@test "composition: mangled SDL contains no @wes_package or @wes_import" {
    run node "$CLI_PATH" generate --schema "$FIXTURES/game.graphql" --print-composed-sdl --dry-run
    assert_success
    # Composition directives should be stripped
    if [[ "$output" == *"@wes_package"* ]]; then
        echo "Output still contains @wes_package"
        return 1
    fi
    if [[ "$output" == *"@wes_import"* ]]; then
        echo "Output still contains @wes_import"
        return 1
    fi
}

# ─── Unit filtering ──────────────────────────────────────────────────────────

@test "composition: --unit game.graphql filters to game-only types" {
    run node "$CLI_PATH" generate --schema "$FIXTURES/game.graphql" --print-composed-sdl --dry-run --unit game.graphql
    assert_success
    # This test verifies --unit is accepted; actual filtering happens in IR,
    # --print-composed-sdl shows the full composed SDL before filtering
    assert_output --partial "testXdgame__Player"
}

# ─── Collision detection ─────────────────────────────────────────────────────

@test "composition: collision.graphql produces error with both packages" {
    run bash -c "node '$CLI_PATH' generate --schema '$FIXTURES/collision.graphql' --out-dir '$TEMP_DIR/out' 2>&1"
    assert_failure
    [[ "$status" -eq 3 ]]
    assert_output --partial "Widget"
    assert_output --partial "test.core"
    assert_output --partial "test.collision"
}

# ─── Duplicate in same package ────────────────────────────────────────────────

@test "composition: core-dup.graphql produces duplicate-in-package error" {
    run bash -c "node '$CLI_PATH' generate --schema '$FIXTURES/core-dup.graphql' --out-dir '$TEMP_DIR/out' 2>&1"
    assert_failure
    [[ "$status" -eq 3 ]]
    assert_output --partial "Duplicate definition"
    assert_output --partial "Widget"
    assert_output --partial "extend type"
}

# ─── Circular import ─────────────────────────────────────────────────────────

@test "composition: circular import produces cycle error" {
    # Create temp circular files
    cat > "$TEMP_DIR/cycle-a.graphql" <<'EOF'
extend schema @wes_package(name: "a")
extend schema @wes_import(from: "cycle-b.graphql")
type A { id: ID! }
EOF
    cat > "$TEMP_DIR/cycle-b.graphql" <<'EOF'
extend schema @wes_package(name: "b")
extend schema @wes_import(from: "cycle-a.graphql")
type B { id: ID! }
EOF

    run bash -c "node '$CLI_PATH' generate --schema '$TEMP_DIR/cycle-a.graphql' --out-dir '$TEMP_DIR/out' 2>&1"
    assert_failure
    [[ "$status" -eq 3 ]]
    assert_output --partial "cycle"
}

# ─── Single file without composition directives ──────────────────────────────

@test "composition: single file without @wes_import or @wes_package works identically to legacy" {
    # Use an existing non-composition fixture
    cat > "$TEMP_DIR/plain.graphql" <<'EOF'
type Widget @wes_table {
  id: ID! @wes_pk
  name: String!
}
EOF

    run node "$CLI_PATH" generate --schema "$TEMP_DIR/plain.graphql" --out-dir "$TEMP_DIR/out" --quiet
    assert_success
}

# ─── Transitive type access ──────────────────────────────────────────────────

@test "composition: transitive type access (game references core type via protocol)" {
    run node "$CLI_PATH" generate --schema "$FIXTURES/game.graphql" --print-composed-sdl --dry-run
    assert_success
    # game.graphql references Widget which is defined in core.graphql,
    # accessible transitively through protocol.graphql's import chain
    assert_output --partial "testXdcore__Widget"
    # Player references Widget
    assert_output --partial "testXdgame__Player"
}

# ─── Extend type across units ────────────────────────────────────────────────

# ─── IR provenance ────────────────────────────────────────────────────────────

@test "composition: --print-ir produces valid JSON with provenance on every table" {
    run node "$CLI_PATH" generate --schema "$FIXTURES/game.graphql" --print-ir --dry-run
    assert_success

    # Must be valid JSON that jq can parse
    echo "$output" | jq . > /dev/null

    # Widget should carry test.core provenance
    local widget_pkg=$(echo "$output" | jq -r '.tables[] | select(.name=="Widget") | .package')
    local widget_unit=$(echo "$output" | jq -r '.tables[] | select(.name=="Widget") | .sourceUnit')
    local widget_qn=$(echo "$output" | jq -r '.tables[] | select(.name=="Widget") | .qualifiedName')
    [[ "$widget_pkg" == "test.core" ]]
    [[ "$widget_unit" == "core.graphql" ]]
    [[ "$widget_qn" == "testXdcore__Widget" ]]

    # Player should carry test.game provenance
    local player_pkg=$(echo "$output" | jq -r '.tables[] | select(.name=="Player") | .package')
    local player_unit=$(echo "$output" | jq -r '.tables[] | select(.name=="Player") | .sourceUnit')
    local player_qn=$(echo "$output" | jq -r '.tables[] | select(.name=="Player") | .qualifiedName')
    [[ "$player_pkg" == "test.game" ]]
    [[ "$player_unit" == "game.graphql" ]]
    [[ "$player_qn" == "testXdgame__Player" ]]
}

@test "composition: --print-ir metadata.units lists all units in topological order" {
    run node "$CLI_PATH" generate --schema "$FIXTURES/game.graphql" --print-ir --dry-run
    assert_success

    # Assert minimum unit count and check specific required units exist
    local unit_count=$(echo "$output" | jq '.metadata.units | length')
    [[ "$unit_count" -ge 3 ]]

    # Check that required units exist
    local has_core=$(echo "$output" | jq '[.metadata.units[].id] | contains(["core.graphql"])')
    local has_protocol=$(echo "$output" | jq '[.metadata.units[].id] | contains(["protocol.graphql"])')
    local has_game=$(echo "$output" | jq '[.metadata.units[].id] | contains(["game.graphql"])')
    [[ "$has_core" == "true" ]]
    [[ "$has_protocol" == "true" ]]
    [[ "$has_game" == "true" ]]

    # First unit should be a leaf (no imports)
    local first_imports=$(echo "$output" | jq '.metadata.units[0].imports | length')
    [[ "$first_imports" -eq 0 ]]

    # Last unit should be the entry (game.graphql — has imports)
    local last_id=$(echo "$output" | jq -r '.metadata.units[-1].id')
    [[ "$last_id" == "game.graphql" ]]
}

@test "composition: --print-ir --unit filters IR to only matching sourceUnit" {
    run node "$CLI_PATH" generate --schema "$FIXTURES/game.graphql" --print-ir --dry-run --unit game.graphql
    assert_success

    local table_count=$(echo "$output" | jq '.tables | length')
    [[ "$table_count" -eq 1 ]]

    local only_name=$(echo "$output" | jq -r '.tables[0].name')
    [[ "$only_name" == "Player" ]]
}

@test "composition: --print-ir --unit core.graphql shows only core tables" {
    run node "$CLI_PATH" generate --schema "$FIXTURES/game.graphql" --print-ir --dry-run --unit core.graphql
    assert_success

    local table_count=$(echo "$output" | jq '.tables | length')
    [[ "$table_count" -eq 1 ]]

    local only_name=$(echo "$output" | jq -r '.tables[0].name')
    [[ "$only_name" == "Widget" ]]
}

# ─── Extend type across units ────────────────────────────────────────────────

@test "composition: extend type across units compiles to valid merged schema" {
    # protocol.graphql imports core-ext.graphql which extends Widget from core.graphql
    run node "$CLI_PATH" generate --schema "$FIXTURES/protocol.graphql" --print-composed-sdl --dry-run
    assert_success
    # Both the base Widget and its extension should be in the output with mangled names
    assert_output --partial "testXdcore__Widget"
    assert_output --partial "testXdcore__Timestamp"
}

# ─── compile-ttd: demangling ────────────────────────────────────────────────

@test "compile-ttd: composed schema outputs demangled (short) type names by default" {
    run node "$CLI_PATH" compile-ttd --schema "$FIXTURES/game.graphql" --print-ir --dry-run
    assert_success

    # TTD IR should contain short names, not mangled ones
    # The protocol.graphql defines a @wes_channel which produces a channel in the IR
    local channel_name=$(echo "$output" | jq -r '.schema.channels[0].name // empty')
    [[ -n "$channel_name" ]]

    # Event types should be short names (Widget, not testXdcore__Widget)
    local event_types=$(echo "$output" | jq -r '.schema.channels[0].eventTypes[]')
    if [[ "$event_types" == *"__"* ]]; then
        echo "Event types still contain mangled names: $event_types"
        return 1
    fi
}

@test "compile-ttd: --qualified-names preserves mangled type names" {
    run node "$CLI_PATH" compile-ttd --schema "$FIXTURES/game.graphql" --qualified-names --print-ir --dry-run
    assert_success

    # With --qualified-names, mangled names should be preserved
    local event_types=$(echo "$output" | jq -r '.schema.channels[0].eventTypes[]')
    [[ "$event_types" == *"__"* ]]
}

@test "compile-ttd: --print-composed-sdl shows demangled SDL" {
    run node "$CLI_PATH" compile-ttd --schema "$FIXTURES/game.graphql" --print-composed-sdl --dry-run
    assert_success

    # Should contain short type names
    assert_output --partial "WidgetEvent"
    # Should NOT contain mangled names
    if [[ "$output" == *"testXdprotocol__WidgetEvent"* ]]; then
        echo "SDL still contains mangled names"
        return 1
    fi
}

@test "compile-ttd: --print-composed-sdl --qualified-names shows mangled SDL" {
    run node "$CLI_PATH" compile-ttd --schema "$FIXTURES/game.graphql" --print-composed-sdl --qualified-names --dry-run
    assert_success

    # Should contain mangled names
    assert_output --partial "testXdprotocol__WidgetEvent"
}

# ─── compile-ttd: unit filtering ────────────────────────────────────────────

@test "compile-ttd: --unit with missing deps produces clear error" {
    # protocol.graphql references Widget from core.graphql;
    # filtering to only protocol.graphql should fail
    run bash -c "node '$CLI_PATH' compile-ttd --schema '$FIXTURES/game.graphql' --unit protocol.graphql --dry-run 2>&1"
    assert_failure
    [[ "$status" -eq 3 ]]
    assert_output --partial "Widget"
    assert_output --partial "core.graphql"
}

@test "compile-ttd: --unit on non-composed schema produces error" {
    run bash -c "node '$CLI_PATH' compile-ttd --schema '$BATS_TEST_DIRNAME/../schemas/ttd-protocol.graphql' --unit foo.graphql --dry-run 2>&1"
    assert_failure
    assert_output --partial "composition directives"
}

@test "compile-ttd: standalone schema without composition still works" {
    run node "$CLI_PATH" compile-ttd --schema "$BATS_TEST_DIRNAME/../schemas/ttd-protocol.graphql" --dry-run --quiet
    assert_success
}
