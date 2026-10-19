import { PointVigilance } from '../api/modeles';

/**
 * Points de vigilance qui portent sur l'argent (coûts, achats, frais, facturation) : ils sont montrés dans Rentabilité,
 * jamais sur le tableau de bord, qui reste partageable (aucun montant).
 */
const CLES_FINANCIERES = new Set(['cout', 'achats', 'frais', 'echeances', 'echapres']);

export function estFinancier(p: Pick<PointVigilance, 'cle' | 'unite'>): boolean {
  return p.unite === '€' || CLES_FINANCIERES.has(p.cle);
}
