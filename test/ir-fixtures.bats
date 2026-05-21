#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

setup() {
  TEST_TEMP_DIR="$(mktemp -d -t wesley-ir-fixtures-XXXXXX)"
}

teardown() {
  rm -rf "$TEST_TEMP_DIR"
}

make_fake_wesley() {
  FAKE_WESLEY="$TEST_TEMP_DIR/fake-wesley.mjs"
  FAKE_WESLEY_CALL_LOG="$TEST_TEMP_DIR/fake-wesley-calls.log"
  cat > "$FAKE_WESLEY" <<'NODE'
#!/usr/bin/env node
import { appendFileSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
if (process.env.WESLEY_FAKE_CALL_LOG) {
  appendFileSync(process.env.WESLEY_FAKE_CALL_LOG, `${args.join(' ')}\n`);
}

const schemaIndex = args.indexOf('--schema');
const schemaPath = schemaIndex === -1 ? null : args[schemaIndex + 1];
const sdl = schemaPath ? readFileSync(schemaPath, 'utf8') : '';

if (sdl.includes('Broken')) {
  console.error('fake lowerer rejected broken schema');
  process.exit(1);
}

if (args[0] === 'schema' && args[1] === 'lower') {
  console.log(JSON.stringify({ version: '1.0.0', types: [] }, null, 2));
} else if (args[0] === 'schema' && args[1] === 'hash') {
  console.log('abc123');
} else {
  console.error(`unexpected fake wesley args: ${args.join(' ')}`);
  process.exit(2);
}
NODE
  chmod +x "$FAKE_WESLEY"
}

@test "IR fixture generator writes tracked L1 files through lower and hash commands" {
  printf 'type User @wes_table { id: ID! @wes_pk }\n' > "$TEST_TEMP_DIR/small.graphql"
  make_fake_wesley

  run env \
    WESLEY_IR_FIXTURE_DIR="$TEST_TEMP_DIR" \
    WESLEY_CLI_BIN="$FAKE_WESLEY" \
    WESLEY_FAKE_CALL_LOG="$FAKE_WESLEY_CALL_LOG" \
    node scripts/generate-ir-fixtures.mjs
  assert_success

  [ -f "$TEST_TEMP_DIR/small.l1.json" ]
  [ -f "$TEST_TEMP_DIR/small.l1.hash" ]
  [ ! -f "$TEST_TEMP_DIR/small.ir.json" ]
  [ ! -f "$TEST_TEMP_DIR/small.canonical.json" ]

  run grep -F '"version": "1.0.0"' "$TEST_TEMP_DIR/small.l1.json"
  assert_success

  run cat "$TEST_TEMP_DIR/small.l1.hash"
  assert_output "abc123"

  run grep -F "schema lower --schema $TEST_TEMP_DIR/small.graphql --json" "$FAKE_WESLEY_CALL_LOG"
  assert_success

  run grep -F "schema hash --schema $TEST_TEMP_DIR/small.graphql" "$FAKE_WESLEY_CALL_LOG"
  assert_success

  run grep -c '^schema ' "$FAKE_WESLEY_CALL_LOG"
  assert_output "2"
}

@test "IR fixture generator exits nonzero for invalid fixtures" {
  printf 'type Broken @wes_table { id: ID! @wes_pk\n' > "$TEST_TEMP_DIR/broken.graphql"
  make_fake_wesley

  run env \
    WESLEY_IR_FIXTURE_DIR="$TEST_TEMP_DIR" \
    WESLEY_CLI_BIN="$FAKE_WESLEY" \
    WESLEY_FAKE_CALL_LOG="$FAKE_WESLEY_CALL_LOG" \
    node scripts/generate-ir-fixtures.mjs
  assert_failure
  assert_output --partial "Error processing broken.graphql"

  [ ! -f "$TEST_TEMP_DIR/broken.l1.json" ]
  [ ! -f "$TEST_TEMP_DIR/broken.l1.hash" ]

  run grep -F "schema lower --schema $TEST_TEMP_DIR/broken.graphql --json" "$FAKE_WESLEY_CALL_LOG"
  assert_success

  run grep -F "schema hash --schema $TEST_TEMP_DIR/broken.graphql" "$FAKE_WESLEY_CALL_LOG"
  assert_failure
}
