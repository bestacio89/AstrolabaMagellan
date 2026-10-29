# Déploiement Azure privé — AstrolabaMagellan

## Objectif

Ce dossier fournit une base d'infrastructure et de pipelines Azure DevOps pour déployer le frontend Angular et l'API .NET 10, avec PostgreSQL Flexible Server, Key Vault et des points de terminaison privés. Il s'agit d'un modèle à adapter et à valider dans l'abonnement cible, pas d'une preuve qu'un déploiement a déjà été exécuté.

## Architecture visée

- Un réseau virtuel Azure avec un sous-réseau dédié à l'intégration VNet d'App Service et un sous-réseau dédié aux Private Endpoints.
- Deux App Services Linux : frontend Angular et backend ASP.NET Core.
- Des Private Endpoints pour les deux App Services, PostgreSQL et Key Vault.
- DNS privé pour `privatelink.azurewebsites.net`, `privatelink.postgres.database.azure.com` et `privatelink.vaultcore.azure.net`.
- PostgreSQL Flexible Server avec accès réseau public désactivé, authentification par mot de passe à ce stade et sauvegardes configurées.
- Key Vault avec RBAC, soft delete, protection contre la purge et accès public désactivé.
- Identité managée du backend avec le rôle `Key Vault Secrets User`.

## Prérequis impératifs

1. Un abonnement Azure et des droits suffisants pour créer le réseau, les App Services, les Private Endpoints, PostgreSQL, Key Vault et les attributions RBAC. L'identité de service Azure DevOps doit aussi pouvoir écrire les secrets Key Vault et déployer les ressources/attributions de rôles.
2. Une connexion Azure DevOps vers Azure configurée en priorité avec Workload Identity Federation (OIDC), pas un secret client permanent.
3. Un agent Azure DevOps auto-hébergé situé dans le VNet ou dans un réseau connecté par VPN/ExpressRoute. Un agent Microsoft hébergé ne peut pas atteindre les endpoints privés.
4. Une connectivité VPN/ExpressRoute depuis le réseau des utilisateurs et une résolution DNS privée correctement configurée.
5. Des noms globaux uniques pour les ressources Azure.
6. Des plages CIDR qui ne chevauchent ni le réseau d'entreprise ni les réseaux VPN existants.

## Fichiers

- `azure-pipelines-ci.yml` : validation PR, compilation/tests .NET et Angular, validation Bicep.
- `azure-pipelines-deploy.yml` : déploiement manuel, what-if, déploiement infra, création automatique des secrets et du rôle PostgreSQL, migration et déploiement applicatif, smoke tests.
- `infra/main.bicep` : ressources Azure.
- `infra/parameters/test.bicepparam` et `production.bicepparam` : paramètres par environnement. Remplacer tous les noms `REPLACE_WITH_...`.
- `scripts/resolve-postgres-admin-password.sh` : réutilise le secret administrateur existant ou génère un mot de passe uniquement lors d'une première création.
- `scripts/provision-postgres-secrets.sh` : enregistre les secrets dans Key Vault, crée/met à jour le compte PostgreSQL applicatif et génère la chaîne Npgsql.
- `scripts/deploy-application.sh` : publication, migration EF Core et déploiement des deux applications.
- `scripts/verify-private-networking.sh` : vérifications DNS/TLS/health depuis le réseau privé.
- `scripts/check-prerequisites.sh` : vérification des outils installés.

## Sécurité des secrets

Ne jamais enregistrer le mot de passe PostgreSQL ni la chaîne de connexion dans Git, dans un fichier `.bicepparam`, ou dans les logs de pipeline. Le pipeline gère automatiquement les secrets : lors du premier déploiement, il génère un mot de passe administrateur aléatoire, puis stocke `AstrolabaPostgresAdminPassword` dans Key Vault. Lors des exécutions suivantes, il réutilise ce secret au lieu de réinitialiser le mot de passe du serveur. Si un premier déploiement partiel a créé PostgreSQL sans enregistrer le secret, l’étape de déploiement (pas le `what-if`) régénère et réinitialise le mot de passe, puis l’enregistre dans Key Vault.

Après la création de l'infrastructure, le pipeline récupère le FQDN PostgreSQL depuis Azure et crée/met à jour le compte `astrolaba_app` avec des droits limités aux opérations applicatives. Le pipeline exécute les migrations avec le compte administrateur ; le compte applicatif n'est pas propriétaire des objets de la base. Il enregistre ensuite `AstrolabaPostgresApplicationPassword` et `AstrolabaPostgresConnectionString` dans Key Vault. Aucun secret n'est passé dans les sorties Bicep ni affiché dans les logs. Les mots de passe générés respectent les catégories de complexité Azure PostgreSQL. Le backend utilise la référence Key Vault dans `ConnectionStrings__Pilotage`.

