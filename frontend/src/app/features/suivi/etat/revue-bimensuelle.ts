import JSZip from 'jszip';
import { fD, fE, fJ } from './formats';
import { DonneesDiapo, Niveau } from './point-hebdo.logique';

const P_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const C_NS = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const S_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const TEMPLATE_URL = '/modeles/revue-bimensuelle.pptx';

const NIV: Record<Niveau, string> = { vert: 'OK', jaune: 'Vigilance', rouge: 'Alerte', gris: 'N/A' };
const NIV_COLOR: Record<Niveau, string> = { vert: '3FB97C', jaune: 'FFC33C', rouge: 'EE6B57', gris: 'E4E8F0' };
const METEO_COLOR: Record<string, string> = { Soleil: '3FB97C', Nuageux: 'FFC33C', Pluie: 'EE6B57', 'Hors période': 'E4E8F0' };
const money = (v: number | null | undefined): string => fE(v ?? 0).replace(/\u00a0/g, ' ');
const date = (v: string | null | undefined): string => v ? fD(v) : '—';
const short = (s: string, max = 85): string => s.length > max ? s.slice(0, max - 1) + '…' : s;
const severity = (s: Niveau): string => s === 'rouge' ? 'Fort' : s === 'jaune' ? 'Moyen' : s === 'vert' ? 'Faible' : 'N/A';
const criticality = (s: Niveau): string => s === 'rouge' ? 'Fort' : s === 'jaune' ? 'Moyen' : s === 'vert' ? 'Faible' : 'N/A';

