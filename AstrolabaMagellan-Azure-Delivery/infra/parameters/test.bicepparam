using '../main.bicep'

param location = 'westeurope'
param environmentName = 'test'
param keyVaultName = 'REPLACE_WITH_UNIQUE_KEYVAULT_NAME'
param postgresServerName = 'REPLACE_WITH_UNIQUE_POSTGRES_NAME'
param postgresAdminLogin = 'astrolabaadmin'
param postgresAdminPassword = readEnvironmentVariable('ASTROLABA_POSTGRES_ADMIN_PASSWORD')
param postgresDatabaseName = 'pilotageforfaits'
param frontendAppName = 'REPLACE_WITH_UNIQUE_FRONTEND_APP_NAME'
param backendAppName = 'REPLACE_WITH_UNIQUE_BACKEND_APP_NAME'
param appServicePlanSku = 'P1v3'
param postgresSkuName = 'Standard_D2ds_v5'
param postgresStorageSizeGB = 32
param vnetAddressPrefix = '10.42.0.0/16'
param appIntegrationSubnetPrefix = '10.42.1.0/24'
param privateEndpointSubnetPrefix = '10.42.2.0/24'
