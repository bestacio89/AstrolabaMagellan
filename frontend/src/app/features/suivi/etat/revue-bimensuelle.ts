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
const severity = (s: string): string => s === 'rouge' ? 'Alerte' : s === 'jaune' ? 'Vigilance' : s === 'vert' ? 'OK' : 'N/A';

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
function lines(values: string[], maximum: number): string[] {
  const clean = values.map((x) => x.trim()).filter(Boolean);
  return clean.length <= maximum ? clean : [...clean.slice(0, maximum - 1), `Autres (${clean.length - maximum + 1}) : ${clean.slice(maximum - 1).join('; ')}`];
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
  const dateSeance = date(d.periode.fin);
  const projet = `${d.client || 'Client'} – ${d.projet || 'Projet'}`;
  const slides: Record<number, (doc: XMLDocument) => void> = {
    1: (doc) => {
      setShapeText(doc, 'Title 1', 'Suivi global : la météo du portefeuille en un coup d’œil');
      setTable(doc, 'Table 12', [[dateSeance, projet, d.pilote || '—', money(d.budgetInitial), money(d.budgetConsomme), fJ(d.prevu), fJ(d.conso), `${Math.round(d.avancement * 100)} %`, NIV[satisfaction], meteo, short(d.difficulte), short(d.impact)]], {
        [`0:8`]: statusColor(satisfaction), [`0:9`]: METEO_COLOR[meteo] ?? METEO_COLOR['Hors période'], [`0:0`]: d.aEvoquer ? 'A9C4FF' : 'E4E8F0',
      });
    },
    2: (doc) => {
      setShapeText(doc, 'TextBox 10', 'CLIENT  ·  FICHE PROJET · PILOTAGE');
      setShapeText(doc, 'Title 1', projet);
      setShapeText(doc, 'TextBox 13', d.typologie || 'Forfait');
      setShapeText(doc, 'TextBox 16', `Facturation ${d.modeFacturation || 'J.H'}`);
      setShapeText(doc, 'TextBox 19', `${date(d.debut)} → ${date(d.fin)}`);
      setShapeText(doc, 'TextBox 22', `Extension : ${d.extension}`);
      setShapeRuns(doc, 'TextBox 28', ['COMMERCIAL  ', d.commercial || '—', '   |   ', 'AVV  ', d.avv || '—', '   |   ', 'PILOTE DELIVERY  ', d.pilote || '—', '   |   ', 'CONSULTANTS  ', d.consultants[0] || '—', d.consultants.slice(1).join(', ')]);
      setShapeText(doc, 'TextBox 39', lines(d.actualites, 3));
      setShapeText(doc, 'TextBox 44', lines([d.difficulte, ...d.attention], 3));
      setShapeText(doc, 'TextBox 48', d.aEvoquer ? 'À évoquer en séance' : 'Pas de point à évoquer');
      setTable(doc, 'Table 33', d.indicateurs.map((x) => [x.libelle, NIV[x.s], NIV[x.s1]]), Object.fromEntries(d.indicateurs.flatMap((x, i) => [[`${i}:1`, statusColor(x.s)], [`${i}:2`, statusColor(x.s1)]])));
      setTable(doc, 'Table 50', d.risques.map((x) => [severity(x.niveau), x.niveau === 'rouge' ? 'Fort' : x.niveau === 'jaune' ? 'Moyen' : 'Faible', short(x.libelle, 70), short(x.parade, 70)]), Object.fromEntries(d.risques.map((x, i) => [`${i}:0`, statusColor(x.niveau)])));
      setTable(doc, 'Table 55', d.actions.map((x) => [short(x.libelle, 65), x.pilote, date(x.echeance), x.retard ? 'En retard' : x.statut, short(x.commentaire, 60)]), Object.fromEntries(d.actions.map((x, i) => [`${i}:3`, x.retard ? 'EE6B57' : x.statut === 'Fait' ? '3FB97C' : x.statut === 'En cours' ? 'A9C4FF' : 'E4E8F0'])));
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
      setTable(doc, 'Table 35', d.phases.map((x) => [d.odt[x.phase] || '—', x.phase, fJ(x.vendu), fJ(x.conso), NIV[x.tend]]), Object.fromEntries(d.phases.map((x, i) => [`${i}:4`, statusColor(x.tend)])));
      setTable(doc, 'Table 41', d.profils.map((x) => [x.profil, fJ(x.vendu), fJ(x.conso), fJ(x.raf), fJ(x.m1), NIV[x.tend]]), Object.fromEntries(d.profils.map((x, i) => [`${i}:5`, statusColor(x.tend)])));
      const invoices = d.echeances.slice(0, 7);
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
