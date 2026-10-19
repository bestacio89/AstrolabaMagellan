#!/usr/bin/env bash
# Crée une migration de base de données à partir des modifications du modèle (dossier Infrastructure/Donnees/Migrations).
# Usage : ./scripts/creer-migration.sh NomDeLaMigration     (ex. ./scripts/creer-migration.sh Initiale)
set -euo pipefail
export ASPNETCORE_ENVIRONMENT=Development
nom="${1:?Donnez un nom à la migration, ex. Initiale}"
cd "$(dirname "$0")/../backend"
dotnet tool restore
dotnet ef migrations add "$nom" \
  --project src/PilotageForfaits.Infrastructure \
  --startup-project src/PilotageForfaits.Api \
  --output-dir Donnees/Migrations
