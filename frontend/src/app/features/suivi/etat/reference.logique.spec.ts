import { describe, expect, it } from 'vitest';
import { PlanReference } from '../api/modeles';
import { derives, referenceAffichee, texteDecalage } from './reference.logique';

const ligne = (debut: string | null, fin: string | null) => ({ version: 1, debut, fin, charge: 5, cause: null, motif: null });

const r1: PlanReference = {
  id: 'r1', libelle: 'Référence initiale', date: '2026-05-12', par: 'Chef',
  lignes: { a: ligne('2026-06-01', '2026-06-30'), b: ligne('2026-07-01', '2026-07-31'), c: ligne(null, null), d: ligne('2026-08-01', '2026-08-10') },
};
const r2: PlanReference = { ...r1, id: 'r2', libelle: 'Référence 2', date: '2026-09-01' };

describe('Planning de référence', () => {
  it('affiche la plus récente par défaut, aucune sur demande', () => {
    expect(referenceAffichee([r1, r2], 'auto')?.id).toBe('r2');
    expect(referenceAffichee([r1, r2], 'r1')?.id).toBe('r1');
    expect(referenceAffichee([r1, r2], 'aucune')).toBeNull();
    expect(referenceAffichee([], 'auto')).toBeNull();
  });

  it('liste les tâches décalées, les plus gros retards d’abord', () => {
    const liste = derives(
      [
        { uid: 'a', label: 'A', annulee: false, debut: '2026-06-01', fin: '2026-06-30' }, // inchangée
        { uid: 'b', label: 'B', annulee: false, debut: '2026-07-01', fin: '2026-08-14' }, // +14 j
        { uid: 'c', label: 'C', annulee: false, debut: '2026-09-01', fin: '2026-09-05' }, // non datée dans la référence : planifiée depuis
        { uid: 'd', label: 'D', annulee: false, debut: '2026-08-03', fin: '2026-08-10' }, // début déplacé
        { uid: 'e', label: 'E', annulee: false, debut: '2026-10-01', fin: '2026-10-02' }, // ajoutée après la référence
      ],
      r1,
    );
    expect(liste.map((d) => d.uid)).toEqual(['b', 'd']);
    expect(liste[0].decalage).toBe(14);
    expect(texteDecalage(liste[0])).toBe('+14 j');
    expect(texteDecalage(liste[1])).toBe('début déplacé');
  });

  it('ignore les tâches annulées et signale les dates retirées', () => {
    const liste = derives(
      [
        { uid: 'a', label: 'A', annulee: true, debut: null, fin: null },
        { uid: 'b', label: 'B', annulee: false, debut: null, fin: null },
      ],
      r1,
    );
    expect(liste.map((d) => d.uid)).toEqual(['b']);
    expect(texteDecalage(liste[0])).toBe('dates retirées');
  });
});
