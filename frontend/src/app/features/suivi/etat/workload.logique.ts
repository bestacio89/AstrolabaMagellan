/**
 * Workload › Liste des tâches : les trois affichages (charte v2 de la version HTML, 53-workload.js).
 * - Essentiel : le suivi courant ; lot, phase et type sous le nom de la tâche ;
 * - Suivi : Essentiel + type modifiable et dates prévues ;
 * - Complet : toutes les colonnes.
 */
export type VueListe = 'essentiel' | 'suivi' | 'complet';

export const VUES_LISTE: readonly [VueListe, string, string][] = [
  ['essentiel', 'Essentiel', 'Tâche, statut, avancement et chiffres ; lot, phase et type sous le nom de la tâche'],
  ['suivi', 'Suivi', 'Essentiel + type modifiable et dates prévues'],
  ['complet', 'Complet', 'Toutes les colonnes'],
];

/** Affichage mémorisé, « Essentiel » par défaut (ou si la valeur mémorisée n'existe plus). */
export function vueListe(v: string | null | undefined): VueListe {
  return VUES_LISTE.some(([k]) => k === v) ? (v as VueListe) : 'essentiel';
}

/** Colonnes affichées et leurs largeurs (%), selon l'affichage et le regroupement (axe « id », lot, phase). */
export function colonnesListe(vue: VueListe, dim: string) {
  const meta = vue === 'complet';
  const avecType = vue !== 'essentiel';
  const avecDates = vue !== 'essentiel';
  const nCols = 8 + (meta ? 2 : 0) + (avecType ? 1 : 0) + (avecDates ? 2 : 0);
  const largeurs =
    vue === 'complet'
      ? [dim === 'lot' ? 8 : 5, dim === 'phase' ? 8 : 9, 8, dim === 'id' ? 20.5 : 19.5, 4.5, 10, 9.5, 7, 7, 6.5, 6, 4.5, 2]
      : vue === 'suivi'
        ? [9, 28, 5, 11, 11, 7, 7, 7, 7, 6, 2]
        : [42, 6, 13, 13, 7, 9, 7, 3];
  /** Colonnes avant « Tâche » (pour la ligne de total). */
  const nAvant = (meta ? 2 : 0) + (avecType ? 1 : 0);
  return { meta, avecType, avecDates, nCols, largeurs, nAvant };
}
