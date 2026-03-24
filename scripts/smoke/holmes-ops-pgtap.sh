#!/usr/bin/env bash
set -euo pipefail

if [[ "${CI:-}" == "true" || "${SKIP_HOLMES_OPS_PREPUSH:-}" == "1" ]]; then
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.fixture-test.yml"
PORT="${FIXTURE_POSTGRES_PORT:-65432}"
FIXTURE_DIR="$ROOT_DIR/test/fixtures/examples"
OUT_DIR="${HOLMES_OUT_DIR:-out}"
OPS_DIR="$FIXTURE_DIR/$OUT_DIR/ops"
SCHEMA_SQL="$FIXTURE_DIR/$OUT_DIR/schema.sql"
WESLEY_BIN="$ROOT_DIR/packages/wesley-host-node/bin/wesley.mjs"

cleanup() {
  docker compose -f "$COMPOSE_FILE" down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[pre-push] Required command not found: $1" >&2
    exit 1
  fi
}

require_command docker
require_command node
require_command psql

export FIXTURE_POSTGRES_PORT="$PORT"

docker compose -f "$COMPOSE_FILE" up -d postgres-fixture --remove-orphans >/dev/null

echo "[pre-push] Waiting for HOLMES Postgres fixture on port $PORT..."
ready=0
for attempt in {1..30}; do
  if docker compose -f "$COMPOSE_FILE" exec -T postgres-fixture pg_isready -U wesley -d wesley_test >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done

if [[ "$ready" -ne 1 ]]; then
  echo "[pre-push] Postgres fixture did not become ready in time" >&2
  exit 1
fi

echo "[pre-push] Regenerating HOLMES fixture artifacts..."
(
  cd "$FIXTURE_DIR"
  rm -rf "$OUT_DIR" .wesley-cache
  node "$WESLEY_BIN" generate \
    --schema ecommerce.graphql \
    --emit-bundle \
    --ops ./ops \
    --allow-dirty \
    --out-dir "$OUT_DIR"
)

if [[ ! -f "$SCHEMA_SQL" ]]; then
  echo "[pre-push] Missing generated schema: $SCHEMA_SQL" >&2
  exit 1
fi

PGPASSWORD=wesley_test psql -X -v ON_ERROR_STOP=1 -h localhost -p "$PORT" -U wesley -d wesley_test -f "$SCHEMA_SQL"
PGPASSWORD=wesley_test psql -X -v ON_ERROR_STOP=1 -h localhost -p "$PORT" -U wesley -d wesley_test -c 'CREATE SCHEMA IF NOT EXISTS wes_ops;'

if [[ ! -d "$OPS_DIR" ]]; then
  echo "[pre-push] No generated ops directory found; skipping HOLMES ops apply" >&2
  exit 0
fi

shopt -s nullglob
for pattern in "*.view.sql" "*.fn.sql"; do
  files=("$OPS_DIR"/$pattern)
  if [[ "${#files[@]}" -eq 0 ]]; then
    continue
  fi
  for f in "${files[@]}"; do
    if [[ ! -s "$f" ]]; then
      continue
    fi
    echo "[pre-push] Applying $f"
    PGPASSWORD=wesley_test psql -X -1 -v ON_ERROR_STOP=1 -h localhost -p "$PORT" -U wesley -d wesley_test -f "$f"
  done
done

echo "[pre-push] HOLMES ops SQL applied successfully"
