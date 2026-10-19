import {
  Action,
  Ajout,
  AchatBudget,
  Droits,
  FraisBudget,
  Modele,
  Personne,
  Presta,
  ProjetSuivi,
  Risque,
  Suivi,
  SuiviTache,
  TacheCalculee,
} from '../api/modeles';
import { riskNiveau } from './constantes';
import { addDays, distincts, num, round, triFr } from './outils';

/**
 * « Vue » : les données du suivi prêtes pour l'affichage.
 * Le serveur envoie les saisies (projet) et les indicateurs calculés (modèle) ; on y ajoute ici
 * ce dont les écrans ont besoin et qui n'est que de la présentation (jointures, regroupements),
 * comme le faisait la version de référence. Aucun calcul de gestion n'est refait ici.
 */

/** Profil du projet : indicateurs du moteur + identifiant et informations d'ajout. */
export interface ProfilVue extends Personne {
  id: string;
  version: number;
  ajout: Ajout | null;
}

/** Tâche : indicateurs du moteur + saisies (« tr ») + total par jour. */
export interface TacheVue extends TacheCalculee {
  /** Saisies de suivi (statut, dates, consommé…). */
  tr: SuiviTache;
  /** Consommé de la tâche par jour, tous profils confondus. */
  dayTot: Record<string, number>;
  /** Tâche ajoutée en cours de projet : quand, par qui, pourquoi. */
  ajout: Ajout | null;
  version: number;
}

export interface LigneAchatTsp extends AchatBudget {
  montant: number;
}

export interface LigneFraisTsp extends FraisBudget {
  montant: number;
}

export interface LignePresta extends Presta {
  cout: number;
  revente: number;
  markup: number | null;
}

export interface Vue {
  suivi: Suivi;
  projet: ProjetSuivi;
  m: Modele;
  droits: Droits;
  /** Date du jour (serveur, heure de Paris). */
  aujourdhui: string;
  /** Mois en cours « AAAA-MM ». */
  moisCourant: string;
  P: ProfilVue[];
  tasks: TacheVue[];
  /** Tâches par repère. */
  parUid: ReadonlyMap<string, TacheVue>;
  /** Échéance de chaque phase liée. */
  phaseEch: Readonly<Record<string, number>>;
  /** Consommé par profil (index) et par jour, toutes tâches confondues. */
  dayLoad: Readonly<Record<string, number>>[];
  /** Tâches portant un type (registres Ateliers & livrables). */
  ateliersList: TacheVue[];
  risquesOuverts: Risque[];
  risquesForts: Risque[];
  achatRows: LigneAchatTsp[];
  fraisRows: LigneFraisTsp[];
  prestaRows: LignePresta[];
  /** Phases connues (référentiel + tâches). */
  phases: string[];
  etapes: string[];
  lots: string[];
  /** Codes d'axe (colonne A du TSP). */
  axeIds: string[];
  /** Personnes connues (proposées comme responsable, décideur, collaborateur). */
  personnes: string[];
  /** Libellé du critère de regroupement (Axe, Lot, Phase). */
  dimL: string;
  dimLl: string;
  alerteActions: number;
  alerteAteliers: number;
  alerteLivrables: number;
  alerteEcheances: number;
}

/** Nom par défaut d'un code d'axe (colonne A du TSP). */
export function defaultAxeName(id: string): string {
  if (id === '0') return 'Pilotage (transverse)';
  const m = /^axe\s*(\d+)/i.exec(id);
  return m ? `Axe ${m[1]}` : id;
}

