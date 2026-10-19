import { COULEURS as C, DonneesDiapo, fD, fE, fJ, fM, Niveau, NIVEAUX } from './point-hebdo.logique';

/**
 * Dessin de la diapositive du point hebdo. La même fonction dessine :
 * - le fichier PowerPoint, avec PptxGenJS (textes, formes et tableaux natifs, donc modifiables) ;
 * - l'aperçu à l'écran, en enregistrant les mêmes appels puis en les traduisant en HTML positionné en pouces.
 * L'aperçu est donc toujours fidèle au fichier. Même mise en page que la version fichier unique (45-point-hebdo.js).
 */

/** Options passées à PptxGenJS (forme libre : position en pouces, police, couleurs sans « # »…). */
type Options = Record<string, any>;
interface Morceau {
  text: string;
  options?: Options;
}
type Texte = string | Morceau[];
interface Cellule {
  text: Texte;
  options?: Options;
}
/** Ce que la diapositive utilise de PptxGenJS. */
export interface Diapo {
  background?: Options;
  addText(t: Texte, o: Options): unknown;
  addShape(forme: string, o: Options): unknown;
  addTable(lignes: Cellule[][], o: Options): unknown;
  addImage(o: Options): unknown;
}
export interface Presentation {
  ShapeType: Record<'rect' | 'roundRect' | 'line' | 'sun' | 'cloud' | 'lightningBolt' | 'rightArrow' | 'diamond', string>;
  layout?: string;
  theme?: Options;
  title?: string;
  author?: string;
  addSlide(): Diapo;
  write(o: { outputType: 'blob' }): Promise<unknown>;
}
export type ConstructeurPresentation = new () => Presentation;

const POLICE = 'Montserrat';
const LARGEUR = 13.333;

const somme = (l: readonly number[]): number => l.reduce((s, v) => s + v, 0);
const court = (t: string, n: number): string => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t);

/** Météo dessinée avec les formes de PowerPoint : soleil, nuage, orage. */
function meteo(S: Presentation['ShapeType'], d: Diapo, m: string, x: number, y: number, t: number): void {
  if (m === 'soleil') d.addShape(S.sun, { x, y, w: t, h: t, fill: { color: C.bleu }, line: { color: C.bleu, width: 0.5 } });
  else if (m === 'nuage') d.addShape(S.cloud, { x, y: y + t * 0.12, w: t, h: t * 0.72, fill: { color: '9FB3C3' }, line: { color: '9FB3C3', width: 0.5 } });
  else {
    d.addShape(S.cloud, { x, y, w: t, h: t * 0.62, fill: { color: '6B7F90' }, line: { color: '6B7F90', width: 0.5 } });
    d.addShape(S.lightningBolt, { x: x + t * 0.35, y: y + t * 0.42, w: t * 0.38, h: t * 0.55, fill: { color: 'F2B705' }, line: { color: 'F2B705', width: 0.5 } });
  }
}
/** Tendance : flèche colorée (vert : favorable, jaune : à surveiller, rouge : défavorable). */
function fleche(S: Presentation['ShapeType'], d: Diapo, n: Niveau, x: number, y: number, w: number): void {
  const c = NIVEAUX[n]?.couleur ?? C.vert;
  d.addShape(S.rightArrow, { x, y, w, h: w * 0.62, rotate: n === 'vert' ? -35 : n === 'rouge' ? 35 : 0, fill: { color: c }, line: { color: c, width: 0.5 } });
}

