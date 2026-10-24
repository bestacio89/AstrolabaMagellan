/**
 * Règle commune de jauge pour les en-têtes de groupe du suivi.
 * Les tâches annulées sont hors décompte ; seule la valeur exacte « Validé » compte comme réalisée.
 */
import type { DateLimiteAxe } from '../api/modeles';

export type MotJaugeGroupe = 'validées' | 'réalisés' | 'livrés';

export interface TacheJaugeGroupe {
  statut: string;
  annulee?: boolean;
}

export interface JaugeGroupe {
  valides: number;
  total: number;
  pourcentage: number;
  terminee: boolean;
  mot: MotJaugeGroupe;
  infoBulle: string;
}

export function calculerJaugeGroupe(taches: readonly TacheJaugeGroupe[], mot: MotJaugeGroupe = 'validées'): JaugeGroupe {
  const actives = taches.filter((t) => !t.annulee);
  const valides = actives.filter((t) => t.statut === 'Validé').length;
  const total = actives.length;
  const pourcentage = total === 0 ? 0 : Math.round((valides / total) * 100);
  const terminee = total > 0 && valides === total;
  return {
    valides,
    total,
    pourcentage,
    terminee,
    mot,
    infoBulle: valides + ' / ' + total + ' ' + mot + '. Les tâches annulées sont exclues du décompte.',
  };
}

/** Info-bulle complète de la pastille de date limite, notamment les tâches qui dépassent. */
export function infoBulleDateLimite(date: DateLimiteAxe): string {
  return date.libelle + (date.auDela.length ? '\nTâches au-delà :\n' + date.auDela.map((t) => t.libelle + (t.fin ? ' · ' + t.fin : '')).join('\n') : '');
}
