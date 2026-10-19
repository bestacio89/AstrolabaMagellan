import { describe, expect, it } from 'vitest';
import { ordonner, triSuivant, valeurDeTri } from './tri.logique';

describe('Tri des colonnes', () => {
  it('passe de croissant à décroissant, puis revient à l’ordre d’origine', () => {
    expect(triSuivant(null, 2)).toEqual([2, 1]);
    expect(triSuivant([2, 1], 2)).toEqual([2, -1]);
    expect(triSuivant([2, -1], 2)).toBeNull();
    expect(triSuivant([2, -1], 3)).toEqual([3, 1]);
  });

  it('lit les dates, les nombres signés et le texte', () => {
    expect(valeurDeTri('05/03/2027')).toBe(20270305);
    expect(valeurDeTri('1 234,5 JH')).toBe(1234.5);
    expect(valeurDeTri('−3')).toBe(-3);
    expect(valeurDeTri('▲ 2,5')).toBe(2.5);
    expect(valeurDeTri('En cours')).toBe('en cours');
    expect(valeurDeTri('—')).toBeNull();
  });

  it('met les vides en dernier et garde l’ordre d’origine en cas d’égalité', () => {
    expect(ordonner([3, null, 1, 3], 1)).toEqual([2, 0, 3, 1]);
    expect(ordonner([3, null, 1, 3], -1)).toEqual([0, 3, 2, 1]);
    expect(ordonner(['b', 'a10', 'a2'], 1)).toEqual([2, 1, 0]);
    expect(ordonner([2, 1], null)).toEqual([0, 1]);
  });
});
