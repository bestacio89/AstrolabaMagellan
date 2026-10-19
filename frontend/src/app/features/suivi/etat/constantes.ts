/**
 * Listes de valeurs et textes d'aide de l'écran de suivi, repris tels quels de la version de référence (POC v65).
 * Les mêmes listes existent côté serveur (règles de gestion) : les modifier aux deux endroits.
 */

export const STATUTS = ['À faire', 'En cours', 'Bloqué / En attente', 'En recette', 'Validé'] as const;
export const AVANCEMENTS = [0, 0.25, 0.5, 0.75, 1] as const;
export const IA_CONFORME = 'IA utilisée comme prévu';
export const ACHAT_STATUTS = ['Commandé', 'Reçu', 'Facturé'] as const;
export const FRAIS_CATEGORIES = ['Transport', 'Hébergement', 'Repas', 'Autre'] as const;
/** Probabilité d'un risque (abscisse de la matrice) et importance (ordonnée), 4 niveaux chacune ; criticité de 1 à 16. */
export const RISK_PROBA = ['Faible', 'Modérée', 'Forte', 'Très forte'] as const;
/** Importance (le champ s'appelle toujours « impact »). */
export const RISK_IMPACT = ['Faible', 'Moyenne', 'Forte', 'Critique'] as const;
export const RISK_PROBA_DEF = 'Modérée';
export const RISK_IMPACT_DEF = 'Moyenne';
/** Types d'un risque (légende du support de comité). */
export const RISK_TYPES = ['Retard', 'Qualité', 'Budget'] as const;
/** Niveau d'une criticité, d'après la matrice de référence : 1 à 3 faible, 4 à 6 moyen, 8 et plus fort. */
export const riskNiveau = (crit: number): 'faible' | 'moyen' | 'fort' => (crit >= 8 ? 'fort' : crit >= 4 ? 'moyen' : 'faible');
export const RISK_ST = ['Ouvert', 'Maîtrisé', 'Survenu', 'Clos'] as const;
export const ACT_ST = ['À faire', 'En cours', 'Fait', 'Annulée'] as const;
export const DEC_ST = ['Validée', 'À valider', 'Rejetée'] as const;
export const ORIGINES = ['COPROJ', 'COPIL', 'Réunion client', 'Interne', 'Autre'] as const;
export const IMPACTS = ['', 'Périmètre', 'Planning', 'Charge', 'Coût', 'Qualité', 'Organisation'] as const;
/** Entités proposées pour un profil ajouté en cours de projet. */
export const ENTITES_L = ['FO', 'BO', 'CESSION', 'ACHAT', 'ACHAT BO'] as const;

/** Profils qui peuvent dépasser 1 JH par jour (plusieurs personnes derrière un même profil). */
export const multiJours = (entite: string | null | undefined): boolean => /^(ACHAT|CESSION)/.test(String(entite ?? '').toUpperCase());

/** Délais d'alerte proposés dans les paramètres ({x} : objet de l'alerte). */
export const ALERT_OPTS: readonly [number, string][] = [
  [0, 'le jour de {x}'],
  [1, '1 jour avant {x}'],
  [2, '2 jours avant'],
  [3, '3 jours avant'],
  [5, '5 jours avant'],
  [7, '7 jours avant (une semaine)'],
  [10, '10 jours avant'],
  [14, '14 jours avant (deux semaines)'],
  [21, '21 jours avant (trois semaines)'],
  [30, '30 jours avant (un mois)'],
];

/** Statuts du résultat IA d'une tâche : libellé et classe CSS. */
export const IA_ST: Record<string, [string, string]> = {
  avenir: ['À venir', 'ia-none'],
  encours: ['En cours', 'ia-cours'],
  totale: ['Économie totale', 'ia-eco'],
  partielle: ['Économie partielle', 'ia-eco'],
  conforme: ['Conforme', 'ia-conf'],
  depassement: ['Dépassement', 'ia-dep'],
  annulee: ['Annulée', 'ia-none'],
};

