#!/usr/bin/env bash
# Print the existing administrator password from Key Vault, or generate one only
# for a brand-new PostgreSQL server. Never log the value.
set -euo pipefail

: "${RESOURCE_GROUP_NAME:?Set RESOURCE_GROUP_NAME}"
: "${POSTGRES_SERVER_NAME:?Set POSTGRES_SERVER_NAME}"
: "${KEY_VAULT_NAME:?Set KEY_VAULT_NAME}"
MODE="${1:-deploy}"
case "$MODE" in preflight|deploy) ;; *) echo 'Usage: resolve-postgres-admin-password.sh <preflight|deploy>' >&2; exit 2;; esac

vault_exists=false
if az keyvault show --name "$KEY_VAULT_NAME" --query id --output tsv >/dev/null 2>&1; then
  vault_exists=true
fi

if [[ "$vault_exists" == true ]]; then
  if password="$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name AstrolabaPostgresAdminPassword --query value --output tsv 2>/dev/null)" && [[ -n "$password" ]]; then
    printf '%s\n' "$password"
    exit 0
  fi
fi

if az postgres flexible-server show --resource-group "$RESOURCE_GROUP_NAME" --name "$POSTGRES_SERVER_NAME" --query id --output tsv >/dev/null 2>&1; then
  # During what-if, do not mutate infrastructure. During an actual deployment,
  # rotate the admin password to recover safely from a partial first deployment.
  password="$(openssl rand -hex 32)A!"
  if [[ "$MODE" == deploy ]]; then
    az postgres flexible-server update \
      --resource-group "$RESOURCE_GROUP_NAME" \
      --name "$POSTGRES_SERVER_NAME" \
      --admin-password "$password" \
      --only-show-errors --output none
  fi
  printf '%s\n' "$password"
  exit 0
fi

# Hex with uppercase and a special character satisfies Azure PostgreSQL password complexity.
printf '%sA!\n' "$(openssl rand -hex 32)"
