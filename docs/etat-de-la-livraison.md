# État de la livraison (19/10/2026)

Ce dépôt a été préparé dans un environnement **sans accès aux registres de paquets** (npm et NuGet bloqués par la politique réseau) **et sans SDK .NET**. Ce qui a pu être vérifié avant la livraison, et ce qui reste à vérifier sur votre poste ou au premier passage de l'intégration continue :

| Élément | État |
|---|---|
| Résultats attendus du moteur (6 scénarios) et de la lecture des TSP (2 fichiers) | **Calculés par le moteur du POC lui-même**, reproductibles (`outils/reference-poc`) |
| Règles écrites à la main dans les tests (IA, RAF, échéances, journée maximale…) | **Vérifiées** une à une avec le moteur du POC |
| Interface Angular complète (accueil + tous les écrans du suivi) | **Compilée** avec le vrai compilateur Angular 21.3 en mode strict (templates compris) : 0 erreur |
| Rendu et comportement des écrans du suivi | **Vérifiés dans Chromium** avec une API simulée (données produites par le moteur du POC) : les 17 onglets s'affichent sans erreur, panneaux de détail, fenêtres, saisies envoyées avec les bons contenus, rôle chef de projet et rôle consultant (aucun montant affiché, écrans de montants redirigés) |
| Serveur .NET et tests C# | **Non compilés ici** (pas de SDK) : relus en entier par deux relectures indépendantes, sans erreur de compilation trouvée ; les défauts d'exécution relevés ont été corrigés. **À vérifier** avec `dotnet build` puis `dotnet test` |
| Tests Vitest de l'interface | **À vérifier** avec `npm test` |

Les numéros de version des paquets sont ceux de la fin 2025 ; si l'un d'eux n'est plus disponible, prendre la version stable la plus proche (voir `docs/a-valider.md`).

## Version du 19/10/2026 (rattrapage de la version HTML, lot 1 : moteur et données)