export type CleFormule =
  | 'tuiles'
  | 'atter'
  | 'plan'
  | 'mensuel'
  | 'ia'
  | 'conso'
  | 'prevuAx'
  | 'consoAx'
  | 'couts'
  | 'echeances'
  | 'fae'
  | 'planProfil'
  | 'planPhase'
  | 'synthese'
  | 'profils'
  | 'depenses'
  | 'livrables'
  | 'vigilance'
  | 'renta'
  | 'cascade'
  | 'simu'
  | 'coutsMarges'
  | 'perimetre'
  | 'saisie'
  | 'liste'
  | 'registres'
  | 'gantt'
  | 'metrique'
  | 'ventilation'
  | 'chiffrage';

/** ƒx : comment chaque indicateur est calculé (bulle d'information). [titre, [libellé, formule, note?][]] */
export const FORMULES: Record<CleFormule, [string, [string, string, string?][]]> = {
  tuiles: [
    'Les quatre indicateurs',
    [
      ['Avancement', 'consommé ÷ charge prévue', 'Charge prévue = vendu (TSP) + ajouts − annulations'],
      ['Temps écoulé', 'jours ouvrés écoulés ÷ jours ouvrés de la période (début → fin prévue)', 'En rouge si l’avancement dépasse le temps écoulé de plus de 10 points'],
      ['Atterrissage', 'consommé + reste à faire : la charge totale attendue à la fin', 'Écart = atterrissage − charge prévue ; « par rapport au TSP vendu » = atterrissage − vendu'],
      ['Reste à faire', 'Σ RAF des tâches', 'RAF d’une tâche : saisi, sinon Σ par profil de max(prévu − consommé ; 0) ; 0 si la tâche est validée'],
      ['Fin prévue', 'date de fin réaliste (⚙ Paramètres du projet)', 'Glissement = fin prévue − fin contractuelle, en jours calendaires ; jours ouvrés restants jusqu’à la fin prévue'],
    ],
  ],
  livrables: [
    'Livrables et ateliers',
    [
      ['Prévus', 'tâches du type (Atelier ou Livrable), hors annulées'],
      ['Réalisés', 'tâches du type au statut « Validé »'],
      ['%', 'réalisés ÷ prévus'],
    ],
  ],
  vigilance: [
    'Points de vigilance',
    [
      ['Calcul', 'recalculés à chaque saisie, à partir des tâches, du consommé, des dates et des registres'],
      ['Planning', 'glissement de la fin (fin prévue après la fin contractuelle), consommation en avance sur le calendrier, tâches datées hors période'],
      ['Saisie', 'plus d’1 JH le même jour pour une personne, consommé non rattaché, tâches validées sans consommé'],
      ['Charge', 'tâches en dépassement (consommé > prévu), RAF à réestimer (budget consommé, tâche non validée), RAF incohérent avec l’avancement'],
      ['Seuils', 'le détail de chaque point indique sa valeur ; les délais d’alerte se règlent dans ⚙ Paramètres du projet'],
    ],
  ],
  renta: [
    'Indicateurs de rentabilité',
    [
      ['Marge nette vendue', 'marge nette du TSP signé ÷ montant du contrat', 'Montant du contrat = CA des jours + achats et frais refacturés'],
      ['Marge nette à terminaison', 'marge nette attendue à la fin ÷ (CA des jours + achats et frais refacturés à l’atterrissage)', 'Écart en points = taux à terminaison − taux vendu'],
      ['Coût de production', 'coût final estimé = Σ (consommé × CJM) + Σ (RAF × CJM)', 'Écart = coût final estimé − coût prévu (TSP + ajouts − annulations)'],
      ['Achats et frais', 'effet sur la marge nette par rapport au budget du TSP', '= (refacturé − atterrissage) − (refacturé TSP − budget TSP), achats et frais additionnés'],
    ],
  ],
  cascade: [
    'De la marge vendue à la marge à terminaison',
    [
      ['Marge nette vendue', 'marge nette du TSP signé (production, achats et frais)'],
      ['Avenants', '− chiffre d’affaires retiré par les avenants de réduction'],
      ['Charges ajoutées', '− coût des charges ajoutées en cours de projet (JH × CJM), non facturées'],
      ['Parties annulées', '+ coût évité par les tâches annulées'],
      ['Réaffectations', '− (JH réaffectés × (CJM de la nouvelle personne − CJM de la personne d’origine))', 'Nulle quand les deux personnes ont le même CJM'],
      ['Optimisations', '+ Σ (coût prévu − coût à l’atterrissage) des tâches qui finissent sous leur charge', 'Tâche validée sous sa charge, ou reste à faire réestimé à la baisse. Une tâche validée sans consommé compte comme une économie fictive tant que le temps passé n’est pas saisi'],
      ['Dépassements', '− Σ (coût à l’atterrissage − coût prévu) des tâches qui finissent au-dessus de leur charge', 'Coût à l’atterrissage = consommé × CJM + reste à faire × CJM'],
      ['Achats · Frais', 'effet de l’atterrissage des achats (puis des frais) par rapport au budget du TSP'],
      ['Autres écarts', 'ce qui reste : remise, provisions, arrondis'],
      ['Marge nette à terminaison', 'marge nette vendue + toutes les colonnes intermédiaires', 'Seules les colonnes d’au moins 1 € sont affichées. Cliquez sur une colonne pour son détail'],
    ],
  ],
  simu: [
    'Simuler une dépense',
    [
      ['Coût de la dépense', 'personnes × transport + personnes × jours × (hébergement et repas)'],
      ['Marge après', '(marge nette à terminaison − coût + refacturé) ÷ (base de calcul + refacturé)', 'Base de calcul = CA des jours + achats et frais refacturés à l’atterrissage'],
      ['Variation', 'taux après − taux avant (en points) · marge après − marge avant (en euros)'],
      ['Enregistrement', 'aucun : une dépense engagée se saisit dans Frais'],
    ],
  ],
  coutsMarges: [
    'Coûts et marges',
    [
      ['CA', 'Σ jours vendus × TJM (remise déduite) − avenants de réduction'],
      ['Coût initial', 'Σ jours du TSP × CJM du profil', '+ ajouts : coût des charges ajoutées en cours de projet'],
      ['Coût final estimé', 'Σ (consommé × CJM) + Σ (RAF × CJM)', 'Écart affiché par rapport au coût du TSP (coût initial) et au coût prévu (TSP + ajouts − annulations)'],
      ['Marge sur production', 'CA − coût final estimé', 'Taux = marge ÷ CA : les jours seulement'],
      ['Achats à l’atterrissage', 'le plus élevé du budget TSP et du réel, ligne par ligne (+ hors TSP)'],
      ['Frais à l’atterrissage', 'refacturables : le plus élevé du budget refacturé et du réel refacturable ; à notre charge : le plus élevé de la part prévue (budget − refacturé) et du réel non refacturé', 'Un frais non refacturé au-delà de la part prévue à notre charge réduit la marge'],
      [
        'Marge nette à terminaison',
        'marge sur production + (achats refacturés − achats) + (frais refacturés − frais)',
        'Taux = marge nette ÷ (CA + achats et frais refacturés) : le refacturé à prix coûtant augmente la base sans ajouter de marge, le taux baisse',
      ],
    ],
  ],
  perimetre: [
    'Évolutions du périmètre',
    [
      ['Charge', 'JH ajoutés (tâche ou profil) ou annulés ; réaffectation : JH déplacés d’un profil à un autre, total inchangé'],
      ['Coût', 'JH × CJM du profil'],
      ['Facturation', 'un ajout n’est pas facturé (le CA reste celui du TSP) ; une annulation peut faire l’objet d’un avenant de réduction'],
    ],
  ],
  saisie: [
    'Saisie du consommé',
    [
      ['Prévu', 'charge de la tâche par profil (vendu + ajouts − annulations)'],
      ['Consommé', 'Σ jours saisis', 'En rouge si le consommé dépasse le prévu'],
      ['RAF', 'saisi, sinon par profil max(prévu − consommé ; 0) ; 0 si la tâche est validée', 'Sur une ligne de profil en dépassement : prévu − consommé (négatif)'],
      ['Mois', 'Σ jours saisis dans le mois affiché'],
      ['Total du jour', 'Σ des jours saisis ce jour-là ; maximum 1 JH par personne et par jour, toutes tâches confondues (sauf profils ACHAT et CESSION)'],
    ],
  ],
  liste: [
    'Liste des tâches',
    [
      ['Prévu', 'charge de la tâche = vendu + ajouts − annulations'],
      [
        'Avancement déclaré',
        'choisi par paliers (0, 25, 50, 75, 100 %) ; 100 % quand la tâche est validée',
        'Indication sur la tâche : n’entre dans aucun pourcentage d’avancement d’un groupe',
      ],
      ['Totaux', 'Σ prévu et Σ consommé des tâches affichées (filtres compris)'],
      ['Dates', 'dates prévues ; une fin prévue dépassée est en rouge, le réel est dans le détail de la tâche et le Gantt'],
    ],
  ],
  registres: [
    'Ateliers et livrables',
    [
      ['Charge', 'prévu de la tâche (vendu + ajouts − annulations)'],
      ['Réalisé le / livré le', 'date du dernier consommé saisi, quand la tâche est validée'],
      ['Consommé / RAF', 'comme dans la saisie du consommé'],
      ['Compteur', 'tâches validées ÷ tâches du type (hors annulées)'],
    ],
  ],
  gantt: [
    'Planning Gantt',
    [
      ['Prévu', 'premier début prévu → dernière fin prévue des tâches (contour)'],
      ['Réel', 'premier → dernier jour de consommé saisi (barre pleine) ; avancement de la tâche'],
      ['Glissement', 'fin prévue − fin contractuelle, en jours calendaires'],
      ['Dérives', 'chaque changement de date par rapport à la référence figée, avec sa cause et son motif'],
    ],
  ],
  metrique: [
    'Métrique',
    [
      ['Base', 'charge du TSP sur l’étape « Développement et tests unitaires »'],
      ['Charge théorique', 'base × % théorique de l’étape'],
      ['Charge propale', 'Σ charge du TSP des tâches de l’étape'],
      ['% projet', 'charge propale ÷ base'],
      ['Écart', '% projet − % théorique', 'Sans charge sur l’étape de base, les ratios ne s’appliquent pas'],
    ],
  ],
  ventilation: [
    'Ventilation des charges',
    [
      ['Cellule', 'Σ jours vendus du profil sur les tâches de la phase (ou de l’étape)'],
      ['Total', 'Σ des profils de la ligne ; ligne « Non renseignée » : tâches sans étape dans le TSP'],
      ['TJM moyen', 'CA vendu ÷ jours vendus'],
    ],
  ],
  chiffrage: [
    'Chiffrage',
    [
      ['Charge par profil', 'jours du WORKLOAD du TSP, tâche par tâche'],
      ['Total JH', 'Σ des profils de la tâche'],
      ['Valorisation', 'Σ charge × TJM du profil (remise déduite)'],
    ],
  ],
  atter: [
    'Atterrissage par axe',
    [
      ['Prévu', 'Σ prévu des tâches de l’axe'],
      ['Consommé', 'Σ jours saisis'],
      ['RAF', 'Σ reste à faire des tâches'],
      ['Atterrissage', 'consommé + RAF'],
      ['Écart', 'atterrissage − prévu', 'Négatif = optimisation, positif = dépassement'],
      ['Taux consommé', 'consommé ÷ prévu'],
    ],
  ],
  plan: [
    'Planning projet',
    [
      ['Prévu', 'premier début prévu → dernière fin prévue des tâches'],
      ['Réel', 'premier → dernier jour de consommé saisi'],
      ['Tâches validées', 'tâches au statut « Validé » ÷ tâches du périmètre (hors annulées)'],
      ['Avancement', 'JH des tâches validées ÷ JH prévus', 'Seules les tâches validées comptent, au poids de leur charge. Jamais déduit du consommé ni de l’avancement déclaré'],
    ],
  ],
  mensuel: [
    'Charges & projection mensuelle',
    [
      ['Référence initiale', 'planning du TSP par profil (Annexes › Planning), Σ des profils par mois'],
      ['Consommé saisi', 'Σ jours saisis dans le mois, jusqu’au dernier mois saisi'],
    ],
  ],
  ia: [
    'Optimisation IA',
    [
      ['Enveloppe IA', 'charge du profil Agent IA sur la tâche', 'Une réserve adossée aux autres profils de la tâche'],
      [
        'IA consommée',
        'max(consommé total de la tâche − charge des autres profils ; 0)',
        'Le consommé total inclut une saisie éventuelle sur le profil IA ; un profil resté sous sa charge la compense',
      ],
      ['Reste de l’enveloppe', 'max(enveloppe − IA consommée ; 0)', 'Compté dans le RAF tant que la tâche n’est pas validée : on ne compte l’économie qu’une fois constatée'],
      ['Résultat', 'enveloppe − IA consommée', 'Constaté à la validation ; avant, projection avec l’atterrissage (consommé + RAF)'],
      ['Statut IA', 'Économie totale (rien consommé) · partielle · Conforme · Dépassement', '« À justifier » : tâche validée avec un écart et sans commentaire'],
      ['Valeur', 'résultat × TJM du profil IA (valeur préservée) ; × CJM (coût évité)'],
      ['Taux d’économie', 'économie réalisée ÷ enveloppe des tâches validées'],
    ],
  ],
  conso: [
    'Consommé réel par profil',
    [
      ['JH', 'Σ jours saisis par profil et par mois'],
      ['Coût interne', 'JH × CJM du profil'],
      ['Valeur produite', 'JH × TJM du profil (remise déduite)'],
      ['Mensuel', 'affiché pour chaque mois où du consommé est saisi'],
      ['Cumul', 'somme des mois jusqu’au mois affiché, jusqu’au dernier mois saisi'],
    ],
  ],
  prevuAx: ['Prévu par axe et profil', [['Prévu', 'Σ prévu des tâches de l’axe, par profil (vendu + ajouts − annulations)']]],
  consoAx: [
    'Consommé par axe et profil',
    [
      ['Consommé', 'Σ jours saisis des tâches de l’axe, par profil'],
      ['% du prévu', 'consommé ÷ prévu de l’axe'],
    ],
  ],
  couts: [
    'Coûts à l’atterrissage',
    [
      ['Coût prévu', 'Σ prévu × CJM'],
      ['Coût consommé', 'Σ consommé × CJM'],
      [
        'Coût RAF',
        'Σ par tâche : RAF × CJM des profils qui restent à intervenir',
        'RAF automatique calculé profil par profil : un profil en dépassement ne compense pas un profil qui n’a pas travaillé',
      ],
      ['Coût à l’atterrissage', 'coût consommé + coût RAF'],
      [
        'Écart / coût prévu',
        'coût à l’atterrissage − coût prévu (TSP + ajouts − annulations)',
        'Négatif : tâches finies sous leur budget, RAF réduit ; positif : dépassement',
      ],
    ],
  ],
  echeances: [
    'Échéances',
    [
      ['Montant', '% de l’échéance × CA du forfait', 'Après un avenant, la réduction est répartie sur les échéances non facturées'],
      ['Statut', 'Payée si « Payée le » ; Facturée si « Facturée le » ; En retard si la date prévue est dépassée ; sinon Planifiée'],
      ['Prête à facturer', 'toutes les tâches liées (phase ou tâches) sont validées'],
    ],
  ],
  fae: [
    'Factures à établir (FAE)',
    [
      ['Facturé cumulé prévu', 'Σ montants des échéances jusqu’à celle-ci (ordre des dates prévues)'],
      ['Produit prévu', 'planning du TSP valorisé au TJM, cumulé jusqu’au mois de la date prévue'],
      ['FAE (€)', 'produit cumulé − facturé cumulé', 'Positif : production en avance, factures à établir ; négatif : facturation en avance'],
      [
        'FAE (%)',
        '− FAE (€) ÷ montant total des échéances',
        'Même base pour toutes les lignes. Le TSP change de base à partir de la 4ᵉ ligne (÷ coût engagé cumulé) : on garde une base unique',
      ],
      ['Réel', 'facturé réel = factures émises à la date de facture ; produit réel = consommé × TJM à cette date (ou fin de mois écoulé)'],
    ],
  ],
  planProfil: [
    'Planning par profil (TSP)',
    [
      ['Ecart ?', 'Σ des mois − charge du profil', '✓ quand toute la charge est répartie'],
      ['COUT MENSUEL', 'JH du mois × TJM du profil (remise déduite) : la valeur vendue du mois'],
      ['COUT MENSUEL CUMULE', 'somme des mois précédents'],
    ],
  ],
  planPhase: [
    'Planning par phase (TSP)',
    [
      ['Charge par phase', 'Σ charges des tâches du WORKLOAD de la phase'],
      ['Ecart ?', 'Σ des mois − charge par phase'],
      ['Écart avec le tableau par profil', 'total par phase − total par profil, mois par mois'],
    ],
  ],
  synthese: [
    'Synthèse du TSP (formules de l’onglet SYNTHESE)',
    [
      ['Montant du projet', 'jours valorisés + achats à refacturer + frais à refacturer'],
      ['Jours valorisés', 'Σ charge × TJM du profil × (1 − remise)'],
      ['Coût du projet EN', 'Σ charge × CJM du profil', 'CJM de production = coût ÷ jours ; TJM client = jours valorisés ÷ jours'],
      ['Marge brute EN', '(jours valorisés − coût EN) ÷ jours valorisés'],
      ['Marge brute Agence', '(jours valorisés − coût agence) ÷ jours valorisés', 'Coût agence : FO = CJM ; CESSION = (TJM − CJM) ÷ 2 + CJM + frais ÷ 2 ÷ jours ; ACHAT = CJM ; BO = PRCS (450 par défaut) + frais ÷ jours'],
      ['Frais non refacturés / jour', '(frais − frais à refacturer) ÷ jours'],
      ['Provision pour risque', 'Σ charge et valorisation des tâches de phase « PROVISION » ; % = valorisation ÷ jours valorisés'],
      ['Marge des achats', 'achats à refacturer − achats ; % = marge ÷ revente (vide sans achat)'],
      ['Marge nette EN', 'jours valorisés − coût EN + marge achats + frais à refacturer − frais', '% = marge nette ÷ montant du projet'],
      ['Par entité', 'mêmes calculs, profils de l’entité seulement ; taux de cession interne = coût agence ÷ jours ; TOTAL BO = BO + ACHAT BO'],
      ['PRCS moyen du BACK', 'coût agence BO et ACHAT BO ÷ leurs jours', 'Marge FRONT / BACK = (TJM du TOTAL BO − PRCS moyen) ÷ TJM du TOTAL BO'],
      ['Tableaux croisés', 'Σ charge et valorisation des tâches par phase et par étape, filtrées par lot'],
    ],
  ],
  profils: [
    'Profils',
    [
      ['CA vendu', 'jours vendus × TJM (remise déduite)'],
      ['Coût EN', 'jours × CJM'],
      ['Part JH / Part CA', 'jours (ou CA) du profil ÷ total'],
      ['Marge brute EN', '(CA − coût EN) ÷ CA'],
      ['Marge brute agence', '(CA − coût agence) ÷ CA'],
    ],
  ],
  depenses: [
    'Achats et frais',
    [
      ['Réel saisi', 'Σ des lignes saisies (HT)'],
      ['Reste à engager', 'budget TSP − réel rattaché au TSP'],
      ['Atterrissage des achats', 'le plus élevé du budget et du réel, ligne par ligne (+ hors TSP)'],
      ['Atterrissage des frais', 'deux enveloppes : refacturables (remboursés par le client) et à notre charge (budget − refacturé)', 'Frais non refacturé au-delà de la part à notre charge prévue au TSP : perte'],
      ['Effet sur la marge nette', 'refacturé − atterrissage'],
    ],
  ],
};

