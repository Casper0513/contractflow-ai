#!/usr/bin/env bash

set -euo pipefail

if [ -z "${API_BASE_URL:-}" ]; then
  echo "RED: API_BASE_URL is required"
  exit 1
fi

if [ -z "${WEB_BASE_URL:-}" ]; then
  echo "RED: WEB_BASE_URL is required"
  exit 1
fi

API_BASE_URL="${API_BASE_URL%/}"
WEB_BASE_URL="${WEB_BASE_URL%/}"

FAKE_PUBLIC_TOKEN="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

if [ "${#FAKE_PUBLIC_TOKEN}" -ne 43 ]; then
  echo "RED: smoke-test public token must be exactly 43 characters"
  exit 1
fi

TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

request_status() {
  local output_file="$1"
  shift

  curl \
    --silent \
    --show-error \
    --connect-timeout 10 \
    --max-time 30 \
    --output "$output_file" \
    --write-out '%{http_code}' \
    "$@"
}

echo "===== CONTRACTFLOW PRODUCTION SMOKE ====="
echo "api=$API_BASE_URL"
echo "web=$WEB_BASE_URL"

echo
echo "===== 1. API + DATABASE HEALTH ====="

HEALTH_STATUS="$(
  request_status \
    "$TMP_DIR/health.json" \
    "$API_BASE_URL/health"
)"

echo "status=$HEALTH_STATUS"
cat "$TMP_DIR/health.json"
echo

if [ "$HEALTH_STATUS" != "200" ]; then
  echo "RED: API health endpoint did not return 200"
  exit 1
fi

HEALTH_FILE="$TMP_DIR/health.json" node <<'NODE'
const fs = require("node:fs");

const body = JSON.parse(
  fs.readFileSync(process.env.HEALTH_FILE, "utf8"),
);

if (body.status !== "ok") {
  console.error(
    `RED: expected health status "ok", got ${JSON.stringify(body.status)}`,
  );
  process.exit(1);
}

if (body.database !== "connected") {
  console.error(
    `RED: expected database "connected", got ${JSON.stringify(body.database)}`,
  );
  process.exit(1);
}

if (body.service !== "contractflow-api") {
  console.error(
    `RED: unexpected service ${JSON.stringify(body.service)}`,
  );
  process.exit(1);
}

console.log("GREEN: API and database health verified");
NODE

echo
echo "===== 2. WEB AVAILABILITY ====="

WEB_STATUS="$(
  request_status \
    "$TMP_DIR/web.html" \
    "$WEB_BASE_URL/"
)"

echo "status=$WEB_STATUS"

if [ "$WEB_STATUS" != "200" ]; then
  echo "RED: ContractFlow Web root did not return 200"
  exit 1
fi

if ! grep -qi 'ContractFlow' "$TMP_DIR/web.html"; then
  echo "RED: ContractFlow marker not found in Web response"
  exit 1
fi

echo "GREEN: Web application is available"

echo
echo "===== 3. WEB AUTH BOUNDARY ====="

DASHBOARD_STATUS="$(
  curl \
    --silent \
    --show-error \
    --connect-timeout 10 \
    --max-time 30 \
    --output "$TMP_DIR/customers.html" \
    --dump-header "$TMP_DIR/customers.headers" \
    --write-out '%{http_code}' \
    "$WEB_BASE_URL/customers"
)"

echo "status=$DASHBOARD_STATUS"

case "$DASHBOARD_STATUS" in
  301|302|303|307|308)
    ;;
  *)
    echo "RED: unauthenticated /customers request did not redirect"
    exit 1
    ;;
esac

LOCATION="$(
  awk '
    BEGIN { IGNORECASE=1 }
    /^location:/ {
      sub(/\r$/, "", $0);
      sub(/^[^:]+:[[:space:]]*/, "", $0);
      print $0;
    }
  ' "$TMP_DIR/customers.headers" |
  tail -1
)"

echo "location=$LOCATION"

case "$LOCATION" in
  /|"$WEB_BASE_URL"|"$WEB_BASE_URL/")
    ;;
  *)
    echo "RED: unauthenticated /customers redirect was unexpected"
    exit 1
    ;;
esac

echo "GREEN: Web dashboard auth boundary verified"

echo
echo "===== 4. API AUTH BOUNDARY ====="

CUSTOMERS_STATUS="$(
  request_status \
    "$TMP_DIR/customers-api.json" \
    "$API_BASE_URL/customers"
)"

echo "status=$CUSTOMERS_STATUS"
cat "$TMP_DIR/customers-api.json"
echo

if [ "$CUSTOMERS_STATUS" != "401" ]; then
  echo "RED: unauthenticated API customers request did not return 401"
  exit 1
fi

echo "GREEN: API Clerk auth boundary verified"

echo
echo "===== 5. INVALID PUBLIC ESTIMATE TOKEN ====="

ESTIMATE_STATUS="$(
  request_status \
    "$TMP_DIR/estimate.json" \
    "$API_BASE_URL/public/estimates/$FAKE_PUBLIC_TOKEN"
)"

echo "status=$ESTIMATE_STATUS"
cat "$TMP_DIR/estimate.json"
echo

if [ "$ESTIMATE_STATUS" != "404" ]; then
  echo "RED: nonexistent valid-format estimate token did not return 404"
  exit 1
fi

echo "GREEN: public estimate token boundary verified"

echo
echo "===== 6. INVALID PUBLIC INVOICE TOKEN ====="

INVOICE_STATUS="$(
  request_status \
    "$TMP_DIR/invoice.json" \
    "$API_BASE_URL/public/invoices/$FAKE_PUBLIC_TOKEN"
)"

echo "status=$INVOICE_STATUS"
cat "$TMP_DIR/invoice.json"
echo

if [ "$INVOICE_STATUS" != "404" ]; then
  echo "RED: nonexistent valid-format invoice token did not return 404"
  exit 1
fi

echo "GREEN: public invoice token boundary verified"

echo
echo "===== RESULT ====="
echo "GREEN: ContractFlow production smoke checks passed"
