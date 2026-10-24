import { ORIGINES } from './constantes';
import { addDays, joursEntre, toUTC } from './outils';

/**
 * Actions, décisions, risques (traduction de 55b-registres.js, version HTML de référence) : une liste lisible et un panneau latéral.
 * Filtres : texte, statut, personne (une personne même quand plusieurs sont nommées), échéance ou date, instance.
 * Fonctions simples, testées sans navigateur (registres.logique.spec.ts).
 */

/** Instances de gouvernance du projet (Paramètres du projet) ; liste par défaut tant qu'elle n'a pas été modifiée. */
export function instancesDuProjet(v: { projet: { settings: { instances?: string[] | null } } }): string[] {
  const l = v.projet.settings.instances;
  return l && l.length ? [...l] : [...ORIGINES];
}

/** Texte comparé sans accents, majuscules ni espaces en trop. */
export const norm = (s: string | null | undefined): string =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** « C. PEREZ / N. ERDEVEN », « SSI, DSI », « A et B » : une personne par élément. */
export const personnes = (s: string | null | undefined): string[] =>
  String(s || '')
    .split(/\s*(?:\/|,|;|\+|&|\s+et\s+)\s*/i)
    .map((x) => x.trim())
    .filter(Boolean);

/** Initiales d'un nom (« Camille Martin » → « CM »), sans les particules. */
export function initiales(n: string): string {
  const m = String(n)
    .replace(/[^\p{L}' -]/gu, ' ')
    .split(/[\s'-]+/)
    .filter((w) => w && !/^(de|du|des|la|le|les|d|l|et)$/.test(w));
  return (((m[0] || '')[0] || '') + ((m[1] || '')[0] || '')).toUpperCase() || '?';
}

/** Toutes les personnes citées dans un registre, avec le nombre d'éléments où elles apparaissent (ordre alphabétique). */
export function personnesDe(valeurs: readonly (string | null | undefined)[]): { nom: string; cle: string; n: number }[] {
  const m = new Map<string, { nom: string; cle: string; n: number }>();
  for (const v of valeurs) {
    const l = personnes(v);
    for (const cle of new Set(l.map(norm))) {
      const nom = l.find((y) => norm(y) === cle) ?? cle;
      const e = m.get(cle) ?? { nom, cle, n: 0 };
      e.n++;
      m.set(cle, e);
    }
  }
  return [...m.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

/** Filtre par personne : une personne citée seule ou avec d'autres. */
export const avecPersonne = (val: string | null | undefined, sel: string): boolean => !sel || personnes(val).some((p) => norm(p) === sel);

/** « aujourd'hui », « demain », « hier », « dans 5 j », « il y a 3 j ». */
export function relatif(iso: string | null | undefined, aujourdhui: string): string {
  if (!iso) return '';
  const n = joursEntre(aujourdhui, iso);
  return n === 0 ? 'aujourd’hui' : n === 1 ? 'demain' : n === -1 ? 'hier' : n > 0 ? `dans ${n} j` : `il y a ${-n} j`;
}

/** Extrait d'un texte sur une ligne, coupé à n caractères. */
export function extrait(t: string | null | undefined, n = 150): string {
  const s = String(t || '')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

/** Recherche dans plusieurs champs (sans accents ni majuscules). */
export const cherche = (q: string, ...champs: (string | null | undefined)[]): boolean => !q || norm(champs.join(' ')).includes(q);

/** Dernier jour du mois d'une date. */
export function finDuMois(iso: string): string {
  const d = new Date(toUTC(iso));
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

export const ouverte = (a: { statut: string }): boolean => a.statut !== 'Fait' && a.statut !== 'Annulée';
export const enRetard = (a: { statut: string; echeance: string | null }, aujourdhui: string): boolean => !!a.echeance && a.echeance < aujourdhui && ouverte(a);

/** Échéance (actions) : en retard, sous 7 / 15 jours, d'ici la fin du mois, ou une période choisie. */
export function echeanceOk(a: { statut: string; echeance: string | null }, f: string, aujourdhui: string, du = '', au = ''): boolean {
  if (!f) return true;
  const e = a.echeance;
  if (f === 'retard') return enRetard(a, aujourdhui);
  if (!e) return false;
  if (f === 'semaine') return e >= aujourdhui && e <= addDays(aujourdhui, 7);
  if (f === 'quinzaine') return e >= aujourdhui && e <= addDays(aujourdhui, 15);
  if (f === 'mois') return e >= aujourdhui && e <= finDuMois(aujourdhui);
  if (f === 'periode') return (!du || e >= du) && (!au || e <= au);
  return true;
}

/** Date (décisions) : ce mois-ci, les 30 derniers jours, ou une période choisie. */
export function dateOk(x: { date: string | null }, f: string, aujourdhui: string, du = '', au = ''): boolean {
  if (!f) return true;
  const d = x.date;
  if (!d) return false;
  if (f === 'mois') return d.slice(0, 7) === aujourdhui.slice(0, 7);
  if (f === '30j') return d >= addDays(aujourdhui, -30) && d <= aujourdhui;
  if (f === 'periode') return (!du || d >= du) && (!au || d <= au);
  return true;
}

/** Ordre des actions : ouvertes d'abord, puis par date cible (sans date à la fin), puis par référence. */
export function trierActions<T extends { statut: string; echeance: string | null; ref: string }>(l: T[]): T[] {
  return l.sort(
    (x, y) => Number(ouverte(y)) - Number(ouverte(x)) || String(x.echeance || '9999').localeCompare(String(y.echeance || '9999')) || String(x.ref).localeCompare(String(y.ref)),
  );
}

/** Référence courte d'un risque dans la matrice : « R-003 » → « R3 ». */
export const refCourte = (ref: string | null | undefined): string => String(ref || '').replace(/^R-0*/, 'R');

// ------------------------------------------------------------------ listes affichées (écran et panneau latéral)

/** Filtres des registres (préférences d'affichage). */
export interface FiltresRegistres {
  adq: string;
  adf: string;
  adEch: string;
  adInst: string;
  adp: string;
  adDu: string;
  adAu: string;
  adfd: string;
  adDPer: string;
  adpd: string;
  rkf: string;
  rkty: string;
  adpr: string;
}

interface ActionL {
  id: string;
  ref: string;
  libelle: string;
  commentaire: string;
  porteur: string;
  origine: string;
  statut: string;
  echeance: string | null;
}
interface DecisionL {
  id: string;
  ref: string;
  libelle: string;
  commentaire: string;
  decideur: string;
  instance: string;
  statut: string;
  date: string | null;
}
interface RisqueL {
  id: string;
  ref: string;
  libelle: string;
  cause?: string;
  parade: string;
  plan?: string;
  commentaire: string;
  responsable: string;
  type?: string;
  crit: number;
}

/** Listes filtrées et triées des trois registres ; l'ordre sert aussi à « précédente / suivante » dans le panneau. */
export function listesRegistres<A extends ActionL, D extends DecisionL, R extends RisqueL>(
  donnees: { actions: readonly A[]; decisions: readonly D[]; risques: readonly R[]; risquesOuverts: ReadonlySet<string>; commentaires?: Readonly<Record<string, readonly { texte: string }[]>> },
  f: FiltresRegistres,
  aujourdhui: string,
) {
  const q = norm(f.adq);
  const fa = f.adf || 'ouvertes';
  const actions = trierActions(
    donnees.actions.filter(
      (a) =>
        (fa === 'toutes' || (fa === 'ouvertes' && ouverte(a)) || (fa === 'retard' && enRetard(a, aujourdhui)) || (fa === 'closes' && !ouverte(a))) &&
        avecPersonne(a.porteur, f.adp) &&
        echeanceOk(a, f.adEch, aujourdhui, f.adDu, f.adAu) &&
        (!f.adInst || a.origine === f.adInst) &&
        cherche(q, a.ref, a.libelle, a.commentaire, a.porteur, a.origine, ...(donnees.commentaires?.['act:' + a.id] ?? []).map((c) => c.texte)),
    ),
  );
  const fd = f.adfd || 'toutes';
  const decisions = donnees.decisions
    .filter(
      (x) =>
        (fd === 'toutes' || x.statut === fd) &&
        dateOk(x, f.adDPer, aujourdhui, f.adDu, f.adAu) &&
        (!f.adInst || x.instance === f.adInst) &&
        avecPersonne(x.decideur, f.adpd) &&
        cherche(q, x.ref, x.libelle, x.commentaire, x.decideur, x.instance, ...(donnees.commentaires?.['dec:' + x.id] ?? []).map((c) => c.texte)),
    )
    .sort((x, y) => String(y.date || '').localeCompare(String(x.date || '')) || String(y.ref).localeCompare(String(x.ref)));
  const fr = f.rkf || 'ouverts';
  const risques = donnees.risques
    .filter(
      (r) =>
        (fr === 'tous' || (fr === 'ouverts' ? donnees.risquesOuverts.has(r.id) : !donnees.risquesOuverts.has(r.id))) &&
        (!f.rkty || (f.rkty === '__aucun' ? !r.type : r.type === f.rkty)) &&
        avecPersonne(r.responsable, f.adpr) &&
        cherche(q, r.ref, r.libelle, r.cause, r.parade, r.plan, r.commentaire, r.responsable, r.type, ...(donnees.commentaires?.['rk:' + r.id] ?? []).map((c) => c.texte)),
    )
    .sort((x, y) => y.crit - x.crit || String(x.ref).localeCompare(String(y.ref)));
  return {
    actions,
    decisions,
    risques,
    ordre: {
      act: actions.map((a) => 'act:' + a.id),
      dec: decisions.map((x) => 'dec:' + x.id),
      rk: risques.map((r) => 'rk:' + r.id),
    },
  };
}
