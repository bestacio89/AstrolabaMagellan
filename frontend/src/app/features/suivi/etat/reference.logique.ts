import { LigneReference, PlanReference } from '../api/modeles';
import { joursEntre } from './outils';

/**
 * Planning de référence (Gantt) : quelle référence afficher, et quelles tâches s'en écartent.
 * Fonctions simples, testées sans navigateur (reference.logique.spec.ts).
 */

/** Référence affichée : « auto » = la plus récente ; « aucune » = pas de comparaison ; sinon celle choisie. */
export function referenceAffichee(references: readonly PlanReference[], choix: string): PlanReference | null {
  if (choix === 'aucune' || !references.length) return null;
  if (choix !== 'auto') return references.find((r) => r.id === choix) ?? references[references.length - 1];
  return references[references.length - 1];
}

/** Une tâche dont le planning actuel s'écarte de la référence. */
export interface Derive {
  uid: string;
  libelle: string;
  ligne: LigneReference;
  debutReference: string | null;
  finReference: string | null;
  debut: string | null;
  fin: string | null;
  /** Décalage de la fin, en jours calendaires (positif : plus tard). null : la tâche n'a plus de date de fin. */
  decalage: number | null;
}

/** Tâche telle que le Gantt la connaît (dates actuelles). */
export interface TacheDatee {
  uid: string;
  label: string;
  annulee: boolean;
  debut: string | null;
  fin: string | null;
}

/**
 * Tâches dont les dates ont changé depuis la référence (les plus gros retards d'abord).
 * Une tâche qui n'était pas datée dans la référence n'est pas une dérive : elle a simplement été planifiée depuis.
 */
export function derives(taches: readonly TacheDatee[], reference: PlanReference): Derive[] {
  const liste: Derive[] = [];
  for (const t of taches) {
    const l = reference.lignes[t.uid];
    if (!l || t.annulee || (!l.debut && !l.fin)) continue;
    if (l.debut === t.debut && l.fin === t.fin) continue;
    liste.push({
      uid: t.uid,
      libelle: t.label,
      ligne: l,
      debutReference: l.debut,
      finReference: l.fin,
      debut: t.debut,
      fin: t.fin,
      decalage: l.fin && t.fin ? joursEntre(l.fin, t.fin) : null,
    });
  }
  return liste.sort((a, b) => (b.decalage ?? Number.MAX_SAFE_INTEGER) - (a.decalage ?? Number.MAX_SAFE_INTEGER));
}

/** Décalage en clair : « +12 j », « −3 j », « dates retirées ». */
export function texteDecalage(d: Derive): string {
  if (d.decalage === null) return 'dates retirées';
  if (d.decalage === 0) return 'début déplacé';
  return (d.decalage > 0 ? '+' : '−') + Math.abs(d.decalage) + ' j';
}
