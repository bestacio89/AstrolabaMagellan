#!/usr/bin/env bash
set -euo pipefail
ENVIRONMENT="${1:?Usage: verify-private-networking.sh <test|production>}"
: "${BACKEND_APP_NAME:?Set BACKEND_APP_NAME pipeline variable}"
: "${FRONTEND_APP_NAME:?Set FRONTEND_APP_NAME pipeline variable}"
: "${POSTGRES_SERVER_NAME:?Set POSTGRES_SERVER_NAME pipeline variable}"
: "${KEY_VAULT_NAME:?Set KEY_VAULT_NAME pipeline variable}"

for host in \
  "${BACKEND_APP_NAME}.azurewebsites.net" \
  "${FRONTEND_APP_NAME}.azurewebsites.net" \
  "${KEY_VAULT_NAME}.vault.azure.net" \
  "${POSTGRES_SERVER_NAME}.postgres.database.azure.com"; do
  echo "Checking private DNS for $host"
  addresses="$(getent ahostsv4 "$host" | awk '{print $1}' | sort -u)"
  [[ -n "$addresses" ]] || { echo "DNS resolution failed for $host" >&2; exit 20; }
  while IFS= read -r address; do
    case "$address" in
      10.*|192.168.*|172.1[6-9].*|172.2[0-9].*|172.3[0-1].*) ;;
      *) echo "Expected private endpoint address for $host, got $address" >&2; exit 24 ;;
    esac
  done <<< "$addresses"
done

# The API liveness route /api/sante verifies application reachability, not database readiness.
API_URL="https://${BACKEND_APP_NAME}.azurewebsites.net/api/sante"
HTTP_CODE="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 20 "$API_URL" || true)"
case "$HTTP_CODE" in
  2*|3*) echo "API health endpoint responded with HTTP $HTTP_CODE" ;;
  *) echo "API health check failed: HTTP ${HTTP_CODE:-no-response}. Confirm route, private DNS, access, and health endpoint." >&2; exit 21 ;;
esac

CORS_CODE="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 20 \
  --request OPTIONS "$API_URL" \
  --header "Origin: https://${FRONTEND_APP_NAME}.azurewebsites.net" \
  --header 'Access-Control-Request-Method: GET' \
  --header 'Access-Control-Request-Headers: authorization' || true)"
if [[ "$CORS_CODE" != 2* ]]; then
  echo "CORS preflight failed: HTTP ${CORS_CODE:-no-response}." >&2
  exit 22
fi
ALLOW_ORIGIN="$(curl --silent --show-error --include --max-time 20 --request OPTIONS "$API_URL" \
  --header "Origin: https://${FRONTEND_APP_NAME}.azurewebsites.net" \
  --header 'Access-Control-Request-Method: GET' \
  --header 'Access-Control-Request-Headers: authorization' | awk 'tolower($1) == "access-control-allow-origin:" {gsub(/\r/,"",$2); print $2; exit}')"
if [[ "$ALLOW_ORIGIN" != "https://${FRONTEND_APP_NAME}.azurewebsites.net" ]]; then
  echo "CORS did not allow the configured frontend origin." >&2
  exit 23
fi

echo "Private networking, API liveness and CORS checks completed for $ENVIRONMENT."