Le compte applicatif est distinct du compte administrateur. Le pipeline exécute les migrations avec l'identité administrateur ; le compte `astrolaba_app` reçoit uniquement les droits DML sur les tables et l'usage des séquences. Les privilèges par défaut couvrent les tables et séquences créées par les migrations futures. La chaîne utilise le FQDN PostgreSQL normal, résolu en IP privée, et `SSL Mode=VerifyFull`.

## Étapes manuelles obligatoires avant le premier déploiement

1. Confirmer les chemins de projets, le DbContext, l'assembly de migrations EF Core et les commandes Angular réels dans le dépôt. Le script utilise des chemins attendus, qui peuvent nécessiter un ajustement.
2. Adapter le routage API Angular. L'application Angular utilise actuellement des URL relatives `/api`. Deux App Services séparés ne partagent pas automatiquement la même origine HTTP. Choisir une solution explicite : (a) un reverse proxy/BFF accessible via le frontend, ou (b) une URL d'API privée absolue et une politique CORS limitée à l'origine du frontend. Le modèle ne configure pas un reverse proxy.
3. Déployer d'abord en environnement de test. Examiner entièrement le résultat de `what-if` avant toute application.
4. Le pipeline crée automatiquement les secrets Key Vault et le rôle PostgreSQL applicatif après le déploiement Bicep. L'agent privé doit disposer de `psql`, `openssl`, Azure CLI, d'un accès DNS/réseau privé au serveur et de droits Key Vault pour créer/modifier les secrets. Aucune saisie manuelle de chaîne de connexion n'est requise.
5. Vérifier que les App Services, Key Vault et PostgreSQL sont réellement accessibles uniquement via les Private Endpoints. Les paramètres de contrôle d'accès doivent être inspectés dans Azure après déploiement.
6. Configurer les approbations et contrôles sur les environnements Azure DevOps `Astrolaba-production-Infrastructure` et `Astrolaba-production` dans l'interface Azure DevOps. Les approbations ne sont pas garanties par le YAML seul.
7. Valider le comportement de migration sur une copie de base avant la production, et prévoir sauvegarde, restauration et stratégie de rollback.

## Notes techniques importantes

- PostgreSQL Flexible Server a des modèles réseau distincts. Ce modèle choisit Private Link / Private Endpoint et désactive l'accès public. Il ne choisit pas l'injection directe du serveur dans un sous-réseau délégué, car ce modèle est différent et ne se combine pas avec Private Endpoint.
- Le sous-réseau d'intégration App Service doit être distinct du sous-réseau Private Endpoint.
- Les App Services privés nécessitent une connectivité privée vers leurs endpoints, y compris le site SCM/Kudu utilisé pour certaines opérations de déploiement. Tester la méthode de déploiement depuis l'agent privé.
- L'accès privé aux App Services signifie qu'un navigateur hors réseau d'entreprise/VPN ne pourra pas ouvrir l'application. C'est intentionnel pour le besoin interne.
- Le script de smoke test suppose que l'API expose `/health`. Modifier ce chemin si l'API expose un autre endpoint ou si l'endpoint requiert une authentification.
- Le rôle `Key Vault Secrets User` est accordé à l'identité managée du backend. Si l'API utilise une autre identité ou un autre coffre, ajuster le RBAC.
- La disponibilité zonale et les SKU PostgreSQL dépendent de la région et des capacités du service. Vérifier les SKU réellement disponibles dans la région avant production.

## Documentation Microsoft

- App Service Private Endpoint : https://learn.microsoft.com/azure/app-service/overview-private-endpoint
- App Service VNet Integration : https://learn.microsoft.com/azure/app-service/overview-vnet-integration
- PostgreSQL Flexible Server Private Link : https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-networking-private-link
- Désactiver l'accès public PostgreSQL : https://learn.microsoft.com/en-us/azure/postgresql/network/how-to-networking-servers-deployed-public-access-disable-public-access
- Key Vault réseau privé : https://learn.microsoft.com/azure/key-vault/general/private-link-service
- Azure DevOps approvals/checks : https://learn.microsoft.com/azure/devops/pipelines/process/approvals


## Retour arrière et reprise

- Le pipeline publie les ZIP générés dans l'artefact `deployment-packages-<BuildId>`, y compris en cas d'échec si le répertoire de paquets existe. Conserver les exécutions réussies selon la politique de rétention.
- Pour revenir au code applicatif précédent, récupérer les ZIP backend et frontend de la dernière exécution saine et les redéployer sur les App Services correspondants depuis l'agent privé, puis relancer les smoke tests.
- Les migrations PostgreSQL ne sont pas annulées automatiquement. En production, privilégier des migrations additives/expand-contract. Si une reprise de schéma ou de données est nécessaire, restaurer PostgreSQL vers un **nouveau** serveur via la restauration à un instant donné, valider la base restaurée, puis planifier le changement de connexion. Le redéploiement d'un ancien binaire ne restaure pas la base.
- Avant la production, exécuter un exercice chronométré de restauration et documenter les objectifs RPO/RTO. La présence de sauvegardes ne prouve pas que la restauration fonctionne.
