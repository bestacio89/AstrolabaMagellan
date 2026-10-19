# Repart d'une base de développement PROPRE, à jour du modèle (Windows / PowerShell).
#   1. supprime la base de développement PilotageForfaits (TOUTES ses données : projets, brouillons, tests) ;
#   2. supprime les migrations existantes et recrée une seule migration « Initiale », à jour du modèle actuel ;
#   3. au prochain démarrage, l'API crée la base à partir de cette migration.
# À utiliser tant que l'application est en développement (aucune donnée à garder). Une fois en recette ou en production,
# on ne réinitialise plus : chaque évolution du modèle = .\scripts\creer-migration.ps1 -Nom NomDeLEvolution (sans perte).
# Usage (depuis le dossier du dépôt, l'API étant arrêtée) : .\scripts\reinitialiser-base.ps1
$ErrorActionPreference = 'Stop'
$env:ASPNETCORE_ENVIRONMENT = 'Development' # chaîne de connexion de appsettings.Development.json

# Une commande externe (dotnet) ne fait pas échouer le script toute seule : on vérifie son code de retour à chaque étape.
function Executer([string]$etape, [scriptblock]$commande) {
  & $commande
  if ($LASTEXITCODE -ne 0) {
    Write-Host "ÉCHEC à l'étape « $etape » (code $LASTEXITCODE). Rien de plus n'a été fait. Copiez le message ci-dessus." -ForegroundColor Red
    exit 1
  }
}

$depot = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location (Join-Path $depot 'backend')
try {
  Write-Host "Cette commande SUPPRIME la base de développement et toutes ses données." -ForegroundColor Yellow
  $reponse = Read-Host "Continuer ? (o/n)"
  if ($reponse -notmatch '^[oOyY]') { Write-Host "Rien n'a été fait."; return }

  # Fichiers décompressés d'un .zip téléchargé : Windows les marque « provenant d'un autre ordinateur » et peut les bloquer.
  Write-Host "0/3 Déblocage des fichiers du dépôt (téléchargés)…" -ForegroundColor Yellow
  Get-ChildItem -Path $depot -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\node_modules\\' } | Unblock-File -ErrorAction SilentlyContinue

  Executer 'outils dotnet' { dotnet tool restore }
  $commun = @('--project', 'src/PilotageForfaits.Infrastructure', '--startup-project', 'src/PilotageForfaits.Api')

  Write-Host "1/3 Suppression de la base de développement…" -ForegroundColor Yellow
  Executer 'compilation' { dotnet build --nologo -v q }
  Executer 'suppression de la base' { dotnet ef database drop --force --no-build @commun }

  Write-Host "2/3 Suppression des anciennes migrations…" -ForegroundColor Yellow
  $migrations = 'src/PilotageForfaits.Infrastructure/Donnees/Migrations'
  if (Test-Path $migrations) { Remove-Item -Recurse -Force $migrations }

  Write-Host "3/3 Création de la migration initiale, à jour du modèle…" -ForegroundColor Yellow
  Executer 'création de la migration' { dotnet ef migrations add Initiale @commun --output-dir Donnees/Migrations }
  if (-not (Get-ChildItem $migrations -Filter '*_Initiale.cs' -ErrorAction SilentlyContinue)) {
    Write-Host "ÉCHEC : la migration Initiale n'a pas été créée dans $migrations." -ForegroundColor Red
    exit 1
  }

  Write-Host "Terminé. Lancez l'API (dotnet run --project src/PilotageForfaits.Api) : elle crée la base." -ForegroundColor Green
  Write-Host "Pensez à enregistrer le dossier Donnees/Migrations dans Git (il remplace l'ancien)." -ForegroundColor Cyan
} finally { Pop-Location }