Première étape du rattrapage de la version HTML du 18/10/2026 (analyse d'écart : 22 domaines, 9 lots). Ce lot met le **moteur de calcul** et le **modèle de données** à jour ; les écrans viennent aux lots suivants.

| Élément | État |
|---|---|
| Spécification : `outils/reference-poc/poc/core.js` = moteur de la version HTML du 18/10/2026 ; 8 scénarios de référence (2 nouveaux : planning et prévisionnel, par axe et par phase) et lecture des 2 TSP régénérés | **Calculés par le moteur HTML lui-même**, reproductibles. Écarts avec les anciens résultats attendus, tous voulus : avancement (tâches validées seulement), type des tâches du TSP exemple B (colonne « Livrable » renseignée), textes de deux avertissements d'import, nouveaux champs |
| Moteur C# : avancement = JH des tâches validées ÷ JH prévus (et avancement déclaré à part), risques sur 4 niveaux (criticité 1 à 16, fort ≥ 8, ancienne échelle convertie), prévisionnel de charge distinct du planning vendu, planning (dates par ligne, sous-parties = lignes de titre du TSP, axe découpé, jalons), avancement détaillé (groupe › lot ou phase › tâches), colonne « Livrable » du TSP | **Non compilé ici** (pas de SDK .NET ni de NuGet). Relu en entier, puis par une relecture indépendante (1 erreur de compilation trouvée et corrigée : nom de variable déjà pris). Attendus des nouveaux tests recalculés avec le moteur HTML (27 contrôles identiques). 2 scénarios de référence et 19 tests nouveaux (39 cas) (`ReglesAvancementPlanningTests`, `PersonnesTests`, `ConversionsRisqueTests`). **À vérifier** avec `dotnet build` puis `dotnet test` |
| Brouillon de TSP : une ligne de titre garde son axe et son lot à l'export Excel ; case « livrable » pré-cochée d'après le titre quand le TSP n'a pas de « oui » dans sa colonne (un brouillon lancé donne les mêmes livrables qu'un import direct) | **Non compilé ici**, couvert par les tests d'API existants des brouillons |
| Interface : modèles de données alignés ; risques sur 4 niveaux (listes, matrice 4 × 4, seuils, lexique, point hebdo) ; avancement d'une phase (panneau de détail) = JH des tâches validées ÷ JH prévus (`etat/avancement.ts`) ; bulles ƒx de la liste des tâches et du planning ; carte « Consommation » (et non « Avancement ») de la diapositive du point hebdo | **Compilée** (Angular 21, mode strict : 0 erreur, specs comprises) ; specs : 60 réussies (5 nouvelles) ; **vérifiée dans Chromium** avec une API simulée par le moteur HTML : relevé de tous les écrans (chef de projet et consultant) identique à la version précédente, à l'exception voulue de l'onglet Risques |
| Exports COPIL et COPROJ : risques sur 4 niveaux (seuil « fort » à 8 sur 16, valeurs par défaut Modérée / Moyenne) ; dates prévues des lignes = celles du Planning (saisies, sinon celles des tâches) ; le reste des exports (Lexique, Avancement détaillé, colonnes) vient au lot 2 | **Non compilé ici** |
| Saisie des nouvelles données (prévisionnel, dates et jalons du planning, absences, personnes ajoutées, instances, type / cause / plan d'un risque) | Commandes de l'API ajoutées avec l'écran qui s'en sert (lots 5 à 8) : ce lot n'ajoute que le modèle de données et la lecture |
| Données fictives seulement | TSP de test nettoyés (chemin d'un poste, lien vers un intranet, nom d'auteur retirés des métadonnées ; lecture identique) ; utilisateur de développement renommé « Camille Martin » ; `anonymise.py` lit ses remplacements dans un fichier local jamais versionné (`*.remplacements.json`) |
| Base de données | 7 tables (`PrevisionnelsProfil`, `DatesPlanning`, `Jalons`, `ElementsPlanning`, `DatesPlanReference`, `Absences`, `PersonnesAjoutees`) et 5 colonnes (`Taches.ColonneLivrable`, `Risques.Type`, `.Cause`, `.Plan`, réglage `Instances` du projet) : **créez la migration** `Rattrapage1810` avant de relancer l'API (README). Les risques déjà saisis sont relus sur la nouvelle échelle sans reprise de données |

## Si `dotnet build` ou `dotnet test` signale une erreur

Copiez le message complet (fichier, ligne, texte) : la correction est en général d'une ligne. Les écrans ont été vérifiés avec une API simulée, donc une erreur côté serveur n'invalide pas l'interface.

## Version du 11/10/2026 (rentabilité et frais, fenêtre d'import)

| Élément | État |
|---|---|
| Rentabilité : la colonne « Dérive de la charge » devient « Optimisations » et « Dépassements » ; chaque colonne de la cascade ouvre son détail dans un volet (explication, calcul, tâches cliquables avec retour, écran où agir) ; alerte « économie fictive » pour les tâches validées sans consommé | **Compilée** (0 erreur) ; **règles testées** (11 tests de `rentabilite.logique.spec.ts`, dont 3 nouveaux) ; **vérifiée dans Chromium** avec une API simulée (13 contrôles : colonnes, somme juste, volet de chaque colonne, retour depuis une tâche, flèches, volet refermé en quittant l'écran) |
| Frais : refacturables et à notre charge comptés à part (voir `regles-metier.md`) | Moteur C#, écran Frais, détail de la cascade, lexique, export COPIL. **Non compilé ici** (pas de SDK .NET) : 3 nouveaux tests dans `ReglesMoteurTests`. Scénarios de référence mis à jour en connaissance de cause : seul `scenario-a-suivi-en-cours` (et ses deux variantes de regroupement) change, frais à l'atterrissage 850 € au lieu de 700 €, effet sur la marge 0 € au lieu de +150 € (l'ancienne règle comptait un gain fictif). **À vérifier** avec `dotnet build` puis `dotnet test` |
| Fenêtre « Importer un TSP » : « Ce qui sera repris du TSP » et les points relevés retirés (les contrôles sont dans le brouillon et « Prêt à lancer ? ») | **Compilée**, **vérifiée dans Chromium** |
| Base de données | Aucun changement |

## Version du 09/10/2026 (point hebdo PowerPoint)

| Élément | État |
|---|---|
| Interface : écran « Point hebdo » (bouton du tableau de bord, à la place de « Capture datée »), choix Hebdomadaire / Mensuel et de la période, saisie (actualités, points d'attention, indicateurs S / S+1 ou M / M+1, météo, extension), réglages et logos, aperçu fidèle, téléchargement du PowerPoint (une diapositive au format 16:9, textes et tableaux modifiables) | **Compilée** (0 erreur) ; **règles testées** (6 tests : consommé au TJM, période, indicateurs proposés, reprise de la période précédente, nom du fichier) ; données **identiques à la version HTML** (comparaison automatique : 0 écart) ; **vérifiée dans Chromium** avec une API simulée (16 contrôles : appels envoyés, aperçu, rôle consultant redirigé, fichier PowerPoint valide) |
| PptxGenJS 4.0.1 (licence MIT) et logo par défaut | Servis depuis `frontend/public` (`vendor/pptxgen.bundle.js`, `point-hebdo/logo-entreprise.png`) et chargés seulement à l'ouverture de l'écran : rien à installer |
| Serveur : `PUT /api/projets/{id}/points-hebdo/semaines/{lundi}`, `…/points-hebdo/mois/{AAAA-MM}`, `…/points-hebdo/reglages/{champ}` ; lecture dans `pointsHebdo` de la vue du projet (retiré pour les consultants et lecteurs) | **Non compilé ici** (pas de SDK .NET). 1 test d'API ; relu par une relecture indépendante (les 3 défauts relevés ont été corrigés). **À vérifier** avec `dotnet build` puis `dotnet test` |
| Base de données | Une table `PointsHebdo` : **créez la migration** `PointsHebdo` avant de relancer l'API (README, « Faire évoluer la base ») |
| Police | La diapositive utilise **Montserrat** (charte du support) : à installer sur les postes, sinon PowerPoint la remplace par une police proche |

## Version du 09/10/2026 (commentaires des registres)

| Élément | État |
|---|---|
| Actions, décisions, risques : intitulé sur plusieurs lignes ; commentaire (parade pour un risque) sur une ligne pleine largeur sous chaque ligne, entièrement visible | **Compilée** (0 erreur) ; **vérifiée dans Chromium** avec une API simulée (10 contrôles : texte entier visible, retours à la ligne conservés et envoyés, tableau sans défilement horizontal à 1440 px) |
| Export Excel (serveur) : un texte sur plusieurs lignes garde ses retours à la ligne dans la cellule | **Non compilé ici** (une ligne dans `EcrivainXlsx`). Aucun changement de base de données |

## Version du 08/10/2026 (réaffectation de la charge d'un profil)

| Élément | État |
|---|---|
| Interface : bouton ⇄ et colonne « Réaffecté » du panneau de la tâche, fenêtre « Réaffecter la charge », annulation, Rentabilité (lignes, cascade), lexique et bulles ƒx | **Compilée** (0 erreur) ; **vérifiée dans Chromium** avec une API simulée (30 contrôles : contrôles de saisie, appels envoyés, annulation, Rentabilité, saisie du consommé, aucun débordement) |
| Serveur : moteur (charge déplacée, écart de coût, lignes du périmètre), `POST` et `DELETE /api/projets/{id}/taches/{uid}/reaffectations`, exports COPIL et COPROJ, filtre des montants (`coutReaff`) | **Non compilé ici** (pas de SDK .NET). 3 nouveaux tests du moteur et 1 test d'API ; relu par une relecture indépendante (aucune erreur de compilation trouvée, les défauts relevés ont été corrigés). **À vérifier** avec `dotnet build` puis `dotnet test` |
| Base de données | Une colonne `EvolutionsPerimetre.ProfilSourceId` et une nature d'évolution `Reaffectation` : **créez la migration** `Reaffectations` avant de relancer l'API (README, « Faire évoluer la base ») |

## Version du 07/10/2026 (évolutions de la réunion du 5 octobre)

| Élément | État |
|---|---|
| Interface : Portefeuille, Mon travail, Rentabilité, référence du Gantt, document et fil d'une tâche, capture datée, logo | **Compilée** (compilateur Angular, mode strict : 0 erreur) ; **règles d'affichage testées** (35 tests, dont 24 nouveaux) ; **vérifiée dans Chromium** avec une API simulée : rôles chef de projet et consultant, largeurs 390, 1024 et 1440 px sans débordement, chaque action envoie le bon appel, aucun « € » sur la slide ni sur le tableau de bord (chef de projet et consultant), PDF de la slide et du tableau de bord générés |
| Serveur : références de planning (cause et motif), lien du document livré, fil de mises à jour, filtre des montants renforcé | **Non compilé ici** (pas de SDK .NET ni d'accès à NuGet). Relu par une relecture indépendante : aucune erreur de compilation trouvée, les défauts relevés ont été corrigés. **À vérifier** avec `dotnet build` puis `dotnet test` (3 nouveaux tests d’API et 6 cas pour le filtre des montants) |
| Base de données | Une nouvelle table (`MisesAJourTache`) et deux colonnes (`LignesPlanReference.Cause`, `.Motif`) : **supprimez la base de développement** avant de relancer l'API (voir README) |

## Version du 07/10/2026 (créer un projet : rédiger le TSP)

| Élément | État |
|---|---|
| Interface : fenêtre « Nouveau projet », brouillons sur l'accueil, rédaction (fiche, profils, workload, planning, échéancier, achats et frais, prêt à lancer), import vers un brouillon | **Compilée** (0 erreur) ; **règles de saisie testées** (9 nouveaux tests : collage depuis Excel, répartition du planning, totaux…) ; **vérifiée dans Chromium** avec une API simulée, à 390 et 1440 px, sans débordement ni erreur : saisie au clavier, collage d'un bloc Excel et enregistrement automatique (un seul envoi) |
| Serveur : brouillons, mise en classeur du TSP, analyse, export Excel avec formules, lancement | **Non compilé ici** (pas de SDK .NET). Relu par une relecture indépendante (aucune erreur de compilation trouvée ; les défauts relevés ont été corrigés). 11 nouveaux tests d'API, dont : un TSP repris dans un brouillon donne **exactement** les mêmes chiffres que son import direct (2 TSP de test), et un TSP exporté puis relu donne la même synthèse. **À vérifier** avec `dotnet build` puis `dotnet test` |
| Base de données | Une nouvelle table `BrouillonsProjet` : **créez la migration** `Brouillons` avant de relancer l'API (README) |
