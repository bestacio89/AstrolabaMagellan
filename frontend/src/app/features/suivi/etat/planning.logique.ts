import { Groupe, JalonCalcule, LignePlanifiee, PlanReference, SousPartie } from '../api/modeles';
import { fD } from './formats';
import { addDays, addMonths, dow, joursEntre, monthDays, toUTC } from './outils';

/**
 * Planning › Vue d'ensemble (traduction de 56b-planning.js, version HTML de référence) : lignes affichées, mise en avant,
 * lignes masquées, échelle des mois, barres prévu / réel / retard, jalons, recherche du volet et journal des lignes décalées.
 * Fonctions simples, testées sans navigateur (planning.logique.spec.ts).
 */

/** Ce que le planning utilise d'une tâche. */
export interface TachePlanning {
  uid: string;
  label: string;
  grp: string;
  statut: string;
  annulee: boolean;
  avancement: number;
  type: string | null;
  consoDates: string[];
  tr: { debut?: string | null; fin?: string | null };
}

/** Clé de mise en avant d'une tâche. */
export const cleTache = (uid: string): string => 'tache|' + uid;

/** La mise en avant ne concerne que les regroupements par axe et par phase (par lot : rien n'est affiché, rien n'est perdu). */
export const avantPossible = (dim: string): boolean => dim === 'id' || dim === 'phase';

/** Une ligne de la vue d'ensemble : un groupe, une sous-partie ou une tâche mise en avant. */
export interface LigneAffichee<T extends TachePlanning = TachePlanning> {
  /** Groupe ou sous-partie (absent pour une tâche). */
  g?: Groupe | SousPartie;
  t?: T;
  /** Rang du groupe (couleur). */
  idx: number;
  sous: boolean;
  tache?: boolean;
  parent?: Groupe;
  /** Clé de mise en avant (élément affiché sous sa ligne). */
  avant?: string;
  /** La ligne du groupe est masquée : l'élément garde le nom de sa ligne. */
  parentCache?: boolean;
}

/** Lignes affichées : chaque groupe (sauf masqué) puis, par axe ou par phase, ses éléments mis en avant (sous-parties, puis tâches). */
export function lignesAffichees<T extends TachePlanning>(
  axes: readonly Groupe[],
  taches: readonly T[],
  dim: string,
  avant: Readonly<Record<string, boolean>>,
  masque: Readonly<Record<string, boolean>>,
): LigneAffichee<T>[] {
  const out: LigneAffichee<T>[] = [];
  const possible = avantPossible(dim);
  axes.forEach((a, i) => {
    const cache = !!masque[a.cle ?? ''];
    if (!cache) out.push({ g: a, idx: i, sous: false });
    if (!possible) return;
    if (dim === 'id') for (const x of a.sousParties ?? []) if (avant[x.cle ?? '']) out.push({ g: x, idx: i, sous: true, parent: a, avant: x.cle, parentCache: cache });
    for (const t of taches) if (!t.annulee && (t.grp || '') === a.id && avant[cleTache(t.uid)]) out.push({ t, idx: i, tache: true, sous: true, parent: a, avant: cleTache(t.uid), parentCache: cache });
  });
  return out;
}

/** Lignes du planning dans l'ordre : chaque groupe, puis ses sous-parties. */
export function toutesLesLignes(axes: readonly Groupe[]): { g: Groupe | SousPartie; idx: number; sous: boolean; parent?: Groupe }[] {
  const out: { g: Groupe | SousPartie; idx: number; sous: boolean; parent?: Groupe }[] = [];
  axes.forEach((a, i) => {
    out.push({ g: a, idx: i, sous: false });
    for (const x of a.sousParties ?? []) out.push({ g: x, idx: i, sous: true, parent: a });
  });
  return out;
}

/** Fin du retard d'une ligne : fin prévue dépassée (non validée : jusqu'à aujourd'hui ; validée : jusqu'à son dernier consommé). */
export function retardLigne(g: LignePlanifiee, aujourdhui: string): string | null {
  if (!g.planFin || !g.actives) return null;
  if (g.statut === 'Validé') return g.reelFin && g.reelFin > g.planFin ? g.reelFin : null;
  return aujourdhui > g.planFin ? aujourdhui : null;
}

const jjmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
/** Lundi de la semaine d'une date. */
export const lundi = (iso: string): string => addDays(iso, -((dow(iso) + 6) % 7));

