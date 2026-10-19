import { describe, expect, it } from 'vitest';
import { caseChaleur, grapheCharge, MoisCharge, previsionnel, prevuReelADate, texteReste, ton, valeurPlanning } from './plan-de-charge.logique';

const M: MoisCharge[] = [
  { mois: '2026-09', refP: [10, 5], consoP: [12, 2], tspP: [10, 5], ref: 15, conso: 14, tsp: 15 },
  { mois: '2026-10', refP: [10, 5], consoP: [4, 0], tspP: [10, 5], ref: 15, conso: 4, tsp: 15 },
  { mois: '2026-11', refP: [8, 5], consoP: [0, 0], tspP: [10, 5], ref: 13, conso: 0, tsp: 15 },
];

describe('Plan de charge', () => {
  it('prévu et réel à date : jusqu’au mois en cours compris ; profils en avance ou en retard', () => {
    const r = prevuReelADate(M, '2026-10', [0, 1]);
    expect([r.pT, r.rT]).toEqual([30, 18]);
    expect(r.avance).toEqual([]);
    expect(r.retard).toEqual([0, 1]);
    expect(ton(12, 10)).toBe('pc-sur');
    expect(ton(2, 5)).toBe('pc-sous');
  });

  it('graphe : barres réelles jusqu’au dernier mois saisi, cumul vendu seulement si replanifié', () => {
    const g = grapheCharge(M, '2026-10', false);
    expect(g.barres.map((b) => !!b.reel)).toEqual([true, true, false]);
    expect(g.cumulVendu).toBeNull();
    expect(grapheCharge(M, '2026-10', true).cumulVendu).not.toBeNull();
  });

  it('prévisionnel : réel des mois écoulés + prévisionnel ensuite ; reste à placer ; déplacé par rapport au TSP', () => {
    const plan: Record<string, number[]> = { '2026-10': [10, 5], '2026-11': [8, 7] };
    const c = previsionnel(M, '2026-10', [{ i: 0, nom: 'Chef', entite: 'FO', charge: 30 }, { i: 1, nom: 'Dev', entite: 'FO', charge: 15 }], (i, mk) => plan[mk]?.[i] ?? 0);
    expect(c.proj[0]).toBe(12 + 10 + 8);
    expect(c.reste[1]).toBe(15 - (2 + 5 + 7));
    expect(c.ecM).toEqual([null, 0, 0]);
    expect(c.deplaces).toBe(2); // 7 au lieu de 5 en novembre
    expect(texteReste(0)).toEqual(['✓ tout est placé', 'pv-ok']);
    expect(texteReste(1)[1]).toBe('pv-aplacer');
    expect(texteReste(-2)[1]).toBe('pv-trop');
  });

  it('carte de chaleur : taux d’occupation sur les jours ouvrés, sans taux pour un profil d’achat', () => {
    const p = { i: 0, nom: 'Chef', entite: 'FO', charge: 0 };
    expect(caseChaleur(p, '2026-11', 0, '2026-10').classe).toBe('hm hm0');
    expect(caseChaleur(p, '2026-11', 25, '2026-10').classe).toBe('hm hm4');
    expect(caseChaleur(p, '2026-09', 10, '2026-10').classe).toContain('hm-passe');
    expect(caseChaleur({ ...p, entite: 'ACHAT' }, '2026-11', 25, '2026-10').classe).toBe('hm hm-multi');
    // absences : rappelées au survol, sans changer le taux ni le niveau
    const avec = caseChaleur(p, '2026-11', 10, '2026-10', 1.5);
    expect(avec.titre).toContain('1,5 j d’absence saisie');
    expect(avec.classe).toBe(caseChaleur(p, '2026-11', 10, '2026-10').classe);
    expect(caseChaleur(p, '2026-11', 10, '2026-10').titre).not.toContain('absence');
    expect(caseChaleur(p, '2026-11', 10, '2026-10', 2).titre).toContain('2 j d’absence saisie');
  });

  it('valeur du planning : 0 pour un mois absent', () => {
    expect(valeurPlanning({ months: ['2026-10'], rows: [[4]] }, 0, '2026-11')).toBe(0);
    expect(valeurPlanning({ months: ['2026-10'], rows: [[4]] }, 0, '2026-10')).toBe(4);
  });
});