export function construireVue(suivi: Suivi): Vue {
  const projet = suivi.projet;
  const m = suivi.modele;
  const P: ProfilVue[] = m.p.map((p, i) => ({
    ...p,
    id: projet.profiles[i]?.id ?? '',
    version: projet.profiles[i]?.version ?? 0,
    ajout: projet.profiles[i]?.ajout ?? null,
  }));
  const sources = new Map(projet.tasks.map((t) => [t.uid, t]));
  const tasks: TacheVue[] = m.tasks.map((t) => {
    const tr = projet.track[t.uid] ?? {};
    const dayTot: Record<string, number> = {};
    for (const parJour of Object.values(tr.consoP ?? {})) {
      for (const [d, v] of Object.entries(parJour ?? {})) if (num(v) > 0) dayTot[d] = (dayTot[d] ?? 0) + num(v);
    }
    const source = sources.get(t.uid);
    return { ...t, tr, dayTot, ajout: source?.ajout ?? null, version: source?.version ?? 0 };
  });
  const parUid = new Map(tasks.map((t) => [t.uid, t]));

  const phaseEch: Record<string, number> = {};
  for (const e of projet.echeancier) {
    for (const ph of projet.echTrack[String(e.n)]?.phases ?? []) if (phaseEch[ph] == null) phaseEch[ph] = e.n;
  }

  const dayLoad: Record<string, number>[] = P.map(() => ({}));
  for (const t of tasks) {
    for (const [k, parJour] of Object.entries(t.tr.consoP ?? {})) {
      const charge = dayLoad[+k];
      if (!charge) continue;
      for (const [d, v] of Object.entries(parJour ?? {})) if (num(v)) charge[d] = (charge[d] ?? 0) + num(v);
    }
  }

  const ouvert = (r: Risque) => (r.statut || 'Ouvert') === 'Ouvert' || r.statut === 'Survenu';
  const risquesOuverts = projet.risques.filter(ouvert);

  const axeIds = distincts([...Object.keys(projet.axes ?? {}), ...projet.tasks.filter((t) => !t.section && t.id).map((t) => t.id)]);
  const phases = distincts([...(projet.ref?.phases ?? []), ...tasks.map((t) => t.phase).filter(Boolean)]);
  const etapes = distincts([...(projet.ref?.etapes ?? []), ...tasks.map((t) => t.etape).filter(Boolean)]);
  const lots = distincts(tasks.map((t) => t.lot).filter(Boolean));
  const personnes = distincts(
    [
      suivi.droits.utilisateur,
      ...P.map((x) => x.collaborateur),
      ...projet.actions.map((a) => a.porteur),
      ...projet.decisions.map((x) => x.decideur),
    ].filter((x): x is string => !!x),
  ).sort(triFr);

  const S = projet.settings;
  return {
    suivi,
    projet,
    m,
    droits: suivi.droits,
    aujourdhui: suivi.aujourdhui,
    moisCourant: suivi.aujourdhui.slice(0, 7),
    P,
    tasks,
    parUid,
    phaseEch,
    dayLoad,
    ateliersList: tasks.filter((t) => t.type),
    risquesOuverts,
    risquesForts: risquesOuverts.filter((r) => riskNiveau(r.crit) === 'fort'),
    achatRows: (projet.achats ?? []).map((a) => ({ ...a, montant: a.cu * a.qte })),
    fraisRows: (projet.frais ?? []).map((f) => ({ ...f, montant: f.cu * f.qte })),
    prestaRows: (projet.prestas ?? []).map((a) => {
      const cout = a.coutJour * a.nbj,
        revente = a.tjm * a.nbj;
      return { ...a, cout, revente, markup: revente ? (revente - cout) / revente : null };
    }),
    phases,
    etapes,
    lots,
    axeIds,
    personnes,
    dimL: m.dim.label,
    dimLl: m.dim.label.toLowerCase(),
    alerteActions: S.alerteActionsJours ?? 7,
    alerteAteliers: S.alerteAtelierJours ?? 10,
    alerteLivrables: S.alerteLivrableJours ?? 7,
    alerteEcheances: S.alerteEchJours ?? 14,
  };
}

// ---------------------------------------------------------------- noms

/** Nom d'un type de tâche. */
export function typeName(v: Vue, id: string | null | undefined): string {
  return v.projet.types.find((x) => x.id === id)?.nom ?? '';
}

/** Nom d'un groupe selon le regroupement choisi (axe, lot ou phase). */
export function axeName(v: Vue, k: string | null | undefined): string {
  return v.m.axes.find((a) => a.id === k)?.nom || (k ? k : 'Sans ' + v.dimLl);
}

/** Nom d'un code d'axe (colonne A du TSP). */
export function idName(v: Vue, id: string | null | undefined): string {
  return id ? v.projet.axes?.[id] || defaultAxeName(id) : 'Sans axe';
}

/** Couleur d'un groupe (8 couleurs, dans l'ordre des groupes du projet). */
export function couleurGroupe(v: Vue, grp: string): string {
  return `var(--ax${Math.max(0, v.m.axes.findIndex((a) => a.id === grp)) % 8})`;
}

/** Libellé d'un profil (liste de choix). */
export function libelleProfil(p: ProfilVue, fE: (n: number | undefined) => string): string {
  return `${p.nom} — TJM ${fE(p.tjm)} · CJM ${fE(p.cjm)}${p.ajout ? ' (ajouté)' : ''}`;
}

// ---------------------------------------------------------------- listes filtrées

/** Filtres communs (barre de filtres) : groupe, recherche, évolutions du périmètre. */
export interface FiltresTaches {
  axe: string;
  q: string;
  onlyAjout: boolean;
}

export function filteredTasks(v: Vue, f: FiltresTaches): TacheVue[] {
  const q = f.q.trim().toLowerCase();
  const aj = f.onlyAjout && v.m.perimetre.lignes.length > 0;
  return v.tasks.filter(
    (t) =>
      (!f.axe || (f.axe === '__none' ? !t.grp : t.grp === f.axe)) &&
      (!q || t.label.toLowerCase().includes(q) || (t.lot || '').toLowerCase().includes(q)) &&
      (!aj || t.estAjout || t.chargeAjout > 0 || t.annulee),
  );
}