/** Date d'un jalon telle qu'on l'écrit en comité : « 13/10 », « 19 au 30/10 », « Sem. du 02/11 ». */
export function quand(j: Pick<JalonCalcule, 'type' | 'debut' | 'fin'>): string {
  const d = j.debut ?? '';
  if (j.type === 'semaine') return `Sem. du ${jjmm(lundi(d))}`;
  if (j.type === 'periode' && j.fin && j.fin !== d) return d.slice(0, 7) === j.fin.slice(0, 7) ? `${d.slice(8, 10)} au ${jjmm(j.fin)}` : `${jjmm(d)} au ${jjmm(j.fin)}`;
  return jjmm(d);
}

/** Même date, en toutes lettres : « semaine du 02/11/2026 », « du 19/10/2026 au 30/10/2026 », « le 13/10/2026 ». */
export function quandLong(j: Pick<JalonCalcule, 'type' | 'debut' | 'fin'>): string {
  const d = j.debut ?? '';
  if (j.type === 'semaine') return `semaine du ${fD(lundi(d))}`;
  if (j.type === 'periode' && j.fin && j.fin !== d) return `du ${fD(d)} au ${fD(j.fin)}`;
  return `le ${fD(d)}`;
}

/** Dates d'une tâche utiles à l'échelle : prévues, réelles et, pour un atelier ou un livrable, ses dates propres. */
export interface DatesTache {
  debut?: string | null;
  fin?: string | null;
  autres?: (string | null | undefined)[];
}

/** Mois affichés : du plus tôt au plus tard (projet, lignes, jalons, aujourd'hui). */
export function moisAffiches(
  cal: { debut: string | null; finPrevue: string | null; finContrat: string | null },
  aujourdhui: string,
  lignes: { g?: LignePlanifiee; dates?: (string | null | undefined)[] }[],
  jalons: readonly Pick<JalonCalcule, 'debut' | 'fin'>[],
  moisDuProjet: readonly string[],
): string[] {
  const v: (string | null | undefined)[] = [cal.debut, cal.finPrevue, cal.finContrat, aujourdhui];
  for (const l of lignes) {
    if (l.g) v.push(l.g.planDebut, l.g.planFin, l.g.reelDebut, l.g.reelFin);
    if (l.dates) v.push(...l.dates);
  }
  for (const j of jalons) v.push(j.debut, j.fin);
  const d = v.filter((x): x is string => !!x).sort();
  if (!d.length) return moisDuProjet.slice();
  const out: string[] = [];
  for (let m = d[0].slice(0, 7); m <= d[d.length - 1].slice(0, 7); m = addMonths(m, 1)) out.push(m);
  return out;
}

/** Échelle de la frise : position (%) d'une date, du premier jour du premier mois au lendemain du dernier jour du dernier mois. */
export function echelle(mois: readonly string[]) {
  const d0 = mois[0] + '-01';
  const d1 = addDays(monthDays(mois[mois.length - 1]).slice(-1)[0], 1);
  const t0 = toUTC(d0),
    t1 = toUTC(d1);
  const pc = (iso: string, finJour = false) => Math.max(0, Math.min(100, ((toUTC(iso) + (finJour ? 864e5 : 0) - t0) / (t1 - t0)) * 100));
  return { d0, d1, pc };
}

/** Un morceau de la piste d'une ligne : date, barre prévue (saisie ou calculée), réelle, retard, pourcentage. */
export interface Morceau {
  type: 'date' | 'prevu' | 'reel' | 'retard' | 'pct';
  left: number;
  width?: number;
  texte?: string;
  classe?: string;
  titre?: string;
}

/** Barre « prévu / réel / retard » commune aux lignes et aux tâches mises en avant. */
export function barres(
  pc: (iso: string, finJour?: boolean) => number,
  o: { pd?: string | null; pf?: string | null; saisi: boolean; rd?: string | null; rf?: string | null; fin: string | null; valide: boolean; av: number },
): Morceau[] {
  const h: Morceau[] = [];
  let bout = 0;
  if (o.pd && o.pf) {
    const a = pc(o.pd),
      b = pc(o.pf, true);
    // barre courte : une seule étiquette « début → fin » (les deux dates ne se chevauchent pas)
    if (b - a >= 22) h.push({ type: 'date', left: a, texte: fD(o.pd) }, { type: 'date', left: b, texte: fD(o.pf), classe: 'fin' });
    else h.push({ type: 'date', left: a, texte: `${fD(o.pd)} → ${fD(o.pf)}` });
    h.push({ type: 'prevu', left: a, width: Math.max(0.4, b - a), classe: o.saisi ? '' : 'calc' });
    bout = b;
  }
  if (o.rd) {
    const finR = o.fin && o.pf && o.rf && o.rf > o.pf ? o.pf : o.rf;
    if (finR && finR >= o.rd) {
      const a = pc(o.rd),
        b = pc(finR, true);
      h.push({ type: 'reel', left: a, width: Math.max(0.4, b - a), classe: o.valide && !o.fin ? 'fini' : '' });
      bout = Math.max(bout, b);
    }
  }
  if (o.fin && o.pf) {
    const a = pc(o.pf, true),
      b = pc(o.fin, true);
    h.push({ type: 'retard', left: a, width: Math.max(0.4, b - a), titre: `Fin prévue dépassée de ${joursEntre(o.pf, o.fin)} jour(s)` });
    bout = Math.max(bout, b);
  }
  if ((o.pd && o.pf) || o.rd) h.push({ type: 'pct', left: bout, texte: o.valide ? '✓' : Math.round(o.av * 100) + ' %' });
  return h;
}

