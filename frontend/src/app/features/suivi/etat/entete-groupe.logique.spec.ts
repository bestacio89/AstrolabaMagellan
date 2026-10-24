import { describe, expect, it } from 'vitest';
import { calculerJaugeGroupe } from './entete-groupe.logique';

describe('En-tête de groupe — jauge', () => {
  it('compte uniquement les tâches validées et exclut les tâches annulées', () => {
    expect(calculerJaugeGroupe([
      { statut: 'Validé' },
      { statut: 'En cours' },
      { statut: 'À faire', annulee: true },
    ])).toMatchObject({ valides: 1, total: 2, pourcentage: 50, terminee: false, mot: 'validées' });
  });

  it('signale un groupe terminé quand toutes les tâches actives sont validées', () => {
    expect(calculerJaugeGroupe([{ statut: 'Validé' }, { statut: 'À faire', annulee: true }], 'réalisés'))
      .toMatchObject({ valides: 1, total: 1, pourcentage: 100, terminee: true, mot: 'réalisés' });
  });

  it('retourne une jauge vide pour un groupe ne contenant que des tâches annulées', () => {
    expect(calculerJaugeGroupe([{ statut: 'À faire', annulee: true }], 'livrés'))
      .toMatchObject({ valides: 0, total: 0, pourcentage: 0, terminee: false, mot: 'livrés' });
  });
});
