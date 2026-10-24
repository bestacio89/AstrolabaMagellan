import { PointsHebdo } from '../etat/point-hebdo.logique';

/**
 * Données de l'écran de suivi, telles que l'API les envoie (GET /api/projets/:id/suivi).
 * Les noms sont ceux de la version de référence (POC v65) : « projet » = le fichier de suivi, « modele » = les indicateurs calculés.
 * Les champs marqués « montant » sont absents pour les rôles qui ne voient pas les montants (consultant, lecteur).
 * Dates : texte « AAAA-MM-JJ » ; mois : « AAAA-MM ».
 */

export interface Suivi {
  projet: ProjetSuivi;
  modele: Modele;
  droits: Droits;
  aujourdhui: string;
}

export interface Droits {
  role: string;
  roleLibelle: string;
  peutModifier: boolean;
  peutSaisirConsomme: boolean;
  voitMontants: boolean;
  peutExporter: boolean;
  utilisateur: string;
  utilisateurId?: string;
  /** Projet archivé : tout est en lecture seule. */
  archive?: boolean;
  /** Chef de projet (même archivé) : peut restaurer le projet, ou le supprimer s'il a été créé par erreur. */
  estChefDeProjet?: boolean;
}

export interface ResultatSaisie {
  suivi: Suivi;
  messages: MessageSaisie[];
  ouvrir: string | null;
}

export interface MessageSaisie {
  texte: string;
  ton: 'info' | 'succes' | 'attention' | 'erreur';
  action: string | null;
  cible: string | null;
  libelleAction: string | null;
}

// ------------------------------------------------------------------ projet (saisies)

export interface Ajout {
  at: string | null;
  by: string | null;
  motif: string | null;
  after?: string | null;
}

export interface ProjetSuivi {
  id: string;
  version: number;
  statut: string;
  fiche: Fiche;
  periode: { start: string | null; end: string | null } | null;
  remise?: number;
  remiseSaisie: boolean;
  caInitial?: number | null;
  profiles: Profil[];
  grille?: LigneGrille[];
  tasks: TacheTsp[];
  track: Record<string, SuiviTache>;
  settings: Parametres;
  dates: { debut: string | null; finContrat: string | null; finPrevue: string | null };
  ref: { phases: string[]; etapes: string[] };
  axes: Record<string, string>;
  datesLimitesAxes?: Record<string, string | null>;
  lots?: Record<string, string>;
  types: TypeTache[];
  frais?: FraisBudget[];
  achats?: AchatBudget[];
  prestas?: Presta[];
  metrique: { etape: string; pct: number }[];
  /** Prévisionnel de charge par profil et par mois (au départ le planning vendu, replanifiable). */
  planningRef: { months: string[]; rows: number[][] };
  /** Planning vendu (onglet PLANNING du TSP), figé : référence du prévisionnel. */
  planningTsp?: { months: string[]; rows: number[][] } | null;
  /** Planning (vue d'ensemble) : dates saisies par ligne, jalons, éléments mis en avant, lignes masquées. */
  planning?: PlanningProjet;
  planningPhases: { rows: { phase: string; cjm: string | null; vals: Record<string, number> }[]; source: string | null };
  planningSource: string | null;
  echeancier: { n: number; nom: string; pct: number; mois: string | null }[];
  echTrack: Record<string, SuiviEcheance>;
  achatsReel?: AchatReel[];
  fraisReel?: FraisReel[];
  actions: Action[];
  decisions: Decision[];
  risques: Risque[];
  historique: Photo[];
  warnings: string[];
  source: { fichier: string; importeLe: string } | null;
  journal: EntreeJournal[];
  /** Plannings de référence figés, du plus ancien au plus récent. */
  references: PlanReference[];
  /** Causes possibles d'un écart au planning de référence. */
  causes: string[];
  /** Fil de mises à jour de chaque tâche (clé : repère), du plus récent au plus ancien. */
  misesAJour: Record<string, MiseAJour[]>;
  commentaires?: Record<string, Commentaire[]>;
  /** Personnes ajoutées à la main au planning des absences (hors profils du TSP). */
  personnesAjoutees?: { id: string; nom: string }[];
  /** Absences de l'équipe sur la période du projet (personne = nom normalisé ; moment : j, m ou a). */
  absences?: AbsenceEquipe[];
  /** Point hebdo : réglages et saisie par période (absent pour les rôles qui ne voient pas les montants). */
  pointsHebdo?: PointsHebdo | null;
}

