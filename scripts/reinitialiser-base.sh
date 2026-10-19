#!/usr/bin/env bash
# Repart d'une base de développement PROPRE, à jour du modèle (macOS / Linux).
#   1. supprime la base de développement PilotageForfaits (TOUTES ses données : projets, brouillons, tests) ;
#   2. supprime les migrations existantes et recrée une seule migration « Initiale », à jour du modèle actuel ;
#   3. au prochain démarrage, l'API crée la base à partir de cette migration.
# À utiliser tant que l'application est en développement. Ensuite : ./scripts/creer-migration.sh NomDeLEvolution (sans perte).
# Usage (depuis le dossier du dépôt, l'API étant arrêtée) : ./scripts/reinitialiser-base.sh
set -euo pipefail
export ASPNETCORE_ENVIRONMENT=Development
cd "$(dirname "$0")/../backend"
read -r -p "Cette commande SUPPRIME la base de développement et toutes ses données. Continuer ? (o/n) " reponse
case "$reponse" in [oOyY]*) ;; *) echo "Rien n'a été fait."; exit 0 ;; esac
commun=(--project src/PilotageForfaits.Infrastructure --startup-project src/PilotageForfaits.Api)
dotnet tool restore
echo "1/3 Suppression de la base de développement…"
dotnet build --nologo -v q
dotnet ef database drop --force --no-build "${commun[@]}"
echo "2/3 Suppression des anciennes migrations…"
rm -rf src/PilotageForfaits.Infrastructure/Donnees/Migrations
echo "3/3 Création de la migration initiale, à jour du modèle…"
dotnet ef migrations add Initiale "${commun[@]}" --output-dir Donnees/Migrations
echo "Terminé. Lancez l'API (dotnet run --project src/PilotageForfaits.Api) : elle crée la base."
echo "Pensez à enregistrer le dossier Donnees/Migrations dans Git (il remplace l'ancien)."
