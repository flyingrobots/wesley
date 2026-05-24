#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

setup() {
  TEST_TEMP_DIR="$(mktemp -d -t wesley-ir-performance-XXXXXX)"
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
  console.log(JSON.stringify({
    version: '1.0.0',
    metadata: {
      generatedAt: 'fake'
    },
    types: [
      {
        name: 'User',
        kind: 'OBJECT',
        directives: {},
        fields: []
      }
    ]
  }, null, 2));
} else {
  console.error(`unexpected fake wesley args: ${args.join(' ')}`);
  process.exit(2);
}
NODE
  chmod +x "$FAKE_WESLEY"
}

@test "Rust IR performance baseline measures lower wall-clock samples" {
  make_fake_wesley

  run env \
    WESLEY_CLI_BIN="$FAKE_WESLEY" \
    WESLEY_FAKE_CALL_LOG="$FAKE_WESLEY_CALL_LOG" \
    node scripts/measure-ir-performance.mjs \
      --fixture test/fixtures/ir-parity/small-schema.graphql \
      --iterations 2 \
      --warmups 1 \
      --json
  assert_success
  assert_output --partial '"tool": "rust-ir-performance-baseline.v0"'
  assert_output --partial '"iterations": 2'
  assert_output --partial '"warmups": 1'
  assert_output --partial '"status": "pass"'
  assert_output --partial '"schemaBytes":'
  assert_output --partial '"outputBytes":'
  assert_output --partial '"rustL1Hash":'
  assert_output --partial '"samples":'
  assert_output --partial '"memory": {'
  assert_output --partial '"status": "not-captured"'
  assert_output --partial '"legacyJsLowering": {'

  run grep -c '^schema lower' "$FAKE_WESLEY_CALL_LOG"
  assert_success
  assert_output "3"
}

@test "Rust IR performance baseline can compare legacy JS lowerer wall-clock samples" {
  make_fake_wesley

  run env \
    WESLEY_CLI_BIN="$FAKE_WESLEY" \
    WESLEY_FAKE_CALL_LOG="$FAKE_WESLEY_CALL_LOG" \
    node scripts/measure-ir-performance.mjs \
      --fixture test/fixtures/ir-parity/small-schema.graphql \
      --iterations 2 \
      --warmups 1 \
      --include-legacy-js \
      --json
  assert_success
  assert_output --partial '"legacyJsLowering": {'
  assert_output --partial '"status": "captured"'
  assert_output --partial '"legacyJsDurationMs": {'
  assert_output --partial '"samples":'

  run grep -c '^schema lower' "$FAKE_WESLEY_CALL_LOG"
  assert_success
  assert_output "3"
}

@test "Rust IR performance baseline lists the explicit fixture corpus" {
  run node scripts/measure-ir-performance.mjs --list-fixtures
  assert_success
  assert_output --partial 'test/fixtures/ir-parity/small-schema.graphql'
  assert_output --partial 'test/fixtures/ir-parity/large-schema.graphql'
  assert_output --partial 'test/fixtures/ir-parity/schema-extensions-schema.graphql'
  assert_output --partial 'test/fixtures/ir-parity/nested-list-schema.graphql'
}

@test "Rust IR performance baseline computes even-sample median as midpoint" {
  run node --input-type=module <<'NODE'
import { summarizeDurations } from './scripts/measure-ir-performance.mjs';

console.log(JSON.stringify(summarizeDurations([10, 20, 30, 40])));
NODE
  assert_success
  assert_output '{"samples":[10,20,30,40],"min":10,"median":25,"mean":25,"max":40}'
}

@test "Rust IR performance baseline exits nonzero when lowering fails" {
  make_fake_wesley
  printf 'type Broken @wes_table { id: ID! @wes_pk\n' > "$TEST_TEMP_DIR/broken.graphql"

  run env \
    WESLEY_CLI_BIN="$FAKE_WESLEY" \
    node scripts/measure-ir-performance.mjs \
      --fixture "$TEST_TEMP_DIR/broken.graphql" \
      --iterations 1 \
      --warmups 0 \
      --json
  assert_failure
  assert_output --partial '"status": "error"'
  assert_output --partial 'fake lowerer rejected broken schema'
}