/** Planning de la vue d'ensemble (même forme que planning.* de la version HTML, avec identifiants et versions). */
export interface PlanningProjet {
  /** Dates saisies (et nom d'une sous-partie), par clé de ligne : « id|AXE1 », « phase|X », « sec|r12|AXE1 », « sec|r12 ». */
  groupes: Record<string, { id: string; version: number; debut: string | null; fin: string | null; nom: string | null }>;
  jalons: Jalon[];
  /** Sous-parties et tâches mises en avant (« sec|r12|AXE1 », « tache|r15 »). */
  avant: Record<string, boolean>;
  /** Lignes masquées sur la vue d'ensemble (rien n'est supprimé du suivi). */
  masque: Record<string, boolean>;
}

export interface Jalon {
  id: string;
  version: number;
  libelle: string;
  type: 'date' | 'periode' | 'semaine';
  debut: string;
  fin: string | null;
  aConfirmer: boolean;
}

export interface PlanReference {
  id: string;
  libelle: string;
  date: string;
  par: string | null;
  /** Clé : repère de la tâche. */
  lignes: Record<string, LigneReference>;
  /** Dates prévues des lignes du planning (axes, lots ou phases, sous-parties) figées avec la référence. */
  groupes?: Record<string, { debut: string | null; fin: string | null; nom: string | null }>;
}

export interface LigneReference {
  version: number;
  debut: string | null;
  fin: string | null;
  /** Charge prévue (JH) au moment où la référence a été figée. */
  charge: number;
  cause: string | null;
  motif: string | null;
}

export interface Commentaire {
  id: string;
  at: string;
  by: string;
  auteurId: string | null;
  texte: string;
  modifieLe: string | null;
}

export interface MiseAJour {
  at: string;
  by: string;
  texte: string;
}

export interface Fiche {
  client: string;
  projet: string;
  reference: string;
  typeContrat: string;
  champs: { key: string; label: string; value: string }[];
}

export interface Profil {
  id: string;
  version: number;
  nom: string;
  entite: string;
  tjm?: number;
  cjm?: number;
  prcs?: number | null;
  frais?: number;
  collaborateur: string;
  ajout: Ajout | null;
}

export interface LigneGrille {
  profil: string;
  tjmParis: number;
  cjmParis: number;
  tjmRegion: number;
  cjmRegion: number;
}

export interface TacheTsp {
  uid: string;
  version: number;
  ligne: number | null;
  id: string;
  lot: string;
  phase: string;
  etape: string;
  label: string;
  charges: number[];
  section: boolean;
  livrable: string;
  hypothese: string;
  ajout: Ajout | null;
  /** La colonne « Livrable » du TSP dit seule ce qu'est un livrable (repère posé à l'import). */
  livCol?: boolean;
}

export interface SuiviTache {
  label?: string | null;
  statut?: string | null;
  avancement?: number | null;
  raf?: number | null;
  debut?: string | null;
  fin?: string | null;
  commentaire?: string | null;
  type?: string | null;
  axe?: string | null;
  phase?: string | null;
  lot?: string | null;
  valideLe?: string | null;
  iaType?: string | null;
  iaJustif?: string | null;
  ech?: number | null;
  annul?: { at: string | null; by: string | null; motif: string | null; avenant: boolean; decision: string | null } | null;
  chargeAjout?: Record<string, number> | null;
  ajoutInfo?: Record<string, Ajout> | null;
  consoP?: Record<string, Record<string, number>> | null;
  /** Réaffectations de charge d'un profil à un autre (index de profils), dans l'ordre où elles ont été faites. */
  reaff?: Reaffectation[] | null;
  atelier?: Atelier | null;
  /** Suivi du livrable : validation client et adresse du document livré. */
  livr?: { valideLe: string | null; lien?: string | null } | null;
}

