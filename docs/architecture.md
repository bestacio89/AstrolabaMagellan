# Architecture

## Principes

1. **Le vendu est figé, le suivi s'ajoute à côté.** Les données du TSP ne sont jamais modifiées après l'import.
2. **On stocke les saisies, jamais les résultats.** Reste à faire, atterrissage, marges, FAE… sont recalculés à chaque demande par le moteur. Seule exception voulue : la photo des indicateurs prise à chaque comité.
3. **Les calculs sont faits côté serveur**, par un moteur unique et testé. L'interface affiche, elle ne calcule pas.
4. **Rien ne se supprime sans trace.** Aucune suppression en cascade dans la base ; annulations et rétablissements sont des évolutions datées ; un journal garde l'historique.
5. **Chaque objet a un identifiant technique et un numéro de version.** La position d'un profil n'est plus une clé (c'était la fragilité du POC) ; deux modifications simultanées sont détectées au lieu de s'écraser.

## Les couches du serveur

| Couche | Projet | Contient | Dépend de |
|---|---|---|---|
| API | `PilotageForfaits.Api` | Contrôleurs REST, authentification (Entra ID ou utilisateurs de développement), traduction des erreurs en réponses HTTP, description OpenAPI | Application, Infrastructure (pour l'assemblage) |
| Application | `PilotageForfaits.Application` | Cas d'usage : lister les projets, créer un projet vide, importer un TSP, vue d'ensemble ; contrôle des droits (`ServiceAcces`) ; passage base ↔ moteur (`ConstructeurProjetCalcul`) | Domaine |
| Domaine | `PilotageForfaits.Domain` | Entités du modèle de données, règles métier, **moteur de calcul** (`Calcul/MoteurCalcul.cs`), **lecture du TSP** (`Tsp/InterpreteurTsp.cs`) | rien |
| Infrastructure | `PilotageForfaits.Infrastructure` | Base de données (EF Core + SQL Server), lecture des fichiers Excel (`Excel/ClasseurXlsx.cs`), horloge | Application |

Choix assumé pour rester simple : les services de l'Application utilisent directement les requêtes EF Core (via `IContexteDonnees`), sans couche « dépôt » supplémentaire.

## Flux principaux

**Importer un TSP**
`POST /api/projets/import-tsp` → `ImportTspService` → `LecteurTsp` (ouvre le classeur) → `InterpreteurTsp` (même lecture que le POC) → `ConvertisseurTsp` (objets du modèle) → enregistrement en une transaction ; l'importateur devient chef de projet. Un aperçu sans enregistrement existe : `POST /api/projets/import-tsp/apercu`.

**Afficher un projet**
`GET /api/projets/{id}` → contrôle d'accès → `ConstructeurProjetCalcul` (lit les saisies) → `MoteurCalcul.Calculer` → DTO. Les montants ne sont **jamais envoyés** à un rôle qui ne doit pas les voir (ils valent `null`).

**Suivre un projet (écrans du POC après l'import)**
`GET /api/projets/{id}/suivi` → contrôle d'accès → `ConstructeurProjetCalcul` + `MoteurCalcul` (résultats) et `ConstructeurVueSuivi` (saisies dans la forme du POC : identifiants, versions, ateliers, livrables, registres, journal) → `FiltreMontants` pour un rôle qui ne voit pas les montants → `{ projet, modele, droits, aujourdhui }`.
Chaque saisie (`PUT` / `POST` / `DELETE` sous `/api/projets/{id}/…`) passe par un service métier (`SaisiesTachesService`, `PerimetreService`, `AteliersLivrablesService`, `FacturationService`, `RegistresService`, `DepensesService`, `ParametresService`), qui contrôle les droits et la version, applique la règle, note la modification au journal et renvoie **le suivi recalculé** avec les messages à afficher (`ResultatSaisie`). L'écran n'a donc jamais à recalculer quoi que ce soit. Correspondance détaillée écran ↔ API ↔ tables : [correspondance-poc-api-base.md](correspondance-poc-api-base.md).

**Créer un projet vide (V1)**
`POST /api/projets` → `Projet.CreerVide` : la fiche seule, statut « En préparation ». Plus tard, la saisie du TSP dans l'application remplira les mêmes objets qu'un import : le modèle n'a pas à changer.

## Le moteur de calcul et sa vérification

Le moteur est la traduction fidèle de la fonction `compute` du POC v65 : mêmes noms d'entrée et de sortie, pour pouvoir comparer automatiquement.

```
outils/reference-poc/poc/core.js  ──(scenarios.cjs)──►  tests/Donnees/*.attendu.json
                                                               │ comparaison
tests/Donnees/*.entree.json ──► MoteurCalcul (C#) ─────────────┘   à 0,00001 près
```

Toute évolution d'une règle se fait donc en deux temps : on décrit le résultat attendu (scénario), puis on adapte le moteur jusqu'à ce que les tests repassent au vert.

## L'interface

- Angular récent : composants autonomes (sans NgModule), **signaux** pour l'état, nouvelle syntaxe de templates (`@if`, `@for`), détection de changements sans zone.js.
- `core/layout` : la **barre latérale** (accueil, rubriques du projet ouvert, accès rapide aux projets, repères, personne connectée) et `NavigationService`, par lequel l'écran de suivi publie les rubriques du projet ouvert et l'accueil la liste des projets.
- `features/projets` : page d'accueil « Mes projets », import d'un TSP, projet vide.
- `features/portefeuille` : le point du lundi (tous les projets actifs, depuis `GET /api/projets`).
- `features/travail` : « Mon travail » (ce qui est confié à la personne connectée sur tous ses projets, sa saisie de la semaine, ses notifications, calculées à partir du suivi de chaque projet).
- `shared/impression` : impression ou PDF d'une partie de l'écran (capture datée), règles dans `styles.scss` (« Impression »).
- `features/suivi` : le suivi d'un projet, chargé à la demande sous `/projets/:id/…` (un onglet = une route) :
  - `projet-suivi.ts` : cadre commun (fil d'Ariane, nom et repères du projet, actions, notifications, panneau de détail, fenêtres, messages) ; les rubriques sont dans la barre latérale ;
  - `pages/` : un écran par onglet (tableau de bord, workload, Gantt, ateliers et livrables, actions et décisions, plan de charge, facturation, achats, frais, fiche, synthèse, profils, chiffrage, annexes, paramètres) ;
  - `panneaux/` : détail d'une tâche et d'une phase ; `fenetres/` : nouvelle tâche, ajout de profil, annulation, bilan IA, achat, frais, lien d'échéance, export COPROJ, repères ;
  - `etat/` : `SuiviEtat` (suivi chargé, file d'enregistrement, messages, fenêtre ouverte), `UiEtat` (préférences d'affichage propres au navigateur), `vue.ts` (jointures d'affichage, sans calcul métier), formats ;
  - `ui/` : petits composants communs (cartes repliables, barres, graphiques SVG, fenêtre, ƒx « Calcul ») ;
  - `api/` : client et types de l'API du suivi.
- Apparence : un design system commun ([design-system.md](design-system.md)), défini par des jetons dans `src/styles.scss`. La feuille de style des écrans du suivi (`src/styles/suivi.css`, limitée à `.suivi`) part de celle du POC ; ses jetons pointent vers ceux de l'application et sa dernière section (« Refonte visuelle ») applique le design system. Le mode sombre du POC n'est pas repris.
- Les saisies sont envoyées **une par une, dans l'ordre** (file d'enregistrement) avec le numéro de version lu au moment de l'envoi ; en cas de conflit (409), le projet est rechargé.
- Les règles d'affichage sont des fonctions simples, testées sans navigateur (`*.logique.ts` + `*.spec.ts`).
- Le client API est écrit à la main pour l'instant ; il pourra être généré depuis `/openapi/v1.json`.

## Sécurité

- Connexion par compte d'entreprise (Microsoft Entra ID) : jeton porté par chaque appel, vérifié par l'API.
- Rôles globaux (dans Entra ID) : `ChefDeProjet` (peut créer des projets), `Pilotage` (voit tous les projets en lecture), `Administrateur`.
- Rôle sur un projet (habilitation, en base) : consultant, chef de projet, pilotage, lecteur. Un projet sans habilitation répond « introuvable » (on ne révèle pas son existence).
- La garde de route côté interface n'est qu'un confort : **la vraie protection est dans l'API**.

## Limites connues (à traiter quand le besoin se présentera)

- La liste des projets recalcule les indicateurs de chaque projet : suffisant pour quelques dizaines de projets ; au-delà, prévoir un cache invalidé à chaque saisie.
- Exports COPIL et COPROJ : produits par le serveur (`ExportComites`), réservés aux rôles qui voient les montants.
- « Mon travail » lit le suivi de chaque projet actif de la personne : suffisant pour une dizaine de projets par personne ; au-delà, prévoir un point d'entrée serveur `GET /api/moi/travail` (la logique de `travail.logique.ts` s'y transpose telle quelle).
- Un consultant peut saisir le consommé de **tous** les profils de son projet : le lien entre un utilisateur et « son » profil existe dans la base (`ProfilsProjet.UtilisateurId`) mais aucun écran ne le renseigne encore (voir `a-valider.md`).
