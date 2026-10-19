import { Groupe, Modele, Statistiques } from '../api/modeles';
import { Presentation } from './point-hebdo.diapo';
import { fD, fJ, fP } from './formats';

/**
 * Avancement détaillé (tableau de bord › « Détail › ») : par axe, lot ou phase (selon le regroupement), puis par sous-partie
 * (lot, ou phase quand on regroupe par lot), puis par tâche. En accordéon ; « Exporter en PowerPoint » reprend ce qui est déplié.
 * Mêmes chiffres que le tableau de bord et que l'onglet « Avancement détaillé » de l'export COPROJ (arbre calculé par le serveur).
 * Traduction de 52f-avancement.js (version HTML de référence).
 */

/** Types de tâche gardés par le filtre « Ateliers et livrables seulement ». */
export const AV_TYPES = ['Atelier', 'Livrable'];

/** Ce que l'avancement détaillé utilise d'une tâche. */
export interface TacheAv {
  uid: string;
  label: string;
  grp: string;
  type: string | null;
  statut: string;
  annulee: boolean;
  /** Avancement déclaré dans Workload (paliers) : indication seulement. */
  avancement: number;
  consoTotal: number;
  charge: number;
  ecart: number;
}

export interface OptionsAv {
  /** Groupes (« g:<id> ») et sous-parties (« s:<groupe>|<sous-partie> ») dépliés. */
  ouverts: Readonly<Record<string, boolean>>;
  /** Filtre « Ateliers et livrables seulement ». */
  seul: boolean;
  /** Afficher les sous-parties entre le groupe et ses tâches. */
  avecSous: boolean;
}

export interface SousPartieAv<T extends TacheAv> {
  id: string;
  nom: string;
  stat: Statistiques;
  vis: T[];
  cle: string;
  ouvert: boolean;
}

export interface GroupeAv<T extends TacheAv> {
  id: string;
  nom: string;
  stat: Statistiques;
  sous: SousPartieAv<T>[];
  /** Les tâches du groupe directement (sans les sous-parties), dans l'ordre du TSP. */
  taches: T[];
  cle: string;
  ouvert: boolean;
  /** Nombre de tâches affichées (filtre compris). */
  nT: number;
  /** Rang de couleur de l'axe (0 à 7). */
  couleur: number;
}

export interface VueAv<T extends TacheAv> {
  /** « lot » ou « phase » : ce qui découpe chaque groupe. */
  cle: 'lot' | 'phase';
  groupes: GroupeAv<T>[];
  seul: boolean;
  avecSous: boolean;
  tousOuverts: boolean;
}

/**
 * Sous-parties affichées par défaut : oui, sauf en regroupement par phase (les lots y sont transverses).
 * Le choix de l'utilisateur est mémorisé par regroupement.
 */
export function sousVisibles(dim: string, choix: Readonly<Record<string, boolean>> | undefined): boolean {
  return choix?.[dim] ?? dim !== 'phase';
}

/** Ce qui est affiché : groupes, sous-parties (avec leurs tâches visibles) et état déplié, filtre compris. Sert à l'écran et au PowerPoint. */
export function vueAvancement<T extends TacheAv>(m: Pick<Modele, 'axes' | 'avancement'>, taches: readonly T[], o: OptionsAv): VueAv<T> {
  const A = m.avancement ?? { cle: 'lot' as const, groupes: [] };
  const parUid = new Map(taches.map((t) => [t.uid, t]));
  const garde = (l: T[]) => (o.seul ? l.filter((x) => AV_TYPES.includes(x.type ?? '')) : l);
  // les groupes de l'arbre suivent l'ordre des axes du modèle (même calcul côté serveur)
  const statGroupe = (id: string, i: number): Statistiques => m.axes.find((a) => (a.id || '') === id) ?? (m.axes[i] as Groupe);
  const groupes = A.groupes
    .map((g, i) => {
      const sous = g.sous
        .map((sp) => {
          const cle = `s:${g.id}|${sp.id}`;
          const liste = sp.taches.map((u) => parUid.get(u)).filter((t): t is T => !!t);
          return { id: sp.id, nom: sp.nom, stat: sp.stat, vis: garde(liste), cle, ouvert: !!o.ouverts[cle] };
        })
        .filter((sp) => sp.vis.length || !o.seul);
      const directes = garde(taches.filter((t) => (t.grp || '') === (g.id || '')));
      const cle = 'g:' + g.id;
      return {
        id: g.id,
        nom: g.nom,
        stat: statGroupe(g.id, i),
        sous,
        taches: directes,
        cle,
        ouvert: !!o.ouverts[cle],
        nT: o.avecSous ? sous.reduce((s, sp) => s + sp.vis.length, 0) : directes.length,
        couleur: Math.max(0, m.axes.findIndex((a) => (a.id || '') === g.id)) % 8,
      };
    })
    .filter((g) => !o.seul || (o.avecSous ? g.sous.length : g.taches.length));
  const tousOuverts = A.groupes.every((g) => o.ouverts['g:' + g.id] && (!o.avecSous || g.sous.every((sp) => o.ouverts[`s:${g.id}|${sp.id}`])));
  return { cle: A.cle, groupes, seul: o.seul, avecSous: o.avecSous, tousOuverts };
}