export interface Atelier {
  date: string | null;
  heureDebut: string | null;
  heureFin: string | null;
  invit: boolean;
  invitLe: string | null;
  dest: string[];
}

export interface Parametres {
  groupBy: 'id' | 'lot' | 'phase';
  iaProfile: number;
  iaLeviers: string[] | null;
  iaCauses: string[] | null;
  alerteActionsJours: number | null;
  alerteAtelierJours: number | null;
  alerteLivrableJours: number | null;
  alerteEchJours: number | null;
  lastCoproj: string | null;
  startMonth: string | null;
  nbMonths: number;
  /** Instances de gouvernance du projet ; null : liste par défaut. */
  instances?: string[] | null;
}

export interface TypeTache {
  id: string;
  nom: string;
  socle: boolean;
}

export interface FraisBudget {
  libelle: string;
  cu: number;
  qte: number;
  refacture: number;
  commentaire: string;
}

export interface AchatBudget {
  designation: string;
  type: string;
  cu: number;
  qte: number;
  revente: number;
  commentaire: string;
}

export interface Presta {
  designation: string;
  societe: string;
  coutJour: number;
  nbj: number;
  tjm: number;
  commentaire: string;
}

export interface SuiviEcheance {
  version: number;
  datePrevue: string | null;
  realiseLe: string | null;
  payeeLe: string | null;
  montantFacture?: number | null;
  commentaire: string | null;
  phases: string[];
}

export interface AchatReel {
  id: string;
  version: number;
  date: string;
  designation: string;
  fournisseur: string;
  ligne: number | null;
  qte: number;
  cu: number;
  montant: number;
  refacture: number;
  statut: string;
  commentaire: string;
  cree: string;
  par: string | null;
}

export interface FraisReel {
  id: string;
  version: number;
  date: string;
  collaborateur: string;
  categorie: string;
  libelle: string;
  montant: number;
  refacturable: boolean;
  refacture: number;
  commentaire: string;
  cree: string;
  par: string | null;
}

export interface Action {
  id: string;
  version: number;
  ref: string;
  libelle: string;
  porteur: string;
  origine: string;
  cree: string;
  echeance: string | null;
  progression: number;
  statut: string;
  faitLe: string | null;
  commentaire: string;
  tache: string | null;
  par: string | null;
}

export interface Decision {
  id: string;
  version: number;
  ref: string;
  date: string;
  instance: string;
  libelle: string;
  decideur: string;
  impact: string;
  statut: string;
  commentaire: string;
  par: string | null;
}

export interface Risque {
  id: string;
  version: number;
  ref: string;
  libelle: string;
  /** Faible, Modérée, Forte, Très forte. */
  proba: string;
  /** Importance (nom d'origine : impact) : Faible, Moyenne, Forte, Critique. */
  impact: string;
  /** Criticité = probabilité × importance (1 à 16). */
  crit: number;
  /** faible (1 à 3), moyen (4 à 6), fort (8 et plus). */
  niveau?: 'faible' | 'moyen' | 'fort';
  /** Retard, Qualité, Budget, ou vide. */
  type?: string;
  cause?: string;
  /** « Comment réduire ». */
  parade: string;
  /** Plan d'actions. */
  plan?: string;
  responsable: string;
  statut: string;
  action: string | null;
  commentaire: string;
  cree: string;
  par: string | null;
}

export interface Photo {
  date: string;
  kind: string;
  prevu: number;
  conso: number;
  raf: number;
  atterrissage: number;
  coutFinal?: number;
  marge?: number;
  margeNette?: number;
  tauxMargeNette?: number;
  finPrevue: string | null;
}

