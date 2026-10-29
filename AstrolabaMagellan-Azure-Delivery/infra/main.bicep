@description('Azure region. Keep all private networking resources in this region unless intentionally designed otherwise.')
param location string = resourceGroup().location
@description('Short environment label used in resource names.')
@allowed([
  'test'
  'production'
])
param environmentName string
@description('Globally unique lower-case name for the Azure Key Vault. Must be 3-24 alphanumeric characters.')
param keyVaultName string
@description('Globally unique name for the PostgreSQL Flexible Server.')
param postgresServerName string
@description('PostgreSQL administrator login. Use a dedicated non-human account.')
param postgresAdminLogin string
@secure()
@description('Supply through a protected pipeline variable/environment variable; never commit a real password.')
param postgresAdminPassword string
@description('Database name used by the application.')
param postgresDatabaseName string = 'pilotageforfaits'
@description('Unique globally available App Service names, lowercase letters/numbers/hyphens.')
param frontendAppName string
param backendAppName string
@description('App Service Plan SKU. PremiumV3 supports production networking features.')
param appServicePlanSku string = 'P1v3'
@description('PostgreSQL compute SKU; select a supported SKU for the chosen region.')
param postgresSkuName string = 'Standard_D2ds_v5'
@description('PostgreSQL storage size in GB.')
@minValue(32)
param postgresStorageSizeGB int = 128
@description('Virtual network CIDR. Must not overlap with corporate/VPN networks.')
param vnetAddressPrefix string = '10.42.0.0/16'
param appIntegrationSubnetPrefix string = '10.42.1.0/24'
param privateEndpointSubnetPrefix string = '10.42.2.0/24'

var suffix = environmentName == 'production' ? 'prd' : 'tst'
var vnetName = 'vnet-astrolaba-${suffix}'
var appPlanName = 'asp-astrolaba-${suffix}'
var privateDnsPostgresName = 'privatelink.postgres.database.azure.com'
var privateDnsWebName = 'privatelink.azurewebsites.net'
var privateDnsVaultName = 'privatelink.vaultcore.azure.net'
var backendHost = '${backendAppName}.azurewebsites.net'

resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: { addressPrefixes: [vnetAddressPrefix] }
    subnets: [
      {
        name: 'snet-appservice-integration'
        properties: {
          addressPrefix: appIntegrationSubnetPrefix
          delegations: [
            {
              name: 'appServiceDelegation'
              properties: { serviceName: 'Microsoft.Web/serverFarms' }
            }
          ]
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
      {
        name: 'snet-private-endpoints'
        properties: {
          addressPrefix: privateEndpointSubnetPrefix
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

resource appSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' existing = {
  parent: vnet
  name: 'snet-appservice-integration'
}
resource peSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' existing = {
  parent: vnet
  name: 'snet-private-endpoints'
}

resource appPlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: appPlanName
  location: location
  sku: { name: appServicePlanSku, tier: 'PremiumV3', capacity: 1 }
  kind: 'linux'
  properties: { reserved: true }
}

resource backendApp 'Microsoft.Web/sites@2024-04-01' = {
  name: backendAppName
  location: location
  kind: 'app,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: appPlan.id
    httpsOnly: true
    publicNetworkAccess: 'Disabled'
    virtualNetworkSubnetId: appSubnet.id
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|10.0'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      appSettings: [
        { name: 'ASPNETCORE_ENVIRONMENT', value: environmentName == 'production' ? 'Production' : 'Staging' }
        { name: 'WEBSITE_VNET_ROUTE_ALL', value: '1' }
        { name: 'ConnectionStrings__Pilotage', value: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}.vault.azure.net/secrets/AstrolabaPostgresConnectionString/)' }
      ]
    }
  }
  dependsOn: [vnet]
}

