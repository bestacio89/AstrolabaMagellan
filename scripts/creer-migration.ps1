# Crée une migration de base de données (Windows / PowerShell).
# Usage : .\scripts\creer-migration.ps1 -Nom Initiale
param([Parameter(Mandatory = $true)][string]$Nom)
$ErrorActionPreference = 'Stop'
$env:ASPNETCORE_ENVIRONMENT = 'Development'
Push-Location (Join-Path $PSScriptRoot '..\backend')
try {
  dotnet tool restore
  dotnet ef migrations add $Nom --project src/PilotageForfaits.Infrastructure --startup-project src/PilotageForfaits.Api --output-dir Donnees/Migrations
} finally { Pop-Location }