function parseXml(xml: string): XMLDocument {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Le modèle PowerPoint contient un XML invalide.');
  return doc;
}
function named(doc: XMLDocument, tag: string, name: string): Element | undefined {
  const els = Array.from(doc.getElementsByTagNameNS(P_NS, tag));
  return els.find((el) => el.getElementsByTagNameNS(P_NS, 'cNvPr')[0]?.getAttribute('name') === name);
}
function writeParagraph(p: Element, value: string): void {
  let texts = Array.from(p.getElementsByTagNameNS(A_NS, 't'));
  if (!texts.length) {
    const run = p.ownerDocument!.createElementNS(A_NS, 'a:r');
    const text = p.ownerDocument!.createElementNS(A_NS, 'a:t');
    run.appendChild(text); p.appendChild(run); texts = [text];
  }
  texts[0].textContent = value;
  texts[0].setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
  for (const t of texts.slice(1)) t.textContent = '';
}
function setShapeText(doc: XMLDocument, name: string, value: string | string[]): void {
  const shape = named(doc, 'sp', name);
  if (!shape) return;
  const body = shape.getElementsByTagNameNS(P_NS, 'txBody')[0];
  if (!body) return;
  let paras = Array.from(body.getElementsByTagNameNS(A_NS, 'p'));
  const lines = Array.isArray(value) ? value : [value];
  while (paras.length < lines.length && paras.length) {
    const clone = paras[paras.length - 1].cloneNode(true) as Element;
    body.appendChild(clone); paras.push(clone);
  }
  paras.forEach((p, i) => writeParagraph(p, lines[i] ?? ''));
}
function setShapeRuns(doc: XMLDocument, name: string, values: string[]): void {
  const shape = named(doc, 'sp', name);
  if (!shape) return;
  const runs = Array.from(shape.getElementsByTagNameNS(A_NS, 'r'));
  values.forEach((v, i) => {
    const t = runs[i]?.getElementsByTagNameNS(A_NS, 't')[0];
    if (t) t.textContent = v;
  });
}
function table(doc: XMLDocument, name: string): Element | undefined {
  const frame = named(doc, 'graphicFrame', name);
  return frame?.getElementsByTagNameNS(A_NS, 'tbl')[0];
}
function setCellText(cell: Element, value: string): void {
  const paras = Array.from(cell.getElementsByTagNameNS(A_NS, 'p'));
  if (paras.length) {
    writeParagraph(paras[0], value);
    for (const p of paras.slice(1)) writeParagraph(p, '');
  }
}
function setCellFill(cell: Element, color: string): void {
  const doc = cell.ownerDocument!;
  let tcPr = Array.from(cell.children).find((x) => x.localName === 'tcPr') as Element | undefined;
  if (!tcPr) { tcPr = doc.createElementNS(A_NS, 'a:tcPr'); cell.appendChild(tcPr); }
  for (const f of Array.from(tcPr.children).filter((x) => ['solidFill', 'gradFill', 'noFill', 'blipFill', 'pattFill'].includes(x.localName))) tcPr.removeChild(f);
  const fill = doc.createElementNS(A_NS, 'a:solidFill');
  const rgb = doc.createElementNS(A_NS, 'a:srgbClr'); rgb.setAttribute('val', color); fill.appendChild(rgb); tcPr.insertBefore(fill, tcPr.firstChild);
}
function setTable(doc: XMLDocument, name: string, rows: string[][], fills: Record<string, string> = {}): void {
  const tbl = table(doc, name);
  if (!tbl) return;
  const trs = Array.from(tbl.getElementsByTagNameNS(A_NS, 'tr'));
  for (let ri = 1; ri < trs.length; ri++) {
    const cells = Array.from(trs[ri].getElementsByTagNameNS(A_NS, 'tc'));
    const values = rows[ri - 1] ?? [];
    cells.forEach((cell, ci) => {
      setCellText(cell, values[ci] ?? '');
      const fill = fills[`${ri - 1}:${ci}`];
      if (fill) setCellFill(cell, fill);
    });
  }
}
function xml(doc: XMLDocument): string {
  return new XMLSerializer().serializeToString(doc).replace(/xmlns(:\w+)?=""/g, '');
}
function statusColor(n: Niveau): string { return NIV_COLOR[n] ?? NIV_COLOR.gris; }
function pire(a: Niveau, b: Niveau): Niveau {
  const rank: Record<Niveau, number> = { rouge: 0, jaune: 1, vert: 2, gris: 3 };
  return rank[a] <= rank[b] ? a : b;
}
function fenetreEcheances<T extends { statut: string }>(items: T[], maximum = 7): T[] {
  if (items.length <= maximum) return items;
  const i = Math.max(0, items.findIndex((e) => !['Payée', 'Facturée'].includes(e.statut)));
  const debut = Math.max(0, Math.min(items.length - maximum, i - 2));
  return items.slice(debut, debut + maximum);
}
function avecAutresPhases(items: DonneesDiapo['phases'], maximum = 11): DonneesDiapo['phases'] {
  if (items.length <= maximum) return items;
  const keep = items.slice(0, maximum - 1), rest = items.slice(maximum - 1);
  const tend = rest.reduce((n, x) => pire(n, x.tend), 'vert' as Niveau);
  return [...keep, { ...rest[0], phase: 'Autres', vendu: rest.reduce((n, x) => n + x.vendu, 0), conso: rest.reduce((n, x) => n + x.conso, 0), v: 0, c: 0, raf: rest.reduce((n, x) => n + x.raf, 0), m1: rest.reduce((n, x) => n + x.m1, 0), prevu: rest.reduce((n, x) => n + x.prevu, 0), atter: rest.reduce((n, x) => n + x.atter, 0), valoAtter: rest.reduce((n, x) => n + x.valoAtter, 0), tend }];
}
function avecAutresProfils(items: DonneesDiapo['profils'], maximum = 11): DonneesDiapo['profils'] {
  if (items.length <= maximum) return items;
  const ordered = [...items].sort((a, b) => (b.vendu + b.conso) - (a.vendu + a.conso));
  const keep = ordered.slice(0, maximum - 1), rest = ordered.slice(maximum - 1);
  const tend = rest.reduce((n, x) => pire(n, x.tend), 'vert' as Niveau);
  return [...keep, { profil: 'Autres', vendu: rest.reduce((n, x) => n + x.vendu, 0), conso: rest.reduce((n, x) => n + x.conso, 0), raf: rest.reduce((n, x) => n + x.raf, 0), m1: rest.reduce((n, x) => n + x.m1, 0), tend }];
}
function lines(values: string[], maximum: number, maxCharacters?: number): string[] {
  const clean = values.map((x) => x.trim()).filter(Boolean);
  const fit = (value: string) => maxCharacters ? short(value, maxCharacters) : value;
  return clean.length <= maximum
    ? clean.map(fit)
    : [...clean.slice(0, maximum - 1).map(fit), fit(`Autres (${clean.length - maximum + 1}) : ${clean.slice(maximum - 1).join('; ')}`)];
}
function fillWorkbook(zip: JSZip, path: string, value: string | number): Promise<void> {
  const file = zip.file(path);
  if (!file) return Promise.resolve();
  return file.async('string').then((text) => {
    const doc = parseXml(text);
    const cell = Array.from(doc.getElementsByTagNameNS(S_NS, 'c')).find((c) => c.getAttribute('r') === 'B1');
    if (cell) {
      for (const child of Array.from(cell.children)) if (['v', 'is'].includes(child.localName)) cell.removeChild(child);
      if (typeof value === 'number') {
        cell.removeAttribute('t');
        const v = doc.createElementNS(S_NS, 'v'); v.textContent = String(value); cell.appendChild(v);
      } else {
        cell.setAttribute('t', 'inlineStr');
        const is = doc.createElementNS(S_NS, 'is'), t = doc.createElementNS(S_NS, 't'); t.textContent = value; is.appendChild(t); cell.appendChild(is);
      }
    }
    const d1 = Array.from(doc.getElementsByTagNameNS(S_NS, 'c')).find((c) => c.getAttribute('r') === 'D1');
    const dv = d1?.getElementsByTagNameNS(S_NS, 'v')[0];
    if (dv) dv.textContent = typeof value === 'number' ? `${Math.round(value * 100)} %` : value;
    zip.file(path, xml(doc));
  });
}
async function updateCharts(zip: JSZip, meteo: string, avancement: number): Promise<void> {
  const wx = await zip.file('ppt/charts/chart1.xml')?.async('string');
  if (wx) {
    const doc = parseXml(wx);
    const idx = ['Soleil', 'Nuageux', 'Pluie', 'Orage', 'Hors période', 'À renseigner'].indexOf(meteo);
    for (const [i, ser] of Array.from(doc.getElementsByTagNameNS(C_NS, 'ser')).entries()) {
      const v = ser.getElementsByTagNameNS(C_NS, 'yVal')[0]?.getElementsByTagNameNS(C_NS, 'v')[0];
      if (v) v.textContent = i === idx ? '0' : '#N/A';
    }
    zip.file('ppt/charts/chart1.xml', xml(doc));
  }
  const px = await zip.file('ppt/charts/chart2.xml')?.async('string');
  if (px) {
    const doc = parseXml(px);
    const title = doc.getElementsByTagNameNS(C_NS, 'title')[0]?.getElementsByTagNameNS(C_NS, 'v')[0];
    if (title) title.textContent = `${Math.round(avancement * 100)} %`;
    const values = Array.from(doc.getElementsByTagNameNS(C_NS, 'val'))[0]?.getElementsByTagNameNS(C_NS, 'v') ?? [];
    if (values[0]) values[0].textContent = String(Math.max(0, Math.min(1, avancement)));
    if (values[1]) values[1].textContent = String(1 - Math.max(0, Math.min(1, avancement)));
    zip.file('ppt/charts/chart2.xml', xml(doc));
  }
}

