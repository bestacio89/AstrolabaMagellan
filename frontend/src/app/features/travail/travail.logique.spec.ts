import { describe, expect, it } from 'vitest';
import { Suivi } from '../suivi/api/modeles';
import { designe, dimanche, elementsDuProjet, joursDeLaSemaine, lignesSemaine, notificationsDuProjet, parPeriode } from './travail.logique';

const moi = { prenom: 'Camille', nom: 'Lefèvre' };

/** Suivi réduit à ce que « Mon travail » lit (le reste n'est pas utilisé). */
function suivi(): Suivi {
  const tache = (uid: string, label: string, charges: number[], fin: string | null, statut = 'En cours', type = '') => ({
    uid, label, charges, fin, debut: null, statut, type, annulee: false,
  });
  return {
    projet: {
      fiche: { client: 'Client', projet: 'Atlas' },
      profiles: [{ id: 'p0' }, { id: 'p1' }],
      track: { t1: { consoP: { '1': { '2026-10-05': 0.5 } } } },
      actions: [
        { id: 'a1', ref: 'A-001', libelle: 'Relancer le client', porteur: 'camille lefevre', statut: 'En cours', echeance: '2026-10-02' },
        { id: 'a2', ref: 'A-002', libelle: 'Autre', porteur: 'Romain', statut: 'En cours', echeance: '2026-10-02' },
      ],
      misesAJour: {
        t1: [
          { at: '2026-10-06T09:00:00+00:00', by: 'Romain Dupont', texte: '@Camille peux-tu reprendre ?' },
          { at: '2026-10-05T09:00:00+00:00', by: 'Camille Lefèvre', texte: '@Camille note pour moi' },
        ],
      },
      journal: [
        { at: '2026-10-06T10:00:00+00:00', by: 'Romain Dupont', objet: 'Tâche', champ: 'Maquettes · fin prévue', ancienne: '07/10/2026', nouvelle: '09/10/2026' },
        { at: '2026-10-06T11:00:00+00:00', by: 'Romain Dupont', objet: 'Action', champ: 'A-003 · porteur', ancienne: null, nouvelle: 'Camille Lefèvre' },
        { at: '2026-10-06T12:00:00+00:00', by: 'Romain Dupont', objet: 'Tâche', champ: 'Recette · statut', ancienne: 'À faire', nouvelle: 'En cours' },
      ],
    },
    modele: {
      p: [
        { i: 0, collaborateur: 'Romain Dupont' },
        { i: 1, collaborateur: 'Camille LEFEVRE' },
      ],
      tasks: [
        tache('t1', 'Maquettes', [0, 2], '2026-10-07'),
        tache('t2', 'Recette', [3, 0], '2026-10-20'),
        tache('t3', 'Guide utilisateur', [0, 1], '2026-10-20', 'À faire', 'Livrable'),
        tache('t4', 'Cadrage', [0, 1], '2026-09-01', 'Validé'),
      ],
    },
    droits: { peutSaisirConsomme: true },
  } as unknown as Suivi;
}

describe('Mon travail', () => {
  it('reconnaît la personne par son prénom et son nom, sans accents ni majuscules', () => {
    expect(designe('Camille LEFEVRE', moi)).toBe(true);
    expect(designe('Lefèvre Camille (consultante)', moi)).toBe(true);
    expect(designe('Camille', moi)).toBe(false); // prénom seul : ambigu
    expect(designe('Camille Martin', moi)).toBe(false);
  });

  it('liste mes tâches non validées et mes actions ouvertes', () => {
    const e = elementsDuProjet(suivi(), 'x', moi);
    expect(e.map((x) => x.titre)).toEqual(['Maquettes', 'Guide utilisateur', 'A-001 · Relancer le client']);
    expect(e[1]).toMatchObject({ genre: 'Livrable', ecran: 'ateliers' });
  });

  it('regroupe par période : en retard, cette semaine, plus tard', () => {
    const groupes = parPeriode(elementsDuProjet(suivi(), 'x', moi), '2026-10-06');
    expect(groupes.map((g) => [g.cle, g.elements.length])).toEqual([
      ['retard', 1],
      ['semaine', 1],
      ['plus-tard', 1],
    ]);
    expect(dimanche('2026-10-06')).toBe('2026-10-11');
    expect(dimanche('2026-10-11')).toBe('2026-10-11');
  });

  it('prépare ma semaine avec le consommé déjà saisi', () => {
    const l = lignesSemaine(suivi(), 'x', moi, joursDeLaSemaine('2026-10-05'));
    expect(l.map((x) => x.uid)).toEqual(['t1']); // t3 « À faire », prévue plus tard : pas cette semaine
    expect(lignesSemaine(suivi(), 'x', moi, joursDeLaSemaine('2026-10-19')).map((x) => x.uid)).toEqual(['t1', 't3']);
    expect(l[0]).toMatchObject({ profilId: 'p1', parJour: { '2026-10-05': 0.5 } });
    expect(joursDeLaSemaine('2026-10-05')).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']);
  });

  it('notifie les mentions, ce qu’on me confie et ce qui change sur mes tâches, jamais mes propres saisies', () => {
    const s = suivi();
    const n = notificationsDuProjet(s, 'x', moi, elementsDuProjet(s, 'x', moi));
    expect(n.map((x) => x.texte)).toEqual([
      'vous a mentionné(e) sur « Maquettes » : @Camille peux-tu reprendre ?',
      'a modifié « Maquettes » · fin prévue : 07/10/2026 → 09/10/2026',
      'vous a confié A-003',
    ]);
  });
});