export interface EntreeJournal {
  at: string;
  by: string;
  objet: string;
  champ: string;
  ancienne: string | null;
  nouvelle: string | null;
}

// ------------------------------------------------------------------ modèle (indicateurs calculés)

export interface DateLimiteAxe {
  code: string; date: string; etat: 'tenue' | 'tard' | 'depassee' | 'risque' | 'ok'; libelle: string; niveau: string;
  jours: number; ecart: number | null; finMax: string | null; n: number; valides: number; ouvertes: number;
  auDela: { uid: string; libelle: string; fin: string | null; statut: string }[];
}

export interface Modele {
  p: Personne[];
  months: string[];
  moisDebut: string;
  moisFin: string;
  cal: CalendrierProjet;
  dim: { key: 'id' | 'lot' | 'phase'; label: string; col: string };
  tasks: TacheCalculee[];
  profils: ProfilCalcule[];
  synthese?: Synthese;
  ventilation: Ventilation;
  metrique: { etape: string; pct: number; theorique: number; propale: number; pctProjet: number | null; ecart: number | null }[];
  axes: Groupe[];
  total: Statistiques;
  mensuel: MoisCalcule[];
  /** Total du prévisionnel de charge. */
  refTotal: number;
  /** Total du planning vendu (TSP). */
  tspTotal?: number;
  /** Le prévisionnel diffère du planning vendu sur au moins un profil et un mois. */
  replanifie?: boolean;
  /** Jalons du projet, dans l'ordre des dates (numéro absent pour un jalon à confirmer). */
  jalons?: JalonCalcule[];
  /** Codes d'axe portés par au moins une tâche (couleur des axes). */
  axeIdsActifs?: string[];
  /** Avancement détaillé : groupe › sous-partie (lot, ou phase quand on regroupe par lot) › tâches. */
  avancement?: ArbreAvancement;
  financier?: Financier;
  perimetre: Perimetre;
  surJours: { i: number; d: string; v: number }[];
  echeancier: EcheanceCalculee[];
  echSynth?: { facture: number; paye: number; reste: number; produit: number; faeADate: number; ajustAvenant: number };
  risques: { ref: string; libelle: string; proba: string; impact: string; statut: string; crit: number; niveau?: 'faible' | 'moyen' | 'fort'; ouvert: boolean }[];
  ateliers: { ateliers: Compteur; livrables: Compteur; parType: CompteurType[] };
  ia: Ia;
  vigilance: PointVigilance[];
  datesLimitesAxes?: DateLimiteAxe[];
  nonDatees: string[];
}

export interface Personne {
  i: number;
  nom: string;
  nomBase: string;
  entite: string;
  tjm?: number;
  tjmR?: number;
  cjm?: number;
  prcs?: number | null;
  frais?: number;
  collaborateur: string;
  estAjout: boolean;
}

export interface CalendrierProjet {
  debut: string | null;
  finContrat: string | null;
  finPrevue: string | null;
  joursTotal: number | null;
  joursEcoules: number | null;
  joursRestants: number | null;
  tempsPct: number | null;
  consoPct: number | null;
  glissementJours: number | null;
  glissementOuvres: number | null;
}

/** Une partie de la charge du profil `de` est confiée au profil `vers` : le total de la tâche ne change pas. */
export interface Reaffectation {
  id: string;
  de: number;
  vers: number;
  jh: number;
  motif: string | null;
  at: string | null;
  by: string | null;
}

