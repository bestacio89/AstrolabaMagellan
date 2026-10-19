import { Presentation } from './point-hebdo.diapo';

/**
 * Macro-Planning : une diapositive PowerPoint du planning, pour les comités (traduction de 45b-macro-planning.js).
 * Reprend exactement les lignes affichées dans Planning › Vue d'ensemble (axes ou phases, et les éléments mis en avant),
 * avec leurs dates prévues, la ligne d'aujourd'hui, les jalons et leur légende. Tout tient sur une seule diapositive :
 * la hauteur des lignes et la taille du texte s'adaptent au nombre de lignes.
 */

export interface LigneMacro {
  libelle: string;
  /** Élément mis en avant, sous sa ligne. */
  sous: boolean;
  /** Rang de la ligne de groupe (nuance de bleu). */
  idx: number;
  debut?: string | null;
  fin?: string | null;
  /** Atelier ou livrable : losange à sa date (plein si réalisé). */
  losange?: { date: string | null; fait: boolean };
}

export interface JalonMacro {
  numero: number | null;
  libelle: string;
  /** « 13/10 », « Sem. du 02/11 »… */
  quand: string;
  debut: string;
  fin: string | null;
  aConfirmer: boolean;
}

export interface DonneesMacro {
  projet: string;
  client: string;
  lignes: LigneMacro[];
  mois: string[];
  jalons: JalonMacro[];
  aujourdhui: string;
}

const C = { titre: '1B2A8C', texte: '1E2551', doux: '6B7190', ligne: 'B9BED0', sep: '1E2551', auj: '7AC943', jalon: 'C8102E', blanc: 'FFFFFF', non: '9AA0B5' };
/** Nuances de bleu, une par axe (ou phase), dans l'ordre du planning ; les éléments mis en avant prennent la nuance de leur ligne, éclaircie. */
const BLEUS = ['0B1150', '3A2A9C', '2448C2', '4B39C8', '6F86DD', '3F86F2', '1E5FA8', '5C6BC0'];
const POLICE = 'Montserrat';
const MOIS_L = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
/** Au-delà, la diapositive reste lisible mais serrée : l'écran prévient avant de la générer. */
export const LIGNES_CONFORT = 16;

const utc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const fD = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
const moisSuivant = (mk: string) => {
  const y = +mk.slice(0, 4),
    m = +mk.slice(5, 7);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};
/** Couleur éclaircie (mélange avec du blanc), pour les éléments placés sous une ligne. */
export const pale = (hex: string, k: number): string =>
  (hex.match(/../g) ?? [])
    .map((c) => Math.round(parseInt(c, 16) + (255 - parseInt(c, 16)) * k).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
const borne = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Nom du fichier : « Macro-Planning - Client - Projet.pptx » (caractères interdits par Windows retirés). */
export function nomFichierMacro(d: Pick<DonneesMacro, 'client' | 'projet'>): string {
  return (
    ['Macro-Planning', d.client, d.projet]
      .filter(Boolean)
      .join(' - ')
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) + '.pptx'
  );
}

type Diapo = ReturnType<Presentation['addSlide']>;
type Texte = Parameters<Diapo['addText']>[0];
const txt = (slide: Diapo, texte: Texte, o: Record<string, unknown>) =>
  slide.addText(texte, { fontFace: POLICE, color: C.texte, margin: 0, valign: 'middle', isTextBox: true, ...o });