/** Dessine la diapositive dans une présentation (vraie ou d'aperçu). */
export function dessiner(pres: Presentation, d: DonneesDiapo): void {
  const slide = pres.addSlide();
  slide.background = { color: C.blanc };
  const S = pres.ShapeType;
  const M = 0.35, W = LARGEUR - 2 * M;
  const txt = (t: Texte, o: Options): unknown => slide.addText(t, { fontFace: POLICE, color: C.texte, margin: 0, valign: 'middle', isTextBox: true, ...o });
  const puces = (l: string[]): Morceau[] =>
    (l.length ? l : ['—']).map((t, k, a) => ({ text: t, options: { bullet: { indent: 10 }, breakLine: k < a.length - 1, paraSpaceAfter: 2 } }));
  const logo = (img: string | null, o: Options, libelle: string): void => {
    if (img) slide.addImage({ data: img.replace(/^data:/, ''), x: o['x'], y: o['y'], w: o['w'], h: o['h'], sizing: { type: 'contain', w: o['w'], h: o['h'] } });
    else slide.addText(libelle, { ...o, fontFace: POLICE, fontSize: 8, color: '8A9AA8', align: 'center', valign: 'middle', margin: 0, isTextBox: true, fill: { color: 'F2F4F6' }, line: { color: 'C9D2D9', width: 0.75, dashType: 'dash' } });
  };
  // ---- en-tête : qui, quoi, quand ----
  logo(d.logoClient, { x: M, y: 0.3, w: 0.95, h: 0.62 }, d.client || 'Logo client');
  txt([{ text: d.client, options: { bold: true } }, { text: '  ·  ' + d.projet, options: { bold: false } }], { x: 1.45, y: 0.26, w: 7.2, h: 0.42, fontSize: 19, fit: 'shrink' });
  const pe = d.periode;
  txt(
    pe.type === 'mois'
      ? [{ text: 'Point mensuel', options: { bold: true, color: C.bleu } }, { text: `  ·  ${pe.libelleMois}`, options: { color: C.doux } }]
      : [{ text: `Point hebdomadaire · Semaine ${pe.numero}`, options: { bold: true, color: C.bleu } }, { text: `  ·  du ${fD(pe.debut).slice(0, 5)} au ${fD(pe.fin)}`, options: { color: C.doux } }],
    { x: 1.45, y: 0.68, w: 7.2, h: 0.26, fontSize: 10 },
  );
  txt(`${d.typologie} · facturation ${d.modeFacturation} · du ${fD(d.debut)} au ${fD(d.fin)} · extension de périmètre : ${d.extension}`, { x: 1.45, y: 0.94, w: 7.2, h: 0.22, fontSize: 8, color: C.doux });
  logo(d.logoEntreprise, { x: LARGEUR - M - 0.62, y: 0.3, w: 0.62, h: 0.62 }, 'Logo');
  const equipe = [['Commercial', d.commercial || '—'], ['AVV', d.avv || '—'], ['Pilote delivery', d.pilote || '—'], ['Consultants', d.consultants.join(', ') || '—']];
  equipe.forEach(([l, v], k) => {
    txt(l, { x: 8.85, y: 0.27 + k * 0.22, w: 0.95, h: 0.22, fontSize: 7.5, color: C.doux, valign: 'top' });
    txt(v, { x: 9.8, y: 0.27 + k * 0.22, w: 2.4, h: k === 3 ? 0.42 : 0.22, fontSize: 7.5, bold: true, valign: 'top', fit: 'shrink' });
  });
  // ---- chiffres clés ----
  const kw = (W - 4 * 0.15) / 5, ky = 1.38, kh = 0.92;
  const carte = (k: number, libelle: string, valeur: string, sous: string, couleurSous: string | null, barre: number | null): void => {
    const x = M + k * (kw + 0.15);
    slide.addShape(S.roundRect, { x, y: ky, w: kw, h: kh, rectRadius: 0.07, fill: { color: C.fond }, line: { color: C.fond } });
    txt(libelle, { x: x + 0.14, y: ky + 0.08, w: kw - 0.28, h: 0.2, fontSize: 7.5, color: C.doux });
    txt(valeur, { x: x + 0.14, y: ky + 0.28, w: kw - 0.28, h: 0.36, fontSize: 17, bold: true, fit: 'shrink' });
    if (barre != null) {
      slide.addShape(S.roundRect, { x: x + 0.14, y: ky + 0.66, w: kw - 0.28, h: 0.07, rectRadius: 0.03, fill: { color: 'DCE4EA' }, line: { color: 'DCE4EA' } });
      if (barre > 0)
        slide.addShape(S.roundRect, { x: x + 0.14, y: ky + 0.66, w: Math.max(0.07, (kw - 0.28) * Math.min(barre, 1)), h: 0.07, rectRadius: 0.03, fill: { color: C.bleu }, line: { color: C.bleu } });
    }
    txt(sous, { x: x + 0.14, y: ky + (barre != null ? 0.73 : 0.64), w: kw - 0.28, h: 0.18, fontSize: 7, color: couleurSous || C.doux, fit: 'shrink' });
  };
  const ecart = d.atterrissage - d.prevu;
  carte(0, 'Consommation', `${Math.round(d.avancement * 100)} %`, `${fJ(d.conso)} JH consommés sur ${fJ(d.prevu)}`, null, d.avancement);
  carte(1, 'Budget consommé (au TJM)', fE(d.budgetConsomme), `sur ${fE(d.budgetInitial)} vendus`, null, d.budgetInitial ? d.budgetConsomme / d.budgetInitial : 0);
  carte(2, 'Atterrissage', `${fJ(d.atterrissage)} JH`, `${ecart > 0.05 ? '+' : ecart < -0.05 ? '−' : ''}${fJ(Math.abs(ecart))} JH par rapport au prévu`, ecart > 0.05 ? C.rouge : C.vert, null);
  carte(3, 'Fin prévue', fD(d.fin), d.glissement > 0 ? `+${d.glissement} j après la fin contractuelle` : 'dans les délais du contrat', d.glissement > 0 ? C.rouge : C.vert, null);
  const enRetard = d.echeances.filter((e) => e.statut === 'En retard').length;
  carte(4, 'Facturé', fE(d.facture), enRetard ? `${enRetard} échéance${enRetard > 1 ? 's' : ''} en retard` : 'aucune échéance en retard', enRetard ? C.rouge : C.vert, null);
  // ---- titres de section : texte seul, sans bandeau ----
  const section = (t: string, x: number, y: number, w: number, droite?: string): void => {
    txt(t, { x, y, w, h: 0.26, fontSize: 10, bold: true });
    if (droite) txt(droite, { x, y, w, h: 0.26, fontSize: 7, color: C.doux, align: 'right' });
  };
  const tableau = (l: Cellule[][], o: Options): unknown =>
    slide.addTable(l, { fontFace: POLICE, fontSize: 7.5, color: C.texte, valign: 'middle', margin: [1, 4, 1, 4], border: { type: 'solid', pt: 0.5, color: 'E3E8EC' }, ...o });
  const th = (t: string, align = 'left'): Cellule => ({ text: t, options: { bold: true, color: C.blanc, fill: { color: C.marine }, align, fontSize: 7 } });
  const td = (t: string, align = 'left', o: Options = {}): Cellule => ({ text: t, options: { align, fill: { color: C.blanc }, ...o } });
  const point = (n: Niveau): Cellule => ({ text: '●', options: { fontFace: 'Arial', fontSize: 10, color: NIVEAUX[n].couleur, align: 'center', fill: { color: C.blanc } } });
  // Disposition par question du lecteur : à gauche « que s'est-il passé, que surveiller ? » (faits, points d'attention, risques) ;
  // au centre « combien ? » (budget et charges, échéancier) ; à droite « quelle santé ? » (indicateurs) ; en bas « qui fait quoi ? » (actions).
  const yM = 2.48, yB = 5.55;
  const x2 = M + 3.55 + 0.3, w2 = 5.05, x3 = x2 + w2 + 0.3, w3 = LARGEUR - M - x3;
  // ---- colonne gauche ----
  section(pe.type === 'mois' ? 'Ce mois-ci' : 'Cette semaine', M, yM, 3.55);
  txt(puces(d.actualites), { x: M, y: yM + 0.3, w: 3.55, h: 1.12, fontSize: 8.5, valign: 'top', fit: 'shrink' });
  section('Points d’attention · leviers', M, yM + 1.5, 3.55);
  slide.addShape(S.roundRect, { x: M, y: yM + 1.8, w: 3.55, h: 1.05, rectRadius: 0.06, fill: { color: 'FFF4DB' }, line: { color: 'FFF4DB' } });
  txt(puces(d.attention), { x: M + 0.1, y: yM + 1.86, w: 3.35, h: 0.93, fontSize: 8.5, valign: 'top', fit: 'shrink' });
  // ---- colonne centrale : budget et charges, puis l'échéancier en frise ----
  const phases =
    d.phases.length > 8
      ? [...d.phases.slice(0, 7), d.phases.slice(7).reduce((a, p) => ({ ...a, vendu: a.vendu + p.vendu, conso: a.conso + p.conso, v: a.v + p.v, c: a.c + p.c, raf: a.raf + p.raf, m1: a.m1 + p.m1 }), { phase: 'Autres phases', vendu: 0, conso: 0, v: 0, c: 0, raf: 0, m1: 0, prevu: 0, atter: 0, valoAtter: 0, tend: 'vert' as Niveau })]
      : d.phases;
  const hFrise = 0.62, rh = Math.max(0.2, Math.min(0.3, (yB - 0.1 - (yM + 0.3) - (0.3 + hFrise + 0.14)) / (phases.length + 2)));
  section('Budget et charges par phase', x2, yM, w2, `€ au TJM · jours · M+1 = ${pe.libelleMoisSuivant}`);
  const tot = (k: 'vendu' | 'conso' | 'v' | 'c' | 'raf' | 'm1'): number => somme(phases.map((p) => p[k]));
  const gras = { bold: true, fill: { color: C.fond } };
  tableau(
    [
      [th('Phase'), th('Vendu €', 'right'), th('Conso €', 'right'), th('V', 'right'), th('C', 'right'), th('RAF', 'right'), th('M+1', 'right'), th('', 'center')],
      ...phases.map((p) => [td(p.phase), td(fE(p.vendu), 'right'), td(fE(p.conso), 'right'), td(fJ(p.v), 'right'), td(fJ(p.c), 'right'), td(fJ(p.raf), 'right'), td(fJ(p.m1), 'right'), point(p.tend)]),
      [td('Total', 'left', gras), td(fE(tot('vendu')), 'right', gras), td(fE(tot('conso')), 'right', gras), td(fJ(tot('v')), 'right', gras), td(fJ(tot('c')), 'right', gras), td(fJ(tot('raf')), 'right', gras), td(fJ(tot('m1')), 'right', gras), { text: '', options: gras }],
    ],
    { x: x2, y: yM + 0.3, w: w2, colW: [1.35, 0.8, 0.8, 0.42, 0.42, 0.46, 0.46, 0.34], rowH: rh },
  );
  // échéancier : au plus 7 étiquettes ; s'il y en a plus, on garde d'abord celles qui ne sont pas encore payées
  let ech = d.echeances;
  if (ech.length > 7) {
    const nonPayees = ech.filter((e) => e.statut !== 'Payée');
    ech = (nonPayees.length >= 7 ? nonPayees : [...ech.filter((e) => e.statut === 'Payée').slice(-(7 - nonPayees.length)), ...nonPayees]).slice(0, 7).sort((a, b) => a.n - b.n);
  }
  const autres = d.echeances.length - ech.length;
  const yE = yB - 0.1 - hFrise - 0.3;
  section('Échéancier', x2, yE, w2, `${fE(somme(d.echeances.map((e) => e.montant)))} au total · ${fE(d.facture)} facturé${autres > 0 ? ` · ${autres} autre${autres > 1 ? 's' : ''}` : ''}`);
  const styleStatut: Record<string, [string, string]> = { Payée: ['E3F3F0', C.vert], Facturée: ['E3F3F0', C.vert], 'En retard': ['FBE4EC', C.rouge], Planifiée: [C.fond, C.doux] };
  const gap = 0.08, we = ech.length ? Math.min(1.6, (w2 - gap * (ech.length - 1)) / ech.length) : 0;
  ech.forEach((e, k) => {
    const [fond, couleur] = styleStatut[e.statut] ?? [C.fond, C.doux], x = x2 + k * (we + gap);
    slide.addShape(S.roundRect, { x, y: yE + 0.3, w: we, h: hFrise, rectRadius: 0.06, fill: { color: fond }, line: { color: fond } });
    txt(
      [
        { text: `${e.n} · ${fM(e.mois)}`, options: { bold: true, breakLine: true } },
        { text: court(e.nom, Math.max(10, Math.floor(we * 15))), options: { color: C.doux, fontSize: 6.5, breakLine: true } },
        { text: fE(e.montant), options: { bold: true, breakLine: true } },
        { text: e.statut, options: { color: couleur, bold: e.statut === 'En retard', fontSize: 6.5 } },
      ],
      { x: x + 0.06, y: yE + 0.33, w: we - 0.12, h: hFrise - 0.06, fontSize: we < 0.85 ? 6.5 : 7.5, valign: 'top', fit: 'shrink', paraSpaceAfter: 0 },
    );
  });
  // ---- colonne droite : indicateurs ----
  section('Indicateurs', x3, yM, w3);
  txt(pe.colS, { x: x3 + w3 - 0.9, y: yM + 0.04, w: 0.42, h: 0.2, fontSize: 7, bold: true, color: C.doux, align: 'center' });
  txt(pe.colS1, { x: x3 + w3 - 0.45, y: yM + 0.04, w: 0.42, h: 0.2, fontSize: 7, bold: true, color: C.doux, align: 'center' });
  d.indicateurs.forEach((ind, k) => {
    const y = yM + 0.34 + k * 0.27;
    txt(ind.libelle, { x: x3, y, w: w3 - 1.0, h: 0.24, fontSize: 8 });
    slide.addShape(S.roundRect, { x: x3 + w3 - 0.88, y: y + 0.03, w: 0.38, h: 0.18, rectRadius: 0.08, fill: { color: NIVEAUX[ind.s].couleur }, line: { color: NIVEAUX[ind.s].couleur } });
    slide.addShape(S.roundRect, { x: x3 + w3 - 0.43, y: y + 0.03, w: 0.38, h: 0.18, rectRadius: 0.08, fill: { color: NIVEAUX[ind.s1].couleur }, line: { color: NIVEAUX[ind.s1].couleur } });
  });
  ([['Satisfaction client', d.satisfaction], ['État d’esprit de l’équipe', d.esprit]] as const).forEach(([l, v], k) => {
    const y = yM + 0.34 + 6 * 0.27 + 0.08 + k * 0.32;
    txt(l, { x: x3, y, w: w3 - 1.0, h: 0.28, fontSize: 8 });
    meteo(S, slide, v.meteo, x3 + w3 - 0.83, y + 0.02, 0.25);
    fleche(S, slide, v.tendance, x3 + w3 - 0.38, y + 0.06, 0.26);
  });
  txt(
    (['vert', 'jaune', 'rouge', 'gris'] as Niveau[]).flatMap((n, k) => [
      { text: '● ', options: { color: NIVEAUX[n].couleur, fontFace: 'Arial' } },
      { text: NIVEAUX[n].libelle + (k < 3 ? '   ' : ''), options: { color: C.doux } },
    ]),
    { x: x3, y: yB - 0.32, w: w3, h: 0.16, fontSize: 6.5 },
  );
  // ---- bas : risques sous les points d'attention, actions sur le reste de la largeur ----
  section('Risques', M, yB, 3.55);
  const risques = d.risques.length ? d.risques : [{ libelle: 'Aucun risque ouvert', parade: '', niveau: 'vert' as Niveau }];
  tableau([[th('', 'center'), th('Risque'), th('Remédiation')], ...risques.map((r) => [point(r.niveau), td(r.libelle), td(r.parade || '—', 'left', { color: r.parade ? C.texte : C.doux })])], {
    x: M, y: yB + 0.3, w: 3.55, colW: [0.28, 1.55, 1.72], rowH: 0.34,
  });
  const x4 = x2, w4 = LARGEUR - M - x4;
  section('Actions prioritaires', x4, yB, w4);
  const actions = d.actions.length ? d.actions : [{ libelle: 'Aucune action ouverte', pilote: '', echeance: '', statut: '', commentaire: '', retard: false }];
  tableau(
    [
      [th('Action'), th('Pilote'), th('Échéance'), th('Statut'), th('Commentaire')],
      ...actions.slice(0, 4).map((a) => [
        td(a.libelle, 'left', { bold: true }), td(a.pilote), td(a.echeance ? fD(a.echeance) : '—', 'left', { color: a.retard ? C.rouge : C.texte, bold: a.retard }), td(a.statut),
        td(a.commentaire || '—', 'left', { color: a.commentaire ? C.texte : C.doux, fontSize: 7 }),
      ]),
    ],
    { x: x4, y: yB + 0.3, w: w4, colW: [2.45, 1.25, 0.8, 0.75, w4 - 5.25], rowH: 0.27 },
  );
  txt(`Généré par Astrolabe le ${fD(d.genereLe)} · montants HT · consommé arrêté au ${fD(pe.fin)}`, { x: M, y: 7.26, w: W, h: 0.16, fontSize: 6.5, color: '8A9AA8', align: 'right' });
}