/** Fin du retard d'une tâche mise en avant (même règle qu'une ligne). */
export function retardTache(t: TachePlanning, aujourdhui: string): string | null {
  const pf = t.tr.fin,
    rf = t.consoDates[t.consoDates.length - 1];
  if (!pf) return null;
  if (t.statut === 'Validé') return rf && rf > pf ? rf : null;
  return aujourdhui > pf ? aujourdhui : null;
}

/** Jalons sur la frise : position, étage de la pastille (deux jalons proches : la seconde monte d'un étage), période, état. */
export function jalonsPlaces(jalons: readonly JalonCalcule[], pc: (iso: string, finJour?: boolean) => number, aujourdhui: string) {
  let dernier = -99,
    etage = 0;
  return jalons.map((j) => {
    const x = pc(j.debut ?? '');
    etage = x - dernier < 4 ? (etage + 1) % 2 : 0;
    dernier = x;
    const etat = j.aConfirmer ? 'conf' : (j.fin || j.debut || '') < aujourdhui ? 'passe' : '';
    const periode = j.type === 'periode' && j.fin && j.fin !== j.debut ? { left: x, width: Math.max(0.4, pc(j.fin, true) - x) } : null;
    return { j, x, etage, etat, periode };
  });
}

/** Texte comparé sans majuscules ni accents : « baseline » trouve « Baseline », « securite » trouve « sécurité ». */
export const sansAccent = (c: string): string => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const trouve = (txt: string | null | undefined, q: string): boolean => !q || sansAccent(String(txt || '')).includes(q);

/** Intitulé découpé autour du passage trouvé (correspondance caractère par caractère, accents compris). */
export function surligne(txt: string, q: string): { avant: string; trouve: string; apres: string } {
  txt = String(txt || '');
  if (!q) return { avant: txt, trouve: '', apres: '' };
  let n = '';
  const pos: number[] = [];
  for (let i = 0; i < txt.length; i++) {
    const c = sansAccent(txt[i]);
    for (let k = 0; k < c.length; k++) pos.push(i);
    n += c;
  }
  const k = n.indexOf(q);
  if (k < 0) return { avant: txt, trouve: '', apres: '' };
  const a = pos[k],
    b = pos[k + q.length - 1] + 1;
  return { avant: txt.slice(0, a), trouve: txt.slice(a, b), apres: txt.slice(b) };
}

/** Filtre des tâches du volet : À faire, En cours (en recette et bloquées comprises), Validées. */
export const EN_COURS = ['En cours', 'En recette', 'Bloqué / En attente'];
export const filtreDe = (t: { statut: string }): 'valide' | 'encours' | 'afaire' => (t.statut === 'Validé' ? 'valide' : EN_COURS.includes(t.statut) ? 'encours' : 'afaire');

/** Ligne du planning décalée depuis la référence (journal des dérives). */
export interface DeriveLigne {
  cle: string;
  nom: string;
  debutReference: string | null;
  finReference: string | null;
  debut: string | null;
  fin: string | null;
  decalage: number | null;
}

/** Lignes du planning dont les dates prévues ont changé depuis la référence (références figées avec leurs dates de lignes). */
export function derivesGroupes(axes: readonly Groupe[], ref: PlanReference): DeriveLigne[] {
  if (!ref.groupes) return [];
  const out: DeriveLigne[] = [];
  for (const { g } of toutesLesLignes(axes)) {
    const r = ref.groupes[g.cle ?? ''];
    if (!r || ((r.debut ?? null) === (g.planDebut ?? null) && (r.fin ?? null) === (g.planFin ?? null))) continue;
    out.push({
      cle: g.cle ?? '',
      nom: g.nom,
      debutReference: r.debut,
      finReference: r.fin,
      debut: g.planDebut ?? null,
      fin: g.planFin ?? null,
      decalage: r.fin && g.planFin ? joursEntre(r.fin, g.planFin) : null,
    });
  }
  return out;
}