resource frontendApp 'Microsoft.Web/sites@2024-04-01' = {
  name: frontendAppName
  location: location
  kind: 'app,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: appPlan.id
    httpsOnly: true
    publicNetworkAccess: 'Disabled'
    virtualNetworkSubnetId: appSubnet.id
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      appCommandLine: 'pm2 serve /home/site/wwwroot --no-daemon --spa'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        { name: 'WEBSITE_VNET_ROUTE_ALL', value: '1' }
        { name: 'PORT', value: '8080' }
      ]
    }
  }
  dependsOn: [vnet]
}

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: 'Disabled'
    networkAcls: { bypass: 'AzureServices', defaultAction: 'Deny' }
    accessPolicies: []
  }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: postgresServerName
  location: location
  properties: {
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    version: '16'
    storage: { storageSizeGB: postgresStorageSizeGB, autoGrow: 'Enabled', tier: 'P10' }
    sku: { name: postgresSkuName, tier: 'GeneralPurpose' }
    backup: { backupRetentionDays: 14, geoRedundantBackup: 'Disabled' }
    network: { publicNetworkAccess: 'Disabled' }
    authConfig: { activeDirectoryAuth: 'Disabled', passwordAuth: 'Enabled', tenantId: subscription().tenantId }
    highAvailability: { mode: environmentName == 'production' ? 'ZoneRedundant' : 'Disabled' }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: postgresDatabaseName
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

resource dnsPostgres 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: privateDnsPostgresName
  location: 'global'
}
resource dnsWeb 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: privateDnsWebName
  location: 'global'
}
resource dnsVault 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: privateDnsVaultName
  location: 'global'
}

resource postgresDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: dnsPostgres
  name: 'link-${vnetName}'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: vnet.id } }
}
resource webDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: dnsWeb
  name: 'link-${vnetName}'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: vnet.id } }
}
resource vaultDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: dnsVault
  name: 'link-${vnetName}'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: vnet.id } }
}

resource backendPe 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: 'pe-${backendAppName}'
  location: location
  properties: {
    subnet: { id: peSubnet.id }
    privateLinkServiceConnections: [
      { name: 'backend-site', properties: { privateLinkServiceId: backendApp.id, groupIds: ['sites'] } }
    ]
  }
}
resource frontendPe 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: 'pe-${frontendAppName}'
  location: location
  properties: {
    subnet: { id: peSubnet.id }
    privateLinkServiceConnections: [
      { name: 'frontend-site', properties: { privateLinkServiceId: frontendApp.id, groupIds: ['sites'] } }
    ]
  }
}
resource vaultPe 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: 'pe-${keyVaultName}'
  location: location
  properties: {
    subnet: { id: peSubnet.id }
    privateLinkServiceConnections: [
      { name: 'key-vault', properties: { privateLinkServiceId: vault.id, groupIds: ['vault'] } }
    ]
  }
}
resource postgresPe 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: 'pe-${postgresServerName}'
  location: location
  properties: {
    subnet: { id: peSubnet.id }
    privateLinkServiceConnections: [
      { name: 'postgres-server', properties: { privateLinkServiceId: postgres.id, groupIds: ['postgresqlServer'] } }
    ]
  }
}

resource backendWebZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: backendPe
  name: 'default'
  properties: { privateDnsZoneConfigs: [{ name: 'web', properties: { privateDnsZoneId: dnsWeb.id } }] }
}
resource frontendWebZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: frontendPe
  name: 'default'
  properties: { privateDnsZoneConfigs: [{ name: 'web', properties: { privateDnsZoneId: dnsWeb.id } }] }
}
resource vaultZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: vaultPe
  name: 'default'
  properties: { privateDnsZoneConfigs: [{ name: 'vault', properties: { privateDnsZoneId: dnsVault.id } }] }
}
resource postgresZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: postgresPe
  name: 'default'
  properties: { privateDnsZoneConfigs: [{ name: 'postgres', properties: { privateDnsZoneId: dnsPostgres.id } }] }
}

resource backendVaultSecretsRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, backendApp.identity.principalId, 'KeyVaultSecretsUser')
  scope: vault
  properties: {
    principalId: backendApp.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
  }
}

output virtualNetworkId string = vnet.id
output frontendUrl string = 'https://${frontendAppName}.azurewebsites.net'
output backendUrl string = 'https://${backendAppName}.azurewebsites.net'
output postgresFqdn string = postgres.properties.fullyQualifiedDomainName
output databaseName string = postgresDatabaseName
output keyVaultUri string = vault.properties.vaultUri
output frontendPrincipalId string = frontendApp.identity.principalId
output backendPrincipalId string = backendApp.identity.principalId
