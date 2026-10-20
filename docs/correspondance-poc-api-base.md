# Correspondance POC ↔ écrans ↔ API ↔ base de données

Pour chaque écran du POC v65 repris dans l'application : où il se trouve dans l'interface, quels appels il fait, et quelles tables il lit ou modifie.
Toutes les adresses de l'API commencent par `/api/projets/{id}`. Toutes les saisies renvoient le suivi recalculé (`ResultatSaisie`).

## Lecture

| Quoi | API | Tables lues |
|---|---|---|
| Tout le suivi d'un projet (saisies, résultats du moteur, droits) | `GET /suivi` | toutes les tables du projet, puis calcul par le moteur ; `FiltreMontants` pour un consultant ou un lecteur |

## Écrans et saisies

| Onglet du POC | Écran (`features/suivi/…`) | Saisies (API) | Tables modifiées |
|---|---|---|---|
| Tableau de bord, « À traiter » | `pages/tableau-de-bord.ts` | aucune (liens vers les autres écrans) | — |
| Workload › Liste des tâches | `pages/workload-liste.ts` | `PUT taches/{uid}/statut`, `…/avancement`, `…/reste-a-faire`, `…/classement`, `…/commentaire` ; `POST taches` (nouvelle tâche) | `Taches`, `ChargesTache`, `Axes`, `Phases`, `TypesTache`, `EvolutionsPerimetre`, `Journal` |
| Workload › Saisie du consommé | `pages/workload-conso.ts` | `PUT taches/{uid}/consomme` | `Consommes`, `Taches` (statut), `Journal` |
| Workload › Optimisation IA | `pages/workload-ia.ts` | `PUT taches/{uid}/bilan-ia` | `Taches`, `Journal` |
| Détail d'une tâche (panneau) | `panneaux/panneau-tache.ts` | les saisies ci-dessus, plus `…/dates`, `…/libelle`, `…/echeance`, `POST/PUT/DELETE taches/{uid}/profils…`, `POST/DELETE taches/{uid}/annulation`, `POST taches/{uid}/reaffectations`, `DELETE taches/{uid}/reaffectations/{id}`, `DELETE taches/{uid}` | `Taches`, `ChargesTache`, `ProfilsProjet` (nouveau profil), `EvolutionsPerimetre`, `Decisions` (annulation enregistrée en décision), `Journal` |
| Détail d'une phase (panneau) | `panneaux/panneau-phase.ts` | `PUT phases/{code}/echeance` | `LiensEcheancePhase`, `Taches`, `Journal` |
| Gantt | `pages/gantt.ts` | aucune (ouvre le détail) | — |
| Ateliers & livrables | `pages/ateliers.ts` | `PUT taches/{uid}/atelier/date`, `…/horaire`, `…/invitation`, `…/invitation/date`, `…/destinataires`, `PUT taches/{uid}/livrable` | `Ateliers`, `Destinataires`, `Livrables`, `Taches` (dates prévues), `Journal` |
| Actions & décisions (et risques) | `pages/actions.ts` | `POST/PUT/DELETE actions…` (et `…/restaurer`), `decisions…`, `risques…` | `Actions`, `Decisions`, `Risques`, `Journal` |
| Plan de charge | `pages/plan-de-charge.ts` | aucune | — |
| Facturation | `pages/facturation.ts` | `PUT echeances/{n}/dates`, `PUT echeances/{n}/perimetre` | `Echeances`, `LiensEcheancePhase`, `Taches` (échéance liée), `Journal` |
| Achats | `pages/depenses.ts` (`Achats`) | `POST/PUT/DELETE achats…` | `AchatsReels`, `Journal` (lecture : `BudgetsAchat`) |
| Frais | `pages/depenses.ts` (`Frais`) | `POST/PUT/DELETE frais…` | `FraisReels`, `Journal` (lecture : `BudgetsFrais`) |
| TSP › Fiche | `pages/tsp.ts` (`Fiche`) | `PUT fiche` (client, projet, référence) | `Projets`, `ChampsFiche`, `Journal` |
| TSP › Synthèse, Profils, Chiffrage | `pages/tsp.ts`, `pages/chiffrage.ts` | aucune (le vendu n'est jamais modifié) | — |
| Annexes › Planning, Métrique, Ventilation | `pages/tsp.ts` | aucune | — |
| ⚙ Paramètres du projet | `pages/parametres.ts` | `PUT parametres/regroupement`, `…/alertes`, `…/profil-ia`, `…/leviers-ia`, `…/causes-ia`, `…/dates`, `PUT axes/{code}/nom`, `POST/PUT/DELETE types…` | `Projets` (réglages), `Axes`, `TypesTache`, `Taches` (type supprimé), `ValeursListeIa`, `ProfilsProjet` (profil IA), `Journal` |
| Rentabilité (nouveau) | `pages/rentabilite.ts` | aucune (le simulateur n'enregistre rien) | — |
| Gantt › planning de référence (nouveau) | `pages/gantt.ts` | `POST references` (figer), `PUT references/{refId}/taches/{uid}/derive` (cause, motif) | `PlansReference`, `LignesPlanReference`, `Journal` |
| Détail d'une tâche › document livré (nouveau) | `panneaux/panneau-tache.ts` | `PUT taches/{uid}/livrable/lien` | `Livrables` (`LienStockage`), `Journal` |
| Détail d'une tâche › mises à jour (nouveau) | `panneaux/panneau-tache.ts` | `POST taches/{uid}/mises-a-jour` (chef de projet et consultant) | `MisesAJourTache` |
| Point hebdo (remplace la capture datée du tableau de bord) | `pages/point-hebdo.ts` | `PUT points-hebdo/semaines/{lundi}`, `PUT points-hebdo/mois/{AAAA-MM}`, `PUT points-hebdo/reglages/{champ}` | `PointsHebdo`, `Journal` |
| Planning, prévisionnel, absences | `pages/planning.ts`, `pages/plan-de-charge.ts`, `pages/absences.ts` | lecture : `GET /suivi` ; écritures : `PUT planning/dates`, `POST planning/dates/effacer`, `PUT planning/sous-parties/nom`, `POST/PUT/DELETE planning/jalons`, `PUT planning/elements`, `POST planning/elements/retirer`, `PUT previsionnel`, `POST previsionnel/reinitialiser`, `PUT absences`, `POST/DELETE personnes`, `PUT parametres/instances` | `PrevisionnelsProfil`, `DatesPlanning`, `Jalons`, `ElementsPlanning`, `Absences`, `PersonnesAjoutees`, `Projets.Parametres.Instances` |
| Portefeuille (nouveau, hors projet) | `features/portefeuille/portefeuille.ts` | aucune ; lecture `GET /api/projets` | — |
| Mon travail › absences personnelles | `features/travail/mon-travail.ts` | `GET /api/moi/absences?du=…&au=…`, `PUT /api/moi/absences` | `Absences` (filtrées sur l'identité courante, avec fallback uniquement sur les saisies non liées à un compte) |
| Mon travail (nouveau, hors projet) | `features/travail/mon-travail.ts` | `PUT taches/{uid}/consomme` sur chaque projet ; lecture `GET /api/projets` puis `GET /suivi` de chaque projet actif | `Consommes`, `Journal` |
| ⚙ Paramètres du projet › Le projet (nouveau) | `pages/parametres.ts` | `PUT /api/projets/{id}/archivage`, `POST /api/projets/{id}/suppression` | `Projets` (statut), `Journal` ; suppression : toutes les tables du projet |
| Exporter › COPIL / COPROJ | `projet-suivi.ts`, `fenetres/export-reperes.ts` | `POST exports/copil`, `POST exports/coproj` | `PhotosIndicateurs` (photo des indicateurs du comité), `Projets` (dernier COPROJ), `Journal` |

## Ce qui reste dans le navigateur (jamais en base)

Préférences d'affichage propres à chaque personne, comme dans le POC : onglet et sous-vue ouverts, filtres, colonnes masquées, cartes repliées, avertissements d'import masqués (`pilotageForfaits.suivi.ui.v1`), la liste de types de tâches proposée par défaut aux prochains imports (`pilotageForfaits.typesParDefaut.v1`) la date de dernière lecture des notifications de « Mon travail » (`pilotageForfaits.travail.vu`) et les menus affichés dans la barre latérale (Paramètres de l'application : `pilotageForfaits.preferences.v1`).