/** Présentation PowerPoint d'une diapositive (16:9 large, police Montserrat). */
export function presentation(Pptx: ConstructeurPresentation, d: DonneesDiapo): Presentation {
  const pres = new Pptx();
  pres.layout = 'LAYOUT_WIDE';
  pres.theme = { headFontFace: POLICE, bodyFontFace: POLICE };
  pres.title = `${d.periode.type === 'mois' ? 'Point mensuel ' + d.periode.libelleMois : 'Point hebdo S' + d.periode.numero} — ${d.client}`;
  pres.author = 'Astrolabe';
  dessiner(pres, d);
  return pres;
}

// ============================================================ aperçu à l'écran
const echapper = (t: unknown): string => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
/** Couleur PptxGenJS (6 chiffres hexadécimaux) ; toute autre valeur est ignorée. */
const coul = (c: unknown): string => (typeof c === 'string' && /^[0-9A-Fa-f]{6}$/.test(c) ? '#' + c : 'inherit');
const nombre = (v: unknown): number => (typeof v === 'number' && isFinite(v) ? v : 0);
interface MorceauRendu {
  text: string;
  o: Options;
}
function paragraphes(t: Texte): MorceauRendu[][] {
  const morceaux: Morceau[] = Array.isArray(t) ? t : [{ text: String(t ?? ''), options: {} }];
  const ps: MorceauRendu[][] = [[]];
  for (const m of morceaux) {
    String(m.text ?? '').split('\n').forEach((l, k) => {
      if (k) ps.push([]);
      ps[ps.length - 1].push({ text: l, o: m.options ?? {} });
    });
    if (m.options?.['breakLine']) ps.push([]);
  }
  return ps.filter((p, k) => p.length || k < ps.length - 1);
}
const styleMorceau = (o: Options): string =>
  [o['bold'] ? 'font-weight:700' : '', o['italic'] ? 'font-style:italic' : '', o['color'] ? `color:${coul(o['color'])}` : '', o['fontSize'] ? `font-size:${nombre(o['fontSize'])}pt` : '',
    o['fontFace'] === 'Arial' ? 'font-family:Arial,sans-serif' : '', o['underline'] ? 'text-decoration:underline' : ''].filter(Boolean).join(';');
