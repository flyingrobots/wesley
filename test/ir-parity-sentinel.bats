#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

setup() {
  TEST_TEMP_DIR="$(mktemp -d -t wesley-ir-parity-sentinel-XXXXXX)"
}

teardown() {
  rm -rf "$TEST_TEMP_DIR"
}

make_fake_wesley() {
  FAKE_WESLEY="$TEST_TEMP_DIR/fake-wesley.mjs"
  FAKE_WESLEY_CALL_LOG="$TEST_TEMP_DIR/fake-wesley-calls.log"
  cat > "$FAKE_WESLEY" <<'NODE'
#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { appendFileSync } from 'node:fs';

const args = process.argv.slice(2);
if (process.env.WESLEY_FAKE_CALL_LOG) {
  appendFileSync(process.env.WESLEY_FAKE_CALL_LOG, `${args.join(' ')}\n`);
}

const nullable = process.env.WESLEY_FAKE_VARIANT === 'nullable-mismatch';
const ir = {
  version: '1.0.0',
  types: [
    {
      name: 'User',
      kind: 'OBJECT',
      directives: {
        wes_table: {
          name: 'users'
        }
      },
      fields: [
        {
          name: 'id',
          type: {
            base: 'ID',
            nullable,
            isList: false
          },
          directives: {
            wes_pk: true
          }
        },
        {
          name: 'username',
          type: {
            base: 'String',
            nullable: false,
            isList: false
          },
          directives: {
            wes_unique: true
          }
        },
        {
          name: 'email',
          type: {
            base: 'String',
            nullable: false,
            isList: false
          },
          directives: {}
        },
        {
          name: 'created_at',
          type: {
            base: 'String',
            nullable: false,
            isList: false
          },
          directives: {
            wes_default: {
              value: 'now()'
            }
          }
        }
      ]
    }
  ]
};

if (process.env.WESLEY_FAKE_VARIANT === 'metadata') {
  ir.metadata = {
    generatedAt: '2026-05-22T00:00:00.000Z',
    sourceHash: 'fake-source-hash'
  };
}

function canonicalizeJSON(value) {
  return JSON.stringify(value, (_key, jsonValue) => {
    if (jsonValue && typeof jsonValue === 'object' && !Array.isArray(jsonValue)) {
      const sorted = {};
      for (const key of Object.keys(jsonValue).sort()) {
        sorted[key] = jsonValue[key];
      }
      return sorted;
    }
    return jsonValue;
  });
}

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

function semanticIr(value) {
  const copy = structuredClone(value);
  delete copy.metadata;
  return copy;
}

if (args[0] === 'schema' && args[1] === 'lower') {
  console.log(JSON.stringify(ir, null, 2));
} else if (args[0] === 'schema' && args[1] === 'hash') {
  if (process.env.WESLEY_FAKE_VARIANT === 'hash-mismatch') {
    console.log('deadbeef');
    process.exit(0);
  }
  console.log(sha256Hex(canonicalizeJSON(semanticIr(ir))));
} else {
  console.error(`unexpected fake wesley args: ${args.join(' ')}`);
  process.exit(2);
}
NODE
  chmod +x "$FAKE_WESLEY"
}

@test "IR parity sentinel compares legacy and Rust table projections" {
  make_fake_wesley

  run env \
    WESLEY_CLI_BIN="$FAKE_WESLEY" \
    WESLEY_FAKE_CALL_LOG="$FAKE_WESLEY_CALL_LOG" \
    node scripts/check-ir-parity.mjs \
      --fixture test/fixtures/ir-parity/small-schema.graphql \
      --json
  assert_success
  assert_output --partial '"projection": "js-table-vs-rust-table.v0"'
  assert_output --partial '"status": "pass"'
  assert_output --partial '"rustCommandHashMatches": true'
  assert_output --partial '"legacyBytes": "{'
  assert_output --partial '"rustBytes": "{'

  run grep -F "schema lower --schema" "$FAKE_WESLEY_CALL_LOG"
  assert_success

  run grep -F "schema hash --schema" "$FAKE_WESLEY_CALL_LOG"
  assert_success
}

