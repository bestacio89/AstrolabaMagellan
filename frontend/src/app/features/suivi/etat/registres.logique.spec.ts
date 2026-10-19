import { describe, expect, it } from 'vitest';
import { avecPersonne, dateOk, echeanceOk, extrait, finDuMois, initiales, instancesDuProjet, norm, personnes, personnesDe, refCourte, relatif, trierActions } from './registres.logique';

const J = '2026-10-19';

describe('Actions, décisions, risques', () => {
  it('une personne par élément, quel que soit le séparateur', () => {
    expect(personnes('C. PEREZ / N. ERDEVEN')).toEqual(['C. PEREZ', 'N. ERDEVEN']);
    expect(personnes('SSI, DSI et Alex')).toEqual(['SSI', 'DSI', 'Alex']);
    expect(initiales('Camille de la Martinière')).toBe('CM');
    expect(norm('  Élodie  ')).toBe('elodie');
  });

  it('personnes citées avec leur nombre d’éléments ; filtre sur une personne citée avec d’autres', () => {
    expect(personnesDe(['Alex / Sam', 'alex', null])).toEqual([
      { nom: 'Alex', cle: 'alex', n: 2 },
      { nom: 'Sam', cle: 'sam', n: 1 },
    ]);
    expect(avecPersonne('Alex / Sam', 'sam')).toBe(true);
    expect(avecPersonne('Alex', 'sam')).toBe(false);
    expect(avecPersonne('Alex', '')).toBe(true);
  });

  it('dates relatives et échéances', () => {
    expect(relatif('2026-10-20', J)).toBe('demain');
    expect(relatif('2026-10-16', J)).toBe('il y a 3 j');
    expect(finDuMois('2026-02-10')).toBe('2026-02-28');
    const a = (echeance: string | null, statut = 'À faire') => ({ echeance, statut });
    expect(echeanceOk(a('2026-10-01'), 'retard', J)).toBe(true);
    expect(echeanceOk(a('2026-10-01', 'Fait'), 'retard', J)).toBe(false);
    expect(echeanceOk(a('2026-10-25'), 'semaine', J)).toBe(true);
    expect(echeanceOk(a('2026-10-30'), 'semaine', J)).toBe(false);
    expect(echeanceOk(a('2026-10-30'), 'mois', J)).toBe(true);
    expect(echeanceOk(a('2026-11-05'), 'periode', J, '2026-11-01', '2026-11-30')).toBe(true);
    expect(echeanceOk(a(null), 'semaine', J)).toBe(false);
    expect(dateOk({ date: '2026-09-25' }, '30j', J)).toBe(true);
    expect(dateOk({ date: '2026-09-25' }, 'mois', J)).toBe(false);
  });

  it('actions ouvertes d’abord, puis par date cible', () => {
    const l = trierActions([
      { ref: 'A-001', statut: 'Fait', echeance: '2026-09-01' },
      { ref: 'A-002', statut: 'À faire', echeance: null },
      { ref: 'A-003', statut: 'En cours', echeance: '2026-10-01' },
    ]);
    expect(l.map((x) => x.ref)).toEqual(['A-003', 'A-002', 'A-001']);
  });

  it('instances par défaut, extrait, référence courte', () => {
    expect(instancesDuProjet({ projet: { settings: { instances: null } } })).toContain('COPROJ');
    expect(instancesDuProjet({ projet: { settings: { instances: ['CODIR'] } } })).toEqual(['CODIR']);
    expect(extrait('a   b', 10)).toBe('a b');
    expect(extrait('abcdefghij', 5)).toBe('abcd…');
    expect(refCourte('R-003')).toBe('R3');
  });
});
