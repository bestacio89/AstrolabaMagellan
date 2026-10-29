#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:?Usage: deploy-application.sh <test|production>}"
case "$ENVIRONMENT" in test|production) ;; *) echo "Invalid environment: $ENVIRONMENT" >&2; exit 2;; esac

: "${RESOURCE_GROUP_NAME:?Set RESOURCE_GROUP_NAME pipeline variable}"
: "${BACKEND_APP_NAME:?Set BACKEND_APP_NAME pipeline variable}"
: "${FRONTEND_APP_NAME:?Set FRONTEND_APP_NAME pipeline variable}"
: "${POSTGRES_SERVER_NAME:?Set POSTGRES_SERVER_NAME pipeline variable}"
: "${POSTGRES_DATABASE_NAME:=pilotageforfaits}"
: "${POSTGRES_ADMIN_LOGIN:?Set POSTGRES_ADMIN_LOGIN pipeline variable}"
: "${KEY_VAULT_NAME:?Set KEY_VAULT_NAME pipeline variable}"

ROOT="${BUILD_SOURCESDIRECTORY:-$(pwd)}"
cd "$ROOT"

# Confirm the runtime secret exists without retrieving its credential-bearing value.
if ! az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name AstrolabaPostgresConnectionString --query id --output tsv >/dev/null 2>&1; then
  echo 'Key Vault secret AstrolabaPostgresConnectionString is missing.' >&2
  exit 10
fi

# Publish backend into a clean staging directory.
rm -rf .deploy/backend .deploy/frontend
mkdir -p .deploy/backend .deploy/frontend

dotnet restore backend/PilotageForfaits.sln
dotnet publish backend/src/PilotageForfaits.Api/PilotageForfaits.Api.csproj \
  --configuration Release --no-restore --output .deploy/backend

# Apply EF Core migrations using the administrator identity. Runtime credentials remain least-privileged.
dotnet tool install --global dotnet-ef --version '10.*' 2>/dev/null || dotnet tool update --global dotnet-ef --version '10.*'
export PATH="$PATH:$HOME/.dotnet/tools"
ADMIN_PASSWORD="$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name AstrolabaPostgresAdminPassword --query value --output tsv)"
if [[ -z "$ADMIN_PASSWORD" || "$ADMIN_PASSWORD" == "None" ]]; then
  echo 'Key Vault administrator password is missing.' >&2
  exit 12
fi
POSTGRES_FQDN="$(az postgres flexible-server show --resource-group "$RESOURCE_GROUP_NAME" --name "$POSTGRES_SERVER_NAME" --query fullyQualifiedDomainName --output tsv)"
MIGRATION_CONNECTION_STRING="Host=$POSTGRES_FQDN;Port=5432;Database=$POSTGRES_DATABASE_NAME;Username=$POSTGRES_ADMIN_LOGIN;Password=$ADMIN_PASSWORD;SSL Mode=VerifyFull;Timeout=15;Command Timeout=30;"
export ConnectionStrings__Pilotage="$MIGRATION_CONNECTION_STRING"
dotnet ef database update \
  --project backend/src/PilotageForfaits.Infrastructure/PilotageForfaits.Infrastructure.csproj \
  --startup-project backend/src/PilotageForfaits.Api/PilotageForfaits.Api.csproj \
  --configuration Release
unset ConnectionStrings__Pilotage MIGRATION_CONNECTION_STRING ADMIN_PASSWORD

# Package backend now; deploy both applications only after both builds succeed.
(cd .deploy/backend && zip -qr ../backend.zip .)

ENVIRONMENT_FILE="frontend/src/environments/environment.ts"
ENVIRONMENT_BACKUP="$(mktemp)"
cp "$ENVIRONMENT_FILE" "$ENVIRONMENT_BACKUP"
restore_environment() { cp "$ENVIRONMENT_BACKUP" "$ENVIRONMENT_FILE"; rm -f "$ENVIRONMENT_BACKUP"; }
trap restore_environment EXIT
API_BASE_URL="https://${BACKEND_APP_NAME}.azurewebsites.net/api"
grep -Fq "api: '/api'," "$ENVIRONMENT_FILE" || { echo 'Production API setting not found.' >&2; exit 14; }
sed -i "s|api: '/api',|api: '${API_BASE_URL}',|" "$ENVIRONMENT_FILE"
(cd frontend && if [[ -f package-lock.json ]]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi && npm run build -- --configuration production)
restore_environment
trap - EXIT
DIST_DIR="$(find frontend/dist -mindepth 1 -maxdepth 2 -type d -name browser -o -name dist | head -n 1)"
if [[ -z "$DIST_DIR" ]]; then
  DIST_DIR="$(find frontend/dist -mindepth 1 -maxdepth 1 -type d | head -n 1)"
fi
if [[ -z "$DIST_DIR" || ! -d "$DIST_DIR" ]]; then
  echo 'Could not locate Angular production output under frontend/dist. Check angular.json outputPath.' >&2
  exit 11
fi
(cd "$DIST_DIR" && zip -qr "$ROOT/.deploy/frontend.zip" .)

# Both deployment packages exist before either App Service is changed.
az webapp deploy --resource-group "$RESOURCE_GROUP_NAME" --name "$BACKEND_APP_NAME" \
  --src-path .deploy/backend.zip --type zip
az webapp deploy --resource-group "$RESOURCE_GROUP_NAME" --name "$FRONTEND_APP_NAME" \
  --src-path .deploy/frontend.zip --type zip

echo 'Deployment commands completed. Run the private smoke test and verify application-specific health checks.'
