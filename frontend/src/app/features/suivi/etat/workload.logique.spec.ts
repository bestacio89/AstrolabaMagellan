import { describe, expect, it } from 'vitest';
import { colonnesListe, vueListe } from './workload.logique';

describe('Workload › affichages de la liste des tâches', () => {
  it('Essentiel par défaut, et si la valeur mémorisée est inconnue', () => {
    expect(vueListe(undefined)).toBe('essentiel');
    expect(vueListe('ancienne')).toBe('essentiel');
    expect(vueListe('complet')).toBe('complet');
  });

  it('autant de largeurs que de colonnes, pour chaque affichage', () => {
    for (const v of ['essentiel', 'suivi', 'complet'] as const) {
      for (const dim of ['id', 'lot', 'phase']) {
        const c = colonnesListe(v, dim);
        expect(c.largeurs.length).toBe(c.nCols);
      }
    }
  });

  it('Essentiel : ni type, ni dates, ni colonnes lot / phase', () => {
    expect(colonnesListe('essentiel', 'id')).toMatchObject({ meta: false, avecType: false, avecDates: false, nCols: 8, nAvant: 0 });
    expect(colonnesListe('suivi', 'id')).toMatchObject({ meta: false, avecType: true, avecDates: true, nCols: 11, nAvant: 1 });
    expect(colonnesListe('complet', 'id')).toMatchObject({ meta: true, avecType: true, avecDates: true, nCols: 13, nAvant: 3 });
  });
});
