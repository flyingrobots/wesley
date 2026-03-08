#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.fixture-test.yml"
PORT="${FIXTURE_POSTGRES_PORT:-65432}"

cleanup() {
  docker compose -f "$COMPOSE_FILE" down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

export FIXTURE_POSTGRES_PORT="$PORT"
docker compose -f "$COMPOSE_FILE" up -d postgres-fixture --remove-orphans >/dev/null

echo "Waiting for Postgres fixture container to become ready..."
ready=0
for attempt in {1..30}; do
  if docker compose -f "$COMPOSE_FILE" exec postgres-fixture pg_isready -U wesley -d wesley_test >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done

if [[ $ready -ne 1 ]]; then
  echo "Postgres fixture did not become ready in time" >&2
  exit 1
fi

echo "Checking seeded extensions..."
extensions=$(docker compose -f "$COMPOSE_FILE" exec postgres-fixture psql -U wesley -d wesley_test -Atc "SELECT extname FROM pg_extension WHERE extname IN ('pgcrypto','uuid-ossp','pg_trgm') ORDER BY extname;")
expected=$'pg_trgm\npgcrypto\nuuid-ossp'
if [[ "$extensions" != "$expected" ]]; then
  echo "Unexpected extension list:" >&2
  echo "$extensions" >&2
  exit 1
fi

echo "Postgres fixture verified (extensions present, mount path working)."
