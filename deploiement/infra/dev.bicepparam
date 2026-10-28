// Paramètres de l'environnement de développement (groupe de ressources RG-AstroLabe-Dev).
using './main.bicep'

param environnement = 'dev'

// Lu dans la variable secrète POSTGRES_ADMIN_PASSWORD du pipeline : jamais écrit ici.
param postgresAdminPassword = readEnvironmentVariable('POSTGRES_ADMIN_PASSWORD')