@test "Rust IR performance process runner kills timed-out children with Alfred TestClock" {
  run node --input-type=module <<'NODE'
import { EventEmitter } from 'node:events';
import { TimeoutError } from '@git-stunts/alfred';
import { TestClock } from '@git-stunts/alfred/testing';
import { runProcess } from './scripts/measure-ir-performance.mjs';

function makeStream() {
  const stream = new EventEmitter();
  stream.setEncoding = () => {};
  return stream;
}

let child;
const spawnImpl = (_command, _args, options) => {
  child = new EventEmitter();
  child.stdout = makeStream();
  child.stderr = makeStream();
  child.options = options;
  child.kill = (signal) => {
    child.killedWith = signal;
  };
  return child;
};

const clock = new TestClock();
const promise = runProcess('fake-lowerer', ['schema', 'lower'], {
  timeoutMs: 50,
  maxBufferBytes: 1024,
  clock,
  spawnImpl,
  cwd: process.cwd()
});

await Promise.resolve();
await clock.advance(49);
console.log(`before=${child.killedWith ?? 'none'}`);
await clock.advance(1);

try {
  await promise;
  console.log('unexpected success');
  process.exitCode = 1;
} catch (error) {
  console.log(`error=${error.name}`);
  console.log(`timeout=${error instanceof TimeoutError}`);
  console.log(`killed=${child.killedWith}`);
  console.log(`killSignal=${child.options.killSignal}`);
}
NODE
  assert_success
  assert_output --partial 'before=none'
  assert_output --partial 'error=TimeoutError'
  assert_output --partial 'timeout=true'
  assert_output --partial 'killed=SIGKILL'
  assert_output --partial 'killSignal=SIGKILL'
}

@test "Rust IR performance process runner rejects output beyond buffer limit" {
  run node --input-type=module <<'NODE'
import { EventEmitter } from 'node:events';
import { runProcess } from './scripts/measure-ir-performance.mjs';

function makeStream() {
  const stream = new EventEmitter();
  stream.setEncoding = () => {};
  return stream;
}

let child;
const spawnImpl = () => {
  child = new EventEmitter();
  child.stdout = makeStream();
  child.stderr = makeStream();
  child.kill = (signal) => {
    child.killedWith = signal;
  };
  queueMicrotask(() => {
    child.stdout.emit('data', 'abcdef');
    child.emit('close', 0, null);
  });
  return child;
};

try {
  await runProcess('fake-lowerer', ['schema', 'lower'], {
    timeoutMs: 1000,
    maxBufferBytes: 5,
    spawnImpl,
    cwd: process.cwd()
  });
  console.log('unexpected success');
  process.exitCode = 1;
} catch (error) {
  console.log(`error=${error.message}`);
  console.log(`killed=${child.killedWith}`);
}
NODE
  assert_success
  assert_output --partial 'exceeded 5 byte stdout buffer'
  assert_output --partial 'killed=SIGKILL'
}

@test "Rust IR performance git head returns unknown on timeout" {
  run node --input-type=module <<'NODE'
import { TimeoutError } from '@git-stunts/alfred';
import { gitHead } from './scripts/measure-ir-performance.mjs';

const head = await gitHead(async () => {
  throw new TimeoutError(20, 20);
});

console.log(`head=${head}`);
NODE
  assert_success
  assert_output --partial 'head=null'
  assert_output --partial 'git rev-parse timed out'
}

@test "Rust IR performance baseline can emit markdown evidence" {
  make_fake_wesley

  run env \
    WESLEY_CLI_BIN="$FAKE_WESLEY" \
    node scripts/measure-ir-performance.mjs \
      --fixture test/fixtures/ir-parity/small-schema.graphql \
      --iterations 1 \
      --warmups 0 \
      --markdown \
      --output "$TEST_TEMP_DIR/report.md"
  assert_success
  assert_output --partial '# Rust IR Performance Baseline'
  assert_output --partial '| Fixture | Status | Types | Schema Bytes | Output Bytes | Median ms | Mean ms | Rust L1 Hash |'

  run grep -F '# Rust IR Performance Baseline' "$TEST_TEMP_DIR/report.md"
  assert_success
}

@test "Rust IR performance markdown includes comparison columns when legacy JS is captured" {
  make_fake_wesley

  run env \
    WESLEY_CLI_BIN="$FAKE_WESLEY" \
    node scripts/measure-ir-performance.mjs \
      --fixture test/fixtures/ir-parity/small-schema.graphql \
      --iterations 1 \
      --warmups 0 \
      --include-legacy-js \
      --markdown
  assert_success
  assert_output --partial 'Legacy JS comparison: `captured`'
  assert_output --partial '| Fixture | Status | Types | Rust Median ms | Rust Mean ms | Legacy JS Median ms | Legacy JS Mean ms | Rust L1 Hash |'
}
