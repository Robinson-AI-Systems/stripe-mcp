#!/usr/bin/env bash
set -euo pipefail
export CI=1
if [[ "${STRIPE_MOCK_EXTERNAL:-}" == "1" ]]; then
  exec npx --no-install vitest run --config vitest.mock.config.js "$@"
fi
id=""
pid=""
cleanup() {
  if [[ -n "$id" ]]; then docker rm -f "$id" >/dev/null 2>&1 || true; fi
  if [[ -n "$pid" ]]; then kill "$pid" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  id="$(docker run -d --rm -p 127.0.0.1:12111:12111 stripe/stripe-mock:v0.202.0)"
else
  if [[ "$(uname -s)" != Linux || "$(uname -m)" != x86_64 ]]; then
    echo "Without Docker, only Linux x86_64 is supported by this pinned download." >&2
    exit 2
  fi
  mkdir -p .cache
  archive=".cache/stripe-mock_0.202.0_linux_amd64.tar.gz"
  if [[ ! -f "$archive" ]]; then
    curl --fail --location --retry 2 --max-time 60 -o "$archive"       "https://github.com/stripe/stripe-mock/releases/download/v0.202.0/stripe-mock_0.202.0_linux_amd64.tar.gz"
  fi
  echo "b56e13c12fa9a8fd3759240be9bfafbf0aed55c4f6bbd3fe3a24f4aa1fff4916  $archive" | sha256sum --check --status
  tar -xzf "$archive" -C .cache stripe-mock
  .cache/stripe-mock -http-port 12111 -https-port 0 >/dev/null 2>&1 &
  pid="$!"
fi
ready=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl --silent --fail --max-time 2 -H 'Authorization: Bearer sk_test_FAKE_A1' http://127.0.0.1:12111/v1/customers?limit=1 >/dev/null; then ready=1; break; fi
  sleep 1
done
if [[ "$ready" != 1 ]]; then echo "stripe-mock failed to start" >&2; exit 1; fi
npx --no-install vitest run --config vitest.mock.config.js "$@"