/** Une carte dont le titre commence par l'une de ces clés reçoit son bouton ƒx. */
const FX_TITLES: readonly [string, CleFormule][] = [
  ['Atterrissage par', 'atter'],
  ['Planning projet', 'plan'],
  ['Optimisation du temps', 'ia'],
  ['Consommé réel par profil', 'conso'],
  ['Prévu par ', 'prevuAx'],
  ['Consommé par ', 'consoAx'],
  ['Coûts à l’atterrissage', 'couts'],
  ['Résultat par tâche', 'ia'],
  ['Économies par levier', 'ia'],
  ['Échéances', 'echeances'],
  ['Factures à établir', 'fae'],
  ['Planning par profil', 'planProfil'],
  ['Planning par phase', 'planPhase'],
  ['Points de vigilance', 'vigilance'],
];

/** Formule associée au titre d'une carte (ou null). */
export function formuleDuTitre(titre: string): CleFormule | null {
  return FX_TITLES.find(([p]) => titre.startsWith(p))?.[1] ?? null;
}

/** Repères : vocabulaire et règles, accessibles depuis la barre d'onglets. [titre, [notion, définition, aussi affiché ?][]] */
export const REPERES: readonly [string, [string, string, string?][]][] = [
  [
    'Unités',
    [
      ['JH', 'jour-homme : une journée de travail d’une personne (mesure de charge).'],
      ['j', 'jour ouvré : mesure de délai (calendrier, glissement).'],
      [
        'TJM',
        'taux journalier moyen : prix de vente d’un jour au client, remise déduite. Dans Annexes › Planning, la colonne TJM et les lignes « COUT MENSUEL » sont au TJM (valeur vendue).',
      ],
      ['CJM', 'coût journalier moyen : coût interne d’un jour pour Exakis Nelite (EN).'],
      ['HT', 'tous les montants sont hors taxes.'],
    ],
  ],
  [
    'Charges, dans cet ordre',
    [
      ['Vendu', 'charge du TSP, figée : c’est le contrat.', 'TSP vendu, Vendu (JH)'],
      [
        'Réaffecté',
        'charge retirée à un profil (−) et confiée à un autre (+) : même total, le coût suit le CJM de la personne qui fait le travail.',
        'Réaffectation (Rentabilité › Évolutions du périmètre)',
      ],
      [
        'Prévu',
        'vendu ± réaffectations + ajouts en cours de projet − annulations.',
        'Charge prévue (tableau de bord), Charge (Ateliers & livrables), Charge par profil / par phase (Planning)',
      ],
      [
        'Consommé',
        'jours saisis dans Workload › Saisie du consommé (1 JH maximum par personne et par jour, sauf profils des entités ACHAT et CESSION).',
      ],
      [
        'RAF',
        'reste à faire : vide = calcul automatique profil par profil, Σ max(prévu − consommé ; 0) ; pour l’Agent IA : reste de l’enveloppe (un profil en dépassement ne compense pas un profil qui n’a pas travaillé) ; 0 dès que la tâche est validée.',
        'Reste à faire, Reste',
      ],
      ['Atterrissage', 'consommé + RAF : la projection à la fin du projet. Écart = atterrissage − prévu.', 'à terminaison'],
      [
        'Reste à ventiler',
        'total réparti sur les mois − charge du profil ou de la phase, dans le planning du TSP ; ✓ quand tout est réparti.',
        'Ecart ? (Annexes › Planning)',
      ],
    ],
  ],
  [
    'Argent',
    [
      ['CA vendu', 'jours du TSP valorisés au TJM (remise déduite).', 'CA vendu (jours)'],
      ['CA du forfait', 'CA vendu − avenants de réduction.', 'CA de … (tuile Marge sur production)'],
      ['Montant du contrat', 'CA vendu + achats et frais refacturés prévus au TSP.'],
      ['Coût à l’atterrissage', 'consommé et RAF valorisés au CJM.', 'Coût final estimé, Coût de production (Rentabilité)'],
      ['Marge sur production', 'CA du forfait − coût à l’atterrissage (jours uniquement). Taux = marge ÷ CA du forfait.'],
      [
        'Marge nette à terminaison',
        'marge sur production + achats et frais (refacturé − coût), à l’atterrissage. Taux = marge nette ÷ (CA + achats et frais refacturés) : à euros égaux, il est plus bas que celui de la marge sur production quand des frais sont refacturés.',
        'Marge nette (Rentabilité, liste des projets, portefeuille)',
      ],
      ['Marge nette vendue', 'la même marge nette, calculée sur le TSP signé ÷ montant du contrat.', 'Marge vendue'],
      ['Marge brute EN', 'marge Exakis Nelite du TSP : (CA − coût EN) / CA.'],
    ],
  ],
  [
    'Facturation',
    [
      [
        'Échéance',
        'tranche de facturation du contrat (onglet ECHEANCIER du TSP). Le mot n’est employé que pour la facturation ; une action a une « date cible ».',
      ],
      ['Facturée / Payée', 'facture émise à la date « Facturée le », puis réglée à la date « Payée le ».'],
      ['FAE', 'factures à établir : valeur produite cumulée (au TJM) − montant facturé cumulé. Négative = facturation en avance sur la production.'],
    ],
  ],
  [
    'Dates',
    [
      ['Prévu', 'dates saisies : début et fin prévus, date planifiée d’un atelier, livraison prévue.'],
      ['Réel', 'premier et dernier jour de consommé saisi.'],
      ['Réalisé / livré', 'date du dernier consommé quand la tâche passe « Validé ».'],
    ],
  ],
  [
    'Statuts et pilotage',
    [
      ['Statut de tâche', 'À faire, En cours, Bloqué / En attente, En recette, Validé. Validé ⇔ avancement 100 %.'],
      ['Statut d’un axe', 'calculé à partir de ses tâches.'],
      [
        'Enveloppe IA',
        'charge Agent IA d’une tâche : une réserve adossée à ses autres profils, qu’on cherche à ne pas consommer. Consommée seulement si la tâche dépasse la charge de ses profils.',
      ],
      [
        'Résultat IA',
        'enveloppe − IA consommée : économie (totale ou partielle), conforme ou dépassement ; expliqué par un levier ou une cause et un commentaire (bilan IA à la validation).',
      ],
      [
        'Criticité d’un risque',
        'probabilité × importance (4 niveaux chacune), de 1 à 16 : « Faible » de 1 à 3, « Moyen » de 4 à 6, « Fort » à partir de 8.',
      ],
      [
        'Profil principal',
        'profil qui porte le plus de charge sur la tâche (un profil, pas une personne).',
        'Responsable principal (Ateliers & livrables)',
      ],
      ['Responsable', 'personne qui porte une action ou un risque.'],
    ],
  ],
  [
    'Où trouver quoi',
    [
      ['Workload', 'Liste des tâches · Saisie du consommé · Optimisation IA.'],
      ['Ateliers & livrables', 'un registre par type de tâche, regroupé par axe ; colonnes à masquer (menu ☰).'],
      ['Annexes › Planning', 'planning initial du TSP par profil et par phase, en lecture seule.'],
    ],
  ],
];