/** « Tout déplier » : tous les groupes et toutes les sous-parties. */
export function toutDeplier(m: Pick<Modele, 'avancement'>): Record<string, boolean> {
  const o: Record<string, boolean> = {};
  for (const g of m.avancement?.groupes ?? []) {
    o['g:' + g.id] = true;
    for (const sp of g.sous) o[`s:${g.id}|${sp.id}`] = true;
  }
  return o;
}

/** « 3 / 7 », ou « — » s'il n'y a rien de prévu. */
export const xy = (ok: number, n: number): string => (n ? `${ok} / ${n}` : '—');

/** Validées · ateliers · livrables, au format du PowerPoint (« 3/7 · 1/2 · — »). */
export const validesAteliersLivrables = (s: Statistiques): string =>
  `${s.actives ? `${s.valides}/${s.actives}` : '—'} · ${s.ateliers ? `${s.ateliersOK}/${s.ateliers}` : '—'} · ${s.livrables ? `${s.livrablesOK}/${s.livrables}` : '—'}`;

/** Une tâche compte 100 % quand elle est validée, 0 % sinon. */
export const avancementTache = (t: TacheAv): number => (t.statut === 'Validé' ? 1 : 0);

/** Nom du fichier : « Avancement - Client - Projet - AAAA-MM-JJ.pptx » (caractères interdits par Windows retirés). */
export function nomFichierAvancement(client: string, projet: string, aujourdhui: string): string {
  const sur = (s: string) => String(s || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return `Avancement - ${sur(client)} - ${sur(projet)} - ${aujourdhui}.pptx`;
}

// ------------------------------------------------------------------ PowerPoint

type Options = Record<string, unknown>;
interface Cel {
  text: string | { text: string; options?: Options }[];
  options: Options;
}

export interface ContexteAvPptx {
  client: string;
  projet: string;
  aujourdhui: string;
  /** Libellé du regroupement (« Axe ») et en minuscules (« axe »). */
  dimL: string;
  dimLl: string;
  typeNom: (id: string) => string;
  /** Couleur d'une variable CSS (« #rrggbb »), ou la valeur par défaut. */
  couleur: (variable: string, defaut: string) => string;
}

/** Ligne du tableau PowerPoint : hauteur (pouces) et cellules. */
export interface LigneAvPptx {
  h: number;
  c: Cel[];
}

const C = { texte: '1D2130', gris: '676B80', pale: '9AA0AE', fond1: 'F3F5FA', fond2: 'FAFBFD', ligne: 'E3E6EE', sur: 'C42C43', sous: '12805C' };
const ST: Record<string, [string, string, string]> = {
  'À faire': ['--c-statut-afaire', '#c4c4c4', '1F2330'],
  'En cours': ['--c-statut-encours', '#fdab3d', '1F2330'],
  'Bloqué / En attente': ['--c-statut-bloque', '#d83a52', 'FFFFFF'],
  'En recette': ['--c-statut-test', '#9d50dd', 'FFFFFF'],
  Validé: ['--c-statut-valide', '#00c875', '1F2330'],
  Annulée: ['--c-statut-annule', '#e7e9ef', '676879'],
};
const tronque = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const cel = (text: Cel['text'], o: Options = {}): Cel => ({ text, options: { valign: 'middle', ...o } });

/** Lignes du tableau : groupes, sous-parties et tâches tels qu'ils sont dépliés à l'écran (filtre compris), puis le total du projet. */
export function lignesAvancementPptx<T extends TacheAv>(V: VueAv<T>, total: Statistiques, x: ContexteAvPptx): LigneAvPptx[] {
  const hex = (v: string, d: string) => (x.couleur(v, d) || d).replace('#', '').toUpperCase();
  const ecart = (v: number, o: Options = {}) =>
    cel(Math.abs(v) < 0.005 ? '0' : `${v > 0 ? '▲ +' : '▼ −'}${fJ(Math.abs(v))}`, { align: 'right', color: v > 0.001 ? C.sur : v < -0.001 ? C.sous : C.texte, ...o });
  const statut = (s: string) => {
    const [v, d, tx] = ST[s] ?? ST['À faire'];
    return cel(s, { align: 'center', bold: true, fontSize: 7.5, color: tx, fill: { color: hex(v, d) } });
  };
  const cp = (conso: number, prevu: number, gras: boolean) =>
    cel([{ text: fJ(conso), options: { bold: gras } }, { text: ` / ${fJ(prevu)}`, options: { color: C.gris } }], { align: 'right' });
  const ligneStat = (nom: string, s: Statistiques, o: { bold: boolean; fill?: string }, nomO: Options = {}): Cel[] =>
    [cel(nom, { bold: o.bold, ...nomO }), cel(fP(s.avancement || 0), { bold: o.bold }), cp(s.conso, s.prevu, o.bold), ecart(s.ecart, { bold: o.bold }), cel(validesAteliersLivrables(s), { align: 'right' }), statut(s.statut)].map(
      (c, k) => (k === 5 ? c : { text: c.text, options: { ...c.options, fill: o.fill ? { color: o.fill } : undefined } }),
    );
  const lignes: LigneAvPptx[] = [];
  for (const g of V.groupes) {
    const bord = [{ type: 'none' }, { type: 'none' }, { type: 'solid', pt: 0.5, color: C.ligne }, { type: 'solid', pt: 4, color: hex(`--ax${g.couleur}`, '#579bfc') }];
    lignes.push({ h: 0.34, c: ligneStat(`${tronque(g.nom, 60)}   (${g.nT} tâche${g.nT > 1 ? 's' : ''})`, g.stat, { bold: true, fill: C.fond1 }, { fontSize: 10, border: bord }) });
    if (!g.ouvert) continue;
    const ligneTache = (t: T, retrait: number) =>
      lignes.push({
        h: 0.27,
        c: [
          cel(tronque(t.label + (t.type ? ` · ${x.typeNom(t.type)}` : ''), 62), { margin: [1, 4, 1, retrait], color: t.annulee ? C.pale : C.texte, strike: t.annulee ? 'sngStrike' : undefined }),
          cel(t.annulee ? '—' : fP(avancementTache(t)), { color: t.annulee ? C.pale : C.texte }),
          cp(t.consoTotal, t.charge, false),
          ecart(t.ecart),
          cel(''),
          statut(t.annulee ? 'Annulée' : t.statut),
        ],
      });
    if (!V.avecSous) {
      g.taches.forEach((t) => ligneTache(t, 18));
      continue;
    }
    for (const sp of g.sous) {
      lignes.push({ h: 0.3, c: ligneStat(`${tronque(sp.nom, 56)}   (${sp.vis.length} tâche${sp.vis.length > 1 ? 's' : ''})`, sp.stat, { bold: false, fill: C.fond2 }, { bold: true, margin: [1, 4, 1, 16] }) });
      if (sp.ouvert) sp.vis.forEach((t) => ligneTache(t, 30));
    }
  }
  lignes.push({ h: 0.36, c: ligneStat('Projet', total, { bold: true, fill: C.fond1 }, { fontSize: 10 }) });
  return lignes;
}

/** Découpage en diapositives selon la place disponible sous le titre (plus petite sur la première). */
export function pagesAvancement<L extends { h: number }>(lignes: readonly L[]): L[][] {
  const pages: L[][] = [];
  let cur: L[] = [],
    h = 0;
  for (const l of lignes) {
    const max = pages.length ? 6.0 : 5.6;
    if (cur.length && h + l.h > max) {
      pages.push(cur);
      cur = [];
      h = 0;
    }
    cur.push(l);
    h += l.h;
  }
  if (cur.length) pages.push(cur);
  return pages;
}

/**
 * PowerPoint de l'Avancement détaillé : diapositives 16:9, un tableau par diapositive, en-tête du tableau répété,
 * total du projet sur la dernière, pied de page numéroté. Police Montserrat, comme le Point hebdo.
 */
export function presentationAvancement<T extends TacheAv>(pres: Presentation, V: VueAv<T>, total: Statistiques, x: ContexteAvPptx): Presentation {
  const POL = 'Montserrat';
  const nomProj = `${x.client || ''}${x.client && x.projet ? ' — ' : ''}${x.projet || ''}`;
  pres.layout = 'LAYOUT_WIDE';
  pres.theme = { headFontFace: POL, bodyFontFace: POL };
  pres.title = `Avancement détaillé — ${nomProj}`;
  pres.author = 'Astrolabe';
  const X = 0.4,
    W = 12.53,
    COLW = [5.4, 1.15, 1.45, 0.95, 2.1, 1.48];
  const entete = [`${x.dimL} › ${V.avecSous ? V.cle + ' › ' : ''}tâche`, 'Avancement', 'Consommé / prévu', 'Écart', 'Validées · ateliers · livrables', 'Statut'].map((l, k) =>
    cel(l, { bold: true, fontSize: 8, color: C.gris, fill: { color: C.fond1 }, align: [2, 3, 4].includes(k) ? 'right' : k === 5 ? 'center' : 'left' }),
  );
  const pages = pagesAvancement(lignesAvancementPptx(V, total, x));
  pages.forEach((pg, i) => {
    const sl = pres.addSlide();
    const y0 = i ? 0.55 : 0.95;
    sl.addText('Avancement détaillé', { x: X, y: 0.22, w: 7, h: 0.4, fontFace: POL, fontSize: i ? 13 : 20, bold: true, color: C.texte });
    sl.addText(`Situation au ${fD(x.aujourdhui)}`, { x: X + W - 4, y: 0.22, w: 4, h: 0.3, fontFace: POL, fontSize: 9, color: C.gris, align: 'right' });
    if (!i) {
      sl.addText(nomProj, { x: X, y: 0.6, w: 8, h: 0.3, fontFace: POL, fontSize: 11, color: C.texte });
      sl.addText(`Par ${x.dimLl}, puis ${V.avecSous ? `par ${V.cle}, puis ` : ''}par tâche · jours-homme (JH)${V.seul ? ' · ateliers et livrables seulement' : ''}`, {
        x: X + W - 6,
        y: 0.52,
        w: 6,
        h: 0.3,
        fontFace: POL,
        fontSize: 8,
        color: C.gris,
        align: 'right',
      });
    }
    sl.addTable([entete, ...pg.map((l) => l.c)], {
      x: X,
      y: y0,
      w: W,
      colW: COLW,
      rowH: [0.3, ...pg.map((l) => l.h)],
      fontFace: POL,
      fontSize: 8.5,
      color: C.texte,
      margin: [1, 4, 1, 4],
      border: { type: 'solid', pt: 0.5, color: C.ligne },
      autoPage: false,
    });
    if (i === pages.length - 1)
      sl.addText(
        'Avancement = JH des tâches validées ÷ JH prévus. Validées · ateliers · livrables : tâches validées / tâches, ateliers et livrables validés / prévus. Écart = atterrissage − prévu : ▲ dépassement, ▼ économie.',
        { x: X, y: 6.82, w: W, h: 0.25, fontFace: POL, fontSize: 7, color: C.gris },
      );
    sl.addText(`Astrolabe · ${nomProj} · Avancement détaillé`, { x: X, y: 7.1, w: 8, h: 0.25, fontFace: POL, fontSize: 7, color: C.gris });
    sl.addText(`${i + 1} / ${pages.length}`, { x: X + W - 2, y: 7.1, w: 2, h: 0.25, fontFace: POL, fontSize: 7, color: C.gris, align: 'right' });
  });
  return pres;
}