export interface TacheCalculee {
  uid: string;
  cibleId?: string;
  ligne: number | null;
  id: string;
  label: string;
  labelTSP: string;
  axe: string;
  phase: string;
  lot: string;
  etape: string;
  hypothese: string;
  charge: number;
  charges: number[];
  chargesV: number[];
  chargesA: number[];
  chargeTSP: number;
  chargeAjout: number;
  estAjout: boolean;
  annulee: boolean;
  annul: { at: string | null; by: string | null; motif: string | null; avenant: boolean } | null;
  chargeInit: number;
  chargesAnnul: number[];
  chargeAnnulee: number;
  coutAnnule?: number;
  caAvenant?: number;
  valo?: number;
  coutPrevu?: number;
  coutPrevuTSP?: number;
  coutAjout?: number;
  /** Charge déplacée par les réaffectations, par profil (négative pour qui cède, positive pour qui reçoit). */
  chargesR: number[];
  reaff: Reaffectation[];
  /** Écart de coût des réaffectations (absent pour qui ne voit pas les montants). */
  coutReaff?: number;
  consoTotal: number;
  consoP: number[];
  restP: number[];
  statut: string;
  avancement: number;
  rafAuto: number;
  rafSaisi: number | null;
  raf: number;
  atterrissage: number;
  ecart: number;
  rafAReestimer: boolean;
  rafSuggere: number | null;
  rafIncoherent: boolean;
  coutConso?: number;
  coutRaf?: number;
  debut: string | null;
  fin: string | null;
  debutAuto: boolean;
  finAuto: boolean;
  type: string;
  typeManuel: boolean;
  responsable: string;
  ia: number;
  iaHum: number;
  iaConso: number;
  iaRes: number | null;
  iaStatut: string | null;
  iaAJustifier: boolean;
  iaType: string;
  iaJustif: string;
  commentaire: string;
  consoDates: string[];
  realiseLe: string | null;
  debutPrevu: string | null;
  finPrevue: string | null;
  echN: number | null;
  echViaPhase: boolean;
  grp: string;
}

export interface ProfilCalcule {
  i: number;
  nom: string;
  entite: string;
  tjm?: number;
  cjm?: number;
  charge: number;
  ca?: number;
  coutEN?: number;
  coutAgence?: number;
  tci?: number | null;
  margeEN?: number | null;
  margeAgence?: number | null;
  pctJH: number | null;
  pctCA?: number | null;
  ajoutJH: number;
  ajoutCout?: number;
}

export interface Synthese {
  montantProjet: number;
  jours: number;
  ca: number;
  cout: number;
  coutAgence: number;
  cjmProd: number | null;
  tjmClient: number | null;
  margeAgence: number | null;
  margeEN: number | null;
  fraisDep: number;
  fraisRef: number;
  fraisNonRefJour: number | null;
  provJH: number;
  provEur: number;
  provPct: number | null;
  achatsMt: number;
  achatsRef: number;
  margeAchats: number;
  margeAchatsPct: number | null;
  margeNette: number;
  margeNettePct: number | null;
  parEntite: LigneEntite[];
  parPhase: LignePivot[];
  parEtape: LignePivot[];
  /** Les cinq entités (FO, CESSION, ACHAT, BO, ACHAT BO), même vides, dans l'ordre de l'onglet SYNTHESE. */
  entites: LigneEntite[];
  /** BO + ACHAT BO. */
  totalBo: LigneEntite | null;
  prcsMoyenBack: number | null;
  margeFrontBack: number | null;
  /** Tâches vendues : pour les tableaux croisés filtrés par lot. */
  lignes: LigneVente[];
}

export interface LigneEntite {
  entite: string;
  jours: number;
  ca: number;
  tjm: number | null;
  cjm: number | null;
  coutAgenceJour: number | null;
  margeEN: number | null;
  margeAgence: number | null;
}

export interface LigneVente {
  lot: string;
  phase: string;
  etape: string;
  charge: number;
  valo: number;
}

export interface LignePivot {
  cle: string;
  charge: number;
  valo: number;
}

export interface Ventilation {
  parPhase: { cle: string; parProfil: number[]; total: number }[];
  parEtape: { cle: string; parProfil: number[]; total: number }[];
  totalProfil: number[];
  montantProfil?: number[];
  sansEtape: number;
  sansEtapeParProfil: number[];
}

