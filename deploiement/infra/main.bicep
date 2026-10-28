// Ressources Azure d'Astrolabe pour un environnement (dev, recette…), dans un groupe de ressources existant.
//   - PostgreSQL Flexible Server + base « pilotage_forfaits »      → données
//   - App Service Linux (.NET 10)                                  → API (backend)
//   - Storage Account, site web statique (conteneur $web)          → interface Angular (frontend)
// Le site web statique est activé par le pipeline (az CLI) : Bicep ne sait pas le faire.
// Toutes les ressources sont recréées à l'identique à chaque exécution (déploiement idempotent).

targetScope = 'resourceGroup'

@description('Nom court de l\'environnement, utilisé dans le nom des ressources.')
@maxLength(5)
param environnement string = 'dev'

@description('Région de l\'API et du stockage. Par défaut : celle du groupe de ressources.')
param location string = resourceGroup().location

@description('Région de PostgreSQL. À changer (ex. francecentral) seulement si Azure refuse la création dans la région du groupe.')
param postgresLocation string = location

@description('Identifiant de l\'administrateur PostgreSQL.')
param postgresAdminLogin string = 'astrolabeadmin'

@description('Mot de passe de l\'administrateur PostgreSQL (variable secrète du pipeline, jamais dans Git).')
@secure()
@minLength(12)
param postgresAdminPassword string

@description('Version majeure de PostgreSQL.')
param postgresVersion string = '16'

@description('Nom de la base de données de l\'application.')
param nomBase string = 'pilotage_forfaits'

@description('Taille du plan App Service (B1 = environnement de développement).')
param tailleAppService string = 'B1'

// Suffixe stable propre au groupe de ressources : les noms d'API, de serveur et de stockage doivent être uniques dans tout Azure.
var suffixe = take(uniqueString(resourceGroup().id), 6)
var nomPlan = 'asp-astrolabe-${environnement}'
var nomApi = 'app-astrolabe-api-${environnement}-${suffixe}'
var nomPostgres = 'psql-astrolabe-${environnement}-${suffixe}'
var nomStockage = toLower('stastrolabe${environnement}${suffixe}')
var etiquettes = {
  application: 'Astrolabe'
  environnement: environnement
}

// ---------- Interface : site web statique ----------
resource stockage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: nomStockage
  location: location
  tags: etiquettes
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    // Les conteneurs restent privés : seul le point d'accès « site web statique » est public.
    allowBlobPublicAccess: false
    // Le pipeline dépose les fichiers avec la clé du compte.
    allowSharedKeyAccess: true
  }
}

// Adresse du site, sans la barre finale (ex. https://stastrolabedevabc123.z6.web.core.windows.net).
var urlFront = take(stockage.properties.primaryEndpoints.web, length(stockage.properties.primaryEndpoints.web) - 1)

// ---------- Données : PostgreSQL ----------
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: nomPostgres
  location: postgresLocation
  tags: etiquettes
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: postgresVersion
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    authConfig: {
      passwordAuth: 'Enabled'
      activeDirectoryAuth: 'Disabled'
    }
    storage: {
      storageSizeGB: 32
      autoGrow: 'Disabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
  }
}

resource base 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: nomBase
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Seuls les services hébergés dans Azure (l'API, les agents du pipeline) peuvent joindre le serveur.
// Pour s'y connecter depuis un poste (pgAdmin…), ajouter son adresse IP dans le portail : Mise en réseau.
resource pareFeuAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: postgres
  name: 'AllowAllAzureServicesAndResourcesWithinAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// ---------- API : App Service Linux ----------
resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: nomPlan
  location: location
  tags: etiquettes
  kind: 'linux'
  sku: {
    name: tailleAppService
  }
  properties: {
    reserved: true
  }
}

var chaineConnexion = 'Host=${postgres.properties.fullyQualifiedDomainName};Port=5432;Database=${nomBase};Username=${postgresAdminLogin};Password=${postgresAdminPassword};SSL Mode=Require'

resource api 'Microsoft.Web/sites@2024-04-01' = {
  name: nomApi
  location: location
  tags: etiquettes
  kind: 'app,linux'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|10.0'
      appCommandLine: 'dotnet PilotageForfaits.Api.dll'
      alwaysOn: true
      http20Enabled: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      healthCheckPath: '/api/sante'
      appSettings: [
        {
          name: 'ASPNETCORE_ENVIRONMENT'
          value: 'Production'
        }
        {
          name: 'ConnectionStrings__Pilotage'
          value: chaineConnexion
        }
        {
          name: 'Cors__OriginesAutorisees__0'
          value: urlFront
        }
      ]
    }
  }
  dependsOn: [
    base
    pareFeuAzure
  ]
}

// ---------- Sorties lues par le pipeline (aucun secret) ----------
output nomApi string = api.name
output urlApi string = 'https://${api.properties.defaultHostName}'
output nomStockage string = stockage.name
output urlFront string = urlFront
output hotePostgres string = postgres.properties.fullyQualifiedDomainName
output nomBase string = nomBase
output postgresAdminLogin string = postgresAdminLogin