/** Onglets : Pilotage (quotidien) · Finances (l'argent) · TSP (la référence vendue) · Réglages. */
export interface Onglet {
  chemin: string;
  libelle: string;
  /** Libellé court (écrans moyens). */
  court?: string;
  /** Réservé aux rôles qui voient les montants. */
  montants?: boolean;
}

export interface GroupeOnglets {
  groupe: string;
  classe: 'pil' | 'fin' | 'tsp' | 'set';
  onglets: Onglet[];
  annexes?: Onglet[];
}

export const ONGLETS: readonly GroupeOnglets[] = [
  {
    groupe: 'Pilotage',
    classe: 'pil',
    onglets: [
      { chemin: 'tableau-de-bord', libelle: 'Tableau de bord' },
      { chemin: 'workload', libelle: 'Workload' },
      { chemin: 'gantt', libelle: 'Gantt' },
      { chemin: 'ateliers', libelle: 'Ateliers & livrables', court: 'Ateliers' },
      { chemin: 'actions', libelle: 'Actions & décisions', court: 'Actions' },
    ],
  },
  {
    groupe: 'Finances',
    classe: 'fin',
    onglets: [
      { chemin: 'rentabilite', libelle: 'Rentabilité', montants: true },
      { chemin: 'plan-de-charge', libelle: 'Plan de charge', court: 'Charge', montants: true },
      { chemin: 'facturation', libelle: 'Facturation', montants: true },
      { chemin: 'achats', libelle: 'Achats', montants: true },
      { chemin: 'frais', libelle: 'Frais', montants: true },
    ],
  },
  {
    groupe: 'TSP',
    classe: 'tsp',
    onglets: [
      { chemin: 'fiche', libelle: 'Fiche' },
      { chemin: 'synthese', libelle: 'Synthèse', montants: true },
      { chemin: 'profils', libelle: 'Profils', montants: true },
      { chemin: 'chiffrage', libelle: 'Chiffrage' },
    ],
    annexes: [
      { chemin: 'planning', libelle: 'Planning' },
      { chemin: 'metrique', libelle: 'Métrique' },
      { chemin: 'ventilation', libelle: 'Ventilation' },
    ],
  },
  { groupe: 'Réglages', classe: 'set', onglets: [{ chemin: 'parametres', libelle: 'Paramètres du projet' }] },
];