export interface Statistiques {
  n: number;
  prevu: number;
  conso: number;
  raf: number;
  atterrissage: number;
  ecart: number;
  prevuTSP: number;
  ajout: number;
  nAjout: number;
  annule: number;
  nAnnul: number;
  coutPrevu?: number;
  coutConso?: number;
  coutRaf?: number;
  coutFinal?: number;
  prevuP: number[];
  consoP: number[];
  prevuDebut: string | null;
  prevuFin: string | null;
  reelDebut: string | null;
  reelFin: string | null;
  debut: string | null;
  fin: string | null;
  dated: number;
  valides: number;
  actives: number;
  /** Avancement = JH des tâches validées ÷ JH prévus (jamais déduit du consommé). */
  avancement: number;
  /** Avancement déclaré (paliers des tâches pondérés par la charge) : indication seulement. */
  avDeclare?: number;
  statut: string;
  ateliers: number;
  ateliersOK: number;
  livrables: number;
  livrablesOK: number;
  ia: number;
  iaRetenu: number;
  iaRes: number;
}

/** Ligne du Planning : dates prévues saisies, sinon celles des tâches. */
export interface LignePlanifiee extends Statistiques {
  cle?: string;
  planDebut?: string | null;
  planFin?: string | null;
  planSaisi?: boolean;
  planDebutSaisi?: boolean;
  planFinSaisi?: boolean;
}

export interface Groupe extends LignePlanifiee {
  id: string;
  nom: string;
  /** Axe découpé en sous-parties : prévu calculé sur ce qu'il contient, sans saisie propre. */
  planCalcule?: boolean;
  /** Axe découpé dont au moins une sous-partie a des dates saisies. */
  planDeSaisies?: boolean;
  /** Dates saisies sur l'axe avant son découpage : gardées, plus utilisées. */
  planAncien?: { debut: string | null; fin: string | null } | null;
  /** Sous-parties (regroupement par axe) : lignes de titre du TSP. */
  sousParties?: SousPartie[];
}

export interface SousPartie extends LignePlanifiee {
  id: string;
  nom: string;
  nomTSP: string;
  axe: string;
  uids: string[];
}

export interface JalonCalcule {
  id: string;
  libelle: string;
  type: string;
  debut: string | null;
  fin: string | null;
  aConfirmer: boolean;
  numero: number | null;
}

export interface ArbreAvancement {
  /** « lot » ou « phase » : ce qui découpe chaque groupe. */
  cle: 'lot' | 'phase';
  groupes: { id: string; nom: string; sous: { id: string; nom: string; stat: Statistiques; taches: string[] }[] }[];
}

export interface MoisCalcule {
  mois: string;
  consoP: number[];
  conso: number;
  refP: number[];
  ref: number;
  /** Planning vendu (TSP) du mois. */
  tspP?: number[];
  tsp?: number;
  coutCJM?: number;
  cumCJM?: number;
  valoTJM?: number;
  cumTJM?: number;
  refTJM?: number;
  cumRefTJM?: number;
}

export interface Financier {
  ca: number;
  caTSP: number;
  caAvenant: number;
  coutInitial: number;
  coutAjout: number;
  coutAnnule: number;
  /** Écart de coût des réaffectations (CJM différents). */
  coutReaff: number;
  coutPrevu: number;
  coutConso: number;
  coutRaf: number;
  coutFinal: number;
  marge: number;
  tauxMarge: number;
  ecartCout: number;
  achats: AchatsCalcules;
  frais: FraisCalcules;
  margeNette: number;
  tauxMargeNette: number;
  margeNetteVendue: number;
  tauxMargeNetteVendue: number | null;
}

export interface AchatsCalcules {
  parLigne: { i: number; designation: string; budget: number; budgetRev: number; reel: number; reelRev: number; n: number; att: number; attRev: number }[];
  hors: number[];
  budget: number;
  budgetRev: number;
  reel: number;
  reelRev: number;
  horsTSP: number;
  att: number;
  attRev: number;
  reste: number;
  depasse: number;
  impactNet: number;
  parStatut: { cle: string; n: number; montant: number }[];
}

