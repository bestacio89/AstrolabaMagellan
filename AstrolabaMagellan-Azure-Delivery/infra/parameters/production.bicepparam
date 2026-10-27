using '../main.bicep'

param location = 'westeurope'
param environmentName = 'production'
param keyVaultName = 'REPLACE_WITH_UNIQUE_PRODUCTION_KEYVAULT_NAME'
param postgresServerName = 'REPLACE_WITH_UNIQUE_PRODUCTION_POSTGRES_NAME'
param postgresAdminLogin = 'astrolabaadmin'
param postgresAdminPassword = readEnvironmentVariable('ASTROLABA_POSTGRES_ADMIN_PASSWORD')
param postgresDatabaseName = 'pilotageforfaits'
param frontendAppName = 'REPLACE_WITH_UNIQUE_PRODUCTION_FRONTEND_NAME'
param backendAppName = 'REPLACE_WITH_UNIQUE_PRODUCTION_BACKEND_NAME'
param appServicePlanSku = 'P1v3'
param postgresSkuName = 'Standard_D2ds_v5'
param postgresStorageSizeGB = 128
param vnetAddressPrefix = '10.52.0.0/16'
param appIntegrationSubnetPrefix = '10.52.1.0/24'
param privateEndpointSubnetPrefix = '10.52.2.0/24'
