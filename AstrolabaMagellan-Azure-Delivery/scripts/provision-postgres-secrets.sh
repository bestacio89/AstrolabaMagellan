#!/usr/bin/env bash
# Idempotently stores the administrator credential, creates/updates the app role,
# and writes the Npgsql connection string to Key Vault. Must run on the private agent.
set -euo pipefail

: "${RESOURCE_GROUP_NAME:?Set RESOURCE_GROUP_NAME}"
: "${POSTGRES_SERVER_NAME:?Set POSTGRES_SERVER_NAME}"
: "${POSTGRES_DATABASE_NAME:=pilotageforfaits}"
: "${POSTGRES_ADMIN_LOGIN:=astrolabaadmin}"
: "${KEY_VAULT_NAME:?Set KEY_VAULT_NAME}"
: "${ASTROLABA_POSTGRES_ADMIN_PASSWORD:?Set admin password in process environment}"
: "${POSTGRES_APP_LOGIN:=astrolaba_app}"

command -v az >/dev/null || { echo 'Azure CLI is required on the private agent.' >&2; exit 2; }
command -v psql >/dev/null || { echo 'psql (PostgreSQL client) is required on the private agent.' >&2; exit 2; }
command -v openssl >/dev/null || { echo 'openssl is required on the private agent.' >&2; exit 2; }
[[ "$POSTGRES_APP_LOGIN" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || { echo 'POSTGRES_APP_LOGIN must be a simple PostgreSQL identifier.' >&2; exit 2; }
[[ "$POSTGRES_DATABASE_NAME" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || { echo 'POSTGRES_DATABASE_NAME must be a simple PostgreSQL identifier.' >&2; exit 2; }
umask 077

# The Private Endpoint/DNS may take a short time to become usable after Bicep.
retry() {
  local attempt=1 max_attempts=18 delay=10
  until "$@"; do
    if (( attempt >= max_attempts )); then
      echo "Command failed after ${max_attempts} attempts: $1" >&2
      return 1
    fi
    sleep "$delay"
    attempt=$((attempt + 1))
  done
}

set_secret() {
  local secret_name="$1" secret_value="$2" secret_file
  # Use a restrictive temporary file rather than exposing the value in process arguments.
  secret_file="$(mktemp)"
  chmod 600 "$secret_file"
  printf '%s' "$secret_value" > "$secret_file"
  if ! retry az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "$secret_name" --file "$secret_file" --encoding utf-8 --only-show-errors --output none; then
    rm -f "$secret_file"
    return 1
  fi
  rm -f "$secret_file"
}

set_secret AstrolabaPostgresAdminPassword "$ASTROLABA_POSTGRES_ADMIN_PASSWORD"

if [[ -n "${BICEP_DEPLOYMENT_NAME:-}" ]]; then
  POSTGRES_FQDN="$(az deployment group show --resource-group "$RESOURCE_GROUP_NAME" --name "$BICEP_DEPLOYMENT_NAME" --query properties.outputs.postgresFqdn.value --output tsv)"
  OUTPUT_DATABASE_NAME="$(az deployment group show --resource-group "$RESOURCE_GROUP_NAME" --name "$BICEP_DEPLOYMENT_NAME" --query properties.outputs.databaseName.value --output tsv)"
  if [[ -n "${EXPECTED_DATABASE_NAME:-}" && "$OUTPUT_DATABASE_NAME" != "$EXPECTED_DATABASE_NAME" ]]; then
    echo 'Bicep database output does not match the expected database name.' >&2
    exit 3
  fi
fi
if [[ -z "${POSTGRES_FQDN:-}" || "$POSTGRES_FQDN" == "None" ]]; then
  POSTGRES_FQDN="$(az postgres flexible-server show --resource-group "$RESOURCE_GROUP_NAME" --name "$POSTGRES_SERVER_NAME" --query fullyQualifiedDomainName --output tsv)"
fi
if [[ -z "$POSTGRES_FQDN" || "$POSTGRES_FQDN" == "None" ]]; then
  echo 'Could not resolve PostgreSQL FQDN from Bicep outputs or Azure resource metadata.' >&2
  exit 3
fi

# Reuse the application password between deployments; generate it only on first setup.
if APP_PASSWORD="$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name AstrolabaPostgresApplicationPassword --query value --output tsv 2>/dev/null)" && [[ -n "$APP_PASSWORD" ]]; then
  :
else
  APP_PASSWORD="$(openssl rand -hex 32)A!"
fi

# Do not enable xtrace: credentials must never be emitted into pipeline logs.
export PGPASSWORD="$ASTROLABA_POSTGRES_ADMIN_PASSWORD"
export PGSSLMODE=verify-full
export PGCONNECT_TIMEOUT=15

# Wait for private DNS, the PostgreSQL endpoint and credentials to become usable.
retry psql "host=$POSTGRES_FQDN port=5432 dbname=postgres user=$POSTGRES_ADMIN_LOGIN sslmode=verify-full connect_timeout=15" \
  --no-psqlrc --set=ON_ERROR_STOP=1 --command='SELECT 1' >/dev/null

# Write the credential-bearing SQL to a private temporary file; do not put the
# application password in process arguments or pipeline output. Password is generated with a safe suffix and has no SQL-quoting characters.
ROLE_SQL="$(mktemp)"
SCHEMA_SQL="$(mktemp)"
chmod 600 "$ROLE_SQL" "$SCHEMA_SQL"
trap 'rm -f "${ROLE_SQL:-}" "${SCHEMA_SQL:-}"' EXIT
cat > "$ROLE_SQL" <<SQL
\o /dev/null
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', '$POSTGRES_APP_LOGIN', '$APP_PASSWORD')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$POSTGRES_APP_LOGIN')
\gexec
SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', '$POSTGRES_APP_LOGIN', '$APP_PASSWORD')
\gexec
SELECT format('ALTER DATABASE %I OWNER TO %I', '$POSTGRES_DATABASE_NAME', '$POSTGRES_APP_LOGIN')
\gexec
SQL
psql "host=$POSTGRES_FQDN port=5432 dbname=postgres user=$POSTGRES_ADMIN_LOGIN sslmode=verify-full connect_timeout=15" \
  --no-psqlrc --set=ON_ERROR_STOP=1 --file "$ROLE_SQL"

# Make the application role the owner of the public schema so EF migrations can run.
cat > "$SCHEMA_SQL" <<SQL
\o /dev/null
SELECT format('ALTER SCHEMA public OWNER TO %I', '$POSTGRES_APP_LOGIN')
\gexec
SQL
psql "host=$POSTGRES_FQDN port=5432 dbname=$POSTGRES_DATABASE_NAME user=$POSTGRES_ADMIN_LOGIN sslmode=verify-full connect_timeout=15" \
  --no-psqlrc --set=ON_ERROR_STOP=1 --file "$SCHEMA_SQL"

CONNECTION_STRING="Host=$POSTGRES_FQDN;Port=5432;Database=$POSTGRES_DATABASE_NAME;Username=$POSTGRES_APP_LOGIN;Password=$APP_PASSWORD;SSL Mode=VerifyFull;Timeout=15;Command Timeout=30;"
set_secret AstrolabaPostgresApplicationPassword "$APP_PASSWORD"
set_secret AstrolabaPostgresConnectionString "$CONNECTION_STRING"

unset PGPASSWORD APP_PASSWORD CONNECTION_STRING ASTROLABA_POSTGRES_ADMIN_PASSWORD
printf 'PostgreSQL credentials provisioned in Key Vault; connection string value was not logged.\n'