export interface FraisCalcules {
  budget: number;
  budgetRef: number;
  reel: number;
  reelRef: number;
  /** Frais réels non refacturés (à notre charge). */
  reelNonRef: number;
  /** Part des frais prévue à notre charge au TSP : budget − refacturé (0 si tout est refacturé). */
  budgetNonRef: number;
  /** Coût prévu des frais refacturables. */
  budgetRefCout: number;
  /** Atterrissage des frais refacturables (remboursés par le client). */
  attRefCout: number;
  /** Atterrissage des frais à notre charge : le plus élevé de la part prévue et du réel non refacturé. */
  attNonRef: number;
  att: number;
  attRef: number;
  reste: number;
  depasse: number;
  impactNet: number;
  parCategorie: { cle: string; n: number; montant: number }[];
  parCollab: { cle: string; n: number; montant: number }[];
}

export interface Perimetre {
  chargeTSP: number;
  chargeAjout: number;
  chargeAnnulee: number;
  chargeActuelle: number;
  coutAjout?: number;
  coutAnnule?: number;
  coutReaff?: number;
  caAvenant?: number;
  nReaff: number;
  nTaches: number;
  nProfilsTache: number;
  nAnnul: number;
  profilsAjoutes: number[];
  lignes: LignePerimetre[];
  margeVendue?: number | null;
  margeAvecAjouts?: number | null;
}

export interface LignePerimetre {
  kind: 'tache' | 'profil' | 'annul' | 'reaff';
  uid: string;
  label: string;
  i: number | null;
  /** Réaffectation : identifiant, profil qui cède et profil qui reçoit (index). */
  id?: string | null;
  de?: number | null;
  vers?: number | null;
  profils: string[];
  jh: number;
  cout?: number;
  conso: number;
  avenant: boolean;
  caAvenant?: number;
  at: string | null;
  by: string | null;
  motif: string | null;
}

export interface EcheanceCalculee {
  n: number;
  nom: string;
  pct: number;
  montant?: number;
  montantInit?: number;
  ajustAvenant?: number;
  mois: string | null;
  moisTSP: string | null;
  datePrevue: string | null;
  datePrevueAuto: boolean;
  realiseLe: string | null;
  payeeLe: string | null;
  commentaire: string;
  phases: string[];
  lies: string[];
  nLies: number;
  nLiesValides: number;
  avLie: number | null;
  pret: boolean;
  jours: number | null;
  statut: string;
  apresFin: boolean;
  factCum?: number;
  prodPlan?: number | null;
  faePlan?: number | null;
  factReel?: number | null;
  prodReel?: number | null;
  faeReel?: number | null;
  faePlanPct?: number | null;
  faeReelPct?: number | null;
}

export interface Compteur {
  prevus: number;
  realises: number;
  restants: number;
  taux: number;
}

export interface CompteurType extends Compteur {
  id: string;
  nom: string;
  socle: boolean;
  annules: number;
  charge: number;
}

export interface Ia {
  profil: string | null;
  ref: number;
  consomme: number;
  realise: number;
  envVal: number;
  projection: number;
  taux: number;
  tauxProj: number;
  valeurTJM?: number;
  valeurCJM?: number;
  projTJM?: number;
  tjm?: number;
  cjm?: number;
  validees: number;
  aJustifier: string[];
  parType: { type: string; n: number; jh: number; sens: 'eco' | 'dep' }[];
  leviers: string[];
  causes: string[];
  tasks: string[];
}

export interface PointVigilance {
  cle: string;
  label: string;
  valeur: number | string;
  unite: string | null;
  niveau: 'ok' | 'attention' | 'critique';
  detail: string | null;
}

/** Absence d'une personne de l'équipe : « j » journée, « m » matin, « a » après-midi. */
export interface AbsenceEquipe {
  /** Nom normalisé (sans accents, en minuscules, mots dans l'ordre alphabétique). */
  personne: string;
  jour: string;
  moment: 'j' | 'm' | 'a';
}
