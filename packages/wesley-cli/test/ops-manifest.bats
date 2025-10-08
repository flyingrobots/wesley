#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'
load 'bats-plugins/bats-file/load'

setup() {
  TEST_TEMP_DIR="$(mktemp -d -t wesley-ops-manifest-XXXXXX)"
  cd "$TEST_TEMP_DIR"
  CLI_PATH="$BATS_TEST_DIRNAME/../../wesley-host-node/bin/wesley.mjs"
}

teardown() {
  [[ -d "$TEST_TEMP_DIR" ]] && rm -rf "$TEST_TEMP_DIR"
}

create_schema() {
  cat > schema.graphql << 'GQL'
type product @wes_table { id: ID! @wes_pk, name: String!, slug: String!, published: Boolean! @wes_default(value: "false") }
GQL
}

create_ops_and_manifest() {
  mkdir -p ops/_drafts ops/sub
  cat > ops/a.op.json << 'JSON'
{ "name": "a", "table": "product", "columns": ["id","name"], "filters": [{"column":"published","op":"eq","value":true}] }
JSON
  cat > ops/_drafts/b.op.json << 'JSON'
{ "name": "b", "table": "product" }
JSON
  cat > ops/sub/c.op.json << 'JSON'
{ "name": "c", "table": "product" }
JSON
  cat > ops/manifest.json << 'JSON'
{ "include": ["**/*.op.json"], "exclude": ["_drafts/**"], "allowEmpty": false }
JSON
}

@test "manifest include/exclude compiles only included ops" {
  create_schema
  create_ops_and_manifest
  run node "$CLI_PATH" generate --schema schema.graphql --ops ./ops --ops-manifest ./ops/manifest.json --out-dir out --quiet
  assert_success
  assert_file_exists out/ops/a.fn.sql
  assert_file_exists out/ops/c.fn.sql
  # excluded draft should not exist
  if [[ -f out/ops/b.fn.sql ]]; then
    echo "Excluded op compiled: b.fn.sql"; false
  fi
}

@test "manifest allowEmpty=false fails when no files match" {
  create_schema
  mkdir -p ops; echo '{"include":["_nomatch/**"],"allowEmpty":false}' > ops/manifest.json
  run node "$CLI_PATH" generate --schema schema.graphql --ops ./ops --ops-manifest ./ops/manifest.json --out-dir out --quiet
  assert_failure
}

