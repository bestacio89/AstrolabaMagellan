import { describe, expect, it } from 'vitest';
import { calculerJaugeGroupe, infoBulleDateLimite } from './entete-groupe.logique';

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

describe('En-tête de groupe — info-bulle de date limite', () => {
  it('liste les tâches qui dépassent la date limite avec leur fin prévue', () => {
    expect(infoBulleDateLimite({
      code: 'AXE1', date: '2026-10-30', etat: 'risque', libelle: 'Date limite · risque dans 5 jours',
      niveau: 'attention', jours: 5, ecart: 2, finMax: '2026-11-01', n: 3, valides: 1, ouvertes: 2,
      auDela: [{ uid: 't1', libelle: 'Livraison API', fin: '2026-11-01', statut: 'En cours' }],
    })).toContain('Livraison API · 2026-11-01');
  });

  it('n’ajoute pas de liste quand aucune tâche ne dépasse', () => {
    expect(infoBulleDateLimite({
      code: 'AXE2', date: '2026-10-30', etat: 'tenue', libelle: 'Date limite tenue',
      niveau: 'ok', jours: 0, ecart: 0, finMax: '2026-10-28', n: 2, valides: 2, ouvertes: 0, auDela: [],
    })).toBe('Date limite tenue');
  });
});