@test "IR parity sentinel ignores top-level Rust metadata when checking schema hash" {
  make_fake_wesley

  run env \
    WESLEY_CLI_BIN="$FAKE_WESLEY" \
    WESLEY_FAKE_VARIANT="metadata" \
    node scripts/check-ir-parity.mjs \
      --fixture test/fixtures/ir-parity/small-schema.graphql \
      --json
  assert_success
  assert_output --partial '"status": "pass"'
  assert_output --partial '"rustCommandHashMatches": true'
}

@test "IR parity sentinel fails when the Rust hash command drifts from current L1" {
  make_fake_wesley

  run env \
    WESLEY_CLI_BIN="$FAKE_WESLEY" \
    WESLEY_FAKE_VARIANT="hash-mismatch" \
    node scripts/check-ir-parity.mjs \
      --fixture test/fixtures/ir-parity/small-schema.graphql \
      --json
  assert_failure
  assert_output --partial '"failureReasons": ['
  assert_output --partial '"rust-command-hash-mismatch"'
  assert_output --partial '"rustCommandHashMatches": false'
}

@test "IR parity sentinel skips tracked hash sidecars for custom non-graphql fixtures" {
  make_fake_wesley

  cat > "$TEST_TEMP_DIR/custom.gql" <<'SDL'
type User @wes_table(name: "users") {
  id: ID! @wes_pk
  username: String! @wes_unique
  email: String!
  created_at: String! @wes_default(value: "now()")
}
SDL

  run env \
    WESLEY_CLI_BIN="$FAKE_WESLEY" \
    node scripts/check-ir-parity.mjs \
      --fixture "$TEST_TEMP_DIR/custom.gql" \
      --json
  assert_success
  assert_output --partial '"status": "pass"'
  assert_output --partial '"rustTrackedHash": null'
  assert_output --partial '"rustTrackedHashMatches": null'
}

@test "IR parity sentinel reports the first mismatch path" {
  make_fake_wesley

  run env \
    WESLEY_CLI_BIN="$FAKE_WESLEY" \
    WESLEY_FAKE_VARIANT="nullable-mismatch" \
    node scripts/check-ir-parity.mjs \
      --fixture test/fixtures/ir-parity/small-schema.graphql \
      --json
  assert_failure
  assert_output --partial '"status": "fail"'
  assert_output --partial '"path": "/tables/0/fields/0/type/nullable"'
  assert_output --partial '"legacy": false'
  assert_output --partial '"rust": true'
}

@test "IR parity projection sorts table names by code point" {
  run node --input-type=module <<'NODE'
import { projectRustL1IR } from './scripts/ir-parity-projection.mjs';

const names = ['a', 'B', 'á', 'aa', 'A'];
const ir = {
  version: '1.0.0',
  types: names.map(name => ({
    name,
    kind: 'OBJECT',
    directives: {
      wes_table: {
        name
      }
    },
    fields: [
      {
        name: 'id',
        type: {
          base: 'ID',
          nullable: false,
          isList: false
        },
        directives: {
          wes_pk: true
        }
      }
    ]
  }))
};

console.log(projectRustL1IR(ir).tables.map(table => table.name).join(','));
NODE
  assert_success
  assert_output "A,B,a,aa,á"
}

@test "IR parity sentinel lists only the v0 table-compatible corpus by default" {
  run node scripts/check-ir-parity.mjs --list-fixtures
  assert_success
  assert_output --partial "test/fixtures/ir-parity/small-schema.graphql"
  assert_output --partial "test/fixtures/ir-parity/medium-schema.graphql"
  assert_output --partial "test/fixtures/ir-parity/directive-heavy-schema.graphql"
  assert_output --partial "test/fixtures/ir-parity/legacy-alias-schema.graphql"
  [[ "$output" != *"schema-extensions-schema.graphql"* ]]
  [[ "$output" != *"large-schema.graphql"* ]]
}
