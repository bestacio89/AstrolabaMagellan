# Déployer Astrolabe sur Azure (environnement de développement)

Ce dossier crée l'hébergement d'Astrolabe dans le groupe de ressources **RG-AstroLabe-Dev** (abonnement Nantes-Demo), puis y installe l'application. Tout passe par un seul pipeline Azure DevOps, lancé à la main.

| Élément | Ressource Azure | Rôle |
|---|---|---|
| Base de données | Azure Database for PostgreSQL – Flexible Server (Burstable B1ms, 32 Go) | données de l'application |
| API (backend .NET 10) | App Service Linux (plan B1) | `https://app-astrolabe-api-dev-xxxxxx.azurewebsites.net` |
| Interface (Angular) | Storage Account, site web statique | `https://stastrolabedevxxxxxx.zN.web.core.windows.net` |

Coût indicatif : quelques dizaines d'euros par mois pour l'ensemble (à confirmer avec la calculatrice de prix Azure).

## Fichiers

| Fichier | Contenu |
|---|---|
| `infra/main.bicep` | description des trois ressources (et de la base, du pare-feu, des réglages de l'API) |
| `infra/dev.bicepparam` | paramètres de l'environnement de développement |
| `azure-pipelines-deploiement.yml` | le pipeline : ressources → compilation → migrations, API, interface → vérification |

Le pipeline utilise la service connection **sc-azurerm-astrolabe** (identité *Astrolabe.Deployment*, rôle **Contributeur** sur RG-AstroLabe-Dev).

## Mise en place (une seule fois)

### 1. Créer le pipeline

1. Azure DevOps › **Pipelines** › **New pipeline** (ou *Create Pipeline*).
2. **Azure Repos Git** › dépôt **Astrolabe**.
3. **Existing Azure Pipelines YAML file** › branche `main` › chemin `/deploiement/azure-pipelines-deploiement.yml` › **Continue**.
4. Ne lancez pas encore : ouvrez la flèche à côté de **Run** › **Save**.

### 2. Créer le mot de passe de la base (variable secrète)

1. Sur la page du pipeline : **Edit** › **Variables** (en haut à droite) › **New variable**.
2. Nom : `POSTGRES_ADMIN_PASSWORD`.
3. Valeur : un mot de passe d'au moins 16 caractères, avec majuscules, minuscules, chiffres et au moins un `-` ou `_`. **Pas de** `;` `'` `"` `$` ni d'espace (ils casseraient la chaîne de connexion).
4. Cochez **Keep this value secret** › **OK** › **Save**.

Ce mot de passe n'est écrit nulle part ailleurs : gardez-le dans votre coffre de mots de passe. Il doit rester le même d'une exécution à l'autre (le changer ici change aussi celui du serveur au déploiement suivant).

### 3. Lancer

**Run pipeline** › **Run**. Au premier lancement, Azure DevOps peut afficher « This pipeline needs permission to access a resource » : **View** › **Permit** (autorise le pipeline à utiliser sc-azurerm-astrolabe).

Comptez 15 à 25 minutes la première fois (la création de PostgreSQL est la plus longue), quelques minutes ensuite. À la fin, l'étape « Vérifier que l'API et l'interface répondent » affiche les deux adresses.

### 4. Autoriser la connexion depuis l'interface (Entra ID)

L'interface se connecte avec le compte de l'entreprise. Il faut déclarer son adresse dans l'application Entra ID **APP-ExakisNeliteNantes-Astrolabe-Frontend** (`a45e69e5-…`) :
**Authentication** › plateforme **Single-page application** › **Add URI** › l'adresse de l'interface affichée à la fin du pipeline (ex. `https://stastrolabedevxxxxxx.z6.web.core.windows.net`).

Sans cela, la connexion échoue avec une erreur « redirect URI mismatch ». Cette modification se fait dans le tenant où sont enregistrées les applications (celui de `AzureAd:TenantId`), par une personne qui a les droits sur l'application.

## Ensuite

Chaque nouveau lancement remet les ressources à l'identique, applique les nouvelles migrations, puis redéploie l'API et l'interface. Pour déployer automatiquement à chaque push sur `main`, voir l'en-tête du fichier YAML.

## Ce que le pipeline modifie dans le code, et pourquoi

- **Adresse de l'API** : l'interface et l'API sont à deux adresses différentes. Au moment de la compilation, le pipeline remplace `api: '/api'` par l'adresse de l'API dans `frontend/src/environments/environment.ts` (sur l'agent seulement, rien n'est modifié dans Git).
- **CORS** : `Program.cs` autorise l'interface à appeler l'API, à partir du réglage `Cors:OriginesAutorisees` (renseigné par `main.bicep`). Sans ce réglage (poste de développement, tests), rien ne change.

## Simplifications de cet environnement de développement

À revoir avant une mise en production :
- l'API se connecte à la base avec le compte administrateur et un mot de passe (prochaine étape : compte applicatif dédié, mot de passe dans Key Vault ou authentification Entra ID) ;
- PostgreSQL et l'API sont joignables depuis Internet, protégés par le pare-feu (services Azure seulement) et par Entra ID ; pas de réseau privé ;
- pas de haute disponibilité ni de sauvegarde géo-redondante.

## En cas d'erreur

| Message | Que faire |
|---|---|
| `La variable secrète POSTGRES_ADMIN_PASSWORD n'existe pas` | Étape 2 ci-dessus. |
| `No hosted parallelism has been purchased or granted` | Demande gratuite à faire une fois auprès de Microsoft (formulaire « Azure DevOps Parallelism Request »), ou demander à l'administrateur de l'organisation. |
| PostgreSQL : `LocationIsOfferRestricted` ou région non disponible | Dans `infra/dev.bicepparam`, ajouter `param postgresLocation = 'francecentral'`. |
| Stockage : `KeyBasedAuthenticationNotPermitted` | Une stratégie de l'entreprise interdit les clés de stockage : voir avec l'architecte (dépôt par identité Entra et rôle *Storage Blob Data Contributor*). |
| Migrations : délai dépassé vers le serveur PostgreSQL | Vérifier dans le portail (serveur PostgreSQL › Mise en réseau) que la case « Autoriser l'accès public à partir de n'importe quel service Azure » est cochée. |
| `L'API ne répond pas` | Portail Azure › App Service › **Flux de journaux** : le message de démarrage de l'API y figure (configuration Entra ID, base, etc.). |
