#!/usr/bin/env bash
set -euo pipefail
export CI=1
if [[ -n "${TEST_DATABASE_URL:-}" ]]; then
  exec npx --no-install vitest run --config vitest.db.config.js "$@"
fi
for binary in initdb pg_ctl; do
  if ! command -v "$binary" >/dev/null 2>&1; then
    echo "Local Postgres not installed: $binary. Run in CI's throwaway PostgreSQL service." >&2
    exit 2
  fi
done
tmp="$(mktemp -d)"
port="$((20000 + RANDOM % 10000))"
cleanup() { pg_ctl -D "$tmp/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT
initdb -D "$tmp/data" -A trust --no-instructions >/dev/null
pg_ctl -D "$tmp/data" -o "-p $port -k $tmp" -w start >/dev/null
export TEST_DATABASE_URL="postgresql://localhost:$port/postgres"
npx --no-install vitest run --config vitest.db.config.js "$@"