function diapo(pres: Presentation, d: DonneesMacro): void {
  const slide = pres.addSlide();
  slide.background = { color: C.blanc };
  const S = pres.ShapeType;
  const L = 13.333,
    H = 7.5,
    M = 0.4;
  // ---- titre ----
  txt(slide, 'Macro-Planning', { x: M + 0.2, y: 0.28, w: 8, h: 0.62, fontSize: 30, bold: true, color: C.titre });
  if (d.projet || d.client) txt(slide, [d.client, d.projet].filter(Boolean).join(' — '), { x: M + 0.22, y: 0.88, w: 9, h: 0.28, fontSize: 11, color: C.doux });

  // ---- frise : du premier au dernier mois du planning ----
  const mois = d.mois.length ? d.mois : [d.aujourdhui.slice(0, 7)];
  const lib = 2.85,
    x0 = M + lib + 0.15,
    x1 = L - M - 0.1,
    wT = x1 - x0;
  const t0 = utc(mois[0] + '-01'),
    t1 = utc(moisSuivant(mois[mois.length - 1]) + '-01');
  const X = (iso: string, finJour = false) => x0 + borne((utc(iso) + (finJour ? 864e5 : 0) - t0) / (t1 - t0), 0, 1) * wT;

  // ---- légende des jalons : 3 colonnes remplies colonne par colonne ----
  const jal = d.jalons;
  const rangs = Math.ceil(jal.length / 3);
  // PowerPoint ne réduit pas le texte à l'ouverture : on calcule la place nécessaire pour que les entrées ne se chevauchent jamais
  const fLeg = jal.length > 12 ? 7.5 : jal.length > 6 ? 8 : 9,
    hLigne = (fLeg * 1.25) / 72;
  const lcLeg = (L - M - (M + 2.85 + 0.15) + 0.3) / 3 - 0.15;
  const texteJ = (j: JalonMacro) => `${j.numero == null ? '◆ ' : `${j.numero}  `}${j.aConfirmer ? 'À confirmer' : j.quand} : ${j.libelle}${j.aConfirmer && j.quand ? ` (${j.quand})` : ''}`;
  const nbLignes = (j: JalonMacro) => Math.min(2, Math.max(1, Math.ceil((texteJ(j).length * fLeg * 0.5) / 72 / (lcLeg - 0.1))));
  const hRang = [...Array(rangs).keys()].map(
    (r) =>
      Math.max(
        ...[0, 1, 2]
          .map((c) => jal[c * rangs + r])
          .filter(Boolean)
          .map(nbLignes),
      ) *
        hLigne +
      0.05,
  );
  const hLeg = rangs ? hRang.reduce((a, b) => a + b, 0) + 0.12 : 0;
  const yLeg = H - 0.32 - hLeg;
  const hJal = jal.length ? 0.55 : 0;
  const yJal = yLeg - hJal - (jal.length ? 0.04 : 0);
  // ---- lignes : leur hauteur s'adapte pour que tout tienne sur la diapositive ----
  const yTete = 1.35,
    yL0 = yTete + 0.42;
  const n = Math.max(1, d.lignes.length);
  const hL = borne((yJal - yL0 - 0.05) / n, 0.22, 0.62);
  const fLib = borne(hL * 28, 7.5, 11),
    fDate = borne(hL * 22, 7, 9);

  // en-tête des mois : noms en capitales entre des traits ; l'année en petit sous le premier mois et sous chaque janvier
  const larg = wT / mois.length,
    annees = new Set(mois.map((m) => m.slice(0, 4))).size > 1;
  const noms = mois.map((m) => (larg >= 1.05 ? MOIS_L : MOIS_C)[+m.slice(5, 7) - 1].toUpperCase());
  const fMois = borne(((larg - 0.12) * 72) / (Math.max(...noms.map((x) => x.length)) * 0.72), 7, 13);
  mois.forEach((m, i) => {
    const k = +m.slice(5, 7) - 1;
    txt(slide, noms[i], { x: x0 + i * larg, y: yTete, w: larg, h: 0.26, fontSize: fMois, color: C.texte, align: 'center', charSpacing: 0.5 });
    if (annees && (i === 0 || k === 0)) txt(slide, m.slice(0, 4), { x: x0 + i * larg, y: yTete + 0.24, w: larg, h: 0.14, fontSize: 7, color: C.doux, align: 'center' });
    slide.addShape(S.line, { x: x0 + i * larg, y: yTete + 0.04, w: 0, h: 0.2, line: { color: C.sep, width: 1 } });
  });
  slide.addShape(S.line, { x: x1, y: yTete + 0.04, w: 0, h: 0.2, line: { color: C.sep, width: 1 } });

  // ---- une ligne par élément ----
  d.lignes.forEach((l, i) => {
    const y = yL0 + i * hL,
      base = y + hL * 0.86;
    const couleurAxe = BLEUS[(l.idx || 0) % BLEUS.length];
    const coul = l.sous ? pale(couleurAxe, 0.35) : couleurAxe;
    txt(slide, String(l.libelle || '').toUpperCase(), {
      x: M,
      y: y + hL * 0.08,
      w: lib,
      h: hL * 0.84,
      fontSize: l.sous ? fLib * 0.92 : fLib,
      color: l.sous ? C.doux : C.texte,
      bold: !l.sous,
      align: 'right',
      fit: 'shrink',
      paraSpaceAfter: 0,
      lineSpacingMultiple: 0.9,
    });
    slide.addShape(S.line, { x: x0 - 0.05, y: base, w: wT + 0.05, h: 0, line: { color: C.ligne, width: 0.75 } });
    const hB = hL * 0.4,
      yB = base - hB;
    if (l.losange && l.losange.date) {
      const x = X(l.losange.date),
        t = Math.min(0.2, hB * 1.1);
      slide.addShape(S.diamond, { x: x - t / 2, y: base - t * 0.95, w: t, h: t, fill: { color: l.losange.fait ? coul : C.blanc }, line: { color: coul, width: 1.25 } });
      txt(slide, fD(l.losange.date), { x: x + t * 0.7, y: base - t * 0.95 - 0.02, w: 1.1, h: t + 0.04, fontSize: fDate, color: C.texte });
    } else if (l.debut && l.fin) {
      const a = X(l.debut),
        b = Math.max(X(l.fin, true), a + 0.04);
      slide.addShape(S.rect, { x: a, y: yB, w: b - a, h: hB, fill: { color: coul }, line: { color: coul, width: 0 } });
      const hD = Math.min(0.24, hL * 0.42),
        yD = yB - hD;
      if (b - a >= 1.25) {
        txt(slide, fD(l.debut), { x: a, y: yD, w: 1.1, h: hD, fontSize: fDate, color: C.texte, valign: 'bottom' });
        txt(slide, fD(l.fin), { x: b - 1.1, y: yD, w: 1.1, h: hD, fontSize: fDate, color: C.texte, align: 'right', valign: 'bottom' });
      } else {
        // barre courte : une seule étiquette « début → fin », placée pour rester dans la diapositive
        const w = 1.9,
          xl = Math.min(a, x1 - w);
        txt(slide, `${fD(l.debut)} → ${fD(l.fin)}`, { x: xl, y: yD, w, h: hD, fontSize: fDate, color: C.texte, valign: 'bottom' });
      }
    } else {
      txt(slide, l.losange ? 'À dater' : 'Non planifié', { x: x0 + 0.05, y: yB - 0.02, w: 1.6, h: hB + 0.04, fontSize: fDate, italic: true, color: C.non });
    }
  });

  // ---- jalons : losanges sur leur ligne, numéro au-dessus (décalé quand deux jalons sont proches) ----
  if (jal.length) {
    const base = yJal + hJal * 0.72;
    txt(slide, 'JALONS', { x: M, y: base - 0.2, w: lib, h: 0.24, fontSize: borne(fLib, 9, 11), color: C.texte, bold: true, align: 'right' });
    slide.addShape(S.line, { x: x0 - 0.05, y: base, w: wT + 0.05, h: 0, line: { color: C.ligne, width: 0.75 } });
    let dernier = -9,
      etage = 0;
    jal.forEach((j) => {
      const x = X(j.debut),
        t = 0.17;
      if (j.fin && j.fin !== j.debut)
        slide.addShape(S.rect, { x, y: base - 0.03, w: Math.max(0.04, X(j.fin, true) - x), h: 0.06, fill: { color: pale(C.jalon, 0.6) }, line: { color: pale(C.jalon, 0.6), width: 0 } });
      slide.addShape(S.diamond, { x: x - t / 2, y: base - t / 2, w: t, h: t, fill: { color: j.aConfirmer ? C.blanc : C.jalon }, line: { color: C.jalon, width: 1.25 } });
      etage = x - dernier < 0.28 ? (etage + 1) % 2 : 0;
      dernier = x;
      txt(slide, j.numero == null ? '?' : String(j.numero), { x: x - 0.15, y: base - t / 2 - 0.2 - etage * 0.15, w: 0.3, h: 0.18, fontSize: 8, bold: true, color: C.jalon, align: 'center' });
    });
  }
  // ligne d'aujourd'hui : de l'en-tête des mois à la ligne des jalons
  const auj = d.aujourdhui;
  if (auj >= mois[0] + '-01' && utc(auj) < t1) {
    const x = X(auj),
      yFin = jal.length ? yJal + hJal * 0.95 : yL0 + n * hL;
    slide.addShape(S.line, { x, y: yTete + 0.36, w: 0, h: yFin - yTete - 0.36, line: { color: C.auj, width: 2.25 } });
  }
  if (jal.length) {
    const lc = (L - M - x0 + 0.3) / 3,
      xl = x0 - 0.3;
    jal.forEach((j, k) => {
      const col = Math.floor(k / rangs),
        r = k % rangs;
      const t = ` : ${j.libelle}${j.aConfirmer && j.quand ? ` (${j.quand})` : ''}`,
        max = Math.floor((2 * (lcLeg - 0.1) * 72) / (fLeg * 0.5)) - 14;
      const runs = [
        { text: j.numero == null ? '◆ ' : `${j.numero}  `, options: { color: C.jalon, bold: true } },
        { text: j.aConfirmer ? 'À confirmer' : j.quand, options: { bold: true } },
        { text: t.length > max ? t.slice(0, Math.max(10, max - 1)).trimEnd() + '…' : t },
      ];
      const yR = yLeg + 0.08 + hRang.slice(0, r).reduce((a, v) => a + v, 0);
      txt(slide, runs, { x: xl + col * lc, y: yR, w: lc - 0.15, h: hRang[r] - 0.03, fontSize: fLeg, color: C.texte, valign: 'top', margin: 0, lineSpacingMultiple: 1 });
    });
  }
}

/** Construit la présentation (une diapositive). */
export function presentationMacro(pres: Presentation, d: DonneesMacro): Presentation {
  pres.layout = 'LAYOUT_WIDE';
  pres.theme = { headFontFace: POLICE, bodyFontFace: POLICE };
  pres.title = `Macro-Planning${d.projet ? ' — ' + d.projet : ''}`;
  pres.author = 'Astrolabe';
  diapo(pres, d);
  return pres;
}
