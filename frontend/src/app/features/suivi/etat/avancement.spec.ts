import { describe, expect, it } from 'vitest';
import { avancementValide } from './avancement';

describe('Avancement = JH des tâches validées ÷ JH prévus', () => {
  it('ne compte que les tâches validées, au poids de leur charge', () => {
    expect(avancementValide([{ charge: 8, statut: 'Validé' }, { charge: 2, statut: 'En cours' }])).toBe(0.8);
  });

  it('ignore une tâche annulée, même au statut « Validé »', () => {
    expect(avancementValide([{ charge: 4, statut: 'Validé' }, { charge: 4, statut: 'Validé', annulee: true }])).toBe(0.5);
  });

  it('vaut 0 sans charge prévue', () => {
    expect(avancementValide([])).toBe(0);
    expect(avancementValide([{ charge: 0, statut: 'Validé' }])).toBe(0);
  });
});