/** Regroupe une liste de tâches dans l'ordre des groupes du projet. */
export function groupByAxe<T extends { grp: string }>(v: Vue, list: readonly T[]): [string, T[]][] {
  const groupes = new Map<string, T[]>(v.m.axes.map((a) => [a.id, []]));
  for (const t of list) {
    const g = groupes.get(t.grp);
    if (g) g.push(t);
    else groupes.set(t.grp, [t]);
  }
  return [...groupes.entries()].filter(([, l]) => l.length > 0);
}

/** Profils affichés sous une tâche : ceux chiffrés + ceux qui ont déjà du consommé. */
export function taskProfiles(t: TacheVue): number[] {
  const set = new Set<number>();
  t.charges.forEach((c, i) => {
    if (c > 0) set.add(i);
  });
  for (const [i, o] of Object.entries(t.tr.consoP ?? {})) {
    if (Object.values(o ?? {}).some((x) => num(x) > 0)) set.add(+i);
  }
  return [...set].sort((a, b) => a - b);
}

/**
 * Charge d'un profil qui peut encore être réaffectée : prévu − consommé (le consommé ne se réaffecte pas).
 * L'enveloppe IA (profil `ia`) n'est pas une personne : elle ne se réaffecte pas.
 */
export const reaffectable = (t: TacheVue, i: number, ia = -1): number =>
  i === ia ? 0 : Math.max(round((t.charges[i] ?? 0) - (t.consoP[i] ?? 0), 2), 0);

/** Consommé supérieur à la charge prévue. */
export const isOver = (t: TacheVue): boolean => t.consoTotal > t.charge + 1e-9;

// ---------------------------------------------------------------- ateliers et livrables

export const isAtelier = (t: TacheVue): boolean => t.type === 'Atelier';
export const isLivrable = (t: TacheVue): boolean => t.type === 'Livrable';

/** Date réalisée d'un atelier : une fois la tâche validée, dernier jour de consommé (à défaut, date de validation). */
export function atRealise(t: TacheVue): string | null {
  return t.statut === 'Validé' ? (t.consoDates[t.consoDates.length - 1] ?? t.tr.valideLe ?? null) : null;
}

export function atHoraire(t: TacheVue): string {
  const deb = t.tr.atelier?.heureDebut ?? '';
  const fin = t.tr.atelier?.heureFin ?? '';
  return deb ? deb + (fin ? '–' + fin : '') : '';
}

/** Étapes d'un atelier : date fixée · invitation envoyée · réalisé. */
export function atStep(t: TacheVue): boolean[] {
  const at = t.tr.atelier;
  return [!!(at?.date || (t.statut === 'Validé' && atRealise(t))), !!at?.invit, t.statut === 'Validé'];
}

export const AT_STEPS = ['Date fixée', 'Invitation envoyée', 'Réalisé'];
export const LV_STEPS = ['Livré', 'Validé par le client'];

/** Livraison prévue (fin prévue saisie). */
export const lvPrevue = (t: TacheVue): string | null => t.tr.fin ?? null;
/** « Livré le » : déduit du consommé quand la tâche est validée. */
export const lvLivre = (t: TacheVue): string | null => t.realiseLe ?? null;
/** Validation client (une fois livré). */
export const lvValide = (t: TacheVue): string | null => (lvLivre(t) ? (t.tr.livr?.valideLe ?? null) : null);

/** Personnes proposées comme destinataires d'un atelier. */
export function destPool(v: Vue): string[] {
  return distincts([...v.tasks.flatMap((t) => t.tr.atelier?.dest ?? []), ...v.personnes]).sort(triFr);
}

// ---------------------------------------------------------------- facturation

export type EtatEcheance = 'ok' | 'fact' | 'none' | 'crit' | 'warn' | 'plan';

/** Statut affiché d'une échéance (avec le délai d'alerte réglé dans les paramètres). */
export function echEtat(v: Vue, e: { payeeLe: string | null; realiseLe: string | null; jours: number | null }): [EtatEcheance, string] {
  if (e.payeeLe) return ['ok', 'Payée'];
  if (e.realiseLe) return ['fact', 'Facturée'];
  if (e.jours == null) return ['none', 'Sans date'];
  if (e.jours < 0) return ['crit', `En retard de ${-e.jours} j`];
  if (e.jours <= v.alerteEcheances) return ['warn', e.jours === 0 ? 'Aujourd’hui' : `Dans ${e.jours} j`];
  return ['plan', 'Planifiée'];
}

// ---------------------------------------------------------------- actions

export const isLate = (v: Vue, a: Action): boolean =>
  !!a.echeance && a.echeance < v.aujourdhui && a.statut !== 'Fait' && a.statut !== 'Annulée';

export const estOuverte = (a: Action): boolean => a.statut !== 'Fait' && a.statut !== 'Annulée';

/** Date limite d'une alerte (aujourd'hui + n jours). */
export const limite = (v: Vue, n: number): string => addDays(v.aujourdhui, n);
