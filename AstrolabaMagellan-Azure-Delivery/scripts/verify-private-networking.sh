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
  echo "Checking DNS for $host"
  getent ahosts "$host" || { echo "DNS resolution failed for $host" >&2; exit 20; }
done

# App Service platform health endpoints vary by app. This is a network/TLS reachability
# check, not proof that business functions work. Replace /health with the real API health path.
API_URL="https://${BACKEND_APP_NAME}.azurewebsites.net/health"
HTTP_CODE="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 20 "$API_URL" || true)"
case "$HTTP_CODE" in
  2*|3*) echo "API health endpoint responded with HTTP $HTTP_CODE" ;;
  *) echo "API health check failed: HTTP ${HTTP_CODE:-no-response}. Confirm route, private DNS, access, and health endpoint." >&2; exit 21 ;;
esac

echo "Private networking smoke checks completed for $ENVIRONMENT. Validate expected private IP ranges and public access settings in Azure as well."
