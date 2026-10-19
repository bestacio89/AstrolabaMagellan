import { Synthese } from '../../suivi/api/modeles';
/**
 * Brouillon de projet : le TSP en cours de rédaction (mêmes noms que les objets C#, en camelCase).
 * Le contenu ne porte que ce qui se SAISIT dans un TSP ; tout le reste (synthèse, ventilation, métrique) est calculé par le serveur
 * et renvoyé dans l'analyse après chaque enregistrement.
 */

export interface FicheSaisie {
  client: string;
  projet: string;
  reference: string;
  contact: string;
  agence: string;
  serviceLine: string;
  directeur: string;
  responsableSL: string;
  commercial: string;
  typeContrat: string;
  debut: string | null;
  fin: string | null;
}

export interface ProfilSaisi {
  id: string;
  nom: string;
  entite: string;
  tjm: number;
  cjm: number;
  prcs: number | null;
  frais: number;
  collaborateur: string;
}

export interface TacheSaisie {
  id: string;
  axe: string;
  lot: string;
  phase: string;
  etape: string;
  libelle: string;
  /** Identifiant du profil → jours-homme. */
  charges: Record<string, number>;
  livrable: boolean;
  hypothese: string;
  /** Séparateur : un titre qui organise le workload (« Socle sécurité »), sans aucune valeur. */
  separateur: boolean;
}

export interface EcheanceSaisie {
  id: string;
  nom: string;
  /** Part du contrat (0,3 = 30 %). */
  pct: number;
  /** AAAA-MM */
  mois: string | null;
}

export interface AchatSaisi {
  id: string;
  designation: string;
  type: string;
  cu: number;
  qte: number;
  revente: number;
  commentaire: string;
}

export interface PrestataireSaisi {
  id: string;
  designation: string;
  societe: string;
  coutJour: number;
  nbj: number;
  tjm: number;
  commentaire: string;
}

export interface FraisSaisi {
  id: string;
  libelle: string;
  cu: number;
  qte: number;
  refacture: number;
  commentaire: string;
}

export interface TspSaisi {
  format: number;
  fiche: FicheSaisie;
  remise: number;
  profils: ProfilSaisi[];
  taches: TacheSaisie[];
  /** Identifiant du profil → mois (AAAA-MM) → jours-homme. */
  planning: Record<string, Record<string, number>>;
  echeances: EcheanceSaisie[];
  achats: AchatSaisi[];
  prestataires: PrestataireSaisi[];
  frais: FraisSaisi[];
  metrique: { etape: string; pct: number }[];
  phases: string[];
  etapes: string[];
}

export type NiveauControle = 'bloquant' | 'conseil' | 'ok';
export type EtatRubrique = 'ok' | 'conseil' | 'bloquant' | 'vide';
export type Rubrique = 'fiche' | 'profils' | 'workload' | 'planning' | 'echeancier' | 'depenses';

export interface Controle {
  cle: string;
  niveau: NiveauControle;
  titre: string;
  detail: string | null;
  rubrique: Rubrique;
}

export interface SyntheseBrouillon {
  montantProjet: number;
  jours: number;
  ca: number;
  cout: number;
  tjmMoyen: number | null;
  cjmProduction: number | null;
  tauxMarge: number | null;
  tauxMargeAgence: number | null;
  provisionJh: number;
  provisionPct: number | null;
  achats: number;
  frais: number;
  margeNette: number;
  tauxMargeNette: number | null;
}

export interface ProjetExistant {
  id: string | null;
  libelle: string | null;
  statut: string;
  archive: boolean;
  visible: boolean;
  message: string;
}

export interface AnalyseBrouillon {
  synthese: SyntheseBrouillon | null;
  /** Onglet SYNTHESE complet (même calcul que la Synthèse d'un projet lancé) ; null tant qu'il n'y a pas de chiffres. */
  vente: Synthese | null;
  parPhase: { cle: string; jours: number; part: number }[];
  metrique: { etape: string; pct: number; theorique: number; propale: number; pctProjet: number | null; ecart: number | null }[];
  profils: { index: number; charge: number; ca: number; cout: number; marge: number | null }[];
  controles: Controle[];
  rubriques: Record<Rubrique, EtatRubrique>;
  bloquants: number;
  projetExistant: ProjetExistant | null;
}

export interface Personne {
  id: string;
  nomComplet: string;
  email: string;
}

export interface Brouillon {
  id: string;
  version: number;
  contenu: TspSaisi;
  origine: string;
  origineCode: 'Vierge' | 'ImportTsp' | 'Copie';
  source: string | null;
  createur: Personne;
  coRedacteur: Personne | null;
  estCreateur: boolean;
  modifieLe: string;
  modifiePar: string | null;
  analyse: AnalyseBrouillon;
  suggestions: { entites: string[]; profils: string[]; typesAchat: string[]; typesContrat: string[] };
}

export interface BrouillonResume {
  id: string;
  client: string;
  nom: string;
  reference: string | null;
  origine: string;
  origineCode: 'Vierge' | 'ImportTsp' | 'Copie';
  modifieLe: string;
  modifiePar: string | null;
  createur: string;
  coRedacteur: string | null;
  estCreateur: boolean;
}

export interface BrouillonEnregistre {
  version: number;
  modifieLe: string;
  analyse: AnalyseBrouillon;
}

export interface CreationBrouillon {
  client: string;
  projet: string;
  reference: string | null;
  projetSource: string | null;
}
