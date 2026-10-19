/**
 * Petits outils de calcul (nombres, dates « AAAA-MM-JJ », jours fériés), repris de la version de référence (POC v65).
 * Les dates restent du texte : aucune conversion de fuseau horaire, donc aucun décalage d'un jour.
 */

/** Nombre lu depuis une valeur quelconque (0 si absent ou invalide). */
export function num(v: unknown): number {
  if (v == null || v === '' || typeof v === 'boolean') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (typeof v === 'object') return 0;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return isFinite(n) ? n : 0;
}

/** Arrondi à n décimales. */
export function round(n: number, d = 2): number {
  return Math.round(n * 10 ** d) / 10 ** d;
}

/** Somme (les valeurs absentes comptent pour 0). */
export function sum(liste: readonly (number | null | undefined)[]): number {
  return liste.reduce<number>((s, x) => s + (x || 0), 0);
}

/**
 * Nombre saisi par l'utilisateur (« 1,5 », « 2 », « 1 000 »).
 * null : champ vide ; NaN : saisie invalide.
 */
export function lireNombre(s: string | null | undefined): number | null {
  const t = String(s ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return isFinite(n) ? n : NaN;
}

// ---------------------------------------------------------------- dates

/** Nombre de millisecondes (UTC) d'une date « AAAA-MM-JJ ». */
export function toUTC(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  return fromUTC(toUTC(iso) + n * 864e5);
}

/** Écart en jours calendaires (b − a). */
export function joursEntre(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / 864e5);
}

/** Jour de la semaine (0 = dimanche). */
export function dow(iso: string): number {
  return new Date(toUTC(iso)).getUTCDay();
}

export function addMonths(mk: string, n: number): string {
  let [y, m] = mk.split('-').map(Number);
  m = m - 1 + n;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** Jours d'un mois « AAAA-MM ». */
export function monthDays(mk: string): string[] {
  const out: string[] = [];
  let d = mk + '-01';
  while (d.slice(0, 7) === mk) {
    out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

const cacheFeries: Record<number, Record<string, string>> = {};

function paques(y: number): string {
  const a = y % 19,
    b = Math.floor(y / 100),
    c = y % 100,
    d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    mois = Math.floor((h + l - 7 * m + 114) / 31),
    jour = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
}

/** Jours fériés français (métropole), même liste que le serveur. */
function feries(y: number): Record<string, string> {
  const deja = cacheFeries[y];
  if (deja) return deja;
  const e = paques(y);
  const liste: Record<string, string> = {
    [`${y}-01-01`]: 'Jour de l’an',
    [addDays(e, 1)]: 'Lundi de Pâques',
    [`${y}-05-01`]: 'Fête du travail',
    [`${y}-05-08`]: 'Victoire 1945',
    [addDays(e, 39)]: 'Ascension',
    [addDays(e, 50)]: 'Lundi de Pentecôte',
    [`${y}-07-14`]: 'Fête nationale',
    [`${y}-08-15`]: 'Assomption',
    [`${y}-11-01`]: 'Toussaint',
    [`${y}-11-11`]: 'Armistice',
    [`${y}-12-25`]: 'Noël',
  };
  cacheFeries[y] = liste;
  return liste;
}

export function holidayName(iso: string): string | null {
  return feries(+iso.slice(0, 4))[iso] ?? null;
}

export function isWorkday(iso: string): boolean {
  const d = dow(iso);
  return d !== 0 && d !== 6 && !holidayName(iso);
}

/** Pas « rond » pour les graduations d'un graphique. */
export function niceStep(v: number): number {
  const p = 10 ** Math.floor(Math.log10(v || 1));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** Valeurs distinctes, dans l'ordre d'apparition. */
export function distincts<T>(liste: readonly T[]): T[] {
  return [...new Set(liste)];
}

/** Tri alphabétique à la française. */
export function triFr(a: string, b: string): number {
  return a.localeCompare(b, 'fr');
}
