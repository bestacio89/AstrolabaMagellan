# Design system

Règles visuelles communes à tous les écrans. Référence : le langage visuel de monday.com. Les valeurs de base (couleurs, polices, espacements, arrondis) reprennent celles de **Vibe**, le design system que monday.com publie en open source (licence MIT, paquet `@vibe/style`), adaptées à notre application. Nous n'utilisons pas leur code : seulement ces valeurs, recopiées dans nos jetons.
Règle principale : **simple, beau et immédiatement compréhensible**. Chaque élément a une fonction ; l'interface respire.

Toutes les valeurs sont des **jetons** (variables CSS) définis une seule fois dans `frontend/src/styles.scss` (`:root`).
Les écrans du suivi les reprennent dans `frontend/src/styles/suivi.css` (bloc `.suivi` en tête, puis section « Refonte visuelle » en fin de fichier).
Pour changer une couleur partout : modifier le jeton, jamais une valeur en dur dans un écran.

## Couleurs

| Rôle | Jeton | Valeur |
|---|---|---|
| Action (boutons, liens) | `--c-primaire` / `--c-primaire-fonce` | #0073EA / #0060B9 |
| Élément sélectionné (menu, filtre) | `--c-primaire-clair` | #CCE5FF |
| Fond de l'application | `--c-fond` | #F6F7FB |
| Surfaces (cartes, barre latérale) | `--c-surface` | #FFFFFF |
| Texte / texte secondaire | `--c-texte` / `--c-texte-discret` | #323338 / #676879 |
| Bordures / bordures de champ / séparateurs | `--c-bordure` / `--c-bordure-champ` / `--c-separateur` | #D0D4E4 / #C3C6D4 / #E7E9EF |

La couleur sert à **classer l'information**, jamais à décorer.

## Statuts : cellules pleines, une couleur = un sens, partout

| Sens | Exemples | Fond | Texte |
|---|---|---|---|
| À faire, sans date | tâche « À faire » | `--c-statut-afaire` #C4C4C4 | sombre |
| En cours, à surveiller, bientôt | « En cours », échéance proche | `--c-statut-encours` #FDAB3D | sombre |
| Bloqué, en retard, dépassement | « Bloqué / En attente », échéance en retard | `--c-statut-bloque` #D83A52 | blanc |
| En recette, à justifier | « En recette », bilan IA | `--c-statut-test` #9D50DD | blanc |
| Terminé, dans la cible, optimisation | « Validé », échéance payée | `--c-statut-valide` #00C875 | sombre |
| Annulé, planifié, conforme | tâche annulée, échéance planifiée | `--c-statut-annule` #E7E9EF | gris |

Chaque couple fond / texte a un contraste d'au moins 4,5 (lisibilité, accessibilité). Une **information** (rôle, écart, glissement) utilise un fond pâle et un texte foncé, jamais une cellule pleine.

## Typographie

Deux polices, **hébergées avec l'application** (`frontend/public/fonts`, licence SIL Open Font License) : rien n'est chargé depuis Google, l'application fonctionne sur un intranet et n'envoie rien à un tiers.

| Usage | Police | Jeton |
|---|---|---|
| Titre de page (nom du projet, « Mes projets ») | Poppins 600, 26 px | `--texte-titre-page` |
| Titre d'écran | Poppins 500, 20 px | `--texte-titre-ecran` |
| Titre de carte | Poppins 500, 16–18 px | `--texte-titre-carte` |
| Chiffre clé | Poppins 600, 28 px | `--texte-chiffre` |
| Texte courant, cellules de tableau | Figtree 400, 14 px | `--texte-courant` |
| Libellés secondaires, légendes | Figtree 400, 12–13 px, gris | `--texte-petit` |
| Repères de groupe (barre latérale, sections) | Figtree 600, 11–12 px, petites capitales espacées | — |

Le texte reste léger (400) ; le gras (600) est réservé à ce qui doit ressortir dans une phrase. Les titres se distinguent par la police, pas par l'épaisseur.

## Formes, espaces, mouvements

