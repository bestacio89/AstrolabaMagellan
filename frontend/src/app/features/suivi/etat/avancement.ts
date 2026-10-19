/**
 * Avancement d'un ensemble de tâches (axe, lot, phase, échéance, projet) : JH des tâches validées ÷ JH prévus.
 * Une tâche compte quand elle est validée, au poids de sa charge ; une tâche annulée ne compte pas.
 * L'avancement déclaré d'une tâche (paliers 0 à 100 %) reste une indication : il n'entre dans aucun pourcentage de groupe.
 * Jamais déduit du consommé. Même règle que le moteur du serveur (MoteurCalcul.AvancementValide).
 */
export interface TacheAvancement {
  charge: number;
  statut: string;
  annulee?: boolean;
}

export function avancementValide(taches: readonly TacheAvancement[]): number {
  const prevu = taches.reduce((s, t) => s + (t.charge || 0), 0);
  if (!prevu) return 0;
  return taches.reduce((s, t) => s + (!t.annulee && t.statut === 'Validé' ? t.charge || 0 : 0), 0) / prevu;
}