function htmlTexte(t: Texte): string {
  return paragraphes(t)
    .map((p) => `<div class="ph-p${p.some((m) => m.o['bullet']) ? ' ph-puce' : ''}">${p.map((m) => `<span style="${styleMorceau(m.o)}">${echapper(m.text)}</span>`).join('') || '&nbsp;'}</div>`)
    .join('');
}
const FORMES: Record<string, (c: string) => string> = {
  sun: (c) => `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="${c}"/>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<rect x="11" y="0.5" width="2" height="4.5" rx="1" fill="${c}" transform="rotate(${a} 12 12)"/>`).join('')}</svg>`,
  cloud: (c) => `<svg viewBox="0 0 24 16" preserveAspectRatio="none"><path d="M6 15a5 5 0 0 1-.6-9.96A7 7 0 0 1 19 6a4.5 4.5 0 0 1-.5 9z" fill="${c}"/></svg>`,
  lightningBolt: (c) => `<svg viewBox="0 0 12 20" preserveAspectRatio="none"><path d="M7 0 0 11h5l-2 9 9-12H7l2-8z" fill="${c}"/></svg>`,
  rightArrow: (c) => `<svg viewBox="0 0 24 15" preserveAspectRatio="none"><path d="M0 4h14V0l10 7.5L14 15v-4H0z" fill="${c}"/></svg>`,
};

/**
 * Aperçu HTML de la diapositive. Tout texte venant de la saisie est échappé ; les styles ne contiennent que des nombres
 * et des couleurs contrôlées ; les images ne peuvent être que des images PNG ou JPEG intégrées (data:image/…).
 */
export function apercu(d: DonneesDiapo): string {
  const el: string[] = [];
  const pos = (o: Options): string => `left:${nombre(o['x'])}in;top:${nombre(o['y'])}in;width:${nombre(o['w'])}in;height:${nombre(o['h'])}in`;
  const diapo: Diapo = {
    addText: (t, o) => {
      const va = o['valign'] === 'top' ? 'flex-start' : o['valign'] === 'bottom' ? 'flex-end' : 'center';
      const align = ['left', 'center', 'right'].includes(o['align']) ? o['align'] : 'left';
      const cadre = o['fill'] ? `background:${coul(o['fill'].color)};` : '';
      const bord = o['line'] ? `border:${nombre(o['line'].width) || 0.75}pt ${o['line'].dashType === 'dash' ? 'dashed' : 'solid'} ${coul(o['line'].color)};` : '';
      return el.push(`<div class="ph-t" style="${pos(o)};justify-content:${va};text-align:${align};font-size:${nombre(o['fontSize']) || 10}pt;color:${coul(o['color'])};${o['bold'] ? 'font-weight:700;' : ''}${cadre}${bord}">${htmlTexte(t)}</div>`);
    },
    addShape: (forme, o) => {
      const c = coul(o['fill']?.color ?? o['line']?.color), rot = o['rotate'] ? `transform:rotate(${nombre(o['rotate'])}deg);` : '';
      if (forme === 'line')
        return el.push(`<div class="ph-s" style="left:${nombre(o['x'])}in;top:${nombre(o['y'])}in;width:${Math.max(nombre(o['w']), 0.001)}in;height:${Math.max(nombre(o['h']), 0.001)}in;border-${o['w'] ? 'top' : 'left'}:${nombre(o['line']?.width) || 0.75}pt solid ${coul(o['line']?.color)}"></div>`);
      if (FORMES[forme]) return el.push(`<div class="ph-s" style="${pos(o)};${rot}">${FORMES[forme](c)}</div>`);
      return el.push(`<div class="ph-s" style="${pos(o)};background:${c};${forme === 'roundRect' ? `border-radius:${nombre(o['rectRadius']) || 0.06}in;` : ''}${rot}"></div>`);
    },
    addTable: (lignes, o) => {
      const bord = `${nombre(o['border']?.pt) || 0.5}pt solid ${coul(o['border']?.color ?? 'DDDDDD')}`;
      const cols = ((o['colW'] as number[]) ?? []).map((w) => `<col style="width:${nombre(w)}in">`).join('');
      const corps = lignes
        .map((r) => `<tr style="height:${nombre(o['rowH']) || 0.25}in">${r.map((c) => {
          const co = c.options ?? {};
          const st = [`background:${co['fill'] ? coul(co['fill'].color) : 'transparent'}`, `text-align:${['left', 'center', 'right'].includes(co['align']) ? co['align'] : 'left'}`, `border:${bord}`,
            co['color'] ? `color:${coul(co['color'])}` : '', co['bold'] ? 'font-weight:700' : '', co['fontSize'] ? `font-size:${nombre(co['fontSize'])}pt` : '', co['fontFace'] === 'Arial' ? 'font-family:Arial,sans-serif' : ''].filter(Boolean).join(';');
          return `<td style="${st}">${htmlTexte(c.text)}</td>`;
        }).join('')}</tr>`)
        .join('');
      return el.push(`<table class="ph-tb" style="left:${nombre(o['x'])}in;top:${nombre(o['y'])}in;width:${nombre(o['w'])}in;font-size:${nombre(o['fontSize']) || 8}pt;color:${coul(o['color'])}"><colgroup>${cols}</colgroup>${corps}</table>`);
    },
    addImage: (o) => {
      const src = 'data:' + String(o['data'] ?? '');
      if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(src)) return 0;
      return el.push(`<img class="ph-s" alt="" style="${pos(o)};object-fit:contain" src="${echapper(src)}">`);
    },
  };
  const fausse: Presentation = {
    ShapeType: { rect: 'rect', roundRect: 'roundRect', line: 'line', sun: 'sun', cloud: 'cloud', lightningBolt: 'lightningBolt', rightArrow: 'rightArrow', diamond: 'diamond' },
    addSlide: () => diapo,
    write: () => Promise.resolve(null),
  };
  dessiner(fausse, d);
  return `<div class="ph-diapo">${el.join('')}</div>`;
}