- Arrondis : 4 px (statut, badge, bouton, champ), 8 px (carte), 16 px (fenêtre).
- Espacements : multiples de 4 (`--esp-1` à `--esp-10`). Entre deux blocs d'un écran : 24 px ; entre deux cartes d'une grille : 16 px ; marge de page : 32 px (16 px sur téléphone).
- Cartes : fond blanc, bordure très légère (#E7E9EF), ombre presque invisible. L'ombre marquée est réservée à ce qui flotte : menus, panneau de détail, fenêtres, messages.
- Animations courtes (120 ms) : survol, ouverture d'un menu, apparition d'un message. Coupées si le poste demande moins d'animations.

## Composants

| Composant | Règle |
|---|---|
| Bouton | Hauteur 40 px (32 dans les tableaux). **Un seul bouton primaire (bleu) par écran.** Secondaire : blanc bordé. Discret : sans fond. |
| Champ | Hauteur 40 px, bordure #C3C6D4 ; au survol, bordure foncée ; au focus, bordure bleue ; en erreur, bordure rouge et message sous le champ. |
| Pastille / statut | Cellule pleine, texte 13 px, arrondi 4 px. |
| Compteur | Pastille ronde rouge (en retard) ou grise (à traiter). |
| Tableau | En-tête blanc, libellés discrets ; lignes séparées par un trait fin ; survol bleuté ; groupes repérés par une couleur (axe, projet). |
| Notification de page | Une ligne sur fond pâle, que l'on peut déplier (« Voir ») ou masquer (×). |
| Message après une saisie | En bas au centre, fond sombre, disparaît seul. |

## Tableau de bord

La photo du projet **à une date** (« Situation au … »), lisible en quelques secondes par tout le monde, y compris le client. **Aucun montant en euros** : l'écran est le même pour tous les rôles et peut être partagé ou projeté tel quel. Une question → un écran : l'argent se lit dans **Rentabilité**.

1. quatre indicateurs, en jours-homme et en dates : avancement (comparé au temps écoulé), atterrissage (avec son écart au prévu), reste à faire, fin prévue ;
2. « À traiter » (une seule liste, les retards d'abord, chacun avec son action ; une échéance à émettre y figure par son numéro, sans montant) et les points de vigilance de pilotage (planning, saisie, charge) ;
3. l'avancement par axe (ou lot, ou phase) et l'avancement des livrables et ateliers (réalisés / prévus). Le bouton **Détail ›** de la carte ouvre un panneau large, par-dessus la page : charges (prévu, consommé, RAF, atterrissage, écart, taux consommé, projection) et planning (dates prévues et réelles, tâches validées, avancement, statut), avec le total ; les légendes sont en infobulle sur les étiquettes. Uniquement des JH. Si le projet est suivi par phase, chaque phase (dans la carte ou le panneau) ouvre le panneau de la phase, qui propose « ‹ Avancement » pour revenir ;
4. les graphiques de charge mensuelle.

Ce qui en est sorti, et où le trouver : coûts, marges, achats, frais, facturation et points de vigilance financiers → **Rentabilité** ; détail du planning → **Gantt** ; optimisation IA → **Workload**. L'« évolution d'un comité à l'autre » a été retirée.

## Rentabilité

Tout ce qui est en euros, réservé aux rôles qui voient les montants : les quatre indicateurs de marge, la cascade de la marge vendue à la marge à terminaison, le simulateur de dépense, « Coûts et marges » (coût initial, coût final estimé, marge sur production, achats, frais, marge nette), l'échéancier de facturation, les évolutions du périmètre, les points d'attention financiers et le détail achats / frais.

## Rédaction d'un TSP (brouillon)

- **Barre latérale** : sous « Brouillon ouvert », les six rubriques du TSP avec leur état (pastille verte : complète ; orange : à vérifier ; rouge : à corriger ; cercle vide : à remplir) et une courte note (nombre de profils, JH, % de l'échéancier, « facultatif »), puis « Prêt à lancer ? » avec le nombre de points à corriger.
- **En-tête** : nom du projet, pastille violette « Brouillon », « Visible de… seulement », état de l'enregistrement (« Enregistré il y a 12 s »), « Exporter en Excel », bouton principal « Vérifier et lancer ».
- **À droite, « Le TSP en direct »** (fiche, profils, échéancier, achats et frais) : montant du contrat, charge, TJM moyen, coût, marge, répartition par phase, avancement de la rédaction et prochaine étape suggérée. Les grands tableaux (workload, planning) et « Prêt à lancer ? » prennent toute la largeur, avec un résumé en une ligne.
- **Workload** : saisie comme un tableur (Entrée et flèches pour changer de ligne, Tab de colonne, coller un bloc copié d'Excel) ; **séparateurs** (bandeau orangé pâle, comme les titres de section du TSP) qui portent le total de leur section ; **poignée** ⠿ pour glisser une ligne ; **corbeille** visible sur chaque ligne ; suppression, collage et transformation en séparateur **annulables** d'un clic (bandeau sombre « … · Annuler »).
- Couleur des brouillons : violet (`--c-violet`), partout (accueil, barre latérale, en-tête).

- **Largeur des pages** : toutes les pages (accueil, portefeuille, mon travail, projet, brouillon) occupent toute la largeur, avec 20 px de marge, comme les écrans d'un projet.

## Navigation

- **Marque** : le logo Magellan (`frontend/public/magellan-marque.png`, fond transparent, fourni par l'agence) suivi du nom de l'application, **Astrolabe**, et de son sous-titre « Pilotage des forfaits » (constantes `NOM_APPLICATION` et `SOUS_TITRE_APPLICATION`, `core/layout/titre.ts`) ; l'onglet du navigateur affiche « Page · Astrolabe ». Il ne se déforme pas (hauteur 24 px) ; l'icône de l'onglet du navigateur est `favicon.png`.
- **Barre latérale** visible par défaut ; sur grand écran, le bouton « ‹ » à côté du logo la réduit à une fine bande (plus de place pour les tableaux), la flèche « › » sur le bord la rouvre. Le choix est retenu par le navigateur et vaut pour toutes les pages ; sur petit écran, elle reste un menu. Contenu : Accueil, Mon travail (avec le nombre d'éléments en retard ou à rendre cette semaine), Portefeuille, puis les rubriques du projet ouvert regroupées (Pilotage, Finances, Vendu (TSP), Annexes du TSP), chaque groupe séparé par un trait et titré en petites capitales, avec le nombre de points à traiter, et enfin « Paramètres du projet » (séparé par un trait, sans titre de groupe) ; puis l'accès rapide aux autres projets, le lexique et la personne connectée.
- En pied de barre latérale : **Lexique** (vocabulaire et règles de calcul) et **Préférences** (icône de curseurs : menus affichés, Mon travail et Portefeuille ; réglage propre au navigateur). Règle de nommage : un mot ne désigne qu'une chose. « Paramètres du projet » règle le projet pour toute l'équipe (axes, dates, alertes, types, IA, archivage, suppression) ; « Préférences » règle l'affichage pour soi seul.
- **Accueil, liste des projets** : toute la ligne ouvre le projet (lien étiré) ; le menu ⋯ en fin de ligne propose « Ouvrir le projet », « Paramètres du projet » et, pour le chef de projet, « Archiver… » (confirmation, puis le projet rejoint « Projets archivés »). Le menu est en position fixe pour ne pas être coupé par le défilement du tableau.
- **Listes modifiables** (leviers IA, causes de dépassement) : un élément par ligne, × pour le retirer (au moins un élément), champ « + Ajouter » en bas (Entrée), doublons refusés avec un message ; « Rétablir la liste par défaut ».
- **Fil d'Ariane** en haut de chaque écran de projet : « ‹ Mes projets / rubrique ».
- Sur téléphone, la barre latérale se replie derrière un bouton « Menu ».
- Les rubriques financières ne sont proposées qu'aux rôles qui voient les montants.

## Impression et PDF

- **Capture datée** (portefeuille ; sur le tableau de bord, remplacée par le point hebdo PowerPoint) : A4 paysage, sans barre latérale ni boutons ; le tableau de bord ne contient aucun montant.
- Les couleurs sont imprimées telles quelles (`print-color-adjust: exact`).

## Préférence d'affichage

« Affichage compact » (⚙ Paramètres du projet › Affichage et lexique) resserre les tableaux pour voir plus de lignes. C'est un réglage du navigateur : il ne change rien pour les collègues.

## Finitions (tableaux et fenêtres)

- **Fenêtres** : la croix de fermeture est un bouton rond autonome (36 px, centré sur le titre), identique dans tous les écrans ; les boutons du pied (`<div pied>`) sont alignés à droite et espacés de 8 px (règle globale `app-fenetre [pied]`).
- **Texte trop long dans une cellule** (Lot, par exemple) : une seule ligne terminée par « … », le texte complet au survol (classe `.ell` + attribut `title`). Les colonnes Lot du Workload et des Ateliers & livrables sont assez larges pour un nom courant (« Gouvernance »).
- **Saisie du consommé, hiérarchie** : le nom de la tâche en 500, le consommé en 600 (c'est ce qu'on saisit), le reste à faire en 500, le prévu et les valeurs nulles en gris, les lignes de profils en 400. Le gras ne sert plus qu'à ce qui compte.
- **Saisie du consommé, « ⤢ Agrandir »** : la saisie occupe toute la fenêtre, avec des cases plus grandes (texte 14 px, cases de 50 × 32 px) ; « Réduire » ou Échap pour revenir. Le détail d'une tâche et les fenêtres s'ouvrent par-dessus ; Échap ferme d'abord le panneau ouvert.
- **ƒx « Calcul » partout où un chiffre est calculé** : indicateurs, graphiques et tableaux (tableau de bord, Rentabilité, Workload, Ateliers & livrables, Gantt, annexes du TSP…). La bulle donne la formule avec les mêmes mots que l'écran. Un nouvel indicateur ne s'ajoute pas sans sa formule (`FORMULES`, `etat/constantes.ts`).
- **Un mot = un sens** : « Marge nette vendue » et « Marge nette à terminaison » partout (Rentabilité, liste des projets, portefeuille) ; « Marge sur production » seulement pour la marge des jours. Un écart de coût est toujours nommé par sa référence : « par rapport au TSP » ou « par rapport au prévu (ajouts compris) ».
- **Barres de filtres** : filtres à gauche, groupe « affichage » solidaire à droite ; quand la place manque, ce groupe passe à la ligne d'un bloc, aligné à gauche (requête de conteneur sur `.barre-f`). Mois : `◀ mois ▶` + « Ce mois-ci ». La saisie du consommé n'a plus « + Nouvelle tâche » (il est dans la liste des tâches).
- **Barre latérale, groupe « Vendu (TSP) »** : le TSP vendu et ses annexes forment un seul groupe, replié par défaut (consulté rarement une fois le projet lancé). Il s'ouvre d'office quand on est sur une de ses pages ; ouvert ou fermé, le choix est retenu par le navigateur.
- **Filtres à deux états** : toujours un bouton bascule (`.btn` + `aria-pressed`), jamais une case à cocher ; en bleu quand le filtre est actif, libellé qui dit l'état (« Tâches terminées masquées »). Pas de case à cocher dans les barres d'outils.
- **Synthèse du TSP** (`ui/synthese-tsp.ts`) : un seul écran pour le brouillon (Synthèse, entre Rédaction du TSP et Lancement) et le projet lancé. Libellés de l'onglet SYNTHESE à l'identique, pour que les commerciaux s'y retrouvent ; tableau « Par entité » en matrice (FO, CESSION, ACHAT, BO, ACHAT BO, TOTAL BO), case vide quand la ligne n'existe pas pour l'entité, « — » quand la valeur est vide ; filtre « Lot » commun aux deux tableaux croisés. Brouillon incomplet : bandeau « Synthèse partielle ».
