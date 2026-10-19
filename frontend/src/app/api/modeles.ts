/**
 * Objets échangés avec l'API (mêmes noms que les DTO C#, en camelCase).
 * À terme, ce fichier pourra être généré automatiquement depuis la description de l'API (/openapi/v1.json).
 * Les dates sont des textes « AAAA-MM-JJ ». Les montants valent null quand le rôle ne permet pas de les voir.
 */

export interface Moi {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  roles: string[];
  peutCreerUnProjet: boolean;
  voitTousLesProjets: boolean;
}

/** « En préparation » / « En cours » se déduisent des dates et du temps saisi ; seul « Archivé » est un choix. */
export type CodeStatutProjet = 'EnPreparation' | 'EnCours' | 'Archive';
export type CodeRole = 'Consultant' | 'ChefDeProjet' | 'Pilotage' | 'Lecteur';
export type NiveauPoint = 'critique' | 'attention' | 'neutre';

export interface PointATraiter {
  cle: string;
  libelle: string;
  niveau: NiveauPoint;
  detail: string | null;
  valeur: string;
  unite: string | null;
}

export interface ProjetResume {
  id: string;
  nom: string;
  client: string;
  reference: string | null;
  statut: string;
  statutCode: CodeStatutProjet;
  monRole: string;
  monRoleCode: CodeRole;
  voitMontants: boolean;
  estVide: boolean;
  avancement: number;
  prevu: number;
  consomme: number;
  atterrissage: number;
  ecart: number;
  tauxMargeAtterrissage: number | null;
  tauxMargeVendue: number | null;
  debut: string | null;
  finPrevue: string | null;
  finContractuelle: string | null;
  joursOuvresRestants: number | null;
  chefDeProjet: string | null;
  creeLe: string;
  nombreATraiter: number;
  aTraiter: PointATraiter[];
}

export interface ApercuImport {
  nomFichier: string;
  client: string;
  projet: string;
  reference: string | null;
  debut: string | null;
  finContractuelle: string | null;
  nombreTaches: number;
  nombreProfils: number;
  nombreEcheances: number;
  nombreAxes: number;
  sourcePlanning: string | null;
  budgetsAchatsFrais: boolean;
  pointsReleves: string[];
  /** Projet qui suit déjà ce forfait : l'import sera refusé. */
  projetExistant: ProjetExistant | null;
}

/** Projet de même identité (numéro d'opportunité, sinon référence, sinon client et nom). Id et libellé : seulement si on y a accès. */
export interface ProjetExistant {
  id: string | null;
  libelle: string | null;
  statut: string;
  archive: boolean;
  visible: boolean;
  message: string;
}

export interface ProjetDetail {
  id: string;
  nom: string;
  client: string;
  reference: string | null;
  statut: string;
  statutCode: CodeStatutProjet;
  origine: string;
  monRole: string;
  monRoleCode: CodeRole;
  voitMontants: boolean;
  peutModifier: boolean;
  estVide: boolean;
  debut: string | null;
  finContractuelle: string | null;
  finPrevue: string | null;
  fiche: { libelle: string; valeur: string }[];
  indicateurs: Indicateurs;
  calendrier: {
    joursOuvresTotal: number | null;
    joursOuvresEcoules: number | null;
    tempsEcoule: number | null;
    chargeConsommee: number | null;
    glissementJours: number | null;
  };
  vigilance: PointATraiter[];
  groupes: Groupe[];
  libelleGroupe: string;
  echeances: EcheanceResume[];
  dernierImport: { nomFichier: string; importeLe: string; pointsReleves: string[] } | null;
}

export interface Indicateurs {
  nombreTaches: number;
  tachesValidees: number;
  avancement: number;
  prevu: number;
  prevuTsp: number;
  consomme: number;
  resteAFaire: number;
  atterrissage: number;
  ecart: number;
  chiffreAffaires: number | null;
  coutFinal: number | null;
  marge: number | null;
  tauxMarge: number | null;
  margeNette: number | null;
  tauxMargeNette: number | null;
}

export interface Groupe {
  code: string;
  nom: string;
  nombreTaches: number;
  prevu: number;
  consomme: number;
  resteAFaire: number;
  atterrissage: number;
  ecart: number;
  avancement: number;
  statut: string;
}

export interface EcheanceResume {
  numero: number;
  nom: string;
  pourcentage: number;
  montant: number | null;
  datePrevue: string | null;
  factureeLe: string | null;
  statut: string;
  /** Une échéance facturée a un montant figé : elle reste visible mais n'est plus sélectionnable. */
  selectionnable: boolean;
}

/** Erreur renvoyée par l'API (format standard « ProblemDetails »). */
export interface Probleme {
  title?: string;
  detail?: string;
  status?: number;
  errors?: Record<string, string[]>;
}
