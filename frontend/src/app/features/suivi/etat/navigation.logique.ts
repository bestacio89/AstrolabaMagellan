import { GroupeOnglets, Onglet, ONGLETS } from './constantes';

/**
 * Menu d'un projet (charte v2) : écrans visibles selon le rôle, entrée du menu qui regroupe un écran (sous-onglets),
 * libellés du fil d'Ariane. Fonctions simples, sans état, testées sans navigateur.
 */

/** Groupes et entrées visibles : un écran de montants n'apparaît que pour un rôle qui les voit ; une entrée regroupée sans sous-onglet visible disparaît. */
export function groupesVisibles(voitMontants: boolean, onglets: readonly GroupeOnglets[] = ONGLETS): GroupeOnglets[] {
  const visible = (o: Onglet): boolean => voitMontants || !o.montants;
  return onglets
    .map((g) => ({
      ...g,
      onglets: g.onglets
        .map((o) => (o.sous ? { ...o, sous: o.sous.filter(visible) } : o))
        .filter((o) => (o.sous ? o.sous.length > 0 : visible(o))),
    }))
    .filter((g) => g.onglets.length > 0);
}

/** Chemin vers lequel mène une entrée du menu : son premier sous-onglet visible, sinon elle-même. */
export function cheminEntree(o: Onglet): string {
  return o.sous?.[0]?.chemin ?? o.chemin;
}

/** L'entrée du menu est-elle active pour l'écran affiché ? (une entrée regroupée l'est sur chacun de ses sous-onglets) */
export function entreeActive(o: Onglet, chemin: string): boolean {
  return o.sous ? o.sous.some((x) => x.chemin === chemin) : o.chemin === chemin;
}

/** Entrée regroupée qui contient l'écran affiché (pour ses sous-onglets en haut de l'écran), ou null. */
export function entreeGroupee(chemin: string, groupes: readonly GroupeOnglets[] = ONGLETS): Onglet | null {
  for (const g of groupes) for (const o of g.onglets) if (o.sous?.some((x) => x.chemin === chemin)) return o;
  return null;
}

/** Tous les écrans (sous-onglets et annexes compris), à plat. */
export function tousLesEcrans(groupes: readonly GroupeOnglets[] = ONGLETS): Onglet[] {
  return groupes.flatMap((g) => [...g.onglets.flatMap((o) => o.sous ?? [o]), ...(g.annexes ?? [])]);
}

/** Libellé d'un écran (fil d'Ariane) : celui du sous-onglet pour un écran regroupé (« Frais », pas « Dépenses »). */
export function libelleEcran(chemin: string, groupes: readonly GroupeOnglets[] = ONGLETS): string {
  return tousLesEcrans(groupes).find((x) => x.chemin === chemin)?.libelle ?? '';
}

/** L'écran est-il réservé aux rôles qui voient les montants ? */
export function ecranDeMontants(chemin: string, groupes: readonly GroupeOnglets[] = ONGLETS): boolean {
  return tousLesEcrans(groupes).some((x) => x.chemin === chemin && !!x.montants);
}

/** Groupe de l'écran affiché, et s'il s'agit d'une annexe. */
export function groupeEcran(chemin: string, groupes: readonly GroupeOnglets[] = ONGLETS): { groupe: GroupeOnglets; annexe: boolean } | null {
  for (const g of groupes) {
    if (g.onglets.some((o) => entreeActive(o, chemin))) return { groupe: g, annexe: false };
    if (g.annexes?.some((x) => x.chemin === chemin)) return { groupe: g, annexe: true };
  }
  return null;
}