export async function genererRevueBimensuelle(d: DonneesDiapo, fetcher: typeof fetch = fetch): Promise<Blob> {
  const response = await fetcher(TEMPLATE_URL);
  if (!response.ok) throw new Error('Le modèle PowerPoint de revue bimensuelle est absent. Ajoutez public/modeles/revue-bimensuelle.pptx au dépôt.');
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const indicateur = (k: string) => d.indicateurs.find((x) => x.cle === k);
  const satisfaction = indicateur('satisfaction')?.s ?? 'gris';
  const meteo = d.meteoProjet;
  const projet = `${d.client || 'Client'} – ${d.projet || 'Projet'}`;
  const slides: Record<number, (doc: XMLDocument) => void> = {
    1: (doc) => {
      setShapeText(doc, 'Title 1', 'Suivi global : la météo du portefeuille en un coup d’œil');
      setTable(doc, 'Table 12', [[d.aEvoquer ? 'À évoquer' : '', projet, d.pilote || '—', money(d.budgetInitial), money(d.budgetConsomme), fJ(d.prevu), fJ(d.conso), `${Math.round(d.avancement * 100)} %`, NIV[satisfaction], meteo, short(d.difficulte, 90), short(d.impact, 60)]], {
        ...(d.aEvoquer ? Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`0:${i}`, 'A9C4FF'])) : {}), [`0:8`]: statusColor(satisfaction), [`0:9`]: METEO_COLOR[meteo] ?? METEO_COLOR['Hors période'],
      });
    },
    2: (doc) => {
      setShapeText(doc, 'TextBox 10', 'CLIENT  ·  FICHE PROJET · PILOTAGE');
      setShapeText(doc, 'Title 1', projet);
      setShapeText(doc, 'TextBox 13', d.typologie || 'Forfait');
      setShapeText(doc, 'TextBox 16', `Facturation ${d.modeFacturation || 'J.H'}`);
      setShapeText(doc, 'TextBox 19', `${date(d.debut)} → ${date(d.fin)}`);
      setShapeText(doc, 'TextBox 22', `Extension : ${d.extension}`);
      setShapeText(doc, 'TextBox 37', `Quinzaine du ${date(d.periode.debut)} au ${date(d.periode.fin)}`);
      setShapeRuns(doc, 'TextBox 28', ['COMMERCIAL  ', d.commercial || '—', '   |   ', 'AVV  ', d.avv || '—', '   |   ', 'PILOTE DELIVERY  ', d.pilote || '—', '   |   ', 'CONSULTANTS  ', d.consultants[0] || '—', d.consultants.slice(1).join(', ')]);
      setShapeText(doc, 'TextBox 39', lines(d.actualites, 5, 110));
      setShapeText(doc, 'TextBox 44', lines(d.attention, 5, 110));
      setTable(doc, 'Table 33', d.indicateurs.map((x) => [x.libelle, NIV[x.s], NIV[x.s1]]), Object.fromEntries(d.indicateurs.flatMap((x, i) => [[`${i}:1`, statusColor(x.s)], [`${i}:2`, statusColor(x.s1)]])));
      setTable(doc, 'Table 50', d.risques.map((x) => [criticality(x.niveau), short(x.type || '—', 30), short(x.libelle, 60), short(x.parade, 60)]), Object.fromEntries(d.risques.map((x, i) => [`${i}:0`, statusColor(x.niveau)])));
      setTable(doc, 'Table 55', d.actions.map((x) => [short(x.libelle, 45), x.pilote, date(x.echeance), x.retard ? 'En retard' : x.statut, short(x.commentaire, 40)]), Object.fromEntries(d.actions.map((x, i) => [`${i}:3`, x.retard ? 'EE6B57' : x.statut === 'Fait' ? '3FB97C' : x.statut === 'En cours' ? 'A9C4FF' : 'E4E8F0'])));
      setShapeText(doc, 'TextBox 104', 'Cellule de tableau : trame de fond selon le statut.');
    },
    3: (doc) => {
      setShapeText(doc, 'Title 1', projet);
      setShapeText(doc, 'TextBox 11', `Données au ${date(d.genereLe)}`);
      setShapeText(doc, 'TextBox 14', money(d.budgetInitial));
      setShapeText(doc, 'TextBox 17', money(d.budgetConsomme));
      setShapeText(doc, 'TextBox 20', fJ(d.prevu));
      setShapeText(doc, 'TextBox 23', fJ(d.conso));
      setShapeText(doc, 'TextBox 26', fJ(d.raf));
      setShapeText(doc, 'TextBox 29', money(d.facture));
      const phases = avecAutresPhases(d.phases);
      setTable(doc, 'Table 35', phases.map((x) => [d.odt[x.phase] || '—', x.phase, fJ(x.vendu), fJ(x.conso), NIV[x.tend]]), Object.fromEntries(phases.map((x, i) => [`${i}:4`, statusColor(x.tend)])));
      const profils = avecAutresProfils(d.profils);
      setTable(doc, 'Table 41', profils.map((x) => [x.profil, fJ(x.vendu), fJ(x.conso), fJ(x.raf), fJ(x.m1), NIV[x.tend]]), Object.fromEntries(profils.map((x, i) => [`${i}:5`, statusColor(x.tend)])));
      const invoices = fenetreEcheances(d.echeances, 7);
      for (let i = 0; i < 7; i++) {
        const e = invoices[i];
        setShapeText(doc, `TextBox ${48 + i * 2}`, e ? `N° ${e.n} · ${Math.round(e.pct * 100)} % · ${e.nom} · ${e.mois || 'Sans date'} · ${money(e.montant)} · ${e.statut}` : '');
      }
    },
  };
  for (const n of [1, 2, 3]) {
    const path = `ppt/slides/slide${n}.xml`;
    const file = zip.file(path);
    if (!file) throw new Error(`Le modèle PowerPoint ne contient pas ${path}.`);
    const doc = parseXml(await file.async('string'));
    slides[n](doc);
    zip.file(path, xml(doc));
  }
  const wx = d.meteoProjet === 'Soleil' ? 'soleil' : d.meteoProjet === 'Nuageux' ? 'nuageux' : d.meteoProjet === 'Pluie' ? 'pluie' : 'hors période';
  await fillWorkbook(zip, 'ppt/embeddings/Microsoft_Excel_Worksheet.xlsx', wx);
  await fillWorkbook(zip, 'ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx', Math.max(0, Math.min(1, d.avancement)));
  await updateCharts(zip, d.meteoProjet, d.avancement);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export interface GabaritRevue {
  W: number;
  H: number;
  slides: {
    formes: Record<string, { xf: number[]; algn?: string; anchor?: string; runs?: { t?: string; sz?: number; b?: boolean; col?: string }[]; ins?: number[] }>;
    tables: Record<string, { xf: number[]; cols: number[]; rows: number[]; cells: { algn?: string; sz?: number; marL?: number; marR?: number }[] }>;
  }[];
}
export async function chargerGabaritRevue(fetcher: typeof fetch = fetch): Promise<GabaritRevue | null> {
  try {
    const r = await fetcher('/modeles/gabarit.json');
    if (!r.ok) return null;
    return (await r.json()) as GabaritRevue;
  } catch { return null; }
}
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
function geometry(xf: number[], g: GabaritRevue): string {
  const [x, y, w, h] = xf;
  return `left:${x / g.W * 100}%;top:${y / g.H * 100}%;width:${w / g.W * 100}%;height:${h / g.H * 100}%`;
}
function previewShape(g: GabaritRevue, slideIndex: number, name: string, value: string | string[]): string {
  const shape = g.slides[slideIndex]?.formes[name];
  if (!shape) return '';
  const first = shape.runs?.[0] ?? {};
  const text = (Array.isArray(value) ? value : [value]).map(esc).join('<br>');
  const font = Math.max(8, (first.sz ?? 1000) / 75);
  const color = /^[0-9A-Fa-f]{6}$/.test(first.col ?? '') ? first.col : 'FFFFFF';
  return `<div class="rv-shape" style="${geometry(shape.xf, g)};font-size:${font}px;color:#${color};font-weight:${first.b ? 700 : 400};text-align:${shape.algn === 'ctr' ? 'center' : shape.algn === 'r' ? 'right' : 'left'};display:flex;align-items:${shape.anchor === 't' ? 'flex-start' : 'center'}">${text}</div>`;
}
interface PreviewTable { name: string; rows: string[][]; fills?: Record<string, string>; skipColumns?: number[] }
function previewTable(g: GabaritRevue, slideIndex: number, t: PreviewTable): string {
  const meta = g.slides[slideIndex]?.tables[t.name];
  if (!meta) return '';
  const [x, y, w, h] = meta.xf;
  const totalCols = meta.cols.reduce((a, b) => a + b, 0) || 1;
  const totalRows = meta.rows.reduce((a, b) => a + b, 0) || 1;
  let top = y;
  let out = '';
  for (let ri = 0; ri < meta.rows.length - 1; ri++) {
    top += meta.rows[ri];
    let left = x;
    for (let ci = 0; ci < meta.cols.length; ci++) {
      const cw = meta.cols[ci];
      const val = t.rows[ri]?.[ci] ?? '';
      if (val && !(t.skipColumns ?? []).includes(ci)) {
        const style = meta.cells[ci] ?? {};
        const fill = t.fills?.[`${ri}:${ci}`];
        const font = Math.max(7, (style.sz ?? 900) / 75);
        const align = style.algn === 'ctr' ? 'center' : style.algn === 'r' ? 'right' : 'left';
        const margin = Math.max(1, (style.marL ?? 27000) / g.W * 1280);
        out += `<div class="rv-cell" style="left:${left / g.W * 100}%;top:${top / g.H * 100}%;width:${cw / g.W * 100}%;height:${meta.rows[ri + 1] / g.H * 100}%;font-size:${font}px;text-align:${align};padding-left:${margin}px;padding-right:${margin}px;${fill ? `background:#${fill};` : ''}">${esc(val)}</div>`;
      }
      left += cw;
    }
  }
  return out;
}
export function apercuRevueBimensuelle(d: DonneesDiapo, g: GabaritRevue): string {
  const projet = `${d.client || 'Client'} – ${d.projet || 'Projet'}`;
  const sat = d.indicateurs.find((x) => x.cle === 'satisfaction')?.s ?? 'gris';
  const textBySlide: Record<number, Record<string, string | string[]>> = {
    1: { 'Title 1': 'Suivi global : la météo du portefeuille en un coup d’œil' },
    2: {
      'TextBox 10': 'CLIENT · FICHE PROJET · PILOTAGE', 'Title 1': projet, 'TextBox 13': d.typologie || 'Forfait',
      'TextBox 16': `Facturation ${d.modeFacturation || 'J.H'}`, 'TextBox 19': `${date(d.debut)} → ${date(d.fin)}`,
      'TextBox 22': `Extension : ${d.extension}`, 'TextBox 28': `COMMERCIAL  ${d.commercial || '—'}   |   AVV  ${d.avv || '—'}   |   PILOTE DELIVERY  ${d.pilote || '—'}   |   CONSULTANTS  ${d.consultants.join(', ') || '—'}`,
      'TextBox 37': `Quinzaine du ${date(d.periode.debut)} au ${date(d.periode.fin)}`,
      'TextBox 39': lines(d.actualites, 5, 110), 'TextBox 44': lines(d.attention, 5, 110),
    },
    3: {
      'Title 1': projet, 'TextBox 11': `Données au ${date(d.genereLe)}`, 'TextBox 14': money(d.budgetInitial),
      'TextBox 17': money(d.budgetConsomme), 'TextBox 20': fJ(d.prevu), 'TextBox 23': fJ(d.conso),
      'TextBox 26': fJ(d.raf), 'TextBox 29': money(d.facture),
    },
  };
  const tables: Record<number, PreviewTable[]> = {
    1: [{ name: 'Table 12', rows: [[d.aEvoquer ? 'À évoquer' : '', projet, d.pilote || '—', money(d.budgetInitial), money(d.budgetConsomme), fJ(d.prevu), fJ(d.conso), `${Math.round(d.avancement * 100)} %`, NIV[sat], d.meteoProjet, short(d.difficulte), short(d.impact)]], fills: { ...(d.aEvoquer ? Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`0:${i}`, 'A9C4FF'])) : {}), '0:8': statusColor(sat), '0:9': METEO_COLOR[d.meteoProjet] ?? METEO_COLOR['Hors période'] } }],
    2: [
      { name: 'Table 33', rows: d.indicateurs.map((x) => [x.libelle, NIV[x.s], NIV[x.s1]]), fills: Object.fromEntries(d.indicateurs.flatMap((x, i) => [[`${i}:1`, statusColor(x.s)], [`${i}:2`, statusColor(x.s1)]])), skipColumns: [0] },
      { name: 'Table 50', rows: d.risques.map((x) => [severity(x.niveau), short(x.type || '—', 30), short(x.libelle, 60), short(x.parade, 60)]), fills: Object.fromEntries(d.risques.map((x, i) => [`${i}:0`, statusColor(x.niveau)])) },
      { name: 'Table 55', rows: d.actions.map((x) => [short(x.libelle, 45), x.pilote, date(x.echeance), x.retard ? 'En retard' : x.statut, short(x.commentaire, 40)]), fills: Object.fromEntries(d.actions.map((x, i) => [`${i}:3`, x.retard ? 'EE6B57' : x.statut === 'Fait' ? '3FB97C' : x.statut === 'En cours' ? 'A9C4FF' : 'E4E8F0'])) },
    ],
    3: [
      { name: 'Table 35', rows: avecAutresPhases(d.phases).map((x) => [d.odt[x.phase] || '—', x.phase, fJ(x.vendu), fJ(x.conso), NIV[x.tend]]), fills: Object.fromEntries(avecAutresPhases(d.phases).map((x, i) => [`${i}:4`, statusColor(x.tend)])) },
      { name: 'Table 41', rows: avecAutresProfils(d.profils).map((x) => [x.profil, fJ(x.vendu), fJ(x.conso), fJ(x.raf), fJ(x.m1), NIV[x.tend]]), fills: Object.fromEntries(avecAutresProfils(d.profils).map((x, i) => [`${i}:5`, statusColor(x.tend)])) },
    ],
  };
  return g.slides.map((slide, i) => {
    const n = i + 1;
    let html = `<div class="rv-slide" style="background-image:url('/modeles/fond${n}.jpg')">`;
    for (const [name, value] of Object.entries(textBySlide[n] ?? {})) html += previewShape(g, i, name, value);
    for (const t of tables[n] ?? []) html += previewTable(g, i, t);
    html += '</div>';
    return html;
  }).join('');
}
