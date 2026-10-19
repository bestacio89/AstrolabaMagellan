import { describe, expect, it } from 'vitest';
import { RISK_IMPACT, RISK_PROBA, riskNiveau } from './constantes';

describe('Risques (4 niveaux, criticité de 1 à 16)', () => {
  it('propose 4 niveaux de probabilité et d’importance', () => {
    expect(RISK_PROBA.join('|')).toBe('Faible|Modérée|Forte|Très forte');
    expect(RISK_IMPACT.join('|')).toBe('Faible|Moyenne|Forte|Critique');
  });

  it('lit le niveau d’une criticité comme la matrice de référence : 1 à 3 faible, 4 à 6 moyen, 8 et plus fort', () => {
    expect([1, 2, 3].map(riskNiveau)).toEqual(['faible', 'faible', 'faible']);
    expect([4, 6].map(riskNiveau)).toEqual(['moyen', 'moyen']);
    expect([8, 9, 12, 16].map(riskNiveau)).toEqual(['fort', 'fort', 'fort', 'fort']);
  });
});
