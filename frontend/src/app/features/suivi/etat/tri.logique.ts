/**
 * Tri des colonnes (charte v2) : règles pures, sans navigateur. Un clic trie en croissant (▲), puis en décroissant (▼),
 * puis revient à l'ordre d'origine. Les valeurs vides vont toujours en fin de liste.
 */

/** État du tri d'un tableau : [index de colonne, 1 croissant | -1 décroissant]. */
export type EtatTri = [number, 1 | -1];

/** État suivant après un clic sur la colonne i. */
export function triSuivant(etat: EtatTri | null | undefined, i: number): EtatTri | null {
  if (!etat || etat[0] !== i) return [i, 1];
  return etat[1] > 0 ? [i, -1] : null;
}

/** Valeur de tri d'un texte de cellule : date jj/mm/aaaa, nombre (« 1 234,5 JH », « −3 », « 12 % »), sinon texte en minuscules ; null si vide. */
export function valeurDeTri(texte: string): number | string | null {
  const s = texte.replace(/[  ]/g, ' ').replace(/[▲▼✓✎€💬⚠]/g, '').trim();
  if (!s || s === '—' || s === '-') return null;
  const d = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (d) return Number(d[3] + d[2] + d[1]);
  const nb = /^([+−-]?)\s*([\d ]+(?:,\d+)?)\s*(%|€|JH|j)?$/.exec(s);
  if (nb) {
    const v = Number(nb[2].replace(/ /g, '').replace(',', '.'));
    return nb[1] === '−' || nb[1] === '-' ? -v : v;
  }
  return s.toLowerCase();
}

/** Comparaison de deux valeurs non vides : nombres entre eux, sinon ordre alphabétique français (« 2 » avant « 10 »). */
export function comparer(a: number | string, b: number | string): number {
  return typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'fr', { numeric: true });
}

/**
 * Ordre d'un segment de lignes : indices triés selon les valeurs (vides en dernier, égalités dans l'ordre d'origine).
 * Sans tri, l'ordre d'origine.
 */
export function ordonner(valeurs: readonly (number | string | null)[], sens: 1 | -1 | null): number[] {
  const idx = valeurs.map((_, i) => i);
  if (!sens) return idx;
  return idx.sort((i, j) => {
    const x = valeurs[i], y = valeurs[j];
    if (x == null && y == null) return i - j;
    if (x == null) return 1;
    if (y == null) return -1;
    return comparer(x, y) * sens || i - j;
  });
}
