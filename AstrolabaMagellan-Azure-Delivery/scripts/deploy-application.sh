#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:?Usage: deploy-application.sh <test|production>}"
case "$ENVIRONMENT" in test|production) ;; *) echo "Invalid environment: $ENVIRONMENT" >&2; exit 2;; esac

: "${RESOURCE_GROUP_NAME:?Set RESOURCE_GROUP_NAME pipeline variable}"
: "${BACKEND_APP_NAME:?Set BACKEND_APP_NAME pipeline variable}"
: "${FRONTEND_APP_NAME:?Set FRONTEND_APP_NAME pipeline variable}"
: "${POSTGRES_SERVER_NAME:?Set POSTGRES_SERVER_NAME pipeline variable}"
: "${POSTGRES_DATABASE_NAME:=pilotageforfaits}"
: "${KEY_VAULT_NAME:?Set KEY_VAULT_NAME pipeline variable}"

ROOT="${BUILD_SOURCESDIRECTORY:-$(pwd)}"
cd "$ROOT"

# Read the connection string only into this process. Never print it to logs.
CONNECTION_STRING="$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name AstrolabaPostgresConnectionString --query value --output tsv)"
if [[ -z "$CONNECTION_STRING" || "$CONNECTION_STRING" == *REPLACE_* ]]; then
  echo 'Key Vault secret AstrolabaPostgresConnectionString is missing or still a placeholder.' >&2
  exit 10
fi
export ConnectionStrings__DefaultConnection="$CONNECTION_STRING"

# Publish backend into a clean staging directory.
rm -rf .deploy/backend .deploy/frontend
mkdir -p .deploy/backend .deploy/frontend

dotnet restore backend/PilotageForfaits.sln
dotnet publish backend/src/PilotageForfaits.Api/PilotageForfaits.Api.csproj \
  --configuration Release --no-restore --output .deploy/backend

# Apply EF Core migrations from the API startup project. Confirm the actual DbContext
# and migrations assembly in this repository before first use; adjust --project if needed.
dotnet tool install --global dotnet-ef --version '10.*' 2>/dev/null || dotnet tool update --global dotnet-ef --version '10.*'
export PATH="$PATH:$HOME/.dotnet/tools"
dotnet ef database update \
  --project backend/src/PilotageForfaits.Infrastructure/PilotageForfaits.Infrastructure.csproj \
  --startup-project backend/src/PilotageForfaits.Api/PilotageForfaits.Api.csproj \
  --configuration Release

# App Service deployment endpoint must resolve privately from this agent.
(cd .deploy/backend && zip -qr ../backend.zip .)
az webapp deploy --resource-group "$RESOURCE_GROUP_NAME" --name "$BACKEND_APP_NAME" \
  --src-path .deploy/backend.zip --type zip

# Angular must be configured to call the private backend API origin. Relative /api URLs
# require a reverse proxy/BFF or an equivalent rewrite, which this infrastructure does not create.
(cd frontend && npm ci && npm run build -- --configuration production)
DIST_DIR="$(find frontend/dist -mindepth 1 -maxdepth 2 -type d -name browser -o -name dist | head -n 1)"
if [[ -z "$DIST_DIR" ]]; then
  DIST_DIR="$(find frontend/dist -mindepth 1 -maxdepth 1 -type d | head -n 1)"
fi
if [[ -z "$DIST_DIR" || ! -d "$DIST_DIR" ]]; then
  echo 'Could not locate Angular production output under frontend/dist. Check angular.json outputPath.' >&2
  exit 11
fi
(cd "$DIST_DIR" && zip -qr "$ROOT/.deploy/frontend.zip" .)
az webapp deploy --resource-group "$RESOURCE_GROUP_NAME" --name "$FRONTEND_APP_NAME" \
  --src-path .deploy/frontend.zip --type zip

echo 'Deployment commands completed. Run the private smoke test and verify application-specific health checks.'
