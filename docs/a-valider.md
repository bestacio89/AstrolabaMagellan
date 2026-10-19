# Points à valider avec l'équipe technique

Hypothèses retenues pour générer le dépôt. Chacune se change facilement : l'endroit à modifier est indiqué.

## Versions

| Élément | Hypothèse | Où la changer |
|---|---|---|
| Angular | 21 | `frontend/package.json` |
| TypeScript | 5.9 | `frontend/package.json` |
| Tests de l'interface | Vitest (outil par défaut d'Angular 21) | `frontend/angular.json` |
| .NET | 10 (LTS, supporté jusqu'à fin 2028) | `backend/global.json`, `backend/Directory.Build.props` |
| Entity Framework Core | 10 | `backend/Directory.Packages.props` |
| Base de données | SQL Server 2022 (ou Azure SQL) | `docker-compose.yml`, `Infrastructure/DependencyInjection.cs` |
| Connexion | Microsoft Entra ID, bibliothèques MSAL (`@azure/msal-browser`) et `Microsoft.Identity.Web` | `frontend/src/environments`, `appsettings.json` |
| Intégration continue | GitHub Actions **et** Azure DevOps fournis : garder celui qui est retenu | `.github/workflows/ci.yml`, `azure-pipelines.yml` |

## Entra ID (avec l'administrateur de l'annuaire)

1. Inscrire **l'API** : exposer une autorisation `acces` (adresse `api://<id-api>/acces`) et déclarer les rôles d'application `ChefDeProjet`, `Pilotage`, `Administrateur`.
2. Inscrire **l'interface** (application monopage) : adresse de retour = adresse de l'application ; autorisation déléguée sur `api://<id-api>/acces`.
3. Attribuer les rôles aux personnes ou aux groupes.
4. Renseigner : `appsettings.json` (section `AzureAd`) côté API, `environment.ts` côté interface.

## Environnements et hébergement (avec l’équipe d’hébergement)

- Développement, recette, production : où héberger l'API, l'interface et la base ?
- Chaîne de connexion et secrets : fournis par l'hébergement (variables d'environnement ou coffre de secrets), jamais dans le dépôt.
- Stockage des TSP importés : le fichier n'est pas conservé aujourd'hui (seules ses données le sont). À décider.

## Fonctionnel (avec les chefs de projet)

- **Droits exacts par rôle**, en particulier la visibilité des montants pour les consultants. Choix actuel : consultant = saisie du consommé seulement, sans aucun montant ; lecteur = lecture sans montants ; pilotage = lecture avec montants et exports.
- **Consultant et « son » profil** : aujourd'hui un consultant peut saisir le consommé de tous les profils de son projet (rien ne relie encore une personne à son profil). La colonne existe (`ProfilsProjet.UtilisateurId`) ; il manque l'écran d'administration qui la renseigne. Une fois fait, la règle « il ne saisit que son consommé » s'ajoute en une ligne dans `SaisiesTachesService.SaisirConsommeAsync`.
- **Montants cités dans un texte libre** : pour un consultant ou un lecteur, le serveur retire les montants des commentaires (ex. « coût évité 1 200 € » écrit par l'application à l'annulation d'une tâche) et les entrées du journal qui portent sur l'argent. Un montant écrit à la main dans un autre champ libre (motif, hypothèse…) n'est pas détecté.
- **Mode sombre** du POC : non repris (une seule apparence, claire). À confirmer.
- Un collaborateur de profil doit-il toujours correspondre à un utilisateur (alertes e-mail, saisie de son propre temps) ?
- Réimport d'un TSP modifié (avenant) : **décidé, ce n'est pas un nouveau projet** (même numéro d'opportunité = même forfait, voir « Unicité des projets » dans `regles-metier.md`). Reste à définir comment une nouvelle version du TSP met à jour le vendu du projet existant (avec les chefs de projet).
- **Identité d'un projet** : le numéro d'opportunité (« OP » suivi de chiffres) est cherché dans la référence de la proposition. À confirmer : ce numéro figure-t-il toujours dans les TSP, et sous cette forme ? Règle dans `backend/src/PilotageForfaits.Domain/Commun/IdentiteProjet.cs`.
- Durée de conservation du journal et des projets archivés.
- **Lien personne ↔ compte** : « Mon travail » relie aujourd'hui une personne à ses tâches par son nom (prénom et nom saisis comme collaborateur d'un profil, ou porteur d'une action). C'est fiable si les noms sont écrits en entier ; un écran d'administration pour relier chaque profil à un compte (`ProfilsProjet.UtilisateurId`) rendra le lien exact. Le seul fichier à changer côté interface : `features/travail/travail.logique.ts`.
- **Notifications par e-mail ou Teams** : elles sont dans l'application pour l'instant. L'envoi demande un compte d'envoi (SMTP) ou une autorisation Microsoft Graph, à décider avec l'hébergement (Matthieu). La table `Notifications` existe déjà.
- **Import des frais réels** : le format du fichier de suivi des frais (ou de l'export des frais validés) est à fournir pour écrire l'import.
- Seuils de lecture de l'atterrissage sur la page d'accueil (« Dans la cible », « À surveiller »…) : `frontend/src/app/shared/format/formats.ts`.
- TSP de test : ce sont des copies **anonymisées** de deux TSP réels (noms des personnes et du client remplacés). Vérifier que leur présence dans le dépôt est acceptable ; sinon, les remplacer par des TSP fictifs (`outils/reference-poc/anonymise.py`).
- **Brouillons de projet** (07/10/2026) : à confirmer avec les chefs de projet —
  - un planning mensuel qui ne retombe pas sur le workload est un *conseil*, pas un blocage (même tolérance qu'à l'import d'un TSP) ;
  - un échéancier vide ou différent de 100 % *bloque* le lancement ;
  - le co-rédacteur suit le projet lancé en lecture, montants compris (rôle Pilotage) ;
  - l'export Excel est un .xlsx sans les macros du modèle : si les macros servent, fournir le modèle de TSP vierge ;
  - « Créer un projet vide » disparaît de l'interface (remplacé par « Rédiger le TSP ») ; le point d'API reste pour les tests.

## Rattrapage de la version HTML (19/10/2026)

- Deux jalons à la même date sont départagés par leur libellé sans accents ni majuscules (ordre des codes) ; la version HTML compare à la française. L'ordre ne peut différer que pour deux libellés accentués à la même date.
