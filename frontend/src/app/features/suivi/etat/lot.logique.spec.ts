import { describe, expect, it } from 'vitest';
import { libelleLot } from './lot.logique';

describe('libelleLot', () => {
  it('affiche Pilotage par défaut pour le lot 0', () => {
    expect(libelleLot('0')).toBe('Lot 0 – Pilotage');
  });
  it('remplace Pilotage par le nom choisi sans modifier le code', () => {
    expect(libelleLot('0', '  Préparation  ')).toBe('Lot 0 – Préparation');
  });
  it('garde le code visible pour les lots non nommés', () => {
    expect(libelleLot('2')).toBe('Lot 2');
  });
  it('combine le code et le nom personnalisé', () => {
    expect(libelleLot('2', 'Intégration')).toBe('Lot 2 – Intégration');
  });
  it('indique l’absence de rattachement', () => {
    expect(libelleLot(null)).toBe('Sans lot');
  });
});
